# Porch Party co-op

Two players defend one story level with their own Chogs, shared candy, towers, traps, spells and jars. The relay is deployed at `https://knock-coop.timidan-knock.workers.dev`, and the game integration is live at https://knock.timidan.xyz.

`app/public/_headers` lists both `https://knock-coop.timidan-knock.workers.dev` and `wss://knock-coop.timidan-knock.workers.dev` in `connect-src`.

## Runtime

- `src/worker.js`: one Durable Object per room, two claimed slots, ordered input relay, checkpoint comparison, expiry and terminal disconnect handling. Room creation reads at most 512 retained body bytes; native IP limits run before Durable Object lookup (5 creations and 30 upgrade attempts per minute).
- `app/src/siege/net/protocol.ts`: protocol 3, 45 Hz, one checkpoint every 90 turns, at most 16 commands per packet.
- `RoomClient.ts`: socket lifecycle and worker-driven heartbeat. After asset preparation, eight lobby probes select a fixed match delay: `ceil((2 * maximum RTT + 30 ms) * 45 / 1000)`, bounded to 6–45 ticks; the room agrees the larger peer value. The window does not change during play.
- `Lockstep.ts`: both packets required, player 0 then player 1 ordering, no prediction or rollback. Checkpoint acknowledgements are pipelined with a two-checkpoint bound.
- `clock.ts`: elapsed-time 45 Hz clock, independent of render RAF, bounded to three steps per wakeup; waiting does not accumulate catch-up debt.
- `prepare.ts`, `session.ts`, `snapshot.ts`: both hero/boss assets before readiness; scene attachment and lifecycle; explicit gameplay-state projection and final checkpoint gating.

A talent choice pauses combat while network turns continue. Choices run before each deadline; after 450 unanswered turns, choice 0 is selected. Starting talents (a Chog that starts above hero level 1) resolve to choice 0 at once on both peers, so neither player waits. Disconnect/desync ends the room. A win's camera close-up starts at once, but the Chogs' victory dances wait for a matching final checkpoint, because rig state is hashed. Results appear only after a matching final checkpoint; sockets stay alive until the result is dismissed so one player's final acknowledgement cannot disconnect the other prematurely.

The relay identifies room slots, not wallet owners. The client uses the existing ownership checks. This is cooperative play, not authoritative anti-cheat, a wallet attestation service or a competitive leaderboard. Co-op results are not submitted as single-player scores. No reconnect, room reuse, Daily or Endless co-op is implemented.

## Build and verify

From `knock/`, using existing dependencies:

```bash
export TMPDIR="$HOME/.cache/knock-coop/tmp"
node coop/build.mjs
node coop/serve.mjs
```

The builder freezes source/assets and builds the full game plus an isolated replay harness into `~/.cache/knock-coop`. The server uses localhost port **5200**. Stop it after verification.

In another terminal:

```bash
export TMPDIR="$HOME/.cache/knock-coop/tmp"
node app/node_modules/typescript/bin/tsc -p app/tsconfig.app.json --noEmit
node app/node_modules/typescript/bin/tsc -p coop/tsconfig.json --noEmit
node --experimental-strip-types app/scripts/rig-check.mts
node coop/verify.mjs legacy replay desync disconnect
node coop/verify-party.mjs finish desync disconnect
node coop/verify-party.mjs crowd60
node coop/check-ingress.mjs
```

For the controlled RTT run, start a separate local Wrangler relay (port 8796 was used) and run `COOP_RELAY=http://localhost:8796 node coop/verify.mjs pace`. Playwright delays every WebSocket frame 50 ms each way, including lobby probes. For a controlled full-game run, rebuild with `VITE_COOP_RELAY=http://localhost:8796 node coop/build.mjs` and use `PARTY_RTT_MS=100 node coop/verify-party.mjs finish desync disconnect` (or `crowd60`). This changes only the local QA endpoint; the source default remains the deployed Worker.

The pacing test asserts under 5% measured stall time and 1,800 turns in less than 42.106 seconds.

`verify.mjs` runs independent Chromium processes. Its legacy adapter reproduces the existing seeded 1,800-tick replay byte-for-byte; its relay replay also compares full checkpoint strings and direct offline replay. Its 99,999-candy setup is a transport fixture, not a balanced-level test.

`verify-party.mjs` uses the real menu, room link, two Chogs and WebGL contexts. It supplies read-only NFT/holder RPC fixtures (no signatures or chain writes). The story run uses normal starting resources and commands. `crowd60` is explicitly a performance fixture: Rare Row, two heroes, 60 durable enemies and all 11 tower pads, full quality, 844×390 at DPR 3. It measures one foreground display while the partner's rendering sleeps; both clients keep real simulation, networking and hashing running. The report also preserves the dual-display measurement.

Evidence goes to `~/.cache/knock-coop/evidence/`. No test masks `navigator.webdriver`. Automation reuses the installed Playwright at `/home/timidan/Desktop/murmur/node_modules/playwright-core` and Chrome at `/usr/bin/google-chrome-stable`. `verify.mjs` accepts `PLAYWRIGHT_MODULE`, `CHROME_PATH`, and `COOP_RELAY` overrides.

## Deploy only the relay

```bash
export TMPDIR="$HOME/.cache/knock-coop/tmp"
export WRANGLER_LOG_PATH="$HOME/.cache/knock-coop/wrangler.log"
npx wrangler@4.149.0 deploy --config coop/wrangler.jsonc --outdir "$HOME/.cache/knock-coop/worker"
```

Native rate limits are approximate and local to a Cloudflare location. There are no Pages routes in this configuration. Do not promise seamless upgrades to active rooms. `check-ingress.mjs` imports this built Worker and verifies the missing-Content-Length stream cap and the pre-lookup limiter.

See [implementation design](../.cache/coop-design.md) and [phase 2 evidence report](../.cache/coop-phase2-report.md).
