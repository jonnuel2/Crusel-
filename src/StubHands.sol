// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBooks {
    function post(
        uint256 intentNonce,
        address token,
        uint256 unitsSold,
        uint256 basisPerUnit,
        uint256 priceOut,
        string calldata reason,
        bytes32 receipt
    ) external returns (uint256);
}

/// @notice Placeholder executor. Simulates a fill with slippage,
///         then posts the realized sale to BOOKS.
///         Swap this for a real DEX router later — BOOKS never changes.
contract StubHands {
    address public owner;
    IBooks  public books;

    uint256 public slippageBps = 50; // 0.5% worse than trigger price

    event Executed(uint256 indexed intentNonce, bytes32 receipt, uint256 priceOut);

    constructor(address _books) {
        owner = msg.sender;
        books = IBooks(_books);
    }

    function setSlippage(uint256 bps) external {
        require(msg.sender == owner, "not owner");
        slippageBps = bps;
    }

    /// @notice Called with the contents of BRAIN's IntentEmitted event.
    function execute(
        uint256 intentNonce,
        address token,
        uint256 unitsSold,
        uint256 basisPerUnit,
        uint256 triggerPrice,
        string calldata reason
    ) external returns (uint256 entryId) {
        require(msg.sender == owner, "not owner");

        // simulate fill: you never get the trigger price exactly
        uint256 priceOut = triggerPrice - ((triggerPrice * slippageBps) / 10000);

        // in a real HANDS this is the swap tx hash; here we synthesize one
        bytes32 receipt = keccak256(
            abi.encodePacked(intentNonce, token, block.timestamp)
        );

        emit Executed(intentNonce, receipt, priceOut);

        entryId = books.post(
            intentNonce,
            token,
            unitsSold,
            basisPerUnit,
            priceOut,
            reason,
            receipt
        );
    }
}