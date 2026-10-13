# Candy Siege — batch 1

> **Front-facing legs (13 Oct):** the hero legs and the waddle `walk` now come from `staging/build_legs.py`, not from `build.py`.
> After any `python art/siege/build.py`, run `python art/siege/staging/build_legs.py` and copy `staging/atlas/*` over
> `knock/app/public/siege/atlas/`, or the old side-view legs come back.


Run from the repository root:

```sh
python art/siege/build.py
```

`build.py` contains the editable drawing masters. It regenerates the standalone
SVGs in `svg/`, renders untrimmed PNGs in `png/`, shelf-packs the three Phaser
JSON Hash atlases, and copies the level and portrait anchors to
`knock/app/public/siege/`. It never writes `traits.json` or app source.
Pillow and either `rsvg-convert` or ImageMagick are required; no network is used.

All 195 contract frames are included: 72 units, 57 effects, and 66 UI frames.
Each atlas frame has two transparent pixels on every side and a centre pivot.
Tower bases are at the bottom centre of their 160×200 frames.

The contract leaves some dimensions unspecified. Projectiles use 64×64, traps
128×128, and hero casting frames 112×112. UI dimensions are recorded in each
atlas's `sourceSize`; buttons and panels contain no baked-in labels.

`faces.json` uses frame-local pixels, before display scaling or horizontal
flipping. Enemy `frames[0..5]` correspond to the walk frames. Each entry has
`x`, `y`, and `r`; the top-level anchor is walk frame 0. The optional `hurt`
anchor and `die[0..2]` anchors follow their named animation frames. Death frames
1 and 2 have `r: 0`: hide the portrait when the costume has popped. Hero frames
and all six cast poses use `(56, 47, 31)`. Sprite face windows are transparent.
When a sprite is flipped, mirror the portrait position with it.

`level1.svg` and `level1.json` are generated from the same road curve. The JSON
contains 193 path samples, eight grass clearings, the porch, and decorative prop
positions. Props are already painted into the background; their data is for
placement/reference, not a second rendering pass. Overlay pad sprites on the
clearings. `preview-level1.png` is an illustrative composite with example towers
and existing Chog portraits; those units are not baked into `level1.webp`.

`preview-units.png`, `preview-fx.png`, and `preview-ui.png` show every frame.
`preview-motion.png` shows the six poses at 60px frame height, and
`preview-deaths.png` shows the hurt-to-candy sequence. `preview-reference.png`
contains existing Knock art for style comparison. `build-report.json` records
atlas sizes, hashes and the checks from the latest successful build.

Suggested animation timing: walk 10–12 fps, bat flight 12 fps, attacks and casts
12 fps, effects 14–18 fps, deaths 12 fps (do not loop), emotes 8 fps. Actual
timing, portrait hiding, tower idle motion and gameplay layering belong to the
engine and were not runtime-tested by this art build.
