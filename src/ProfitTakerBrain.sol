// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

interface IRecord {
    function logCall(
        uint256 intentNonce,
        address token,
        uint256 unitsIntended,
        uint256 triggerPrice,
        uint256 gainBps,
        string calldata reason
    ) external returns (uint256);
}

contract ProfitTakerBrain {
    address public owner;
    IRecord public record;
    uint256 public nonce;

    uint256 public constant MAX_STALENESS = 1 hours;

    struct Rung {
        uint256 gainBps;
        uint256 sellBps;
    }

    struct Position {
        address feed;
        uint256 basisPerUnit;
        uint256 originalUnits;
        uint256 remainingUnits;
        uint256 peakPrice;
        uint256 trailArmBps;
        uint256 trailBps;
        uint256 rungsFired;
        bool    trailArmed;
        bool    active;
    }

    mapping(address => Position) public positions;
    mapping(address => Rung[])   public ladders;

    event IntentEmitted(
        address indexed token,
        uint256 indexed intentNonce,
        uint256 unitsToSell,
        uint256 triggerPrice,
        uint256 gainBps,
        string  reason
    );

    event PeakUpdated(address indexed token, uint256 newPeak);
    event TrailArmed(address indexed token, uint256 atPrice, uint256 atGainBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _record) {
        owner = msg.sender;
        record = IRecord(_record);
    }

    function setPosition(
        address token,
        address feed,
        uint256 basisPerUnit,
        uint256 units,
        uint256 trailArmBps,
        uint256 trailBps,
        Rung[] calldata rungs
    ) external onlyOwner {
        require(rungs.length > 0, "no rungs");
        require(trailBps > 0 && trailBps < 10000, "bad trail");

        uint256 totalSell;
        for (uint256 i; i < rungs.length; i++) {
            if (i > 0) require(rungs[i].gainBps > rungs[i-1].gainBps, "rungs unsorted");
            require(rungs[i].sellBps > 0, "zero sell");
            totalSell += rungs[i].sellBps;
        }
        require(totalSell <= 10000, "ladder oversells");

        delete ladders[token];
        for (uint256 i; i < rungs.length; i++) ladders[token].push(rungs[i]);

        uint256 px = _price(feed);

        positions[token] = Position({
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
    }

    function _price(address feed) internal view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) =
            AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "stale feed");
        return uint256(answer);
    }

    /// @dev reason: 0 = none, 1 = RUNG, 2 = TRAIL
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

        bool armed = p.trailArmed || gainBps >= p.trailArmBps;
        if (armed) {
            uint256 peak = px > p.peakPrice ? px : p.peakPrice;
            if (peak > p.basisPerUnit) {
                uint256 floorPx = peak - ((peak * p.trailBps) / 10000);
                if (px <= floorPx) return (2, p.remainingUnits, gainBps, px);
            }
        }

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

    function fire(address token) external returns (uint256) {
        Position storage p = positions[token];
        require(p.active, "inactive");

        (uint8 reason, uint256 unitsToSell, uint256 gainBps, uint256 px) = check(token);

        if (!p.trailArmed && gainBps >= p.trailArmBps) {
            p.trailArmed = true;
            emit TrailArmed(token, px, gainBps);
        }

        if (p.trailArmed && px > p.peakPrice) {
            p.peakPrice = px;
            emit PeakUpdated(token, px);
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

        record.logCall(nonce, token, unitsToSell, px, gainBps, r);
        emit IntentEmitted(token, nonce, unitsToSell, px, gainBps, r);

        return nonce;
    }

    function panicExit(address token) external onlyOwner returns (uint256) {
        Position storage p = positions[token];
        require(p.active && p.remainingUnits > 0, "nothing to exit");

        uint256 px = _price(p.feed);
        uint256 units = p.remainingUnits;

        p.remainingUnits = 0;
        p.active = false;

        nonce++;
        record.logCall(nonce, token, units, px, 0, "PANIC");
        emit IntentEmitted(token, nonce, units, px, 0, "PANIC");

        return nonce;
    }

    function ladderLength(address token) external view returns (uint256) {
        return ladders[token].length;
    }

    function getRung(address token, uint256 i) external view returns (uint256, uint256) {
        Rung memory r = ladders[token][i];
        return (r.gainBps, r.sellBps);
    }
}