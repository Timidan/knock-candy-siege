# Candy Siege: hero batch 2a

Implemented on 2026-10-12. Only `src/siege/` and `scripts/rig-check.mts` were edited. No public assets, dependencies, other app modules, commits, deployments or Daily posts were changed.

## What is connected

The picker resolves the real token ID through `traits.json`, `kits.json` and `chogs.json`, displays six named kit rows with CSS atlas icons, the signature name and Home badge, and previews the idle rig on a small canvas. Entering a level loads exactly that hero costume, special and ultimate. Shared kit/status/signature art is loaded once. The previous hero perk table is removed; enemy modifier rules remain separate.

`hero/pose.ts` is Phaser-independent. Missing values return to rest, later-keyframe easing matches Phaser 3.90, and root/arm/weapon transforms follow the contract. The Phaser rig uses nested containers, the actual portrait and ring, correctly ordered skin layers, multiply tint, Multi Colored cycling and Metal shine. Crossfades take 120 ms. Walk cadence derives from the drawn leg's stride and actual movement speed. Shots are released by clip events, not the start of an animation.

Spawn, idle, walk, all attack styles, special, ultimate, hurt, faint, revive, victory and emote are connected. Damage flashes can run during an unreleased attack without cancelling its shot. Emote motion queues behind a busy action. Ordinary revival takes 12 seconds; Lucky Frog immediately restores 60% health once per level, and Skull revives once after 1.5 seconds. The result backdrop places the animated hero to the left of the dialog.

Ultimates charge from hero damage (0.022 charge per damage) and kills (+2); maximum charge is 100. The HUD shows charge, then a ready glow. Release plays the family art, sound, banner, 0.28-second slow-motion beat and shake. Reduced motion or disabled shake removes both the beat and shake. Pre/Post FX remain disabled; glows use sprites. Missing optional base frames still create the fallback atlas only on first use.

## Kit coverage and appearance

All effects below are implemented. Damage values are base values before starting levels, talents, critical hits, enemy resistance and marks. Range is in design pixels; intervals are seconds.

### Weapons

| Family | Damage / range / interval | Visible behavior |
| --- | --- | --- |
| Pitch Deck | 12 per card / 290 / 0.90 | Three cards fan to targets, with staggered flight and impacts. |
| Scepter Bolt | 32 / 305 / 1.20 | Animated magic bolt ignores armour. |
| Ball & Chain | 30 / 155 / 1.25 | Swing arc hits the surrounding crowd. |
| Fastball | 22 / 330 / 0.85 | Fast baseball flight bounces to a second enemy. |
| Slingshot | 15 / 290 / 0.62 | Rapid candy shots; Electric chains a visible zap to another enemy. |
| Mascot Slam | 36 / 175 / 1.65 | Leap/slam clip, shockwave and the suit effect below. |
| Egg Lob | 24 / 310 / 1.10 | Arcing egg, 82px splash; Fire uses the flaming egg and burn overlay. |
| Junk Toss | 28 × random multiplier / 280 / 1.05 | Random can, boot, bottle or fishbone; damage varies from 0.6× to 1.5×. |
| Pellet Blaster | 13 per pellet / 230 / 0.80 | Muzzle burst and three colored pellets in a cone. |
| Paper Fan Gust | 19 / 340 / 1.20 | Traveling wind crescent hits a line and pushes enemies back. |
| Ray Gun | 24 / 390 / 1.15 | Narrow piercing beam and muzzle flash. |
| Anime Beam | 38 / 1500 / 3.20 | Charge orb, full-path beam and beam end; crowds share a maximum of five targets' base damage. |
| Tickle Slap | 18 / 120 / 0.44 | Rapid close slaps and giggle sparks. |

Mascot suits: **Duck** adds circling ducks and a 0.7s stun; **Shark** adds teeth and 3s bleed; **Banana** leaves one peel per slam that trips a crowd once; **Dragon** breathes fire and burns for 3s; **Toad** pulls an enemy into the slam with its tongue; **Mummy** wraps and roots for 1.3s. These use six separate costume atlases, making 18 selectable costumes across 13 weapon families. Fire and Electric weapon modifiers come from the assigned body value.

### Specials

| Family | Cooldown | Visible behavior |
| --- | --- | --- |
| Laser Sweep | 20s | Eye flare, tinted connecting beams and scorch impacts; orange burns, green poisons, cyan freezes, purple pierces more targets. |
| Target Lock | 18s | Reticles and persistent marks on three tough enemies; +50% damage received and ghost reveal. |
| Deal With It | 18s | Falling shades and a shock ring; nearby enemies stop for 2.5s. |
| Tear Flood | 20s | Traveling water wave and splashes; slow and backward push. |
| Charm | 23s | Hearts and heart marks; three enemies attack other enemies for 4s. |
| Play Dead | 18s | Rising ghost, untargetability, then a jump-scare burst and stun. |
| Stare Down | 17s | Eye flash and facing fear cone; affected enemies walk backward. |
| Confetti Bomb | 18s | Bomb and confetti burst; confused enemies wander. |
| Pep Talk | 22s | Megaphone and repeated tower speed auras; nearby towers attack 30% faster for 7s. |

### Ultimates

| Family | Visible behavior |
| --- | --- |
| Candy Corn Meteor | Falling candy corn, huge impact, lingering fire zone and burn overlays. |
| Tidal Wave | Large wave sweeps backward across the screen, damaging, slowing and pushing enemies. |
| Twister | Large vortex gathers a crowd and grounds flyers. |
| Vanishing Act | Smoke, hero relocation and six backstab slashes; enemies lose their attacks briefly. |
| Arcane Storm | Cloud and ten staggered homing bolts with magic impacts. |
| Bloom | Bloom, roots on enemies and jar-refill art; restores three jars, capped at 20. |
| Love Bomb | Giant heart bomb and wave charms the screen's enemies. |
| Purify | Pillar and ring strip modifiers, reveal ghosts and release stunned towers. |
| Thunder Chain | Vertical strike, up to twelve connecting lightning segments and impacts. |
| Candy Bomb | Large falling wrapped candy and area blast; also the ten Base `1:1` Chogs' current ultimate. |

### Passives, headgear, trinkets, skins and quirks

Every equipped passive, headgear, trinket and skin has an in-game icon that opens its canonical effect text. HP, Home, Undead, Toxic, shield stacks, Pump stacks and the Multi Colored wave buff also appear as text. Thus quiet statistical perks remain inspectable.

| Slot | Family | Effect and visible feedback |
| --- | --- | --- |
| Passive | Money Mouth | +15% kill candy, reflected in the counter. |
| Passive | Sticky | 20% attack slow with gum/status art. |
| Passive | Rainbow Trail | Walking drops rainbow zones that hurt and slow. |
| Passive | Sweet Tooth | Nearby kill candy heals; green healing numbers. |
| Passive | Honk | Every tenth attack confuses, with status art and sound. |
| Passive | Tough | +20% maximum HP, visible in the HP label. |
| Passive | Pity | Enemies within 190px move 10% slower. |
| Passive | Cheerful | Nearby towers deal 5% more damage. |
| Headgear | Royal Command | Nearby towers deal 15% more damage. |
| Headgear | Spellcraft | Special and spell cooldowns reduced by 20%; HUD timers use the adjusted total. |
| Headgear | Hellfire | Basic attacks burn, with fire status art. |
| Headgear | Armored | 30% damage reduction, visible in slower HP loss. |
| Headgear | Degen Luck | 10% double-drop chance; extra candy number and counter. |
| Headgear | Focus | 10% critical chance; critical flash and larger damage number. |
| Headgear | Bucket Shield | First hit each wave blocked; shield count and impact flash. |
| Headgear | Chill | Slow immunity; nearby enemies deal 20% less damage. |
| Headgear | Prankster | Traps cost 20% less; discounted badges and spending. |
| Headgear | Oddity | Banana stun/lure art, poison mushroom cloud, 8-ball heal/damage roll, or extra laser, selected by the assigned head trait. |
| Headgear | Bareheaded | 5% faster movement, with matching walk cadence. |
| Trinket | Lucky Frog | Immediate one-time revival, revive art and recovered HP. |
| Trinket | Lucky Coin | +50 starting candy in the counter. |
| Trinket | Snack Bag | +1 jar per wave, capped at 20; jar counter and toast. |
| Trinket | Smoke Puff | On-hit smoke cloud confuses nearby enemies; 7s internal cooldown. |
| Trinket | Pump | Consecutive kills add attack speed; visible stack label. |
| Trinket | Dump | Nearby enemies move 15% slower. |
| Trinket | Heart | Regenerates 6 HP per second. |
| Trinket | Shiv | Adds 20% critical chance, flash and damage number. |
| Trinket | No trinket | Explicit picker row; no fabricated perk or missing-frame fallback. |
| Skin | Metal | Matching tint and pulsing shine; 20% damage reduction. |
| Skin | Jade | Matching tint and 8% double-drop chance. |
| Skin | Multi Colored | Cycling skin tint and random power/haste/guard buff each wave, named on HUD. |
| Skin | Rare tone | Matching tint and 25% faster recovery from slow. |
| Skin | Common tone | Actual portrait-matched skin tint; blank legendary skin uses the supplied gold. |
| Quirk | Skull | Undead label, fear immunity and one 1.5s revival before ordinary timers. |
| Quirk | Radioactive | Toxic label, attacks poison and display poison status. |
| Quirk | Tier / Home | Rare +1, Epic +2, Legendary +3 starting levels; Home adds +1 and the gold ring. |

### Signatures, talents and combos

All 18 definitions use the combined `sig.json`: Rainbow Barf, Bubble Pop, Bling, Coin Flip, Drool, Honk Honk, Flirt, Sob, Grr, Heart Eyes, Laser Blink, Faint, Waterworks, Scan, Deal With It, Giggle, Steam and Side Eye. They play on the real hero head and in a large portrait bubble. The ninth emote-wheel option is the larger centre portrait. Face offsets use `(anchor − 500) / 500 × (64/61) × R`, frame scale is `R/48`, and glasses/eye layers rotate with the eye line. Blank-side legendary portraits use only top/centre layers and portrait motion.

Enemies play signatures after a hit of at least 40% max HP and when stealing jars. Lethal-hit/steal signatures detach so removing the enemy does not instantly hide the animation. At most two enemy signatures, attached or detached, run at once. `SiegeScene.signature(enemy)` is the entry point for batch 2b/3 boss introductions; no boss spawner exists in this batch.

`data/talents.ts` contains 51 family talents: 13 weapon, 9 special, 8 passive, 11 headgear and 10 ultimate, plus four generic choices. At level 4 the card prefers the passive, or headgear when the passive is Cheerful and headgear is not Bareheaded. The family alternative upgrades the corresponding mechanic (for example Split Sweep, guard-healing Rainbow Trail, wider Egg Lob or longer Meteor fire). The generic alternatives are +15% attack damage, −20% special cooldown, +25% max HP and +25% ultimate charge. Cards do not pause play; high starting levels queue their choices. The tutorial hides the queue until its seven steps are complete.

Egg hitting a TP wrap doubles splash reach and uses `fx/eggsplosion`. Burning enemies reaching a candy bowl lose the burn and receive a 3s caramel stun with `fx/caramel`. Charmed enemies attack enemies and stop attacking the hero/guards. Each combo shows its own first-use COMBO! pop.

## Verification

- `node --experimental-strip-types scripts/rig-check.mts`: **PASS**, 4,864 reference samples, maximum transform error **0.00000109**, all 12 easing functions checked against the installed Phaser implementation, all 1,969 token kits resolved, Home bonuses and level 2–5 choice lookup checked. The asset file now includes 32 costume definitions; the check covers all of them, while gameplay selects the 18 costumes assigned by this batch's kits.
- `npm run build -- --outDir /tmp/knock-dist-siege`: **PASS**. Start JavaScript gzip was **68.63 KB before / 68.62 KB after**, inside the +5 KB allowance. Siege stays lazy-loaded; its chunk increased from 360.06 to 376.90 KB gzip.
- Real mouse clicks completed all seven tutorial steps: build, wave, upgrade, trap, rain, move, emote. The tutorial completion flag persisted. Picker, ring, signature wheel and head/bubble were visually inspected in the production build. Audio unlocked and decoded 19 cue buffers.
- Browser assertions passed for release timing, Home level/ring, Lucky Frog and ordinary revival, Skull revival/fear immunity, each combo's effect, the two-enemy signature cap, legendary anchor filtering and all four queued starting-level talent selections.
- Reduced-motion emulation produced no ultimate slow beat or camera shake; normal motion produced a 0.28s beat and active shake.
- A real click selected the first talent while the clock continued and the next queued card appeared. The victory backdrop was visually checked with the looping rig and signature bubble beside the dialog; this screenshot used a direct result trigger, separate from the complete balance runs below.
- A separate rendering fixture with Chog #466, 60 simultaneous enemies and four towers measured **1,007 allocated objects, 12 draw calls and 108.4 MB textures** after Meteor released, with no fallback atlas. This fixture assigned extra candy and enemy HP to hold the scene under load; it is not counted as a balance run. A temporary harness restart initially omitted Phaser's frame callback; that harness-only error was corrected before taking these measurements.

## Level 1 balance

The temporary browser harness drives the real `window.__siege.tick(1/45)` on the production build. Enemy/trait randomness uses an LCG (`n = 1664525*n + 1013904223`, uint32). Primary seed is 20261012. Sixteen extra IDs spread across the collection use seed 998877; these are a deterministic distributed sample, not a statistical random sample.

The hero walks to route distance 720, offset 25px below the path. Build Egg on pad 0 and Lantern on pad 1 before calling wave 1, then buy TP on pad 4 and Patch on pad 5 as earned candy permits. Upgrade in order: Lantern, Egg, TP, Patch, Lantern, TP. Final build is Egg 2 / Lantern 3 / TP 3 / Patch 2. No injected candy, Rain, Boo, traps or early-wave bonus. Choose the family talent and use ready specials/ultimates once per second when enemies exist. Draw/HUD refreshes are sampled during the fast simulation; actual rendering is checked separately. Solo runs use the same hero logic with zero towers and zero spells/traps.

**54/54 sensible-build runs won, all with 20 jars and 97 kills.** This covers every weapon, special, ultimate, passive, headgear, trinket and skin family, all six mascot suits, and the largest possible selected atlas combination (Chog #466). All nine specials and ten ultimates actually released in the sample. The first 53 runs finished in **153.4–174.6 simulated seconds**, dealt **971–6,055 hero damage** and peaked at **1,030 allocated objects / 26 concurrent enemies / 108.6 MB texture allocation**. The largest-atlas run also won and peaked at **108.8 MB**. Texture estimates include text/render allocations, excluding driver overhead.

**0/18 costume representatives won solo**; all lost their jars. This includes all 13 weapon families and six mascot suits. The solo losses took 75.8–168.2 simulated seconds. Every weapon representative dealt damage with the tower build; even the two lowest-damage representatives contributed 1,087 (Junk) and 1,307 (Slingshot) damage, before valuing control/utility.

Tuning removed two observed solo wins: Anime now shares full-path energy across crowded targets and fires every 3.2s; Banana leaves one consumable peel per slam instead of repeatedly generating peel zones per enemy. Three-seed reruns of those two representatives produced 6/6 tower-build wins and 0/6 solo wins. This is evidence for these sampled controllers and builds, not a proof about all 1,969 kits or optimal human play.

## Handoff and limits

No new enemies, specialisations, levels, props, ambience, bosses or shop were implemented. Supplied art for later batches is not activated just because it exists. Handmade legendary/crew kits remain for their intended batch. Boss-entry signatures need the future boss spawn caller; the shared player and cap already exist.

Physical-phone performance, subjective foot-contact quality on real hardware, every possible talent combination and exhaustive 1,969-kit battle balance were not checked. Headless FPS is intentionally not used because the machine is running another project's video workload. Strong control kits can contribute more than raw damage suggests; future difficulty tuning should retain mixed build and solo checks.

## Measured run ledger

Every row below won with 20 jars and 97 kills. Repeated IDs use a different seed.

| Token ID | Seed | Costume | Special / ultimate | Hero damage | Releases: special / ultimate | Seconds | Peak texture MB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 20261012 | fastball | deal-with-it / vanish | 3725 | 8 / 2 | 166.1 | 106.4 |
| 2 | 20261012 | slingshot | target-lock / tidal | 1307 | 8 / 1 | 164.9 | 106.5 |
| 3 | 20261012 | fan | deal-with-it / love-bomb | 4701 | 8 / 2 | 164.4 | 106.6 |
| 4 | 20261012 | scepter | tear-flood / twister | 2123 | 6 / 1 | 164.9 | 106.8 |
| 7 | 20261012 | pitch-deck | tear-flood / love-bomb | 2704 | 8 / 2 | 174.1 | 107.4 |
| 11 | 20261012 | anime | pep-talk / tidal | 5957 | 6 / 3 | 159.9 | 107 |
| 15 | 20261012 | egg-lob | confetti / purify | 2843 | 8 / 2 | 167.6 | 106.8 |
| 16 | 20261012 | ball-chain | target-lock / tidal | 2737 | 8 / 1 | 165 | 107.4 |
| 18 | 20261012 | tickle | laser / arcane | 1960 | 7 / 1 | 166.3 | 105.8 |
| 37 | 20261012 | mascot-dragon | tear-flood / arcane | 4349 | 7 / 2 | 164.9 | 108 |
| 42 | 20261012 | blaster | pep-talk / vanish | 4272 | 6 / 2 | 161.3 | 106.6 |
| 46 | 20261012 | ray-gun | laser / vanish | 4259 | 6 / 2 | 157.3 | 106.7 |
| 48 | 20261012 | mascot-toad | stare-down / bloom | 3787 | 9 / 2 | 172 | 107.9 |
| 66 | 20261012 | mascot-duck | deal-with-it / arcane | 3537 | 8 / 2 | 165.8 | 107 |
| 67 | 20261012 | junk | stare-down / bloom | 1087 | 8 / 1 | 165.5 | 107.3 |
| 124 | 20261012 | mascot-shark | pep-talk / arcane | 4454 | 6 / 2 | 158.5 | 107.1 |
| 132 | 20261012 | mascot-banana | pep-talk / arcane | 3743 | 7 / 2 | 158.8 | 107 |
| 181 | 20261012 | mascot-mummy | stare-down / meteor | 5061 | 8 / 2 | 165.1 | 108.6 |
| 5 | 20261012 | fastball | tear-flood / arcane | 3001 | 7 / 1 | 165.4 | 106.9 |
| 14 | 20261012 | pitch-deck | tear-flood / purify | 2527 | 8 / 1 | 165.7 | 107 |
| 19 | 20261012 | egg-lob | pep-talk / thunder | 3449 | 7 / 2 | 165 | 106.3 |
| 27 | 20261012 | pitch-deck | tear-flood / meteor | 6055 | 7 / 3 | 162 | 107.3 |
| 32 | 20261012 | fan | pep-talk / candy-bomb | 4654 | 5 / 2 | 153.4 | 107 |
| 39 | 20261012 | tickle | play-dead / arcane | 1219 | 8 / 1 | 166.1 | 106.4 |
| 53 | 20261012 | ball-chain | charm / love-bomb | 3752 | 6 / 2 | 174.6 | 107.2 |
| 262 | 20261012 | junk | pep-talk / love-bomb | 1820 | 7 / 2 | 172.5 | 107.1 |
| 365 | 20261012 | scepter | pep-talk / tidal | 2221 | 7 / 2 | 161.3 | 107.3 |
| 648 | 20261012 | egg-lob | pep-talk / love-bomb | 5061 | 6 / 2 | 162.5 | 107.1 |
| 881 | 20261012 | mascot-duck | laser / love-bomb | 5392 | 7 / 2 | 160.9 | 107.7 |
| 83 | 20261012 | egg-lob | tear-flood / purify | 3988 | 7 / 2 | 165.6 | 107.1 |
| 84 | 20261012 | fastball | pep-talk / meteor | 5447 | 7 / 2 | 156.6 | 107.2 |
| 91 | 20261012 | fastball | laser / love-bomb | 5863 | 8 / 3 | 172.3 | 106.7 |
| 118 | 20261012 | pitch-deck | pep-talk / tidal | 4321 | 7 / 2 | 160 | 107.1 |
| 123 | 20261012 | egg-lob | target-lock / vanish | 3853 | 8 / 2 | 166.8 | 106.1 |
| 414 | 998877 | fan | pep-talk / meteor | 4919 | 6 / 2 | 156.8 | 107.2 |
| 1201 | 998877 | mascot-shark | charm / arcane | 5150 | 6 / 2 | 163.8 | 106.9 |
| 19 | 998877 | egg-lob | pep-talk / thunder | 3631 | 7 / 2 | 163.3 | 106.3 |
| 806 | 998877 | blaster | pep-talk / tidal | 1963 | 6 / 1 | 166.3 | 107.3 |
| 1593 | 998877 | egg-lob | play-dead / meteor | 4315 | 7 / 2 | 162.6 | 107.5 |
| 411 | 998877 | fan | play-dead / tidal | 4536 | 8 / 2 | 161.7 | 107.5 |
| 1198 | 998877 | slingshot | pep-talk / love-bomb | 971 | 6 / 1 | 165.4 | 107 |
| 16 | 998877 | ball-chain | target-lock / tidal | 2641 | 8 / 1 | 165.6 | 107.1 |
| 803 | 998877 | scepter | target-lock / twister | 1772 | 8 / 1 | 165.8 | 106.2 |
| 1590 | 998877 | egg-lob | target-lock / purify | 3308 | 8 / 2 | 161.8 | 106.2 |
| 408 | 998877 | fastball | target-lock / tidal | 2359 | 8 / 1 | 166 | 106.8 |
| 1195 | 998877 | scepter | tear-flood / arcane | 2425 | 7 / 1 | 166.3 | 106.9 |
| 13 | 998877 | scepter | pep-talk / love-bomb | 1278 | 7 / 1 | 167.8 | 107.1 |
| 800 | 998877 | egg-lob | laser / candy-bomb | 4880 | 7 / 2 | 159.4 | 106.8 |
| 1587 | 998877 | ball-chain | pep-talk / arcane | 3251 | 6 / 1 | 162.6 | 107 |
| 405 | 998877 | fan | deal-with-it / arcane | 4603 | 8 / 2 | 161 | 106 |
| 36 | 20261012 | egg-lob | pep-talk / arcane | 2103 | 7 / 1 | 165.8 | 106.5 |
| 74 | 20261012 | fan | laser / arcane | 5091 | 7 / 2 | 160.4 | 105.9 |
| 45 | 20261012 | scepter | pep-talk / love-bomb | 1834 | 8 / 1 | 165.9 | 106.7 |
| 466 | 20261012 | mascot-dragon | tear-flood / meteor | 5793 | 7 / 3 | 156.6 | 108.8 |

Solo representatives: #1 fastball: lost at 99.3s; #2 slingshot: lost at 76.3s; #3 fan: lost at 101.8s; #4 scepter: lost at 99s; #7 pitch-deck: lost at 100.4s; #11 anime: lost at 97.3s; #15 egg-lob: lost at 82.3s; #16 ball-chain: lost at 75.8s; #18 tickle: lost at 101.4s; #37 mascot-dragon: lost at 103.3s; #42 blaster: lost at 79.3s; #46 ray-gun: lost at 101.3s; #48 mascot-toad: lost at 89s; #66 mascot-duck: lost at 97.8s; #67 junk: lost at 82.1s; #124 mascot-shark: lost at 101.3s; #132 mascot-banana: lost at 99.3s; #181 mascot-mummy: lost at 168.2s.
