#!/usr/bin/env python3
"""Build only chog-mouth, chog-acc, svg/mouth_acc and preview-mouth_acc.

Grip coordinates are in the untrimmed 256x320 canvas, not the packed tile.
For a trimmed sprite subtract spriteSourceSize.x/y; mirror x to 256-x.
Hand art fits the front-facing reference hero's front hand at (185,272). Place the prop
over the palm and the gripping thumb over the prop. Cigar attaches at mouth.
The preview uses compose.py for heads, then adds held art and its decals locally.
Run: python art/siege/chogs/build_mouth_acc.py
"""
import sys
sys.dont_write_bytecode = True

import io
import json
import math
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageOps

from build_chogs import (ATLAS, CREAM, HERE, INK, PINK, drawings, ellipse,
                         font, path, save_json, save_png, svg, write)
from compose import Compositor, DATA, SIZE, slug

REFERENCES = {
    'Mouth': {
        'Flat': [1, 2, 90], 'Smile': [3, 4, 11], 'normal smile': [5, 8, 20],
        'wo': [6, 9, 27], 'Rainbow Puke': [7, 31, 85], 'Gold Tooth': [10, 12, 28],
        'Lip Bite': [13, 24, 30], 'BTC Coin': [15, 26, 42], 'Sad': [16, 41, 51],
        'Worried': [18, 36, 39], 'Drooling': [19, 49, 50],
        'Bubblegum': [25, 57, 59], 'Clown Mouth': [32, 74, 103],
        'Mon coin': [44, 48, 99], 'Grit': [88, 91, 141],
    },
    'Accessory': {
        'Fwog': [1, 106, 165], 'Coin': [11, 32, 79], 'Cigar': [45, 112, 270],
        'Heart': [74, 152, 281], 'Knife': [84, 162, 241],
        'Red Candle': [91, 113, 239], 'Green Candle': [118, 173, 432],
        'SB': [123, 141, 248], 'PEPE': [279, 450, 611],
    },
}
DECALS = {'mouth/btc-coin': 'mouth/btc-coin/decal',
          'mouth/mon-coin': 'mouth/mon-coin/decal', 'acc/sb/hand': 'acc/sb/decal'}
GRIPS = {f'acc/{slug(value)}/{"face" if value == "Cigar" else "hand"}':
         [128, 204] if value == 'Cigar' else [185, 272]
         for value in REFERENCES['Accessory']}


def mouths():
    # Front-facing geometry is authored around (128,204), with level corners.
    art = {}
    art['flat'] = f'<rect x="114" y="202" width="28" height="4" rx="2" fill="{INK}" stroke="none"/>'
    art['smile'] = path('M117 200 C117 217 139 217 139 200')
    art['normal-smile'] = path('M104 200 Q128 216 152 200')
    art['wo'] = path('M124 199 C132 196 137 204 133 210 C129 216 121 210 122 204Z', INK, 'none', 0)
    grin = path('M96 195 Q128 207 160 195 L158 208 Q128 226 98 208Z', '#fffdf4')
    grin += path('M99 203 Q128 216 157 203', 'none', '#9dacc7', 2.5)
    art['gold-tooth'] = grin + path('M145 208 154 204 153 211 144 216Z', '#efaa16', INK, 2.5)
    art['gold-tooth'] += path('M147 209 149 208 147 213', 'none', '#ffe493', 2)
    art['lip-bite'] = path('M100 204 Q128 201 156 204')
    art['lip-bite'] += path('M118 203 122 210 128 204 132 210 136 203', CREAM, INK, 2.3)
    art['lip-bite'] += path('M111 205 107 209M117 210 115 213M145 205 149 209', width=2.3)
    art['sad'] = path('M106 212 Q128 188 150 212')
    art['worried'] = path('M104 204 C108 194 112 214 116 204 S124 214 128 204 '
                          'S136 214 140 204 S148 214 152 204')
    art['grit'] = path('M100 199 Q128 203 156 199 L156 217 Q128 222 100 217Z', '#fffdf4')
    art['grit'] += path('M100 207 Q128 212 156 207', 'none', '#8993aa', 2.5)
    art['drooling'] = path('M110 213 C108 190 140 190 146 207 L146 220 Q128 216 110 222Z', '#52202d')
    art['drooling'] += path('M113 211 Q128 203 140 211 L143 217 113 219Z', '#d9579a', 'none', 0)
    art['drooling'] += path('M111 218 Q124 214 139 217 L138 222 118 222 118 265 Q117 273 112 267Z', '#6bd8ee', INK, 2.5)
    art['drooling'] += path('M115 222 115 258M120 218 124 218', 'none', '#d9faff', 2.3)
    art['bubblegum'] = path('M127 202 133 200 C137 184 156 181 173 189 C194 203 189 229 173 238 '
                            'C154 247 136 234 133 218 L127 214 132 208Z', '#ee85d6', INK, 4)
    art['bubblegum'] += path('M143 229 C157 240 181 229 186 213 Q188 230 173 238 Q155 247 143 229Z', '#d35ac1', 'none', 0)
    art['bubblegum'] += path('M142 200 Q149 187 162 190', 'none', '#ffd5f0', 3.5)
    art['bubblegum'] += ellipse(140, 207, 1.8, 2.2, '#ffd5f0')
    art['clown-mouth'] = path('M94 194 Q128 216 162 194 L166 190 163 201 '
                              'Q128 226 93 201 L90 190Z', '#ed201e', 'none', 0)
    art['clown-mouth'] += path('M102 203 Q128 217 154 203', 'none', INK, 4)
    art['clown-mouth'] += path('M96 211 99 214M157 214 160 211', 'none', '#ed201e', 2)
    art['rainbow-puke'] = ellipse(128, 204, 18, 13, '#512036', INK, 4)
    ribbon = 'M113 205 Q128 199 141 204 C147 231 163 255 177 277 Q155 290 133 285 C134 252 120 232 113 205Z'
    art['rainbow-puke'] += f'<defs><clipPath id="rainbow"><path d="{ribbon}"/></clipPath></defs><g clip-path="url(#rainbow)">'
    # Shared cubic boundaries keep all seven bands contiguous as the stream widens.
    colors = ['#ee362a', '#ff901c', '#ffe52a', '#62d731', '#20c9b7', '#237ada', '#783dcc']
    for n, color in enumerate(colors):
        a, b = n / 7, (n + 1) / 7
        art['rainbow-puke'] += path(
            f'M{112+30*a} 200 C{116+33*a} 231 {134+24*a} 255 {132+47*a} 289 '
            f'L{132+47*b} 289 C{134+24*b} 255 {116+33*b} 231 {112+30*b} 200Z', color, color, 1)
    art['rainbow-puke'] += '</g>' + path(ribbon, width=4)
    for value, base, shadow, shine in [('btc-coin', '#efa623', '#b96d14', '#ffe591'),
                                        ('mon-coin', '#7650d8', '#443090', '#b8a1f5')]:
        art[value] = art['grit']
        art[value] += ellipse(128, 224, 20, 12, shadow, INK, 3)
        art[value] += ellipse(128, 219, 20, 12, base, INK, 3)
        art[value] += ellipse(128, 219, 16, 8.5, 'none', shine, 2)
        art[value] += path('M113 228 113 231M120 231 120 235M128 232 128 236M136 231 136 234M144 227 144 230', width=2)
    return {f'mouth/{key}': value for key, value in art.items()}


def accessories():
    art = {}
    art['coin'] = ellipse(205, 257, 18, 21, '#efa922', INK, 4)
    art['coin'] += ellipse(204, 256, 13, 16, '#f6c84a', '#cd831b', 2.5)
    art['coin'] += path('M195 247 Q198 242 204 241', 'none', '#ffeaa5', 3)
    art['heart'] = path('M194 272 C194 262 178 254 183 243 C188 234 197 239 200 246 '
                        'C205 232 220 235 221 246 Q224 257 194 272Z', '#fffdf4', INK, 4)
    art['heart'] += path('M192 263 Q210 254 217 247 Q219 259 194 270Z', '#ddd7c5', 'none', 0)
    art['knife'] = path('M195 262 211 227 Q216 215 220 223 Q230 241 204 267Z', '#a6afba', INK, 4)
    art['knife'] += path('M216 223 Q222 239 201 263 L205 244Z', '#e4edf0', 'none', 0)
    art['knife'] += path('M190 262 202 267 195 291 Q187 294 183 285Z', '#675047', INK, 4)
    art['knife'] += path('M187 262 204 270', 'none', '#d7c6a0', 6)
    art['knife'] += path('M187 259 206 267 205 272 185 264Z', '#d7c6a0', INK, 2.5)
    art['knife'] += ellipse(193, 274, 2, 2, '#d7c6a0')
    for name, color, shade in [('red-candle', '#ec2927', '#bf2026'),
                               ('green-candle', '#24d621', '#159c26')]:
        art[name] = path('M219 239 227 223', 'none', INK, 6)
        art[name] += path('M219 239 227 223', 'none', color, 2.5)
        art[name] += path('M191 274 211 235 Q214 231 219 234 L232 241 211 282Z', color, INK, 4)
        art[name] += path('M223 238 230 242 210 279 204 276Z', shade, 'none', 0)
        art[name] += path('M200 280 194 292', 'none', INK, 6)
        art[name] += path('M200 280 194 292', 'none', color, 2.5)
    art['fwog'] = path('M192 260 Q177 250 185 238 Q179 224 190 225 Q196 225 199 232 '
                      'Q209 226 216 232 Q224 223 229 231 Q232 237 227 243 '
                      'Q237 259 222 265 L228 277 218 279 210 269 201 274 192 286 184 282Z', '#29d85b', INK, 4)
    art['fwog'] += path('M188 256 Q207 264 224 251 Q230 263 214 270 L205 273 192 281 190 275Z', '#1aa64e', 'none', 0)
    art['fwog'] += ellipse(194, 239, 5.3, 6, '#fffdf4', INK, 2)
    art['fwog'] += ellipse(218, 239, 5.3, 6, '#fffdf4', INK, 2)
    art['fwog'] += ellipse(196, 239, 2.5, 3.5, INK) + ellipse(220, 239, 2.5, 3.5, INK)
    art['fwog'] += path('M202 250 Q209 253 215 248', width=2.5)
    art['pepe'] = path('M192 254 Q205 248 221 253 L227 277 218 281 201 277 190 281 184 273Z', '#304ec6', INK, 4)
    art['pepe'] += path('M188 254 Q179 243 189 235 Q187 224 197 227 L207 230 '
                      'Q219 219 224 230 L226 239 Q236 251 224 258 Q204 268 188 254Z', '#42983e', INK, 4)
    art['pepe'] += ellipse(199, 237, 7, 8, '#f4eedd', INK, 2.5)
    art['pepe'] += ellipse(215, 237, 7, 8, '#f4eedd', INK, 2.5)
    art['pepe'] += ellipse(201, 239, 2.8, 4, INK) + ellipse(217, 239, 2.8, 4, INK)
    art['pepe'] += path('M190 235 Q198 229 207 233M208 233 Q217 229 224 235', 'none', '#42983e', 4)
    art['pepe'] += path('M191 251 Q207 255 225 245 L226 251 Q209 262 193 257Z', '#a9764f', INK, 2.5)
    art['pepe'] += path('M218 265 224 273 219 277M186 273 182 280 190 281', 'none', '#42983e', 5)
    # The three SB portraits show a tapered white takeaway cup with a flat lid.
    art['sb'] = path('M185 244 224 244 219 288 Q204 294 191 287Z', '#fffdf4', INK, 4)
    art['sb'] += path('M217 249 222 249 218 286 211 288Z', '#d9d5c5', 'none', 0)
    art['sb'] += path('M184 242 188 237 222 237 226 242 226 248 183 248Z', '#fffdf4', INK, 3.5)
    art['sb'] += path('M187 242 223 242', 'none', '#c3c6bb', 2)
    # Keep hero-hand scale; follow the reference body's 9px move to the left.
    frames = {f'acc/{key}/hand': f'<g transform="translate(-9 0)">{value}</g>'
              for key, value in art.items()}
    cigar = path('M128 201 188 206 Q194 209 190 218 L128 208Z', '#9c6135', INK, 4)
    cigar += path('M132 203 186 208 185 211 133 206Z', '#cf9460', 'none', 0)
    cigar += path('M142 203 137 209M158 205 153 212M174 207 169 214', 'none', '#5d3a2b', 2)
    cigar += ellipse(189, 212, 4, 6, '#ef4229', INK, 2.5, -6)
    cigar += path('M189 209 190 212', 'none', '#ffbc43', 2)
    frames['acc/cigar/face'] = f'<g transform="rotate(-8 128 204)">{cigar}</g>'
    return frames


def decals():
    btc = path('M157 210 157 224M154 211 164 211 Q170 212 164 217 Q172 219 166 224 L154 224 '
               'M159 207 159 210M164 207 164 210M159 224 159 227M164 224 164 227', 'none', '#fffdf4', 2.6)
    mon = path('M158 210 170 210 168 217 Q167 223 162 223 L152 223 154 215 Q155 211 158 210Z', 'none', '#fffdf4', 2.8)
    sb = ellipse(205, 263, 11, 11, '#166841')
    sb += path('M200 259 198 253 203 255 205 251 207 255 212 253 210 259Z', '#fffdf4', 'none', 0)
    sb += ellipse(205, 262, 3, 3.5, '#fffdf4')
    sb += path('M200 261 Q196 265 199 270M211 261 Q215 265 212 270 '
               'M203 266 201 272M207 266 210 272', 'none', '#fffdf4', 2)
    return {'mouth/btc-coin/decal': f'<g transform="translate(-33 2)">{btc}</g>',
            'mouth/mon-coin/decal': f'<g transform="translate(-33 2)">{mon}</g>',
            'acc/sb/decal': f'<g transform="translate(-9 0)">{sb}</g>'}


def render(source):
    result = subprocess.run(['rsvg-convert'], input=source.encode(), capture_output=True, check=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGBA')


def pack(batch, images):
    atlas = Image.new('RGBA', (512, 2048))
    frames, x, y, row = {}, 2, 2, 0
    for name, image in sorted(images.items(), key=lambda item: (-item[1].getbbox()[3] + item[1].getbbox()[1], item[0])):
        box = image.getbbox()
        tile = image.crop(box)
        w, h = tile.size
        if x + w + 2 > atlas.width:
            x, y, row = 2, y + row + 4, 0
        assert y + h + 2 <= atlas.height
        atlas.alpha_composite(tile, (x, y))
        frames[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h},
                        'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h},
                        'sourceSize': {'w': 256, 'h': 320}}
        if name.endswith('/decal'):
            frames[name]['decal'] = {'anchor': {'x': (box[0]+box[2])/2, 'y': (box[1]+box[3])/2},
                                     'size': {'w': w, 'h': h}}
        x, row = x + w + 4, max(row, h)
    atlas = atlas.crop((0, 0, 512, 2 ** math.ceil(math.log2(y + row + 2))))
    meta = {'app': 'Candy Siege Chog mouth and accessory masters', 'version': '1',
            'image': f'chog-{batch}.png', 'format': 'RGBA8888',
            'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1', 'padding': 2,
            'references': REFERENCES['Mouth' if batch == 'mouth' else 'Accessory'],
            'decals': {parent: decal for parent, decal in DECALS.items() if parent in images},
            'decalPlacement': 'Draw after its parent; use frame.decal anchor/size. Mirror anchor x to 256-x, never glyph pixels.',
            'preview': 'art/siege/chogs/preview-mouth_acc.png'}
    if batch == 'acc':
        meta['grip'] = GRIPS
        meta['gripSpace'] = 'Untrimmed 256x320 canvas pixels; trimmed grip = grip - spriteSourceSize.xy; left x = 256-x.'
        meta['placement'] = 'Hand props fit front-facing reference front hand (185,272); draw over palm, below thumb. Cigar grip is mouth (128,204).'
        meta['notes'] = 'SB uses the observed white takeaway cup silhouette; Cigar is relocated from portrait hand to requested mouth anchor.'
    else:
        meta['anchor'] = {'mouth': [128, 204]}
        meta['notes'] = 'Drooling has open-mouth and frown portrait variants; this layer uses the open mouth and cyan saliva for small-size readability.'
    save_png(ATLAS / f'chog-{batch}.png', atlas)
    save_json(ATLAS / f'chog-{batch}.json', {'frames': frames, 'meta': meta})
    return atlas.size


def reference_body():
    shared = drawings()
    back = shared['base/back'].replace('#eeeeee', PINK).replace('#cdcdcd', '#dc529a').replace('#fafafa', '#fa99c9').replace('#181818', INK)
    head = back + ''.join(shared[n] for n in ('base/face', 'base/blush', 'base/nose', 'eyes/placeholder', 'mouth/placeholder'))
    assert shared['body/sample'].endswith(head)
    return shared['body/sample'][:-len(head)]


def specimen(compositor, token, left, body):
    values = compositor.values(token)
    skin = compositor.skins[values['Skin']]
    shadow = '#' + ''.join(f'{round(int(skin["tint"][i:i+2],16)*.83):02x}' for i in (1, 3, 5))
    source = body.replace(PINK, skin['tint']).replace('#dc529a', shadow).replace(CREAM, skin.get('face', CREAM))
    result = render(svg('Reference onesie only', source))
    if left:
        result = ImageOps.mirror(result)
    with tempfile.TemporaryDirectory(prefix='chog-mouth-') as temporary:
        output = Path(temporary) / 'head.png'
        command = [sys.executable, str(HERE / 'compose.py'), str(token)]
        if left:
            command.append('--left')
        run = subprocess.run(command + ['-o', str(output)], capture_output=True, text=True, check=True)
        with Image.open(output) as head:
            result.alpha_composite(head.convert('RGBA'))
    pending = run.stderr.strip()
    parents = [f'mouth/{slug(values["Mouth"])}',
               f'acc/{slug(values["Accessory"])}/{"face" if values["Accessory"] == "Cigar" else "hand"}']
    for parent in parents:
        if parent.endswith('/hand') and parent in compositor.frames:
            result.alpha_composite(compositor.layer(parent, skin['tint'], left))
        decal = DECALS.get(parent)
        if decal and parent.endswith('/hand'):
            result.alpha_composite(compositor.layer(decal, skin['tint'], left))
    if parents[1].endswith('/hand') and parents[1] in compositor.frames:
        thumb = path('M181 270 Q184 261 193 263 Q199 266 196 270 L190 274', skin.get('face', CREAM), INK, 3)
        layer = render(svg('Reference grip occlusion', f'<g transform="translate(-9 0)">{thumb}</g>'))
        result.alpha_composite(ImageOps.mirror(layer) if left else layer)
    return result, pending


def preview(compositor, images):
    board = Image.new('RGBA', (1800, 3890), '#f3eee3')
    draw = ImageDraw.Draw(board)
    draw.text((28, 24), 'CHOG / WAVE 2B / FRONT-FACING MOUTHS + ACCESSORIES', font=font(30), fill=INK)
    draw.text((28, 70), '24 refitted traits / isolated layers + 48 matching CLI compositions / original 3-portrait references retained', font=font(17), fill=INK)
    draw.text((28, 99), 'Current trait atlases on reference onesies. Held props + their decals added locally. Tiny copies: 64px base-head width.', font=font(15), fill='#655a63')
    body = reference_body()
    entries = [(key, value, ids) for key, refs in REFERENCES.items() for value, ids in refs.items()]
    for n, (key, value, ids) in enumerate(entries):
        x, y = 20 + n % 2 * 890, 148 + n // 2 * 310
        draw.rounded_rectangle((x, y, x+870, y+296), 12, fill='#fffaf0', outline='#d9cfc2', width=1)
        frame = f'mouth/{slug(value)}' if key == 'Mouth' else f'acc/{slug(value)}/{"face" if value == "Cigar" else "hand"}'
        draw.text((x+14, y+10), f'{key.upper()} / {value}', font=font(19), fill=INK)
        draw.text((x+14, y+36), frame, font=font(11), fill='#655a63')
        isolated = images[frame].copy()
        if frame in DECALS:
            isolated.alpha_composite(images[DECALS[frame]])
        box = isolated.getbbox()
        tile = isolated.crop(box)
        tile.thumbnail((123, 140), Image.Resampling.LANCZOS)
        board.alpha_composite(tile, (x+131+(125-tile.width)//2, y+85+(140-tile.height)//2))
        draw.text((x+148, y+239), 'ISOLATED 1x', font=font(11), fill='#655a63')
        if frame in GRIPS:
            gx, gy = GRIPS[frame]
            draw.text((x+131, y+258), f'grip {gx},{gy}', font=font(11), fill='#655a63')
        for i, token in enumerate(ids[:2]):
            with Image.open(DATA.parent / 'chogs-256' / f'{token}.webp') as source:
                board.alpha_composite(source.convert('RGBA').resize((85,85)), (x+14,y+66+i*105))
            draw.text((x+15,y+151+i*105), f'NFT #{token}', font=font(10), fill='#655a63')
            result, pending = specimen(compositor, token, bool(i), body)
            board.alpha_composite(result.resize((192,240), Image.Resampling.LANCZOS), (x+272+i*204,y+35))
            draw.text((x+282+i*204,y+276), f'#{token} / {"LEFT" if i else "RIGHT"}', font=font(12), fill=INK)
            # Base crown spans 225 source pixels; 73px canvas makes it 64px wide.
            tiny = result.resize((73,91), Image.Resampling.LANCZOS)
            board.alpha_composite(tiny, (x+699+i*82,y+130))
        draw.text((x+715,y+239), 'PHONE SCALE', font=font(11), fill='#655a63')
    save_png(HERE / 'preview-mouth_acc.png', board)


def self_check(compositor, images):
    assert compositor.template['anchors']['mouth'] == [128, 204]
    traits = compositor.traits
    for key, refs in REFERENCES.items():
        assert set(refs) == set(traits['values'][key][1:]), key
        for value, tokens in refs.items():
            assert len(tokens) == 3 and all(compositor.values(t)[key] == value for t in tokens)
    for name, source in images.items():
        restored = compositor.layer(name, '#ffffff')
        assert ImageChops.difference(source, restored).getbbox(alpha_only=False) is None, name
        left = compositor.layer(name, '#ffffff', True)
        if not name.endswith('/decal'):
            assert ImageChops.difference(left, ImageOps.mirror(source)).getbbox(alpha_only=False) is None, name
        else:
            assert left.crop(left.getbbox()).tobytes() == source.crop(source.getbbox()).tobytes(), name
    for name, (x, y) in GRIPS.items():
        assert images[name].getpixel((x,y))[3] > 0, f'grip outside art: {name}'
    for batch in ('mouth', 'acc'):
        data = json.loads((ATLAS / f'chog-{batch}.json').read_text())
        with Image.open(ATLAS / data['meta']['image']) as atlas:
            assert max(atlas.size) <= 2048
            for frame in data['frames'].values():
                r = frame['frame']; x, y, w, h = (r[k] for k in ('x','y','w','h'))
                pad = atlas.crop((x-2,y-2,x+w+2,y+h+2)).getchannel('A')
                ImageDraw.Draw(pad).rectangle((2,2,w+1,h+1), fill=0)
                assert pad.getbbox() is None, 'padding must be transparent'


def main():
    art = mouths() | accessories() | decals()
    images = {}
    for name, drawing in art.items():
        master = HERE / 'svg/mouth_acc' / f'{name}.svg'
        source = svg(name, drawing)
        write(master, source)
        images[name] = render(source)
    for batch, prefix in [('mouth', 'mouth/'), ('acc', 'acc/')]:
        subset = {name: image for name, image in images.items() if name.startswith(prefix)}
        size = pack(batch, subset)
        print(f'chog-{batch}: {len(subset)} frames, {size[0]}x{size[1]}')
    compositor = Compositor()
    self_check(compositor, images)
    preview(compositor, images)
    print('PASS: all 24 refitted values, 48 CLI compositions, 72 reference memberships, trim restoration, facing, decals, grips and atlas padding.')
    print(f'Preview: {HERE / "preview-mouth_acc.png"}')


if __name__ == '__main__':
    main()
