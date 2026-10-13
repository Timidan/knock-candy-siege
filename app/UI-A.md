# UI-A implementation and evidence — 11 October 2026

Implemented in `app/`: aimed throws with a dotted arc and house-local hit classification; miss returns before any chain call; cosmetic bullseyes and session streak; one translucent, portrait-bearing replay at a time from real current-block street events; three counter-based badges; X compose links, revenge navigation and fork-only `?play=…&house=…` entry; live owner $KNOCK balance, token info and explicitly pending treat rewards; lazy game/Simple entry; phone joystick, control shelf and house bottom sheet; lite rendering and instanced repeated props.

No new npm dependencies. `src/chain.ts`, `scripts/relay.mjs`, contracts and shared servers were not changed. Routes, boss, crews and treat-or-raid were not built. No Daily post.

## Build and loading

`npm run build` passed after the final code changes. `npm run art` ran and copied the actual batch-4 badges, coin, earned card, reticle and joystick art. `node scripts/thumbs256.mjs` wrote 1,969 thumbnails; `public/chogs-256/` is ignored. Run the script on a clean checkout before packaging the 256px assets.

All sizes below are Vite's reported gzip kB (decimal), consistently using the build reporter before and after. A dash means the content was part of the monolithic bundle before splitting.

| Chunk / output | Before gzip kB | After gzip kB |
| --- | ---: | ---: |
| index JS | 435.20 | 67.25 |
| Game JS (three.js, R3F, effects, scene) | — | 278.64 |
| Simple JS | — | 3.19 |
| Candy/shared React and chain JS | — | 50.27 |
| images/shared house UI JS | — | 2.38 |
| localBatchGatewayRequest/viem JS | — | 30.94 |
| secp256k1 JS | — | 11.94 |
| utils JS | — | 0.97 |
| rolldown-runtime JS | — | 0.42 |
| ccip JS | 1.30 | 1.32 |
| index CSS | 3.58 | 1.78 |
| Candy/shared controls CSS | — | 1.91 |
| Game CSS | — | 2.07 |
| index.html | 0.48 | 0.60 |

The start entry's static JS graph is **161.79 kB gzip**, versus **435.20 kB** before, approximately **63% less**. Entry CSS is 3.69 kB. Simple adds 5.57 kB JS (Simple + shared house UI) to the start graph. The game adds 281.02 kB JS (Game + shared house UI). These totals exclude the optional CCIP import, fonts, portraits, SVG assets and API responses. Splitting defers the 3D code; it does not make all of the game's code disappear. Vite still warns about the large deferred Game chunk.

Built import inspection: Simple imports only the runtime, Candy/shared code and images/house UI. None statically imports Game. The entry uses React.lazy for Game and Simple, and only renders the selected view inside Suspense. The Game chunk is not in index.html's preload list.

## Lite rule and resource limits

```
!query.has('full') && (
  query.has('lite') ||
  matchMedia('(pointer: coarse)').matches ||
  (navigator.deviceMemory ?? Infinity) <= 4
)
```

`?full` wins even when `?lite` is also present. Lite uses DPR 1–1.25, zero postprocessing, one point light, no fireflies, 3 rather than 7 total fog cards, half the yard props/lamps/trees, 256px portraits with the existing IPFS fallback, and portrait mark/costume overlays only within 25 world units. Large scene SVG textures are also downsampled to a maximum edge of 512px in lite; IPFS portrait fallbacks are capped to 256px. Linear-filtered loaded textures no longer allocate unused mipmaps. Portrait/plaque/sign caches release assets from departed blocks, retaining portraits needed by the player and current-block replays.

## One-block resource estimates — not runtime measurements

Scenario: a new 40-house block, all houses dormant, no marks, costumes, badges, selected-door cue or active replay; the player's portrait is already among those 40. Count all scene geometry before camera-frustum culling. Full-mode postprocessing passes are excluded from the static submission count.

| Stand-in | Lite | Full |
| --- | ---: | ---: |
| Calculated scene draw submissions before frustum culling | 408 | 431 |
| Repeated prop submissions, included above | 10 | 10 |
| 40 portrait textures, decoded RGBA | 10.00 MiB | 40.00 MiB |
| Other loaded scene art textures, decoded RGBA | 8.44 MiB | 38.05 MiB |
| Generated textures, with estimated mipmaps | 5.28 MiB | 5.28 MiB |
| **Total estimated scene texture memory** | **23.72 MiB** | **83.33 MiB** |

Draw-count breakdown: 320 house submissions (8 each); 39 for sky/stars/backgrounds/street/curbs/road marks; 10 for batched props; 18/36 for bare trees; 4 for signs; 3/7 for fog; 0/1 for fireflies; 3 visible bat cards; 11 for the player. The old uninstanced fences, pumpkins, tombstones and lamps alone required 488 full-block submissions; they now use 10 batches. A nearby door adds 6; live house state, badges and replays add variable submissions. Full postprocessing adds passes. Actual rendered draw calls can be much lower due to camera culling, so these numbers must not be described as measured calls/frame.

Texture estimate method: unique images × width × height × 4 bytes; ×4/3 for CanvasTexture mip chains. Six house textures and a shared dark state, street, moon, fog, two bat frames, lantern, egg and candy art; sky, glow, shadow, grain, pumpkin face, hill/tree backdrops, 40 plaques and two signs. Excludes framebuffer/postprocessing targets, depth/stencil buffers, driver overhead, DOM images, CPU-decoded image copies, extra replay portraits and any later house-state art. It estimates scene textures, not total browser or GPU memory.

## Unfinished verification

The supplied `http://localhost:5173` served **Stipend**, not Knock, in both the browser and a direct read. The already-running server on port 5174 also served Stipend. The listener inventory had no port 8545. No server or chain was started, stopped, reset or replaced.

Consequently **actual lite/full draw calls, end-to-end fork transactions, ghost playback and phone layouts were not observed**. The TypeScript/build result and source-derived estimates do not prove those live outcomes. No payout was tested or asserted as received; the reward card explicitly says pending and the balance chip only uses `knockCandy(owner)` results.

For the next reachable run, `?lite&stats&house=1` and `?full&stats&house=1` expose the same scene's renderer call range, DPR and texture estimate in an opt-in overlay. The counter accumulates all renderer passes per frame, including postprocessing; texture estimation deduplicates maps attached to current scene materials. Use the same viewport, house and chain snapshot for both measurements.

Real phones must still judge frame pacing, GPU/thermal pressure, touch aiming/cancellation, simultaneous joystick/orbit input, haptics, safe-area behavior and portrait readability. No smoothness claim is made.

The existing sticker jiggle and the drawer's thick ink edge were retained intentionally to match the requested hand-drawn controls; design-hook flags for those styles are contextual false positives, not suppressed rules.
