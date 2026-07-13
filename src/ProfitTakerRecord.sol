// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Public record of every call Crusel made, and whether anyone acted.
///         No custody. No proceeds. No P&L. Crusel does not hold funds and
///         cannot verify fills — so it does not pretend to.
contract ProfitTakerRecord {
    address public owner;
    address public brain;

    enum Status { OPEN, EXECUTED }

    struct Call {
        uint256 intentNonce;
        address user;
        address token;
        uint256 unitsIntended;
        uint256 triggerPrice;
        uint256 gainBps;
        string  reason;
        uint256 calledAt;

        address executedBy;
        bytes32 txHash;
        uint256 executedAt;
        Status  status;
    }

    Call[] public calls;
    mapping(uint256 => uint256) public callOfNonce;
    mapping(address => uint256[]) public callsOfUser;

    uint256 public callCount;
    uint256 public executedCount;

    event CallMade(
        uint256 indexed callId,
        uint256 indexed intentNonce,
        address indexed user,
        address token,
        uint256 unitsIntended,
        uint256 triggerPrice,
        uint256 gainBps,
        string  reason
    );

    event CallExecuted(
        uint256 indexed callId,
        uint256 indexed intentNonce,
        address indexed executedBy,
        bytes32 txHash
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() { owner = msg.sender; }

    function setBrain(address _brain) external onlyOwner {
        brain = _brain;
    }

    function logCall(
        uint256 intentNonce,
        address user,
        address token,
        uint256 unitsIntended,
        uint256 triggerPrice,
        uint256 gainBps,
        string calldata reason
    ) external returns (uint256 callId) {
        require(msg.sender == brain, "not brain");

        calls.push(Call({
            intentNonce:   intentNonce,
            user:          user,
            token:         token,
            unitsIntended: unitsIntended,
            triggerPrice:  triggerPrice,
            gainBps:       gainBps,
            reason:        reason,
            calledAt:      block.timestamp,
            executedBy:    address(0),
            txHash:        bytes32(0),
            executedAt:    0,
            status:        Status.OPEN
        }));

        callId = calls.length - 1;
        callOfNonce[intentNonce] = callId;
        callsOfUser[user].push(callId);
        callCount++;

        emit CallMade(
            callId, intentNonce, user, token,
            unitsIntended, triggerPrice, gainBps, reason
        );
    }

    /// @notice Report that you acted on a call. Permissionless.
    ///         Attributed, not verified — we record who claimed it.
    function acknowledge(uint256 intentNonce, bytes32 txHash)
        external returns (uint256 callId)
    {
        callId = callOfNonce[intentNonce];
        Call storage c = calls[callId];

        require(c.intentNonce == intentNonce, "unknown call");
        require(c.status == Status.OPEN, "already acknowledged");

        c.executedBy = msg.sender;
        c.txHash     = txHash;
        c.executedAt = block.timestamp;
        c.status     = Status.EXECUTED;

        executedCount++;

        emit CallExecuted(callId, intentNonce, msg.sender, txHash);
    }

    // ---------- reads ----------

    function totalCalls() external view returns (uint256) {
        return calls.length;
    }

    function executionRateBps() external view returns (uint256) {
        if (callCount == 0) return 0;
        return (executedCount * 10000) / callCount;
    }

    function callCountOf(address user) external view returns (uint256) {
        return callsOfUser[user].length;
    }

    function getCall(uint256 callId)
        external view
        returns (
            uint256 intentNonce,
            address user,
            address token,
            uint256 unitsIntended,
            uint256 triggerPrice,
            uint256 gainBps,
            string memory reason,
            uint256 calledAt,
            address executedBy,
            bytes32 txHash,
            Status  status
        )
    {
        Call memory c = calls[callId];
        return (
            c.intentNonce, c.user, c.token, c.unitsIntended,
            c.triggerPrice, c.gainBps, c.reason, c.calledAt,
            c.executedBy, c.txHash, c.status
        );
    }
}