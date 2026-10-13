# Knock: build plan

Chogathon 2026. Building ends **22 Oct 15:00 UTC**; the aim is to submit on 21 Oct. This plan follows the pitch submitted on 8 Oct (the ERC-6551 version) and [ideation.md](../ideation/ideation.md). Where they differ, the pitch wins.

## Goal
A live haunted street of all 1,969 Chog Genesis tokens on Monad mainnet. Holders knock on each other's doors. Treats and trick items live in each Chog's own ERC-6551 wallet, and tricks show on the victim's portrait. Guests and judges can watch the street without a wallet.

## Done means (by 21 Oct)
1. An incognito visitor sees the live street (real Chogs, current marks, recent knocks) within 15 seconds, without a wallet.
2. A holder knocks with one mainnet transaction. The outcome (treat, trick or bounce) shows on both portraits, in the street feed and in the house's inbox, with an explorer link.
3. Candy and items are ERC-1155 balances held by each Chog's token-bound account (the standard Tokenbound v3 address), so any app can read them.
4. $CHOG: a house stocks its bowl, visitors' treats arrive in their Chog's account, and the house can withdraw what's left.
5. Foundry tests cover every knock outcome and every $CHOG path. One test runs on a Monad fork against the real Chog contract.
6. Real holders have played on mainnet before submission (launch by 18 Oct). README, a video of 2:45 or less, and testing steps.

## Not building (cut list)
3D models, a physics engine, other players walking on screen, a cosmetics shop, the door-duel mini-game, a Telegram bot, a randomness oracle, a backend database and server-signed vouchers. Add one only after the playtest shows people coming back.

## Not changing
- The Chog Genesis contract and its art: we only read them.
- The art contract: every overlay is a full 1000×1000 SVG per Side, stacked over the portrait (see ../art/).
- Daily: Knock only posts checkpoints there.

## Design (v1)

### Contract: one Foundry project, Monad mainnet (chain 143)
- **`Knock.sol` is one contract: the game and the ERC-1155 item token.** A Chog's items are balances held by its Tokenbound account: registry `0x000000006551c19487814612e58FE06813775758`, proxy `0x55266d75D1a14E4572138116aF39863Ed6596E7F`, salt 0. Both are deployed on Monad. Items are minted to that address even before the account itself is deployed.
- **`knock(from, to, item)`.** The caller must own `from` and must not own `to`. Each Chog gets 3 knocks per UTC day, plus one revenge knock on whoever last tricked it. The outcome:
  - **treat:** the house has candy in its bowl. Candy, plus $CHOG if the bowl has some, moves to the visitor's account;
  - **bounce:** the bowl is empty, the house has set a trap, and the visitor isn't wearing a ghost sheet. The trick lands on the visitor and the trap is used up;
  - **trick:** in every other case. The item is burned, the mark stays on the house's portrait for 24 hours, and the house gets a revenge knock.
- **Other actions:** `stockBowl`, `setTrap`, `wear`, `clean` (pay $CHOG, or a friend's Chog cleans it with a broom), `craft` (turn candy into items) and `withdraw` ($CHOG back to the Chog's current owner).
- **Candy in and out:** a Chog's first knock each day mints a ration of candy to it. Crafting and tricks use candy up.
- **No indexer:** the contract stores everything the app shows: marks, porch state, counters, each house's last 10 visits and the street's last 50 events.
- **For the README:** the game moves items out of a Chog's account when the NFT's owner asks, without the account's own approval, because Knock is the item contract. Holders can still move items freely through their account.
- **Also for the README:** a bowl's candy and $CHOG belong to the Chog, so they go to the buyer if it's sold. Empty your bowl before you sell.
- **The economy numbers are v1 defaults, to revisit on Day 4:**
  - ration 5 candy a day, and a treat is 1 candy;
  - egg 1, toilet paper 2, mustache 3, pumpkin trap 5;
  - ghost sheet 15, witch hat 15.

### Game: a walkable 3D street (decided 9 Oct)
The user asked for an interactive 3D game, not a web page. The street is a paper diorama: the hand-drawn houses and portraits stand in 3D like pop-up cards.
- **Moving:** your Chog walks a block of 40 houses (keys or an on-screen joystick) and can teleport to any house.
- **Knocking:** at a door you pick a trick. The item flies in an arc and splats, a treat bursts candy, and a bounce comes back at you.
- **Tools:** three.js with react-three-fiber and drei. The controls are hand-drawn stickers.
- **Fallback:** the 2D street stays as a simple view for weak phones.

### App: Vite, React, TypeScript, viem (no wagmi, no backend)
- **Reads:**
  - a static snapshot of every Chog: Side, Background, image index and name;
  - owners and game state, live through Multicall3.
- **Writes:** the injected wallet (EIP-1193) on chain 143, or a per-Chog play key (a 24-hour session key the owner approves; added 12 Oct). `ownerOf` is checked live before every write. The holder guide is `docs/HOLDERS.md`.
- **Images:** 512px thumbnails of all 1,969 Chogs, made once from IPFS and served with the app.
- **Hosting:** decide by Day 9 (the homelab behind a public hostname, or a static host).

## Days
| Day | Date | Done when |
|---|---|---|
| 1 | Fri 9 Oct | This plan; a snapshot of all 1,969 Chogs; thumbnails cached; the guest street renders real Chogs with the art (local) |
| 2 | Sat 10 | The contract and its tests on a Monad fork (done early, on 9 Oct). The app runs on a local fork where you pick any Chog and act as its real owner (impersonation): no wallet, no Chog needed |
| 3 | Sun 11 | A knock end to end on the fork: outcome, marks on portraits, inbox, feed |
| 4 | Mon 12 | Bowls, $CHOG, cleaning, crafting, costumes; revisit the economy numbers |
| 5–7 | Tue 13 – Thu 15 | The 3D street, complete on the fork: every action in the scene, sticker controls, outcome animations; play it as several holders and fix friction; phone check |
| 8 | Fri 16 | Mainnet deploy; public hosting; judge sandbox (option: a hosted fork, reset nightly, where anyone plays as any Chog) |
| 9 | Sat 17 | Show a few holders first; fix what they hit |
| 10 | Sun 18 | Launch to all holders in the Chog Discord and on X |
| 11–12 | Mon 19 – Tue 20 | Fixes; README; video; testing steps |
| 13 | Wed 21 | Freeze, test in an incognito window, submit |
| 14 | Thu 22 | Buffer until 15:00 UTC |

## Decided
**No Chog needed to build or test** (9 Oct). Everything is built and tested on a local Monad fork, acting as real holders. Real holders are needed only as players, and launching to them by Sun 18 Oct leaves time for usage before submission: retention is 20% of the score, and the submission asks for usage gathered.

## Checkpoints
Post to Daily's Working on page (id `knock`) when each day's "done when" is met.

## Launch runbook (Fri 16 Oct)
Set up on 12 Oct: the Cloudflare Pages project `knock` (knock-ej6.pages.dev, production branch `main`) and the relay on OpenShip (192.168.8.205, project `knock-relay`, id `proj_0DnPYzug8J1pLqbf`, deployed from `relay/` as a Compose service with a `relay-state` volume; RELAY_KEY is a project secret; sleep mode is always_on). The OpenShip MCP is registered in Claude Code as `openship`. Until KNOCK_CONTRACT is set, the relay logs that it is waiting.
1. **Deploy Knock** (needs the codeword) from the deployer keystore `knock-deployer` (`0x361C367730Fa55Dfa5384eBa851499c6Ad09EB8A`, created 12 Oct, funded from the builder's main wallet `0x3a79bF3555F33f2adCac02da1c4a0A0163F666ce`; the builder types its password in the terminal): `cd contracts && forge create src/Knock.sol:Knock --rpc-url https://rpc.monad.xyz --account knock-deployer --constructor-args 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777 <cleanFee wei> --broadcast`. Its first transaction must be this deploy, so Knock lands at the precomputed address **0xc52dfedAf158031fd7b5fAe0A2F1CFB6c1aC89b6**. Then `cast send 0xc52dfedAf158031fd7b5fAe0A2F1CFB6c1aC89b6 "transferOwnership(address)" 0x3a79bF3555F33f2adCac02da1c4a0A0163F666ce --account knock-deployer --rpc-url https://rpc.monad.xyz`, and verify the source on Sourcify. Note the deploy block.
2. **Start the relay** before anyone plays: in OpenShip, set the project env `KNOCK_CONTRACT=<address>` and `RELAY_FROM_BLOCK=<deploy block>` (MCP `patch_projects_by_id_env`, environment production), then redeploy (`post_deployments_by_id_redeploy` on the latest deployment) and read the project logs until it says it holds KNOCK and is paying. Never run a second relay with the same key (nonces collide); the homelab copy was removed.
3. **Build and deploy the app:** `VITE_RPC_URL=https://rpc.monad.xyz VITE_KNOCK=<address> npm run build`, then `npx wrangler@4 pages deploy dist --project-name knock --branch main`.
4. **Attach knock.timidan.xyz** to the Pages project and check HTTPS.
5. **Smoke test** with a real wallet that holds a Chog: connect, knock once, see the Monadscan link and the relay payout.
6. **Update the holder guide** (contract address, cleaning fee) and republish it.

## The judge sandbox (set up 12 Oct)
- **Where:** LuxVPS, `~/knock-sandbox` (agentops, no root): `reset.sh` starts anvil (docker, `knock-anvil`, a fork of Monad mainnet with auto-impersonation) and the JSON-RPC filter (docker, `knock-rpc`, `rpc-filter.py`: an allow-list of methods, rate limits, CORS), then deploys `Knock.bin` from the fixed deployer `0x5aDb…6f90` so the contract is always at `0xf7F4B418469725323c43aF88E5b551E280c95fD4`.
- **Public:** `https://sandbox-rpc.timidan.xyz` (Cloudflare → the edge Caddy on the VPS → `knock-rpc:8545`; the Caddyfile block is in `~/edge/Caddyfile`). The site is the Pages branch `sandbox`: `https://sandbox.knock-ej6.pages.dev`, built with `VITE_SANDBOX=1 VITE_RPC_URL=https://sandbox-rpc.timidan.xyz VITE_KNOCK=0xf7F4…5fD4`.
- **Resets** nightly at 00:05 UTC and at boot (agentops crontab). To ship a new contract there: copy the new `Knock.bin` to `~/knock-sandbox/` and run `./reset.sh`.
