// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

contract ProfitTakerBrain {
    address public owner;
    uint256 public nonce;

    uint256 public constant MAX_STALENESS = 1 hours;

    struct Rung {
        uint256 gainBps;   // trigger: +2000 = +20%
        uint256 sellBps;   // sell this % of ORIGINAL units
    }

    struct Position {
        address feed;
        uint256 basisPerUnit;    // 8 dec, USD at entry
        uint256 originalUnits;   // 18 dec, never changes
        uint256 remainingUnits;  // 18 dec, decrements
        uint256 peakPrice;       // 8 dec, high-water mark
        uint256 trailBps;        // giveback from peak, e.g. 3000 = 30%
        uint256 rungsFired;      // index of next unfired rung
        bool active;
    }

    mapping(address => Position) public positions;
    mapping(address => Rung[]) public ladders;

    event IntentEmitted(
        address indexed token,
        uint256 unitsToSell,
        uint256 priceAtTrigger,
        uint256 gainBps,
        string  reason,        // "RUNG" | "TRAIL" | "PANIC"
        uint256 nonce
    );

    event PeakUpdated(address indexed token, uint256 newPeak);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() { owner = msg.sender; }

    // ---------- setup ----------

    function setPosition(
        address token,
        address feed,
        uint256 basisPerUnit,
        uint256 units,
        uint256 trailBps,
        Rung[] calldata rungs
    ) external onlyOwner {
        require(rungs.length > 0, "no rungs");
        require(trailBps > 0 && trailBps < 10000, "bad trail");

        // rungs must ascend in gain, and sellBps must not exceed 100% total
        uint256 totalSell;
        for (uint256 i; i < rungs.length; i++) {
            if (i > 0) {
                require(rungs[i].gainBps > rungs[i-1].gainBps, "rungs unsorted");
            }
            require(rungs[i].sellBps > 0, "zero sell");
            totalSell += rungs[i].sellBps;
        }
        require(totalSell <= 10000, "ladder oversells");

        delete ladders[token];
        for (uint256 i; i < rungs.length; i++) {
            ladders[token].push(rungs[i]);
        }

        uint256 px = _price(feed);

        positions[token] = Position({
            feed: feed,
            basisPerUnit: basisPerUnit,
            originalUnits: units,
            remainingUnits: units,
            peakPrice: px > basisPerUnit ? px : basisPerUnit,
            trailBps: trailBps,
            rungsFired: 0,
            active: true
        });
    }

    // ---------- oracle ----------

    function _price(address feed) internal view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) =
            AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "stale feed");
        return uint256(answer);
    }

    // ---------- policy ----------

    /// @dev Pure view. reason: 0=none, 1=RUNG, 2=TRAIL
    function check(address token)
        public view
        returns (uint8 reason, uint256 unitsToSell, uint256 gainBps, uint256 px)
    {
        Position memory p = positions[token];
        if (!p.active || p.remainingUnits == 0) return (0, 0, 0, 0);

        px = _price(p.feed);

        gainBps = px > p.basisPerUnit
            ? ((px - p.basisPerUnit) * 10000) / p.basisPerUnit
            : 0;

        uint256 peak = px > p.peakPrice ? px : p.peakPrice;

        // TRAIL: only once we're in profit and price has given back trailBps from peak
        if (peak > p.basisPerUnit) {
            uint256 trailFloor = peak - ((peak * p.trailBps) / 10000);
            if (px <= trailFloor) {
                return (2, p.remainingUnits, gainBps, px); // dump everything
            }
        }

        // RUNG: next unfired rung, only if its threshold is met
        Rung[] storage L = ladders[token];
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

    /// @notice Anyone can poke this. Updates peak, fires intent if triggered.
    function fire(address token) external returns (uint256) {
        Position storage p = positions[token];
        require(p.active, "inactive");

        (uint8 reason, uint256 unitsToSell, uint256 gainBps, uint256 px) = check(token);

        // ratchet the peak regardless of whether we fire
        if (px > p.peakPrice) {
            p.peakPrice = px;
            emit PeakUpdated(token, px);
        }

        require(reason != 0, "no trigger");

        p.remainingUnits -= unitsToSell;

        if (reason == 1) {
            p.rungsFired += 1;   // rung spent forever, never re-fires on chop
        } else {
            p.active = false;    // trail = full exit, position closed
        }

        if (p.remainingUnits == 0) p.active = false;

        nonce++;
        emit IntentEmitted(
            token,
            unitsToSell,
            px,
            gainBps,
            reason == 1 ? "RUNG" : "TRAIL",
            nonce
        );
        return nonce;
    }

    function panicExit(address token) external onlyOwner returns (uint256) {
        Position storage p = positions[token];
        require(p.active && p.remainingUnits > 0, "nothing to exit");

        uint256 px = _price(p.feed);
        uint256 gainBps = px > p.basisPerUnit
            ? ((px - p.basisPerUnit) * 10000) / p.basisPerUnit
            : 0;

        uint256 units = p.remainingUnits;
        p.remainingUnits = 0;
        p.active = false;

        nonce++;
        emit IntentEmitted(token, units, px, gainBps, "PANIC", nonce);
        return nonce;
    }

    function ladderLength(address token) external view returns (uint256) {
        return ladders[token].length;
    }
}