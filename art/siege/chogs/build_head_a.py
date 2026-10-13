#!/usr/bin/env python3
"""Draw the 39 front-facing wave-2b hat values (37 slugs)."""
import sys
sys.dont_write_bytecode = True

import io
import json
import math
import subprocess
from html import escape

from PIL import Image, ImageDraw, ImageOps

from build_chogs import INK, ellipse, font, path, save_json, save_png, svg, write
from compose import Compositor, DATA, HERE, SIZE, slug

VALUES = 'MCGA|Chog Cap|Red Peace Cap|Thunder Cap|Star Cap|TISM Cap|Horny Cap|Mon Cap|Cloud Cap|Balls Cap|MEGA Chog|Dollar Cap|BTC Beanie|Boob Cap|Orange Bucket Cap|Blue Bucket Cap|RETARD Cap|Wizard Beanie|WAGMI Cap|MMGA Cap|Gray Bucket Cap|BOOB Cap|Buttcoin Cap|Choggie Beanie|10k TPS Cap|Peace hat|JEET Cap|BTC Cap|Choggie Cap|RH Beanie|Mon Beanie|Peace Cap|ETH Cap|MCGA Cap|8 Ball Beanie|Jeet Cap|Russian Hat|Mafia Hat|Plumber'.split('|')
REFERENCES = {
    'MCGA': [1, 11, 1596], 'Chog Cap': [2, 273, 1832],
    'Red Peace Cap': [3, 17, 49], 'Thunder Cap': [4, 14, 29],
    'Star Cap': [5, 38, 64], 'TISM Cap': [6, 23, 24],
    'Horny Cap': [9, 54, 160], 'Mon Cap': [10, 32, 33],
    'Cloud Cap': [12, 136, 166], 'Balls Cap': [13, 16, 25],
    'MEGA Chog': [15, 31, 365], 'Dollar Cap': [20, 120, 167],
    'BTC Beanie': [26, 84, 112], 'Boob Cap': [35, 59, 82],
    'Orange Bucket Cap': [36, 65, 146], 'Blue Bucket Cap': [40, 71, 158],
    'RETARD Cap': [44, 253, 74], 'Wizard Beanie': [45, 256, 630],
    'WAGMI Cap': [46, 67, 88], 'MMGA Cap': [47, 139, 223],
    'Gray Bucket Cap': [50, 107, 172], 'BOOB Cap': [61, 1354, 1587],
    'Buttcoin Cap': [63, 91, 281], 'Choggie Beanie': [76, 244, 408],
    '10k TPS Cap': [77, 198, 79], 'Peace hat': [85, 114, 117],
    'JEET Cap': [94, 174, 152], 'BTC Cap': [118, 135, 991],
    'Choggie Cap': [122, 208, 221], 'RH Beanie': [127, 210, 141],
    'Mon Beanie': [165, 325, 1797], 'Peace Cap': [181],
    'ETH Cap': [428, 1821], 'MCGA Cap': [432, 593, 439],
    '8 Ball Beanie': [896], 'Jeet Cap': [1729],
    'Russian Hat': [52, 55, 57], 'Mafia Hat': [1819], 'Plumber': [19, 51, 492],
}
NOTES = {
    'Chog Cap': 'Purple MAKE CHOG GREAT AGAIN on #2/#273; #1832 has white CHOG artwork under the same trait.',
    'Mon Cap': 'Purple crown on #10/#33; #32 has a white crown under the same trait.',
    'Russian Hat': 'Brown/tan ushanka on #52/#55; #57 has a purple shell under the same trait.',
    'Peace Cap': 'Only one matching NFT exists; preview repeats #181 in opposite facings.',
    '8 Ball Beanie': 'Only one matching NFT exists; preview repeats #896 in opposite facings.',
    'Mafia Hat': 'Only one matching NFT exists; preview repeats #1819 in opposite facings.',
    'Jeet Cap': 'Only one case-variant NFT exists; shared jeet-cap art also checked on JEET Cap.',
}
WHITE = '#fff8e7'


def lettering(text, x=130, y=88, size=19, color=WHITE, stroke='none', width=0):
    return (f'<text x="{x}" y="{y}" text-anchor="middle" font-family="DejaVu Sans" '
            f'font-weight="bold" font-size="{size}" fill="{color}" stroke="{stroke}" '
            f'stroke-width="{width}" paint-order="stroke fill">{escape(text)}</text>')


def emblem(kind, x=130, y=79, color=WHITE):
    if kind == 'star':
        art = path('M0 -18 5 -6 18 -5 8 4 11 17 0 10 -12 17 -9 4 -19 -5 -5 -7Z', color, 'none', 0)
    elif kind == 'paw':
        art = path('M-13 10 Q-13 3 -5 0 Q0 -5 5 0 Q13 3 13 10 Q10 16 0 12 Q-10 16 -13 10Z', color, 'none', 0)
        for cx, cy in [(-14, -5), (-6, -13), (5, -13), (14, -5)]:
            art += ellipse(cx, cy, 4, 5, color)
    elif kind == 'bolt':
        art = path('M-1 -20 -14 3 -2 1 -6 20 15 -6 2 -4 8 -20Z', color, 'none', 0)
    elif kind == 'peace':
        art = ellipse(0, 0, 17, 17, 'none', color, 3.6)
        art += path('M0 -16V16M0 1 -12 12M0 1 12 12', 'none', color, 3.5)
    elif kind == 'mon':
        art = '<rect x="-14" y="-14" width="28" height="28" rx="8" fill="%s" transform="rotate(-20)"/>' % color
        art += '<rect x="-7" y="-7" width="14" height="14" rx="2" fill="#7051b5" transform="rotate(-20)"/>'
    elif kind == 'cloud':
        art = path('M-27 10Q-16 14 -15 5Q-30 7 -24 -3Q-20 -9 -13 -4Q-16 -18 -4 -16Q7 -20 11 -9Q23 -13 26 -2Q27 4 20 5Q18 14 30 9M-15 5Q-8 10 -5 3M11 -8Q1 -4 8 3Q15 8 19 3', 'none', color, 4)
    elif kind == 'btc':
        art = lettering('₿', x=0, y=14, size=42, color=color)
    elif kind == 'eth':
        art = path('M0 -22 -14 1 0 9 14 1Z', '#717579', 'none', 0)
        art += path('M0 -22V9L14 1Z', '#34383b', 'none', 0)
        art += path('M-14 5 0 23 14 5 0 13Z', '#555b60', 'none', 0)
    else:
        raise ValueError(kind)
    return f'<g transform="translate({x} {y})">{art}</g>'


def cap(crown, shade, bill, light, full=False):
    # Level seat at (128, 114); the visor projects forward with a slight right turn.
    outline = ('M43 116 Q41 71 69 47 Q91 28 126 28 Q162 27 187 47 '
               'Q214 72 213 116 Q128 134 43 116Z' if full else
               'M60 116 Q60 77 81 55 Q101 37 127 38 Q155 37 177 55 '
               'Q200 78 200 116 Q130 132 60 116Z')
    art = path(outline, crown, INK, 4.5)
    art += path('M90 37 Q54 68 56 116 L44 116 Q41 65 90 37Z' if full else
                'M100 44 Q70 74 73 116 L61 116 Q59 66 100 44Z', shade, 'none', 0)
    art += path('M119 29 Q69 58 73 114 M137 29 Q187 58 185 114' if full else
                'M119 39 Q78 67 84 114 M138 39 Q179 67 177 114', 'none', INK, 2)
    art += path('M111 38 Q132 31 150 39' if full else 'M113 46 Q132 40 149 47', 'none', light, 2.6)
    art += path('M44 113 Q128 98 212 113 Q225 121 232 134 '
                'Q215 130 195 136 Q134 151 72 136 Q48 130 28 134 Q32 122 44 113Z' if full else
                'M60 113 Q130 101 200 113 Q220 122 226 133 '
                'Q211 130 192 136 Q134 147 78 136 Q57 130 37 134 Q43 122 60 113Z', bill, INK, 4.5)
    art += path('M43 128 Q78 124 99 132 Q133 141 171 132 Q202 124 218 129', 'none', light, 2)
    if not full:
        art += ellipse(79, 91, 2.4, 2.4, shade, INK, 1)
        art += ellipse(181, 91, 2.4, 2.4, shade, INK, 1)
    return art


def bucket(crown, shade, light):
    art = path('M57 108 77 48 Q128 32 179 48 L199 108 Q128 124 57 108Z', crown, INK, 4.5)
    art += path('M77 48 87 46 72 108 58 108Z', shade, 'none', 0)
    art += path('M86 53 Q128 41 172 53', 'none', light, 2.5)
    art += path('M57 106 Q128 95 199 106 L228 138 Q128 127 28 138Z', crown, INK, 4.5)
    art += path('M28 138 41 124 Q128 113 215 124 L228 138 Q128 127 28 138Z', shade, 'none', 0)
    for offset in (0, 5, 10):
        art += path(f'M{50-offset} {115+offset} Q128 {103+offset} {206+offset} {115+offset}', 'none', light, 1.6)
    art += path('M28 138 Q128 127 228 138', 'none', INK, 3)
    return art


def beanie(color, shade, light, stripes=False, rings=False, ribbed=False):
    dome = 'M40 119 Q38 65 65 40 Q87 19 128 19 Q169 19 191 40 Q218 65 216 119 Q128 141 40 119Z'
    art = path(dome, color, INK, 4.5)
    art += path('M78 31 Q44 66 54 119 L41 119 Q37 61 78 31Z', shade, 'none', 0)
    art += path('M86 32 Q128 15 166 32', 'none', light, 3)
    if rings:
        for x, y in [(76, 52), (111, 40), (146, 40), (181, 52), (66, 81), (107, 73), (148, 73), (188, 81)]:
            art += path(f'M{x-5} {y-5} l8 -2 4 7 -3 7 -9 -1 -2 -7Z', 'none', '#eee32e', 2.6)
    if ribbed:
        art += '<defs><clipPath id="dome"><path d="' + dome + '"/></clipPath></defs><g clip-path="url(#dome)">'
        for x in range(50, 211, 9):
            art += path(f'M{x} 38 Q{128+(x-128)*1.1:.1f} 72 {128+(x-128)*1.12:.1f} 118', 'none', light, 2)
        art += '</g>'
    cuff = 'M39 106 Q128 90 217 106 L220 132 Q128 119 36 132Z'
    art += path(cuff, color, INK, 4.5)
    art += '<defs><clipPath id="cuff"><path d="' + cuff + '"/></clipPath></defs><g clip-path="url(#cuff)">'
    for x in range(25, 232, 11):
        art += path(f'M{x} 92 {x+(x-128)*.08:.1f} 140', 'none', '#a52bea' if stripes and x % 22 == 3 else shade, 6 if stripes else 1.8)
    art += '</g>' + path(cuff, 'none', INK, 3.5)
    return art


def drawings():
    hats = {}
    def add(name, front, decal=''):
        hats[f'head/{slug(name)}/front'] = front
        if decal:
            hats[f'head/{slug(name)}/decal'] = decal

    purple = cap('#9955d5', '#7939b6', '#4c267e', '#b177e5', True)
    slogan = lettering('MAKE CHOG', 130, 72, 12) + lettering('GREAT AGAIN', 130, 90, 11)
    add('MCGA', purple, slogan)
    add('Chog Cap', purple, slogan)
    for name, c, s, l, kind, mark in [
        ('Red Peace Cap', '#c64853', '#a63646', '#dc7078', 'peace', WHITE),
        ('Thunder Cap', '#149ad0', '#0878af', '#37b3e3', 'bolt', '#ffe435'),
        ('Star Cap', '#626364', '#49494c', '#7c7c7e', 'star', WHITE),
        ('Cloud Cap', '#444ac8', '#333aa3', '#656ddd', 'cloud', WHITE),
        ('Balls Cap', '#a337c4', '#7e22a0', '#bc59db', 'paw', WHITE),
        ('Peace Cap', '#c64853', '#a63646', '#dc7078', 'peace', WHITE),
    ]:
        add(name, bucket(c, s, l), emblem(kind, 130, 77, mark))
    add('TISM Cap', cap('#dd3348', '#b92339', '#252334', '#57516a'), emblem('star'))
    add('Horny Cap', cap('#343cbf', '#25298e', '#9c9ce8', '#c2b4f0'), emblem('bolt', color='#ffc632'))
    add('Mon Cap', cap('#7553ad', '#56348c', '#51368b', '#986cce'), emblem('mon'))
    add('MEGA Chog', cap('#f0f0d9', '#dfbca5', '#ed511c', '#ffab55', True),
        lettering('MEGA', 130, 70, 17, '#191c17') + lettering('CHOG', 130, 91, 19, '#191c17'))
    patch = path('M82 61H177V93H82Z', '#d4f1e9', INK, 1.5)
    patch += lettering('JUST A KID WITH', 130, 74, 7.6, INK) + lettering('$1 AND A DREAM', 130, 87, 8, INK)
    add('Dollar Cap', cap('#35c0d6', '#1495b6', '#29b1cb', '#8addde'), patch)
    pizza = path('M61 107 88 97 81 127Z', '#f7d441', '#913718', 2)
    pizza += path('M60 106 87 96 91 102 63 112Z', '#e99930', '#913718', 1.5)
    pizza += ellipse(75, 109, 2.2, 2.2, '#e64320') + ellipse(79, 117, 2, 2, '#e64320')
    add('BTC Beanie', beanie('#f25a1c', '#c53d12', '#ff8841'), f'<g transform="translate(55 1)">{pizza}</g>')
    add('Boob Cap', cap('#ed6b1e', '#cf4912', '#e76e2b', '#ffad68'), emblem('paw'))
    for name, c, s, l in [('Orange Bucket Cap', '#d76b2c', '#b85322', '#e9985a'),
                          ('Blue Bucket Cap', '#4c63d7', '#354cbb', '#7e91ec'),
                          ('Gray Bucket Cap', '#9ba8b0', '#7d8d97', '#d6dde0')]:
        badge = '<rect x="113" y="62" width="34" height="25" rx="4" fill="#e7e9e1"/>'
        add(name, bucket(c, s, l), badge)
    add('RETARD Cap', cap('#bb49e5', '#9c2fc3', '#c79bed', '#e3b8fa', True), emblem('star', color=WHITE))
    add('Wizard Beanie', beanie('#233ddb', '#1225a6', '#4164ee', rings=True))
    add('WAGMI Cap', cap('#d13792', '#af2077', '#db76b6', '#f0a2d4', True), lettering('WAGMI', 130, 86, 20, WHITE, INK, 1.6))
    add('MMGA Cap', cap('#c9d6dd', '#98aab9', '#57a8d9', '#91d0eb'), lettering('MMGA', 130, 85, 20, '#6240bd', INK, 1.6))
    add('Buttcoin Cap', cap('#ed981c', '#c6750f', '#372b19', '#725328', True), emblem('bolt'))
    chog = path('M67 102 72 95 80 98 85 91 89 100 96 102 91 108 91 114 82 114 78 119 74 113 66 112 70 107Z', '#d6b9ef', INK, 1.5)
    chog += ellipse(79, 105, 1.5, 1.8, INK) + ellipse(87, 103, 1.3, 1.5, INK)
    chog += path('M80 111 85 110', 'none', INK, 1.5)
    add('Choggie Beanie', beanie('#454340', '#272624', '#6c6964'), f'<g transform="translate(49 4)">{chog}</g>')
    tps = path('M104 53H157V93H104Z', '#f8f8ed', '#6745a3', 1.5)
    tps += path('M104 53H157V75H104Z', '#6745a3', 'none', 0)
    tps += lettering('10K', 130, 71, 19) + lettering('TPS', 130, 90, 16, '#6745a3')
    add('10k TPS Cap', cap('#eeece9', '#c3c2be', '#494b48', '#7a7d74', True), tps)
    add('Peace hat', cap('#7baf99', '#385a4b', '#405f52', '#abd2bb'), emblem('peace'))
    add('JEET Cap', cap('#24b940', '#0b9630', '#9bd9a1', '#b8ecb6', True), lettering('JEET', 130, 87, 24, WHITE, INK, 1.8))
    add('BTC Cap', cap('#f49a23', '#ce7b13', '#3b301e', '#70542c', True), emblem('btc'))
    add('Choggie Cap', cap('#f0e9dc', '#cfc1bb', '#cb5889', '#f28ab7'), lettering('CHOG', 130, 86, 20, '#66449c', INK, 1.8))
    rh = path('M73 76 84 65 101 66 91 74 99 87 86 83 86 75Z M93 74 103 69 116 83 104 87Z', '#191f1f', 'none', 0)
    add('RH Beanie', beanie('#d5ed18', '#9ab80b', '#f4fb65'), f'<g transform="translate(35 0)">{rh}</g>')
    add('Mon Beanie', beanie('#159edd', '#176cc0', '#57c7f1', stripes=True))
    add('ETH Cap', cap('#e1e1df', '#9aa4cb', '#dddfe9', '#ffffff'), emblem('eth'))
    add('MCGA Cap', cap('#e92327', '#bf0d1b', '#de2126', '#ff6264', True), lettering('MCGA', 130, 86, 22, '#f8c037', '#e78920', 1.4))
    eight = ellipse(130, 68, 25, 28, '#e7e7e1') + lettering('8', 130, 86, 46, '#33353b')
    add('8 Ball Beanie', beanie('#414248', '#292a30', '#76777d', ribbed=True), eight)
    fur = '#e7c8a0'
    ushanka = path('M42 111 Q37 69 61 43 Q85 21 128 21 Q171 21 195 43 '
                   'Q219 69 214 111 L224 177 Q223 191 210 190 L195 121 '
                   '61 121 46 190 Q33 191 32 177Z', '#895339', INK, 4.5)
    ushanka += path('M44 108 36 177 41 183 49 171 60 112Z '
                    'M212 108 220 177 215 183 207 171 196 112Z', fur, INK, 2.5)
    ushanka += path('M51 65 60 60 66 52 77 54 85 47 98 49 108 43 120 46 '
                    '128 42 136 46 148 43 158 49 171 47 179 54 190 52 196 60 205 65 '
                    '210 116 200 120 191 116 181 122 171 119 160 124 149 121 '
                    '138 125 128 122 118 125 107 121 96 124 85 119 75 122 '
                    '65 116 56 120 46 116Z', fur, INK, 4)
    ushanka += path('M56 85 61 68 75 61M93 58 106 54 117 56M177 60 191 66', 'none', '#f6dfb8', 5)
    ushanka += path('M57 108 66 111 76 108 86 114 97 111 108 116 119 113 '
                    '128 116 137 113 148 116 159 111 170 114 180 108 190 111 199 108', 'none', '#c99976', 4)
    add('Russian Hat', ushanka)
    mafia = path('M57 108 69 38 Q94 21 128 37 Q160 21 187 38 L199 108Z', '#383644', INK, 4.5)
    mafia += path('M75 43 Q98 33 128 48 Q156 33 181 43', 'none', '#575263', 3)
    mafia += path('M60 89 Q128 104 196 89 L200 109 Q128 127 56 109Z', '#dedbd3', INK, 3)
    mafia += path('M57 105 Q29 101 24 121 Q44 143 128 143 Q212 143 232 121 '
                  'Q227 101 199 105 Q128 124 57 105Z', '#383644', INK, 4.5)
    mafia += path('M38 124 Q128 151 220 123', 'none', '#55505f', 2.5)
    add('Mafia Hat', mafia)
    plunger = ellipse(128, 94, 31, 11, '#9e232c', INK, 3.5)
    plunger += path('M97 92 Q94 60 111 52 Q128 43 145 52 Q162 60 159 92 '
                    'Q128 110 97 92Z', '#ed302e', INK, 4.5)
    plunger += path('M103 87 Q128 101 153 87 L157 84 Q159 99 128 103 Q108 101 103 94Z', '#c51825', 'none', 0)
    plunger += path('M102 76 Q103 59 118 56M127 54 135 56', 'none', '#fa7970', 3)
    plunger += path('M124 56 124 49 143 7 Q146 2 151 6 L135 54 Q133 63 124 56Z', '#9d6b44', INK, 3.5)
    plunger += path('M130 47 146 9', 'none', '#d09963', 2)
    plunger += ellipse(130, 56, 7, 4, '#c62726', INK, 2.5)
    add('Plumber', plunger)
    return hats


def pack(images):
    atlas = Image.new('RGBA', (1024, 2048))
    frames, x, y, row = {}, 2, 2, 0
    for name, image in sorted(images.items(), key=lambda pair: -(pair[1].getbbox()[3] - pair[1].getbbox()[1])):
        box = image.getbbox()
        tile = image.crop(box)
        w, h = tile.size
        if x + w + 2 > atlas.width:
            x, y, row = 2, y + row + 4, 0
        assert y + h + 2 <= atlas.height, name
        atlas.alpha_composite(tile, (x, y))
        frame = {'frame': dict(x=x, y=y, w=w, h=h), 'rotated': False, 'trimmed': True,
                 'spriteSourceSize': dict(x=box[0], y=box[1], w=w, h=h),
                 'sourceSize': dict(w=256, h=320)}
        if name.endswith('/decal'):
            frame['decal'] = {'anchor': {'x': (box[0] + box[2]) / 2, 'y': (box[1] + box[3]) / 2},
                              'size': dict(w=w, h=h)}
        frames[name] = frame
        x, row = x + w + 4, max(row, h)
    atlas = atlas.crop((0, 0, 1024, 2 ** math.ceil(math.log2(y + row + 2))))
    save_png(DATA / 'atlas/chog-head-a.png', atlas)
    save_json(DATA / 'atlas/chog-head-a.json', {'frames': frames, 'meta': {
        'app': 'Candy Siege Chog drawing masters', 'version': '1', 'image': 'chog-head-a.png',
        'format': 'RGBA8888', 'size': dict(w=atlas.width, h=atlas.height), 'scale': '1', 'padding': 2,
        'values': VALUES, 'references': REFERENCES, 'referenceLimits': NOTES,
        'neutralEmblems': ['TISM Cap', 'Horny Cap', 'Balls Cap', 'Boob Cap', 'BOOB Cap', 'RETARD Cap', 'Buttcoin Cap'],
        'spikes': 'Full crowns and beanies cover top spikes; perched caps/buckets retain side tufts; Plumber retains crown spikes.',
    }})
    return atlas.size


def preview(compositor, images):
    sheet = Image.new('RGBA', (1800, 110 + 360 * math.ceil(len(VALUES) / 3)), '#f3eee3')
    d = ImageDraw.Draw(sheet)
    d.text((22, 15), 'CHOG / WAVE 2B / FRONT-FACING CAPS & HATS', font=font(28), fill=INK)
    d.text((22, 54), '39 trait values / 37 shared slugs. Hat alone, two real IDs (right + left), and exact 64px-wide canvas checks.', font=font(17), fill=INK)
    d.text((22, 80), 'Source portraits below each hat. Single-ID traits repeat that ID. Current shared compositor includes available trait atlases.', font=font(15), fill='#6e6466')
    for i, value in enumerate(VALUES):
        x, y = (i % 3) * 600, 110 + (i // 3) * 360
        refs = REFERENCES[value]
        pair = [refs[0], refs[1] if len(refs) > 1 else refs[0]]
        d.line((x, y, x + 600, y), fill='#cfc5b8')
        d.text((x + 12, y + 10), value, font=font(20), fill=INK)
        if value in NOTES:
            label = 'ONE ID: both facings' if len(refs) == 1 else 'Portrait variant: see atlas notes'
            d.text((x + 12, y + 36), label, font=font(11), fill='#9b453b')
        alone = Image.new('RGBA', SIZE)
        for suffix in ('back', 'front', 'decal'):
            key = f'head/{slug(value)}/{suffix}'
            if key in images:
                alone.alpha_composite(images[key])
        sheet.alpha_composite(alone.resize((154, 192), Image.Resampling.LANCZOS), (x + 10, y + 58))
        for col, chog_id in enumerate(pair):
            head = compositor.compose(chog_id, left=bool(col))
            px = x + 178 + 210 * col
            sheet.alpha_composite(head.resize((176, 220), Image.Resampling.LANCZOS), (px, y + 32))
            sheet.alpha_composite(head.resize((64, 80), Image.Resampling.LANCZOS), (px + 54, y + 250))
            d.text((px + 25, y + 238), f'#{chog_id} / {"LEFT" if col else "RIGHT"}', font=font(12), fill=INK)
        for j, chog_id in enumerate(refs):
            with Image.open(DATA.parent / f'chogs-256/{chog_id}.webp') as portrait:
                sheet.alpha_composite(portrait.convert('RGBA').resize((56, 56)), (x + 12 + j * 60, y + 278))
            d.text((x + 12 + j * 60, y + 336), str(chog_id), font=font(10), fill=INK)
        d.text((x + 12, y + 254), 'NFT REFERENCES', font=font(11), fill='#6e6466')
    save_png(HERE / 'preview-head-a.png', sheet)


def self_check(compositor, images):
    assert len(VALUES) == 39 and len({slug(v) for v in VALUES}) == 37
    for value in VALUES:
        assert f'head/{slug(value)}/front' in images
        for chog_id in REFERENCES[value]:
            assert compositor.values(chog_id)['Head'] == value
        for chog_id in REFERENCES[value][:2]:
            compositor.compose(chog_id)
            compositor.compose(chog_id, left=True)
    for name, original in images.items():
        right = compositor.layer(name, '#ffffff')
        assert original.tobytes() == right.tobytes(), name
        left = compositor.layer(name, '#ffffff', left=True)
        if name.endswith('/decal'):
            assert right.crop(right.getbbox()).tobytes() == left.crop(left.getbbox()).tobytes(), name
        else:
            assert left.tobytes() == ImageOps.mirror(right).tobytes(), name


def main():
    images = {}
    for name, art in drawings().items():
        master = svg(name, art)
        write(HERE / 'svg/head-a' / (name.removeprefix('head/') + '.svg'), master)
        png = subprocess.run(['rsvg-convert'], input=master.encode(), capture_output=True, check=True).stdout
        images[name] = Image.open(io.BytesIO(png)).convert('RGBA')
    size = pack(images)
    compositor = Compositor()
    self_check(compositor, images)
    preview(compositor, images)
    print(f'PASS: 39 values / 37 slugs / {len(images)} frames; atlas {size[0]}x{size[1]}')
    print(f'Preview: {HERE / "preview-head-a.png"}')


if __name__ == '__main__':
    main()
