# Porch Party relay — phase 1

Deployed endpoint: `https://knock-coop.timidan-knock.workers.dev`.

The live game does not import this networking code yet. Phase 2 is documented in [coop-design.md](../.cache/coop-design.md). Opening a room invite on the current Pages deployment does not yet start co-op.

## Files

- `src/worker.js`, `wrangler.jsonc`: one Durable Object per two-player room; Origin checks, creation limit, bounded input sequencing, checkpoints, timeout/leave handling.
- `../app/src/siege/net/protocol.ts`: shared wire types, limits and runtime command validation.
- `RoomClient.ts`: room create/connect, roster/readiness, socket lifecycle and heartbeat.
- `Lockstep.ts`: five-tick delay; both packets required; player 0 then player 1 ordering; hash gate every 90 ticks.
- `hash.ts`: stable explicit-state serialization and a synchronous 64-bit desync checksum (not cryptographic authentication).
- `single-hero.ts`, `harness.ts`, `verify.mjs`: two independent headless Chromium processes execute the existing single-hero simulation through the live relay. No `navigator.webdriver` override. The fixture starts with 99,999 candy, as the earlier deterministic replay did; it is not a balanced-level or two-hero playtest.
- `build.mjs`, `serve.mjs`: freeze existing game source/assets and build into `~/.cache/knock-coop`; serve only on localhost port 5200.
- `check-relay.mjs`: live allowed/forbidden Origin and room-creation limit checks.

## Reproduce

Run from `knock/`, with the app's existing dependencies available:

```bash
mkdir -p ~/.cache/knock-coop/tmp
export TMPDIR="$HOME/.cache/knock-coop/tmp"
node app/node_modules/typescript/bin/tsc -p coop/tsconfig.json --noEmit
node coop/build.mjs
node coop/serve.mjs
```

In a second terminal:

```bash
export TMPDIR="$HOME/.cache/knock-coop/tmp"
node coop/verify.mjs legacy replay desync disconnect
node coop/check-relay.mjs
```

Then stop the server with Ctrl-C. Evidence is written to `~/.cache/knock-coop/evidence/`. `legacy` compares exact JSON bytes against the existing `.cache/polish3/after-simulation.json`. The normal replay checks 1,800 ticks, all 20 full canonical checkpoint strings, matching command order, the withheld tick-180 packet, and a direct offline replay of the actual received command trace. The short failure runs check net events; product overlays/return-to-menu remain phase 2.

Browser automation reuses the existing `playwright-core` at `/home/timidan/Desktop/murmur/node_modules/playwright-core`; set `PLAYWRIGHT_MODULE` to another installed module path if needed. Set `CHROME_PATH` to override `/usr/bin/google-chrome-stable`, and `COOP_RELAY` to override the deployed relay. No npm install or game package/lockfile change is required. All browser temporary profiles inherit `TMPDIR` above.

The HTTP creation-limit check deliberately consumes the allowance. Run it last, or wait a minute before starting more rooms. The native limit is local to a Cloudflare location, not a global abuse quota.

## Client integration contract

```ts
const ticket = await createRoom(relay, buildFingerprint, storyLevel)
const client = await RoomClient.connect(relay, ticket.room.code, buildFingerprint, heroSelection, ticket.hostToken)
// Guest uses the invite code and omits hostToken.
// Wait for client.roster to contain both players, then prepare the agreed scene.
const driver = new Lockstep(simulation, {
  send: packet => client.send(packet),
  onStop: (reason, message) => showTerminalOverlay(reason, message),
})
const unsubscribe = client.subscribe(message => driver.receive(message))
client.ready(hashState(simulation.snapshot()))
// Local gameplay input -> driver.enqueue(command).
// Fixed scene cadence -> driver.advance(); false leaves combat frozen.
// On exit: stop driving, unsubscribe(), client.close(), destroy the scene.
```

Subscribe before calling `ready`. Packet arrival never steps the simulation. Keep local rendering running when `advance()` returns false, and cap catch-up work. Do not advance a second scene accumulator. Match gameplay code/data and initial state, including both heroes and ownership-derived gameplay options, before readiness. Keep result dates, camera/effects/audio/HUD settings out of the snapshot.

The relay identifies slots, not wallet owners. Chog ownership is checked by phase 2's existing wallet flow. It does not certify fair play or provide authoritative results. No reconnect or room reuse is supported: a disconnect/desync means a new room.

## Deploy only this Worker

Use the existing Wrangler OAuth login; no new secret is required:

```bash
export TMPDIR="$HOME/.cache/knock-coop/tmp"
export WRANGLER_LOG_PATH="$HOME/.cache/knock-coop/wrangler.log"
npx wrangler@4.149.0 deploy --config coop/wrangler.jsonc --outdir "$HOME/.cache/knock-coop/worker"
```

The initial deployment creates the SQLite Durable Object namespace using migration `v1` and the native rate-limit binding. There are no Pages routes or Pages deployment in this configuration. Redeploy only when no important rooms are active; this phase makes no seamless-upgrade/reconnection promise.

Cloudflare references used: [hibernating WebSockets](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/) and [native rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
