# Art pipeline

These Python scripts draw the art for Candy Siege. Most of them hold their drawing code, write SVG masters, render them with `rsvg-convert` and pack Phaser atlases. The pipeline was made during Chogathon.

This folder is a copy of the build workspace `~/Desktop/chogathon/art/siege/`, taken on 13 Oct. It holds only the sources: the scripts, the SVG masters and the two original notes (`siege/README.md` and `siege/chogs/README.md`). It leaves out what the scripts generate, apart from the SVG masters: the rendered PNGs (`png/`), preview sheets, staged atlases, build reports and the JSON and WebP outputs. The built atlases are in `app/public/siege/atlas/` and the maps are in `app/public/siege/levels/`.

## Requirements

- Python 3 with Pillow.
- `rsvg-convert` (librsvg). ImageMagick `magick` is the fallback.
- DejaVu Sans at `/usr/share/fonts/TTF/DejaVuSans.ttf`, for the labels on the preview sheets.
- `app/node_modules` installed. The rig previews read Phaser's easing code from it.
- `ffmpeg`, for `dance_preview.py` only.

## Before you run anything

**The app path.** The scripts find the app from their own location, at `art/siege/../../knock/app/public/siege`. They were written in a folder that held `art/` beside the `knock/` checkout. In this repo that path points to `knock/knock/app/…`, which doesn't exist. To fix it, add a temporary link at the repo root, run the scripts from there, and then remove the link:

```sh
ln -s . knock    # now knock/app/… points to app/…
# … run the scripts below …
rm knock
```

**`faces.json`.** `build_chars.py` reads `art/siege/faces.json` before it rewrites it. The file isn't in this copy, because it's the same file as the built `app/public/siege/atlas/faces.json`. Copy it in first:

```sh
cp app/public/siege/atlas/faces.json art/siege/
```

**`kits.py`.** This script uses a fixed path, `~/Desktop/chogathon/knock/app/public/siege` (line 8). On any other checkout, change `ROOT` there.

**Not tested here.** The link was tested only to check that the paths resolve. No rebuild has been run from this copy.

## Rebuild the hero atlases

Run these from the repo root, in this order. Each step reads what the step before it wrote.

| Step | Command | What it makes | Where the output goes |
|---|---|---|---|
| 1 | `python3 art/siege/build_chars.py` | The 18 weapon and mascot hero costumes at 1×, the kit icons, the batch-2 enemies, guards and tower frames, the rig, face anchors and skin tints | `app/public/siege/atlas/`: `hero-*.png/json`, `kit.*`, `units2.*`, `rig.json`, `rig-samples.json` and `faces.json`. Also `app/public/siege/skins.json`. SVGs go to `art/siege/svg/chars/` and previews to `art/siege/preview-*.png`. |
| 2 | `python3 art/siege/build.py` | Batch 3E: every costume in `rig.json` again at 2× (the sharper art for the picker, shop and share card), plus the dance cards | `app/public/siege/atlas/hero-*@2x.png/json` and `cards2.png/json`. Previews go to `art/siege/preview-cards2.png` and `preview-2x.png`. |
| 3 | `python3 art/siege/staging/build_legs.py` | The front-facing hero legs and the waddle walk, redrawn into copies of every hero atlas at 1× and 2× | `art/siege/staging/atlas/`: the hero atlases at both sizes, plus `rig.json` and `rig-samples.json`. Also `staging/preview-legs.png` and `staging/legs-report.json`. It doesn't write to `app/`. |
| 4 | `cp art/siege/staging/atlas/* app/public/siege/atlas/` | Publishes step 3 | `app/public/siege/atlas/`. Skip this step and steps 1 and 2 bring back the old side-view legs. |

## Other builds

These can run on their own. `dances.py` checks against the current `rig.json`, and step 2 reads the `dances.json` it writes.

| Command | What it makes | Where the output goes |
|---|---|---|
| `python3 art/siege/build_fx.py --combat` | The combat feedback atlas: block, ricochet, dodge, crit and status-ring frames; shield bubbles; muzzle flashes; impacts; the BLOCK!, TINK, MISS, CRIT! and "−N jar" pops; the tutorial glove; the porch alarm glow | `app/public/siege/atlas/fx3.png/json`. The script writes a contact sheet to `/tmp/knock-combat-atlas.png`. |
| `python3 art/siege/build_fx.py` | The seven 2400×1080 wide maps (levels 1 to 6 and Town Square). Each keeps the original map unchanged in its centre. | `app/public/siege/levels/*-wide.webp`. The script writes a preview to `/tmp/preview-wide.png`. |
| `python3 art/siege/chogs/build_chogs.py` | The trait-built Chog head: the base, the shared template and its anchors | `app/public/siege/atlas/chog-base.*` and `chog-template.json`. SVGs go to `art/siege/chogs/svg/base/` and previews to `art/siege/chogs/`. |
| `python3 art/siege/chogs/build_eyes.py`, `build_head_a.py`, `build_head_b.py`, `build_mouth_acc.py`, `build_aura.py`, `build_legend.py` | One layer of trait art each: eyes; caps and hats; other headgear; mouths and accessories; auras and forms; the ten 1:1 heads | `app/public/siege/atlas/chog-eyes`, `chog-head-a`, `chog-head-b`, `chog-mouth` and `chog-acc`, `chog-aura`, `chog-legend` (`.png/json` each). SVGs go to `art/siege/chogs/svg/<layer>/` and previews to `art/siege/chogs/`. |
| `python3 art/siege/chogs/compose.py <id> -o out.png` | One Chog's head, built from its traits. Use it to check the layers. | `out.png` (add `--left` or `--window` to change the view) |
| `python3 -B art/siege/dances.py` | Checks the dance choreography against the rig, then publishes it | `app/public/siege/atlas/dances.json` |
| `python3 -B art/siege/dance_preview.py [--still]` | A contact sheet and a 30 fps review of the dances | `art/siege/preview-dances.png` and `.webp` |
| `python3 art/siege/kits.py` | The mapping from each trait value to a kit ability. It checks that every value is assigned. | `app/public/siege/kits.json` |

`rig_preview.py` isn't run directly: `build_chars.py`, `build.py` and `build_legs.py` use it to play the rig and write the samples and previews.

## Older entry points

`build.py` and `build_fx.py` also keep the drawing code from earlier batches (batch 1, 2B, 3A, 3B and 3D), but don't run it by default. Some of that code reads files from the folder above `siege/`: `art/anchors.json` and `art/{boss,crews,themes,scenery,icons,ui}/`. Those files aren't in this copy. The app has copies of the folders in `app/public/art/`; `anchors.json` isn't in the repo.
