#!/usr/bin/env python3
"""Regenerate only hero legs, staged atlases, walk samples and review images."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE.parent), str(HERE.parent / 'chogs')]
from PIL import Image, ImageChops, ImageDraw
import build as b
import build_chars as chars
import rig_preview as rp
import compose as cp

PUBLIC = b.OUT
ATLAS = HERE / 'atlas'
ATLAS.mkdir(parents=True, exist_ok=True)
rig = json.loads((PUBLIC / 'atlas/rig.json').read_text())
protected = [PUBLIC / 'atlas' / f'hero-{c}{density}.{ext}'
             for c in rig['costumes'] for density in ('', '@2x') for ext in ('png', 'json')]
protected += [PUBLIC / 'atlas' / n for n in ('rig.json', 'rig-samples.json')]
hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
renderer = shutil.which('rsvg-convert')
assert renderer

# Reuse the drawing masters, emitting only the leg SVGs owned by this change.
add, add3 = chars.add, b.add3
chars.add = lambda atlas, name, *args, **kw: add(atlas, name, *args, **kw) if name.startswith('rig/leg-') else None
b.add3 = lambda atlas, name, *args, **kw: add3(atlas, name, *args, **kw) if name.startswith('rig/leg-') else None
for costume in chars.COSTUMES:
    chars.hero_parts(costume)
for token, spec in json.loads((PUBLIC / 'legends.json').read_text())['legends'].items():
    b.legend_parts(token, spec)
for crew in b.CREW_COLORS:
    b.crew_parts(crew)
masters = {**chars.FRAMES, **b.B3}
assert set(masters) == {'hero-' + c for c in rig['costumes']}
changed = 0
for atlas, entries in masters.items():
    rendered = {name: b.render(entry[2], entry[0] * 2, entry[1] * 2, renderer)
                for name, entry in entries.items()}
    for suffix in ('', '@2x'):
        source = PUBLIC / 'atlas' / (atlas + suffix + '.json')
        data = json.loads(source.read_text())
        original = Image.open(source.with_suffix('.png')).convert('RGBA')
        output = original.copy()
        untouched = Image.new('L', output.size, 255)
        for name, high in rendered.items():
            f = data['frames'][name]['frame']
            x, y, w, h = (f[k] for k in ('x', 'y', 'w', 'h'))
            im = high if suffix else high.resize((w, h), Image.Resampling.LANCZOS)
            assert im.size == (w, h)
            if name.endswith('-skin'):
                red, green, blue, _ = im.split()
                assert not ImageChops.difference(red, green).getbbox()
                assert not ImageChops.difference(red, blue).getbbox()
            assert im.getchannel('A').crop((0, 0, w, 1)).getextrema()[1] < 220
            output.paste(im, (x, y))
            ImageDraw.Draw(untouched).rectangle((x, y, x+w-1, y+h-1), fill=0)
        diff = ImageChops.difference(output, original)
        assert all(not ImageChops.multiply(channel, untouched).getbbox() for channel in diff.split())
        b.atomic_output(ATLAS / source.with_suffix('.png').name, output)
        b.atomic_output(ATLAS / source.name, source.read_bytes())
        changed += len(rendered)
    print(atlas, 'staged at 1x and 2x', flush=True)

old_player = rp.Player(rig)
new_rig = json.loads(json.dumps(rig))
new_rig['clips']['walk'] = chars.rig_data()['clips']['walk']
for name, clip in rig['clips'].items():
    assert all(new_rig['clips'][name][k] == clip[k] for k in ('ms', 'loop', 'events'))
    if name != 'walk':
        assert new_rig['clips'][name] == clip
assert new_rig['costumes'] == rig['costumes']
rp.self_check(new_rig)
b.atomic_output(ATLAS / 'rig.json', json.dumps(new_rig, separators=(',', ':')) + '\n')
# Same resolver, sampling times and rounding as rig_preview.generate().
samples = {c: {name: [{'t': round(i * clip['ms'] / 7, 6),
                      'parts': {p: {k: round(v, 6) for k, v in tr.items()}
                                for p, tr in rp.resolve(new_rig, c, name, i * clip['ms'] / 7).items()}}
                     for i in range(8)] for name, clip in new_rig['clips'].items()}
           for c in new_rig['costumes']}
b.atomic_output(ATLAS / 'rig-samples.json', json.dumps(samples, separators=(',', ':')) + '\n')

# Player reads the staged atlas path; the trait compositor reads existing head art.
b.OUT = HERE
new_player = rp.Player(new_rig)
comp = cp.Compositor()
win = comp.template['anchors']['faceWindow']['centre']
head = comp.compose(1)
skin = comp.skins[comp.values(1)['Skin']]
for player in (old_player, new_player):
    player.heads[1] = (head, (win['x'], win['y']), .44)
selected = ['pitch-deck', 'fastball', 'scepter', 'tickle', 'mascot-duck',
            'ball-chain', 'legend-1881', 'crew-ghosts']
cw, ch, label = 210, 210, 164
sheet = Image.new('RGB', (label + 6*cw, 74 + len(selected)*ch), '#33283f')
draw = ImageDraw.Draw(sheet)
draw.text((18, 10), 'FRONT-FACING LEGS / same trait-built head, costume and hip joints', font=b.font(19), fill=b.CREAM)
for col, title in enumerate(('OLD idle', 'NEW idle', 'walk 0 ms', 'walk 150 ms', 'walk 300 ms', 'walk 450 ms')):
    draw.text((label + col*cw + 40, 46), title, font=b.font(14), fill=b.GOLD)
for row, costume in enumerate(selected):
    top = 74 + row*ch
    draw.text((10, top + 95), costume, font=b.font(14), fill=b.GOLD)
    color = skin['tint'] if costume == 'tickle' else skin.get('face', b.CREAM)
    for col, (player, clip, t) in enumerate([(old_player, 'idle', 0), (new_player, 'idle', 0)] +
                                          [(new_player, 'walk', t) for t in (0, 150, 300, 450)]):
        im = player.draw(costume, clip, t, token=1, color=color,
                         size=(cw, ch), origin=(105, 189), scale=1.3)
        sheet.paste(im, (label + col*cw, top), im)
    draw.line((0, top+ch-1, sheet.width, top+ch-1), fill='#544361')
b.atomic_output(HERE / 'preview-legs.png', sheet)
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == value for p, value in hashes.items())
report = {'costumes': list(rig['costumes']), 'leg_frames_rendered_at_both_densities': changed,
          'frame_sizes_and_pivots_changed': False, 'non_leg_atlas_pixels_unchanged': True,
          'public_assets_unchanged': True, 'phaser_easing_and_clip_checks': 'passed',
          'walk_ms': 600, 'step_events': [0, 300], 'samples': sum(len(v)*8 for v in samples.values())}
b.atomic_output(HERE / 'legs-report.json', json.dumps(report, indent=2) + '\n')
print('PASS:', len(rig['costumes']), 'costumes; public hashes unchanged;', HERE / 'preview-legs.png')
