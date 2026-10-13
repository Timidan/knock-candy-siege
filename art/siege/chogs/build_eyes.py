#!/usr/bin/env python3
"""Draw the 58 Eyes traits, pack their atlas, and review real matching Chogs.

Only writes this batch's SVGs, atlas pair and preview. Uses existing rsvg/Pillow.
Eyewear lettering stays in separate decals, selected through meta.eyeDecals.
Front-facing geometry uses equal, level eyes on the wave 1b template.
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

from build_chogs import INK, ellipse, font, path, save_json, save_png, svg, write
from compose import Compositor, DATA, HERE, SIZE, slug

ATLAS = DATA / 'atlas'
WHITE = '#fffdf4'
REFERENCES = {
    'BTC Glass': [1, 567, 331], 'Modern VR': [999, 1313, 2],
    'Retro Glass': [1327, 3, 28], 'Round Crying': [133, 419, 691],
    'Teary': [275, 548, 584], 'Green laser': [169, 228, 550],
    'Smirk': [48, 291, 1048], 'Closed Eye Crying': [37, 267, 373],
    'Flat': [270, 1179, 358], 'Side Eye': [212, 508, 572],
    'Round': [483, 647, 822], 'Clown Eye Mix': [162, 205, 298],
    'Sunset visor': [170, 591, 1774], 'Purple laser': [394, 651, 989],
    'Worried': [19, 492, 700], 'Happy': [80, 132, 168],
    'Anime Glass': [1895, 23, 66], 'Round Eye': [327, 360, 545],
    'Round Tear': [156, 215, 456], 'Angry': [918, 31, 181],
    'fire laser': [68, 440, 760], 'Dead': [39, 447, 562],
    'Base': [239, 531, 889], 'Chog Viper': [43, 276, 190],
    'Thug': [1612, 44, 387], 'Vertical': [397, 436, 833],
    'Clown Eye': [364, 1268, 686], 'Heart': [222, 433, 1347],
    'Normal Eye': [78, 337, 480], 'Tired': [58, 124, 368],
    'Frog': [121, 589, 1163], 'Gradient visor': [69, 115, 295],
    'Green Side Eye': [70, 1280, 1382], '3D Glass': [72, 287, 410],
    'cyan laser': [533, 1659, 1934], 'MOG': [90, 76, 79],
    'Retard': [540, 1757, 1775], 'Plasma visor': [590, 171, 278],
    'Classic VR': [1591, 379, 767], 'XD': [111, 450, 593],
    'Blue Flat': [196], 'Red Round Eye': [284, 1211, 1342],
    'Blue Retard': [352, 1106, 1730], 'Red Retard': [388],
    'Up': [428, 1821], 'Green Round Eye': [539],
    'Mixed Retard': [648, 783], 'Blue Round Eye': [851, 1251],
    'Mixed Happy': [1695, 923], 'Green Smirk': [981],
    'Mixed Side Eye': [1133, 1733], 'Red Flat': [1642, 1180],
    'Green Happy': [1517, 1575], 'Normal': [1587, 1819],
    'Green Retard': [1608], 'Mixed Round Eye': [1700],
    'Blue Happy': [1708], 'Blue Smirk': [1789],
}
EYEWEAR = {'BTC Glass', 'Modern VR', 'Retro Glass', 'Sunset visor',
           'Anime Glass', 'Chog Viper', 'Thug', 'Gradient visor', '3D Glass',
           'MOG', 'Plasma visor', 'Classic VR'}
STREAMS = {'Round Crying', 'Round Tear', 'Closed Eye Crying'}
DECALS = {
    'BTC Glass': ['eyes/btc-glass/near/decal', 'eyes/btc-glass/far/decal'],
    'Chog Viper': ['eyes/chog-viper/decal'],
}
TEMPLATE = json.loads((ATLAS / 'chog-template.json').read_text())


def at_eye(art, far=False, scale=1):
    x, y = TEMPLATE['anchors']['eyeFar' if far else 'eyeNear']
    return f'<g transform="translate({x} {y}) scale({scale})">{art}</g>'


def glints():
    return (ellipse(-6, -7, 5, 6.5, WHITE, rotate=35)
            + ellipse(7, 8, 2.1, 2.6, WHITE))


def eye_shape(style, ink=INK, sclera=WHITE, far=False):
    # Balance expression contours across the face; directional gaze stays shared.
    if far and style in ('Happy', 'Closed Eye Crying', 'Smirk', 'Base', 'Tired',
                         'Angry', 'Normal Eye', 'Worried', 'Clown Eye', 'Clown Eye Mix'):
        near_style = 'Clown Eye' if style == 'Clown Eye Mix' else style
        return f'<g transform="scale(-1 1)">{eye_shape(near_style, ink, sclera)}</g>'
    if style in ('Round', 'Round Eye', 'Round Crying', 'Round Tear', 'Teary'):
        art = ellipse(0, 0, 18, 19, sclera, ink, 3.5)
        if ink == INK:
            art += ellipse(0, 0, 14, 15, '#101215')
            if style in ('Round Crying', 'Round Tear', 'Teary'):
                art += glints() + ellipse(6, -10, 2, 2.2, WHITE)
        return art
    if style == 'Retard':
        return (path('M-21 -2 Q-20 -19 -2 -20 Q16 -20 21 -4 Q24 14 6 19 '
                     'Q-17 23 -21 5Z', sclera, ink, 3.5)
                + ellipse(7 if far else -8, -1, 6, 7, ink))
    if style == 'Flat':
        return path('M-21 -3 Q-1 -5 21 -2 L16 0 21 2 Q1 4 -21 2 '
                    'L-17 0Z', ink, 'none')
    if style == 'Happy':
        return path('M-20 4 Q-3 -20 18 2 Q5 -6 -2 -3 L-17 7Z', ink, 'none')
    if style == 'Closed Eye Crying':
        return path('M-18 -4 Q-5 10 18 6', 'none', ink, 5)
    if style == 'Smirk':
        art = path('M-22 8 Q-15 -12 2 -13 Q17 -15 23 4 Q18 10 10 6 '
                   'Q-4 0 -15 9 Q-19 12 -22 8Z', sclera, ink, 3)
        art += path('M-21 7 Q-15 -11 1 -12 Q8 -10 9 5 Q-3 0 -15 9Z', ink, 'none')
        return art + ellipse(-6, -6, 4, 2, WHITE, rotate=-18)
    if style in ('Side Eye', 'Tired', 'Angry', 'Base'):
        art = path('M-19 -8 18 -11 Q21 9 8 15 Q-14 24 -18 -4Z', ink, 'none')
        art += path('M-22 -9 Q0 -10 22 -12', 'none', ink, 3.5)
        art += ellipse(-10, -3, 3.7 if style == 'Side Eye' else 5, 5.5, WHITE)
        if style in ('Base', 'Side Eye'):
            art += ellipse(-10, 5, 1.7, 2, WHITE)
        if style == 'Angry':
            art = f'<g transform="rotate({-12 if far else 12})">{art}</g>'
        if style == 'Tired':
            art += path('M-16 7 Q-3 25 15 7 L12 16 Q-6 29 -16 7Z', '#9ba3b2', 'none')
        return art
    if style in ('Normal Eye', 'Worried', 'Normal', 'Up'):
        art = ellipse(0, 0, 17, 19, '#111215')
        if style == 'Normal':
            return art
        if style == 'Up':
            return art + path('M-12 -14 Q0 -22 13 -13 Q10 -3 2 -6Z', WHITE, 'none')
        art += glints()
        if style == 'Normal Eye':
            art += path('M-22 -13 Q-1 -13 17 -20', 'none', ink, 3.5)
        else:
            art += path('M-22 -9 Q2 -10 14 -25M-15 10 Q-2 22 12 10', 'none', ink, 3)
            art += path('M-11 10 Q-1 16 9 10', 'none', WHITE, 2)
        return art
    if style == 'Vertical':
        art = ellipse(0, 0, 24, 10, sclera, ink, 3)
        return (art + path('M-8 -9 5 -9 5 9 -8 9Z', ink, 'none')
                + ellipse(-5, -4, 2, 3, WHITE) + ellipse(-5, 3, 1.5, 1.5, WHITE))
    if style == 'Frog':
        return (ellipse(0, 0, 20, 19, sclera, ink, 3)
                + ellipse(0, 1, 17, 7, ink)
                + ellipse(-9, -1, 4, 2.2, WHITE))
    if style == 'Heart':
        return (path('M0 19 C-8 10 -24 1 -21 -11 C-18 -23 -3 -22 0 -11 '
                     'C10 -24 25 -15 23 -4 Q21 7 0 19Z', '#f02f3e', ink, 3.5)
                + path('M-15 -12 Q-18 -6 -11 1', 'none', '#ffb2a4', 3))
    if style == 'Dead':
        return path('M-13 -13 14 14M14 -13 -13 14', 'none', '#111215', 10)
    if style == 'XD':
        return path('M-16 -15 15 0 -16 15' if not far else 'M16 -15 -15 0 16 15',
                    'none', ink, 6)
    if style in ('Clown Eye', 'Clown Eye Mix'):
        color = '#ed242b' if style == 'Clown Eye Mix' and not far else '#2539d9'
        return (path('M-22 -8 Q-7 -11 -5 -34 Q1 -17 18 -8 '
                     'L7 1 -1 19 -9 1Z', color, 'none')
                + eye_shape('Base'))
    raise ValueError(f'undrawn eye style: {style}')


def gradient(name, colors):
    stops = ''.join(f'<stop offset="{n/(len(colors)-1):.3f}" stop-color="{c}"/>'
                    for n, c in enumerate(colors))
    return f'<defs><linearGradient id="{name}" x1="0" y1="0" x2="1" y2="0">{stops}</linearGradient></defs>'


def eyewear(value):
    bridge = path('M117 165 Q128 158 139 165', 'none', INK, 5)
    if value == 'BTC Glass':
        art = path('M50 167 67 170M117 168 139 168M189 170 206 167', 'none', INK, 6)
        art += path('M50 167 67 170M117 168 139 168M189 170 206 167', 'none', '#cf8b36', 2.5)
        for far in (False, True):
            coin = ellipse(0, 0, 26, 26, '#e89a2f', INK, 4)
            coin += path('M-19 -17 Q-31 7 -7 24 L-15 23 Q-37 1 -19 -17Z', '#b96c25', 'none')
            coin += ellipse(0, 0, 22, 23, 'none', '#774316', 1.8)
            for a in range(0, 360, 30):
                r = math.radians(a)
                coin += path(f'M{24*math.cos(r):.1f} {24*math.sin(r):.1f} '
                             f'L{21*math.cos(r):.1f} {21*math.sin(r):.1f}', 'none', '#774316', 1.5)
            art += at_eye(coin, far)
        return art
    if value in ('Retro Glass', 'Anime Glass', '3D Glass'):
        frame = {'Retro Glass': '#b72840', 'Anime Glass': '#315e54', '3D Glass': '#eee9df'}[value]
        art = bridge + path('M50 162 65 167M191 167 206 162', 'none', frame, 4)
        for far in (False, True):
            fill = '#91c4d9' if value == 'Retro Glass' else '#fbfcfa'
            if value == '3D Glass':
                fill = '#ec4336' if far else '#3434c9'
                lens = path('M-28 -19 28 -19 28 19 -28 19Z', frame, INK, 3)
                lens += path('M-22 -13 22 -13 22 13 -22 13Z', fill, INK, 2)
                lens += path('M-5 -13 -14 13 -7 13 2 -13Z', '#ffffff', 'none').replace('fill="#ffffff"', 'fill="#ffffff" opacity=".22"')
            else:
                lens = path('M-23 -19 Q0 -25 23 -19 Q29 -10 25 11 '
                            'Q23 23 0 23 Q-23 23 -25 11 Q-29 -10 -23 -19Z', fill, frame, 4)
                if value == 'Retro Glass':
                    lens += path('M-19 4 Q-17 -12 -8 -15 Q8 -17 17 -8 '
                                 'L20 13 Q-1 22 -14 15Z', '#73afc6', 'none')
                    lens += path('M-13 -7 Q-6 -18 1 -14 L-3 -8 -10 -4Z', '#ccebf2', 'none')
                    lens += ellipse(-12, 1, 2.5, 3.5, '#ccebf2')
            art += at_eye(lens, far)
        return art
    if value == 'Thug':
        art = path('M50 148H206V159H198V173H191V182H184V188H149V182H142V175H136V164 '
                   'H120V175H114V182H107V188H72V182H65V173H58V159H50Z', '#111215', 'none')
        for x, y in ((99,155),(92,162),(85,169),(171,155),(164,162),(157,169)):
            art += path(f'M{x} {y}h7v7h-7Z', '#f6f7ed', 'none')
        return art
    if value == 'Classic VR':
        art = path('M47 151H66V184H47ZM190 151H209V184H190Z', '#32333c', INK, 4)
        art += path('M70 140H186Q198 140 198 152V182Q198 194 186 194H70 '
                    'Q58 194 58 182V152Q58 140 70 140Z', '#84838b', INK, 4.5)
        art += path('M70 147H186Q191 147 191 153V181Q191 187 185 187H71 '
                    'Q65 187 65 181V153Q65 147 70 147Z', '#0d1117', INK, 3)
        art += path('M105 148H115L97 186H87Z M120 148H124L106 186H102Z '
                    'M157 148H171L153 186H139Z', '#dadbdc', 'none')
        art += path('M70 146H186', 'none', '#f4f1ed', 2.5)
        return art
    if value == 'Modern VR':
        art = path('M47 151H66V184H47ZM190 151H209V184H190Z', '#343444', INK, 4)
        art += path('M70 140Q128 123 186 140Q199 144 199 158V180 '
                    'Q199 196 182 196Q158 196 142 183Q128 173 114 183 '
                    'Q98 196 74 196Q57 196 57 180V158Q57 144 70 140Z', '#424355', INK, 4.5)
        art += path('M74 147Q128 131 182 147Q191 150 191 160V179 '
                    'Q191 188 181 188Q158 188 141 176Q128 168 115 176 '
                    'Q98 188 75 188Q65 188 65 179V160Q65 150 74 147Z', '#0a121b', '#0875ae', 5)
        art += path('M74 148Q128 133 182 148Q190 151 190 160M65 169V178', 'none', '#26c9ef', 2.4)
        art += path('M80 174V163Q80 153 100 151', 'none', '#e5f5f4', 4)
        art += ellipse(80, 181, 2, 2.4, '#e5f5f4')
        art += path('M59 158V176', 'none', '#9694ad', 2)
        return art
    if value == 'Chog Viper':
        art = gradient('lens', ['#152286', '#193bed', '#22dce4', '#66f8e7', '#1649df', '#152286'])
        art += path('M48 149H66V185H48ZM190 149H208V185H190Z', '#e8e6d9', INK, 3)
        art += path('M60 142Q128 134 196 142L198 177Q198 197 178 197 '
                    'Q150 197 139 177Q128 159 117 177Q106 197 78 197Q58 197 58 177Z', '#dddace', INK, 4.5)
        art += path('M67 149Q128 141 189 149L191 176Q191 190 178 190 '
                    'Q153 190 144 173Q128 149 112 173Q103 190 78 190Q65 190 65 176Z', 'url(#lens)', INK, 3)
        return art
    if value == 'MOG':
        art = gradient('lens', ['#03d6da', '#eadd24', '#ff9a20', '#ff631b', '#eddb2c', '#0be5df'])
        art += path('M58 143Q128 136 198 143L195 177Q193 196 176 196 '
                    'Q151 196 139 176Q128 163 117 176Q105 196 80 196 '
                    'Q63 196 61 177Z', 'url(#lens)', INK, 4)
        art += path('M114 138H142V143H114Z', '#afabb0', INK, 2)
        art += path('M67 151 69 175', 'none', '#b9f8ef', 2)
        return art
    colors = {
        'Sunset visor': ['#f19835', '#ba301b', '#800e1a', '#b62415', '#f39b30'],
        'Gradient visor': ['#46429b', '#a676ab', '#efb0a2', '#f7daa9', '#d58da6', '#45449a'],
        'Plasma visor': ['#2924c1', '#166deb', '#44ddd3', '#c9ed21', '#8fdf4a', '#15a4df', '#3030b6'],
    }[value]
    return gradient('lens', colors) + path('M58 142Q128 157 198 142 '
        'Q204 166 198 185Q128 207 58 185Q52 166 58 142Z', 'url(#lens)', INK, 4.5)


def drawings():
    frames, metadata = {}, {}
    polygon = ' '.join(f'{x},{y}' for x, y in TEMPLATE['anchors']['faceMask'])
    clip = f'<defs><clipPath id="face"><polygon points="{polygon}"/></clipPath></defs>'
    for value in REFERENCES:
        key = f'eyes/{slug(value)}'
        if value in EYEWEAR:
            frames[key] = eyewear(value)
            continue
        style, inks, sclera = value, (INK, INK), WHITE
        for prefix, colors in [('Green ', ('#13722c', '#13722c')),
                               ('Blue ', ('#245897', '#245897')),
                               ('Red ', ('#ad2b38', '#ad2b38')),
                               ('Mixed ', ('#772988', '#853932'))]:
            if value.startswith(prefix):
                style, inks = value[len(prefix):], colors
                if style == 'Round Eye':
                    sclera = {'Green ': '#dcf528', 'Blue ': '#cdf6ed',
                              'Red ': WHITE, 'Mixed ': WHITE}[prefix]
                break
        if 'laser' in value:
            art = ''.join(at_eye(eye_shape('Normal Eye', far=far), far, .9) for far in (False, True))
            art = clip + f'<g clip-path="url(#face)">{art}</g>'
            outer, core = {'Green laser': ('#278c23', '#9df137'),
                           'Purple laser': ('#b415d5', '#ed70ff'),
                           'fire laser': ('#f03b22', '#fff447'),
                           'cyan laser': ('#16769d', '#6ff5f2')}[value]
            for anchor in ('eyeFar', 'eyeNear'):
                x, y = TEMPLATE['anchors'][anchor]
                art += path(f'M{x} {y}h31', 'none', outer, 11)
                art += path(f'M{x} {y}h31', 'none', core, 5.5)
            metadata[key] = {'beamStubs': {'direction': [1, 0], 'anchors': [
                TEMPLATE['anchors']['eyeNear'], TEMPLATE['anchors']['eyeFar']]}}
        else:
            art = ''.join(at_eye(eye_shape(style, inks[int(far)], sclera, far), far, .9)
                          for far in (False, True))
            if value in STREAMS:
                tears = ''
                for far in (False, True):
                    stream = path('M-12 13 Q-3 17 7 13 L9 53 Q6 60 -2 60 '
                                  'Q-10 61 -14 55Z', '#8bd5f1', 'none')
                    stream += path('M-9 21 -9 50 Q-8 54 -5 54', 'none', '#daf8fc', 3)
                    if value == 'Closed Eye Crying':
                        stream = stream.replace('13', '5').replace('17', '9')
                    tears += at_eye(stream, far, .9)
                art = tears + clip + f'<g clip-path="url(#face)">{art}</g>'
            else:
                metadata[key] = {'clip': 'faceMask'}
        frames[key] = art
    # Separate each lens mark so reflection moves its centre, never its glyph.
    b = path('M-8 -15 -2 -15 -2 -19 2 -19 2 -15 5 -15 5 -19 9 -19 9 -14 '
             'Q20 -12 14 -2 Q23 7 10 13 L10 18 6 18 6 14 2 14 2 18 '
             '-2 18 -2 14 -8 14 -8 9 -5 9 -5 -10 -8 -10Z '
             'M1 -9 1 -4 7 -4 Q12 -7 7 -9Z M1 2 1 8 8 8 Q14 5 8 2Z', WHITE, INK, 1.5)
    for far, key in zip((False, True), DECALS['BTC Glass']):
        frames[key] = at_eye(f'<g transform="translate(-4 0)">{b}</g>', far)
    letters = path('M74 151H70V157H74 M78 151V157M83 151V157M78 154H83 '
                   'M88 151V157H93V151Z M103 151H98V157H103V154H101',
                   'none', WHITE, 1.3)
    frames['eyes/chog-viper/decal'] = letters
    return frames, metadata


def pack(images, metadata):
    atlas = Image.new('RGBA', (1024, 2048))
    frames, x, y, row = {}, 2, 2, 0
    for key, image in sorted(images.items(), key=lambda item: -item[1].getbbox()[3] + item[1].getbbox()[1]):
        box = image.getbbox()
        tile = image.crop(box)
        w, h = tile.size
        if x + w + 2 > atlas.width:
            x, y, row = 2, y + row + 4, 0
        assert y + h + 2 <= atlas.height, 'atlas overflow'
        atlas.alpha_composite(tile, (x, y))
        frames[key] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h},
                       'rotated': False, 'trimmed': True,
                       'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h},
                       'sourceSize': {'w': 256, 'h': 320}, **metadata.get(key, {})}
        if key.endswith('/decal'):
            frames[key]['decal'] = {'anchor': {'x': (box[0]+box[2])/2, 'y': (box[1]+box[3])/2},
                                    'size': {'w': w, 'h': h}}
        x, row = x + w + 4, max(row, h)
    atlas = atlas.crop((0, 0, 1024, 2 ** math.ceil(math.log2(y + row + 2))))
    save_png(ATLAS / 'chog-eyes.png', atlas)
    save_json(ATLAS / 'chog-eyes.json', {'frames': frames, 'meta': {
        'app': 'Candy Siege Eyes drawing masters', 'version': '1',
        'image': 'chog-eyes.png', 'format': 'RGBA8888',
        'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1', 'padding': 2,
        'references': REFERENCES, 'eyeDecals': DECALS,
        'decalIntegration': 'Select the separate eye decals alongside eyes/<slug> via meta.eyeDecals; reflect decal centres without mirroring glyphs.',
    }})
    return atlas.size


def add_decals(compositor, image, value, left=False):
    for key in DECALS.get(value, []):
        image.alpha_composite(compositor.layer(key, '#ffffff', left))
    return image


def preview(compositor):
    cell_w, cell_h, columns = 690, 330, 3
    canvas = Image.new('RGBA', (columns*cell_w, 150+math.ceil(len(REFERENCES)/columns)*cell_h), '#f3eee3')
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 16), 'CHOG EYES / WAVE 2B / 58 FRONT-FACING TRAITS', font=font(28), fill=INK)
    draw.text((24, 56), 'Each card: isolated layer / real Chog right / real Chog left / actual 64px head checks', font=font(18), fill=INK)
    draw.text((24, 84), 'Singletons reuse their sole real ID. Both facings are rendered by compose.py, including eye decals.', font=font(16), fill='#655a63')
    draw.text((24, 108), 'Compositions use all atlases present. Pending head/body/form layers are outside this Eyes batch.', font=font(16), fill='#655a63')
    missing = set()
    for n, (value, refs) in enumerate(REFERENCES.items()):
        x, y = n % columns*cell_w, 150+n//columns*cell_h
        draw.rounded_rectangle((x+8, y+6, x+cell_w-8, y+cell_h-6), radius=10, fill='#faf8f2', outline='#d4c9bc')
        draw.text((x+20, y+16), f'{n+1:02d}  {value}', font=font(19), fill=INK)
        second = refs[min(1, len(refs)-1)]
        label = f'Refs: {", ".join(str(i) for i in refs)}'
        if len(refs) == 1:
            label += '  |  sole matching Chog'
        draw.text((x+20, y+42), label, font=font(13), fill='#655a63')
        isolated = add_decals(compositor, compositor.layer(f'eyes/{slug(value)}', '#ffffff'), value)
        composed = []
        with tempfile.TemporaryDirectory(prefix='chog-eyes-') as temporary:
            for token, left_facing in ((refs[0], False), (second, True)):
                output = Path(temporary) / 'composed.png'
                staged = output.with_suffix('.tmp')
                command = [sys.executable, '-B', str(HERE / 'compose.py'), str(token)]
                command += ['--left'] if left_facing else []
                result = subprocess.run(command + ['-o', str(staged)], check=True, capture_output=True, text=True)
                staged.replace(output)
                missing.update(result.stderr.strip().splitlines())
                with Image.open(output) as image:
                    composed.append(image.convert('RGBA'))
        right, left = composed
        for i, (label, sprite) in enumerate((('ISOLATED', isolated), (f'#{refs[0]} RIGHT', right), (f'#{second} LEFT', left))):
            tile = sprite.crop((0, 45, 256, 245)).resize((210, 164), Image.Resampling.LANCZOS)
            if i == 0:
                for yy in range(0, 164, 12):
                    for xx in range(0, 210, 12):
                        draw.rectangle((x+18+xx, y+83+yy, x+18+min(xx+11,209), y+83+min(yy+11,163)),
                                       fill='#e6e4df' if (xx//12+yy//12)%2 else '#f3f1eb')
            canvas.alpha_composite(tile, (x+18+i*221, y+83))
            draw.text((x+24+i*221, y+65), label, font=font(12), fill='#655a63')
        for i, sprite in enumerate((right, left)):
            small = sprite.crop((16, 56, 240, 245)).resize((64, 54), Image.Resampling.LANCZOS)
            canvas.alpha_composite(small, (x+250+i*221, y+254))
        draw.text((x+20, y+266), '64px head', font=font(12), fill='#655a63')
        if value in DECALS:
            draw.text((x+20, y+289), '+ separate decals', font=font(12), fill='#9b4d25')
    save_png(HERE / 'preview-eyes.png', canvas)
    return missing


def self_check(compositor, images):
    values = set(compositor.traits['values']['Eyes']) - {''}
    assert values == set(REFERENCES), 'Eyes coverage mismatch'
    for value, refs in REFERENCES.items():
        assert len(refs) == len(set(refs)) and refs
        for token in refs:
            assert compositor.values(token)['Eyes'] == value, (value, token)
            assert (DATA.parent / 'chogs-256' / f'{token}.webp').is_file()
        count = sum(row[compositor.traits['keys'].index('Eyes')] == compositor.traits['values']['Eyes'].index(value)
                    for row in compositor.traits['chogs'].values())
        assert len(refs) == min(3, count), (value, count)
        for token, left in ((refs[0], False), (refs[min(1, len(refs)-1)], True)):
            assert compositor.compose(token, left=left).getbbox()
            assert not any(item.startswith('eyes/') for item in compositor.missing)
    for key, source in images.items():
        restored = compositor.layer(key, '#ffffff')
        frame = compositor.frames[key][2]
        # Ignore clipping only for the raw atlas round-trip; composition tests it.
        clip = frame.pop('clip', None)
        try:
            raw = compositor.layer(key, '#ffffff')
            assert ImageChops.difference(source, raw).getbbox(alpha_only=False) is None, key
        finally:
            if clip:
                frame['clip'] = clip
        if not key.endswith('/decal'):
            assert ImageChops.difference(compositor.layer(key, '#ffffff', True),
                                        ImageOps.mirror(restored)).getbbox(alpha_only=False) is None, key
        rect = frame['frame']; atlas = compositor.images[ATLAS / 'chog-eyes.png']
        x, y, w, h = (rect[k] for k in ('x', 'y', 'w', 'h'))
        padded = atlas.crop((x-2, y-2, x+w+2, y+h+2))
        padded.paste((0,0,0,0), (2,2,w+2,h+2))
        assert padded.getbbox() is None, f'nontransparent packing gutter: {key}'


def main():
    art, metadata = drawings()
    images = {}
    for key, drawing in art.items():
        master = HERE / 'svg' / f'{key}.svg'
        write(master, svg(key, drawing))
        raster = subprocess.run(['rsvg-convert', str(master)], check=True, capture_output=True).stdout
        images[key] = Image.open(io.BytesIO(raster)).convert('RGBA')
        assert images[key].getbbox(), key
    size = pack(images, metadata)
    compositor = Compositor()
    self_check(compositor, images)
    missing = preview(compositor)
    print(f'58 Eyes values + 3 separate decals; atlas {size[0]}x{size[1]}; coverage, trim, gutters and facing passed.')
    print(f'Preview: {HERE / "preview-eyes.png"}')
    print('Singleton values: ' + ', '.join(value for value, ids in REFERENCES.items() if len(ids) == 1))
    print(f'Other-batch pending composition entries: {len(missing)}. Both facings checked through compose.py; gameplay not checked.')


if __name__ == '__main__':
    main()
