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
  - a sandbox "Try as a holder" so judges can play as one.
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

## State on Tue 13 Oct

The live site serves commit `d79ccb7`.

### Shipped

- **The game:**
  - six story levels, Endless and a Daily;
  - four tower families with specialisations, and four special towers unlocked with stars;
  - eight enemy types;
  - ten legendary bosses and the Great Pumpkin;
  - Witching Hour waves;
  - the hero rig with trait kits, talents and signature emotes;
  - spells, traps and supplies;
  - the field guide and the tutorial.
- **Today's passes:**
  - **Performance:** about 60 fps with 60 enemies and 12 towers firing (Intel Iris Xe at 844×390, DPR 3), and an adaptive quality governor.
  - **Economy and services:** the Candy Bank Worker, guest wallets, the $CHOG perk, and the "Try as a holder" endpoint.
  - **Combat feedback:** BLOCK!, CRIT!, MISS and TINK pops, hit reactions and the jar grab. Also the talent-pick pause and the see-through HUD.
  - **Teaching:** the tutorial glove, candy flights, rule callouts, the porch alarm and the next-wave path preview.
  - **Menus:**
    - a hero picker that fits a landscape phone;
    - the star-slam result screen and "Next night →";
    - the title with tonight's Chog;
    - dialog transitions, level cards with map previews, the boot shell and retry panels.
  - **In-game polish:**
    - the EARLY call button, READY on the ultimate and the TRAITS ACTIVE card;
    - Witching Hour edge warnings and the boss letterbox;
    - consistent boss pacing and idle life.
  - **Sound:** music per scene, a cue for every event and a limiter.
  - **Sharing:** the trophy share card, the public `/stats` page with a community goal, and optional vibration.
  - **Crude text:** Chogs with crude cap or shirt text are kept out of Random and the holder demo.

### In progress (uncommitted; other agents are working on these now)

- **Two-player co-op ("Porch Party").** Phase 1 builds new files only:
  - a Cloudflare Worker with Durable Objects as the relay;
  - the lockstep net layer;
  - a two-client determinism harness.

  Phase 2, the integration into the game, starts only when the owner says so.
- **The trailer.**
- **Menus pass 4:**
  - a centred title and extruded buttons;
  - "night tablet" level cards and dance chips;
  - a BOSS SLAYER accolade on the share card;
  - corrected Lite-mode copy.
- **Shop and stats pass 5:**
  - the Candy Vault claim ceremony, and no grant-panel flash;
  - a share image on `/stats`;
  - a music fade-in fix and cancellable star cues;
  - timeouts on asset fetches.
- **World pass 5:** road curbs, rune pads and a tidier status bar.
- **Small fixes:** plain caps on crude-text enemy faces, and a maskable app icon.

### Not working or not verified yet

- **The Bat Roost can't be bought.** Its on-chain price (item 31) is 0, so the shop shows "Not for sale" and the tower stays locked for everyone. Set the price with `setPrices` or remove the listing.
- **No starter grant has been paid.** The Candy Bank queues claims, but the relay hasn't been redeployed on OpenShip, and `/stats` shows 0 grants. Redeploy it and verify one real payout.
- **No physical-phone test yet.** All fps and layout checks ran in desktop Chrome at phone size. Use [docs/PHONE-TEST.md](docs/PHONE-TEST.md).
- **The repo is private.** Judges need read access, or the judge-access notes must work without it.

## What's left

| Target date | Work | Done when |
|---|---|---|
| Wed 14 – Fri 16 Oct | Co-op phase 2: a second hero, per-player commands, an invite link and lobby, co-op results | Two browsers finish a level together. A forced desync is detected and a disconnect is handled. Single-player replays are unchanged, and it holds 60 fps. |
| By Fri 16 Oct | The owner's fixes: the relay live, the Bat Roost priced or delisted, and the phone test passed | One real grant is paid, and the phone checklist is all ticked. |
| Sat 17 – Sun 18 Oct | Share with Chog holders, and fix what they hit | Real players show on `/stats`: the form asks for usage gathered. |
| Mon 19 – Tue 20 Oct | The trailer, 3 minutes or less, uploaded unlisted. Fill `TRAILER_URL` in the README. Finish the submission text (`.cache/submission-draft.md`). | The video link plays in an incognito window. |
| Wed 21 Oct | Freeze, test in an incognito window, submit | The form is submitted. |
| Thu 22 – Fri 23 Oct, 15:00 UTC | Buffer | |

## Not changing

- **The Chog Genesis contract and its art:** the game only reads them.
- **The simulation:** presentation work never changes the simulation, the RNG or the balance. Co-op lockstep depends on this, and a seeded 1,800-tick replay checks it.
- **Releases:** deploy only from a clean worktree of a commit, to the Cloudflare Pages project `knock` (branch `main`, domain knock.timidan.xyz). Never deploy from the shared working tree.

## Checkpoints

Post to Daily's Working on page (id `knock`) at each milestone.
