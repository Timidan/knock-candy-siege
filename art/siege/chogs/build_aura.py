#!/usr/bin/env python3
"""Build only the aura/form masters, atlas and proof sheet; no runtime edits."""
import sys
sys.dont_write_bytecode = True

import hashlib
import io
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from build_chogs import INK, ellipse, font, path, save_json, save_png, svg, write
from compose import Compositor, DATA, HERE, SIZE, slug

# Three actual portraits inspected per value where available; White Aura has one holder.
REFERENCES = {
    'Aqua Aura': [933, 1276, 1401], 'Royal Blue Aura': [315, 368, 407],
    'Light Purple': [170, 222, 267], 'Cool Aura': [80, 275, 337],
    'Purple': [124, 215, 360], 'Wind': [1430, 1642, 1702],
    'Fire': [58, 228, 466], 'Clean': [327, 1232, 1381],
    'Royal Aura': [39, 671, 878], 'Violet': [37, 328, 392],
    'Smoke': [70, 459, 760], 'Rose Aura': [90, 111, 121],
    'Burning Aura': [364, 450, 523], 'Pink Mist': [61, 896, 1764],
    'Fiery Aura': [68, 394, 480], 'Mint': [625, 651, 745],
    'Yellow Aura': [133, 550, 1127], 'Rose Scent': [206, 400, 881],
    'Electric Shock': [255, 1832], 'White Aura': [347],
    'Green Aura': [833, 377, 767], 'Royal Blue': [663, 1508, 1587],
}
SPECIAL_REFS = {'Skull': [111, 291, 315], 'Radioactive': [70, 1642, 1695],
                'Metal': [291, 262, 926], 'Jade': [1313, 365, 629],
                'Multi Colored': [1695, 648, 783]}

# NFT aura fields have different edge languages: fragments, curls, or rounded mist.
PALETTES = {
    'Aqua Aura': ('curl', '#19d9dc', '#aafaff', '#12899f'),
    'Royal Blue Aura': ('curl', '#2844ee', '#9eb5ff', '#292b99'),
    'Light Purple': ('shards', '#d5a5ed', '#f4d5ff', '#a779c5'),
    'Cool Aura': ('shards', '#9ce8ed', '#e9ffff', '#59bbc9'),
    'Purple': ('curl', '#cb31ec', '#f0b4ff', '#8624b6'),
    'Wind': ('wind', '#d7ec83', '#f7ffcb', '#95b747'),
    'Fire': ('flame', '#ff4331', '#ffec89', '#bd312b'),
    'Clean': ('spark', '#fff9e9', '#ffffff', '#d2d8c9'),
    'Royal Aura': ('shards', '#2949fb', '#bbd3ff', '#243aa6'),
    'Violet': ('shards', '#d631ef', '#f4b2ff', '#a024ba'),
    'Smoke': ('mist', '#e4e3dc', '#fffff2', '#babdb6'),
    'Rose Aura': ('curl', '#e4acb9', '#ffe7e9', '#b87896'),
    'Burning Aura': ('flame', '#ffb634', '#fff1ae', '#d98723'),
    'Pink Mist': ('mist', '#f0a9dc', '#ffe3f6', '#cc78b6'),
    'Fiery Aura': ('curl', '#ff3947', '#ffc4ba', '#c32b47'),
    'Mint': ('curl', '#b2e89d', '#e9ffcb', '#78b57f'),
    'Yellow Aura': ('curl', '#eade8c', '#fff9c5', '#bfb263'),
    'Rose Scent': ('petal', '#f093c4', '#ffe2f1', '#c567a3'),
    'Electric Shock': ('electric', '#ffda3b', '#fffbc3', '#d19c25'),
    'White Aura': ('mist', '#f9faf2', '#ffffff', '#d2dedb'),
    'Green Aura': ('curl', '#b1e947', '#edffb7', '#73b73a'),
    'Royal Blue': ('shards', '#3885dd', '#bce2ff', '#2863b0'),
}


def group(art, opacity):
    return f'<g opacity="{opacity}">{art}</g>'


def star(x, y, r, color):
    return path(f'M{x} {y-r} Q{x+2} {y-2} {x+r} {y} '
                f'Q{x+2} {y+2} {x} {y+r} Q{x-2} {y+2} {x-r} {y} '
                f'Q{x-2} {y-2} {x} {y-r}Z', color, 'none', 0)


def effect(kind, color, light, edge, pose):
    """Inked, cel-colour effects surrounding the head and tapering behind the body."""
    art = group(ellipse(128, 174, 118, 116, color), .13)
    art += group(ellipse(128, 198, 84, 103, color), .1)
    if kind in ('curl', 'flame'):
        # The two states bend the same tongues, without popping their root positions.
        for side in (0, 1):
            tongues = ''
            for i, (x, y, scale) in enumerate([(24, 244, .86), (12, 193, .83),
                                              (27, 139, .94), (63, 94, .8)]):
                bend = (7 if pose else -4) * (-1 if i % 2 else 1)
                d = (f'M0 20 C-17 8 -16 -5 -8 -16 Q{-1+bend} -27 -5 -41 '
                     f'Q{19+bend} -22 7 -7 C-1 2 4 10 14 5 '
                     'Q26 23 8 34 Q0 40 -8 32 Q10 34 0 20Z')
                tongues += (f'<g transform="translate({x} {y}) scale({scale})">'
                            + path(d, color, edge, 2.4)
                            + path('M0 20 Q-6 8 2 -3 Q-4 17 11 21', 'none', light, 3)
                            + '</g>')
            art += f'<g transform="translate({256 if side else 0} 0) scale({-1 if side else 1} 1)">{tongues}</g>'
        art += path(f'M82 85 Q76 65 {86+pose*5} 49 Q100 61 107 85 '
                    f'M149 85 Q{156-pose*5} 61 170 49 Q180 65 174 85',
                    'none', color, 7)
        if kind == 'flame':
            art += path('M55 270 Q37 251 49 229 Q50 244 64 243 Q60 223 72 214 '
                        'Q71 244 90 261 M187 265 Q212 255 210 230 Q201 242 190 239 '
                        'Q196 218 180 211 Q185 241 169 262', color, edge, 2.5)
            art += path('M58 258 59 247 M191 255 201 245', 'none', light, 3)
    elif kind in ('shards', 'spark', 'petal', 'electric'):
        # Broad fractured ring is intentionally open at the feet.
        art += path('M43 250 19 230 26 212 8 195 20 178 8 159 28 145 '
                    '16 122 43 118 41 97 65 99 87 72 108 84 128 53 '
                    '148 84 169 72 191 99 215 97 213 118 240 122 '
                    '228 145 248 159 236 178 248 195 230 212 237 230 213 250 '
                    '181 273 Q209 247 219 219 L216 207 231 193 219 177 '
                    'L230 162 211 149 222 132 199 132 200 112 184 118 '
                    'L166 91 148 104 128 76 108 104 90 91 72 118 '
                    'L56 112 57 132 34 132 45 149 26 162 37 177 '
                    'L25 193 40 207 37 219 Q47 247 75 273Z', color, 'none', 0)
        for i, (x, y) in enumerate([(22, 94), (53, 68), (94, 46), (162, 46),
                                    (203, 68), (234, 94), (239, 252), (17, 252)]):
            y += (3 if pose else 0) * (-1 if i % 2 else 1)
            if kind == 'spark':
                art += star(x, y, 7 + i % 3, light)
            elif kind == 'petal':
                art += path(f'M{x} {y-7} Q{x+12} {y} {x+2} {y+8} Q{x-10} {y} {x} {y-7}Z', color, edge, 1.5)
            else:
                art += path(f'M{x-4} {y-5} {x+5} {y-3} {x+3} {y+6} {x-6} {y+3}Z', color, 'none', 0)
                art += path(f'M{x-2} {y-2} {x+1} {y-1}', 'none', light, 2)
        if kind == 'electric':
            art += path(f'M{43+pose*3} 107 29 147 44 143 26 183 34 159 21 166 36 114Z '
                        'M213 102 237 139 223 139 241 177 231 152 219 156 206 120Z',
                        light, edge, 2.5)
            art += path('M53 239 38 258 54 254 48 276 M212 212 229 228 217 231 224 249',
                        'none', light, 3)
        else:
            art += path('M29 133 36 130 M21 170 26 166 M232 192 235 186 '
                        'M179 100 187 99 M58 239 64 247', 'none', light, 3)
    elif kind == 'wind':
        for i, (x, y) in enumerate([(15, 162), (28, 229), (64, 86), (161, 86)]):
            art += path(f'M{x} {y} C{x-7} {y-17} {x+18} {y-29} {x+27} {y-16} '
                        f'Q{x+30} {y-8} {x+20} {y-8}', 'none', color, 6)
        art += path(f'M27 {184+pose*3} Q1 234 52 257 Q128 295 214 252 '
                    'M178 92 Q240 103 241 162 Q244 191 227 200', 'none', color, 8)
        art += path('M18 208 Q30 235 65 244 M207 109 Q230 126 231 153 '
                    'M92 268 Q148 283 185 263', 'none', light, 3)
        art += path('M46 272 Q84 305 190 278 M58 283 Q122 311 164 296', 'none', color, 3)
    elif kind == 'mist':
        for i, (x, y, rx, ry) in enumerate([(24, 127, 18, 25), (21, 184, 16, 24),
                                           (43, 233, 24, 20), (76, 271, 24, 17),
                                           (180, 271, 24, 17), (213, 233, 24, 20),
                                           (235, 184, 16, 24), (232, 127, 18, 25),
                                           (78, 69, 23, 19), (178, 69, 23, 19)]):
            y += (pose * 3) * (-1 if i % 2 else 1)
            puff = path('M-15 14 C-29 2 -21 -9 -12 -9 C-17 -25 4 -28 10 -17 '
                        'C25 -19 27 -1 17 7 C25 21 8 29 2 20 '
                        'C-5 28 -24 27 -15 14Z', color, edge, 2)
            art += group(f'<g transform="translate({x} {y}) scale({rx/28} {ry/28})">{puff}</g>', .72)
            art += path(f'M{x-rx/2} {y-ry/3} Q{x-rx/2} {y-ry*.7} {x+2} {y-ry*.65}', 'none', light, 3)
        for x, y in [(42, 43), (115, 37), (229, 79), (15, 256), (215, 290)]:
            art += ellipse(x, y+pose*2, 4, 6, color)
    if kind in ('curl', 'flame'):
        return f'<g transform="translate(128 0) scale(.92 1) translate(-128 0)">{art}</g>'
    return art


def skull():
    # Centred jaw and forehead; equal sockets fit the new 34px eyes at y=170.
    art = path('M49 171 Q47 140 66 127 Q82 113 105 119 Q128 111 151 119 '
               'Q174 113 190 127 Q209 140 207 171 Q208 193 189 201 '
               'L179 209 179 217 Q178 230 158 231 L98 231 Q78 230 77 217 '
               'L77 209 67 201 Q48 193 49 171Z', '#eeeeee', '#181818', 4)
    art += path('M52 186 Q61 198 81 201 L85 216 Q128 230 171 216 '
                'L175 201 Q195 198 204 186 Q203 197 189 201 L179 209 179 217 '
                'Q178 230 158 231 L98 231 Q78 230 77 217 L77 209 67 201Z', '#cdcdcd', 'none', 0)
    socket = path('M70 163 Q70 146 92 145 Q114 146 115 163 '
                  'L114 179 Q112 194 92 194 Q72 194 70 179Z', '#858585', '#181818', 3)
    art += socket + f'<g transform="translate(256 0) scale(-1 1)">{socket}</g>'
    art += path('M123 181 Q128 173 133 181 L135 188 Q134 192 128 187 '
                'Q122 192 121 188Z', '#181818', 'none', 0)
    art += path('M86 201 Q128 212 170 201 L169 216 Q128 229 87 216Z', '#eeeeee', '#181818', 2.5)
    for x, y in [(96, 203), (109, 206), (122, 207), (134, 207), (147, 206), (160, 203)]:
        art += path(f'M{x} {y} {x} {y+14}', 'none', '#181818', 2)
    art += path('M76 132 Q93 123 109 128 M147 128 Q163 123 180 132', 'none', '#fafafa', 3)
    return art


def radioactive(pose):
    art = effect('curl', '#79e432', '#eaff8c', '#419333', pose)
    art += group(ellipse(128, 184, 114, 113, '#b1ff2e'), .19)
    for x, y, length in [(30, 196, 25), (56, 235, 24), (226, 196, 25), (200, 235, 24)]:
        length += pose * 5
        art += path(f'M{x-5} {y} Q{x} {y+8} {x+5} {y} L{x+4} {y+length} '
                    f'Q{x} {y+length+10} {x-4} {y+length}Z', '#95f044', '#419333', 2.5)
        art += path(f'M{x-1} {y+length-4} {x-1} {y+length+1}', 'none', '#ecffb6', 2)
    return art


def shine(jade=False):
    if jade:
        return (group(path('M61 150 Q61 132 79 127 L91 131 Q70 136 72 151Z '
                           'M165 131 177 127 Q195 132 195 150 L184 151 Q186 136 165 131Z', '#f0fff1', 'none', 0), .48)
                + path('M77 129 81 134 M175 134 179 129 M64 206 75 216 M181 216 192 206', 'none', '#eaffd9', 2.5)
                + group(path('M107 138 117 130 125 136 M131 136 139 130 149 138 '
                             'M58 179 64 187 60 198 M198 179 192 187 196 198', 'none', '#468363', 2), .55))
    return (group(path('M62 151 69 135 86 125 98 130 74 159Z '
                       'M88 152 113 123 124 132 104 156Z '
                       'M149 143 164 126 175 130 160 147Z '
                       'M172 210 193 181 202 185 187 213Z', '#fafcff', 'none', 0), .56)
            + group(path('M62 163 98 127 104 132 68 170Z '
                         'M162 213 198 170 201 180 173 216Z', '#384556', 'none', 0), .4)
            + path('M75 136 84 132 M174 136 182 140 M179 218 190 214', 'none', '#ffffff', 2.5))


def stripes():
    # Bands follow the new symmetric crown; body bands follow the shifted onesie.
    return group(path('M32 133 62 116 82 115 96 125 49 153 36 163Z '
                      'M22 179 36 165 50 177 42 192 58 205 36 212Z '
                      'M112 92 123 79 135 89 139 104 127 115 116 106Z '
                      'M160 125 174 115 194 116 224 133 220 147 207 153Z '
                      'M206 177 220 165 234 179 220 212 198 205 214 192Z '
                      'M96 240 160 256 164 269 93 251Z '
                      'M90 269 166 283 165 291 142 290 93 282Z', '#999999', 'none', 0), .9)


def render(document):
    data = subprocess.run(['rsvg-convert'], input=document.encode(), check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(data)).convert('RGBA')


def masters():
    images = {}
    effects = [(f'aura/{slug(value)}', lambda p, v=value: effect(*PALETTES[v], p)) for value in PALETTES]
    effects.append(('form/radioactive/glow', radioactive))
    for prefix, draw in effects:
        poses = {}
        for frame, (pose, dx, dy) in enumerate([(0, 0, 0), (1, 0, -1), (0, 0, -3), (1, 1, -1)]):
            name = f'{prefix}/{frame}'
            document = svg(name, draw(pose))
            if pose not in poses:
                poses[pose] = render(document)
            shifted = Image.new('RGBA', SIZE)
            shifted.alpha_composite(poses[pose], (dx, dy))
            images[name] = shifted
            # Keep grain attached to the moving cel, just like its atlas pixels.
            document = document.replace('<g stroke-linecap=', f'<g transform="translate({dx} {dy})"><g stroke-linecap=')
            document = document.replace('</g></svg>', '</g></g></svg>')
            write(HERE / 'svg/aura' / f'{name}.svg', document)
    for name, art in [('form/skull/face', skull()), ('skin/metal/shine', shine()),
                      ('skin/jade/shine', shine(True)), ('skin/multi/stripes', stripes())]:
        document = svg(name, art)
        write(HERE / 'svg/aura' / f'{name}.svg', document)
        images[name] = render(document)
    return images


def metadata():
    return {
        'app': 'Candy Siege Chog aura drawing masters', 'version': '1',
        'image': 'chog-aura.png', 'format': 'RGBA8888', 'scale': '1', 'padding': 2,
        'animation': {'frames': [0, 1, 2, 3], 'frameRate': 6, 'repeat': -1,
                      'note': 'Four distinct registered frames; two bent cels drift through a four-step loop. Identical trimmed cels share texture rectangles.'},
        'aura': {'slot': 'aura', 'blend': 'normal', 'placement': 'Behind head and body, in 256x320 registered space.'},
        'specialForms': {
            'skull': {'whenAny': [{'Form': 'Skull'}, {'Base': 'Skull'}],
                      'frame': 'form/skull/face', 'replaces': ['base/face'],
                      'omit': ['base/nose', 'mouth/placeholder'], 'keep': ['base/back', 'base/blush', 'eyes'],
                      'tint': 'skin',
                      'note': 'Multiply neutral bone pixels by skins[Skin].tint, including red and yellow skeletons whose ordinary face swatch is cream. Sockets accept eye layers at the template anchors. Keep authored mouth traits above the teeth; omit only the default mouth. Fur stays on base/back.'},
            'radioactive': {'when': {'Base': 'Radioactive'},
                            'frames': [f'form/radioactive/glow/{i}' for i in range(4)],
                            'after': 'aura', 'before': 'head-back', 'replaces': [], 'blend': 'normal',
                            'note': 'Green toxic halo and drips behind head/body; retain the NFT aura and all base layers. No global green tint.'},
        },
        'skinOverlays': {
            'metal': {'when': {'Skin': 'Metal'}, 'frame': 'skin/metal/shine',
                      'after': 'base/face', 'before': 'base/blush', 'clip': 'selected face alpha',
                      'tint': None, 'blend': 'normal'},
            'jade': {'when': {'Skin': 'Jade'}, 'frame': 'skin/jade/shine',
                     'after': 'base/face', 'before': 'base/blush', 'clip': 'selected face alpha',
                     'tint': None, 'blend': 'normal'},
            'multi': {'when': {'Skin': 'Multi Colored'}, 'frame': 'skin/multi/stripes',
                      'after': 'base/back', 'before': 'base/face', 'tint': 'skin',
                      'clip': 'fur and onesie alpha; exclude face/hands/feet', 'blend': 'normal',
                      'note': 'Multiply bands by skins[Skin].tint, or the current skins[Skin].cycle colour. The cream face remains unchanged. Body bands register to the template onesie; mask to the actual costume.'},
        },
        'references': {'Aura': REFERENCES, 'special': SPECIAL_REFS},
        'limitations': [
            'White Aura exists only on #347; preview repeats that holder left-facing.',
            'Radioactive is green as requested; original portraits also show pink and rainbow emission.',
            'Multi stripes are a tintable interpretation of the original rainbow glow, not a baked rainbow face.',
            'Preview uses shared compose.py with aura/0, special forms and skin overlays; other agents own the remaining traits.',
        ],
    }


def pack(images):
    atlas = Image.new('RGBA', (2048, 2048))
    frames, unique, x, y, row = {}, {}, 2, 2, 0
    for name, image in sorted(images.items(), key=lambda item: -(item[1].getbbox()[3] - item[1].getbbox()[1])):
        box = image.getbbox()
        tile = image.crop(box)
        w, h = tile.size
        key = (tile.size, hashlib.sha256(tile.tobytes()).digest())
        if key not in unique:
            if x + w + 2 > 2048:
                x, y, row = 2, y + row + 4, 0
            assert y + h + 2 <= 2048, 'Atlas exceeds 2048 pixels'
            atlas.alpha_composite(tile, (x, y))
            unique[key] = {'x': x, 'y': y, 'w': w, 'h': h}
            x, row = x + w + 4, max(row, h)
        frames[name] = {'frame': unique[key], 'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h},
                        'sourceSize': {'w': 256, 'h': 320}}
        if name in ('skin/multi/stripes', 'form/skull/face'):
            frames[name]['tint'] = 'skin'
    atlas = atlas.crop((0, 0, 2048, y + row + 2))
    meta = metadata()
    meta['size'] = {'w': atlas.width, 'h': atlas.height}
    save_png(DATA / 'atlas/chog-aura.png', atlas)
    save_json(DATA / 'atlas/chog-aura.json', {'frames': frames, 'meta': meta})
    return atlas.size, len(unique)


def preview(compositor, images):
    rows = [(v, f'aura/{slug(v)}', ids, True) for v, ids in REFERENCES.items()]
    rows += [(v, {'Skull': 'form/skull/face', 'Radioactive': 'form/radioactive/glow',
                  'Metal': 'skin/metal/shine', 'Jade': 'skin/jade/shine',
                  'Multi Colored': 'skin/multi/stripes'}[v], ids, v == 'Radioactive') for v, ids in SPECIAL_REFS.items()]
    head_box = compositor.layer('base/back', '#ffffff').getbbox()
    phone_scale = 64 / (head_box[2] - head_box[0])
    phone_size = tuple(round(side * phone_scale) for side in SIZE)
    warnings = set()
    sheet = Image.new('RGBA', (1440, 136 + len(rows)*226 + 94), '#ede7db')
    d = ImageDraw.Draw(sheet)
    d.text((24, 16), 'CHOG / WAVE 2B / FRONT-FACING AURAS + FORMS', font=font(27), fill=INK)
    d.text((24, 54), 'Four loop frames  •  compose.py holders right / left  •  64px head proofs  •  original portraits', font=font(16), fill='#655a63')
    d.text((24, 80), 'Centred skull, equal eye sockets, balanced crown effects and skin overlays. All holder images come from the shared compositor.', font=font(14), fill='#655a63')
    d.text((242, 114), 'ISOLATED FRAMES', font=font(12), fill=INK)
    d.text((781, 114), 'COMPOSED HOLDERS', font=font(12), fill=INK)
    d.text((1162, 114), 'NFT REFERENCES', font=font(12), fill=INK)
    d.text((1327, 114), '64px HEAD', font=font(12), fill=INK)
    for i, (value, prefix, ids, animated) in enumerate(rows):
        y = 136+i*226
        d.rectangle((16, y, 1424, y+214), fill='#f8f4ec' if i%2 == 0 else '#e5e0d7')
        d.text((28, y+18), value, font=font(17), fill=INK)
        d.text((28, y+47), '4-frame loop' if animated else 'replacement' if value == 'Skull' else 'skin overlay', font=font(12), fill='#655a63')
        if value == 'White Aura':
            d.text((28, y+76), 'Only one holder: #347', font=font(12), fill='#9c4267')
        count = 4 if animated else 1
        for frame in range(count):
            name = f'{prefix}/{frame}' if animated else prefix
            tile = images[name].resize((124,155), Image.Resampling.LANCZOS)
            x = 242+frame*128
            d.rounded_rectangle((x,y+20,x+123,y+179),radius=9,fill='#353647')
            sheet.alpha_composite(tile,(x,y+22))
            d.text((x+4,y+187), str(frame) if animated else prefix, font=font(11), fill='#655a63')
        for n, token in enumerate((ids[0], ids[1] if len(ids)>1 else ids[0])):
            # The CLI is the acceptance path: no separate local layer stack.
            with tempfile.TemporaryDirectory(prefix='chog-aura-proof-') as temporary:
                output = Path(temporary) / f'{token}.png'
                command = [sys.executable, str(HERE/'compose.py'), str(token)]
                if n:
                    command.append('--left')
                completed = subprocess.run(command + ['-o', str(output)], check=True, capture_output=True, text=True)
                if completed.stderr.strip():
                    warnings.add(completed.stderr.strip())
                with Image.open(output) as source:
                    image = source.convert('RGBA')
            sheet.alpha_composite(image.resize((145,181),Image.Resampling.LANCZOS),(778+n*172,y+4))
            d.text((790+n*172,y+186),f'#{token}  {"LEFT" if n else "RIGHT"}',font=font(12),fill=INK)
            small = image.resize(phone_size,Image.Resampling.LANCZOS)
            if n:
                d.rounded_rectangle((1324,y+105,1406,y+206),radius=5,fill='#353647')
            sheet.alpha_composite(small,(1327,y+5+n*103))
            portrait = Image.open(DATA.parent/'chogs-256'/f'{token}.webp').convert('RGBA')
            sheet.alpha_composite(portrait.resize((94,94),Image.Resampling.LANCZOS),(1180,y+8+n*103))
    foot = 136+len(rows)*226
    d.text((24,foot+12),'Phone proofs scale the bare head to 64px, on light and dark backgrounds. All holder heads use shared trait atlases.',font=font(14),fill=INK)
    d.text((24,foot+37),'Skull sockets accept eye layers; green Radioactive and tintable Multi bands are intentional interpretations (see atlas meta).',font=font(14),fill=INK)
    save_png(HERE/'preview-aura.png', sheet)
    print(f'Preview: {len(rows)*2} successful compose.py renders; right and left for every value.')
    for warning in sorted(warnings):
        print(warning)


def self_check(compositor, images):
    assert set(PALETTES) == set(compositor.traits['values']['Aura']) - {''}
    assert len(images) == 96
    for value, ids in REFERENCES.items():
        actual = [int(k) for k in compositor.traits['chogs'] if compositor.values(k)['Aura'] == value]
        assert all(i in actual for i in ids)
        assert len(ids) >= min(2, len(actual))
        assert len({images[f'aura/{slug(value)}/{i}'].tobytes() for i in range(4)}) == 4
    for name, original in images.items():
        restored = compositor.layer(name, '#ffffff')
        assert ImageChops.difference(original, restored).getbbox(alpha_only=False) is None, name
        x0, y0, x1, y1 = original.getbbox()
        assert x0 >= 2 and y0 >= 2 and x1 <= 254 and y1 <= 318, (name, original.getbbox())
    for anchor in ('eyeNear', 'eyeFar'):
        centre = tuple(compositor.template['anchors'][anchor])
        assert images['form/skull/face'].getpixel(centre)[3] > 0
    for value, ids in SPECIAL_REFS.items():
        for token in ids:
            values = compositor.values(token)
            assert (values['Form'] == value or values['Base'] == value or values['Skin'] == value), (value, token)


def main():
    images = masters()
    size, cels = pack(images)
    compositor = Compositor()
    self_check(compositor, images)
    preview(compositor, images)
    print(f'Built {len(images)} frames ({cels} unique trimmed cels), atlas {size[0]}x{size[1]}.')
    print('Coverage, real holder matches, four distinct animation phases, padding and exact trim restoration passed.')
    print(f'Preview: {HERE / "preview-aura.png"}')


if __name__ == '__main__':
    main()
