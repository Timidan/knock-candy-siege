# Candy Siege · engine batch 3a (the endgame)

Levels 4–6, bosses, Witching Hour swarms, the endless mode, the daily challenge, legend heroes and sharp showcase heroes. Only `src/siege/` and `scripts/rig-check.mts` changed. No dependency, public art, other app module, commit, deployment or Daily post was touched. Pre/Post FX stay disabled and the fallback atlas is still built lazily (it was not allocated in any of the memory runs below). Every new player action goes through `SiegeScene.command()`; all gameplay randomness uses the seeded stream (only particle scatter and the candy shower use `Math.random`).

## What is in the game

| Area | Behaviour |
| --- | --- |
| Mon Manor (4) | One portal pair: every ground enemy that reaches `enter` comes out at `exit` (`fx/teleport`, animated `prop/portal`); flyers pass over. The bell stuns every enemy for 2 s (22 s cooldown). 8 waves. |
| Radioactive Ridge (5) | Ground enemies inside a toxic pool move 30% faster. The three boosted pads give their tower +20% range and damage (`towerStats`, shown in the build toast). The grate drops the ground enemies standing on it, bosses excepted; they climb out 5 s later at its `return` point (16 s cooldown). 8 waves. |
| Rare Row (6) | A 600 × 270 canvas layer (0.65 MB) at 85% black over the whole 2400 × 1080 world, with `amb/light` cut-outs for the five street lights, every Haunted Lantern's range, your Chog (210 px) and the bonfire. Light is folded into `Enemy.visible`: an enemy outside every light vanishes except two glowing eyes, and cannot be targeted, blocked or hit by towers (Candy Rain, Boo! and Target Lock still reach it). The bonfire lights the whole map and reveals ghosts for 20 s (45 s cooldown). Bosses carry their own light. 9 waves. |
| Waves | The last wave of levels 3–6 is a Witching Hour. Boss waves: Lemon Lane 7 (Pepe), Mint Mews 7 (Midas), Mon Manor 8 (The Scream), Radioactive Ridge 8 (Brainz); Rare Row 3 (Ember), 5 (Lil' Devil), 7 (Gladius), 9 (the Great Pumpkin). |
| Bosses | A legend boss is a pooled `Enemy` carrying a `BossState`: the hero rig at 1.8× in its `legend-<id>` costume, `boss/<id>/aura` behind it, the real portrait, and the move named in `legends.json` on a timer. Towers, traps, spells, guards and the hero treat it like any enemy. At half health it enters phase 2: 35% faster, casting 40% sooner, with a flash and a shake. Slows, stuns, freezes, roots, wraps and confusion last 35% as long; fear, charm and ground are ignored. |
| Boss intro | The boss walks on 760 px along the road. Camera eases to 1.45× on it, the banner (`boss/ui/banner`, with the portrait) slides in, a slow-motion beat runs for 1.5 s, its signature emote plays and the boss bar (`boss/ui/bar` plus a draining `fill`) fades in. Reduced motion skips the camera and the slow beat but keeps the banner, the bar and the emote. The first meeting of each boss pauses the game for an intro card (also in the field guide, Bosses group). |
| Boss death | The corpse faints, the world slows (not with reduced motion or shake off), 8 candy and coin bursts (30 for the last boss alive), a shake, the "DEFEATED" banner and the candy cascade sound. A boss that reaches the porch takes its `jars`: 6 (Lil' Devil 8), and the Great Pumpkin 10 until it splits, then 5 for each third. |
| Boss moves | Ember: burning footprints plus Wildfire ring (immune to burn). Hellfire Skull: Hell Ride dash that kills guards in its way, revives once at 45%. The Scream: the screen warps and towers miss half their shots for 4 s. Brainz: raises the last three fallen enemies. Pepe: Frog Leap dash, shaking off slows. Manga: Final Panel, towers stunned 3 s. Seraph: Sanctuary shields enemies within 300 px for 5 s. Gladius: Testudo blocks the next five real hits. Midas: Golden Touch silences two towers for 5 s. Lil' Devil: Pact calls five imps and steals up to three jars once per fight (returned if he dies). |
| Great Pumpkin | 320 px frames. Walks, rolls for 2.4 s every 9 s at 2.4× speed flattening guards (95 px), splits into three at half health (a third of the health each, 0.6 scale, 1.25× speed, five jars each, 1.3 s of immunity while it splits), and the first pumpkin of the family (whole or a third) to pass 68% of the road calls eight more enemies ahead of itself (once for the whole family). |
| Witching Hour | Swarms of ghosts (drifting) and bats (straight) from all four edges of the visible view, with no road. Three seconds before: pulsing chevrons at each edge and the banner "WITCHING HOUR: they're coming from everywhere!". Spawn points within 430 px of the porch are re-rolled along their edge, so a swarm always has a few seconds of flight. |
| Endless | Town Square. Health ×1.08 per wave; one road until wave 9, two from 10, three from 20, four from 30; every 10th wave is a Witching Hour plus the next boss of the 11-boss rotation (Pepe, Midas, The Scream, Brainz, Ember, Lil' Devil, Gladius, Hellfire Skull, Manga, Seraph, Great Pumpkin); every prop works again on 1.6× cooldowns. Score = 400 per wave cleared + 100 per Chog stopped; the best wave and score are saved, and the share card has an endless variant. |
| Daily | The UTC date seeds the run (`YYYYMMDD`), picks the level (1–6) and sets the night (`day % 4`, as `Knock.sol`'s `nightTheme`): quiet; Blood Moon, enemies +25% speed; Candy Rain, all candy ×2; Costume Night, the ground enemy types shuffled by the seed. `daily/*` icon in the HUD, on the level card and on the share card ("Daily #n"). Best score per day is saved (last 30 days). Daily #1 is 12 Oct 2026. |
| Legend heroes | The ten 1:1 Chogs use their hand-made kit from `legends.json`: costume, weapon, special and ultimate, art from `hero-legend-<id>`, a gold LEGENDARY badge in the picker, their own mastery talents. Weapons run 14–36 damage, 170–360 range. This replaces the `candy-bomb` stand-in. |
| Sharp heroes | `hero-<costume>@2x` parts replace upscaled 1× parts in the picker (up to 3.1×, legends 2.7×), the share card (drawn at 4×, then fitted) and the victory zoom (2× → 3.4× with a 256 px portrait). Shop dances use `card/dance-<name>` from `cards2`. |

## Where it lives

- `data/level1.ts`: `LEVELS` 1–7 (7 is Town Square, `endless: true`); `Wave.witching`, `Wave.boss`, `WaveGroup.edge`; level geometry `portals`, `zones`, `dark`, `lights`, pad `boost`, props `bell`, `grate` (with `return`) and `bonfire`.
- `data/endless.ts`: endless generator (`endlessWave(number, seed)`), road and boss rotation, score, daily date/seed/theme, Costume Night shuffle. `data/bosses.ts`: boss health, speed, cast time, jars, candy.
- `data/kits.ts`, `data/talents.ts`: `LegendInfo`, `withLegends`, legend weapons, cooldowns and mastery talents. `data/save.ts`: `endless` and `daily` records. `data/config.ts`: `towerStats(…, boost)`.
- `Boss.ts` (bosses), `Darkness.ts` (the layer), `hero/Legend.ts` (legend weapon, special, ultimate), `SiegeScene.ts` (modes, props, wave calls, edge routes, warning, allies, hazards, lights), `Hud.ts` (boss bar, banner, daily icon, call-button previews), `Siege.tsx` (Endless and Daily cards, boss intro card, badge), `ShareCard.tsx`, `FieldGuide.tsx`, `assets.ts` (lazy boss atlases, `@2x` sets, face-slot recycling), `hero/Rig.ts`, `hero/HeroPreview.tsx`.
- Memory: boss atlases load when their wave is called (the next boss's the wave before) and are dropped after the corpse is gone. The Great Pumpkin sheet is 15.7 MB, so only the three UI frames are copied into a 0.9 MB canvas texture; the sheet itself is uploaded for the Pumpkin fight only.

## Checks and evidence

`npx tsc -b` is clean. `npm run build -- --outDir /tmp/knock-dist-siege` passes: the start bundle is `231.24 kB`, `72.98 kB` gzipped, the same as before this batch; the lazy Siege chunk grew from about 396 to 419 kB gzipped. `node --experimental-strip-types scripts/rig-check.mts` passes (it now also checks the ten legend kits, maps 1–6 and Town Square, wave and boss assignments, endless scaling and rotation, and the daily seed, theme and shuffle).

Simulations drive the real scene through `command()` in headless Chrome with a fixed seed (20261012). "Good" builds four towers on fixed pads (Egg Stand, Pumpkin Patch, TP Launcher, Haunted Lantern, cheapest first, the Lantern sooner when ghosts are due), upgrades them to level 3 with a specialisation, adds two porch towers (Lantern and TP Launcher), then ranks the base four up, moves the hero once, spends its talent, ability and ultimate, casts Candy Rain and Boo! on clusters, uses the level's prop, and only calls the first wave early. "Lazy" builds the same pads (and the same two extras) with one tower type only, and only moves the hero and picks talents. Three stars needs 18 of 20 jars.

The balance, endless and daily runs below were all repeated on the final production build, with zero console errors or warnings.

| Level | Good build (seed 20261012) | Good, seeds 998877 / 424242 | Lazy: Egg Stands only | TP Launchers only | Haunted Lanterns only | Pumpkin Patches only |
| --- | --- | --- | --- | --- | --- | --- |
| 2 Lemon Lane | 3 stars, 20 jars, 273 kills, 239 s | 20 / 20 jars | lost in wave 5 of 7 | lost in wave 5 of 7 | lost in wave 2 of 7 | lost in wave 4 of 7 |
| 3 Mint Mews | 3 stars, 20 jars, 502 kills, 262 s | 20 / 19 jars | lost in wave 4 of 7 | lost in wave 6 of 7 | lost in wave 1 of 7 | lost in wave 1 of 7 |
| 4 Mon Manor | 3 stars, 20 jars, 410 kills, 300 s | 19 / 20 jars | lost in wave 5 of 8 | lost in wave 5 of 8 | lost in wave 2 of 8 | lost in wave 1 of 8 |
| 5 Radioactive Ridge | 3 stars, 18 jars, 381 kills, 283 s | 19 / 19 jars | lost in wave 7 of 8 | lost in wave 6 of 8 | lost in wave 2 of 8 | lost in wave 2 of 8 |
| 6 Rare Row | 3 stars, 18 jars, 532 kills, 346 s | 20 / 20 jars | lost in wave 5 of 9 | lost in wave 5 of 9 | lost in wave 2 of 9 | lost in wave 4 of 9 |

Every good run is a three-star win on all three seeds (18 to 20 jars; Radioactive Ridge on the main seed sits exactly on the 18-jar line), and all 20 lazy runs lose with zero jars.

Exploratory, and not the pass criterion (the lazy controller above is the same one batch 2b used): the same single-tower builds played with the good player's hero powers, spells and prop (main seed) do not all lose.

| Level | Egg Stands only | TP Launchers only | Haunted Lanterns only | Pumpkin Patches only |
| --- | --- | --- | --- | --- |
| 2 Lemon Lane | **won with 6 jars (1 star)** | lost in wave 7 of 7 | lost in wave 4 of 7 | lost in wave 5 of 7 |
| 3 Mint Mews | **won with 10 jars (2 stars)** | **won with 18 jars (3 stars)** | lost in wave 2 of 7 | lost in wave 6 of 7 |
| 4 Mon Manor | lost in wave 8 of 8 | **won with 1 jar (1 star)** | lost in wave 8 of 8 | lost in wave 3 of 8 |
| 5 Radioactive Ridge | **won with 7 jars (1 star)** | **won with 13 jars (2 stars)** | **won with 11 jars (2 stars)** | lost in wave 8 of 8 |
| 6 Rare Row | lost in wave 9 of 9 | **won with 20 jars (3 stars)** | lost in wave 4 of 9 | lost in wave 6 of 9 |

Tower variety is rewarded, since the good build keeps 18 to 20 jars where these keep 0 to 20, but it is not forced. The TP Launcher alone, played actively, three-stars Mint Mews and Rare Row. If variety should be forced, the cheap levers are in the late waves (more ghosts, which only Lanterns and Boo! reveal, and more armour), not a rebuilt wave table.

Endless (Town Square, good build on 12 pads, ranks 2), two seeds, rerun on the final build: both reach wave 30 (all four roads open, three Witching Hours with Pepe, Midas and The Scream) and fall there, at 1,169 and 1,145 simulated seconds with 1,478 and 1,513 Chogs stopped, hero level 5, a peak of 96 enemies (the pool cap), no errors, 91.1 MB of textures.

Daily, good build, with the clock faked to each UTC date: #1 (12 Oct, Mint Mews, Candy Rain) 20 jars; #2 (13 Oct, Mint Mews, Costume Night) 13 jars; #3 (14 Oct, Rosie Row, Quiet) 20 jars; #4 (15 Oct, Rare Row, Blood Moon) 11 jars. The two harder nights are two-star wins for this controller.

Texture memory (`?siegeStats`, final production build): Rosie Row 82.9 to 85.0 MB with five different heroes (#1, #466, #561, #7, #1884). Rare Row full run with its bosses: hero #1 87.1 MB at start, 91.7 MB with a legend boss alive, 103.2 MB peak (Great Pumpkin alive); hero #466 89.3 / 93.8 / 105.3 MB; hero #561 88.5 / 92.6 / 104.2 MB. All under 130 MB (the sweep's Rare Row good-build peaks, 103.1 to 103.3 MB on three seeds, agree), and the fallback atlas was never allocated.

Other runs (on the build before the last two small fixes, the share-card box and the Pumpkin's jars): tutorial completes in seven steps; all ten legends run their special and ultimate without errors, win Lemon Lane with the good build and lose solo on Rosie Row; victory swaps all parts to `@2x`; reduced motion keeps zoom 1, no slow beat, the banner and bar; phone landscape (844 × 390) level select, hero picker and boss bar fit; the endless and daily share cards render from the real result screen.

Screenshots (headless, 1280 × 720, production build): `knock/.cache/siege3a-shots/` (the three new levels, Rare Row's darkness and bonfire, Town Square, a boss intro with the camera eased in for Pepe and the Great Pumpkin, the Witching Hour warning and swarm, the level select with the Endless and Daily cards, the legendary picker, both share cards, the sharp victory zoom and three phone layouts).

## Limits

- Never tested on a physical phone; headless FPS means nothing on this machine, so performance is judged by object counts and texture MB.
- No new audio (no boss theme); bosses reuse existing cues.
- The darkness is a quarter-resolution canvas texture redrawn at most 30 times a second, not a GPU render texture. It looks soft, but edges are not pixel-sharp.
- Pact (Lil' Devil), Testudo (five real hits) and the Pumpkin's last wave are my readings of one-line descriptions; the jar refund on Lil' Devil's death is mine.
- "Good" and "lazy" are the controllers above; a human may find stronger or weaker builds. Good builds range 18–20 jars across three seeds on every level, so the three-star margin is thin on Radioactive Ridge. Mono-tower builds with active hero play can win (table above), TP Launcher alone three-starring Mint Mews and Rare Row.
- Legend hero balance is checked for crashes and rough strength only (the #1884 ultimate costs a jar per use). A legend boss may wait for its art if the network is slow; the rest of its wave waits too.
- Endless face slots are recycled first-in first-out, so a very long run can show a stale portrait on an old enemy.
- `hero-*@2x` use depends on the art inventory glob; a missing set quietly falls back to 1× parts.
- The share card's date line is the player's local date, while "Daily #n" is the UTC day.
