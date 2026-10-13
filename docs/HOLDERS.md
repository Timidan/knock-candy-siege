# Knock: the holder guide

## What Knock is

Every Chog Genesis is a house in Chog Town: 21 neighbourhoods by background colour, 63 streets. Holders play as their Chog. Anyone can walk the street and watch.

You can knock for a treat, leave a trick, raid a bowl, help clean a friend's house, or fight the Great Pumpkin. At home, you can fill your bowl, craft items, set a trap and wear a costume.

Candy is the game item you spend on bowls and crafting. $CHOG is a separate token on Monad. $KNOCK is a separate testnet reward with no real value.

## Your first night

1. **Connect** the wallet that holds your Chog, on Monad, and pick your Chog. Keep a little MON there for gas.
2. **Optional:** tap **Play without pop-ups** to turn on a play key, so the night's actions don't each need a wallet pop-up. See [Play keys](#play-without-pop-ups-play-keys).
3. **Open Tonight** and tap **Go** next to a route house. Walk up, pick a trick, aim and let it fly. Your first knock of the night brings your ration: **5 candy and 3 eggs**.
4. **Finish the route:** knock at all 3 route houses for **10 bonus candy** (and 500 testnet $KNOCK).
5. **Hit the Great Pumpkin.** When it falls, everyone who hit it claims candy.
6. **Join a crew.** It's permanent, and from then on your actions score for your crew.
7. **Open My house:** fill your bowl so knockers get treats, and craft a pumpkin trap to catch raiders.

The rest of this guide explains every rule in detail.

## Getting started

- Open Knock in a browser with a wallet, or in your wallet's browser. Choose **Connect wallet**. Use the wallet that holds your Chog Genesis and switch to Monad when asked. Keep some MON there for gas.
- Pick your Chog from the wallet list, or enter its number in **Chog #** and choose **Play**. Numbers run from **1 to 1,969**. Typing a number does not give you control of someone else's Chog. If the list cannot load, you can still type your number; the app checks its owner.
- **How to play** opens a practice tutorial. It also opens on your first visit in that browser. Practice needs no wallet and sends no transactions. You can skip it and reopen it from Home.
- Choose **Explore** to walk without playing. Use **Find** on Home, or **Play / Find** on the street, to go to a house by number.

In the **3D street**, walk with WASD, the arrow keys or the touch joystick. **My house** opens your bag and house controls. **Tonight** shows the route, Great Pumpkin and crews.

**Simple view** shows the houses as a scrollable street. Open a house to knock with a button, clean a mark or read its inbox. Open your own house for its controls. There is no aiming step in this view. The current Simple view has no raid, boss, crew-joining or Tonight controls; use the 3D street for those. Knocks made in Simple view still count towards the contract's route and crew rules.

Lite mode turns on automatically for touch devices and devices that report low memory. It reduces visual effects without changing the game rules. You can also request it with `?lite` in the page URL. If the street is slow on your phone, try Simple view.

## What it costs

Each game action is **one Monad transaction**, paid in **MON gas**. Filling a bowl with $CHOG or paying to clean your own mark may need an extra approval transaction first. That approval also costs gas.

A missed aimed throw sends nothing. It uses no gas, knock or item. Browsing, walking, choosing a Chog and practising also send nothing.

| Action | Cost besides gas |
|---|---|
| Knock | 1 regular knock, or the matching revenge knock. You must hold a trick item; it is spent only on a trick or bounce. |
| Raid | 1 regular knock. If caught, lose up to 2 candy. No trick item needed. |
| Hit the Great Pumpkin | 1 regular knock and 1 trick item. |
| Clean another owner's house | 1 regular knock. No $CHOG or item. |
| Clean your own mark | The contract's `cleanFee` in $CHOG. No knock. |
| Fill the bowl | The candy and optional $CHOG you choose to add. No knock. |
| Craft | The candy cost below. No knock. |
| Set a trap | 1 pumpkin trap item. No knock. |
| Wear or remove a costume, empty the bowl, join a crew, claim boss loot | No knock or item spent. |

$CHOG is only needed if you choose to add it to a bowl or pay to clean your own mark. A candy-only bowl is allowed. You do not need $CHOG to start playing.

An action can fail if you have no knocks left, lack an item or token balance, use the wrong wallet or network, or act on a house whose state has changed. You cannot knock, raid or friend-clean another Chog owned by your own wallet. A mined transaction that fails can still cost gas, but its game changes are undone. Check the confirmed result; an animation alone is not confirmation.

## Your night

A night starts at **00:00 UTC**. It follows the chain's time, not your local midnight.

Your regular knocks are shared by knocks, raids, boss hits and friend cleans:

| Costume you are wearing and still hold | Most nights | Costume Night |
|---|---:|---:|
| None | 3 | 3 |
| Ghost sheet | 3 | 4 |
| Witch hat | 4 | 5 |

The limit uses your current costume. Changing clothes does not reset knocks already used. Unused knocks do not carry over.

**Your daily ration** is **5 candy and 3 eggs**. It arrives inside your first successful knock, raid, boss hit or friend clean of that night, before the action spends items. This lets you start with an egg even if your bag was empty. A failed action does not leave you with a ration. Connecting, crafting, filling a bowl, claiming loot or joining a crew does not collect it. Missed nights do not build up rations.

**Your revenge knock** lets you knock back without using a regular knock. You get it when a trick marks your house, a trap bounces your trick back, or someone raids your bowl—even if the raider is caught. **Knock back #…** takes you to the target.

You hold only one revenge target at a time; a new mark or raid replaces it. It works only for a normal knock at that target. A successful knock uses up the revenge, though a bounce can give you a new one. You still need a trick item and gas. The result can be a treat, trick or bounce. It cannot pay for a raid, boss hit or friend clean. Midnight, a mark fading and cleaning do not clear unused revenge.

The themes repeat in this order:

| Night | Effect |
|---|---|
| Quiet | The usual rules. |
| Blood Moon | Crew points double. |
| Candy Rain | The daily ration doubles to 10 candy and 6 eggs. Other candy rewards do not double. |
| Costume Night | Wear a ghost sheet or witch hat that your Chog still holds for 1 extra regular knock. |

The theme comes from the UTC day count, not from when you first play. Read Tonight for the current theme.

## Knocking

Walk up to a house owned by someone else. If it has candy, choose **Treat**; the app selects a trick you hold. Otherwise choose **Egg**, **Toilet paper** or **Mustache**. You can also select those tricks with the keyboard number keys.

In the 3D street, move the aim onto the house and release to throw. On touch, drag from the action button and release. **Cancel** or Escape cancels the aim. A hit or bullseye asks for the transaction. Bullseyes and the style streak are cosmetic; they do not increase rewards or damage.

The contract checks the house when the transaction runs. It uses this order:

| Outcome | Exact rule | What happens |
|---|---|---|
| **Treat** | The bowl has at least 1 candy, even if a trap is set. | Take 1 candy. Also take the full $CHOG per-treat amount if it is above zero and the bowl can cover it. Otherwise take no $CHOG. Keep your trick item. The trap stays set. |
| **Bounce** | The bowl has no candy, a trap is set, and you are not wearing a ghost sheet you still hold. | Your trick marks your own house. Your trick item and their trap are used up. You get revenge on that house. |
| **Trick** | The bowl has no candy and the bounce rule does not apply. | Spend your trick item and mark their house. They get revenge on you. If your ghost sheet bypassed a trap, the trap stays set. |

**Haunted houses.** A house whose owner has never played has no bowl and no trap, so it would always take a plain trick. Instead it answers the door itself: 40% of the time it's a treat (+1 candy, and you keep your trick), 20% a bounce (your trick lands on you), and 40% a trick. The roll comes from the chain, so you can't know it before you knock. Once the owner plays, the house behaves normally.

A mark is an egg splat, toilet paper or a mustache on the house's Chog portrait. It lasts **24 hours from the latest mark**, unless cleaned sooner. A new mark replaces the old one and restarts that time. It does not take the Chog away or stop it playing.

## Raids and traps

At a bowl with candy, **Raid** tries to take more than a treat. It always costs a regular knock. Revenge cannot cover it, and you need no trick item. If the bowl has no candy when the transaction runs, the raid fails.

| Result | Exact rule | What happens |
|---|---|---|
| **LOOTED** | No trap, or you wear a ghost sheet you still hold. | Take the smaller of **3 candy** and the bowl's candy balance. Separately, take the smaller of **3 × $CHOG per treat** and the bowl's $CHOG balance. A bypassed trap stays set. |
| **CAUGHT** | A trap is set and you lack a worn, held ghost sheet. | Take nothing. Up to **2 candy** from your bag goes into their bowl. The trap is used up. No $CHOG is taken from you and no mark is made. |

The $CHOG calculation is separate from the candy calculation. A bowl with only **1 candy** can still lose up to **3 treat payouts** of $CHOG to a raid. If caught, candy from a ration just collected can be taken too.

Either result gives the house a revenge knock on the raider. A normal treat does not trigger a trap; a raid can trigger one while the bowl is full.

## Your house

Open **My house** on the street, or open your own house in Simple view.

### Fill or empty the bowl

Enter **Candy**, **$CHOG** and **per treat**, then choose **Fill the bowl**. Candy comes from your Chog's bag. $CHOG comes from your connected owner wallet. The bowl is held by the game contract, separately from both wallets.

Each fill adds to the bowl's balances and replaces its $CHOG per-treat setting. You can leave $CHOG and per treat at zero for a candy-only bowl. $CHOG alone cannot make an empty candy bowl give treats.

Each treat takes **1 candy**. It pays the chosen $CHOG amount only if the bowl holds enough for the full amount. A low $CHOG balance does not stop candy treats. See Raids for the larger raid payout.

**Empty the bowl** returns its remaining candy to your Chog's own wallet and its remaining $CHOG to the **current Chog owner's wallet**. It also clears the per-treat setting. Only the current owner can fill or empty it. Empty your bowl before selling if you want its remaining $CHOG back; after a sale, the buyer can empty it.

### Set a trap

**Set the trap** spends **1 pumpkin trap** from the bag. You can have only **1 trap** set at a time. It stays until a bounce or caught raid uses it up. Wearing a ghost sheet bypasses it without removing it.

### Wear a costume

You can wear **one costume at a time**. The ghost sheet bypasses traps on knocks and raids. The witch hat raises your regular knock limit from **3 to 4**, with the Costume Night bonus shown above.

Crafting a costume does not put it on. Choose **Wear ghost sheet** or **Wear witch hat**. Wearing it does not consume it. Its effect works only while your Chog's own wallet still holds that costume. **Take it off** removes the effect without destroying the item.

### Craft in the cauldron

Each button crafts **1 item** from candy in your bag:

| Item | Candy cost | Use |
|---|---:|---|
| Toilet paper | 2 | A trick or boss hit. |
| Mustache paint | 3 | A trick or boss hit. |
| Pumpkin trap | 5 | Set a trap. |
| Ghost sheet | 15 | Wear it to bypass traps. |
| Witch hat | 15 | Wear it for more regular knocks. |

Eggs come from the ration; there is no egg-crafting button or contract recipe. Candy already in your bowl cannot be spent on crafting until you empty it back into the bag.

### Clean a mark

You can wait for it to fade, pay to clean it, or ask a friend:

| Choice | Cost and rule |
|---|---|
| **Scrub it off** on your own house | The current owner pays `cleanFee` in $CHOG from their wallet, plus gas. No knock used. The app shows the fee before you pay. **[DECIDE: the fee at deploy; 10 $CHOG on the test chain]** |
| **Clean it up** at a friend's house | The helper spends 1 regular knock and gas. No $CHOG or item. The Chogs must have different owners. |

There must still be an active mark when the transaction runs. A friend clean can collect the helper's ration and score crew points. It does not stamp a route stop. Cleaning does not remove revenge.

## Tonight

Expand **Tonight** on the 3D street to see the route and crew scores. **Go** takes you to the Great Pumpkin or a route house.

### The route

Each Chog has **3 distinct houses** to visit that night. The route skips houses owned by your wallet. Knock or raid every stop, in any order, for **10 bonus candy**, paid straight to your Chog's own wallet. You can earn this bonus once per night.

Treats, tricks, bounces, looted raids and caught raids all stamp a stop if the transaction succeeds. Revenge knocks count too. Walking there, cleaning it or hitting the boss at that house does not count. Route progress resets for the new night; unfinished stops do not carry over.

### The Great Pumpkin

There is a shared Great Pumpkin each night, at the house shown in Tonight. At that door, **Pumpkin** selects the boss and **House #…** selects the house. These are separate actions; hitting the boss does not raid or mark that house.

Its health is **2 × the previous night's active Chogs**, with a **minimum of 10** and a **maximum of 60**. An active Chog is one that made a successful knock, raid, boss hit or friend clean that night. Merely connecting or managing a bowl does not count.

Each boss hit spends **1 regular knock and 1 trick item**:

| Trick | Damage |
|---|---:|
| Egg | 1 |
| Toilet paper | 2 |
| Mustache paint | 3 |

Everyone's damage adds up. The boss falls when total damage reaches or passes its health. A hit after defeat fails. A final hit counts its full damage, even if the boss had less health left. Revenge cannot pay for a hit.

If your Chog dealt damage and that night's boss fell, choose **Claim loot**. Your candy is **the smaller of (5 + 2 × your Chog's total damage that night) and 25**. It is paid to your Chog's own wallet. You can claim once for each defeated night you helped with. Claiming costs gas but no knock, and does not collect a ration.

Tonight offers unclaimed loot from **today and yesterday**. If both are available, expand Tonight to see the other claim. If you helped yesterday and the boss fell, you can claim yesterday's loot even after midnight. The contract has no expiry on older eligible claims, but the current app does not list nights before yesterday. No loot is claimable for a boss that survived its night.

### Crews

Choose **Ghosts**, **Witches**, **Pumpkins** or **Bats**. Only the Chog's owner can join. Joining is permanent for that Chog: no leaving or switching, even after a sale. Crew choice does not equip a costume. Actions before joining earn no crew points.

| Action by your Chog | Usual points | Blood Moon points |
|---|---:|---:|
| Receive a treat | 1 | 2 |
| Land a trick | 2 | 4 |
| Loot a raid | 2 | 4 |
| Clean another owner's house | 1 | 2 |
| Boss hit | Damage dealt | 2 × damage dealt |
| Bounce or caught raid | 0 | 0 |

Giving a treat, completing a route, claiming loot and paying to clean your own mark add no points. Blood Moon doubles points, not the boss damage itself.

The crew with **strictly the most points** wins the night. A tie for the lead means no winner. Each Chog that joined the winning crew before the new night began gets **3 extra candy** when it collects that new night's ration. It need not have scored personally. The bonus is added after any Candy Rain doubling, so it stays **3**, and it does not build up if you miss the collection night. Joining last night's winner this morning does not earn its bonus.

## Your Chog's own wallet

ERC-6551 means the NFT has its own wallet address. Think of it as a bag attached to the Chog, separate from the wallet you use to connect. Knock puts candy, items and $CHOG won from treats or raids there. The game can give that address items even before the wallet has been deployed for general use.

Anything left in that wallet goes with the Chog to its buyer. Its game state also stays with it, including its bowl, crew, knocks already used and boss claims. Buying or selling does not reset the game.

**Empty your bowl before you sell.** That returns the bowl's $CHOG to you. It returns candy to the Chog's own wallet, so that candy still goes with the Chog. It does not withdraw items or $CHOG already in the Chog's own wallet. The current app has no general withdrawal control for that wallet.

**My house** shows the address of your Chog's own wallet, with a link to view it on Monadscan, and its $CHOG balance. The address is fixed for each Chog, so you can bookmark it.

## Badges

These badges appear from your Chog's lifetime game counters. You do not need to claim them, and they do not add powers or rewards.

| Badge | What earns it |
|---|---|
| Egg-stained | Your house has been tricked at least 5 times, with any trick item. |
| Prankster | Your Chog has landed at least 5 tricks on other houses. |
| Sweetest house | Your bowl has given at least 5 treats. |
| Raid master | Your Chog has looted at least 5 raids. |

Bounces do not count as landed or received tricks. Caught raids do not count as looted raids. Raids do not count as treats given. The badges follow the Chog when it changes owner.

## $KNOCK

**$KNOCK is testnet only and has no real value.** It is not the candy used for crafting and does not pay MON gas.

A relay watches Knock on Monad and pays $KNOCK through vibe/vibe on **Robinhood Chain Testnet**. The amounts in the relay source, also shown by the app, are:

| Confirmed achievement | $KNOCK reward |
|---|---:|
| Receive a treat | 100 |
| Loot a raid | 50 |
| Complete a route | 500 |
| Claim boss loot | 300 |

A visit can earn its own reward and complete a route, earning both. A trick, bounce, caught raid, clean or boss hit by itself has no $KNOCK payment. The boss reward follows the loot claim, not the hit or the defeat alone.

The relay pays the **Chog owner's address**, not the Chog's own wallet or a play key. It looks up the owner when it processes the payment. If you sell before that lookup, payment can go to the buyer. $KNOCK already paid to your personal wallet stays there.

**Earned means pending until paid.** The $KNOCK chip shows the balance read from the testnet, not the pending total. If it says Unavailable, the app could not read that balance. Open the chip for the token link and reward details.

The Monad contract does not pay $KNOCK itself. A delayed, stopped or unfunded relay can leave rewards pending. A fresh relay starts from current events, so activity from before it began tracking is not automatically paid. There is no guaranteed arrival time.

## Play without pop-ups (play keys)

Normally every action is a wallet pop-up. A play key lets one Chog play a whole night without them.

1. While playing your Chog on the street, tap **Play without pop-ups**.
2. Choose how much MON to give the key for gas: **0.1, 0.25 or 0.5 MON**. The sheet shows roughly how many actions that covers at today's gas price.
3. Tap **Start**. It takes two wallet steps: approve the key for this Chog for **24 hours**, then send it the MON.

While the key is on, a chip shows the time left and the key's MON. Knocks, raids, Great Pumpkin hits, loot claims, crafting, traps, costumes and friend cleans then go through without a pop-up. Filling or emptying your bowl, joining a crew and paying to clean your own mark still use your wallet. Gas, knock limits and item costs still apply.

**Top up** sends the key more MON. **End** turns the key off and sends its leftover MON back to your wallet, minus a tiny gas fee. A balance too small to cover that fee stays on the key.

**What a play key can't do:** move your Chog, touch your $CHOG or your bowl, join a crew, or approve another key. Rewards are never paid to it. It can only spend your Chog's candy and items through the actions above. Selling the Chog switches its key off.

**Good to know:**
- The key lives only in this browser. Clearing your browser data loses the key and any MON left on it, so end the session first.
- One key serves all your Chogs in this browser and shares its gas money between them. Ending one Chog's session takes back all of that MON, so your other Chogs' keys may need a top-up.
- End the session before you sell. If you later bought the same Chog back while its 24 hours were still running, the old key would work again.

## Try it without a Chog (the sandbox)

**[sandbox.knock-ej6.pages.dev](https://sandbox.knock-ej6.pages.dev)** is a copy of Monad where anyone can play as any Chog, with no wallet. Tap **Random Chog** or type a number. Nothing there is real: it pays no $KNOCK, and it resets every night at 00:05 UTC. It's for trying the game, and for judges.

## Staying safe

- The only official sources are **[chog.xyz](https://chog.xyz)** and **[@ChogNFT](https://x.com/ChogNFT)**. **@Chog_Ecosystem and chog.pics are impersonators.** Do not follow their wallet links.
- Never enter or share your wallet's seed phrase or private key. Knock does not ask for them.
- Check the Knock contract before approving or sending an action: **[CHECK: mainnet address after deploy]**.
- A $CHOG approval allows the Knock contract to spend that token from your connected wallet. For a bowl fill, the app requests exactly the **$CHOG amount being added**. For a self-clean, it requests exactly **`cleanFee`**. It skips approval if the existing allowance already covers the amount. It does not request an unlimited allowance or reduce an older, larger one.
- Approval and the game action are separate transactions. If approval succeeds but the action is cancelled or fails, the allowance remains. Check the spender and amount in your wallet.
- Ordinary knocks, raids, boss actions, crafting, traps, costumes and friend cleans need no $CHOG allowance or permission to transfer your Chog. A normal connection request is not an NFT transfer approval.

## FAQ

**Do I need $CHOG?**  
No. You need MON for gas. The ration supplies candy and eggs when you first knock, raid, hit the boss or friend-clean that night. $CHOG is optional for bowls and is the fee for paying to clean your own mark.

**Can I play several Chogs?**  
Yes. Choose each Chog you own in turn. Each has its own bag, bowl, ration, knock count, route, revenge, crew and boss claim. You cannot knock, raid or friend-clean between Chogs held by the same wallet.

**What happens if I sell?**  
The buyer gets control of the Chog's own wallet and its game state. Empty your bowl first to recover its remaining $CHOG. This does not empty the Chog's own wallet. Unpaid $KNOCK can go to whoever owns the Chog when the relay looks up its owner.

**What if I miss a night?**  
You can play on a later night. Unused knocks, missed rations, unfinished routes and missed crew bonuses do not build up. Candy and items already held remain until spent or moved. A mark fades after 24 hours unless replaced sooner. If you helped defeat yesterday's boss, Tonight still offers its unclaimed loot; older claims remain valid in the contract but are not listed in the app.

**Can people without a Chog play?**  
They can explore, watch the street, open houses and try the tutorial, and they can play any Chog in the sandbox (above). In the real game, playing as a Chog needs the wallet that owns it, or a play key that its owner approved.

**Where do the cleaning fees go?**  
The fee goes to a pot in the game contract that only the contract owner can withdraw. `withdrawPot()` sends the whole recorded pot to that owner. **[DECIDE: what the pot pays for]** There is no prize promised here and no prize payout rule in the contract.

**Where can I see my history?**  
Open a house in Simple view for its inbox, labelled **Last 10 visits**. It lists visits to that house, not every action that Chog has taken. **Street gossip** in Simple view shows the latest **50 visits** across the street; the 3D street shows the latest **4**. These include knocks, raids and friend cleans. Bowl changes, crafting, paid self-cleans and boss actions are not in these visit lists. For a confirmed transaction you just sent, use **View on Monadscan** when shown.

After a treat, trick or looted raid, **Share** opens a draft post with a link to the house. You choose whether to post it.

<!--
Number audit for the lead. Paths are relative to the repository root.
Repeated occurrences, written-out numbers and formula operands share the entries below.

GAME RULES — contracts/src/Knock.sol is authoritative:
- Chog numbers 1–1,969: CHOG_COUNT = 1969; routeOf() and bossHouse() use modulo CHOG_COUNT + 1. App input limits agree (App.tsx id(), wallet.tsx via ownedChogs(), Game.tsx and Simple.tsx).
- 1 regular knock per knock, raid, boss hit or friend clean: _useKnock() increments once; knock() calls _useVisitKnock(), raid()/hitBoss()/friend clean() call _useKnock(). A matching revenge knock consumes 0 regular knocks: _useVisitKnock().
- No knock for stockBowl(), emptyBowl(), craft(), setTrap(), wear(), joinCrew(), paid self-clean(), claimBoss(): none calls _useKnock(). No item spent by wear(), emptyBowl(), joinCrew(), claimBoss().
- One night/day; 00:00 UTC; no saved prior rations or regular knocks: block.timestamp / 1 days in _rollDay(); it resets knocksUsed to 0 and mints only today's ration.
- 3 usual knocks, 4 with witch hat: DAILY_KNOCKS = 3; WITCH_KNOCKS = 4; _useKnock(), _wearing(). Costume Night adds 1 only with a held, worn costume: COSTUME_EXTRA_KNOCKS = 1. Derived limits: no costume 3; ghost 3 or 4; witch 4 or 5.
- 5 candy and 3 eggs per ration: DAILY_CANDY = 5, DAILY_EGGS = 3; _rollDay(). The four ration-triggering actions are knock(), raid(), hitBoss(), friend clean().
- Four themes, in Quiet/Blood Moon/Candy Rain/Costume Night order: THEME_COUNT = 4; nightTheme(day) = day % THEME_COUNT; default theme 0, BLOOD_MOON = 1, CANDY_RAIN = 2, COSTUME_NIGHT = 3. Theme names come from Tonight.tsx.
- Double/2 times crew points and Candy Rain ration: THEME_MULTIPLIER = 2; _score() and _rollDay(). Derived Candy Rain ration: 10 candy, 6 eggs. Other rewards are not multiplied there.
- One pending revenge target, not a stack: House.revengeOn/revengeReady; _mark(), raid(), _useVisitKnock(). No midnight/clean/mark-expiry revocation code.
- 1 required trick item even for a treat; 1 item consumed on bounce/trick/boss hit: knock() balance check and _burn(..., 1), hitBoss() _burn(..., 1). Item range is EGG through MUSTACHE. Treat does not burn it.
- At least 1 candy for a treat; 1 candy moved on treat; per-treat payout above 0 and covered in full: knock(). A candy-only bowl/per-treat setting of 0 is accepted by stockBowl()/knock().
- Marks last 1 day = 24 hours from the latest mark: MARK_DURATION = 1 days; _mark() sets block.timestamp + MARK_DURATION. clean() and app displays use markUntil > current time.
- Raids need nonzero bowl candy; LOOTED takes min(3, bowlCandy) and separately min(3 * chogPerTreat, bowlChog): RAID_TREATS = 3; raid(). The 1-candy/3-payout example follows that independent calculation.
- CAUGHT loses min(2, visitor candy balance): CAUGHT_CANDY = 2; raid(), after _rollDay(). No mark or $CHOG loss in the CAUGHT branch.
- 1 active trap, 1 pumpkin item to set it: House.trap is bool; setTrap() requires no active trap and burns PUMPKIN amount 1.
- One worn costume: House.costume is a single value; wear() permits none (0), GHOST or WITCH; _wearing() requires nonzero inventory. wear() does not burn it.
- Craft costs 2/3/5/15/15 candy per toilet paper/mustache/pumpkin/ghost/witch: craft() price expression; supported items TOILET_PAPER through WITCH. App crafts 1 item per click: MyHouse.tsx CRAFTS and send('craft', [..., 1n]).
- Paid self-clean fee: constructor(token, fee) stores cleanFee; no universal numeric fee in source. clean() adds exactly cleanFee to cleaningPot. withdrawPot() transfers the whole pot to msg.sender under onlyOwner.
- 3 route stops, 10 bonus candy, once per Chog per night: ROUTE_STOPS = 3; ROUTE_COMPLETE = 7 (three completion bits); ROUTE_BONUS_CANDY = 10; routeOf(), _progressRoute(). Only knock()/raid() progress it, for every successful outcome.
- Boss health 2 * previous day's activeChogs, minimum 10 and maximum 60: BOSS_HP_PER_CHOG = 2, BOSS_MIN_HP = 10, BOSS_MAX_HP = 60; bossHp(). activeChogs increments once per Chog per day in _rollDay().
- Boss damage 1/2/3 for egg/toilet paper/mustache: hitBoss() computes item - EGG + 1; adds full damage, then tests defeat.
- Boss loot min(5 + 2 * damageBy, 25), once per Chog per defeated day with damage: BOSS_BASE_LOOT = 5, BOSS_LOOT_PER_DAMAGE = 2, BOSS_MAX_LOOT = 25; claimBoss(), claimed mapping.
- Four crews, join one permanently: CREW_COUNT = 4; joinCrew() accepts 1–4 only if crewOf[id] is 0. Ghosts/Witches/Pumpkins/Bats names: Tonight.tsx CREWS.
- Points 1 treat / 2 trick / 2 raid / 1 friend clean / boss damage; Blood Moon 2/4/4/2/2*damage: TREAT_POINTS = 1, TRICK_POINTS = 2, RAID_POINTS = 2, CLEAN_POINTS = 1, hitBoss(), _score(). Bounce/caught and other unscored actions give 0.
- Winner bonus 3 candy, only next day's eligible ration, not doubled: CREW_BONUS_CANDY = 3; _rollDay() adds it after the ration multiplier, checks crewSince[id] < today and _crewWon(..., today - 1). _crewWon() rejects a tied lead.
- ERC-6551 is the wallet standard's name, not a game quantity: IERC6551Registry and tba(); registry.account(accountProxy, bytes32(0), block.chainid, address(chog), id). SPEC.md describes receiving items before deployment.
- Delegate revocation uses zero address and expiry 0: setDelegate(); onlyPlayer() requires matching key, current timestamp below expiry and ownerAtGrant equal to current owner. Only one Delegate is stored per Chog. No fixed lifetime or gas refund is implemented in Knock.sol.
- Last 10 house visits / last 50 street visits: Visit[10], Visit[50], visits(), street(), _record(). These include normal knocks, raids and friend cleans only.

APP / RELAY / BRIEF NUMBERS — not additional Knock.sol rules:
- 3D is the view name, not a contract number: App.tsx view switch; Game.tsx Canvas. Miss sends 0 transactions and uses 0 knocks/items: Game.tsx release() returns before act()/confirm(). No bullseye reward multiplier is sent to Knock.sol.
- One transaction per game action, with an optional additional approval: chain.ts send()/write()/approveChog(); MyHouse.tsx fill and self-clean handlers. Gas charges follow Monad, not a fixed amount in Knock.sol.
- Today and yesterday (day and day - 1) are the app's two possible loot dates: chain.ts readNight().claims; Tonight.tsx claim controls. claimBoss() itself sets no expiry.
- Badge thresholds, all at least 5: ui.tsx houseBadges() checks timesTricked, tricksLanded, treatsGiven and raidsLanded. Contract knock()/raid() update those counters; badges and thresholds are app rules.
- $KNOCK defaults 100 per treat, 50 per successful raid, 500 per route, 300 per boss loot claim: scripts/relay.mjs REWARDS and rewardFor(); environment overrides are possible. Candy.tsx and Game.tsx display these defaults. Knock.sol does not mint or promise $KNOCK.
- One Chog per grant, 24 hours by default in the play-key draft: setDelegate() stores a grant by Chog id; app/src/session.ts startSession() defaults hours to 24, and hud/Session.tsx uses that default. This source was added concurrently; its flow remains draft pending verification. The contract takes the owner's chosen expiry and enforces no fixed lifetime.
- Latest 4 visits in the 3D street: Game.tsx feed.slice(0, 4); Simple.tsx displays the full readStreet() result and readVisits() result.
-->
