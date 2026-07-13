// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRecordAck {
    function acknowledge(uint256 intentNonce, bytes32 txHash)
        external returns (uint256);
}

/// @notice Reference caller. Shows how an executor acknowledges a call
///         it acted on. Not privileged — anyone can acknowledge.
contract StubHands {
    address public owner;
    IRecordAck public record;

    event Executed(uint256 indexed intentNonce, bytes32 txHash);

    constructor(address _record) {
        owner = msg.sender;
        record = IRecordAck(_record);
    }

    /// @param txHash the caller's own swap transaction
    function execute(uint256 intentNonce, bytes32 txHash)
        external returns (uint256 callId)
    {
        require(msg.sender == owner, "not owner");
        emit Executed(intentNonce, txHash);
        callId = record.acknowledge(intentNonce, txHash);
    }
}