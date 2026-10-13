#!/usr/bin/env python3
"""Rebuild the front-facing Chog masters, base atlas, template and rig previews.

Requires the existing Pillow + rsvg-convert toolchain. No network or game server.
"""
import sys
sys.dont_write_bytecode = True

import io
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from compose import Compositor, DATA, HERE, SIZE, slug

ATLAS = DATA / 'atlas'
INK, CREAM, BLUSH, PINK = '#181323', '#f4eedd', '#e958a1', '#ef70b5'
GREY = '#eeeeee'
STACK = ['aura', 'head-back', 'base/back', 'base/face', 'base/blush', 'base/nose',
         'eyes', 'mouth', 'acc-face', 'head-front', 'decal']
ANCHORS = {
    'eyeNear': [92, 170], 'eyeFar': [164, 170],
    'nose': [128, 179], 'mouth': [128, 204],
    'cheekNear': [63, 196], 'cheekFar': [193, 196],
    'browLine': [[74, 149], [182, 149]],
    'headTop': [128, 72],
    'hatSeat': {'centre': {'x': 128, 'y': 114}, 'rx': 82, 'ry': 20, 'tilt': 0},
    'chin': [128, 232], 'neck': [128, 230],
    'faceMask': [[52, 175], [57, 149], [69, 128], [83, 122], [98, 135],
                 [115, 121], [128, 131], [141, 121], [158, 135], [173, 122],
                 [187, 128], [201, 149], [204, 175], [201, 197], [188, 216],
                 [163, 224], [128, 228], [93, 224], [68, 216], [55, 197]],
    'faceWindow': {'centre': {'x': 128, 'y': 174}, 'r': 80},
}


def path(d, fill='none', stroke=INK, width=4):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def ellipse(x, y, rx, ry, fill, stroke='none', width=0, rotate=0):
    return (f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{width}" transform="rotate({rotate} {x} {y})"/>')


def drawings():
    back = path('M56 223 30 225 40 203 22 192 36 174 18 157 42 151 '
                '31 127 61 131 59 104 85 113 94 83 115 99 128 72 '
                '141 99 162 83 171 113 197 104 195 131 225 127 '
                '214 151 238 157 220 174 234 192 216 203 226 225 200 223 '
                'Q174 239 128 236 Q82 239 56 223Z', GREY, '#181818', 4.5)
    back += path('M39 200 54 211 Q85 229 128 230 Q171 229 202 211 '
                 'L217 200 211 206 221 221 199 219 Q172 236 128 233 '
                 'Q84 236 57 219 L35 221 45 206Z', '#cdcdcd', 'none', 0)
    back += path('M66 115 68 112 83 119M98 93 113 106M131 84 140 106 '
                 'M165 96 169 119', 'none', '#fafafa', 3)
    face = path('M48 176 Q48 145 66 125 L83 117 98 130 115 116 128 126 '
                '141 116 158 130 173 117 190 125 Q208 145 208 176 '
                'Q211 207 192 219 Q173 232 128 232 Q83 232 64 219 '
                'Q45 207 48 176Z', CREAM, INK, 4)
    face += path('M51 197 Q64 220 94 224 Q128 230 162 224 Q192 220 205 197 '
                 'Q202 214 192 219 Q173 232 128 232 Q83 232 64 219 '
                 'Q54 214 51 197Z', '#e2c8ad', 'none', 0)
    blush = ellipse(63, 196, 12, 10, BLUSH, rotate=15)
    blush += ellipse(193, 196, 12, 10, BLUSH, rotate=-15)
    nose = path('M122 177 Q128 175 134 177 Q134 180 128 183 Q122 180 122 177Z', '#d94d8c', 'none', 0)
    nose += path('M129 177 132 177 131 179', '#f59cbd', 'none', 0)
    eye = path('M77 153 Q94 154 109 163 L108 176 Q105 187 93 187 '
               'Q78 187 77 176 Q74 163 77 153Z', '#121216', 'none', 0)
    eyes = eye + f'<g transform="translate(256 0) scale(-1 1)">{eye}</g>'
    eyes += path('M74 149 Q90 155 109 158M182 149 Q166 155 147 158', 'none', INK, 3.5)
    eyes += ellipse(86, 163, 5, 7, '#fffdf4', rotate=20)
    eyes += ellipse(165, 163, 5, 7, '#fffdf4', rotate=20)
    eyes += ellipse(97, 179, 2, 2.4, '#fffdf4') + ellipse(174, 179, 2, 2.4, '#fffdf4')
    mouth = path('M109 199 Q128 209 147 199', 'none', INK, 3.6)
    mouth += path('M116 203 115 207M140 203 141 207', 'none', INK, 2.2)
    body = path('M91 277 76 280 79 290 62 294 76 303 98 293Z', PINK, INK, 4)
    body += path('M99 225 Q87 225 81 239 L75 259 91 265 102 241Z', PINK, INK, 4)
    body += path('M170 225 Q185 227 191 244 L195 260 179 265 165 240Z', PINK, INK, 4)
    body += path('M107 222 Q134 215 166 221 L177 260 176 293 '
                 '148 294 144 280 132 280 130 293 100 293 97 265Z', PINK, INK, 4)
    body += path('M163 232 169 266 165 289 175 290 177 261 170 238Z', '#dc529a', 'none', 0)
    body += path('M78 257 Q69 258 71 272 Q72 278 77 276 Q80 284 85 280 '
                 'Q91 283 93 277 Q99 277 96 265 L93 260Z', CREAM, INK, 3.6)
    body += path('M181 260 Q175 266 178 276 Q181 281 185 278 Q188 285 193 280 '
                 'Q201 282 200 274 Q205 271 199 260Z', CREAM, INK, 3.6)
    body += path('M105 292 Q99 294 98 302 L96 309 Q112 312 135 308 '
                 'L134 295 126 292Z', CREAM, INK, 4)
    body += path('M151 294 Q144 298 143 309 Q161 313 180 309 '
                 'Q184 304 177 298 L169 293Z', CREAM, INK, 4)
    body += path('M137 276 144 278', 'none', INK, 3)
    # The complete reference sample is deliberately pink, not a runtime skin swatch.
    sample = f'<g transform="translate(-9 0)">{body}</g>' + back.replace(GREY, PINK).replace('#cdcdcd', '#dc529a').replace('#fafafa', '#fa99c9').replace('#181818', INK)
    sample += face + blush + nose + eyes + mouth
    return {'base/back': back, 'base/face': face, 'base/blush': blush,
            'base/nose': nose, 'eyes/placeholder': eyes, 'mouth/placeholder': mouth,
            'body/sample': sample}


def svg(name, art):
    # Same fixed-seed paper filter as the existing Siege drawing masters.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320" viewBox="0 0 256 320">
<title>{name}</title><defs><filter id="paper" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="3" seed="12" result="noise"/>
<feColorMatrix in="noise" type="saturate" values="0" result="grey"/>
<feComposite in="grey" in2="SourceGraphic" operator="arithmetic" k1="0" k2=".18" k3="1" k4="-.09" result="grain"/>
<feComposite in="grain" in2="SourceAlpha" operator="in"/></filter></defs>
<g stroke-linecap="round" stroke-linejoin="round" filter="url(#paper)">{art}</g></svg>
'''


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_bytes(data if isinstance(data, bytes) else data.encode())
    temporary.replace(path)


def save_png(path, image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    write(path, buffer.getvalue())


def save_json(path, data):
    write(path, json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def template():
    traits = json.loads((DATA / 'traits.json').read_text())
    return {
        'version': 1,
        'canvas': {'width': 256, 'height': 320, 'origin': 'top-left', 'units': 'pixels', 'facing': 'right'},
        'conventions': {
            'nearFar': 'Near = viewer-left; far = viewer-right. Both eyes are equal-sized and level on this front-facing template. Anatomical names do not change when mirrored.',
            'headroom': 'Unhatted head starts at y=70 (headTop path vertex y=72). Tall hats/aura may use y=2..70; keep 2px clear at canvas edges.',
            'points': 'Point anchors are [x,y]. Ellipse/circle centres use {x,y}. Tilt is degrees clockwise in screen coordinates.',
            'left': 'Mirror geometry about x=128: xLeft=256-x. Raster pixels reverse with xPixelLeft=255-xPixel. Mirror decal centres only, never their glyph pixels.',
            'registration': 'Front-facing head with a centred cream patch, equal eyes and spikes crowning both sides. Face centre, nose, mouth, hat seat and neck share x=128. Re-fit traits to these anchors; old portrait asymmetry is not retained.',
        },
        'anchors': ANCHORS,
        'layerStack': STACK,
        'frameNaming': {
            'slugRule': "lowercase; replace each run of characters outside [a-z0-9] with '-'; trim '-'; empty result becomes 'none'",
            'slugRegex': '[^a-z0-9]+',
            'patterns': ['eyes/<slug>', 'mouth/<slug>', 'head/<slug>/front', 'head/<slug>/back',
                         'head/<slug>/decal', 'acc/<slug>/face', 'acc/<slug>/hand', 'aura/<slug>', 'aura/<slug>/<0..3>'],
            'optional': ['head/<slug>/back', 'head/<slug>/decal'],
            'values': {key: {value: slug(value) for value in values} for key, values in traits['values'].items()},
            'aliases': 'Case/punctuation variants intentionally share a frame (e.g. JEET Cap and Jeet Cap). Export each slug once across all atlases.',
        },
        'atlas': {
            'format': 'Phaser JSON Hash', 'glob': 'chog-*.json', 'templateExcluded': 'chog-template.json',
            'maxWidth': 2048, 'maxHeight': 2048, 'padding': 2, 'rotated': False, 'trimmed': True,
            'sourceSize': {'w': 256, 'h': 320},
            'spriteSourceSize': 'x/y = trim origin in the 256x320 canvas; w/h = trimmed pixel dimensions, equal to frame.w/h. It is NOT 256x320 after trimming.',
            'placement': 'Blit atlas frame at spriteSourceSize.x/y. No centring of trimmed images. Padding is outside frame rectangles.',
            'metadata': 'Per-frame optional tint: skin and clip: faceMask; required decal object on every */decal. meta.image names the PNG relative to its JSON.',
            'example': {'frame': {'x': 2, 'y': 2, 'w': 40, 'h': 16}, 'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': 118, 'y': 102, 'w': 40, 'h': 16}, 'sourceSize': {'w': 256, 'h': 320}},
        },
        'decals': {
            'rule': 'Every head/<slug>/decal supplies frame.decal.anchor and frame.decal.size. Anchor is the centre of its design box in head space; size encloses all nontransparent pixels, including antialiasing.',
            'exampleFrame': 'head/chog-cap/decal',
            'exampleMetadata': {'decal': {'anchor': {'x': 138, 'y': 110}, 'size': {'w': 52, 'h': 24}}},
            'leftPlacement': 'Keep pixels unchanged; translate the decal by (256 - 2*anchor.x, 0). The template example centre moves from (138,110) to (118,110).',
            'authoring': 'Separate text/logos from the cap front. Keep lettering level within its design box; do not bake mirrored text into head-front.',
        },
        'tinting': {
            'source': '../skins.json', 'method': 'multiply RGB by tint RGB / 255; preserve alpha (Phaser setTint)',
            'skinFrames': ['base/back'], 'metadata': {'tint': 'skin'},
            'greyscale': {'fill': GREY, 'shade': '#cdcdcd', 'highlight': '#fafafa', 'outline': '#181818'},
            'fullColor': 'All other frames, including cream face, cheeks, nose, eyes, mouths, decal and body/sample.',
            'staticSample': 'Use tint for the still compositor; skin cycle/shine animation belongs to the runtime.',
            'sourceWarning': 'Preview swatches read current tint and face values from skins.json. This build never edits that palette.',
        },
        'style': {'outline': INK, 'primaryStroke': 4, 'silhouetteStroke': 4.5, 'detailStroke': [2, 3],
                  'linecaps': 'round', 'linejoins': 'round', 'cream': CREAM, 'faceShadow': '#e2c8ad',
                  'blush': BLUSH, 'nose': '#d94d8c', 'referencePink': PINK,
                  'paperGrain': 'Use the SVG paper filter in svg/base/face.svg (fixed seed 12, frequency .76, 3 octaves). No blur, glow or 3D bevel on physical inked layers.',
                  'eyes': 'Both eye shapes are about 34x34, level at y=170 and symmetric about x=128. White highlights stay visible at 120px full-body height.'},
        'bodySample': {
            'frame': 'body/sample', 'referenceOnly': True, 'includesHead': True,
            'description': 'Complete pink onesie Chog with cream hands/feet and placeholder face; excluded from the head compositor. Do not stack its baked head under trait layers.',
            'neck': ANCHORS['neck'], 'groundY': 312, 'displayVisibleHeight': 120, 'displayScale': 0.5,
            'rig': 'Current hero rig R=30. Sample visible head+body is about 242 source pixels; scale .5 gives about 121px. This is proportion reference, not rig integration.',
        },
        'compositor': {
            'command': 'python art/siege/chogs/compose.py 250 [--left] [--window] -o /tmp/c250.png',
            'traits': '../traits.json: keys order defines each chogs[id] index; index 0 means none',
            'missing': 'Missing optional layers are skipped; missing eyes/mouth use their placeholders. CLI lists pending traits. Existing malformed/duplicate selected frames fail loudly.',
            'animation': 'Prefer aura/<slug> if present; otherwise render aura/<slug>/0. No animation player in this still-image tool.',
            'clipping': 'Opt in per frame with clip: faceMask. Do not clip whole laser, tear, gum or rainbow frames that intentionally extend outside the face.',
            'window': 'After composition and facing, crop the 160x160 faceWindow bounding box and apply an antialiased circular alpha mask. Left crops at mirrored centre.',
            'hand': 'acc/<slug>/hand is reserved for the body rig and is not placed on the head; reported if no face frame is present.',
            'forms': 'This wave supplies the ordinary Chog base only. Skull, Radioactive and legendary 1:1 base art are not supplied here.',
        },
        'references': ['art/siege/chogs/ref-fullbody.png', 'art/anchors.json', 'art/siege/README.md',
                       'art/siege/preview-rig-overview.png', 'knock/app/public/chogs-256/{id}.webp'],
    }


def pack(images):
    atlas = Image.new('RGBA', (512, 1024))
    frames, x, y, row = {}, 2, 2, 0
    for name, image in sorted(images.items(), key=lambda item: -item[1].getbbox()[3] + item[1].getbbox()[1]):
        box = image.getbbox()
        tile = image.crop(box)
        w, h = tile.size
        if x + w + 2 > atlas.width:
            x, y, row = 2, y + row + 4, 0
        atlas.alpha_composite(tile, (x, y))
        frame = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                 'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h},
                 'sourceSize': {'w': 256, 'h': 320}, 'pivot': {'x': .5, 'y': .5}}
        if name == 'base/back':
            frame['tint'] = 'skin'
        if name == 'body/sample':
            frame['referenceOnly'] = True
        frames[name] = frame
        x, row = x + w + 4, max(row, h)
    height = 2 ** math.ceil(math.log2(y + row + 2))
    atlas = atlas.crop((0, 0, 512, height))
    assert max(atlas.size) <= 2048
    save_png(ATLAS / 'chog-base.png', atlas)
    save_json(ATLAS / 'chog-base.json', {'frames': frames, 'meta': {
        'app': 'Candy Siege Chog drawing masters', 'version': '1', 'image': 'chog-base.png',
        'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1', 'padding': 2,
    }})


def font(size):
    return ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf', size)


def previews(compositor):
    image = Image.new('RGBA', (1600, 1190), '#f3eee3')
    d = ImageDraw.Draw(image)
    d.text((32, 22), 'CHOG / WAVE 1B / FRONT-FACING', font=font(27), fill=INK)
    d.text((32, 59), 'Centred face + crown  /  level, equal eyes  /  origin: top left', font=font(16), fill='#655a63')
    x0, y0, scale = 136, 114, 1.65
    head = compositor.head({}, PINK)
    image.alpha_composite(head.resize((round(256 * scale), round(320 * scale)), Image.Resampling.LANCZOS), (x0, y0))
    def point(p):
        return (round(x0 + p[0] * scale), round(y0 + p[1] * scale))
    def label(name, p, at, color='#225a9c'):
        q = point(p)
        end = (at[0] + (96 if at[0] < x0 else -8), at[1] + 8)
        d.line([q, end], fill=color, width=1)
        d.ellipse((q[0]-3, q[1]-3, q[0]+3, q[1]+3), fill=color)
        d.text(at, name, fill=color, font=font(13))
    d.rectangle((x0, y0, x0 + 256 * scale, y0 + 320 * scale), outline='#bdb5a9', width=1)
    for y in range(0, 321, 40):
        d.text((x0-30, y0+y*scale-5), str(y), font=font(10), fill='#92877c')
    polygon = [point(p) for p in ANCHORS['faceMask']]
    d.line(polygon + polygon[:1], fill='#278274', width=2)
    fw = ANCHORS['faceWindow'];cx, cy, r = fw['centre']['x'], fw['centre']['y'], fw['r']
    d.ellipse((*point((cx-r, cy-r)), *point((cx+r, cy+r))), outline='#5484b0', width=2)
    seat = ANCHORS['hatSeat'];a = math.radians(seat['tilt']);sc = seat['centre']
    ellipse_points = []
    for step in range(65):
        t = step * math.tau / 64;xx, yy = seat['rx'] * math.cos(t), seat['ry'] * math.sin(t)
        ellipse_points.append(point((sc['x']+xx*math.cos(a)-yy*math.sin(a), sc['y']+xx*math.sin(a)+yy*math.cos(a))))
    d.line(ellipse_points, fill='#b37828', width=2)
    d.line([point(p) for p in ANCHORS['browLine']], fill='#9d437b', width=2)
    for name, at in [('headTop',(28,195)), ('eyeNear',(28,347)), ('cheekNear',(28,411)),
                     ('chin',(28,516)), ('neck',(28,576)), ('eyeFar',(570,334)),
                     ('nose',(570,377)), ('cheekFar',(570,418)), ('mouth',(570,465))]:
        label(name, ANCHORS[name], at)
    label('hatSeat', [sc['x'],sc['y']], (28,268), '#b37828')
    label('browLine', ANCHORS['browLine'][1], (570,285), '#9d437b')
    label('faceMask', ANCHORS['faceMask'][13], (570,512), '#278274')
    label('faceWindow', [cx+r,cy], (570,566))
    d.text((136, 660), '4–4.5px outer ink   /   2–3px details', font=font(14), fill=INK)
    d.text((710, 112), 'EXACT skins.json TINTS', font=font(20), fill=INK)
    for n, skin in enumerate(('Pink','Origin','Red','Black','Yellow','Metal')):
        x, y = 710 + n % 3 * 290, 155 + n // 3 * 246
        skin_data = compositor.skins[skin]
        color = skin_data['tint']
        sprite = compositor.head({}, color, face=skin_data.get('face')).crop((0, 54, 256, 247))
        image.alpha_composite(sprite, (x, y))
        d.text((x+24,y+197), skin, font=font(16), fill=INK)
        d.text((x+24,y+219), color, font=font(12), fill='#655a63')
    d.text((710, 670), 'Current skin tints + face colours; base layers only.', font=font(15), fill='#655a63')
    d.text((710, 694), 'Pink full-body reference below; four idle costumes in preview-on-rig.png.', font=font(13), fill='#655a63')
    d.line((32,735,1568,735), fill='#cfc5b6', width=2)
    d.text((32,755), 'SILHOUETTE & SCALE CHECK', font=font(18), fill=INK)
    sample = compositor.layer('body/sample', PINK)
    image.alpha_composite(sample, (32,787))
    d.text((44,1110), 'body/sample · complete reference', font=font(13), fill=INK)
    small = sample.resize((128,160), Image.Resampling.LANCZOS)
    image.alpha_composite(small, (299,917))
    d.text((288,1110), '~120px visible height', font=font(13), fill=INK)
    plain = head.crop((0,54,256,247))
    image.alpha_composite(plain, (446,861))
    d.text((458,1110), 'Same head · no round frame', font=font(13), fill=INK)
    with Image.open(HERE/'ref-fullbody.png') as source:
        ref = source.convert('RGBA');ref.thumbnail((215,316), Image.Resampling.LANCZOS)
        image.alpha_composite(ref, (742,791))
    d.text((742,1110), 'Provided full-body reference', font=font(13), fill=INK)
    for i, token in enumerate((250,39)):
        with Image.open(DATA.parent/'chogs-256'/f'{token}.webp') as source:
            image.alpha_composite(source.convert('RGBA').resize((230,230)), (1010+i*266,847))
        d.text((1010+i*266,1110), f'Official portrait #{token}', font=font(13), fill=INK)
    d.text((32,1150), 'Eyes / mouth are placeholders. Body is reference only. No gameplay integration in this wave.', font=font(14), fill='#655a63')
    save_png(HERE/'preview-template.png', image)


def rig_preview(compositor):
    sys.path.insert(0, str(HERE.parent))
    from rig_preview import Player
    rig = json.loads((ATLAS/'rig.json').read_text())
    player = Player(rig)
    centre = ANCHORS['faceWindow']['centre']
    player.heads[250] = (compositor.head({}, PINK), (centre['x'], centre['y']), .44)
    sheet = Image.new('RGBA', (1280, 740), '#33283f')
    d = ImageDraw.Draw(sheet)
    d.text((28, 22), 'FRONT-FACING CHOG / SAME HEAD, FOUR IDLE BODIES', font=font(23), fill=CREAM)
    d.text((28, 60), f"Player idle @ 0ms  /  faceWindow ({centre['x']}, {centre['y']}) on head joint  /  head scale 0.44", font=font(16), fill='#c9bfd1')
    for i, costume in enumerate(('pitch-deck', 'fastball', 'scepter', 'tickle')):
        x = i * 320
        d.text((x+36, 108), costume, font=font(19), fill='#efc76a')
        large = player.draw(costume, 'idle', 0, color=CREAM, size=(320, 390), origin=(150, 363), scale=2)
        sheet.alpha_composite(large, (x, 137))
        small = player.draw(costume, 'idle', 0, color=CREAM, size=(160, 175), origin=(75, 158), scale=1)
        sheet.alpha_composite(small, (x+80, 535))
    d.text((28, 714), 'Upper: 2x inspection. Lower: 1x rig scale. Base + placeholders only; no trait layers or game changes.', font=font(14), fill='#c9bfd1')
    save_png(HERE/'preview-on-rig.png', sheet)


def self_check(compositor, images):
    from PIL import ImageChops, ImageOps
    assert slug('  JEET / Cap!! ') == 'jeet-cap' and slug('') == 'none'
    assert compositor.values(250)['Head'] == 'Orange Bucket Cap'
    cx = ANCHORS['faceWindow']['centre']['x']
    assert ANCHORS['eyeNear'][1] == ANCHORS['eyeFar'][1]
    assert ANCHORS['eyeNear'][0] + ANCHORS['eyeFar'][0] == 2 * cx
    assert all(ANCHORS[name][0] == cx for name in ('nose', 'mouth', 'neck', 'chin', 'headTop'))
    assert ANCHORS['hatSeat']['centre']['x'] == cx and ANCHORS['hatSeat']['tilt'] == 0
    for name, source in images.items():
        restored = compositor.layer(name, '#ffffff')
        assert ImageChops.difference(source, restored).getbbox(alpha_only=False) is None, name
    right = compositor.compose(250)
    assert right.size == SIZE and right.getbbox()
    assert compositor.compose(250, window=True).size == (160,160)
    # No decal in the base: both facing/window paths must be exact reflections.
    assert ImageChops.difference(compositor.head({},'#ffffff',left=True),
                                ImageOps.mirror(compositor.head({},'#ffffff'))).getbbox(alpha_only=False) is None
    # An asymmetric synthetic decal verifies the registration rule without publishing test art.
    key = 'head/check/decal';tile = Image.new('RGBA',(8,4));tile.putpixel((0,0),(255,0,0,255))
    tile.putpixel((7,3),(0,255,0,255));temporary = ATLAS/'__self_check__.png'
    compositor.images[temporary] = tile
    compositor.frames[key] = (ATLAS/'__self_check__.json',{'image':temporary.name},{
        'frame':{'x':0,'y':0,'w':8,'h':4},'spriteSourceSize':{'x':146,'y':100,'w':8,'h':4},
        'sourceSize':{'w':256,'h':320},'decal':{'anchor':{'x':150,'y':102},'size':{'w':8,'h':4}}})
    moved = compositor.layer(key,'#ffffff',left=True)
    assert moved.getpixel((102,100)) == (255,0,0,255) and moved.getpixel((109,103)) == (0,255,0,255)
    del compositor.frames[key], compositor.images[temporary]
    try:
        compositor.values(-1)
    except ValueError:
        pass
    else:
        raise AssertionError('unknown ids must fail')


def main():
    images = {}
    for name, drawing in drawings().items():
        filename = name.split('/')[1] if name.startswith('base/') else name.replace('/', '-')
        master = HERE/'svg'/'base'/f'{filename}.svg'
        write(master,svg(name,drawing))
        rendered = subprocess.run(['rsvg-convert',str(master)],check=True,capture_output=True).stdout
        images[name] = Image.open(io.BytesIO(rendered)).convert('RGBA')
    pack(images)
    save_json(ATLAS/'chog-template.json',template())
    compositor = Compositor()
    self_check(compositor, images)
    previews(compositor)
    rig_preview(compositor)
    print(f'Built {len(images)} frames; template, trim/tint restoration, facing, decal and base composition checks passed.')
    print(f'Preview: {HERE / "preview-template.png"}')
    print(f'Rig check: {HERE / "preview-on-rig.png"}')


if __name__ == '__main__':
    main()
