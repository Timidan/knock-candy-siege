# Candy Siege · engine batch 3b

Five special towers, five in-level consumables, holder street bonuses and the expanded sound mix are implemented. All new gameplay actions enter `SiegeScene.command()`. Changes stay in `src/siege/`; no art, contracts, wallet code or shop transaction code changed.

## Towers and mobile controls

The build ring has two pages: four classic families, then five special families. Its centre switches pages; tapping outside closes it. Locked towers still show their description and unlock requirement. Special towers stop at level 3; the classic branches are unchanged. All five have field-guide entries, visible before discovery.

| Tower | Role | Unlock | Build / upgrade candy |
| --- | --- | --- | --- |
| Bat Roost | Three animated `unit/bat` projectiles per attack; flyers only | Own shop item 31 | 135 / 115 / 165 |
| Witch's Cauldron | Ground splash, 40% slow and poison | Three stars on Lemon Lane | 145 / 120 / 175 |
| Candy Corn Catapult | 500–580 range, 170–220 splash radius, 5.2–4.4 seconds between shots | Win Mint Mews | 190 / 160 / 220 |
| Ghost Lighthouse | A 75-degree sweep, reveal for four seconds, short fear, low magic damage | Win Mon Manor | 160 / 120 / 175 |
| Haunted Organ | Radial magic damage and 70–110 px knockback; bosses take 20% of the push, slippery enemies resist it | Win Radioactive Ridge | 175 / 135 / 190 |

Only Lemon Lane requires three stars; the other named level unlocks mean a win. The Bat Roost shop card uses `card/bat-roost`, previews its three levels and lists the 1,000 $KNOCK launch price. Adding id 31 to `SHOP_ITEMS` includes it in the existing on-chain price and ownership reads. The existing buy guards require a configured shop and a nonzero live price; a missing shop is preview-only and zero means “Not for sale.” No shop was configured or transaction submitted in this run.

## Consumables

The Supplies button opens a five-item tray above the traps. Tap an item then the road, or drag it from the tray. Candy is charged only for a valid placement; each item has its own cooldown. At most eight persistent supplies can exist. Every item uses the supplied icon, world sprite and effect frames. Selecting an item or spell also makes taps on roadside props aim the selected action instead of swallowing that tap.

| Item | Candy | Cooldown | Effect |
| --- | --- | --- | --- |
| Pumpkin Bomb | 65 | 18 s | Thrown blast, 160 magic damage in a 155 px radius |
| Holy Water | 45 | 16 s | 180 damage to ghosts, 20 to others; reveals for five seconds |
| Garlic Cloud | 55 | 20 s | Six-second ground cloud applying poison and slow |
| Giant Candy Cane | 55 | 24 s | Stops ground movement for eight seconds; flyers pass over |
| Scarecrow | 50 | 22 s | 240 HP decoy beside the road, lasts up to 12 seconds; bosses and visor enemies ignore it |

## Street data flow

Play or Restart → connected `wallet.account` and valid configured `KNOCK` address → `ownerOf(hero)` → if owned, one `readHouse(hero)` and `readCrews([hero])` → fixed bonus snapshot for this run → source/bonus card → scene. These reads reuse `chain.ts` on Monad; the existing $KNOCK shop remains on its separate configured Robinhood network. No wallet signature is needed for street reads.

- A set house trap supplies one free Pumpkin Trap placement, shown as FREE in the existing trap slot.
- Bowl candy adds one starting candy each, capped at 60.
- A positive $CHOG bowl multiplies kill income by 1.1, without boosting unrelated income.
- Ghosts use the seeded stream to dodge 10% of discrete hero hits; damage-over-time ticks are not dodge rolls.
- Witches multiply spell and special cooldowns by 0.85; Pumpkins multiply tower-guard health by 1.25; Bats multiply damage against flyers by 1.25.

Ownership mismatch or guest play grants nothing. Failure of either read, or the six-second timeout, grants no partial/cached bonus and starts the level with a small HUD note. Leaving the menu or changing accounts invalidates a pending start/card. Reads do not recur mid-level; Restart obtains a fresh snapshot.

## Sound, randomness and memory

`Sfx` selects and pitch-shifts the existing manifest cues for every special/ultimate family, legend boss, special tower, consumable, signature emote and dance. It allows at most three simultaneous instances of one cue and 18 effect voices overall, with a short trigger gap. Ultimate music ducking lasts 2.2 seconds; boss intro ducking lasts three seconds, at 22% of the selected music volume, recovering over 0.45 seconds. Changing settings during a duck keeps the duck active.

All Siege random choices use `seededRandom`; cosmetics use a separate stream derived from the run seed so they do not consume combat rolls. Menu portrait selection has its own seed. `disablePreFX: true`, `disablePostFX: true`, the lazy fallback atlas and lazy boss art are preserved. The new level atlases add 6.75 MB RGBA (`towers3`: 4 MB, `items`: 2.75 MB).

## Verification

- `npm run build -- --outDir /tmp/knock-dist-siege`: passes. Start JS is 231.24 kB / 72.98 kB gzip, unchanged to Vite's reported precision; lazy Siege JS is 424.92 kB gzip. Vite still reports the existing large lazy-chunk warning.
- `node --experimental-strip-types scripts/rig-check.mts`: passes 4,864 poses (maximum error 0.00000109), 1,969 kits, 34 dance clips, seeded replay, legends, map/wave assignments, Endless and Daily checks. No new test framework or permanent test suite was added.
- Fixed-step browser mechanics: all five level-3 towers deal damage through their intended attacks; Cauldron applies poison/slow, Lighthouse reveals/fears and Organ pushes. All unlock gates and the level-3 cap hold. Bomb damage is 160, Holy Water ghost damage is 180; invalid placement and cooldown repeats spend nothing. Cane holds through 7.9 seconds and releases after expiry; Garlic applies damage/slow; the Scarecrow attracts enemies and takes hits. The free Pumpkin Trap consumes exactly one credit at zero candy.
- Mon Manor simulations, seeds 20261012 and 998877: the nine-family composition wins with 16 and 17 jars. Each of the five single-special-family builds loses on both seeds. Isolated mechanics fixtures verify each role; the full mixed run records damage from every new family, plus Cauldron/Lighthouse statuses. The scripted single-family controller moves and auto-attacks with its hero and selects talents, but does not use active spells: these results are balance evidence, not a proof against every possible human strategy.
- Classic composition regression, seed 20261012: Rosie Row wins with 20 jars, Mon Manor with 20, Rare Row with 18. Rare Row's observed textures are 110.1 MB. Revealed enemies now carry a small light through the darkness mask.
- At 844 × 390, real browser clicks complete all seven tutorial steps and persist completion; real mouse drag/release places the Candy Cane and queues five enemies behind it. The two ring pages and supply tray fit the viewport. These are browser-sized mobile checks, not physical-device tests.
- Level 1, Chog #466: 97 MB at boot, 1,100 display objects, nine draw calls, no fallback atlas. Enumerating the asset sets of all 1,969 heroes, including optional `@2x` sheets, identifies #466 as the largest at 4.993 MB. A runtime fixture adding the largest crew outfit (Ghosts), gold skins and crypto emote art reaches 102.1 MB, 1,394 objects and 12 draw calls. Mechanics fixtures peak at 97.3 MB; the detailed counters are in the browser evidence. This is texture allocation evidence, not a driver-memory or FPS claim.
- Mocked RPC and injected-wallet browser flow: one house/crew read before starting; bowl 90 becomes +60 candy; set trap gives one credit; $CHOG makes a 100-candy kill pay 110. Witches' factor is 0.85, Pumpkins give 137.5 HP to a base 110-HP guard, Bats make a 100-damage hit deal 125. Ghosts dodge approximately 10% of 1,000 seeded hits. Restart rereads, failed reads start without bonuses, and a nonowner does not read the house.
- Browser audio inspection loads 19 buffers, caps repeated BOO at three voices, ducks 0.2 music to 0.044, preserves ducking through a change to 0.3, then restores 0.3 and releases completed voices.

Temporary evidence is under `/tmp`: `siege3b-mechanics.json`, `siege3b-balance.jsonl`, `siege3b-regression.jsonl`, `siege3b-street-evidence.json`, `siege3b-mobile-evidence.json`; their `.mjs` browser harnesses remain beside them for inspection. Screenshots: `siege3b-ring-classic.png`, `siege3b-ring-special.png`, `siege3b-supplies.png`, `siege3b-consumable-in-use.png`, `siege3b-street-card.png`, `siege3b-street-unavailable.png`.

Live owner/house RPC behavior and a real Bat Roost purchase are not claimed from these mocks. No physical-phone or listening test was performed. FPS on this loaded machine is not meaningful. No Daily checkpoint, commit, push or deployment was made.
