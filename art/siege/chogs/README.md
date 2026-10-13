# Chog template — wave 1

The shared contract is
[`chog-template.json`](../../../knock/app/public/siege/atlas/chog-template.json).
Start with [`preview-template.png`](preview-template.png), which puts the registered
head, six data-driven skin swatches, the full-body sample, the supplied reference
and real portraits beside each other. [`preview-portraits.png`](preview-portraits.png)
contains twelve source portraits, including bare spikes, hats, costume hoods and
different skin values. Keep `ref-fullbody.png` unchanged.

## For each trait-layer agent

1. Draw on a **transparent 256×320 canvas**, origin at the top left, facing right.
   Do not centre or rescale a layer to its own content. `eyeNear` is the large
   viewer-left eye. The top spike is `(108,72)`, leaving about 70px for tall hats.
   Headroom belongs to hats/aura; the chin and neck stay at the documented points.
2. Use **4px ink**, **4.5px for the outer silhouette**, and **2–3px details**,
   with round caps and joins. Ink `#181323`, cream `#f4eedd`, cream shadow
   `#e2c8ad`, cheek pink `#e958a1`, nose `#d94d8c`. Reuse the deterministic
   paper filter in `svg/base/face.svg`; keep physical layers flat and inked.
   The full-body example uses pink `#ef70b5` to match the supplied reference.
3. Use anchors from the JSON, not portrait coordinates. `art/anchors.json` is
   measured on cropped 1000px portraits and is **not** a transform into this
   new canvas. The far eye is smaller and higher; keep that asymmetry.
4. Name frames using the trait value: lowercase, replace runs outside
   `[a-z0-9]` with `-`, strip leading/trailing `-`, and use `none` when empty.
   The JSON includes the complete value→slug map. Case variants such as
   `JEET Cap`/`Jeet Cap` and `Boob Cap`/`BOOB Cap` share a frame: export it once.
5. Export `chog-<your-batch>.png` and `.json` into
   `knock/app/public/siege/atlas/`. Use **Phaser JSON Hash**, trimmed frames,
   no rotation, **2 transparent pixels of padding on every side**, and at most
   **2048×2048** per atlas. `sourceSize` is always `{w:256,h:320}`.
   `spriteSourceSize.x/y` preserves the original canvas position; its `w/h`
   equals the packed, trimmed `frame.w/h`. Do not include padding in `frame`.
   `meta.image` names the PNG relative to its JSON.
6. Optional frame metadata `"tint":"skin"` requests RGB multiplication using
   `skins.json`. Such art must be light greyscale: fill `#eeeeee`, shade
   `#cdcdcd`, highlight `#fafafa`, outline `#181818`. All other art is full colour.
   `base/back` is always tinted. Keep cream, pink cheeks and the nose in colour.
7. Optional `"clip":"faceMask"` clips to the documented polygon. Only opt in
   for art that should remain inside the cream patch. Lasers, tears, gum and
   rainbow streams may deliberately extend outside it; do not clip those
   entire frames. The polygon is slightly inset to protect the face outline.
8. Put cap text/logos in `head/<slug>/decal`, separate from the hat front.
   Every decal frame requires a **centre anchor and design-box size**:

   ```json
   "decal": {
     "anchor": {"x": 138, "y": 110},
     "size": {"w": 52, "h": 24}
   }
   ```

   Those numbers are an example cap placement, not a forced placement for
   every hat. The box must contain every painted pixel and its antialiasing.
   Keep lettering level. For left-facing output, the compositor moves the
   anchor to `(256-x,y)` and preserves the glyph pixels and their local offset.
   Bake neither a cap nor other geometry into the decal frame.

Frame names:

```text
eyes/<slug>
mouth/<slug>
head/<slug>/front
head/<slug>/back       (optional)
head/<slug>/decal      (optional, metadata required if present)
acc/<slug>/face
acc/<slug>/hand        (body rig; excluded from head composition)
aura/<slug>            (static)
aura/<slug>/0..3       (animation; this still compositor shows frame 0)
```

Back-to-front stack:

```text
aura → head-back → base/back → base/face → base/blush → base/nose
     → eyes → mouth → acc-face → head-front → decal
```

## Check your layers

From the repository root, choose a real id with your trait in `traits.json`:

```sh
python art/siege/chogs/compose.py 250 -o /tmp/c250.png
python art/siege/chogs/compose.py 250 --left -o /tmp/c250-left.png
python art/siege/chogs/compose.py 250 --window -o /tmp/c250-window.png
python art/siege/chogs/compose.py 250 --left --window -o /tmp/c250-left-window.png
```

Run those from any directory using the script's absolute path if needed.
The compositor indexes all `chog-*.json` atlases and opens only PNGs needed for
the selected id. It skips absent optional layers, substitutes placeholder eyes
and mouth, and reports pending trait art. Duplicate frame names, malformed
selected frames and missing selected PNGs are errors, not silent skips. None
is trait index `0`; look up all other values in the relevant `values` array.

`--window` produces a **160×160 transparent circular crop** at `faceWindow`;
the crop centre follows the facing. There is no baked ring or portrait bitmap.
`body/sample` is the **complete pink reference character**, including its
placeholder head. It is not another compositing layer. At scale `0.5`, its
visible head plus body is about **121px tall**, close to the existing hero rig.

## Rebuild and limits

```sh
python art/siege/chogs/build_chogs.py
```

Uses the already-installed Pillow and `rsvg-convert`. The drawing masters live
in that script; each run regenerates its seven SVGs, `chog-base.png/json`,
`chog-template.json`, and the two previews. The fixed paper seed and absence
of timestamps make repeat builds byte-identical on this toolchain. Other
trait atlases and application code are never written. The build runs a small
assert-based check for trim restoration, base composition, slugging, facing,
unmirrored decal registration, and an invalid id.

**Existing tint mismatch:** Pink, Origin, Red and Yellow all currently use
`#eee8d9` in `skins.json`; Black uses `#5d3120`. The six named swatches show
those exact values. They cannot produce six distinct hair colours without a
separate correction to that data. This task does not own `skins.json`.

This wave supplies the ordinary Chog base and placeholders. Skull,
Radioactive, legendary 1:1 art, hand/body traits, aura animation, animated skin
shine/cycles and game integration are outside this template build.
