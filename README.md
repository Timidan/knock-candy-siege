# Knock: Candy Siege

Knock: Candy Siege is a Halloween tower-defence game that runs in a phone or desktop browser, made for Chogathon 2026. You defend a porch of 20 candy jars with a Chog Genesis NFT as your hero, against waves of trick-or-treaters who are also real Chogs, and each Chog's on-chain traits decide how it fights.

- **Play now:** https://knock.timidan.xyz. It's free and needs no wallet. Hold your phone sideways.
- **Trailer:** TRAILER_URL
- **Live stats:** https://knock.timidan.xyz/stats

## The 30-second judge path

1. Open https://knock.timidan.xyz and tap **Hold the porch →**.
2. Pick **Rosie Row** (marked "Start here").
3. Choose a hero on "Who's on porch duty?":
   - type any Chog number from 1 to 1,969, or tap **Random**;
   - or tap **Try as a holder**. You get a real Chog and 1,000 $CHOG on a sandbox copy of Monad, held by a testnet guest wallet that the page makes for you. No extension or sign-up.
4. Tap **Let's make mischief →**. Your first Rosie Row is a 7-step tutorial; **SKIP** is on the tutorial card.
5. At the start of the level, the **CHOG #… · TRAITS ACTIVE** card lists the perks that come from your Chog's real traits.

## Why the NFT is essential

Take the Chogs out and nothing is left to play: the collection's trait data is the game's rule table. It decides the heroes, the enemies, their modifiers and the bosses.

- **All 1,969 Chogs are playable.** Type any token number from 1 to 1,969. **Random**, the default hero and the holder demo skip the 312 Chogs whose cap or shirt carries crude text. Those 312 are still playable by number.
- **Each Chog's real traits become its kit.** Every trait value maps to something, and all 1,969 Chogs get a full kit:

  | Trait | Becomes | Families |
  |---|---|---|
  | Body | the weapon (basic attack) | 13, from Pitch Deck (suits) to Anime Beam |
  | Eyes | the special ability | 9; laser colours change the effect |
  | Aura | the ultimate | 10; Chogs with no aura get one from their background colour |
  | Mouth | the passive perk | 8 |
  | Head | the headgear perk | 11 |
  | Accessory | the trinket | 9, including none |
  | Skin, Form, Base, Tier | quirks | Metal is armoured; Skull revives once; Radioactive poisons; Rare, Epic and Legendary start 1, 2 or 3 hero levels higher |

  The six main slots give **1,766 different kits** across the collection. The 10 legendary 1:1 Chogs get hand-made kits. Each Chog also has a signature emote from its mouth or eyes (18 kinds), played on its own portrait.
- **Talents follow the traits.** At hero levels 2 to 5 you pick one of two cards. One improves what your traits gave you: the weapon at level 2, the special at 3, the passive or headgear at 4 and the ultimate at 5. The other is a general upgrade.
- **TRAITS ACTIVE at level start.** A card titled "CHOG #<id> · TRAITS ACTIVE" shows the passive, headgear, trinket and skin perks with what each does. It then shrinks into the hero portrait. The perk badges stay at the top left; tap one to read it again.
- **Enemies are real Chogs.** Each trick-or-treater wears a costume with a randomly chosen real Chog's face, and that Chog's traits become modifiers. Laser eyes stun a tower for 1 second, a Crown armours nearby friends, a Gold Tooth drops double candy, a Skull form revives once, and Rare or Epic Chogs have 50% or 100% more health and candy. There are 18 modifiers. Tap an enemy to see its Chog number and its modifiers.
- **The 10 legendary 1:1s are bosses,** each with its own move. The Great Pumpkin is the final boss.
- **Home advantage.** Connect the wallet that holds a Chog. The game checks `ownerOf` on Monad, and your own Chog starts one hero level higher and wears a gold frame.
- **The $CHOG holder perk.** If the connected wallet holds any $CHOG on Monad, you start each level with 25 more candy and earn 10% more candy from kills. The game only reads the balance; nothing is spent.
- **"Try as a holder" for judges.** One tap gives the browser's guest wallet a random real Chog, 1,000 $CHOG and 1 MON on a fork of Monad mainnet. You then play with Home advantage and the $CHOG perk. The screen says "Sandbox: a demo copy of Monad, nothing is real", and the sandbox resets every night at 00:05 UTC.

## Features

- **Six story levels,** all open from the start: Rosie Row, Lemon Lane, Mint Mews, Mon Manor, Radioactive Ridge and Rare Row. Each map has its own twist (two roads, a canal bridge, portals, toxic pools, darkness) and a prop you tap, such as a street lamp to knock over or a manor bell to ring.
- **Endless mode** on Town Square: a new road every 10 waves, and a boss every 10th wave.
- **A daily challenge** seeded by the UTC date. It picks one of the six maps and a night: Quiet night, Blood Moon (faster enemies), Candy Rain (double candy) or Costume Night (enemy types shuffled).
- **Towers:** four families (Egg Stand, TP Launcher, Haunted Lantern, Pumpkin Patch), each with three levels, two specialisations and two more ranks. Four special towers unlock with stars. A fifth, the Bat Roost, is listed in the shop but not on sale yet.
- **Enemies:** eight types plus the mummy's two minis. Ghosts are hidden, pumpkins resist eggs, bats fly, goblins steal three jars, witches heal, mummies split and skeletons come in fives. In Witching Hour waves, ghosts and bats pour in from the screen edges.
- **Your hero:** move it, let it auto-attack, and use its special and ultimate. It levels up during a level, and you pick talents. Emotes: 8 for everyone plus your Chog's signature.
- **Also:** two spells (Candy Rain, Boo!), three traps, five supplies, 1×/2×/3× speed, and a field guide.
- **Teaching:** a tutorial with a pointing glove, a card for each new enemy, one-time rule callouts ("ARMOURED", "FLYING"), a preview of the next wave's path, and a porch alarm when a jar is stolen.
- **Feedback:** hit flashes, BLOCK!, CRIT!, MISS and TINK pops, candy flying to the counter, a letterboxed boss entrance, and a star-slam result screen.
- **Sound:** menu, level and boss music, and a sound for every event. Audio starts on the first tap.
- **Sharing:** a 1080×1350 share card with your Chog, stars and score, and a public stats page with a community goal of 100,000 monsters stopped.
- **The $KNOCK shop** (testnet): dances, crew costumes, golden towers, a crypto emote pack and +50 starting candy. Cosmetics and convenience only.
- **Settings:** music and effects volume, Lite mode, screen shake, vibration (Android), full screen on Play, golden towers and a stats opt-out. Reduced-motion preferences are respected.

## How it's built

- **Stack:** Vite, TypeScript, **React 19** for menus, the shop and overlays, **Phaser 3.90** for the game world and the in-game HUD, and viem for chain reads and testnet purchases. Gameplay runs entirely in the browser, with no game server. Scores and progress are saved in the browser.
- **A deterministic simulation.** The game advances in fixed 1/45-second steps, and one seeded random stream drives all gameplay. Visual randomness uses a separate stream, so effects never change the outcome. Every gameplay input goes through one `command()` entry point. A 1,800-tick seeded replay stayed byte-identical before and after each of today's combat, teaching, polish and taste passes. This is the base for the planned two-player co-op.
- **Content is data.** Towers, enemies, waves, traps and spells are typed config in `app/src/siege/data/`. Maps are JSON exported from the art pipeline. `kits.json`, `traits.json` and `legends.json` map the collection to the rules.
- **Art:**
  - The hero is a puppet rig: a costume body with the real Chog portrait as its head, so one rig animates all 1,969 faces.
  - Enemies are frame-animated costumes with the portrait in a face window.
  - Python scripts build the texture atlases offline from SVG sources. They live in a separate `art/` folder, not in this repository; the built atlases are here.
- **Performance:** pooled sprites and capped effects. A quality governor drops ambience, then half the effects, then render resolution when the frame rate falls below 55 fps. It steps back up after 10 seconds above 58 fps. The Lite mode setting turns off ambience and halves the effects.
  - **Measured:** about 60 fps (56.5 to 60.0 fps across today's runs, 95th-percentile frame 16.8 ms) with 60 enemies and 12 towers firing. That was in Chrome on an Intel Iris Xe laptop GPU, at a phone-sized 844×390 viewport and DPR 3.
  - **Not yet measured:** a physical phone.

## On-chain pieces

The shop and $KNOCK are on **Robinhood Chain Testnet**. $KNOCK is a testnet token with no real value, and **nothing in the game pays out**. Playing never earns $KNOCK, because a score from a browser can be faked. On Monad the game only reads; it never writes.

| Piece | Chain | Address | What the game does with it |
|---|---|---|---|
| Chog Genesis (ERC-721) | Monad mainnet (143) | `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` | Reads `ownerOf` for Home advantage and **My Chog**. Traits and portraits come from a snapshot of the collection. |
| $CHOG (ERC-20) | Monad mainnet (143) | `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` | Reads `balanceOf` for the holder perk. |
| $KNOCK, "Knock candy" (ERC-20 with EIP-2612 `permit`) | Robinhood Chain Testnet (46630) | `0x2Ae41145A6acB58d4457c49df27ab6BFEF618492` | Spent in the shop. The shop links to its page on vibe/vibe, a testnet token launchpad. |
| KnockShop | Robinhood Chain Testnet (46630) | `0xc52dfedAf158031fd7b5fAe0A2F1CFB6c1aC89b6` | Sells items for $KNOCK. Ownership is on-chain (`owned(address, item)`), so it follows the wallet. |

- **Buying:** one `permit` signature for the exact price, then one `buyFor` transaction. If the shop already has enough allowance, only the transaction is needed.
- **The Candy Bank starter grant:** 300 $KNOCK and 0.0005 test ETH for gas, once per wallet. The claim is queued by a Cloudflare Worker, and an outbound relay pays it on Robinhood testnet.
- **Wallets:** a guest wallet (a key made and kept in the browser, for testnet only) can claim the grant and buy items without an extension. A browser wallet works too.

## Services

| Service | Where | What it does |
|---|---|---|
| Candy Bank | `worker/`, a Cloudflare Worker with D1, https://candy-bank.timidan-knock.workers.dev | Queues starter-grant claims: one per address ever, and three new claims per IP per UTC day. |
| Grant relay | `relay/`, a Node service with no inbound ports | Polls the Candy Bank every 10 seconds and pays queued claims: 300 KNOCK, then 0.0005 ETH. It pays at most 60 grants an hour, pauses when funds run low, and saves each signed transaction before sending it. |
| Holder sandbox | `sandbox/`, an anvil fork of Monad mainnet behind a JSON-RPC filter, https://sandbox-rpc.timidan.xyz | `POST /holder` gives the caller a random Chog, 1,000 CHOG and 1 MON on the fork. One grant per address per fork and five attempts per IP per hour. It resets nightly at 00:05 UTC. |
| Live stats | `stats/`, a Cloudflare Worker with D1, https://siege-stats.timidan-knock.workers.dev | Counts anonymous play events for `/stats`. |
| Hosting | Cloudflare Pages | Serves https://knock.timidan.xyz. |

**What the stats collect:** each browser gets a random id. No wallet or IP address is stored; a salted IP hash is kept for one day to stop spam. Players can opt out in Settings, and automated browsers never send.

## Running locally

You need Node.js 20.19 or newer and, for the portraits, ImageMagick (`magick`).

```sh
cd app
npm install
# The Chog portraits are not in git. Fetch them once from IPFS (the script resumes if stopped),
# then make the 256 px copies the game loads.
node scripts/snapshot.mjs images   # 512 px portraits into public/chogs/
node scripts/thumbs256.mjs         # 256 px copies into public/chogs-256/
npm run dev
```

- **Dev mode:** `npm run dev` doesn't read `app/.env.production`, so the shop is preview-only, the starter grant is hidden and stats are off.
- **Builds:** `npm run build` reads `app/.env.production`, which sets `VITE_KNOCK_SHOP`, `VITE_CANDY_BANK_URL` and `VITE_STATS_URL`. `npm run preview` serves the build.
- **Optional overrides:** `VITE_RPC_URL` (the Monad RPC, default `https://rpc.monad.xyz`), `VITE_SHOP_RPC_URL`, `VITE_HOLDER_RPC_URL` and `VITE_HOLDER_URL`.
- **Debug view:** add `?siegeStats` to the URL to see fps, draw calls and texture memory in the game.
- **Checks:** `npx tsc -b`, and `node --experimental-strip-types scripts/rig-check.mts`, which checks all 1,969 kits, the rig poses, the seeded world, the maps and the bosses.
- **Contracts:** the Solidity libraries aren't in git. In `contracts/`, run `forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts`, then `forge test`. The deployed build used forge-std 1.17.0 and OpenZeppelin Contracts 5.7.0.

## What's in the repository

| Folder | Contents |
|---|---|
| `app/` | The game. `app/src/siege/` is the game itself; `app/src/stats/` is the stats page. |
| `contracts/` | Foundry. `KnockShop.sol` is deployed on Robinhood testnet. `Knock.sol` belongs to the dropped street game and was never deployed to mainnet. |
| `worker/`, `relay/`, `stats/`, `sandbox/` | The services above. |
| `archive/street/` | The original Knock street game, which was dropped on 13 Oct. |
| not included | The SVG art sources and the Python scripts that build the atlases. They are in a separate `art/` folder. |
| `docs/` | The [player guide](docs/HOLDERS.md), a [phone test checklist](docs/PHONE-TEST.md), and the 12 Oct design doc ([SIEGE.md](docs/SIEGE.md)). |

## Credits

- **Chog art and traits** come from the Chog Genesis collection (`0xc96d…3763` on Monad). The game reads them and never changes them. Portraits are fetched from the collection's IPFS images.
- **Audio** is all CC0 (public domain). It is credited with thanks, not as a licence condition.
  - **Sound effects:** Kenney ([kenney.nl](https://kenney.nl)): Interface Sounds, Impact Sounds, UI Audio, RPG Audio, Music Jingles and Casino Audio.
  - **Music,** from OpenGameArt.org:
    - "Halloween Hullabaloo" by starlightfrost (levels);
    - "A Wonderful Nightmare" by spiderdave (bosses);
    - "Caper" by pro-sensory (menus);
    - "Ghosts in the Machine" by ruskerdax (included, not currently played).
- **Fonts:** Luckiest Guy and Patrick Hand, from Google Fonts.
- **Built with** Phaser, React, Vite and viem.
