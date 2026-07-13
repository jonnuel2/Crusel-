// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProfitTakerBrain} from "../src/ProfitTakerBrain.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        ProfitTakerBrain brain = new ProfitTakerBrain();
        console.log("ProfitTakerBrain deployed at:", address(brain));

        vm.stopBroadcast();
    }
}