// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

interface IRecord {
    function logCall(
        uint256 intentNonce,
        address user,
        address token,
        uint256 unitsIntended,
        uint256 triggerPrice,
        uint256 gainBps,
        string calldata reason
    ) external returns (uint256);
}

/// @notice Multi-tenant policy engine. Anyone can register a position and a
///         ladder. Crusel watches it and emits a call when a rung or the
///         trailing stop triggers. It never holds funds and never swaps.
contract ProfitTakerBrain {
    address public owner;
    IRecord public record;
    uint256 public nonce;

    /// @notice How old a feed answer may be before BRAIN rejects it. Set at
    ///         construction: a few hours on mainnet (real feeds heartbeat ~1h),
    ///         loose on the testnet demo where a mock feed sits untouched.
    uint256 public immutable MAX_STALENESS;

    struct Rung {
        uint256 gainBps;   // +2000 = +20%
        uint256 sellBps;   // 2500 = 25% of ORIGINAL units
    }

    struct Position {
        address feed;
        uint256 basisPerUnit;    // 8 dec USD
        uint256 originalUnits;   // 18 dec
        uint256 remainingUnits;  // 18 dec
        uint256 peakPrice;       // 8 dec
        uint256 trailArmBps;     // trail dormant until gain >= this
        uint256 trailBps;        // then exit on this % giveback from peak
        uint256 rungsFired;
        bool    trailArmed;
        bool    active;
    }

    // user => token => position
    mapping(address => mapping(address => Position)) public positions;
    mapping(address => mapping(address => Rung[]))   public ladders;

    // registry so the keeper can iterate
    address[] public users;
    mapping(address => bool) public known;
    mapping(address => address[]) public userTokens;
    mapping(address => mapping(address => bool)) public hasToken;

    // whitelisted feeds — a user cannot point Crusel at a fake oracle
    mapping(address => address) public feedOf;   // token => feed
    address[] public supportedTokens;

    event PositionOpened(
        address indexed user,
        address indexed token,
        uint256 basisPerUnit,
        uint256 units,
        uint256 trailArmBps,
        uint256 trailBps,
        uint256 rungs
    );

    event PositionClosed(address indexed user, address indexed token);

    event IntentEmitted(
        address indexed user,
        address indexed token,
        uint256 indexed intentNonce,
        uint256 unitsToSell,
        uint256 triggerPrice,
        uint256 gainBps,
        string  reason
    );

    event TrailArmed(address indexed user, address indexed token, uint256 atPrice);
    event PeakUpdated(address indexed user, address indexed token, uint256 newPeak);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _record, uint256 _maxStaleness) {
        require(_maxStaleness > 0, "no staleness window");
        owner = msg.sender;
        record = IRecord(_record);
        MAX_STALENESS = _maxStaleness;
    }

    // ---------- feed registry (owner) ----------

    function setFeed(address token, address feed) external onlyOwner {
        if (feedOf[token] == address(0)) supportedTokens.push(token);
        feedOf[token] = feed;
    }

    function supportedTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }

    // ---------- open a position (anyone) ----------

    /// @notice Register your position. Crusel will watch it and call your exits.
    ///         You keep custody. Crusel never touches your funds.
    /// @param token        the asset you hold
    /// @param basisPerUnit your entry price, 8 decimals ($50,000 = 5000000000000)
    /// @param units        how much you hold, 18 decimals (1 BTC = 1e18)
    /// @param trailArmBps  trail stays asleep until gain hits this (10000 = +100%)
    /// @param trailBps     then exits on this giveback from peak (3000 = 30%)
    /// @param rungs        your exit ladder, ascending
    function openPosition(
        address token,
        uint256 basisPerUnit,
        uint256 units,
        uint256 trailArmBps,
        uint256 trailBps,
        Rung[] calldata rungs
    ) external {
        address feed = feedOf[token];
        require(feed != address(0), "unsupported token");
        require(basisPerUnit > 0, "no basis");
        require(units > 0, "no units");
        require(rungs.length > 0, "no rungs");
        require(trailBps > 0 && trailBps < 10000, "bad trail");

        uint256 totalSell;
        for (uint256 i; i < rungs.length; i++) {
            if (i > 0) require(rungs[i].gainBps > rungs[i - 1].gainBps, "rungs unsorted");
            require(rungs[i].sellBps > 0, "zero sell");
            totalSell += rungs[i].sellBps;
        }
        require(totalSell <= 10000, "ladder oversells");

        delete ladders[msg.sender][token];
        for (uint256 i; i < rungs.length; i++) {
            ladders[msg.sender][token].push(rungs[i]);
        }

        uint256 px = _price(feed);

        positions[msg.sender][token] = Position({
            feed:           feed,
            basisPerUnit:   basisPerUnit,
            originalUnits:  units,
            remainingUnits: units,
            peakPrice:      px > basisPerUnit ? px : basisPerUnit,
            trailArmBps:    trailArmBps,
            trailBps:       trailBps,
            rungsFired:     0,
            trailArmed:     false,
            active:         true
        });

        // registry
        if (!known[msg.sender]) {
            known[msg.sender] = true;
            users.push(msg.sender);
        }
        if (!hasToken[msg.sender][token]) {
            hasToken[msg.sender][token] = true;
            userTokens[msg.sender].push(token);
        }

        emit PositionOpened(
            msg.sender, token, basisPerUnit, units,
            trailArmBps, trailBps, rungs.length
        );
    }

    /// @notice Stop watching. Your position, your call.
    function closePosition(address token) external {
        Position storage p = positions[msg.sender][token];
        require(p.active, "not active");
        p.active = false;
        emit PositionClosed(msg.sender, token);
    }

    // ---------- oracle ----------

    function _price(address feed) internal view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) =
            AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "stale feed");
        return uint256(answer);
    }

    function price(address token) external view returns (uint256) {
        address feed = feedOf[token];
        require(feed != address(0), "unsupported token");
        return _price(feed);
    }

    // ---------- policy ----------

    /// @dev reason: 0 = none, 1 = RUNG, 2 = TRAIL
    function check(address user, address token)
        public view
        returns (uint8 reason, uint256 unitsToSell, uint256 gainBps, uint256 px)
    {
        Position memory p = positions[user][token];
        if (!p.active || p.remainingUnits == 0) return (0, 0, 0, 0);

        px = _price(p.feed);

        gainBps = px > p.basisPerUnit
            ? ((px - p.basisPerUnit) * 10000) / p.basisPerUnit
            : 0;

        // trail — only once armed
        bool armed = p.trailArmed || gainBps >= p.trailArmBps;
        if (armed) {
            uint256 peak = px > p.peakPrice ? px : p.peakPrice;
            if (peak > p.basisPerUnit) {
                uint256 floorPx = peak - ((peak * p.trailBps) / 10000);
                if (px <= floorPx) return (2, p.remainingUnits, gainBps, px);
            }
        }

        // rung — next unfired only
        Rung[] storage L = ladders[user][token];
        if (p.rungsFired < L.length) {
            Rung memory next = L[p.rungsFired];
            if (gainBps >= next.gainBps) {
                uint256 want = (p.originalUnits * next.sellBps) / 10000;
                if (want > p.remainingUnits) want = p.remainingUnits;
                return (1, want, gainBps, px);
            }
        }

        return (0, 0, gainBps, px);
    }

    /// @notice Poke the agent. Permissionless — anyone can keep it fresh.
    ///         Ratchets the peak, fires a call if one is due.
    function fire(address user, address token) external returns (uint256) {
        Position storage p = positions[user][token];
        require(p.active, "inactive");

        (uint8 reason, uint256 unitsToSell, uint256 gainBps, uint256 px) =
            check(user, token);

        if (!p.trailArmed && gainBps >= p.trailArmBps) {
            p.trailArmed = true;
            emit TrailArmed(user, token, px);
        }

        if (p.trailArmed && px > p.peakPrice) {
            p.peakPrice = px;
            emit PeakUpdated(user, token, px);
        }

        require(reason != 0, "no trigger");

        p.remainingUnits -= unitsToSell;

        if (reason == 1) {
            p.rungsFired += 1;
        } else {
            p.active = false;
        }
        if (p.remainingUnits == 0) p.active = false;

        nonce++;
        string memory r = reason == 1 ? "RUNG" : "TRAIL";

        record.logCall(nonce, user, token, unitsToSell, px, gainBps, r);
        emit IntentEmitted(user, token, nonce, unitsToSell, px, gainBps, r);

        return nonce;
    }

    // ---------- reads ----------

    function userCount() external view returns (uint256) {
        return users.length;
    }

    function tokenCountOf(address user) external view returns (uint256) {
        return userTokens[user].length;
    }

    function ladderLength(address user, address token) external view returns (uint256) {
        return ladders[user][token].length;
    }

    function getRung(address user, address token, uint256 i)
        external view returns (uint256, uint256)
    {
        Rung memory r = ladders[user][token][i];
        return (r.gainBps, r.sellBps);
    }
}