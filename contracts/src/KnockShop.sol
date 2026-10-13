// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Sells Candy Siege items (hero costumes, tower skins, emote packs) for $KNOCK, the testnet reward token on
/// Robinhood Chain Testnet. Ownership is recorded here so it follows the wallet across devices. Spent $KNOCK goes to
/// the treasury (the reward relay), so it funds future rewards.
contract KnockShop is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable knock;
    address public treasury;
    mapping(uint256 => uint256) public price; // 0 means not for sale
    mapping(address => mapping(uint256 => bool)) public owned;

    event Priced(uint256 indexed item, uint256 price);
    event Bought(address indexed buyer, uint256 indexed item, uint256 price);
    event TreasurySet(address treasury);

    constructor(IERC20 knock_, address treasury_) Ownable(msg.sender) {
        knock = knock_;
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setPrices(uint256[] calldata items, uint256[] calldata amounts) external onlyOwner {
        require(items.length == amounts.length, "length");
        for (uint256 i; i < items.length; i++) {
            price[items[i]] = amounts[i];
            emit Priced(items[i], amounts[i]);
        }
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "treasury");
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    /// @notice Buy with an allowance already approved to this shop.
    function buy(uint256 item) external {
        _buy(msg.sender, item);
    }

    /// @notice Buy with an EIP-2612 permit signed by `buyer` for exactly the item's price, so the buyer needs no
    /// separate approval. Only the buyer may submit it: the permit doesn't name the item, so anyone else holding the
    /// signature, or relying on an allowance the buyer left here, could otherwise pick purchases the buyer never chose.
    function buyFor(address buyer, uint256 item, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(msg.sender == buyer, "not buyer");
        // A permit already used (for example, front-run straight to the token) reverts; the allowance it set still
        // works, so carry on and let transferFrom decide.
        try IERC20Permit(address(knock)).permit(buyer, address(this), price[item], deadline, v, r, s) {} catch {}
        _buy(buyer, item);
    }

    function ownedItems(address who, uint256[] calldata items) external view returns (bool[] memory result) {
        result = new bool[](items.length);
        for (uint256 i; i < items.length; i++) result[i] = owned[who][items[i]];
    }

    function _buy(address buyer, uint256 item) private {
        uint256 amount = price[item];
        require(amount != 0, "not for sale");
        require(!owned[buyer][item], "already owned");
        owned[buyer][item] = true;
        knock.safeTransferFrom(buyer, treasury, amount);
        emit Bought(buyer, item, amount);
    }
}
