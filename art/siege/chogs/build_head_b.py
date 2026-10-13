#!/usr/bin/env python3
"""Draw and verify only chog-head-b and its SVG masters/contact sheet."""
import sys
sys.dont_write_bytecode = True

import io
import json
import math
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

from build_chogs import ATLAS, HERE, INK, ellipse, font, path, save_json, save_png, svg, write
from compose import Compositor, DATA, SIZE, slug

BATCH = 'head-b'
# All available portraits were inspected when fewer than three carry a value.
REFERENCES = {
    'Wizard Hat': [7, 18, 34], 'Rainbow Wig': [8, 103, 110],
    'Japan Headband': [27, 73, 93], 'Bob Hair': [30, 246, 260],
    'Durag': [56, 102, 163], 'Crown': [66, 131, 134],
    'Spartan Helmet': [75, 183, 290], 'Clown Nose': [83, 92, 97],
    'Red Headband': [89, 148, 234], 'Robber': [150, 192, 231],
    'NEET': [157, 226, 488], 'Silver Thorn': [186, 1615],
    '3rd Eye': [196, 388, 1106], 'Gold Thorn': [262, 358, 377],
    'Purple Horn': [284, 539], 'Holy Seal': [352, 923, 1251],
    'Head Wrap': [400], 'Void Horn': [648, 1730],
    'Silver wreath': [715, 926, 1447], 'Red Horn': [783, 981, 1180],
    'Demon Horn': [851, 1133, 1968], 'Taped Banana': [881, 1486],
    'Blue Laser': [1280], 'Diamond': [1342, 1517],
    'Red Bandana': [1382, 1700], 'Poison Shroom': [1608], 'devil horn': [1733],
}
HIDES_SPIKES = {'rainbow-wig', 'bob-hair'}


def star(x, y, r, fill):
    points = [(x + math.cos(-math.pi / 2 + i * math.pi / 5) * (r if i % 2 == 0 else r * .43),
               y + math.sin(-math.pi / 2 + i * math.pi / 5) * (r if i % 2 == 0 else r * .43))
              for i in range(10)]
    return path('M' + ' '.join(f'{a:.2f},{b:.2f}' for a, b in points) + 'Z', fill, 'none', 0)


def band(color, shade):
    return (path('M46 114 Q128 134 210 114 L207 138 Q128 156 49 138Z', color, width=4.5)
            + path('M48 130 Q128 148 208 130 L207 138 Q128 156 49 138Z', shade, 'none', 0)
            + path('M56 122 Q74 126 92 127 M164 127 Q182 126 200 122', width=2))


def band_tail(color):
    return path('M51 119 Q31 108 17 117 L27 132 15 147 Q35 147 51 133Z', color, width=4.5)


def ram_horns(fill, shade):
    # Equal curled horns rooted on the two top-side spike seats.
    horn = path('M66 119 Q67 91 55 80 Q43 70 36 82 Q24 99 8 91 '
                'Q21 83 24 66 Q31 45 52 48 Q81 53 88 111Z', fill, width=4.5)
    horn += path('M8 91 Q24 99 36 82 Q43 70 55 80 Q67 91 66 119 L77 115 '
                 'Q69 79 54 69 Q37 60 30 80 Q21 93 8 91Z', shade, 'none', 0)
    horn += path('M65 105 85 99 M62 93 81 86 M56 82 74 73 '
                 'M46 76 62 57 M36 82 44 49 M26 91 27 61 M17 95 18 82', width=2)
    return horn + f'<g transform="translate(256 0) scale(-1 1)">{horn}</g>'


def cone_horns(fill, shade, line):
    art = ''
    # Three crown horns and an equal pair at the temples.
    for tx, ty, scale, angle in [(73, 118, 1, -12), (128, 111, .70, 0),
                                 (183, 118, 1, 12), (43, 168, .67, -65),
                                 (213, 168, .67, 65)]:
        horn = path('M-13 0 Q-15 -12 0 -58 Q15 -12 13 0 Q0 12 -13 0Z', fill, INK, 4.5)
        horn += path('M3 -48 Q17 -8 13 0 Q6 7 0 6 Q10 -2 3 -48Z', shade, 'none', 0)
        horn += path('M-12 -6 Q0 2 12 -6 M-10 -15 Q0 -8 10 -15 '
                     'M-8 -24 Q0 -18 8 -24 M-5 -34 Q0 -30 5 -34 M-3 -43 Q0 -40 3 -43',
                     'none', line, 2)
        art += f'<g transform="translate({tx} {ty}) rotate({angle}) scale({scale})">{horn}</g>'
    return art


def thorns(fill, light):
    art = path('M40 117 Q128 139 216 117', 'none', INK, 10)
    art += path('M40 117 Q128 139 216 117', 'none', fill, 5)
    art += path('M40 111 54 114 58 100 67 117 82 119 91 106 95 120 '
                'L116 119 128 105 132 119 153 120 161 106 168 119 '
                'L187 117 197 100 202 114 216 111 220 124 '
                'L204 126 203 140 190 129 174 130 169 143 160 133 '
                'L138 134 128 145 120 134 99 133 87 143 83 130 '
                'L67 129 53 140 54 126 37 124Z', fill, width=3)
    art += path('M38 110 Q43 132 64 122 Q82 110 103 128 Q128 142 153 128 '
                'Q174 110 192 122 Q213 132 218 110', 'none', INK, 8)
    art += path('M38 110 Q43 132 64 122 Q82 110 103 128 Q128 142 153 128 '
                'Q174 110 192 122 Q213 132 218 110', 'none', fill, 4)
    art += path('M61 122 76 121 M112 132 126 135 M157 127 169 121 M196 125 208 124',
                'none', light, 2)
    return art


def mushroom(x, y, scale, angle):
    stem = path('M-8 -3 Q-4 15 -10 26 Q0 30 7 24 L10 -3Z', '#b2d08e', width=4.5)
    stem += path('M3 0 Q8 16 1 26 L7 24 10 -3Z', '#7daa6f', 'none', 0)
    cap = path('M-34 0 Q-30 -32 1 -32 Q27 -31 35 0 Q1 17 -34 0Z', '#cda557', width=4.5)
    cap += path('M-34 0 Q0 -18 35 0 Q1 17 -34 0Z', '#dae4b1', width=3)
    cap += path('M-23 0 -6 5 M-13 -5 -2 6 M0 -8 1 6 M13 -5 5 6 M24 -1 9 7', width=2)
    cap += ellipse(-15, -18, 7, 5, '#d7efd6') + ellipse(8, -25, 7, 4, '#d7efd6')
    cap += ellipse(24, -12, 5, 7, '#d7efd6')
    return f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})">{stem + cap}</g>'


def drawings():
    layers = {}

    def add(value, art, part='front'):
        layers[f'head/{slug(value)}/{part}'] = art

    add('Wizard Hat', path('M60 117 Q84 70 107 25 Q118 7 143 8 Q170 9 190 34 '
                          'L150 27 Q146 71 196 117Z', '#26378f', width=4.5)
        + path('M137 14 150 27 Q146 71 196 117 L177 121 Q134 76 137 14Z', '#182265', 'none', 0)
        + path('M35 123 Q65 108 128 108 Q191 108 221 123 L224 131 '
               'Q128 151 32 131Z', '#2c3f9d', width=4.5)
        + path('M40 129 Q128 145 216 129', 'none', '#101b59', 3))
    add('Wizard Hat', ''.join(star(x, y, r, '#f5c236') for x, y, r in
                             [(121, 37, 12), (109, 81, 15), (162, 95, 13), (82, 116, 8)]), 'decal')

    # Full side curls cover the base spikes while retaining the hidesSpikes rule.
    wig = ('M22 231 Q8 228 16 211 Q4 201 13 186 Q3 174 12 159 '
           'Q4 145 16 133 Q7 120 20 107 Q9 94 25 81 Q17 66 37 57 '
           'Q32 42 53 39 Q57 24 76 31 Q87 16 104 27 Q117 17 128 26 '
           'Q139 17 152 27 Q169 16 180 31 Q199 24 203 39 Q224 42 219 57 '
           'Q239 66 231 81 Q247 94 236 107 Q249 120 240 133 '
           'Q252 145 244 159 Q253 174 243 186 Q252 201 240 211 '
           'Q248 228 234 231 Q220 239 210 228 Q195 235 193 222 '
           'Q204 205 201 188 Q205 168 196 151 Q192 135 183 136 '
           'Q174 145 164 134 Q154 144 144 133 Q136 143 128 132 '
           'Q120 143 112 133 Q102 144 92 134 Q82 145 73 136 '
           'Q64 135 60 151 Q51 168 55 188 Q52 205 63 222 '
           'Q61 235 46 228 Q36 239 22 231Z')

    rainbow = ['#f13b42', '#ed9131', '#f3dc37', '#4fc72e', '#288cdf', '#9044d6']
    art = f'<defs><clipPath id="wig"><path d="{wig}"/></clipPath></defs>'
    art += path(wig, rainbow[1], 'none', 0) + '<g clip-path="url(#wig)">'
    for i, color in enumerate(rainbow):
        x = i * 46 - 17
        art += path(f'M{x} 0 H{x+52} Q{x+65} 36 {x+51} 67 Q{x+68} 105 {x+53} 132 '
                    f'Q{x+67} 165 {x+54} 192 L{x+64} 242 H{x-4}Z', color, 'none', 0)
    art += path('M8 189 Q43 211 66 201 L61 224 18 237Z', '#d53045', 'none', 0)
    art += '</g>' + path(wig, 'none', width=4.5)
    add('Rainbow Wig', art)

    add('Japan Headband', band_tail('#f4f3eb'), 'back')
    add('Japan Headband', band('#f4f3eb', '#d9d9e0'))
    add('Japan Headband', ellipse(128, 133, 11, 10, '#ec383d'), 'decal')

    bob = ('M23 229 Q9 226 17 210 Q5 199 14 186 Q4 172 14 158 '
           'Q5 144 18 133 Q8 119 23 108 Q13 94 30 83 Q22 67 43 61 '
           'Q40 45 61 43 Q65 29 84 37 Q97 24 111 35 Q122 26 128 33 '
           'Q134 26 145 35 Q159 24 172 37 Q191 29 195 43 Q216 45 213 61 '
           'Q234 67 226 83 Q243 94 233 108 Q248 119 238 133 '
           'Q251 144 242 158 Q252 172 242 186 Q251 199 239 210 '
           'Q247 226 233 229 Q219 238 207 227 Q193 235 193 220 '
           'Q202 203 199 184 Q203 165 191 146 Q177 138 164 142 '
           'Q146 137 128 141 Q110 137 92 142 Q79 138 65 146 '
           'Q53 165 57 184 Q54 203 63 220 Q63 235 49 227 '
           'Q37 238 23 229Z')
    add('Bob Hair', path(bob, '#f6ce38', width=4.5)
        + path('M14 186 Q26 203 25 218 Q36 232 55 221 L61 225 '
               'Q51 237 42 231 Q27 240 20 224 Q10 223 17 210Z', '#e7a834', 'none', 0)
        + path('M242 186 Q230 203 231 218 Q220 232 201 221 L195 225 '
               'Q205 237 214 231 Q229 240 236 224 Q246 223 239 210Z', '#e7a834', 'none', 0)
        + path('M41 97 Q29 111 41 123 M53 65 Q43 67 45 80 M76 53 Q87 48 92 55 '
               'M215 97 Q227 111 215 123 M203 65 Q213 67 211 80', 'none', '#ffe976', 3)
        + band('#ed3735', '#be282f'))

    add('Durag', path('M53 113 Q33 116 18 147 L36 143 32 165 Q58 150 65 126Z',
                      '#4a465a', width=4.5), 'back')
    add('Durag', path('M46 115 Q51 72 78 61 Q128 43 178 61 Q205 72 210 115 '
                     'L207 136 Q128 155 49 136Z', '#555161', width=4.5)
        + path('M164 57 Q185 81 186 137 L207 136 210 115 Q205 72 178 61Z', '#413c4e', 'none', 0)
        + path('M128 51 Q135 86 128 127', 'none', '#767083', 2.5)
        + path('M46 115 Q128 134 210 115 L207 137 Q128 157 49 137Z', '#4b465a', width=4)
        + path('M49 123 Q128 143 207 123 M50 131 Q128 151 206 131', 'none', '#777181', 2))

    add('Crown', path('M48 121 39 62 70 80 87 42 107 77 128 30 149 77 '
                     'L169 42 186 80 217 62 208 121 Q128 144 48 121Z', '#edb147', width=4.5)
        + path('M207 69 198 117 Q128 138 49 111 L48 121 Q128 144 208 121 L217 62Z', '#c88333', 'none', 0)
        + path('M48 111 Q128 133 208 111 L207 127 Q128 149 49 127Z', '#f4bf55', width=3.5)
        + path('M54 121 Q128 141 202 121', 'none', '#ffe496', 2.5)
        + ellipse(128, 99, 9, 13, '#da402c', '#b46f30', 3)
        + ellipse(125, 95, 3, 5, '#ff8a4a')
        + ''.join(ellipse(x, y, 2.8, 3.5, '#344faf') for x, y in [(65, 99), (96, 107), (160, 107), (191, 99)]))

    add('Spartan Helmet', path('M108 84 Q101 53 103 29 Q114 10 133 10 '
                              'Q153 10 163 31 Q165 54 148 84Z', '#eb332c', width=4.5)
        + path('M134 12 138 80 148 84 Q165 54 163 31 Q153 10 134 12Z', '#b71928', 'none', 0)
        + path('M112 28 119 72 M128 21 131 70 M145 23 143 71 M157 34 150 64', width=2.5), 'back')
    add('Spartan Helmet', path('M44 140 Q40 99 66 77 Q94 56 128 59 Q162 56 190 77 '
                              'Q216 99 212 140 L200 162 204 185 218 208 198 217 '
                              'L183 200 189 169 182 143 145 148 142 172 128 181 '
                              'L114 172 111 148 74 143 67 169 73 200 58 217 '
                              'L38 208 52 185 56 162Z', '#dba650', width=4.5)
        + path('M194 85 Q215 113 207 139 L195 162 200 187 212 206 200 211 '
               'L189 199 195 169 187 141 Q203 119 194 85Z', '#ad7838', 'none', 0)
        + path('M50 135 Q48 102 71 82 Q96 64 119 67 M44 205 56 209 66 198 '
               'M205 149 199 165 204 185 M120 153 119 169 128 173', 'none', '#f6d38b', 3)
        + path('M62 125 Q128 147 194 125', 'none', '#ad7838', 3)
        + path('M111 60 117 96 128 104 139 96 145 60', '#d7282f', width=4))

    add('Clown Nose', ellipse(128, 179, 17, 16, '#ed262c', INK, 4)
        + path('M133 168 Q147 177 138 188 Q130 195 118 187 Q138 189 133 168Z', '#c01428', 'none', 0)
        + ellipse(122, 173, 5, 3, '#fff1dc', rotate=-28))
    add('Red Headband', band_tail('#ed3937'), 'back')
    add('Red Headband', band('#ed3937', '#bd282e'))

    mask = ('M47 174 Q45 139 65 118 Q87 97 128 102 Q169 97 191 118 '
            'Q211 139 209 174 Q213 207 192 222 Q170 237 128 237 '
            'Q86 237 64 222 Q43 207 47 174Z '
            'M68 170 C68 138 116 138 116 170 C116 202 68 202 68 170Z '
            'M140 170 C140 138 188 138 188 170 C188 202 140 202 140 170Z')
    art = f'<defs><clipPath id="mask"><path d="{mask}" clip-rule="evenodd"/></clipPath></defs>'
    art += f'<path d="{mask}" fill="#625e70" fill-rule="evenodd" stroke="{INK}" stroke-width="4.5"/>'
    art += '<g clip-path="url(#mask)">'
    for x in range(50, 217, 13):
        bend = (x - 128) * .12
        art += path(f'M{x} 95 Q{x+bend:.1f} 166 {x} 241', 'none', '#383441', 2)
    art += path('M54 209 Q128 248 202 209', 'none', '#44404d', 4) + '</g>'
    art += ellipse(128, 180, 4, 2.5, '#2b2831')
    add('Robber', art)

    add('NEET', path('M43 123 Q45 76 71 58 Q128 33 185 58 Q211 76 213 123 '
                    'Q128 147 43 133Z', '#eeeadd', width=4.5)
        + path('M43 123 Q45 76 71 58 L83 125 47 134Z', '#d0cbd1', 'none', 0)
        + path('M185 58 Q211 76 213 123 L177 131 Q178 84 185 58Z', '#d4d0d5', 'none', 0)
        + path('M71 60 Q77 90 83 122 M185 60 Q179 90 177 122', 'none', '#8b8693', 2.5)
        + path('M49 128 Q85 111 132 112 Q183 110 215 130 L219 137 '
               'Q176 131 139 141 Q83 149 42 137Z', '#2a339b', width=4.5)
        + path('M56 133 Q91 119 134 120 Q180 116 210 132', 'none', '#535ed3', 2.5))
    add('NEET', '<text x="128" y="103" text-anchor="middle" font-family="DejaVu Serif" '
        'font-weight="bold" font-size="36" letter-spacing="-1" fill="#faf8e9" '
        'stroke="#303894" stroke-width="2.3" paint-order="stroke">NEET</text>', 'decal')

    add('Silver Thorn', thorns('#a9aaa6', '#e0dfd4'))
    add('Gold Thorn', thorns('#e9a337', '#ffe187'))
    add('3rd Eye', path('M111 140 Q117 126 128 126 Q139 126 145 140 Q128 150 111 140Z',
                       '#faf8e4', '#a97775', 3))
    add('Purple Horn', ram_horns('#7c72d2', '#5955ab'))
    add('Red Horn', ram_horns('#b87275', '#935058'))

    seal = '<defs><clipPath id="seal">' + ellipse(128, 100, 24, 25, '#fff') + '</clipPath></defs>'
    seal += '<g transform="rotate(-18 128 100)">'
    seal += ellipse(128, 100, 24, 25, 'none', '#ffcd34', 5)
    seal += '<g clip-path="url(#seal)">' + path(
        'M117 70 V130 M128 70 V130 M139 70 V130 M99 89 H157 M99 100 H157 M99 111 H157',
        'none', '#ffcd34', 4) + '</g>'
    for angle in range(0, 360, 90):
        seal += f'<g transform="rotate({angle} 128 100)">' + path(
            'M128 73 V63 M122 60 Q120 65 128 65 Q136 65 134 60', 'none', '#ffcd34', 4) + '</g>'
    for angle in range(45, 360, 90):
        seal += f'<g transform="rotate({angle} 128 100)">' + path('M122 77 128 68 134 77Z', '#ffcd34', 'none', 0) + '</g>'
    seal += '</g>'
    add('Holy Seal', seal, 'decal')
    add('Holy Seal', ellipse(128, 100, 24, 25, 'none', '#e9a525', 6))

    add('Head Wrap', path('M44 127 Q44 85 76 75 Q128 60 180 75 Q212 85 212 127 '
                         'L209 144 Q169 133 128 137 Q87 133 47 144Z', '#edece9', width=4.5)
        + path('M45 120 Q91 105 151 76 Q181 72 201 93 Q127 108 63 139 L47 144Z', '#faf9ee', width=4)
        + path('M57 91 Q74 74 91 75 Q152 101 211 124 L209 144 '
               'Q180 147 137 121Z', '#f6f5f0', width=4)
        + path('M59 94 Q108 117 137 121 Q180 147 209 144 L211 132 '
               'Q179 134 145 113Z', '#c6c7de', 'none', 0)
        + path('M54 113 Q80 108 103 98 M123 86 151 83 M161 124 202 137', 'none', '#9396b1', 2.5))

    add('Void Horn', cone_horns('#af7ae9', '#8253c8', '#67459f'))
    add('Demon Horn', cone_horns('#ef9568', '#da6a49', '#b85239'))
    add('devil horn', cone_horns('#d84b48', '#b7323b', '#792b3b'))

    wreath = path('M43 143 Q70 117 115 105 M213 143 Q186 117 141 105', 'none', INK, 6)
    wreath += path('M43 143 Q70 117 115 105 M213 143 Q186 117 141 105', 'none', '#bbb19b', 3)
    leaves = ''
    for x, y, angle, scale in [(51, 134, -25, 1), (71, 120, 0, 1), (94, 110, 26, 1),
                               (58, 128, 111, .88), (79, 116, 108, .88)]:
        leaf = path('M0 0 Q-14 -14 0 -33 Q15 -16 0 0Z', '#c9bfa4', width=3)
        leaf += path('M0 -3 0 -27 M0 -12 5 -18 M0 -19 -5 -24', 'none', '#7e766c', 1.8)
        leaves += f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})">{leaf}</g>'
    wreath += leaves + f'<g transform="translate(256 0) scale(-1 1)">{leaves}</g>'
    add('Silver wreath', wreath)

    add('Taped Banana', '<g transform="translate(-24 24)">' + path('M136 83 Q129 104 137 119 Q142 130 158 133 L167 128 '
                            'Q145 117 141 94 L140 81Z', '#f5ce39', width=3)
        + path('M140 94 Q138 116 160 129', 'none', '#d99a32', 2)
        + path('M136 84 135 78 139 76 141 82', '#96713f', width=2)
        + path('M124 121 126 117 122 114 170 88 173 91 177 90 180 101 '
               '175 102 176 106 132 135 128 130 125 132Z', '#aaa7a5', width=2.5)
        + path('M132 128 174 102', 'none', '#cecbc2', 2) + '</g>')

    add('Blue Laser', path('M115 142 Q114 126 128 126 Q142 126 141 142Z', '#fff8e5', '#509b9e', 3)
        + path('M125 135 232 23 247 48 131 141Z', '#44d5e7', '#2eadae', 3)
        + path('M127 135 237 29 241 40 130 138Z', '#effffc', 'none', 0)
        + path('M132 138 244 49', 'none', '#9ff8ff', 2))

    add('Diamond', '<g transform="translate(-26 15)">' + path('M140 107 153 102 165 110 171 127 160 138 146 134 136 119Z',
                       '#82d6ed', '#344c68', 3)
        + path('M143 111 152 108 161 113 165 125 158 132 149 129 142 118Z', '#b9f1fb', '#5085a3', 1.8)
        + path('M140 107 143 111 M153 102 152 108 M165 110 161 113 M171 127 165 125 '
               'M160 138 158 132 M146 134 149 129 M136 119 142 118', 'none', '#5085a3', 1.8)
        + path('M145 113 149 122', 'none', '#fffdf2', 2.5) + '</g>')

    add('Red Bandana', path('M45 121 Q128 102 211 121 L207 147 Q128 128 49 147Z',
                           '#bb5e47', width=4.5)
        + path('M48 138 Q128 121 208 138 L207 147 Q128 128 49 147Z', '#95453e', 'none', 0)
        + path('M118 122 Q94 111 79 82 Q112 80 129 113 Q137 80 156 69 '
               'Q171 95 140 122Z', '#bf6852', width=4)
        + path('M116 115 Q134 104 143 120 Q137 136 121 137 L114 129Z', '#ca7960', width=3)
        + path('M91 90 117 113 M153 81 134 112 M120 130 134 118', 'none', '#84423a', 2.5))

    add('Poison Shroom', mushroom(75, 84, .88, -15) + mushroom(181, 84, .88, 15)
        + mushroom(39, 157, .50, -51) + mushroom(217, 157, .50, 51)
        + path('M58 139 Q66 133 60 123 M198 139 Q190 133 196 123 '
               'M34 190 Q24 198 16 188 L14 181 M222 190 Q232 198 240 188 L242 181',
               'none', '#35362c', 5)
        + path('M58 139 Q66 133 60 123 M198 139 Q190 133 196 123 '
               'M34 190 Q24 198 16 188 L14 181 M222 190 Q232 198 240 188 L242 181',
               'none', '#d0b473', 2.5)
        + ellipse(54, 146, 2.5, 3, '#d0b473', INK, 1.5)
        + ellipse(202, 146, 2.5, 3, '#d0b473', INK, 1.5))

    return layers


def pack(images):
    atlas = Image.new('RGBA', (1024, 2048))
    frames, x, y, row = {}, 2, 2, 0
    for name, image in sorted(images.items(), key=lambda item: -(item[1].getbbox()[3] - item[1].getbbox()[1])):
        box = image.getbbox()
        assert box and min(box[:2]) >= 2 and box[2] <= 254 and box[3] <= 318, name
        tile = image.crop(box)
        w, h = tile.size
        if x + w + 2 > atlas.width:
            x, y, row = 2, y + row + 4, 0
        assert y + h + 2 <= atlas.height, 'atlas overflow'
        atlas.alpha_composite(tile, (x, y))
        frame = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                 'spriteSourceSize': {'x': box[0], 'y': box[1], 'w': w, 'h': h},
                 'sourceSize': {'w': 256, 'h': 320}}
        if name.split('/')[1] in HIDES_SPIKES:
            frame['meta'] = {'hidesSpikes': True}
        if name.endswith('/decal'):
            frame['decal'] = {'anchor': {'x': (box[0] + box[2]) / 2, 'y': (box[1] + box[3]) / 2},
                              'size': {'w': w, 'h': h}}
        frames[name] = frame
        x, row = x + w + 4, max(row, h)
    height = 2 ** math.ceil(math.log2(y + row + 2))
    atlas = atlas.crop((0, 0, 1024, height))
    assert max(atlas.size) <= 2048
    save_png(ATLAS / 'chog-head-b.png', atlas)
    save_json(ATLAS / 'chog-head-b.json', {'frames': frames, 'meta': {
        'app': 'Candy Siege Chog drawing masters', 'version': '1', 'image': 'chog-head-b.png',
        'format': 'RGBA8888', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1', 'padding': 2,
        'traits': {f'head/{slug(value)}': {'references': ids,
                   **({'hidesSpikes': True} if slug(value) in HIDES_SPIKES else {})}
                   for value, ids in REFERENCES.items()},
    }})
    return atlas.size


def preview(compositor):
    # Real-ID images come from the unchanged compose.py CLI, including left-facing decals.
    sheet = Image.new('RGBA', (1760, 120 + 9 * 345), '#f3eee3')
    d = ImageDraw.Draw(sheet)
    d.text((24, 17), 'CHOG / HEAD B / FRONT-FACING REFIT / 27 TRAITS', font=font(27), fill=INK)
    d.text((24, 55), 'Each card: standalone layers | real ID right | real ID left | 64px canvas checks', font=font(17), fill=INK)
    d.text((24, 83), 'Single-ID traits use both facings of that ID. Real compositions use the current shared eyes, mouth and form atlases.',
           font=font(14), fill='#766676')
    for index, (value, ids) in enumerate(REFERENCES.items()):
        x0, y0 = 16 + index % 3 * 584, 120 + index // 3 * 345
        d.rounded_rectangle((x0, y0, x0 + 568, y0 + 333), radius=10, fill='#fffcf3', outline='#d4ccbc')
        d.text((x0 + 12, y0 + 10), value, font=font(19), fill=INK)
        first, second = ids[0], ids[1] if len(ids) > 1 else ids[0]
        d.text((x0 + 12, y0 + 36), 'alone', font=font(12), fill='#766676')
        d.text((x0 + 190, y0 + 36), f'#{first} right', font=font(12), fill='#766676')
        d.text((x0 + 372, y0 + 36), f'#{second} left' + (' / sole ID' if len(ids) == 1 else ''),
               font=font(12), fill='#766676')
        alone = Image.new('RGBA', SIZE)
        for part in ('back', 'front', 'decal'):
            name = f'head/{slug(value)}/{part}'
            if name in compositor.frames:
                alone.alpha_composite(compositor.layer(name, '#ffffff'))
        comps = [alone]
        with tempfile.TemporaryDirectory(prefix='chog-head-b-') as directory:
            for left, cid in [(False, first), (True, second)]:
                output = Path(directory) / f'{cid}-{left}.png'
                temporary = output.with_suffix('.png.tmp')
                command = [sys.executable, str(HERE / 'compose.py'), str(cid), '-o', str(temporary)]
                if left:
                    command.append('--left')
                result = subprocess.run(command, check=True, capture_output=True, text=True)
                if result.stderr.strip():
                    print(f'#{cid}: {result.stderr.strip()}', file=sys.stderr)
                temporary.replace(output)
                with Image.open(output) as image:
                    comps.append(image.convert('RGBA'))
        for column, img in enumerate(comps):
            crop = img.crop((0, 0, 256, 256)).resize((180, 180), Image.Resampling.LANCZOS)
            sheet.alpha_composite(crop, (x0 + 4 + column * 185, y0 + 56))
        for column, img in enumerate(comps[1:]):
            sheet.alpha_composite(img.resize((64, 80), Image.Resampling.LANCZOS),
                                  (x0 + 190 + column * 183, y0 + 244))
        d.text((x0 + 12, y0 + 247), '64px checks', font=font(12), fill='#766676')
        d.text((x0 + 12, y0 + 270), 'Refs: ' + ', '.join(f'#{i}' for i in ids), font=font(11), fill='#766676')
        if slug(value) in HIDES_SPIKES:
            d.text((x0 + 12, y0 + 289), 'hidesSpikes: true', font=font(11), fill='#766676')
    save_png(HERE / 'preview-head-b.png', sheet)


def self_check(compositor, images):
    assert len(REFERENCES) == 27
    for value, ids in REFERENCES.items():
        assert f'head/{slug(value)}/front' in images
        for cid in ids:
            assert compositor.values(cid)['Head'] == value, (cid, value)
        for left, cid in [(False, ids[0]), (True, ids[-1])]:
            assert compositor.compose(cid, left=left).getbbox()
            assert not any(p.startswith(f'Head: {value}') for p in compositor.missing)
    for name, image in images.items():
        restored = compositor.layer(name, '#ffffff')
        assert ImageChops.difference(restored, image).getbbox(alpha_only=False) is None, name
        if not name.endswith('/decal'):
            assert compositor.layer(name, '#ffffff', left=True).tobytes() == ImageOps.mirror(image).tobytes(), name
        else:
            frame = compositor.frames[name][2]
            shifted = Image.new('RGBA', SIZE)
            shifted.alpha_composite(image, (round(256 - 2 * frame['decal']['anchor']['x']), 0))
            assert compositor.layer(name, '#ffffff', left=True).tobytes() == shifted.tobytes(), name


def main():
    images = {}
    for name, art in drawings().items():
        master = HERE / 'svg' / BATCH / (name.removeprefix('head/') + '.svg')
        write(master, svg(name, art))
        rendered = subprocess.run(['rsvg-convert', str(master)], check=True, capture_output=True).stdout
        images[name] = Image.open(io.BytesIO(rendered)).convert('RGBA')
    size = pack(images)
    compositor = Compositor()
    self_check(compositor, images)
    preview(compositor)
    print(f'Built {len(images)} frames / {len(REFERENCES)} traits; {size[0]}x{size[1]}.')
    print('Passed: trait IDs, trim round trips, 54 CLI compositions and unmirrored decals.')
    print(HERE / 'preview-head-b.png')


if __name__ == '__main__':
    main()
