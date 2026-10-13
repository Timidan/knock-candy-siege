# Candy Siege: Knock's tower-defence mode

> **This is the design doc from 12 Oct, kept for history.** It was written when Siege was a mode beside the street game. Since 13 Oct the street game is dropped, so the parts that depend on it were not built: crew passives, street bonuses, and earning $KNOCK in the street. Some other details also changed. For what actually shipped, read the [README](../README.md) and the [player guide](HOLDERS.md).

Working title. A single-player tower defence in Chog Town, played in the browser by anyone, with or without a Chog. It sits beside the live multiplayer street, which launches on Monad mainnet as planned. Siege needs no contract change to Knock.

**The bar:** it plays and feels like a polished commercial tower defence (Kingdom Rush is the reference). That means smooth 60 fps on a mid-range phone, abundant animation and feedback, real sound, clear onboarding. Nothing sloppy ships: a feature that isn't polished is cut, not shipped rough.

## The fantasy
It's Halloween night. Waves of trick-or-treaters march through Chog Town to raid the candy jars on your porch. Every trick-or-treater is a real Chog from the collection, in a crew costume. You hold the porch with candy-powered defences and your own Chog as the hero.

## Why the Chog NFT is essential
- **Your hero is a Chog.** A holder plays their own Chog. A guest picks any of the 1,969, or a random one. The hero's perks come from its real traits (table below). Holders get **Home advantage**: their own Chog starts one hero level higher and wears a gold frame.
- **Every enemy is a real Chog.** The face on each costume is a real portrait. Its real traits add modifiers: laser eyes stun a tower, a crown buffs neighbours, a gold tooth drops double candy, a skull revives once.
- **The 10 legendary 1:1s are bosses,** and the Great Pumpkin is the final boss.
- **The levels are Chog Town's neighbourhoods** (the background-colour neighbourhoods of the live game).

## Core loop (borrowed from what works)
- **From Kingdom Rush:** fixed build pads along a path. Four tower families, three levels each, then a choice of two specialisations. A movable hero. Two spells on cooldowns. Calling the next wave early earns candy. Each level is rated one to three stars. There's an encyclopaedia, and a card introduces each new enemy.
- **From Bloons TD:** enemy properties that demand a counter. Ghosts are invisible until revealed, pumpkins are armoured, bats fly. Satisfying pops. 1×/2×/3× speed.
- **From Plants vs Zombies:** personality, humour, and onboarding that teaches one idea at a time.
- **From Orcs Must Die:** placeable traps on the path itself.
- **From Clash Royale:** emotes with big readable animation and sound.

**Resources:**
- **candy:** earned from enemies and waves; spent on towers, upgrades and traps during a level;
- **candy jars:** lives, 20 per level; an enemy reaching the porch steals jars;
- **stars:** earned per level, and spent on permanent upgrades;
- **$KNOCK:** spent in the shop (see below).

## Content for launch (the vertical slice)
### Towers
Each tower family has 3 levels, then 2 specialisations:

| Tower | Role | Specialisations |
|---|---|---|
| Egg Stand | fast, single target | Rotten Egg (poison stack) · Golden Yolk (crits) |
| TP Launcher | arcing splash, slows | Mummy Wrap (stun) · TP Tornado (pulling vortex) |
| Haunted Lantern | magic bolt, **reveals ghosts**, ignores armour | Will-o'-Wisp (chain) · Moon Beam (piercing line) |
| Pumpkin Patch | spawns pumpkin guards that block the path | Jack Knights (tough) · Vine Snare (root) |

### Traps
Bought per level and placed on the path:
- **Pumpkin Trap:** a stun burst;
- **Candy Bowl:** a lure; enemies stop to eat, except those that see through it;
- **Bubblegum Puddle:** slows.

### Enemies
Costume bodies, with a real Chog face:

| Enemy | Trait |
|---|---|
| Trick-or-Treater | basic |
| Ghost Sheet | fast, invisible unless a lantern sees it |
| Witch | heals neighbours, blinks forward |
| Pumpkin Head | armoured: eggs bounce off, splash and magic work |
| Bat Wings | flies over the path; guards can't block it |
| Mummy | splits into two minis |
| Candy Goblin | very fast; steals 3 jars |
| Skeleton Crew | swarms of five |

### Bosses
- **The 10 legendary 1:1 Chogs:** each is a boss with a signature move (`app/public/siege/legends.json`), and a hand-made hero kit for its holder. Each wears a costume that continues its portrait's art, at 1.8× scale as a boss:

| # | Legend | Weapon · special · ultimate | As a boss |
|---|---|---|---|
| 561 | Ember | Fireball · Flare Up · Wildfire | burning footprints |
| 900 | Hellfire Skull | Chain of Flames · Bone Shield · Hell Ride | dashes ahead, revives once |
| 942 | The Scream | Echo · Existential Dread · The Scream | towers miss half their shots |
| 1002 | Brainz | Brain Toss · Shamble · Rise Again | raises fallen enemies |
| 1481 | Pepe | Tongue Lash · Feels Bad · Rare Pepe | leaps down the road |
| 1514 | Manga | Ink Slash · Speed Lines · Final Panel | stops time for your towers |
| 1667 | Seraph | Holy Bolt · Halo · Judgement | shields nearby enemies |
| 1798 | Gladius | Spear · Shield Wall · Phalanx | blocks the next five hits |
| 1881 | Midas | Gold Flick · Golden Touch · Midas Rain | turns two towers to gold |
| 1884 | Lil' Devil | Trident · Imp Swarm · Deal With the Devil | steals three jars, calls imps |

- **The Great Pumpkin:** the final boss. It rolls, splits into three at half health, and calls a last wave near the porch.

### Hero
Your Chog:
- tap a spot to move it;
- it auto-attacks;
- it has one active ability and one passive, both from its traits;
- it levels up within a level.

### Spells
- **Candy Rain:** an area bomb;
- **Boo!:** fear; enemies run back for 2 seconds.

### Levels
- **six levels,** each a neighbourhood with its own illustrated map and twist;
- **an endless mode;**
- **a daily seeded challenge** with a share card.

### Emotes
Eight hero emotes on an emote wheel: Boo!, Trick!, Treat?, LOL, Taunt, Heart, Cry, GG. Enemies auto-emote:
- when hit hard;
- when they steal candy;
- when a boss enters.

## Trait → effect (from the real metadata)
- **Enemy modifiers:** each enemy shows up to two modifiers as icons, tappable for a tooltip. For example:

| Trait | Enemy modifier | Hero perk |
|---|---|---|
| Aura: Burning / Fiery | Burning: immune to slow | eggs ignite |
| Aura: Aqua | Slippery: no knockback | splash on hit |
| Aura: Smoke | 20% dodge | short smoke-bomb blink |
| Aura: Wind | +20% speed | +15% move speed |
| Eyes: any laser | zaps a tower (1 s stun) | ultimate: laser sweep |
| Eyes: Gradient visor / Anime Glass | sees through lures | reveals ghosts in a radius |
| Head: Crown | +armour to neighbours | nearby towers +10% damage |
| Head: Wizard Hat | blinks forward | spell cooldowns −15% |
| Mouth: Gold Tooth / BTC Coin / Mon coin | drops 2× candy | +10% candy income |
| Mouth: Bubblegum | gum puddles slow guards | attacks slow |
| Mouth: Drooling | steals 2 jars | heals by eating dropped candy |
| Accessory: Knife | shreds guards | crit attacks |
| Accessory: Fwog / PEPE | survives one lethal hit | revives once per level |
| Accessory: Green / Red Candle | pumps and dumps its speed | random 2× damage bursts |
| Form: Skull | revives once | undead: immune to fear |
| Base: Radioactive | poison aura | poison attacks |
| Skin: Metal | armoured | tanky hero |
| Tier: Rare / Epic | elite: +50% / +100% HP and candy | +1 / +2 starting hero level |

- **Guests and holders:** guests' borrowed Chogs get the same perks. A holder's own Chog adds Home advantage.

## Your Chog's kit (every trait does something)
**1,610 distinct kits across the 1,969 Chogs.** The mapping is data (`app/public/siege/kits.json`, built by `art/siege/kits.py`), and every trait value is assigned.

| Slot | Trait | Families |
|---|---|---|
| Weapon (basic attack) | Body, 97 outfits | Pitch Deck (suits: a fan of business cards), Scepter Bolt (robes), Ball & Chain (prison stripes, Squid Game), Fastball (jerseys, tank tops), Slingshot (hoodies; electric ones chain-zap), Mascot Slam (duck, shark, banana, dragon, toad and mummy suits, each with its own twist), Egg Lob (shirts; fire shirts burn), Junk Toss (homeless outfits: random junk), Pellet Blaster (jackets), Paper Fan Gust (Chinese and yukata), Ray Gun (astro, sci-fi), Anime Beam (Gojo, Guko only), Tickle Slap (no outfit) |
| Special (tap) | Eyes, 58 | Laser Sweep (fire burns, green poisons, cyan freezes, purple pierces), Target Lock (visors, VR), Deal With It (glasses: a stun), Tear Flood (crying), Charm (heart eyes), Play Dead (dead, XD), Stare Down (angry, mog, smirk, side eye), Confetti Bomb (clown eyes), Pep Talk (everything else: towers speed up) |
| Ultimate | Aura, 22 | Candy Corn Meteor (fire), Tidal Wave (aqua), Twister (wind), Vanishing Act (smoke), Arcane Storm (purples, royals), Bloom (mint, green: refills jars), Love Bomb (rose, pink), Purify (yellow, white, clean), Thunder Chain (electric), Candy Bomb. **No aura (995 Chogs): the home neighbourhood's colour picks the ultimate** (`assign.Background` in `kits.json`), so they spread across all ten |
| Passive | Mouth, 15 | Money Mouth (gold tooth, coins), Sticky (bubblegum), Rainbow Trail (rainbow puke), Sweet Tooth (drooling), Honk (clown), Tough (lip bite, grit), Pity (sad, worried), Cheerful |
| Headgear perk | Head, 66 | Royal Command (crowns, wreaths, thorns), Spellcraft (wizard hats, 3rd eye), Hellfire (horns), Armored (Spartan, plumber, robber, mafia), Bucket Shield (bucket hats), Focus (hair, headbands), Chill (Russian hat, peace caps), Prankster (clown nose), Oddity (taped banana, poison shroom, 8-ball, blue laser), Degen Luck (the crypto caps) |
| Trinket | Accessory, 9 | Lucky Frog (Fwog, PEPE: revive), Lucky Coin, Snack Bag (SB), Smoke Puff (cigar), Pump (green candle), Dump (red candle), Heart, Shiv (knife) |
| Quirks | Skin, Form, Base, Tier | Metal skin is armoured, Jade is lucky, Multi Colored gets a random buff each wave. Skull form is undead (revives, fearless). Radioactive base is toxic. Rare and Epic start higher. **The 10 legendary 1:1s get hand-made golden kits** (their own weapon, special and ultimate, named for the Chog) |

**Examples from the real collection:**
- **#7** (Red Tuxedo, Teary, Rainbow Puke, Wizard Hat): throws a Pitch Deck, floods the path with Tear Flood, leaves a Rainbow Trail, casts 20% faster; signature emote Rainbow Barf.
- **#61** (CEO Vest, fire laser, Pink Mist): Laser Sweep that burns, and a Love Bomb ultimate.
- **#1** (143 Jersey, BTC Glass, Fwog): a bouncing Fastball, the Deal With It stun, and a Lucky Frog revive.

**Enemies use the same traits** as modifiers (the table above), so a wave of real Chogs is a wave of different threats. Their kits flavour their attacks on towers too: a laser-eyed Chog zaps, a Knife Chog shreds guards.

## Signature emotes (one per Chog, plus 8 for everyone)
- **Every Chog has a signature emote from its mouth or eyes:** Rainbow Barf, Bubble Pop, Bling, Coin Flip, Drool, Honk Honk, Flirt, Sob, Grr, Heart Eyes, Laser Blink, Faint, Waterworks, Scan, Deal With It, Steam, Side Eye and Giggle (18 kinds).
- **How they're drawn:** they play *on the real portrait*, with effects pinned to the face points we already measured for the live game (`art/anchors.json`, per side). The rainbow comes out of that Chog's actual mouth. The 10 legendaries have one-of-a-kind faces with no measured points, so they get hand-made emotes with their golden kits.
- **When they play:**
  - the hero uses its signature from the emote wheel, next to the 8 universal emotes;
  - enemies fire theirs when hit hard, when stealing candy, or when a boss enters;
  - the result card shows it.
- **$KNOCK emote packs** add more universal emotes and fancier versions.

## Animation system
- **A puppet rig for heroes (and, later, bosses).**
  - The Chog portrait is the head, masked into a circle, on a neck pivot. It sits on a costume body built from parts: torso, two arms, two legs, a held weapon, and costume extras (cape, tail, fins, float ring).
  - There are 18 costumes: one per weapon family, plus six mascot suits. The Chog's own skin colour tints its hands and feet.
  - The clips are data (`atlas/rig.json`), so one rig animates all 1,969 faces at no per-Chog art cost.
- **Frame animation for enemies:** six-frame walks, a hurt frame and a three-frame pop into candy, with the real portrait in the costume's face window. Frames cost less than a rig when 60 enemies are on screen.
- **Hero states:** idle breathe, walk, run, attack (one per weapon family), cast special, ultimate pose, hurt, faint, revive, victory dance, emote.
- **Enemy states:** walk, run, hurt, die (pops into candy), plus a special per type (witch blink, mummy split, bat dive, goblin grab).
- **Towers:** idle, attack anticipation and release, an upgrade transformation (shake, poof, bigger), and a level-3 flourish. Guards march, fight and cheer.
- **The world:** swaying trees, flickering lamps, drifting fog, fireflies, bats crossing the moon, and interactive props with their own animations. The UI springs, counters roll, and panels slide.

## Maps and their mechanics
| Map | Twist | Tap-to-use prop |
|---|---|---|
| 1 Rosie Row (tutorial) | one road | knock over a street lamp onto enemies (once) |
| 2 Lemon Lane | two roads merge at a candy shop | the shop sells a 10 s sugar rush (towers +speed) |
| 3 Mint Mews | a canal; bats fly straight over the water | raise a drawbridge to reroute the march |
| 4 Mon Manor | two haunted portals teleport enemies | ring the manor bell: everyone stunned for 2 s |
| 5 Radioactive Ridge | toxic pools speed enemies up; glowing pads boost towers | open the sewer grate: enemies drop in and come back later |
| 6 Rare Row (finale) | darkness: only lantern light shows enemies; legendary bosses, then the Great Pumpkin | light the bonfire: reveal everything for 20 s |
| Endless: Town Square | paths rotate every 10 waves | all props, on longer cooldowns |
| Daily | the live game's themed night as a modifier (Blood Moon: faster enemies; Candy Rain: double candy; Costume Night: random costumes) | the map of the day |

## Weapons
- **Towers:** the four families with specialisations, plus five special towers unlocked with stars or $KNOCK. These are the Bat Roost (anti-air swarm), Witch's Cauldron (potion splash), Candy Corn Catapult (siege), Ghost Lighthouse (a sweeping reveal-and-fear beam) and Haunted Organ (sound-wave knockback).
- **Hero weapons:** the 13 trait families above.
- **Consumables,** bought in a level: Pumpkin Bomb, Holy Water (hurts ghosts), Garlic Cloud, Giant Candy Cane (blocks the road for 8 s) and a Scarecrow decoy.

## Deeper mechanics
- **Hero talents:** at hero levels 2 to 5, pick one of two upgrades that change your kit, for example a Laser Sweep that splits in two, or a Rainbow Trail that heals guards.
- **Combos:**
  - a TP-wrapped enemy hit by an egg gives an "eggsplosion" (double splash);
  - burning plus a candy bowl makes a caramel trap (stun);
  - charmed enemies fight your guards' targets.
- **Crew passive:** if your own Chog joined a crew in the live game, its crew passive applies. Ghosts dodge, Witches cast faster, Pumpkins' guards are tougher, and Bats hit flyers harder. It's read live from the Knock contract.
- **The live street feeds Siege:** your house's on-chain state gives a starting bonus. A set trap is a free Pumpkin Trap, and a stocked bowl gives extra candy. What holders do in the live game pays off here.
- **Bosses:** each legendary has a signature move and two phases. The Great Pumpkin rolls, splits and calls minions.

## Onboarding
- **Level 1 is an interactive tutorial,** with arrows, highlights and one action at a time. It covers: build an Egg Stand on the glowing pad, start the wave, upgrade, place a trap, cast Candy Rain, move your hero, and use an emote.
- **A card introduces each new enemy** the first time it appears, the Kingdom Rush way.
- **Tooltips** appear on every tower, enemy and modifier icon.

## Feel (the polish list)
- **Characters:**
  - squash and stretch, anticipation and overshoot on every unit;
  - walk cycles of at least 6 frames;
  - idle animation on every tower;
  - a hit flash and knockback on every hit.
- **Feedback:**
  - damage numbers;
  - candy bursts that fly to the counter;
  - screen shake (it respects reduced motion);
  - a slow-motion beat on boss kills;
  - star confetti.
- **Atmosphere:**
  - parallax background layers, fog, fireflies and falling leaves;
  - each neighbourhood has its own palette and props.
- **Sound:**
  - music: a spooky-fun loop per world, plus a boss theme;
  - effects for throws, splats, coins, UI, emotes and wave horns;
  - a mute button and volume slider; audio starts on the first tap.
- **Performance:**
  - 60 fps on a mid-range phone, with all sprites in atlases;
  - object pools for enemies, projectiles and particles;
  - particle caps; device pixel ratio at most 2;
  - a lite setting halves particles.

## $KNOCK shop
- **The currency:** $KNOCK is a testnet token on vibe/vibe (Robinhood Chain Testnet). Holders earn it in the live street; anyone can buy it on vibe/vibe's testnet curve.
- **The contract:** a small `KnockShop` contract on Robinhood Chain Testnet sells items for $KNOCK.
  - $KNOCK supports EIP-2612 `permit`, so a purchase is one signature plus one transaction: `buyFor(buyer, item, deadline, v, r, s)`.
  - Ownership lives on-chain (`owned(address, item)`), so it follows the wallet across devices.
  - The relay sends a little test ETH for gas along with a holder's first $KNOCK payout.
- **What it sells:** cosmetics and convenience, never raw power. Hero costumes (the four crew costumes plus legendary skins), tower skins, emote packs, a fifth tower family (Bat Roost), extra level themes, and a small one-time starting-candy pack.
- **No payouts for Siege:** Siege never pays out $KNOCK, because scores from a browser can be faked. $KNOCK flows in from the on-chain game and out to the shop.

## Tech
- **The engine:** Phaser 3.90.0, as an app dependency.
  - Lazy-loaded only for this mode, from a "Candy Siege" card on the start screen and `?siege`.
  - The code lives in `app/src/siege/`. React handles menus, the shop and overlays in the sticker style; Phaser handles the world and in-world UI.
- **Content as data:** levels (path splines, pads, waves), towers, enemies and modifiers live in typed config, so new content needs no code.
- **Art:** SVG sources in `chogathon/art/siege/`, rendered offline into texture atlases in `app/public/siege/` (Phaser JSON Hash format, with named frames). Chog faces come from the existing 256px thumbnails and are masked into a circle in each costume.
- **Saves:** localStorage holds stars, unlocks and settings; shop items are read from the chain.

## Schedule (build ends Thu 22 Oct, 15:00 UTC)
| Day | Work |
|---|---|
| Mon 12 | This doc; astra starts the engine core and art batch 1 in parallel; the trait-kit data |
| Tue 13 | Batch 2: the hero kit system with the puppet rig, signature emotes, talents and combos (engine); rig parts, weapon, special and ultimate effects, emote effects, and maps 2–3 (art); first phone playtest |
| Wed 14 | Batch 3: maps 4–6, endless and daily, props, special towers, consumables, bosses and legendary kits, the shop UI and `KnockShop` on testnet, the crew and live-street links; the feel pass |
| Thu 15 | Performance pass and bug bash; holder testers try it |
| Fri 16 | Mainnet deploy of the live game; Siege published alongside |
| Sat 17–Sun 18 | Polish from tester feedback; launch both |
| Mon 19–Wed 21 | Video (Siege is the hook), README, submit |

## Done means
- **The first time:** a first-time visitor on a phone plays the tutorial level to victory in under 5 minutes, without help, at 60 fps.
- **Content:** six levels, four tower families with specialisations, eight enemies plus bosses, hero, spells, traps, emotes, sound, and saves.
- **Traits:** a holder's own Chog visibly plays differently from a random Chog because of its traits.
- **The shop:** works end to end on Robinhood Chain Testnet with a permit signature.
- **Nothing rough:** no placeholder art, no console errors, and no frame drops below 50 fps on the test phone.
