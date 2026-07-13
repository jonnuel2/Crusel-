// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProfitTakerBooks {
    address public owner;
    address public hands;   // only HANDS can post entries

    struct Entry {
        uint256 intentNonce;   // links back to BRAIN
        address token;
        uint256 unitsSold;     // 18 dec
        uint256 basisPerUnit;  // 8 dec, USD
        uint256 priceOut;      // 8 dec, USD actually realized
        uint256 proceedsUsd;   // 8 dec
        uint256 basisUsd;      // 8 dec
        int256  realizedPnlUsd;// 8 dec, signed
        string  reason;        // RUNG | TRAIL | PANIC
        bytes32 receipt;       // HANDS tx hash
        uint256 timestamp;
    }

    Entry[] public entries;

    // running totals per token
    mapping(address => uint256) public totalProceedsUsd;
    mapping(address => uint256) public totalBasisUsd;
    mapping(address => int256)  public totalRealizedPnlUsd;
    mapping(address => uint256) public totalUnitsSold;

    event EntryPosted(
        uint256 indexed entryId,
        uint256 indexed intentNonce,
        address indexed token,
        uint256 proceedsUsd,
        uint256 basisUsd,
        int256  realizedPnlUsd,
        bytes32 receipt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyHands() {
        require(msg.sender == hands, "not hands");
        _;
    }

    constructor() { owner = msg.sender; }

    function setHands(address _hands) external onlyOwner {
        hands = _hands;
    }

    /// @notice Post a realized sale. Called by HANDS after a successful swap.
    /// @param priceOut actual USD/unit realized (8 dec) — may differ from
    ///        BRAIN's trigger price due to slippage. THIS is what books use.
    function post(
        uint256 intentNonce,
        address token,
        uint256 unitsSold,
        uint256 basisPerUnit,
        uint256 priceOut,
        string calldata reason,
        bytes32 receipt
    ) external onlyHands returns (uint256 entryId) {
        require(unitsSold > 0, "no units");

        // proceeds = units(18) * price(8) / 1e18  -> 8 dec USD
        uint256 proceedsUsd = (unitsSold * priceOut) / 1e18;
        uint256 basisUsd    = (unitsSold * basisPerUnit) / 1e18;

        int256 pnl = int256(proceedsUsd) - int256(basisUsd);

        entries.push(Entry({
            intentNonce:    intentNonce,
            token:          token,
            unitsSold:      unitsSold,
            basisPerUnit:   basisPerUnit,
            priceOut:       priceOut,
            proceedsUsd:    proceedsUsd,
            basisUsd:       basisUsd,
            realizedPnlUsd: pnl,
            reason:         reason,
            receipt:        receipt,
            timestamp:      block.timestamp
        }));

        entryId = entries.length - 1;

        totalProceedsUsd[token]    += proceedsUsd;
        totalBasisUsd[token]       += basisUsd;
        totalRealizedPnlUsd[token] += pnl;
        totalUnitsSold[token]      += unitsSold;

        emit EntryPosted(
            entryId, intentNonce, token,
            proceedsUsd, basisUsd, pnl, receipt
        );
    }

    // ---------- reads ----------

    function entryCount() external view returns (uint256) {
        return entries.length;
    }

    /// @notice The three ledger legs for one entry.
    ///         Dr USDC / Cr Token(basis) / Cr Realized Gain
    function legs(uint256 entryId)
        external view
        returns (
            uint256 drUsdc,
            uint256 crTokenBasis,
            int256  crRealizedGain,
            bytes32 receipt
        )
    {
        Entry memory e = entries[entryId];
        return (e.proceedsUsd, e.basisUsd, e.realizedPnlUsd, e.receipt);
    }

    /// @notice Proves the books balance: Dr == Cr for every entry.
    function isBalanced(uint256 entryId) external view returns (bool) {
        Entry memory e = entries[entryId];
        return int256(e.proceedsUsd) == int256(e.basisUsd) + e.realizedPnlUsd;
    }

    function summary(address token)
        external view
        returns (uint256 proceeds, uint256 basis, int256 pnl, uint256 units)
    {
        return (
            totalProceedsUsd[token],
            totalBasisUsd[token],
            totalRealizedPnlUsd[token],
            totalUnitsSold[token]
        );
    }
}