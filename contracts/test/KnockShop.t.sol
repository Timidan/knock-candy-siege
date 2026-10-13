// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {KnockShop} from "../src/KnockShop.sol";

/// Runs against a fork of Robinhood Chain Testnet with the real $KNOCK token (it supports EIP-2612 permit).
contract KnockShopTest is Test {
    IERC20 constant KNOCK = IERC20(0x2Ae41145A6acB58d4457c49df27ab6BFEF618492);
    address constant TREASURY = 0xF86700Fe4ea98658558893f468A1BcdCDa6b76f7; // the reward relay
    KnockShop shop;
    uint256 buyerKey = 0xB0B;
    address buyer;

    function setUp() public {
        vm.createSelectFork("https://rpc.testnet.chain.robinhood.com");
        buyer = vm.addr(buyerKey);
        shop = new KnockShop(KNOCK, TREASURY);
        uint256[] memory items = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        (items[0], amounts[0]) = (1, 250 ether);
        (items[1], amounts[1]) = (2, 500 ether);
        shop.setPrices(items, amounts);
        deal(address(KNOCK), buyer, 1000 ether);
    }

    function _permit(uint256 value, uint256 deadline) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 typehash = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", IERC20Permit(address(KNOCK)).DOMAIN_SEPARATOR(),
            keccak256(abi.encode(typehash, buyer, address(shop), value, IERC20Permit(address(KNOCK)).nonces(buyer), deadline))));
        (v, r, s) = vm.sign(buyerKey, digest);
    }

    function testBuyWithPermit() public {
        uint256 treasuryBefore = KNOCK.balanceOf(TREASURY);
        (uint8 v, bytes32 r, bytes32 s) = _permit(250 ether, block.timestamp + 1 hours);
        vm.startPrank(buyer); // one transaction, sent by the buyer who signed the permit
        shop.buyFor(buyer, 1, block.timestamp + 1 hours, v, r, s);
        assertTrue(shop.owned(buyer, 1));
        assertEq(KNOCK.balanceOf(buyer), 750 ether);
        assertEq(KNOCK.balanceOf(TREASURY) - treasuryBefore, 250 ether);

        // The same item can't be bought twice, and the used permit can't take more.
        vm.expectRevert("already owned");
        shop.buyFor(buyer, 1, block.timestamp + 1 hours, v, r, s);
        vm.stopPrank();
    }

    function testOnlyTheBuyerSubmitsPermitPurchases() public {
        // Someone holding the buyer's valid permit can't choose an item for them...
        (uint8 v, bytes32 r, bytes32 s) = _permit(250 ether, block.timestamp + 1 hours);
        vm.prank(address(0xBEEF));
        vm.expectRevert("not buyer");
        shop.buyFor(buyer, 1, block.timestamp + 1 hours, v, r, s);
        // ...or spend an allowance the buyer left with the shop.
        vm.prank(buyer);
        KNOCK.approve(address(shop), 500 ether);
        vm.prank(address(0xBEEF));
        vm.expectRevert("not buyer");
        shop.buyFor(buyer, 2, 0, 0, bytes32(0), bytes32(0));
        assertFalse(shop.owned(buyer, 1));
        assertFalse(shop.owned(buyer, 2));
        assertEq(KNOCK.balanceOf(buyer), 1000 ether);
    }

    function testBuyWithApproval() public {
        vm.startPrank(buyer);
        KNOCK.approve(address(shop), 500 ether);
        shop.buy(2);
        vm.stopPrank();
        assertTrue(shop.owned(buyer, 2));
        assertEq(KNOCK.balanceOf(buyer), 500 ether);
    }

    function testRejectsUnpricedItemsAndWrongPermits() public {
        (uint8 v, bytes32 r, bytes32 s) = _permit(250 ether, block.timestamp + 1 hours);
        vm.startPrank(buyer);
        vm.expectRevert("not for sale");
        shop.buyFor(buyer, 99, block.timestamp + 1 hours, v, r, s);
        // A permit for 250 can't pay for the 500 item: the permit fails and there is no allowance.
        vm.expectRevert();
        shop.buyFor(buyer, 2, block.timestamp + 1 hours, v, r, s);
        vm.stopPrank();
        assertFalse(shop.owned(buyer, 2));
    }

    function testOnlyOwnerSetsPrices() public {
        uint256[] memory items = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        vm.prank(buyer);
        vm.expectRevert();
        shop.setPrices(items, amounts);
    }
}
