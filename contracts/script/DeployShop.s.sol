// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {KnockShop} from "../src/KnockShop.sol";

/// Deploys KnockShop on Robinhood Chain Testnet and sets the launch prices in one run.
/// forge script script/DeployShop.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account knock-deployer --broadcast
contract DeployShop is Script {
    IERC20 constant KNOCK = IERC20(0x2Ae41145A6acB58d4457c49df27ab6BFEF618492);
    address constant TREASURY = 0xF86700Fe4ea98658558893f468A1BcdCDa6b76f7; // the reward relay

    function run() external {
        uint256[] memory items = new uint256[](15);
        uint256[] memory prices = new uint256[](15);
        for (uint256 i; i < 8; i++) (items[i], prices[i]) = (i + 1, 150 ether); // dances 1-8
        for (uint256 i; i < 4; i++) (items[8 + i], prices[8 + i]) = (11 + i, 400 ether); // crew costumes 11-14
        (items[12], prices[12]) = (21, 600 ether); // golden tower skin
        (items[13], prices[13]) = (22, 300 ether); // crypto emote pack
        (items[14], prices[14]) = (23, 200 ether); // starter candy
        vm.startBroadcast();
        KnockShop shop = new KnockShop(KNOCK, TREASURY);
        shop.setPrices(items, prices);
        vm.stopBroadcast();
        console.log("KnockShop", address(shop));
    }
}
