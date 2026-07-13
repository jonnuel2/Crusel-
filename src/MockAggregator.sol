// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAggregator {
    int256  private answer;
    uint256 private updatedAt;
    uint80  private roundId;
    uint8   public  decimals = 8;
    string  public  description;

    constructor(string memory _description, int256 _initialPrice) {
        description = _description;
        answer = _initialPrice;
        updatedAt = block.timestamp;
        roundId = 1;
    }

    /// @notice Push a new price. 8 decimals: $105,000 = 10500000000000
    function setPrice(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
        roundId++;
    }

    function latestRoundData() external view returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}