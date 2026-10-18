# Development

Setup, services, contracts and the repository layout for Knock: Candy Siege. The [README](../README.md) covers the game itself.

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
- **Optional overrides:** `VITE_RPC_URL` (the Monad RPC, default `https://rpc.monad.xyz`), `VITE_SHOP_RPC_URL`, `VITE_HOLDER_RPC_URL`, `VITE_HOLDER_URL` and `VITE_COOP_RELAY` (default: the deployed co-op relay).
- **Co-op:** the relay, its deploy and the two-browser checks are in [coop/README.md](../coop/README.md).
- **Debug view:** add `?siegeStats` to the URL to see fps, draw calls and texture memory in the game.
- **Checks:** `npx tsc -b`, and `node --experimental-strip-types scripts/rig-check.mts`, which checks all 1,969 kits, the rig poses, the seeded world, the maps and the bosses.
- **Contracts:** the Solidity libraries aren't in git. In `contracts/`, run `forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts`, then `forge test`. The deployed build used forge-std 1.17.0 and OpenZeppelin Contracts 5.7.0.

## How it's built

- **Stack:** Vite, TypeScript, **React 19** for menus, the shop and overlays, **Phaser 3.90** for the game world and the in-game HUD, and viem for chain reads and testnet purchases. Gameplay runs in the browser, and no server runs the game. In co-op, a relay only orders the two players' inputs and compares state hashes. Scores and progress are saved in the browser.
- **A deterministic simulation.** The game advances in fixed 1/45-second steps, and one seeded random stream drives all gameplay. Visual randomness uses a separate stream, so effects never change the outcome. Every gameplay input goes through one `command()` entry point. A 1,800-tick seeded replay stayed byte-identical across the combat, teaching, polish, taste, world, HUD and sound passes and the co-op integration. Only the 14 Oct balance pass changed it, on purpose. Porch Party is built on this.
- **Lockstep co-op.** In Porch Party, both browsers run the whole simulation from one shared seed, and only inputs and state hashes cross the network.
  - Each command is scheduled for a future tick and sent through a Cloudflare Durable Object, one per room. On every tick, both browsers apply player 0's commands, then player 1's. There is no prediction, rollback or reconnect: if an input is late, both games wait.
  - The input delay is fixed for the whole match. In the lobby, eight round-trip probes set it to `ceil((2 × max RTT + 30 ms) × 45 / 1000)` ticks, between 6 and 45 (133 ms to 1 s), and both players use the larger value.
  - A clock in a Web Worker drives the 45 Hz steps apart from rendering, so the shared game keeps time while a tab is hidden.
  - Every 90 ticks (2 seconds), each browser hashes the gameplay state and the relay compares the two. A mismatch stops the match with "Out of sync: restart together", and the result appears only after the final hashes agree.
  - A talent card pauses combat for both players while network ticks continue, and the card picks the left talent after 450 ticks (10 seconds). A Chog that starts above hero level 1 takes the left card for each starting talent at once, so neither player waits at the start.
  - **Measured** on one laptop with two browsers and 50 ms added each way: a full Rosie Row win took 213 s of wall time for 206 s of game time, with 103 matching checkpoints. A 40-second pacing run lost under 0.5% of its time to waiting. The relay is in `coop/`; its README covers the checks.
- **Content is data.** Towers, enemies, waves, traps and spells are typed config in `app/src/siege/data/`. Maps are JSON exported from the art pipeline. `kits.json`, `traits.json` and `legends.json` map the collection to the rules.
- **Art:**
  - The hero is a puppet rig: a costume body with the real Chog portrait as its head, so one rig animates all 1,969 faces.
  - Enemies are frame-animated costumes with the portrait in a face window.
  - Python scripts in `art/` build the texture atlases offline from SVG sources (see [art/README.md](../art/README.md)). The built atlases are in `app/public/siege/atlas/`.
- **Performance:** pooled sprites and capped effects. A quality governor drops ambience, then half the effects, then render resolution when the frame rate falls below 55 fps. It steps back up after 10 seconds above 58 fps. The Lite mode setting turns off ambience and halves the effects.
  - **Slow connections:** a download fails only when it stalls for 15 seconds or runs past 180 seconds. Finished files are kept for the session, so **Retry** fetches only what failed.
  - **Measured:** about 60 fps (56.5 to 60.0 fps across the 13 Oct runs, 95th-percentile frame 16.8 ms) with 60 enemies and 12 towers firing. That was in Chrome on an Intel Iris Xe laptop GPU, at a phone-sized 844×390 viewport and DPR 3.
  - **Co-op, measured:** with 100 ms of added round trip, the foreground display held 60 fps (95th-percentile frame 16.7 ms) with 60 enemies and 11 towers firing, while the partner's game kept simulating, networking and hashing. Two displays sharing one laptop GPU managed 49 fps each.
  - **Not yet measured:** a physical phone, and co-op between two separate devices.

## Services

| Service | Where | What it does |
|---|---|---|
| Candy Bank | `worker/`, a Cloudflare Worker with D1, https://candy-bank.timidan-knock.workers.dev | Queues starter-grant claims: one per address ever, three new claims per IP per UTC day, and 150 new claims per UTC day across everyone. A rate limiter turns floods away before they reach the database, and IP hashes use a salt that changes daily. |
| Grant relay | `relay/`, a Node service with no inbound ports | Polls the Candy Bank every 10 seconds and pays queued claims: 300 KNOCK, then 0.0005 ETH. It pays at most 60 grants in any hour and 200 in any 24 hours, pauses when funds run low, and saves each signed transaction before sending it. |
| Holder sandbox | `sandbox/`, an anvil fork of Monad mainnet behind a JSON-RPC filter, https://sandbox-rpc.timidan.xyz | `POST /holder` gives the caller a random Chog, 1,000 CHOG and 1 MON on the fork. One grant per address per fork and five attempts per IP per hour. It resets nightly at 00:05 UTC. Its public JSON-RPC is read-only and rate-limited per call, with a gas cap on calls. |
| Live stats | `stats/`, a Cloudflare Worker with D1, https://siege-stats.timidan-knock.workers.dev | Counts anonymous play events for `/stats`. A rate limiter turns floods away before they reach the database, and `/stats` is cached for 30 seconds. |
| Co-op relay | `coop/`, a Cloudflare Worker with Durable Objects, https://knock-coop.timidan-knock.workers.dev | One Durable Object per Porch Party room: two player slots, inputs relayed in a fixed order, and state-hash checks. It knows room slots, not wallets, and runs no game logic. A room closes 10 minutes after it opens if the game hasn't started, and after an hour at most. Each IP can open about 5 rooms and make about 30 join attempts a minute; these limits are approximate and apply per Cloudflare location. |
| Hosting | Cloudflare Pages | Serves https://knock.timidan.xyz, with a Content-Security-Policy that lists every service the app calls and blocks framing. |

**What the stats collect:** each browser gets a random id. When the game opens, it also sends the referring site's name (the host only, like `x.com`, or `direct`) and the device type (phone, tablet or desktop). No wallet, IP address or full URL is stored; a salted IP hash is kept for one day to stop spam. Players can opt out in Settings, and automated browsers never send. Co-op runs aren't counted.

**Feedback:** the result card's optional form stores the rating, the text and the run's context (level, win, stars, Chog number, device), plus the browser id only when stats sharing is on. No public route returns it, and each network can send 5 notes a day, one every 30 seconds.

**Reading feedback:** from `stats/`, run `npx wrangler d1 execute siege-stats --remote --command "SELECT at, level, won, stars, hero, device, rating, text FROM feedback ORDER BY id DESC LIMIT 50"`. `level` is `1` to `6`, `endless`, `daily`, or `party-<level>` for Porch Party.

## On-chain pieces

The shop and $KNOCK are on **Robinhood Chain Testnet**. $KNOCK is a testnet token with no real value, and **nothing in the game pays out**. Playing never earns $KNOCK, because a score from a browser can be faked. On Monad the game only reads; it never writes.

| Piece | Chain | Address | What the game does with it |
|---|---|---|---|
| Chog Genesis (ERC-721) | Monad mainnet (143) | `0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763` | Reads `ownerOf` for Home advantage and **My Chog**. Traits and portraits come from a snapshot of the collection. |
| $CHOG (ERC-20) | Monad mainnet (143) | `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` | Reads `balanceOf` for the holder perk. |
| $KNOCK, "Knock candy" (ERC-20 with EIP-2612 `permit`) | Robinhood Chain Testnet (46630) | `0x2Ae41145A6acB58d4457c49df27ab6BFEF618492` | Spent in the shop. The shop links to its page on vibe/vibe, a testnet token launchpad. |
| KnockShop | Robinhood Chain Testnet (46630) | `0xdfE49a06DEB6040Ecd6855AE07411cA2B336688C` | Sells items for $KNOCK. Ownership is on-chain (`owned(address, item)`), so it follows the wallet. |

- **Buying:** one `permit` signature for the exact price, then one `buyFor` transaction. If the shop already has enough allowance, only the transaction is needed.
- **Only the buyer can buy:** `buyFor` only accepts a purchase sent by the buyer, so nobody else can spend a buyer's permit or leftover allowance.
- **The first shop:** this shop replaced the first one, `0xc52dfedAf158031fd7b5fAe0A2F1CFB6c1aC89b6`, which lacked that check. Items bought there still count, because the app reads ownership from both. The live app buys only from the new shop.
- **The Candy Bank starter grant:** 300 $KNOCK and 0.0005 test ETH for gas, once per wallet. The claim is queued by a Cloudflare Worker, and an outbound relay pays it on Robinhood testnet.
- **Wallets:** a guest wallet (a key made and kept in the browser, for testnet only) can claim the grant and buy items without an extension. A browser wallet works too. On a phone or tablet without a wallet, links reopen the game inside MetaMask, Phantom, Coinbase Wallet or Trust Wallet.

## What's in the repository

| Folder | Contents |
|---|---|
| `app/` | The game. `app/src/siege/` is the game itself; `app/src/stats/` is the stats page. |
| `contracts/` | Foundry. `KnockShop.sol` is the buyer-only shop deployed on Robinhood testnet. `Knock.sol` belongs to the dropped street game and was never deployed to mainnet. |
| `worker/`, `relay/`, `stats/`, `sandbox/`, `coop/` | The services above. `coop/` also holds the two-browser co-op checks. |
| `art/` | The SVG art sources and the Python scripts that build the atlases. See [art/README.md](../art/README.md). |
| `archive/street/` | The original Knock street game, which was dropped on 13 Oct. |
| `docs/` | This guide, the [player guide](HOLDERS.md), a [phone test checklist](PHONE-TEST.md), the 12 Oct design doc ([SIEGE.md](SIEGE.md)), and `readme/`, the README's images. |

## Testing on the live site

1. Open https://knock.timidan.xyz and tap **Hold the porch →**.
2. Pick **Rosie Row** (marked "Start here").
3. Choose a hero on "Who's on porch duty?":
   - type any Chog number from 1 to 1,969, or tap **Random**;
   - or tap **Try as a holder**. You get a real Chog and 1,000 $CHOG on a sandbox copy of Monad, held by a testnet guest wallet that the page makes for you. No extension or sign-up.
4. Tap **Let's make mischief →**. Your first Rosie Row is a 7-step tutorial; **SKIP** is on the tutorial card.
5. At the start of the level, the **CHOG #… · TRAITS ACTIVE** card lists the perks that come from your Chog's real traits.

### Co-op quick test: Porch Party

Each player must bring a Chog their wallet owns, so this test uses the holder demo twice.

1. **Browser A:** do steps 1 and 2, then tap **Try as a holder**. When your Chog appears, tap **Porch Party · play together**, then **Copy invite**.
2. **Browser B:** use a second browser, a private window or a phone, so it gets its own guest wallet. Open the invite link, tap **Try as a holder**, then **Join Porch Party →**.
3. The level starts once both Chogs have loaded, with no tutorial. Each player moves their own hero and uses its own special, ultimate and talents. Candy, towers, traps, spells and jars are shared. Your partner's Chog, level and health show at the top right.

The two holder demos use two of the sandbox's five tries per network per hour. A room that hasn't started closes after 10 minutes.
