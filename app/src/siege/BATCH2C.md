# Candy Siege · engine batch 2c

Implemented in `src/siege/`, with small additions to `scripts/rig-check.mts`. No dependencies, public art, contracts, app entrypoints, shared wallet code or server configuration were changed. No Daily post, commit, push or deploy.

## Player-facing changes

- Tutorial: soft 70% black spotlight follows every sub-target, with the card and Skip above it. HUD, map, drag and keyboard input are gated; unrelated taps nudge the target. Simulation waits for the player, resumes on their action, and gives the first wave time to supply two enemies for the rain lesson. Towers and the hero hold attacks through the rain lesson so the crowd stays available until the cast. Reduced motion has static guidance.
- Shop: all 15 specified item IDs, live/default prices, balance, ownership, selected-item live previews, title sticker, costume-row link and emote-wheel link. Sandbox is read-only. The unopened shop remains browsable with buying disabled. It explicitly says $KNOCK is a testnet token with no real value and Siege has no payouts.
- Ownership: cache keys include Robinhood chain ID, shop address and wallet address. Refreshes use `ownedItems`; purchases separately recheck `owned`, token, price, balance and network. Crew outfits retain the original hero's weapon; gold towers toggle in Settings; purchased dances and crypto bubbles populate wheel pages; starter candy adds 50 at each new level start, never mid-run.
- Dances: 34 clips load from `atlas/dances.json` into the existing rig. The picker, wheel and shop show animated previews. A signature starts its body dance and face effect together. Already-started attack/ability releases finish before a queued dance, and a move order cancels dancing. Enemies bounce and squash with signatures without gaining rigs.
- Victory: the camera eases toward the hero, the chosen dance (default GG) plays with confetti, then the result panel enters at the side. Reduced motion skips camera travel and confetti motion.
- Share: the client draws a 1080×1350 PNG with both wordmarks, the actual map, a fitted mid-dance hero in the chosen outfit/ring, Chog ID, level name, stars, score, saved jars, stopped Chogs, hero level, signature name, date and `location.origin + '/?siege'`. Native file sharing gets the PNG, text and URL; fallback offers download, copyable text and X/Telegram/WhatsApp/Facebook links. No upload service is used.

## Shop flow and data path

Player → existing `WalletState.connect()` from `wallet.tsx` → EIP-1193 wallet → Robinhood testnet (46630) → read token balance, shop prices and ownership → sign permit → buyer submits purchase → receipt → ownership refresh → local cache/UI.

1. Open the shop, connect the existing wallet and switch/add Robinhood Chain Testnet. The shared connector initially connects on Monad and reloads on network change; a session marker restores the shop after that reload. Network changes are disabled inside an active level to avoid discarding that level. Buying remains possible in-level if already connected on Robinhood.
2. Read current price and ownership from `VITE_KNOCK_SHOP`. Unset/invalid addresses disable buying and show launch defaults. Zero on-chain prices mean not for sale. Validate the deployed shop's `knock()` token before signing.
3. Check $KNOCK and test ETH. Insufficient balances link to the street, vibe/vibe and the faucet used by `Candy.tsx`.
4. Read `eip712Domain()` and honor its field bitmap, including optional salt; validate chain/token and reject unsupported extensions. If unavailable, read `name()` and use version `1`. Read the nonce and chain timestamp; sign an exact-price, ten-minute EIP-2612 permit. With sufficient existing allowance, use `buy(item)` instead.
5. Recheck wallet/account/network after signing; simulate, estimate gas, then send `buyFor` from the buyer's wallet. Wait for a successful receipt and confirm ownership. Pending transaction hashes persist so a timeout or reload does not silently invite a second purchase; the UI can check the pending transaction.

The only new chain client is needed because the Robinhood client inside `chain.ts` is private; balance reads reuse its exported `knockCandy`. No relayer, indexing service, new wallet package or new dependency was introduced. The shop implementation and extra transaction code remain reachable through lazy Siege, not the start-screen implementation.

Permit references: [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612), [EIP-5267 domain retrieval](https://eips.ethereum.org/EIPS/eip-5267).

## Score

`100 × stopped + 250 × jars + 1000 × stars + 300 × early calls + victory time bonus`.

The time bonus is `10 × max(0, 300 − floor(simulated seconds))`, only on victory. Pauses and tutorial waiting do not count. A defeat gets zero stars and no time bonus. Best score and stars are saved independently per level. These are local, unverified scores, not a reward oracle or an authoritative leaderboard.

## Checks and evidence

- `npm run build -- --outDir /tmp/knock-dist-siege`: passed. Entry JS gzip: **68.62 → 72.98 KB**, **+4.36 KB**, below the 5 KB limit. Existing code splitting also moved shared UI/chain bytes between chunks; no Phaser/shop startup import was added to the app.
- `node --experimental-strip-types scripts/rig-check.mts`: passed **4,864 reference poses**, maximum error **0.00000109**, all **1,969 kits/Home bonuses**, Phaser eases, **34 dance clips/loop seams**, score and owned-dance checks.
- Headless Chrome tutorial: all seven steps / fourteen target taps completed, with actual HUD/map clicks. At every substep, taps on speed/pause/unrelated ground and the N shortcut left state and the paused simulation clock unchanged. Only the crowd-arrival simulation was advanced in fixed steps to avoid relying on loaded-machine wall-clock FPS.
- Browser dance check: no attacks during LOL; a ground move cancels it. An already-started ability release is preserved before the queued signature.
- Mocked wallet/RPC purchase: the owner-set **180 KNOCK** price replaced the default 150; the domain, nonce, exact permit value/spender and buyer-sent `buyFor` were checked. Ownership refreshed. Insufficient KNOCK, zero ETH, crew outfit/original weapon, gold towers and +50 starting candy were verified. These are simulated responses, not an on-chain purchase.
- Atlas metadata was scanned across every kit to select the largest hero atlas set: **Chog #466, 4.74 MB** before shared art. In-browser with that hero, a crew outfit, gold towers, crypto pack and an open preview wheel: **112.8 MB**, **1,273 objects**, **8 draw calls**. Chog #7 with the same cosmetics: **111.4 MB**, 1,282 objects, 9 draw calls. This is allocated GPU texture storage, not driver VRAM; headless FPS is not used as a performance result.
- Sandbox and reduced-motion browser checks passed: buying disabled, no connect button, static spotlight/nudge position and static looping dance pose. Skip completes the tutorial.
- Share PNG is rendered and visually inspected at **`/tmp/knock-siege-share.png`**. The result values in this screenshot are a deliberate render fixture, not proof of a natural level victory. Browser fallback download and a mocked native-share payload are checked.

Other artifacts: `/tmp/knock-siege-browser-evidence.json`, `/tmp/knock-siege-shop-evidence.json`, `/tmp/knock-siege-shop-heavy-evidence.json`, `/tmp/knock-siege-extra-evidence.json`, `/tmp/knock-siege-picker.png`, `/tmp/knock-siege-shop.png`, `/tmp/knock-siege-result.png`, `/tmp/knock-siege-wheel.png`.

## Limits and remaining integration

- Real permit signing, gas estimation and purchase confirmation are **unverified against a deployed KnockShop**. Deployment and a real testnet purchase are the remaining integration step. No wallet transaction was broadcast by this task.
- The contract's permit approves a spender/value, not an item ID; its own source notes that another submitter could select a same-price item. The UI submits from the buyer as requested, but cannot remove that contract-level behavior.
- The supplied `cards` atlas has no dance-specific frames. Dance catalog entries reuse `card/emote-pack`, with their own name and actual live dance preview. No public art was edited.
- Physical-phone play, installed-app native sharing, final card rendering at the production origin, every wallet implementation and exhaustive per-hero battle balance were not tested. Share-intent links share text/link; users attach the downloaded image themselves.
- Levels 2–6, bosses, endless/daily and other batch work remain outside this task. The temporary port-5180 preview is stopped at handoff.
