# Candy Siege — world batch 2b

Implemented inside `src/siege/`, with one seeded-randomness assertion added to the existing rig check. No art, other app modules, dependencies, networking, deployment or chain operations changed.

## World and combat

| Level | Waves / climax | Introductions | Map mechanic |
| --- | --- | --- | --- |
| 1 · Rosie Row | 6 / One last treat | Existing treaters, pumpkins, ghosts and bats | Falling lamp: 170 damage and a 3-second stun, once |
| 2 · Lemon Lane | 7 / Midnight closing time | Goblins in wave 2; witches in wave 3 | Two ground entrances; sugar-rush shop |
| 3 · Mint Mews | 7 / The midnight crossing | Skeleton crews in wave 1; mummies in wave 2, splitting into minis | Drawbridge swaps ground routes; separate flight route |

Maps, pads, backgrounds, flight paths, switch geometry and ambience come from the supplied level JSON. Each incoming ground/flight route has an on-map call button. Winning unlocks the next level; cards use the actual backgrounds and saved stars.

Witches heal neighbours by 45, play the cast animation, then blink forward 120 pixels. Mummies schedule two minis on death, waiting if the enemy pool is full. Goblins steal at least three jars and play the grab animation. Skeleton wave counts represent crews of five, with bones on death. First encounters show intro cards; faces use the supplied windows, including cast, grab and death poses.

Bridge route choice belongs to each enemy. Marchers before the fork follow the new route; marchers beyond it keep their route. Enemies actually on the raised span disappear for six seconds and return at the fork on the detour. Flyers keep their flight route. Guards and traps can occupy the detour. Toggles have a 12-second cooldown. The shop costs 50 candy for ten seconds of 60% faster attacks, with a 24-second cooldown.

Each tower branches at level 3 for 180 candy, changes art, and permits two further ranks costing 150 and 210. Each rank adds 30% of base damage and 15 range. The first branch tap previews its effect; the second buys it.

| Branch | Behavior |
| --- | --- |
| Rotten Egg | Poison stacks up to five times |
| Golden Yolk | 35% chance of triple damage, with crit art |
| Mummy Wrap | Splash stun lasting 0.65 / 0.85 / 1.05 seconds |
| TP Tornado | Pulls marchers toward a vortex captured behind the target |
| Will-o’-Wisp | Chains to three nearby enemies for 60% damage each |
| Moon Beam | Pierces enemies along a 90-pixel-wide line |
| Jack Knights | Double guard health and 40% stronger attacks |
| Vine Snare | Guards root targets for 1 / 1.3 / 1.6 seconds |

Status overlays use `fx2/status/*`; stun uses freeze art and TP wrap uses root art. One priority status is displayed per enemy. Fog drifts, fireflies wander, leaves fall, bats cross, and lamp glows flicker through additive sprites. Lite runs allocate no ambience and halve portrait resolution in each dimension. Switching lite on hides existing ambience immediately; restarting applies portrait sizing and recreates ambience when switching back to full.

The React field guide contains enemies, towers, branches, modifiers and kit families with CSS atlas sprites and short descriptions. Discoveries persist; unknown entries appear as silhouettes.

## Balance measurements

These accelerated runs use the actual built Phaser scene at 1/45-second simulation steps in headless Chrome. Seed `20261012`, guest Chog #1, normal starting candy and earned income, no purchased boosts, injected money or altered combat stats. First-encounter pauses and the final result animation are bypassed. Times below are simulated seconds.

The good controller buys four complementary towers, upgrades all to level 2 and then 3, chooses Golden Yolk / Mummy Wrap / Will-o’-Wisp / Jack Knights, then buys both ranks as income allows. It moves the hero once, chooses family talents, uses ready ability/ultimate, casts Rain/Boo on clusters of at least three, and uses the map prop. It never calls waves early.

| Level | Zero-based pads, in purchase order | Jars / stars | Kills | Time | Peak enemies | Prop uses |
| --- | --- | --- | --- | --- | --- | --- |
| Rosie Row | Egg 0, Lantern 1, TP 4, Patch 5 | 20 / 3 | 155 | 185.2 s | 28 | 1 |
| Lemon Lane | Egg 6, Lantern 7, TP 5, Patch 8 | 20 / 3 | 272 | 238.1 s | 51 | 5 |
| Mint Mews | TP 0, Patch 1, Egg 3, Lantern 6 | 20 / 3 | 551 | 258.1 s | 65 | 1 |

All four towers reached branch rank 2 in every good run. Mint's kills include minis. The good controller raises the bridge at the start and leaves it raised; a separate mechanic check exercises enemies falling from its span.

The lazy controller uses the same four pads and affordable upgrade sequence, but builds only one tower type. It moves the hero once and chooses talents, then relies on automatic attacks: no active ability, ultimate, spell or prop. All twelve runs lost with zero jars:

| Level | Egg only: kills / time / final wave | TP only | Lantern only | Patch only |
| --- | --- | --- | --- | --- |
| Rosie Row | 126 / 191.9 s / 6 | 131 / 194.3 s / 6 | 60 / 164.0 s / 6 | 56 / 158.7 s / 5 |
| Lemon Lane | 102 / 158.9 s / 5 | 102 / 158.9 s / 5 | 2 / 43.8 s / 2 | 28 / 102.8 s / 4 |
| Mint Mews | 81 / 105.4 s / 3 | 331 / 206.4 s / 6 | 0 / 28.1 s / 1 | 1 / 29.2 s / 1 |

Balance changes include stronger climax swarms and reducing the previously dominant Lantern: base cost 200, damage 23/38/59, attack intervals 1.7/1.5/1.3 seconds. Magic and ghost reveal remain useful alongside cheaper damage and crowd control.

These results establish a winning build and losing lazy builds for this hero/seed. They do not establish that every single-type strategy loses: an exploratory Egg-only run with active hero powers survived Rosie Row with five jars. Exhaustive hero/seed balance remains untested.

## Commands and loading

Gameplay input enters `command({type, ...})`, carrying a pad index or world coordinates. Its gate checks pause/end state, tutorial restrictions, coordinates and choices before mutation. It covers build, upgrade, sell, specialise, target, trap, spell, move, ability, ultimate, emote, talent, wave, prop and speed. UI selection/preview stays local. Gameplay faces, modifiers and combat rolls use one `SceneOptions.seed` generator; cosmetic variation uses a separate source. Fixed simulation steps prepare the engine for sharing commands. Networking/replay transport are not implemented.

Selection loads the chosen map and level atlases, plus the chosen hero/special/ultimate atlases and previously supported owned cosmetics. `units2` is also needed on level 1 for tower branches. Leaving clears prepared/run references and destroys the Phaser textures. Destruction hooks cancel portrait async work, restore draw instrumentation and remove the debug scene reference. Pre/Post FX remain disabled and the fallback atlas stays lazy.

## Verification and limits

- `npm run build -- --outDir /tmp/knock-dist-siege` passed. Start JavaScript stayed **72.98 KB gzip**, unchanged from the pre-change build. The lazy Siege chunk is **395.25 KB gzip**.
- `node --experimental-strip-types scripts/rig-check.mts` passed **4,864 poses**, maximum error **0.00000109**, **12 Phaser eases**, **1,969 kits/Home bonuses**, **34 dance clips**, scoring/ownership gates, and seeded-stream same/different-seed assertions.
- Focused fixtures passed all eight branch effects, rank-2 caps, art selection, invalid/paused command rejection, witch heal/cast/blink, mummy split/spawn, three-jar goblin grab, five-member skeleton scheduling, lamp damage/stun/single-use, shop spending/duration/speed/cooldown, and bridge fork/span/return/flight behavior. Only these isolated mechanics fixtures inject test money/health; balance runs do not.
- Chog **#466** has the largest personal atlas set across all 1,969 kits: **4.74 MB**. On level 1, it measured **114.5 MB** at boot, **114.7 MB** with 96 enemies/eight branched towers/a tower ring, and **114.8 MB** with emote controls allocated. No fallback atlas was allocated. The crowded fixture had 1,330 display objects and 18 draw calls in the sampled frame.
- Lite #466 on Lemon Lane measured **105.6 MB** at boot, used a **1024 × 768** portrait canvas (normal: **2048 × 1536**), and allocated **zero** ambient sprites.
- Leaving through Level select removed the canvas and `window.__siege`; the destroyed game's texture list was empty.
- The level-1 tutorial completed all seven steps through real browser clicks and saved completion. In a fresh isolated context, levels 2/3 began locked; an actual 20-jar simulated level-1 win rendered the victory screen, saved three stars, and enabled Lemon Lane.
- Witch, goblin, mummy and skeleton intro cards rendered with atlas art; a repeated witch spawn did not reopen the card. The guide rendered 111 atlas sprites, with 39 discovered entries and 73 silhouettes in the exercised save. Its initial focus was corrected to the title and verified at scroll position zero. No browser page errors were recorded.

The existing victory-star overshoot was reviewed as intentional game celebration; its reduced-motion opt-out remains intact. The temporary headless browser and port-5180 preview were closed after verification.

Texture figures estimate RGBA WebGL allocations, including text/render targets, not total browser/driver memory. FPS is deliberately excluded on this machine running another project's video job. No physical-phone test, all-owned-cosmetics memory sweep, networking, live purchase, commit, Daily checkpoint or deployment was performed. The 768-portrait capacity covers these levels; longer modes would need recycling.
