// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProfitTakerBrain} from "../src/ProfitTakerBrain.sol";
import {ProfitTakerRecord} from "../src/ProfitTakerRecord.sol";
import {StubHands} from "../src/StubHands.sol";

/// @notice X Layer MAINNET deploy (chain 196). No MockAggregator — Crusel is
///         wired to X Layer's real, whitelisted price feeds, which implement
///         the same AggregatorV3Interface the mock did. Migrating from testnet
///         is exactly this: whitelist real feeds instead of mocks. Zero change
///         to BRAIN.
///
/// Run:
///   forge script script/DeployMainnet.s.sol --rpc-url xlayer_mainnet --broadcast
contract DeployMainnet is Script {
    // ── X Layer mainnet tokens (the map keys users pick) ──
    address constant WBTC = 0xEA034fb02eB1808C2cc3adbC15f447B93CbE08e1;
    address constant WETH = 0x5A77f1443D16ee5761d310e38b62f77f726bC71c;
    address constant WOKB = 0xe538905cf8410324e03A5A23C1c177a474D59b2b;
    address constant USDT = 0x1E4a5963aBFD975d8c9021ce480b42188849D41d;
    address constant USDC = 0x74b7F16337b8972027F6196A17a631aC6dE26d22;
    address constant DAI  = 0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4;

    // ── X Layer mainnet price feeds (AggregatorV3Interface) ──
    // WBTC/WETH/OKB report 2 decimals, USDC 4 — BRAIN's gain math is a ratio,
    // so it is decimal-agnostic; only human-facing scaling cares (handled MCP-side).
    address constant WBTC_FEED = 0x3C7dCE5F83E99452CD399a1bCa5542BEd979E6CA;
    address constant WETH_FEED = 0x98ff91433c992153A8D6507cEA5b791Df69d7c99;
    address constant WOKB_FEED = 0x90AB4bc4991c71889A67F25eec044fD90E255e77;
    address constant USDT_FEED = 0xB249978EfdB8E01D5266F926409870c1Ec7336EA;
    address constant USDC_FEED = 0xC975719D0eC39Bb8880444ACeA9Cc8d29A35E4D4;
    address constant DAI_FEED  = 0x960cF115eeEAFBF5B184070DE9eD89593c712B71;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);

        ProfitTakerRecord record = new ProfitTakerRecord();
        // tight window — X Layer's real feeds heartbeat ~1h; reject anything
        // older than 3h so a stalled oracle can't drive a stale exit.
        ProfitTakerBrain brain = new ProfitTakerBrain(address(record), 3 hours);
        StubHands hands = new StubHands(address(record));

        record.setBrain(address(brain));

        // whitelist the real feeds — users pick a token, not an oracle
        brain.setFeed(WBTC, WBTC_FEED);
        brain.setFeed(WETH, WETH_FEED);
        brain.setFeed(WOKB, WOKB_FEED);
        brain.setFeed(USDT, USDT_FEED);
        brain.setFeed(USDC, USDC_FEED);
        brain.setFeed(DAI,  DAI_FEED);

        console.log("Brain:  ", address(brain));
        console.log("Record: ", address(record));
        console.log("Hands:  ", address(hands));
        console.log("Feeds whitelisted: WBTC WETH WOKB USDT USDC DAI");
        console.log("Next: set BRAIN/RECORD + NETWORK=mainnet in crusel-mcp env");

        vm.stopBroadcast();
    }
}
