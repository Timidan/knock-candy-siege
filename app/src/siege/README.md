# Candy Siege · engine batches 2a–3b

Batch 3b adds five special towers and their unlocks, a second build-ring page, five consumables, holder street bonuses before each level and a capped sound mix with music ducking. See [BATCH3B.md](BATCH3B.md) for rules, measurements and verification limits.

Batch 3a adds levels 4–6, legend bosses and the Great Pumpkin, Witching Hour swarms from every edge, Endless on Town Square, the Daily, legend heroes and sharp `@2x` showcase heroes. See [BATCH3A.md](BATCH3A.md) for the rules, measured balance, memory and limits.

Batch 2b adds three levels, branching towers, new enemies, map props, ambience and seeded commands. See [BATCH2B.md](BATCH2B.md) for balance and memory measurements.

Batch 2c adds focused tutorial input, the $KNOCK shop, body dances, victory showcases and local PNG share cards. See [BATCH2C.md](BATCH2C.md) for the flow, verification and deployment limits.

Batch 2a adds trait-resolved hero rigs, abilities, talents and signature emotes. See [BATCH2A.md](BATCH2A.md) for every family, balance measurements, verification and the next-batch handoff.

Enter from the Candy Siege sticker on Knock’s start screen, or `/?siege`. Choose **Hold the porch → Rosie Row → a Chog → Let’s make mischief**. Add `&siegeStats` for measured FPS, allocated display-object count, active enemies and actual WebGL draw calls and estimated GPU texture MB (RGBA allocations including text and render targets; excludes driver overhead). The renderer uses a fixed 1920 × 1080 buffer with `Scale.FIT`; it does not multiply resolution by device pixel ratio.

## Content

- `data/config.ts`: `TOWERS[kind]` has a name, description, colour, projectile, three `{cost, damage, range, interval, splash, guards}` levels; `SPECIALISATIONS` defines the eight level-3 branches, followed by two purchasable ranks. `ENEMIES[kind]` supplies health, speed, candy, jars and flying status. `TRAPS` supplies cost, radius, duration and status. `SPELLS` supplies radius, damage and cooldown. Distances are design pixels; times are seconds.
- `data/level1.ts`: `LevelConfig = {id, name, geometry, waves}`. Each wave is `{name, bonus, countdown, groups: [{type, count, interval, delay?, path?}]}`. The countdown starts after that wave’s final spawn; an early call can overlap waves. Each cleared wave pays its bonus once. Rosie Row has six waves; Lemon Lane and Mint Mews each have seven. Skeleton counts are crews of five.
- `/siege/levels/level1..3.json`: the art contract’s `{size, background, paths, fly?, switch?, pads, porch, props, ambient?}` supplies each map. Invalid map exports show a retryable loading error. Paths become equal-distance spline samples. There can be up to 12 pads; the supplied illustrated map currently has eight. Props with a `frame` are rendered separately; the supplied map’s scenery is already painted into the background.
- `data/traits.ts`: the existing enemy modifier rules. Heroes instead use `data/kits.ts`, resolving token IDs through `traits.json`, `kits.json` and `chogs.json`. Body/suit/weapon mod, eyes, aura/background, mouth, head, accessory and skin each have their own slot. Base `1:1` keeps Candy Bomb. Rare/Epic/Legendary start +1/+2/+3 levels; Home adds one more. Skull is fearless and revives once quickly; Radioactive attacks poison.
- `hero/pose.ts` implements the pure rig transform contract. `hero/Rig.ts` builds the Phaser containers, plays release/footstep/landing events, crossfades poses and matches walk cadence to stride. `hero/Hero.ts` owns the kit's combat behavior; `hero/Signature.ts` shares face-anchored signatures between hero and enemies. `data/talents.ts` holds the family and generic level-up choices.
- `TUTORIAL` in `data/level1.ts`: ordered `{action, title, text, target}` steps. Only the current target accepts input. `TutorialFocus.ts` draws the soft spotlight and pauses simulation while waiting; the map and every HUD/keyboard/drag path pass through its gate. The rain lesson gathers two real enemies with towers briefly holding fire. Players can skip it or replay it from hero selection.
- `data/save.ts`: `knock-siege-v1` stores best stars and scores per level, tutorial completion, the selected costume and victory dance, and settings (`music`, `effects`, `lite`, `shake`, `gold`). Existing saves migrate on read. Stars are best-of-run: 18–20 jars = 3, 10–17 = 2, 1–9 = 1; defeat = 0. Storage failures leave the current game playable and show a warning.

Existing enemy/tower families, balance, waves and tutorial wording can change as data. A new mechanic still needs engine code. Winning unlocks the next of the three implemented levels. Stars, scores and discovered field-guide entries persist in the existing save.

## Art and sound

`assets.ts` reads the base atlases plus `kit` and `sig`. Level/hero selection loads the chosen background, `units2` (including specialisation towers), `fx2`, props when used by the map, and only the selected `hero-<costume>`, `special-<family>` and `ult-<family>` atlases. Leaving releases the prepared/run references and destroys the Phaser game and its textures. The combined `atlas/sig.json` supplies both frames and animation definitions. Missing optional base frames allocate one generated fallback atlas lazily; required hero assets show a retryable loading error. Optional geometry fields are validated before play. Real `/chogs-256/<id>.webp` portraits are circularly clipped into a shared runtime atlas; up to 768 distinct faces fit per level in a 2048 × 1536 canvas with 64px tiles. Lite mode uses 1024 × 768 with 32px tiles; the picker canvas is also halved. Restart/reload after an art drop; the Vite inventory is refreshed at development/build time.

`Sfx` starts from the first pointer gesture, throttles rapid duplicate cues, and uses separate effects/music gains. It reads the first variant of each cue and the music path from `/siege/audio/manifest.json`, with the existing optional flat-file fallback. Absent optional audio stays silent. This job creates no audio or art files.

## Play

Tap a pad to open its four tower slots. Tap a tower icon to preview its range, role and cost; tap it again (including the tick) to build. Unaffordable slots still preview, but never spend candy. Tap a built tower to upgrade, sell for 70%, or cycle first/last/strong/close targeting. Build, upgrade, sell and outside taps close the ring. Lanterns reveal ghosts, pumpkins resist eggs, and bats bypass guards and ground traps. Tap the hero portrait and then ground to move; hold the hero to emote. Drag a trap onto the path; candy is charged only on a valid drop. Selecting a trap and tapping the path also works. Select a spell then tap its target area. Escape cancels a selection or pauses.

Keyboard: Space pauses, 1/2 select spells, Q uses the hero ability, R uses the charged ultimate, Z/X choose a talent, E opens emotes, N calls the next wave. The pause menu includes settings, a restart and level select. Switching browser tabs pauses the game. Talent cards at levels 2–5 do not pause; starting-level choices queue, and stay hidden during the tutorial.

Pools cap enemies at 96, projectiles at 128, effects at 96 and bitmap damage numbers at 40; lite mode halves the effect/number budget. A full enemy pool delays spawns instead of dropping them. The 60-enemy/12-tower phone performance target needs a real device playtest; a successful build alone does not establish it.

Out of scope for the world batch: networking, bosses, levels 4–6, endless/daily modes, permanent star upgrades and live shop-purchase verification. The field guide includes the exact score components. Shop code stays in the lazy Siege module graph, with address-scoped ownership cached and refreshed from Robinhood.


## Batch 1.5 HUD handoff

Coordinates are in the fixed **1920 × 1080** design buffer. Round controls below list centre `(x, y)` and diameter. All control hit targets are at least 120 design pixels. Text in play is 34px or larger; Luckiest Guy is the display face, Patrick Hand the body face. Resource counters use fixed-advance bitmap digits. No dependencies or atlas edits were needed.

| Control | Position / size |
| --- | --- |
| Resource plate | Top-left `(24, 24)`, `620 × 116`; jar icon `(74, 81)`, count `(118, 82)`; candy icon `(261, 82)`, rolling count `(307, 82)`; wave `(548, 100)` |
| Speed / pause | `(1696, 88)` / `(1832, 88)`, diameter 128 |
| Hero portrait | `(100, 984)`, diameter 152; hero level at local `(0, 57)` |
| Hero ability / Candy Rain / Boo! | `(266, 984)` / `(416, 984)` / `(566, 984)`, diameter 132 |
| Emote | `(100, 830)`, diameter 124 |
| Ultimate | `(266, 830)`, diameter 132; charge percentage, then ready glow |
| Perks / hero details | Passive, headgear, trinket and skin buttons at `(76 + 126i, 310)`, diameter 120; tap for effect text. HP and quirk labels begin `(24, 152)` |
| Talent card | `(960, 165)`, `720 × 250`; two `340 × 180` hit targets, 34px text |
| Pumpkin / bowl / gum traps | `(1488, 984)` / `(1640, 984)` / `(1792, 984)`, diameter 132; candy badges at local y=58 |
| Call wave | First on-screen sample of each incoming route, inset to x=`84…1836`, y=`84…900`, moved away from resource/perk controls when necessary, diameter 144. Fly routes have their own entrance controls. Rosie Row is approximately `(84, 562)` |
| Wave preview | Beside the tapped entrance; `max(380, 112 × enemy types + 44) × 280`; first tap previews, second tap on entrance calls |
| Build ring | Pad centre clamped to x=`264…1656`, y=`390…640`, with a tether to the pad when shifted. Egg `(-180, 0)`, TP `(0, -180)`, lantern `(180, 0)`, patch `(0, 180)`; diameter 136 |
| Built-tower ring | Upgrade `(-156, -88)`, sell `(156, -88)`, diameter 136; targeting `(0, 180)`, diameter 144; centre close diameter 124 |
| Emote wheel | Hero-relative centre clamped to x=`310…1610`, y=`350…570`; eight diameter-128 buttons on radius 198, with a diameter-160 signature button at the centre; page and Shop buttons sit at local `(-90, 370)` and `(90, 370)` |
| Tutorial | Centre `(1120, 217)`, `1200 × 150`; skip at `(1644, 217)`, diameter 120 |
| Toast | Centre `(1030, 968)`, wrapped text width 710 + 44 padding; at most three lines. Long trait descriptions page in the same sticker, never stack |
| Wave banner | `ui/banner-wave`, `768 × 224`; slides from `(960, -130)` to `(960, 400)`, holds 1.7 seconds, returns |

Cooldowns use a dark radial sector plus whole seconds; wizard cooldown reductions are included in the denominator. Ready controls pulse. Reduced motion removes squash, counter motion, pulse and panel travel, while preserving feedback and the banner hold. Selecting the portrait arms a ground move; the old entire-bottom-strip input exclusion is gone. The playing-screen Knock link is hidden because it overlapped the new controls; it remains available in the pause/menu overlays.

### Tutorial control-path audit

| Step | New control → existing completion call |
| --- | --- |
| Build | Pad 0 → Egg slot preview → second Egg/tick tap → `build('egg')` → `tutorial('build')`; hand moves from pad to Egg slot |
| Wave | Entrance preview → second entrance tap → `callWave()` → `tutorial('wave')` |
| Upgrade | Tower 0 → upgrade slot → `upgrade()` → `tutorial('upgrade')`; hand moves to upgrade slot |
| Trap | Pumpkin button → `selectTrap()` → drag release or path tap → `placeTrap()` → `tutorial('trap')` |
| Rain | Candy Rain button → `selectSpell('rain')` → ground tap → `cast('rain')` → `tutorial('rain')` |
| Move | Portrait → `selectHero()` → ground tap → `moveHero()` → `tutorial('move')` |
| Emote | LOL button (or hero hold) → `toggleEmotes()` → `tutorial('emote')`; selection still calls `chooseEmote()` |

`?siegeStats` retains `window.__siege` in WebGL and Canvas, and clears it on scene destruction. `stats().textureMB` estimates currently allocated RGBA texture storage from Phaser's WebGL texture wrappers. This includes atlas, portrait, text and render-target textures; it is not a measurement of total driver VRAM.

Batch 1.5 used a control-path audit. Batch 2a additionally completed the tutorial through real browser clicks, checked the picker and signature wheel visually, ran fixed-step level simulations and checked the reference poses. Current evidence and limits are in [BATCH2A.md](BATCH2A.md). No physical-phone test, Daily checkpoint, commit or deployment was performed.

## World batch 2b

All gameplay input enters `SiegeScene.command(Command)`: build/upgrade/sell/specialise/target, traps/spells, hero movement/ability/ultimate/emote/talent, wave calls, props and speed. Commands carry a pad index or world coordinates; local selection does not identify a gameplay target. Validation and tutorial gates run at this entry point. The simulation advances in fixed 1/45-second steps. `SceneOptions.seed` creates one gameplay random stream; cosmetic particles and portrait selection in the menu do not consume it. No networking or replay transport is installed.

The bridge stores the chosen route on each enemy. Only marchers before the fork switch routes; enemies on the raised span disappear for six seconds and return on the detour. Flyers retain their fly route. Traps and guards can use the detour. The lamp is single-use; the shop spends 50 candy for ten seconds of 60% faster tower attacks, with a 24-second cooldown; bridge toggles have a 12-second cooldown. Ambient sprites use the map's fog, glow, firefly and leaf placements, plus occasional bats; lite mode skips them.

The field guide uses CSS atlas sprites for enemies, towers, branches, modifiers and every kit family. Unknown entries are silhouettes. First encounters introduce enemy cards, and discoveries persist. Branches preview their effect on the first tap and commit on the second; two more ranks cost 150 and 210 candy. See [BATCH2B.md](BATCH2B.md) for mechanics, measured balance, memory and verification evidence.
