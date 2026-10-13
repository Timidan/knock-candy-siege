// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {KnockShop} from "../src/KnockShop.sol";

/// Deploys KnockShop on Robinhood Chain Testnet and sets the launch prices in one run. From contracts/:
/// simulate (no key, sends nothing):
///   forge script script/DeployShop.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --sender 0x361C367730Fa55Dfa5384eBa851499c6Ad09EB8A
/// deploy (owner only, after the codeword; prompts for the knock-deployer keystore password):
///   forge script script/DeployShop.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --account knock-deployer --broadcast
contract DeployShop is Script {
    IERC20 constant KNOCK = IERC20(0x2Ae41145A6acB58d4457c49df27ab6BFEF618492);
    address constant TREASURY = 0xF86700Fe4ea98658558893f468A1BcdCDa6b76f7; // the reward relay

    function run() external {
        uint256[] memory items = new uint256[](16);
        uint256[] memory prices = new uint256[](16);
        for (uint256 i; i < 8; i++) (items[i], prices[i]) = (i + 1, 150 ether); // dances 1-8
        for (uint256 i; i < 4; i++) (items[8 + i], prices[8 + i]) = (11 + i, 400 ether); // crew costumes 11-14
        (items[12], prices[12]) = (21, 600 ether); // golden tower skin
        (items[13], prices[13]) = (22, 300 ether); // crypto emote pack
        (items[14], prices[14]) = (23, 200 ether); // starter candy
        (items[15], prices[15]) = (31, 400 ether); // Bat Roost tower
        vm.startBroadcast();
        KnockShop shop = new KnockShop(KNOCK, TREASURY);
        shop.setPrices(items, prices);
        vm.stopBroadcast();
        console.log("KnockShop", address(shop));
    }
}
