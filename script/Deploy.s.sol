// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProfitTakerBrain} from "../src/ProfitTakerBrain.sol";
import {ProfitTakerRecord} from "../src/ProfitTakerRecord.sol";
import {StubHands} from "../src/StubHands.sol";
import {MockAggregator} from "../src/MockAggregator.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        MockAggregator btcFeed = new MockAggregator("BTC / USD", 100_000e8);
        MockAggregator ethFeed = new MockAggregator("ETH / USD",   3_000e8);

        ProfitTakerRecord record = new ProfitTakerRecord();
        ProfitTakerBrain brain = new ProfitTakerBrain(address(record));
        StubHands hands = new StubHands(address(record));

        record.setBrain(address(brain));

        address BTC = address(0xB7C);
        address ETH = address(0xE74);

        ProfitTakerBrain.Rung[] memory ladder = new ProfitTakerBrain.Rung[](3);
        ladder[0] = ProfitTakerBrain.Rung({gainBps: 2000,  sellBps: 2500});
        ladder[1] = ProfitTakerBrain.Rung({gainBps: 5000,  sellBps: 2500});
        ladder[2] = ProfitTakerBrain.Rung({gainBps: 10000, sellBps: 5000});

        brain.setPosition(BTC, address(btcFeed), 100_000e8, 1e18,  10000, 3000, ladder);
        brain.setPosition(ETH, address(ethFeed),   3_000e8, 10e18, 10000, 3000, ladder);

        console.log("BTC feed:", address(btcFeed));
        console.log("ETH feed:", address(ethFeed));
        console.log("Brain:   ", address(brain));
        console.log("Record:  ", address(record));
        console.log("Hands:   ", address(hands));

        vm.stopBroadcast();
    }
}