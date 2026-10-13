# Knock: Candy Siege, the plan

Chogathon 2026, Chog's NFT hackathon on Monad.

- **Deadline:** the Chogathon page says submissions close **Fri 23 Oct, 15:00 UTC**. Its countdown is 9 Oct 15:00 UTC plus 14 days. This plan used Thu 22 Oct 15:00 UTC until now. **We submit on Wed 21 Oct either way.**
- **Judging:** Novelty 30%, Fun 20%, Retention 20%, Clarity 15% and Execution 15%, each scored 1 to 5. The Chog NFT being essential is a pass/fail gate. Meaningful use of $CHOG earns a bonus. Ties go to novelty, then retention.

## The product

**Knock: Candy Siege** is a Halloween tower defence played in the browser, made mobile-first for landscape phones.

- **The hero:** your Chog Genesis NFT, or any of the 1,969 Chogs.
- **The enemies:** waves of trick-or-treaters, each a real Chog whose traits become modifiers.
- **The traits:** each Chog's real traits become its kit, talents and perks.
- **Holders:**
  - Home advantage for the Chog you own;
  - the $CHOG holder perk;
  - a sandbox "Try as a holder" button in the hero picker, so judges can play as one.
- **Co-op:** Porch Party, two players with two Chogs on one porch, joined by a room link. Each player brings a Chog their wallet owns, or one from the holder demo. Live since 13 Oct.
- **Testnet shop:** a $KNOCK shop on Robinhood testnet, with a one-time starter grant.

| | |
|---|---|
| Live | https://knock.timidan.xyz, with stats at /stats |
| Code | `github.com/Timidan/knock-candy-siege` (private) |
| Player guide | [docs/HOLDERS.md](docs/HOLDERS.md) |
| Overview for judges | [README.md](README.md) |

## Dropped: the street game (13 Oct)

The first plan was a live haunted street on Monad mainnet:

- holders knocked on each other's doors;
- items lived in each Chog's ERC-6551 account;
- it ran on a walkable 3D street.

On 13 Oct the tower defence became the whole product, and the street game was dropped.

- **The code** is archived in `archive/street/`, not deleted.
- **`Knock.sol`** stays in `contracts/` but was never deployed to mainnet. The mainnet deploy planned for 16 Oct is cancelled.
- **Carried over:**
  - the relay now pays the Candy Bank starter grants;
  - the LuxVPS judge sandbox now serves "Try as a holder";
  - the Chog snapshot and portraits are reused.

## State on Tue 13 Oct, evening

**Live check, 21:37 UTC.** https://knock.timidan.xyz serves the app at `b5d0d85`. The live bundle has the Porch Party lobby and buttons, the capped-grant message and the new `/stats` label. The live CSP lists the co-op relay over `https` and `wss`, and the relay's `/health` answers protocol 3. At 21:25 UTC co-op wasn't live yet. Later that evening, a Porch Party between two browsers on the live site passed.

**Next release:** `83a28d8` switches the app to the redeployed, buyer-only shop. It is committed but not live: at 21:47 UTC the live bundle still used the first shop.

### Shipped and live

- **The game:**
  - six story levels, Endless and a Daily;
  - four tower families with specialisations, and four special towers unlocked with stars;
  - eight enemy types;
  - ten legendary bosses and the Great Pumpkin;
  - Witching Hour waves;
  - the hero rig with trait kits, talents and signature emotes;
  - spells, traps and supplies;
  - the field guide and the tutorial.
- **The 13 Oct passes:**
  - **Performance:** about 60 fps with 60 enemies and 12 towers firing (Intel Iris Xe at 844×390, DPR 3), and an adaptive quality governor.
  - **Economy and services:** the Candy Bank Worker, guest wallets, the $CHOG perk, and the "Try as a holder" endpoint.
  - **Combat feedback:** BLOCK!, CRIT!, MISS and TINK pops, hit reactions and the jar grab. Also the talent-pick pause and the see-through HUD.
  - **Teaching:** the tutorial glove, candy flights, rule callouts, the porch alarm and the next-wave path preview.
  - **Menus:**
    - a hero picker that fits a landscape phone, with dance chips;
    - the star-slam result screen and "Next night →";
    - the title centred on tonight's Chog, with one big **Hold the porch →** and small Shop, Guide and Settings tiles;
    - extruded sticker buttons that press down;
    - night-tablet level cards with map previews and a green PLAY;
    - Lite-mode copy that matches what it does;
    - dialog transitions, the boot shell and retry panels.
  - **In-game polish:**
    - the EARLY call button, READY on the ultimate and the TRAITS ACTIVE card;
    - Witching Hour edge warnings and the boss letterbox;
    - consistent boss pacing and idle life.
  - **World:** road curbs on every map, rune pads, and a tidier status bar.
  - **Sound:** music per scene, a cue for every event and a limiter. Music fades in only once it actually plays.
  - **Sharing:** the trophy share card with a BOSS SLAYER accolade, the public `/stats` page with a community goal and a 1200×630 share image, and optional vibration.
  - **Shop:** the Candy Vault with its claim ceremony, and no grant-panel flash for players who already claimed. Base, hero and level loads give up after 20 seconds, so a stalled request shows the retry panel.
  - **Crude text:** Chogs with crude cap or shirt text are kept out of Random and the holder demo. Enemies with crude caps wear them without the print, and the new-enemy card skips crude-text portraits.
  - **Also:** a maskable app icon, the README, player guide and phone test, and the art pipeline sources in `art/`.
- **Security hardening, from the 13 Oct review:**
  - **Pages:** a Content-Security-Policy, framing blocked, and no long-lived asset cache.
  - **Stats and Candy Bank Workers (deployed):** a rate limiter before D1, at most 150 new grant claims per UTC day, and IP hashes salted per day.
  - **Holder sandbox (deployed on LuxVPS):** the public RPC is read-only, with per-call rate limits, deadlines and a gas cap.
  - **Co-op relay (deployed):** a streamed 512-byte limit on room creation, and join attempts rate-limited before any room lookup.
- **The grant relay pays.** A live claim was paid end to end on 13 Oct, and `/stats` shows 1 grant.

### Released on the evening of 13 Oct (live by 21:37 UTC)

- **Porch Party co-op** (`4cd03da`):
  - two players, two Chogs, one porch, on any story level;
  - shared candy, towers, traps, spells and jars, and each player controls their own hero;
  - joined by a room link;
  - deterministic lockstep through the deployed relay.

  Each player needs a Chog their wallet owns, or one from the holder demo.
- **`b5d0d85`:**
  - the co-op relay added to the CSP's `connect-src` (co-op can't connect without it);
  - "Today's starter grants are gone. Try again tomorrow." when the daily cap is reached;
  - a line on `/stats` saying the numbers are anonymous player reports.

### Done in code, not deployed

- **Grant relay hardening** (`8a75f7f`):
  - a budget of 200 grants a day on top of 60 an hour;
  - the gas gift becomes a 21,000-gas transfer under a 1 gwei fee ceiling, with no gift for contract addresses;
  - checks before anything is signed, and a payment-history check on every claim.

  The relay report left the OpenShip redeploy to the owner, and no later report shows it was done. Redeploy it, or confirm that it was.

### Deployed, waiting for the next release

- **The buyer-only KnockShop** (`8a75f7f`) is deployed at `0xdfE49a06DEB6040Ecd6855AE07411cA2B336688C`.
  - `buyFor` only accepts a purchase sent by the buyer: a read-only call from anyone else reverts with "not buyer".
  - The prices match the first shop, plus the Bat Roost (item 31) at 400 $KNOCK.
  - The app switch (`83a28d8`) goes out with the next release. Items bought on the first shop (`0xc52d…89b6`) still count, because the app reads ownership from both.
- **Fix the Bat Roost blurb before or with that release.** In `Shop.tsx`, it still says "Launch price: 1,000 $KNOCK. Sales open when the shop sets its on-chain price." The card and the Buy button show the on-chain 400. The `data/shop.ts` fallback price, 1,000, is only shown when no shop is configured.

### Not working or not verified yet

- **The Bat Roost can't be bought until the next release.** The live app still reads the first shop, where its price (item 31) is 0, so it shows "Not for sale". The new shop sells it for 400 $KNOCK.
- **Co-op hasn't run on two real devices or across real networks.**
  - The reports' runs were two browsers on one laptop, against the deployed relay or a local copy with added latency. The live-site check on 13 Oct was also two browsers.
  - One diagnostic run on the public relay lost its socket (close code 1006), and the cause wasn't found.
  - There's no reconnect, so a dropped connection ends the room.
- **No physical-phone test yet.** All fps and layout checks ran in desktop Chrome at phone size. Use [docs/PHONE-TEST.md](docs/PHONE-TEST.md); it has no co-op step yet.
- **The repo is private.** Judges need read access, or the judge-access notes must work without it.

## What's left

| Target date | Work | Done when |
|---|---|---|
| Tue 13 – Wed 14 Oct | Play a Porch Party on the live site, on two phones on different networks | Two devices finish a level together. |
| By Fri 16 Oct | The owner's fixes: release `83a28d8` with the Bat Roost blurb fixed, redeploy the relay with its hardening, and pass the phone test | The live app buys from the new shop, a grant pays through the new relay, and the phone checklist is all ticked. |
| Sat 17 – Sun 18 Oct | Share with Chog holders, and fix what they hit | Real players show on `/stats`: the form asks for usage gathered. |
| Mon 19 – Tue 20 Oct | The trailer, 3 minutes or less, uploaded unlisted. The shot list has no Porch Party shot yet. Fill `TRAILER_URL` in the README. Finish the submission text (`.cache/submission-draft.md`). | The video link plays in an incognito window. |
| Wed 21 Oct | Freeze, test in an incognito window, submit | The form is submitted. |
| Thu 22 – Fri 23 Oct, 15:00 UTC | Buffer | |

## Not changing

- **The Chog Genesis contract and its art:** the game only reads them.
- **The simulation:** presentation work never changes the simulation, the RNG or the balance. Co-op lockstep depends on this, and a seeded 1,800-tick replay checks it.
- **Releases:** deploy only from a clean worktree of a commit, to the Cloudflare Pages project `knock` (branch `main`, domain knock.timidan.xyz). Never deploy from the shared working tree.

## Checkpoints

Post to Daily's Working on page (id `knock`) at each milestone.
