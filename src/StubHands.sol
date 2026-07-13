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

interface IBrain {
    function positions(address token) external view returns (
        address feed,
        uint256 basisPerUnit,
        uint256 originalUnits,
        uint256 remainingUnits,
        uint256 peakPrice,
        uint256 trailBps,
        uint256 rungsFired,
        bool    active
    );
}

/// @notice Executor. Reads cost basis from BRAIN — never accepts it
///         from the caller. Simulates a fill, posts to BOOKS.
contract StubHands {
    address public owner;
    IBooks  public books;
    IBrain  public brain;

    uint256 public slippageBps = 50; // 0.5%

    mapping(uint256 => bool) public settled; // intentNonce => done

    event Executed(
        uint256 indexed intentNonce,
        address indexed token,
        bytes32 receipt,
        uint256 priceOut
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _books, address _brain) {
        owner = msg.sender;
        books = IBooks(_books);
        brain = IBrain(_brain);
    }

    function setSlippage(uint256 bps) external onlyOwner {
        require(bps < 10000, "bad slippage");
        slippageBps = bps;
    }

    /// @param intentNonce from BRAIN's IntentEmitted event
    /// @param triggerPrice from the same event — the price BRAIN saw
    function execute(
        uint256 intentNonce,
        address token,
        uint256 unitsSold,
        uint256 triggerPrice,
        string calldata reason
    ) external onlyOwner returns (uint256 entryId) {
        require(!settled[intentNonce], "already settled");
        require(unitsSold > 0, "no units");
        settled[intentNonce] = true;

        // basis comes from BRAIN, not the caller
        (, uint256 basisPerUnit, , , , , , ) = brain.positions(token);
        require(basisPerUnit > 0, "no position");

        // simulate fill — you never get the trigger price exactly
        uint256 priceOut = triggerPrice - ((triggerPrice * slippageBps) / 10000);

        // real HANDS: this is the swap tx hash
        bytes32 receipt = keccak256(
            abi.encodePacked(intentNonce, token, block.timestamp)
        );

        emit Executed(intentNonce, token, receipt, priceOut);

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