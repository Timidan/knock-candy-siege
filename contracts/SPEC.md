# Knock.sol: v1 spec

Knock is one contract that is both the game and its ERC-1155 item token. It runs on Monad mainnet (chain 143). The design reasons are in [../PLAN.md](../PLAN.md). The game numbers are v1 defaults: keep them as named constants at the top of the file so they are easy to change on Day 4.

## Addresses and constructor
- `chog` (IERC721, immutable): Chog Genesis, `0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763`. It is not ERC721Enumerable. Token ids are 1–1969.
- `chogToken` (IERC20, immutable, a constructor argument): $CHOG, `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` (18 decimals).
- `cleanFee` (immutable, a constructor argument): the $CHOG a Chog pays to clean its own mark.
- `registry`: the ERC-6551 registry, `0x000000006551c19487814612e58FE06813775758`.
- `accountProxy`: Tokenbound's AccountProxy, `0x55266d75D1a14E4572138116aF39863Ed6596E7F`. Its implementation is AccountV3Upgradable, `0x41C8f39463A868d3A88af00cd0fe7102F30E44eC`. The salt is `bytes32(0)`.
- `tba(id)` (view) returns `registry.account(accountProxy, bytes32(0), block.chainid, address(chog), id)`. This is the Chog's own wallet. It may not be deployed yet; items are minted to the address anyway.
- Use OpenZeppelin from `lib/openzeppelin-contracts`: ERC1155, Ownable, ReentrancyGuard, SafeERC20. The owner can set the ERC-1155 URI and can withdraw the cleaning pot (it funds a finale prize).

## Items (ERC-1155 ids), all held by the Chog's TBA
| id | Item | How a Chog gets it | Use |
|---|---|---|---|
| 1 | candy | daily ration, treats | filling the bowl, crafting |
| 2 | egg | daily ration | trick |
| 3 | toilet paper | craft for 2 candy | trick |
| 4 | mustache paint | craft for 3 candy | trick |
| 5 | pumpkin trap | craft for 5 candy | trap |
| 6 | ghost sheet | craft for 15 candy | costume: sneaks past traps |
| 7 | witch hat | craft for 15 candy | costume: 4 knocks a day instead of 3 |

Knock mints and burns items in TBAs directly, because it is the item contract. Every action is authorised by `chog.ownerOf(id) == msg.sender`. A costume only counts while the TBA still holds one.

## Days and the ration
`day = block.timestamp / 1 days` (UTC). A Chog's first knock or friendly clean of a new day does two things:
- it resets the Chog's knock count;
- it mints the ration to its TBA before the action resolves: 5 candy and 3 eggs.

## knock(uint256 from, uint256 to, uint256 item)
**Requires:**
- msg.sender owns `from` and does not own `to`;
- `item` is a trick (2, 3 or 4), and from's TBA holds at least one after the ration;
- a knock is left today: 3, or 4 while wearing a witch hat.
- **Exception, the revenge knock:** if `to` is the Chog that last tricked `from` and that revenge is unused, the knock is free. It doesn't count against the daily limit, and it uses up the revenge.

**Outcome, checked in this order:**
1. **TREAT**, if to's bowl holds at least 1 candy:
   - 1 candy leaves the bowl and is minted to from's TBA;
   - if the bowl's $CHOG covers `chogPerTreat` and `chogPerTreat > 0`, that much $CHOG is transferred to from's TBA;
   - to's `treatsGiven` goes up by 1;
   - the visitor keeps its trick item.
2. **BOUNCE**, if `to` has a trap set and `from` isn't wearing a ghost sheet:
   - the trap is removed;
   - the item is burned from from's TBA;
   - the mark lands on `from` (the item, by `to`, until now + 24 hours);
   - `from` gets a revenge knock on `to`.
3. **TRICK**, in every other case:
   - the item is burned from from's TBA;
   - the mark lands on `to`, replacing any older mark;
   - `to` gets a revenge knock on `from`;
   - from's `tricksLanded` and to's `timesTricked` go up by 1;
   - a trap stays set if a ghost sheet sneaked past it.

**Records:** append `{from, to, item, outcome, timestamp}` to to's last-10 visits and to the street's last-50 events. Emit `Knocked(from, to, item, outcome)`.

## Porch and other actions (msg.sender must own `id`)
- `stockBowl(id, candy, chogAmount, chogPerTreat)`: burn `candy` from the TBA into the bowl, pull `chogAmount` $CHOG from msg.sender into the bowl, and set `chogPerTreat`.
- `emptyBowl(id)`: mint the bowl's candy back to the TBA, send the bowl's $CHOG to msg.sender (the current owner), and zero both.
- `setTrap(id)`: only if no trap is set. Burn 1 pumpkin from the TBA.
- `wear(id, costume)`: `costume` is 0 (none), 6 or 7. A non-zero costume must be held by the TBA.
- `craft(id, item, amount)`: `item` is 3–7. Burn price × amount candy and mint `amount` of the item.
- `clean(helper, target)`: msg.sender owns `helper`, and `target` has an active mark.
  - `helper == target`: pull `cleanFee` $CHOG from msg.sender into the pot and clear the mark.
  - otherwise (a friend helps): use one of helper's knocks today (with the day's rollover and ration), clear the mark, and record a visit with the outcome CLEAN.

## Reads the app needs
- `houses(id)`: day, knocksUsed, bowlCandy, bowlChog, chogPerTreat, trap, costume, markItem, markBy, markUntil, revengeOn, revengeReady, treatsGiven, tricksLanded, timesTricked.
- `visits(id)`: the last 10 visits, newest first. `street()`: the last 50 events, newest first.
- `tba(id)`, plus the standard ERC-1155 `balanceOfBatch`.
- An event for every state change.

## Safety
- Mark every state-changing external function `nonReentrant`. A Chog's owner can upgrade its Tokenbound account to arbitrary code, and minting to a deployed account calls its `onERC1155Received`.
- Follow checks-effects-interactions, and use SafeERC20 for $CHOG.

## Tests
Use Foundry on a Monad mainnet fork: `vm.createSelectFork("https://rpc.monad.xyz")`. Impersonate real holders with `vm.prank(chog.ownerOf(id))`, and give $CHOG with `deal`. Pick tokens whose owners differ. Write about six small tests, no more:
1. **Treat:** a stocked bowl moves 1 candy and `chogPerTreat` $CHOG into the visitor's TBA. `emptyBowl` returns the rest to the current owner.
2. **Trick and revenge:** a house with an empty bowl is marked and the egg is burned. The house's revenge knock doesn't count against its limit.
3. **Bounce:** a trapped house bounces the egg onto the visitor. With a ghost sheet on, the trick lands and the trap stays.
4. **Limits:** a 4th knock in a day reverts, the next day mints a new ration, and a witch hat allows a 4th knock. A non-owner's knock reverts.
5. **TBA:** items minted to a Tokenbound account that isn't deployed yet show in `balanceOf`. Then deploy the account through the registry (`createAccount`, then initialise the proxy with AccountV3Upgradable). Minting still works, and the owner can transfer an item out through the account's `execute`.
6. **Clean:** paying the fee clears the mark and fills the pot. A friend's clean uses one of the friend's knocks.
