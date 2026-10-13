#!/usr/bin/env python3
"""Drawing masters; the default build generates additive batch 3E art.

Run: python art/siege/build.py
Requires Pillow and rsvg-convert. No network or game server.
Batch 3E reads existing SVG masters and writes only @2x heroes, cards2 and previews.
Light comes from upper left. Coordinates and portrait holes stay in frame pixels.
"""
import sys
sys.dont_write_bytecode = True

from pathlib import Path
import hashlib
import html
import io
import json
import math
import random
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / 'knock/app/public/siege'
INK = '#181323'
PURPLE = '#32204e'
DARK = '#211332'
VIOLET = '#836ef9'
LILAC = '#b1a0da'
CREAM = '#f4eedd'
PAPER = '#d4cbd3'
ORANGE = '#ff7a1a'
RUST = '#b94736'
GOLD = '#ffbe58'
PINK = '#e66d9f'
MINT = '#a6ddbb'
GREEN = '#527e73'
FRAMES = {k: {} for k in ('units', 'fx', 'ui')}
FACES = {}


def path(d, fill=CREAM, stroke=INK, sw=3, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'


def ellipse(x, y, rx, ry, fill, stroke=INK, sw=3, extra=''):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'


def circle(x, y, r, fill, stroke=INK, sw=3, extra=''):
    return ellipse(x, y, r, r, fill, stroke, sw, extra)


def group(body, transform='', extra=''):
    return f'<g transform="{transform}" {extra}>{body}</g>'


def line(d, color=INK, sw=2, extra=''):
    return path(d, 'none', color, sw, extra)


def front_leg(color, highlight, back, detail='', ink=INK, shade=DARK):
    """Rounded front toe, splayed about the unchanged (11.4, 5.76) hip."""
    art = path('M5.4 2Q11.4 1 17.4 2L17.4 15C21 18 21 24 18 26Q11.4 28 4.8 26C1.8 24 1.8 18 5.4 15Z',color,ink,2.1)
    art += path('M3.5 22Q11.4 26 19.3 22L18 26Q11.4 28 4.8 26Z',shade,'none',0,'opacity=".25"')
    art += line('M6 20Q10 17.5 14 19',highlight,1.5)
    return group(art+detail,f'rotate({4 if back else -4} 11.4 5.76)')


def text(x, y, value, size=20, fill=CREAM, stroke=INK, sw=2):
    return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="DejaVu Sans" font-weight="900" font-size="{size}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" paint-order="stroke">{html.escape(value)}</text>'


def star(x, y, r, fill=GOLD, points=5, sw=2):
    pts = []
    for i in range(points * 2):
        a = i * math.pi / points - math.pi / 2
        radius = r if i % 2 == 0 else r * .46
        pts.append(f'{x + math.cos(a) * radius:.2f},{y + math.sin(a) * radius:.2f}')
    return path('M' + ' '.join(pts) + 'Z', fill, INK, sw)


def candy(x, y, s=1, rotation=0, color=ORANGE):
    b = path('M-10-5-21-11-18 0-22 9-10 5M10-5 21-11 18 0 22 9 10 5', PINK, INK, 2.4)
    b += path('M-11-7Q0-11 11-7L12 7Q0 11-12 7Z', color, INK, 2.4)
    b += line('M-4-8 2 8M3-8 9 7', CREAM, 3)
    b += line('M-8-5-3-6', CREAM, 1.5)
    return group(b, f'translate({x} {y}) rotate({rotation}) scale({s})')


def pumpkin(x, y, s=1, face=True):
    b = path('M-4-21Q-9-32 1-36L6-31 3-21', GREEN, INK, 2.5)
    b += path('M2-25Q11-39 22-29 14-20 2-25', MINT, INK, 2)
    b += path('M-25-10Q-29-27-9-25 0-31 11-25 30-28 28-7 33 11 19 22 2 31-18 21-32 14-25-10Z', ORANGE, INK, 3)
    b += path('M-24 8Q-11 26 10 21 25 15 29 4L26 17 13 25-13 25Z', RUST, 'none', 0)
    b += line('M-9-23Q-18-5-10 19M10-23Q19-5 11 20', RUST, 2.4)
    b += line('M-21-12Q-21-19-16-20', GOLD, 3)
    if face:
        b += path('M-18-3-8-12-5 1ZM6 1 10-12 20-3Z', DARK, INK, 1.5)
        b += path('M-14 9Q0 19 17 7L12 18Q-2 23-11 16Z', DARK, INK, 1.5)
        b += path('M-6 13-3 19 2 15 7 19 10 12', GOLD, 'none', 0)
    return group(b, f'translate({x} {y}) scale({s})')


def egg(x, y, s=1, rotation=0):
    b = path('M0-18C-8-19-18-1-15 9-12 21 11 22 16 9 20-1 7-18 0-18Z', CREAM, INK, 2.7)
    b += path('M11-10Q19 8 8 14L-7 16Q9 22 15 11 21 0 11-10Z', PAPER, 'none', 0)
    b += line('M-9-4Q-7-10-3-11', '#fff9e9', 3)
    return group(b, f'translate({x} {y}) rotate({rotation}) scale({s})')


def paper_roll(x, y, s=1, rotation=0):
    b = path('M-10-16 9-16Q26-10 19 5L16 24 7 21 0 26-8 22-5 3Z', CREAM, INK, 2.8)
    b += ellipse(-8, -3, 14, 16, CREAM, INK, 2.8)
    b += ellipse(-8, -3, 5, 7, '#b59083', INK, 2)
    b += line('M-3 14 17 16', '#a89aaa', 1.5, 'stroke-dasharray="3 3"')
    b += line('M14-10 16-3', '#fff9ef', 3)
    return group(b, f'translate({x} {y}) rotate({rotation}) scale({s})')


def lantern(x, y, s=1, magic=False):
    glow, flame = (MINT, CREAM) if magic else (GOLD, ORANGE)
    b = line('M-8-24Q-11-39 0-38 13-38 9-24', INK, 4)
    b += path('M-13-25 12-26 19-15 16 19-16 19-20-15Z', PURPLE, INK, 3)
    b += path('M-13-13 12-14 10 12-12 13Z', glow, INK, 2)
    b += path('M0 11Q-12 4-2-8L2-17Q1-6 8-4 11 5 0 11Z', flame, 'none', 0)
    b += path('M-21-17-12-27 13-28 22-17ZM-18 16 18 16 22 24-20 24Z', VIOLET, INK, 3)
    b += line('M-14-21 10-23', LILAC, 2)
    return group(b, f'translate({x} {y}) scale({s})')


def svg(w, h, body, name, holes=(), grain=True):
    defs = '<defs><filter id="paper" x="-3%" y="-3%" width="106%" height="106%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="3" seed="12" result="noise"/><feColorMatrix in="noise" type="saturate" values="0" result="grey"/><feComposite in="grey" in2="SourceGraphic" operator="arithmetic" k1="0" k2=".18" k3="1" k4="-.09" result="grain"/><feComposite in="grain" in2="SourceAlpha" operator="in"/></filter>'
    if holes:
        defs += f'<mask id="face"><rect width="{w}" height="{h}" fill="white"/>'
        defs += ''.join(circle(x, y, r, 'black', 'none', 0) for x, y, r in holes)
        defs += '</mask>'
    defs += '</defs>'
    attrs = ('filter="url(#paper)" ' if grain else '') + ('mask="url(#face)"' if holes else '')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><title>{html.escape(name)}</title>{defs}<g stroke-linecap="round" stroke-linejoin="round" {attrs}>{body}</g></svg>\n'


def add(atlas, name, w, h, body, holes=(), grain=True):
    assert name not in FRAMES[atlas], name
    target = ROOT / 'svg' / (name + '.svg')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(svg(w, h, body, name, holes, grain))
    FRAMES[atlas][name] = (w, h, target, holes)


def ground(w=160, y=182):
    return ellipse(w/2, y, w*.43, 13, '#120d23', 'none', 0, 'opacity=".27"')


def tower_base(level):
    b = ground()
    b += path('M22 172 79 157 140 172 136 189 79 198 24 187Z', PURPLE)
    b += path('M22 171 78 157 140 171 80 186Z', '#756480')
    b += line('M32 171 78 162 128 172', LILAC, 2)
    b += line('M48 178 49 190M107 180 108 191', DARK, 2)
    if level > 1:
        b += path('M32 157 78 146 130 158 127 174 79 183 33 172Z', '#94839b')
        b += path('M31 156 78 144 131 157 79 170Z', PAPER)
        b += line('M43 157 76 149', CREAM, 2)
    return b


def towers():
    for family in ('egg', 'tp', 'lantern', 'patch'):
        for level in range(1, 4):
            b = tower_base(level)
            if family == 'egg':
                top = [0, 97, 71, 49][level]
                b += path(f'M40 {top+14} 45 173 57 175 53 {top}ZM115 {top} 106 174 119 170 126 {top+7}Z', '#825455')
                b += path(f'M40 {top+14} 47 {top+11} 54 169 47 169Z', GOLD, 'none', 0)
                b += path('M35 125 124 119 125 166 80 177 37 165Z', '#aa694f')
                b += path('M35 125 80 115 126 123 81 137Z', GOLD)
                b += path('M36 127 81 138 80 173 37 164Z', '#d99963')
                b += line('M43 143 73 149M42 155 73 161M88 146 116 139M88 158 117 150', '#754747', 2)
                b += path('M45 141 63 140 63 162 44 163Z', CREAM, INK, 2)
                b += egg(54, 151, .33, -10)
                for x,y,r in [(57,115,-22),(80,113,8),(104,112,28)]:
                    b += egg(x,y,.58,r)
                b += path(f'M27 {top}Q66 {top-22} 129 {top-8}L139 {top+15}Q77 {top+2} 24 {top+23}Z', ORANGE)
                for x in (49,80,111):
                    b += path(f'M{x} {top-7} {x+11} {top-10} {x+15} {top+14} {x+2} {top+14}Z', CREAM, INK, 1.5)
                b += path(f'M25 {top+21}Q33 {top+29} 43 {top+19} 55 {top+27} 66 {top+14} 78 {top+21} 90 {top+11} 103 {top+19} 116 {top+11} 128 {top+23} 139 {top+15}', ORANGE, INK, 2.8)
                if level >= 2:
                    b += path('M57 107 75 88 119 94 110 108Z', VIOLET)
                    b += line('M83 105 87 84 117 64', '#8d5d56', 8)
                    b += path('M101 64Q115 74 131 62L125 52 106 52Z', GOLD)
                    b += egg(117, 51, .45, 26)
                if level == 3:
                    b += path('M45 37 58 7 82 26 105 8 117 32 83 43Z', GOLD)
                    b += egg(81,27,.53)
                    b += star(33,67,11,GOLD)
                    b += star(132,49,10,GOLD)
                    b += candy(91,150,.48,-12,PINK)
            elif family == 'tp':
                h = [0, 119, 95, 77][level]
                b += path(f'M42 {h+14} 82 {h} 121 {h+13} 122 158 80 174 39 157Z', '#756f96')
                b += path(f'M41 {h+14} 81 {h+25} 80 171 40 157Z', '#aaa1b7')
                b += line(f'M43 {h+34} 80 {h+44} 120 {h+29}M59 {h+19} 58 {h+37}M100 {h+18} 99 {h+38}', PURPLE, 2)
                b += path('M37 163 39 111 53 109 55 139 112 134 112 102 124 102 126 158Z', '#996654')
                b += line('M46 121 119 143M48 146 117 118', '#d9a26f', 7)
                b += circle(83,129,10,GOLD)
                b += line(f'M84 129 71 {h-9} 112 {h-30}', '#d9a26f', 13)
                b += line(f'M84 124 73 {h-9} 111 {h-27}', GOLD, 3)
                b += path(f'M92 {h-29}Q111 {h-16} 131 {h-29}L122 {h-43} 100 {h-42}Z', PURPLE)
                b += paper_roll(111,h-46,.77,20)
                b += path('M62 120Q45 100 28 112L28 147 17 164 35 170 43 155 42 124Q48 120 59 131Z', CREAM)
                b += line('M27 145 40 149', '#aaa1b7', 2,'stroke-dasharray="3 4"')
                if level >= 2:
                    b += paper_roll(117,145,.54,65)
                    b += path('M42 95 34 72 49 61 61 79Z', VIOLET)
                    b += path('M36 78 47 71 54 79 46 84Z', MINT, INK, 1.5)
                if level == 3:
                    b += path('M29 105 25 68 34 54 44 67 48 107ZM121 112 125 81 137 72 142 84 138 117Z', PURPLE)
                    b += star(35,75,8,GOLD)
                    b += paper_roll(57,53,.57,-33)
                    b += path('M32 50Q22 34 41 22L58 12 60 25 45 29Q33 33 43 45Z', CREAM)
            elif family == 'lantern':
                b += path('M61 163 67 104 59 91 78 80 99 91 91 104 98 164 80 173Z', '#746286')
                b += path('M63 163 70 105 77 103 76 169Z', LILAC, 'none', 0)
                b += path('M53 156 79 147 105 157 107 166 79 177 51 167Z', PURPLE)
                b += line('M74 123 87 121M72 138 90 137', PURPLE, 2)
                if level == 1:
                    b += lantern(80,77,1.22,True)
                    b += path('M64 115Q50 107 41 114 39 123 49 121', 'none', MINT, 3)
                else:
                    b += line('M81 121 82 43M82 68Q37 49 36 81M82 56Q120 35 127 69', PURPLE, 11)
                    b += line('M80 113 80 49M78 67Q39 52 38 75', LILAC, 3)
                    b += lantern(36,102,.73,True)
                    b += lantern(125,90,.69,True)
                    b += lantern(81,level == 2 and 48 or 42,1.05,True)
                    if level == 3:
                        b += path('M18 127Q3 80 28 45L39 36 35 48Q13 85 29 124ZM126 126Q147 97 139 63L142 50Q162 96 139 134Z', VIOLET)
                        b += star(22,42,11,MINT)
                        b += star(144,51,9,GOLD)
                        b += circle(80,131,13,DARK)
                        b += star(80,130,9,MINT)
            else:
                b += path('M30 144 82 126 132 144 130 167 80 185 30 165Z', '#755047')
                b += path('M30 142 80 125 132 142 80 163Z', '#514342')
                b += line('M29 144 79 163 130 145', '#b49064', 5)
                b += path('M47 169Q21 165 21 147 16 122 36 122 54 125 43 137 33 141 31 130', 'none', GREEN, 5)
                b += path('M92 161Q140 177 140 148 138 132 125 138 117 150 130 151', 'none', MINT, 4)
                b += pumpkin(79,133,.88,True)
                b += pumpkin(41,153,.45,False)
                if level >= 2:
                    b += path('M35 131 35 82 45 78 48 131M112 139 111 75 122 73 123 134', '#a2765c')
                    b += path('M28 86 124 62 131 77 32 100Z', '#d6a673')
                    b += line('M32 83 35 51 27 39', GREEN, 5)
                    b += pumpkin(35,45,.58)
                    b += pumpkin(111,131,.61)
                    b += path('M70 126 68 105 80 91 91 103 93 125Z', '#b0b4c2')
                    b += path('M73 115 89 115 86 130 76 130Z', PURPLE, INK, 2)
                if level == 3:
                    b += path('M38 79Q44 40 72 41 103 37 119 66L111 76Q83 47 51 81Z', GREEN)
                    b += path('M55 50Q37 14 24 25 26 53 55 50M97 46Q124 18 134 36 126 56 97 46', MINT)
                    b += path('M58 56 65 13 82 29 98 12 104 51 81 61Z', GOLD)
                    b += star(81,42,10,ORANGE)
                    b += path('M106 122 128 103 133 110 114 134', CREAM)
                    b += path('M53 143 38 129 28 143 36 161 51 159Z', VIOLET)
                    b += star(40,146,6,GOLD)
            add('units',f'tower/{family}/{level}',160,200,b)
    for glow in (False,True):
        b = ellipse(80,48,67,24,DARK,'none',0,'opacity=".3"')
        if glow:
            b += ellipse(80,41,75,32,MINT,'none',0,'opacity=".15"')
            b += ellipse(80,41,70,27,'none',GOLD,3,'stroke-dasharray="9 5"')
        b += path('M19 42 37 24 80 14 126 24 143 43 128 61 80 71 34 60Z', '#5d4c68')
        b += path('M20 39 38 22 80 13 124 23 142 40 125 55 80 65 34 54Z', '#ad91a3')
        b += line('M26 39 79 19 134 39M35 52 79 62 126 52', '#d8bac4',2)
        b += ellipse(80,40,38,14,'#67536c',INK,2)
        b += line('M80 30 80 49M65 40 95 40', GOLD if glow else '#b89fad', 5)
        add('units','pad/glow' if glow else 'pad/empty',160,80,b)


# Contact, recoil, passing; then the opposite foot leads. Knees and toes articulate.
LEGS = [
    ('M53 86 42 99 29 108 30 114 47 114 59 103 66 88', 'M71 86 79 98 96 104 98 113 85 113 67 102 61 90'),
    ('M54 89 47 98 51 108 44 114 60 114 63 103 65 91', 'M71 89 84 96 93 110 110 111 111 117 88 117 74 105 63 92'),
    ('M55 85 58 96 69 100 65 108 55 105 46 97 48 85', 'M72 85 73 100 71 112 84 112 87 118 62 118 61 98 62 85'),
    ('M54 84 66 96 84 106 99 108 99 114 78 114 59 105 46 87', 'M72 84 63 100 48 113 29 114 28 108 42 104 56 86'),
    ('M51 90 67 94 78 110 93 112 92 117 72 116 59 104 46 94', 'M73 90 60 99 59 109 66 115 49 116 47 105 54 92'),
    ('M51 84 55 100 54 112 68 113 70 118 45 118 44 97 44 84', 'M73 84 72 95 60 100 65 108 76 102 82 94 82 84'),
]
BOBS = [0, 3, -3, -1, 3, -4]
ARMS = [
    ('M46 63Q33 70 30 84L41 90 55 69Z','M84 62Q93 75 104 79L109 69 95 55Z'),
    ('M46 65Q30 67 25 76L34 88 55 75Z','M85 62Q91 82 102 88L112 78 97 60Z'),
    ('M46 62Q39 77 47 88L59 84 57 62Z','M85 59Q82 75 89 91L100 89 98 62Z'),
    ('M48 58Q43 77 55 91L65 81 60 58Z','M87 59Q102 61 113 70L108 84 89 78Z'),
    ('M48 66Q40 84 56 93L68 82 60 64Z','M86 63Q103 64 115 77L103 89 87 80Z'),
    ('M47 61Q35 67 39 83L52 88 59 65Z','M85 58Q92 68 96 86L106 84 101 63Z'),
]


def bucket(x, y, rotation=0):
    b = line('M-9-3Q-12-19 1-19 15-18 11-3', INK, 2.5)
    b += path('M-13-5 14-5 12 12Q0 19-11 11Z', ORANGE, INK, 2.6)
    b += line('M-8-2 8-2', GOLD, 2)
    b += path('M-7 2-2-1-1 4ZM3 4 4-1 9 2ZM-5 8 5 8 2 11Z', DARK, 'none', 0)
    return group(b, f'translate({x} {y}) rotate({rotation})')


WINGS = [
    ('M58 61Q39 26 9 15L14 50Q25 41 32 62 44 49 53 78Z', 'M82 59Q98 23 117 12L118 47Q105 38 102 61 92 49 86 76Z'),
    ('M58 61Q31 44 7 47L12 74Q25 60 35 81 44 63 57 80Z', 'M82 60Q105 38 123 41L118 70Q107 59 102 79 92 65 85 79Z'),
    ('M59 61Q31 58 13 80L28 99Q34 78 44 95 48 77 60 82Z', 'M83 60Q108 58 120 78L105 97Q103 80 93 94 91 76 81 82Z'),
    ('M58 57Q42 73 36 108L55 109Q50 95 64 100L69 77Z', 'M85 58Q100 76 103 107L86 108Q91 93 77 99L77 77Z'),
    ('M57 59Q36 52 16 68L24 90Q33 72 41 84 47 69 59 78Z', 'M83 57Q110 50 120 66L111 90Q102 71 95 85 91 69 82 77Z'),
    ('M58 58Q39 27 15 29L13 56Q28 43 36 65 47 52 57 78Z', 'M83 56Q103 23 122 26L119 55Q106 41 99 63 93 51 84 77Z'),
]


def costume(kind, i, hurt=False):
    bob = BOBS[i]
    hx, hy, radius = (71, 48+bob, 21)
    b = ellipse(64,117,36-(4 if i in (2,5) else 0),7,DARK,'none',0,'opacity=".24"')
    if kind in ('treater','pumpkin'):
        b += path(LEGS[i][0], PURPLE, INK, 3)
        b += line(['M32 110 43 110','M49 109 56 111','M56 101 63 104','M83 110 94 111','M77 112 88 114','M50 114 63 115'][i], LILAC,2)
        b += path(LEGS[i][1], VIOLET if kind == 'treater' else GREEN, INK,3)
    if kind == 'treater':
        b += group(path(ARMS[i][0],RUST),f'translate(0 {bob})')
        hem = [98,103,96,98,102,95][i]
        b += path(f'M48 {60+bob}Q33 71 {31+[0,-5,4,9,3,-3][i]} {hem}Q57 {hem+9} 91 {hem-4}L89 {59+bob}Z',ORANGE)
        b += path(f'M72 {65+bob} 83 {62+bob} 91 {hem-4} 76 {hem+1}Z',RUST,'none',0)
        b += line(f'M48 {70+bob} 41 {hem-5}M58 {78+bob} 56 {hem-1}',GOLD,2.5)
        b += path(f'M53 {65+bob} 69 {82+bob} 83 {63+bob}Z',PINK,INK,2)
        b += group(path(ARMS[i][1],ORANGE),f'translate(0 {bob})')
        bx,by,rot = [(106,87,-15),(111,95,-25),(102,95,0),(109,86,16),(109,91,21),(109,93,10)][i]
        b += bucket(bx,by+bob,.6*rot)
        b += path(f'M46 {54+bob}Q36 {24+bob} 61 {17+bob} 79 {9+bob} 96 {29+bob}L102 {55+bob} 91 {68+bob} 48 {69+bob}Z',ORANGE)
        b += path(f'M47 {33+bob} 38 {10+bob} 61 {19+bob}M81 {18+bob} 93 {7+bob} 96 {32+bob}',ORANGE)
        b += line(f'M46 {20+bob} 48 {29+bob}M89 {19+bob} 91 {27+bob}',GOLD,2)
        b += circle(hx,hy,24,DARK,INK,3)
        b += line(f'M52 {34+bob}Q62 {23+bob} 76 {25+bob}',GOLD,3)
        b += path(f'M41 {69+bob} 33 {79+bob} 46 {76+bob} 53 {81+bob} 54 {68+bob}',PINK,INK,2)
    elif kind == 'ghost':
        hx,hy,radius = 72,47+bob,22
        tails = [
            'Q97 115 83 99Q72 124 61 103Q40 115 32 96L19 103 29 75',
            'Q102 111 90 96Q79 116 69 103Q54 126 43 103L22 109 29 76',
            'Q98 101 87 97Q74 113 60 96Q45 106 31 94L15 92 31 73',
            'Q100 117 84 100Q71 111 59 102Q44 126 32 105L18 110 27 77',
            'Q102 115 90 100Q80 124 67 104Q55 115 42 104L23 109 26 76',
            'Q101 99 90 94Q78 109 68 96Q51 107 39 96L17 99 29 75',
        ][i]
        b += path(f'M37 {49+bob}Q31 {14+bob} 67 {13+bob} 100 {10+bob} 102 {45+bob}L113 {87+bob} 103 {101+bob}{tails}Z',CREAM)
        b += path(f'M87 {63+bob}Q94 86 100 102L91 98 83 106 74 101 80 86Z', '#a6bdc8','none',0)
        b += path(f'M34 {56+bob}Q{11+i*2} {59+bob} {13+i*3} {80+bob}L30 {79+bob} 43 {64+bob}',CREAM)
        b += path(f'M98 {57+bob}Q117 {59+bob} 119 {74+bob}L105 {81+bob} 94 {66+bob}',CREAM)
        b += circle(hx,hy,25,PAPER,INK,3)
        b += line(f'M47 {27+bob}Q54 {20+bob} 65 {20+bob}', '#ffffff', 3)
        b += line(f'M46 {70+bob}Q43 87 {38+i} 94M64 {76+bob} 60 {96+bob}', '#abb9cb',2.4)
        b += path(f'M40 {49+bob} 33 {44+bob} 35 {54+bob}',PINK,INK,1.5)
        b += path(f'M82 {14+bob}Q75 {4+bob} 63 {9+bob}L69 {18+bob}',CREAM,INK,2)
    elif kind == 'pumpkin':
        hx,hy,radius=71,49+bob,20
        b += group(path(ARMS[i][0],GREEN),f'translate(0 {bob})')
        b += path(f'M33 {53+bob}Q24 {36+bob} 43 {26+bob} 51 {12+bob} 70 {19+bob} 92 {11+bob} 102 {31+bob} 118 {37+bob} 109 {62+bob} 117 {89+bob} 99 {100+bob} 82 {111+bob} 59 {101+bob} 30 {104+bob} 31 {78+bob}Z',ORANGE,INK,3.5)
        b += path(f'M36 {84+bob}Q69 {102+bob} 108 {80+bob}L103 {98+bob} 81 {106+bob} 56 {102+bob} 37 {95+bob}Z',RUST,'none',0)
        b += line(f'M46 {30+bob}Q26 {61+bob} 46 {91+bob}M96 {29+bob}Q115 {61+bob} 96 {93+bob}M63 {77+bob} 60 {96+bob}M84 {77+bob} 88 {98+bob}',RUST,3)
        b += path(f'M66 {19+bob}Q61 {9+bob} 70 {5+bob}L78 {9+bob} 75 {20+bob}',GREEN,INK,2.5)
        b += path(f'M78 {19+bob}Q91 {4+bob} 102 {13+bob} 95 {24+bob} 78 {19+bob}',MINT,INK,2)
        b += circle(hx,hy,24,DARK,INK,3)
        b += path(f'M54 {78+bob} 68 {84+bob} 83 {77+bob} 78 {92+bob} 66 {88+bob} 58 {93+bob}Z',DARK,INK,2)
        b += path(f'M62 {83+bob} 67 {90+bob} 72 {83+bob}',GOLD,'none',0)
        b += group(path(ARMS[i][1],GREEN),f'translate(0 {bob})')
        b += ellipse(105,82+bob,10,8,MINT,INK,2)
        b += line(f'M37 {44+bob}Q36 {34+bob} 43 {31+bob}',GOLD,3)
    else:
        hx,hy,radius=72,49+bob,19
        for wing in WINGS[i]:
            b += group(path(wing,PURPLE,INK,3),f'translate(0 {bob})')
        # Membranes flex with the changing shoulder-to-tip arcs.
        tips=[(16,27,114,25),(12,54,116,51),(22,83,110,83),(43,99,96,98),(25,72,113,72),(20,38,116,36)][i]
        b += line(f'M56 {65+bob}Q34 {48+bob} {tips[0]} {tips[1]+bob}M85 {64+bob}Q102 {46+bob} {tips[2]} {tips[3]+bob}',PINK,2)
        b += path(f'M54 {70+bob}Q42 {100+bob} 60 {101+bob}L68 {93+bob} 74 {104+bob} 89 {98+bob} 89 {67+bob}Z',VIOLET)
        b += path(f'M56 {88+bob} 53 {102+bob} 64 {109+bob} 68 {105+bob} 64 {94+bob}M76 {93+bob} 78 {108+bob} 90 {109+bob} 92 {104+bob} 85 {97+bob}',PURPLE,INK,2.5)
        b += path(f'M46 {46+bob} 43 {11+bob} 62 {24+bob}Q72 {18+bob} 80 {24+bob}L100 {9+bob} 98 {48+bob} 93 {71+bob} 52 {73+bob}Z',VIOLET)
        b += path(f'M49 {20+bob} 51 {39+bob} 59 {27+bob}M92 {19+bob} 85 {29+bob} 93 {39+bob}',PINK,INK,1.5)
        b += circle(hx,hy,22,DARK,INK,3)
        b += path(f'M57 {74+bob} 67 {78+bob} 63 {87+bob}ZM76 {78+bob} 86 {74+bob} 80 {87+bob}Z',CREAM,INK,1.5)
        b += line(f'M58 {29+bob} 63 {27+bob}',LILAC,3)
    if hurt:
        b += star(23,23,13,GOLD,4)
        b += line('M14 53 6 49M105 18 113 9',CREAM,3)
    return b, (hx,hy,radius)


def enemies():
    for kind in ('treater','ghost','pumpkin','bat'):
        anchors=[]
        for i in range(6):
            b,hole=costume(kind,i)
            add('units',f'enemy/{kind}/walk/{i}',128,128,b,[hole])
            anchors.append(dict(zip(('x','y','r'),hole)))
        b,hole=costume(kind,1,True)
        # Recoil changes posture, not just frame position.
        b=group(b,'translate(6 8) rotate(-12 64 68) scale(.94 .94)')
        x,y,r=hole
        a=-12*math.pi/180
        x,y=x*.94,y*.94
        hx=6+64+math.cos(a)*(x-64)-math.sin(a)*(y-68)
        hy=8+68+math.sin(a)*(x-64)+math.cos(a)*(y-68)
        hurt=(hx,hy,r*.94)
        add('units',f'enemy/{kind}/hurt',128,128,b,[hurt])
        death=[]
        for i in range(3):
            if i==0:
                b,hole=costume(kind,1)
                b=group(b,'translate(-5 41) scale(1.08 .65)')
                h=(hole[0]*1.08-5,hole[1]*.65+41,hole[2]*.65)
                b+=star(22,68,10,GOLD,4)+candy(105,42,.5,-30)
                holes=[h]
            else:
                b=''
                colors={'treater':ORANGE,'ghost':CREAM,'pumpkin':ORANGE,'bat':VIOLET}
                if i==1:
                    b+=path('M63 24 72 46 99 34 92 59 114 73 87 82 95 104 69 92 51 116 44 89 17 88 32 67 18 45 47 47Z',GOLD,INK,2)
                    b+=path('M27 31 44 22 43 42ZM91 19 104 39 90 46ZM23 94 39 104 23 110',colors[kind],INK,2)
                else:
                    b+=ellipse(64,113,26,5,DARK,'none',0,'opacity=".18"')
                    b+=star(62,67,9,GOLD,4)+star(101,41,5,MINT,4)
                for j,(x,y) in enumerate([(33,39),(92,31),(34,87),(96,90),(66,60)]):
                    xx=64+(x-64)*(1.36 if i==2 else .95)
                    yy=y+(13 if i==2 else 0)
                    b+=candy(xx,yy,.35 if i==2 else .53,j*61+i*25,[PINK,MINT,ORANGE,VIOLET,GOLD][j])
                h=(64,64,0)
                holes=[]
            add('units',f'enemy/{kind}/die/{i}',128,128,b,holes)
            death.append(dict(zip(('x','y','r'),h)))
        FACES[kind]={**anchors[0],'frames':anchors,'hurt':dict(zip(('x','y','r'),hurt)),'die':death}


def knight_body(i, attack=False):
    b=ellipse(48,89,29,5,DARK,'none',0,'opacity=".26"')
    idx=[2,0,3][i] if attack else i
    bob=[2,-3,1][i] if attack else BOBS[i]*.6
    b+=group(path(LEGS[idx][0],PURPLE)+path(LEGS[idx][1],LILAC),'translate(-2 5) scale(.72)')
    b+=path(f'M32 {44+bob} 24 76 54 83 64 {48+bob}Z',PURPLE)
    b+=path(f'M36 {44+bob} 58 {43+bob} 62 72 48 79 30 70Z','#a5aab8')
    b+=line(f'M38 {48+bob} 34 62 45 67',CREAM,2)
    b+=pumpkin(48,31+bob,.61,True)
    b+=path(f'M31 {30+bob}Q28 {10+bob} 47 {9+bob} 65 {8+bob} 67 {31+bob}L60 {35+bob} 60 {22+bob} 35 {23+bob} 36 {34+bob}Z','#a5aab8')
    b+=path(f'M46 {11+bob}Q36 {-1+bob} 26 {6+bob}L19 {17+bob} 33 {14+bob} 45 {19+bob}',PINK,INK,2)
    b+=line(f'M35 {17+bob} 46 {13+bob} 57 {16+bob}',CREAM,2)
    shield=path('M20 45 36 49 36 64Q31 77 23 81 13 74 11 60L12 48Z',VIOLET,INK,3)+star(24,59,8,GOLD)
    b+=group(shield,f'rotate({[-12,-5,3,10,4,-5][idx]} 26 52)')
    if attack:
        angles=[-75,57,90]
        sword=path('M63 58 65 27 71 17 76 27 73 59Z',CREAM,INK,2.5)+path('M57 56 81 58 80 64 58 63Z',GOLD,INK,2)+line('M67 64 67 72',RUST,5)
        b+=group(sword,f'rotate({angles[i]} 65 65) translate(-5 -3)')
        if i==1:
            b+=path('M51 7Q97 20 90 69L83 77Q92 27 51 7Z',CREAM,INK,1.4)
            b+=line('M75 18Q89 36 88 49',GOLD,3)
        if i==2:
            b+=line('M77 75 92 76M79 81 88 83',GOLD,2)
    else:
        b+=group(path('M69 66 70 30 76 21 81 32 77 68Z',CREAM,INK,2.5)+path('M63 63 85 67 83 72 62 69Z',GOLD,INK,2)+line('M71 71 70 79',RUST,5),f'rotate({[-12,-5,7,13,5,-8][i]} 71 69)')
    return b


def heroes_guards():
    for i in range(6):
        add('units',f'guard/knight/walk/{i}',96,96,group(knight_body(i),'translate(2 5) scale(.94 .91)'))
    for i in range(3):
        add('units',f'guard/knight/attack/{i}',96,96,group(knight_body(i,True),'translate(2 5) scale(.94 .91)'))
    for home in (False,True):
        b=ellipse(56,101,34,7,DARK,'none',0,'opacity=".3"')
        b+=path('M31 67 21 100 48 95 58 105 82 100 91 106 83 65Z',PURPLE)
        b+=path('M39 69 27 94 50 90 58 100 66 80Z',PINK)
        b+=circle(56,47,39,GOLD if home else VIOLET,INK,3.5)
        b+=circle(56,47,34,CREAM,INK,2)
        b+=line('M29 34Q35 17 56 15',CREAM,2.5)
        b+=path('M24 74 34 86 42 75 50 83 56 75 63 83 71 75 79 87 89 73',GOLD if home else MINT,INK,2)
        if home:
            b+=path('M35 17 32 3 47 10 56 2 66 10 81 3 77 19Z',GOLD,INK,2.5)
            b+=circle(56,12,3,PINK,INK,1)
        else:
            b+=star(87,25,11,MINT)
        add('units','hero/frame/home' if home else 'hero/frame/guest',112,112,b,[(56,47,31)])
    b=ellipse(64,25,59,18,'none',DARK,6)+ellipse(64,23,57,17,'none',MINT,3)+ellipse(64,23,49,12,'none',CREAM,1)
    b+=path('M2 22 11 15 11 29ZM126 22 117 15 117 29Z',GOLD,INK,1.5)
    add('units','hero/ring',128,48,b)
    cast_anchors=[]
    for i in range(6):
        x,y,r=56,47,31
        b=path(['M28 76 19 96 39 91 54 105 85 101 85 72Z','M24 74 9 92 36 88 55 102 94 99 87 69Z','M22 70 6 82 31 87 47 102 98 93 88 66Z','M23 68 5 70 24 87 54 104 105 79 87 65Z','M25 70 12 93 40 89 55 105 97 98 84 68Z','M28 74 20 101 47 95 57 105 89 99 83 72Z'][i],PINK)
        b+=circle(x,y,36,VIOLET,INK,3)
        b+=circle(x,y,33,CREAM,INK,2)
        hand_paths=['M24 69 13 74 17 84 31 83','M22 66 9 59 5 70 23 81','M24 64 7 44 4 55 18 77','M24 67 9 48 3 60 17 80','M24 71 7 69 10 85 29 87','M28 72 19 84 28 93 37 80']
        b+=path(hand_paths[i],MINT)
        tip=[(97,87),(101,52),(92,15),(100,28),(101,57),(98,72)][i]
        grip=[(84,89),(94,80),(98,42),(101,57),(95,85),(86,89)][i]
        b+=line(f'M{grip[0]} {grip[1]} {tip[0]} {tip[1]}',INK,7)
        b+=line(f'M{grip[0]} {grip[1]} {tip[0]} {tip[1]}',GOLD,4)
        b+=star(tip[0],tip[1],8,MINT,5,2)
        b+=ellipse(grip[0],grip[1],5,4,MINT,INK,2)
        if i in (2,3,4):
            b+=path('M17 27Q44-4 87 14L102 30Q55 2 17 27Z',GOLD,INK,1.5)
            b+=star(13,22,8,CREAM,4)+star(100,22,8,PINK,4)
        elif i==1:
            b+=star(15,24,5,GOLD,4)
        elif i==5:
            b+=star(94,17,5,MINT,4)
        add('units',f'hero/cast/{i}',112,112,b,[(x,y,r)])
        cast_anchors.append({'x':x,'y':y,'r':r})
    FACES['hero']={'x':56,'y':47,'r':31,'frames':cast_anchors}


def burst(x,y,r,fill=GOLD,sw=2,phase=0):
    pts=[]
    for j in range(16):
        a=j*math.pi/8+phase
        rr=r if j%2==0 else r*(.38+.12*math.sin(j*8))
        pts.append(f'{x+math.cos(a)*rr:.2f},{y+math.sin(a)*rr:.2f}')
    return path('M'+' '.join(pts)+'Z',fill,INK,sw)


def effects():
    add('fx','proj/egg',64,64,egg(34,32,1.1,40)+line('M9 42 19 36M12 50 23 44',GOLD,2.5))
    add('fx','proj/tp',64,64,paper_roll(35,28,.92,40)+path('M16 32Q-1 36 10 48L21 50 18 59 9 52Q-6 40 11 27Z',CREAM,INK,2))
    b=path('M54 12Q54 39 45 47 28 61 17 45 3 28 29 22L48 7 42 23Z',MINT)
    b+=path('M37 21Q47 42 31 46 17 43 26 32Z',CREAM,'none',0)
    b+=line('M5 57 14 48M3 44 9 38',MINT,2)
    add('fx','proj/wisp',64,64,b)
    b=path('M51 11Q57 47 32 54 9 58 13 34 19 14 51 11Z',GOLD)
    b+=line('M23 45 45 20',CREAM,4)+path('M43 17Q31-1 21 10 24 21 43 17',MINT,INK,2)
    add('fx','proj/seed',64,64,b)
    for i in range(6):
        # Egg: airborne smear -> impact star -> wet, spreading puddle and droplets.
        if i==0:
            b=path('M33 9Q49 29 66 46L83 59 67 72 48 51Z',CREAM,INK,2)+egg(72,67,.63,45)
        elif i==1:
            b=burst(64,72,43,CREAM,2)+ellipse(64,73,21,16,ORANGE,INK,2)
        else:
            rx=[0,0,39,48,51,47][i]
            ry=[0,0,21,17,12,8][i]
            b=path(f'M{64-rx} 78Q{22-i} 65 48 {76-ry}L52 {66-ry}Q64 {64-ry} 70 {75-ry}Q{94+i*2} 53 {64+rx} 76L{74+rx} 84 91 93Q60 {100+ry//2} 44 94L18 96 27 87Z',CREAM,INK,2)
            b+=ellipse(64,83,rx*.43,ry*.65,ORANGE,INK,1.5)
            b+=ellipse(58,79,rx*.15,ry*.18,GOLD,'none',0)
            if i<5:
                for x,y,r in [(22-i*2,46+i*6,4),(94+i*3,42+i*5,3),(57,21+i*5,3)]:
                    b+=ellipse(x,y,r,r*1.5,CREAM,INK,1.5)
        add('fx',f'fx/splat/{i}',128,128,b)
        # Poof has growing lobes, then broken wisps rather than a scaled blob.
        b=''
        if i==0:
            b=ellipse(64,78,15,27,CREAM,INK,2)+line('M41 69 34 63M86 68 94 61',PINK,3)
        elif i==1:
            b=burst(64,65,43,PINK,2)+path('M39 70Q22 58 39 44 44 22 62 31 77 16 87 40 111 46 95 64 104 87 81 85 63 109 49 85 28 91 39 70Z',CREAM,INK,2)
        else:
            for j in range(7):
                a=j*math.tau/7+i*.13
                rad=17+i*6
                x,y=64+math.cos(a)*rad,65+math.sin(a)*rad*.9
                rr=[0,0,21,16,10,5][i]
                if i<4:
                    b+=path(f'M{x-rr} {y}Q{x-rr*1.3} {y-rr} {x} {y-rr}Q{x+rr*.4} {y-rr*1.6} {x+rr} {y-rr*.3}Q{x+rr*1.7} {y+rr*.5} {x} {y+rr}Q{x-rr} {y+rr*1.4} {x-rr} {y}Z',CREAM,INK,1.6)
                else:
                    b+=line(f'M{x-rr} {y+rr*.3}Q{x+rr} {y+rr} {x+rr*.6} {y-rr}',CREAM,3 if i==4 else 2)
            if i==2:
                b+=circle(64,66,23,CREAM,'none',0)
            b+=star(65,50,15 if i==2 else 8,GOLD,4)
        add('fx',f'fx/poof/{i}',128,128,b)
        # Candy accelerates outward and rotates; spark silhouette changes at impact.
        b=burst(64,64,[12,29,47,36,20,7][i],GOLD,2,phase=i*.12) if i<4 else ''
        for j in range(6):
            a=j*math.tau/6-.3
            radius=[6,18,30,39,44,48][i]
            x=64+math.cos(a)*radius
            y=64+math.sin(a)*radius+(max(0,i-3)*6)
            b+=candy(x,y,[.23,.33,.49,.45,.34,.2][i],j*51+i*31,[PINK,MINT,ORANGE,VIOLET,GOLD,CREAM][j])
            if i in (2,3):
                b+=line(f'M{64+math.cos(a)*17} {64+math.sin(a)*17} {64+math.cos(a)*25} {64+math.sin(a)*25}',CREAM,2)
        add('fx',f'fx/candy-burst/{i}',128,128,b)
        # TP sweeps around the target, tightens into a mummy, tears and unravels.
        ribbons=[
            'M6 91Q33 109 66 83L75 75 83 85Q42 123 9 105Z',
            'M10 90Q99 126 104 57L91 60Q87 103 17 77Z',
            'M26 39Q66 20 106 44L102 58Q58 33 27 53ZM20 68Q64 92 107 66L108 81Q61 105 21 83ZM32 95 89 92 93 108 36 110Z',
            'M29 27 97 37 94 52 29 43ZM25 49 104 55 101 70 23 65ZM26 72 100 75 96 91 27 86ZM35 91 91 93 88 109 39 107Z',
            'M28 31 62 42 56 56 24 44ZM77 38 104 34 108 47 84 51ZM22 67 48 75 43 91 16 81ZM67 79 110 68 115 81 76 94ZM44 104 75 98 83 109 49 118Z',
            'M17 28 32 40 25 51 8 41ZM98 26 119 22 116 36 102 39ZM5 94 22 99 18 110 4 106ZM93 103 118 87 123 100 103 115Z',
        ]
        b=path(ribbons[i],CREAM,INK,2.5)
        if i in (2,3):
            b+=line('M43 39 43 48M76 56 76 68M50 80 49 87M71 98 70 106','#aaa1b7',1.5,'stroke-dasharray="2 3"')
        if i==1:
            b+=paper_roll(98,45,.65,40)
        add('fx',f'fx/tp-wrap/{i}',128,128,b)
        # Boo inflates, shouts, and tears away into frightened ghostlets.
        if i<4:
            shapes=[
                'M44 86Q40 49 63 48 88 47 85 86L75 81 67 94 56 82Z',
                'M28 93Q18 30 60 24 106 22 100 93L85 86 73 105 57 89 42 102Z',
                'M15 90Q7 8 62 11 122 7 113 91L94 80 80 111 61 88 42 111 30 87Z',
                'M23 91Q17 23 64 27 111 18 106 90L90 85 78 108 62 94 43 110Z',
            ]
            b=path(shapes[i],MINT,INK,3)
            ex=[6,12,16,14][i]
            ey=[63,53,53,53][i]
            b+=ellipse(63-ex,ey,3 if i==0 else 4,4 if i==0 else 7,PURPLE,'none',0)+ellipse(67+ex,ey,3 if i==0 else 4,4 if i==0 else 7,PURPLE,'none',0)
            b+=ellipse(65,77 if i==0 else 73,[4,9,15,10][i],[5,12,15,7][i],PURPLE,INK,1.5)
            b+=line('M20 36 10 29M109 32 119 21',GOLD,3) if i==2 else ''
        else:
            b=''
            for j in range(3):
                body=path('M-12 8Q-14-16 0-16 16-18 14 8L8 5 2 14-4 5-10 12Z',MINT,INK,2)+ellipse(-4,-3,1.5,3,PURPLE,'none',0)+ellipse(5,-3,1.5,3,PURPLE,'none',0)
                b+=group(body,f'translate({24+j*38} {34+((j+1)%2)*35-(i-4)*13}) rotate({-25+j*25}) scale({1 if i==4 else .55})')
        add('fx',f'fx/boo/{i}',128,128,b)
        # Rising light draws a crest, then breaks into star confetti.
        b=''
        if i<4:
            widths=[15,24,30,39]
            ww=widths[i]
            b+=path(f'M{64-ww} 114 49 {74-i*17} 64 {52-i*12} 79 {74-i*17} {64+ww} 114Z',GOLD,'none',0,'opacity=".35"')
            b+=ellipse(64,109,22+i*10,6+i*2,'none',MINT,3)
            b+=star(64,78-i*18,12+i*5,GOLD,5,2.5)
        for j in range(4):
            x=25+j*26+(i%2)*3
            y=100-((i*21+j*19)%85)
            b+=star(x,y,[3,5,7,6,5,3][i],[MINT,PINK,CREAM,GOLD][j],4,1)
        add('fx',f'fx/levelup/{i}',128,128,b)
    for i in range(4):
        b=''
        for j in range(5):
            x=20+j*23
            y=(j*23+i*29)%99+12
            b+=path(f'M{x-7} {y-22} {x-3} {y-4} {x+4} {y-2} {x+1} {y-21}Z',GOLD,'none',0,'opacity=".55"')
            b+=candy(x,y,.43,25+i*24+j*45,[PINK,MINT,ORANGE,GOLD,VIOLET][j])
        if i>1:
            b+=burst(64,107,18+i*3,CREAM,1.5)
        add('fx',f'fx/candy-rain/{i}',128,128,b)
        b=ellipse(64,55,43,17,'none',GOLD,2, 'stroke-dasharray="17 8"')
        for j in range(3):
            a=(j/3+i/4)*math.tau
            x,y=64+math.cos(a)*44,55+math.sin(a)*19
            b+=star(x,y,10+(j+i)%3,GOLD)
        add('fx',f'fx/stun/{i}',128,128,b)
    b=ellipse(67,67,32,35,RUST,INK,3)+ellipse(61,62,31,35,GOLD,INK,3)
    b+=ellipse(61,62,23,27,'none','#bf7136',2)+text(61,75,'K',34,PURPLE,INK,1)
    b+=line('M43 43Q48 35 60 34',CREAM,3)+star(97,24,12,CREAM,4)
    add('fx','fx/coin',128,128,b)
    for i in range(4):
        b=ellipse(64,105,42,10,DARK,'none',0,'opacity=".28"')
        if i<2:
            b+=pumpkin(64,69,[1.22,1.35][i])
            b+=path('M47 103 37 113 52 111M83 102 96 112 78 112','none',MINT,3)
            if i==1:
                b+=line('M17 56 7 51M105 43 116 36',GOLD,3)
        elif i==2:
            b+=burst(64,67,57,GOLD,2)
            b+=path('M20 46 44 28 49 50 34 64ZM82 28 108 50 91 65 78 49ZM48 79 76 79 80 106 44 103Z',ORANGE,INK,3)
            b+=star(65,65,25,CREAM,4,2)
        else:
            b+=path('M20 99 30 88 43 99 34 105ZM86 102 100 88 112 102ZM50 110 57 101 70 108Z',ORANGE,INK,2)
            b+=star(29,40,9,GOLD)+star(97,28,11,GOLD)+line('M61 18 60 37',CREAM,3)
        add('fx',f'trap/pumpkin/{i}',128,128,b)
    for i in range(2):
        b=ellipse(64,107,42,9,DARK,'none',0,'opacity=".25"')
        b+=path('M21 61Q24 108 65 108 105 108 110 61Z',VIOLET)
        b+=ellipse(65,61,44,17,PURPLE,INK,3)
        for j,(x,y) in enumerate([(42,59),(66,54),(86,60),(53,69),(76,70)]):
            b+=candy(x,y-(5 if i and j%2 else 0),.46,j*48+i*20,[PINK,ORANGE,MINT,GOLD,CREAM][j])
        b+=path('M21 64Q63 91 109 64L106 75Q61 98 24 75Z',PINK,INK,2)
        b+=star(63,94,8,GOLD)
        if i:
            b+=path('M41 36Q30 22 39 16M63 29Q77 13 66 7M87 40Q103 27 93 17','none',CREAM,3)
        add('fx',f'trap/bowl/{i}',128,128,b)
        b=path('M17 87Q9 75 30 69 25 55 48 60 59 41 78 58 106 51 101 74 123 82 106 94 82 100 63 95 43 110 31 95 12 98 17 87Z',PINK,INK,3)
        b+=path('M23 82Q52 68 84 72 100 71 105 82', 'none','#ffb9cb',4)
        if i==0:
            b+=circle(66,65,18,'#f092b9',INK,2.5)+line('M55 62Q54 55 61 53',CREAM,3)
        else:
            b+=path('M44 64 50 48 63 61 75 41 81 62 93 54 94 68',PINK,INK,2)
            b+=ellipse(68,77,16,5,RUST,'none',0)+circle(30,57,4,PINK,INK,1.5)+circle(102,49,5,PINK,INK,1.5)
        add('fx',f'trap/gum/{i}',128,128,b)


def modifier(name):
    b=''
    if name=='burning':
        b=path('M23 4Q31 14 29 23L37 16Q49 37 29 44 7 47 9 29L17 16 16 27Q26 21 23 4Z',ORANGE)
        b+=path('M26 23Q12 40 25 40 35 37 26 23Z',GOLD,'none',0)
    elif name=='slippery':
        b=path('M24 4Q20 16 11 25 3 42 24 44 44 43 36 27Z',MINT)
        b+=line('M16 28Q12 36 20 37',CREAM,3)+line('M5 42 14 44M35 42 43 39',VIOLET,2)
    elif name=='smoke':
        b=path('M7 35Q-1 22 12 19 6 6 20 9 28-1 35 14 48 15 41 28 50 39 34 42L13 42Z',LILAC)
        b+=line('M17 30Q26 39 31 29 32 21 24 22M11 20 16 23',CREAM,2)
    elif name=='wind':
        b=line('M5 16 28 16Q42 16 36 8 30 2 27 10M4 25 38 25Q48 25 43 17M10 34 29 34Q41 34 37 42 31 48 26 40',INK,7)
        b+=line('M5 16 28 16Q42 16 36 8 30 2 27 10M4 25 38 25Q48 25 43 17M10 34 29 34Q41 34 37 42 31 48 26 40',MINT,3.5)
    elif name=='laser':
        b=path('M3 21Q15 7 28 19L25 30Q12 35 3 21Z',CREAM,INK,2.5)+circle(19,23,7,PINK,INK,2)
        b+=path('M22 21 44 10 36 25 45 32 22 27Z',PINK,INK,2)+line('M26 24 41 16',CREAM,2)
    elif name=='visor':
        b=path('M5 15Q24 7 43 16L41 34 30 37 25 28 20 37 7 34Z',PURPLE)
        b+=path('M9 18 23 16 21 28 11 30ZM27 16 39 18 37 30 28 28Z',MINT,INK,1.5)
        b+=line('M12 21 17 19M30 20 34 21',CREAM,2)
    elif name=='crown':
        b=path('M8 37 4 12 17 22 24 5 32 22 44 12 39 38Z',GOLD)
        b+=line('M11 32 36 32',ORANGE,3)+circle(24,26,4,PINK,INK,1.5)
    elif name=='wizard':
        b=path('M11 31 24 4 34 9 29 13 39 32Z',VIOLET)
        b+=path('M3 33Q23 22 45 34L42 41Q23 46 5 40Z',PURPLE)
        b+=star(24,24,6,GOLD,5,1)+line('M18 15 22 9',LILAC,2)
    elif name=='rich':
        b=ellipse(20,30,15,14,ORANGE,INK,2)+circle(28,19,15,GOLD,INK,2.5)+text(28,26,'K',19,PURPLE,INK,.5)
        b+=star(9,8,6,CREAM,4,1)
    elif name=='gum':
        b=path('M8 29Q3 44 23 43 47 46 41 31Z',PINK,INK,2)+circle(24,22,17,PINK,INK,2.5)
        b+=line('M13 21Q13 12 22 11',CREAM,3)
    elif name=='hungry':
        b=path('M5 16Q25 23 43 13L38 35Q24 46 10 34Z',DARK)
        b+=path('M9 18 12 27 18 23 23 29 28 22 34 25 39 17',CREAM,INK,1)
        b+=path('M18 32Q28 25 35 34L31 40 20 39Z',PINK,INK,1.5)
        b+=path('M38 32Q50 43 39 46 32 44 38 32Z',MINT,INK,1.5)
    elif name=='knife':
        b=path('M17 29 37 4 43 9Q38 29 24 35Z',CREAM)
        b+=path('M5 40 15 28 24 36 13 46Z',RUST,INK,2.5)+line('M12 27 26 39',GOLD,4)
        b+=line('M25 26 37 10',LILAC,2)
    elif name=='lucky':
        b=circle(13,16,9,MINT,INK,2)+circle(29,12,9,MINT,INK,2)+circle(34,29,9,MINT,INK,2)+circle(16,32,9,MINT,INK,2)
        b+=line('M22 24Q34 37 30 44',GREEN,5)+star(23,24,6,GOLD,4,1)
    elif name=='candle':
        b=path('M14 20 33 18 35 42 12 42Z',MINT)
        b+=path('M12 20Q17 12 23 18 35 12 35 20L32 30 27 26 22 31 17 24Z',CREAM,INK,2)
        b+=path('M22 17Q10 12 24 2 33 13 22 17Z',ORANGE,INK,2)
    elif name=='skull':
        b=path('M11 29Q-1 12 15 6 35-1 43 15 47 25 36 29L34 41 14 42Z',CREAM)
        b+=ellipse(15,21,6,7,PURPLE,INK,1.5)+ellipse(32,20,6,7,PURPLE,INK,1.5)+path('M24 26 20 32 27 32Z',PURPLE,INK,1)
        b+=line('M20 36 20 41M27 36 27 41',INK,2)
    elif name=='toxic':
        b=circle(24,24,20,MINT,INK,2.5)+circle(24,24,4,PURPLE,INK,1)
        for a in (0,120,240):
            b+=group(path('M20 17 13 8Q23 2 32 8L27 17Z',PURPLE,INK,1),f'rotate({a} 24 24)')
    elif name=='metal':
        b=path('M7 10 26 4 42 12 39 31 25 44 9 32Z','#a5aab8')
        b+=path('M26 8 37 14 34 29 25 38Z','#6d7293',INK,1.5)+line('M12 15 20 12 18 24',CREAM,3)
        b+=circle(14,32,2,GOLD,INK,1)+circle(35,16,2,GOLD,INK,1)
    elif name=='elite':
        b=path('M4 20 11 29 15 17 22 41 12 38ZM44 20 37 29 33 17 26 41 36 38Z',GOLD,INK,2)
        b+=star(24,20,19,PINK,5,2.5)+star(24,20,9,GOLD,5,1)
    else:
        raise ValueError(name)
    return b


MODS='burning slippery smoke wind laser visor crown wizard rich gum hungry knife lucky candle skull toxic metal elite'.split()


def ui():
    b=path('M12 18Q127 7 244 17L248 76Q126 94 10 79Z',PURPLE,INK,4)
    b+=path('M10 11Q123 1 242 10L245 67Q124 82 10 70Z',ORANGE,INK,4)
    b+=line('M24 20Q125 10 229 18',GOLD,4)+line('M24 61Q123 70 229 61',RUST,3)
    b+=circle(20,44,3,GOLD,INK,1)+circle(232,40,3,GOLD,INK,1)
    add('ui','ui/btn',256,96,b)
    b=circle(48,52,40,PURPLE,INK,4)+circle(48,44,39,ORANGE,INK,4)+line('M19 34Q25 16 45 15',GOLD,4)
    add('ui','ui/btn-round',96,96,b)
    b=path('M17 16 363 10 376 244 12 249Z',PURPLE,INK,5)
    b+=path('M10 9Q189 2 365 7L369 233Q189 248 17 237Z',CREAM,INK,5)
    b+=path('M20 20 355 17 358 224 27 228Z','none','#b494ad',2)
    for x,y in [(25,26),(352,25),(30,223),(352,221)]:
        b+=star(x,y,6,PINK,4,1)
    b+=line('M15 68 24 66M364 190 354 192',INK,2)
    add('ui','ui/panel',384,256,b)
    b=path('M55 27 5 19 16 54 4 89 66 82M329 27 379 19 368 54 380 89 318 82',RUST,INK,4)
    b+=path('M43 13Q190-1 341 13L339 88Q191 109 45 91Z',ORANGE,INK,4)
    b+=line('M59 23Q190 10 326 24M61 82Q191 95 324 81',GOLD,3)
    b+=star(65,54,11,CREAM)+star(319,54,11,CREAM)
    add('ui','ui/banner-wave',384,112,b)
    for full in (False,True):
        b=star(33,35,29,PURPLE,5,3)+star(31,29,27,GOLD if full else '#84718d',5,3)
        b+=line('M29 13 23 24 12 25',CREAM if full else '#b09eb6',2.5)
        if full:
            b+=path('M36 33 46 46 31 40Z',ORANGE,'none',0)
        add('ui','ui/star-full' if full else 'ui/star-empty',64,64,b)
    b=path('M22 23 52 23 53 33Q67 40 65 71 65 86 36 85 7 85 8 71 5 40 20 33Z','#bacdd1',INK,3)
    b+=path('M15 44Q34 54 59 43L59 73Q34 88 14 73Z','#746c98',INK,1.5)
    for j,(x,y) in enumerate([(25,58),(43,62),(32,74)]):
        b+=candy(x,y,.4,j*50,[PINK,GOLD,MINT][j])
    b+=path('M18 12 56 12 57 25 18 26Z',GOLD,INK,3)+line('M22 17 49 17',CREAM,2)
    b+=line('M15 42 13 64',CREAM,3)+star(56,6,5,CREAM,4,1)
    add('ui','ui/jar',72,88,b)
    add('ui','ui/candy',64,64,candy(32,32,1.25,-22))
    b=circle(34,34,27,RUST,INK,3)+circle(29,29,25,GOLD,INK,3)+circle(29,29,19,'none','#b66a37',2)+text(29,38,'K',27,PURPLE,INK,1)+line('M14 18 21 12',CREAM,3)
    add('ui','ui/knock-coin',64,64,b)
    for n in (1,2,3):
        b=''
        for j in range(n):
            x=24-n*6+j*12
            b+=path(f'M{x-5} 11 {x+8} 24 {x-5} 37Z',GOLD,INK,2.5)
        add('ui',f'ui/speed-{n}',48,48,b)
    add('ui','ui/pause',48,48,path('M10 9 19 8 19 40 9 39ZM29 8 39 9 40 39 29 40Z',CREAM,INK,3))
    b=circle(128,128,117,PURPLE,INK,4)+circle(128,128,112,'none',LILAC,2)+circle(128,128,72,DARK,INK,3)
    for a in range(0,360,90):
        b+=group(line('M128 12 128 52',GOLD,3)+star(128,21,6,GOLD,4,1),f'rotate({a} 128 128)')
    add('ui','ui/radial-ring',256,256,b,[(128,128,68)])
    b=circle(48,49,43,PURPLE,INK,3)+circle(48,45,39,CREAM,INK,3)+line('M20 28Q32 11 53 15',GOLD,3)
    add('ui','ui/radial-slot',96,96,b)
    b=circle(128,128,123,MINT,'none',0,'opacity=".06"')+circle(128,128,121,'none',MINT,2,'opacity=".8" stroke-dasharray="9 7"')
    add('ui','ui/range',256,256,b,grain=False)
    for name in MODS:
        add('ui',f'mod/{name}',48,48,group(modifier(name),'translate(2.4 2.4) scale(.9)'))


def emotes():
    colors={'boo':MINT,'trick':VIOLET,'treat':ORANGE,'lol':GOLD,'taunt':PINK,'heart':PINK,'cry':LILAC,'gg':MINT}
    for name,color in colors.items():
        for i in range(4):
            # Four independently drawn balloon contours: inhale, overshoot, punch, settle.
            shapes=[
                'M18 28Q54 10 106 25 126 33 113 67L83 73 67 88 66 73Q19 82 12 60 5 42 18 28Z',
                'M14 12Q57 0 111 13 127 25 119 63L86 73 63 93 64 75Q9 84 6 55-1 25 14 12Z',
                'M8 23 18 10 43 14 58 3 76 13 109 7 116 22 125 39 116 62 88 70 66 92 62 74 29 78 15 67 4 51Z',
                'M15 17Q58 5 108 16 123 26 117 61L84 71 65 87 65 72Q16 81 9 58 2 29 15 17Z',
            ]
            b=group(path(shapes[i],PURPLE,INK,3),'translate(1 3)')+path(shapes[i],CREAM,INK,3)
            b+=line('M21 24Q45 14 64 16',color,3)
            cy=[43,37,38,39][i]
            if name=='boo':
                b+=path(f'M42 {cy+9}Q38 {cy-24} 61 {cy-24} 84 {cy-25} 84 {cy+10}L74 {cy+5} 64 {cy+16} 54 {cy+6}Z',MINT,INK,2)
                b+=ellipse(55,cy-9,2,4,PURPLE,'none',0)+ellipse(72,cy-9,2,4,PURPLE,'none',0)
                b+=ellipse(63,cy+2,[3,5,8,5][i],[4,7,8,5][i],PURPLE,'none',0)
                b+=text(64,70,'BOO!',17,PURPLE,'none',0)
            elif name=='trick':
                b+=group(modifier('wizard'),'translate(40 12) scale(.92)')
                if i in (1,2):
                    b+=star(28,34,6,PINK,4,1)+star(101,30,7,GOLD,4,1)
                b+=text(64,69,'TRICK!',17,PURPLE,'none',0)
            elif name=='treat':
                b+=bucket(65,cy-4,[-12,12,-18,0][i])
                b+=candy(48,cy-15,.43,i*29,PINK)+candy(75,cy-19,.39,-i*19,MINT)
                if i==2:
                    b+=candy(98,25,.33,40)+candy(29,28,.29,-40)
                b+=text(64,71,'TREAT?',16,PURPLE,'none',0)
            elif name in ('lol','taunt','cry'):
                cy-=10
                b+=ellipse(64,cy-1,23,20,GOLD if name=='lol' else (PINK if name=='taunt' else LILAC),INK,2)
                if name=='lol':
                    b+=line(f'M48 {cy-6} 53 {cy-10} 58 {cy-5}M70 {cy-6} 75 {cy-10} 80 {cy-5}',INK,2.4)
                    b+=path(f'M52 {cy+1}Q64 {cy+7} 78 {cy}Q74 {cy+19-i*2} 62 {cy+16} 53 {cy+13} 52 {cy+1}Z',PURPLE,INK,1.5)
                    b+=path(f'M57 {cy+3} 72 {cy+3} 70 {cy+7} 58 {cy+7}',CREAM,'none',0)
                    if i in (1,2):
                        b+=path(f'M35 {cy-1}Q24 {cy+12} 35 {cy+14} 42 {cy+10} 35 {cy-1}M92 {cy-1}Q84 {cy+12} 94 {cy+13} 102 {cy+10} 92 {cy-1}',MINT,INK,1.5)
                    b+=text(64,72,'LOL',18,PURPLE,'none',0)
                elif name=='taunt':
                    b+=line(f'M48 {cy-9} 59 {cy-5}M71 {cy-5} 80 {cy-10}',INK,2.5)
                    b+=circle(55,cy-2,2,PURPLE,'none',0)+circle(74,cy-2,2,PURPLE,'none',0)
                    b+=path(f'M52 {cy+8}Q65 {cy+15} 79 {cy+5}',PURPLE,INK,2)
                    b+=path(f'M65 {cy+11} 77 {cy+9}Q80 {cy+23-i*2} 70 {cy+22-i*2}Z',ORANGE,INK,1.5)
                    b+=text(64,73,'NYAH!',16,PURPLE,'none',0)
                else:
                    b+=line(f'M48 {cy-7} 58 {cy-11}M71 {cy-11} 81 {cy-6}',INK,2)
                    b+=path(f'M51 {cy-3} 58 {cy-2} 54 {cy+21+i*2} 45 {cy+18}ZM72 {cy-2} 79 {cy-3} 85 {cy+17+i*2} 75 {cy+20}Z',MINT,INK,1.5)
                    b+=ellipse(65,cy+9,5,[3,6,8,5][i],PURPLE,'none',0)
                    b+=text(64,73,'SOB',16,PURPLE,'none',0)
            elif name=='heart':
                b+=path('M63 56Q30 39 39 23 50 12 63 27 77 9 90 25 100 41 63 56Z',PINK,INK,2.5)
                b+=line('M46 27Q50 20 55 27',CREAM,3)
                if i in (1,2):
                    b+=group(path('M0 8Q-13 0-8-7-3-12 0-5 6-14 12-6 15 0 0 8Z',PINK,INK,1.5),f'translate({27-i*3} {35-i*4})')
                    b+=star(104,27,6,GOLD,4,1)
                b+=text(64,73,'LOVE',16,PURPLE,'none',0)
            else:
                b+=star(31,38,12,GOLD,5,2)+star(97,36,12,GOLD,5,2)
                b+=text(64,52,'GG',29,PURPLE,INK,1)
                b+=line('M49 60 63 66 80 58',MINT,3)
                if i in (1,2):
                    b+=line('M24 15 20 9M105 14 111 6M15 50 9 54',ORANGE,2)
            add('ui',f'emote/{name}/{i}',128,96,b)


def contract():
    units={f'tower/{f}/{n}':(160,200) for f in ('egg','tp','lantern','patch') for n in range(1,4)}
    units.update({f'pad/{s}':(160,80) for s in ('empty','glow')})
    for f in ('treater','ghost','pumpkin','bat'):
        units.update({f'enemy/{f}/walk/{n}':(128,128) for n in range(6)})
        units.update({f'enemy/{f}/die/{n}':(128,128) for n in range(3)})
        units[f'enemy/{f}/hurt']=(128,128)
    units.update({f'guard/knight/walk/{n}':(96,96) for n in range(6)})
    units.update({f'guard/knight/attack/{n}':(96,96) for n in range(3)})
    units.update({f'hero/frame/{s}':(112,112) for s in ('guest','home')})
    units['hero/ring']=(128,48)
    units.update({f'hero/cast/{n}':(112,112) for n in range(6)})
    fx={f'proj/{f}':(64,64) for f in ('egg','tp','wisp','seed')}
    for f,nn in [('splat',6),('poof',6),('candy-burst',6),('tp-wrap',6),('candy-rain',4),('boo',6),('levelup',6),('stun',4)]:
        fx.update({f'fx/{f}/{n}':(128,128) for n in range(nn)})
    fx['fx/coin']=(128,128)
    for f,nn in [('pumpkin',4),('bowl',2),('gum',2)]:
        fx.update({f'trap/{f}/{n}':(128,128) for n in range(nn)})
    ui_sizes={'btn':(256,96),'btn-round':(96,96),'panel':(384,256),'banner-wave':(384,112),'star-empty':(64,64),'star-full':(64,64),'jar':(72,88),'candy':(64,64),'knock-coin':(64,64),'pause':(48,48),'radial-ring':(256,256),'radial-slot':(96,96),'range':(256,256)}
    ui_frames={f'ui/{k}':v for k,v in ui_sizes.items()}
    ui_frames.update({f'ui/speed-{n}':(48,48) for n in range(1,4)})
    ui_frames.update({f'emote/{f}/{n}':(128,96) for f in ('boo','trick','treat','lol','taunt','heart','cry','gg') for n in range(4)})
    ui_frames.update({f'mod/{f}':(48,48) for f in MODS})
    return {'units':units,'fx':fx,'ui':ui_frames}


def render(source,w,h,renderer):
    if Path(renderer).name=='rsvg-convert':
        cmd=[renderer,'--width',str(w),'--height',str(h),str(source)]
    else:
        cmd=[renderer,'-background','none',str(source),'-resize',f'{w}x{h}!','png:-']
    result=subprocess.run(cmd,check=True,capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGBA')


def shelf(items,width):
    x=y=2
    row=0
    positions={}
    for name,img in sorted(items.items(),key=lambda kv:(-kv[1].height,-kv[1].width,kv[0])):
        w,h=img.size
        if x+w+2>width:
            x=2; y+=row+4; row=0
        positions[name]=(x,y,w,h)
        x+=w+4
        row=max(row,h)
    height=math.ceil((y+row+2)/64)*64
    return positions,height


def font(size):
    return ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf',size) if Path('/usr/share/fonts/TTF/DejaVuSans.ttf').exists() else ImageFont.load_default(size=size)


def contact_sheet(atlas,items):
    cols=8
    cw,ch=176,164
    sheet=Image.new('RGB',(cols*cw,math.ceil(len(items)/cols)*ch+54),'#292034')
    draw=ImageDraw.Draw(sheet)
    draw.text((16,13),f'CANDY SIEGE / {atlas.upper()} / {len(items)} FRAMES',font=font(19),fill=CREAM)
    for i,(name,img) in enumerate(items.items()):
        x,y=(i%cols)*cw,(i//cols)*ch+48
        draw.rounded_rectangle((x+5,y+5,x+cw-5,y+ch-5),radius=9,fill='#48374f')
        thumb=img.copy()
        thumb.thumbnail((148,112),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+(cw-thumb.width)//2,y+8+(112-thumb.height)//2),thumb)
        parts=name.split('/')
        label='/'.join(parts[:-1]) if len(name)>23 else name
        draw.text((x+9,y+124),label,font=font(11),fill=CREAM)
        if label!=name:
            draw.text((x+9,y+140),parts[-1],font=font(11),fill=GOLD)
    sheet.save(ROOT/f'preview-{atlas}.png')


def preview_motion(images):
    rows=[('treater','enemy/treater/walk/',6),('ghost','enemy/ghost/walk/',6),('pumpkin','enemy/pumpkin/walk/',6),('bat','enemy/bat/walk/',6),('knight','guard/knight/walk/',6),('cast','hero/cast/',6)]
    # All costume cycles also appear at exactly 60 px frame height.
    sheet=Image.new('RGB',(1060,596),'#36283f')
    d=ImageDraw.Draw(sheet)
    d.text((15,12),'PHONE SCALE / 60px frame height / contact · recoil · passing · opposite contact',font=font(16),fill=CREAM)
    for row,(label,prefix,n) in enumerate(rows):
        yy=48+row*89
        d.text((14,yy+25),label,font=font(15),fill=CREAM)
        for i in range(n):
            im=images['units'][prefix+str(i)].copy()
            im.thumbnail((70,60),Image.Resampling.LANCZOS)
            xx=130+i*150
            sheet.paste(im,(xx,yy),im)
            d.text((xx+27,yy+62),str(i),font=font(11),fill=LILAC)
    sheet.save(ROOT/'preview-motion.png')
    death=Image.new('RGB',(960,600),'#36283f')
    d=ImageDraw.Draw(death)
    d.text((16,12),'CANDY POP / recoil · squash · burst · scattering candy',font=font(18),fill=CREAM)
    for row,kind in enumerate(('treater','ghost','pumpkin','bat')):
        d.text((12,90+row*130),kind,font=font(15),fill=CREAM)
        for col,suffix in enumerate(('hurt','die/0','die/1','die/2')):
            im=images['units'][f'enemy/{kind}/{suffix}']
            death.paste(im,(145+col*196,48+row*133),im)
    death.save(ROOT/'preview-deaths.png')


def build_batch1():
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    if not renderer:
        raise SystemExit('Install rsvg-convert or ImageMagick to render the SVG masters.')
    traits_path=OUT/'traits.json'
    traits_bytes=traits_path.read_bytes()
    traits=json.loads(traits_bytes)
    assert {'keys','values','chogs'}<=traits.keys()
    towers(); enemies(); heroes_guards(); effects(); ui(); emotes()
    expected=contract()
    for atlas,names in expected.items():
        assert set(FRAMES[atlas])==set(names),(atlas,'frame contract mismatch')
        for name,size in names.items():
            assert FRAMES[atlas][name][:2]==size,(name,'size mismatch')
    jobs=[(atlas,name,entry) for atlas,entries in FRAMES.items() for name,entry in entries.items()]
    images={k:{} for k in FRAMES}
    def render_job(job):
        atlas,name,(w,h,source,holes)=job
        im=render(source,w*2,h*2,renderer).resize((w,h),Image.Resampling.LANCZOS)
        assert im.getbbox(),(name,'empty frame')
        for x,y,r in holes:
            assert im.getpixel((round(x),round(y)))[3]==0,(name,'portrait not transparent')
            for dx,dy in ((.7,0),(-.7,0),(0,.7),(0,-.7)):
                assert im.getpixel((round(x+dx*r),round(y+dy*r)))[3]==0,(name,'portrait hole too small')
        target=ROOT/'png'/(name+'.png')
        target.parent.mkdir(parents=True,exist_ok=True)
        im.save(target)
        return atlas,name,im
    print(f'Rendering {len(jobs)} SVG frames using {Path(renderer).name}...',flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for atlas,name,im in pool.map(render_job,jobs):
            images[atlas][name]=im
    (OUT/'atlas').mkdir(parents=True,exist_ok=True)
    report={}
    for atlas,items in images.items():
        options=[(width,*shelf(items,width)) for width in (1024,1536,2048)]
        options=[o for o in options if o[2]<=2048]
        width,positions,height=min(options,key=lambda o:(o[0]*o[2],max(o[0],o[2])))
        sheet=Image.new('RGBA',(width,height))
        frames={}
        for name,(x,y,w,h) in positions.items():
            sheet.paste(items[name],(x,y))
            frames[name]={'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':w,'h':h},'sourceSize':{'w':w,'h':h},'pivot':{'x':.5,'y':.5}}
        metadata={'frames':frames,'meta':{'app':'Candy Siege art build','version':'1.0','image':f'{atlas}.png','format':'RGBA8888','size':{'w':width,'h':height},'scale':'1'}}
        png_path=OUT/'atlas'/f'{atlas}.png'
        sheet.save(png_path)
        (OUT/'atlas'/f'{atlas}.json').write_text(json.dumps(metadata,indent=2)+'\n')
        # Reopen the shipped PNG and verify exact source rectangles and padding.
        with Image.open(png_path) as packed:
            packed.load()
            assert packed.size==(width,height)
            for name,(x,y,w,h) in positions.items():
                assert packed.crop((x,y,x+w,y+h)).tobytes()==items[name].tobytes(),name
                for strip in ((x-2,y-2,x+w+2,y),(x-2,y+h,x+w+2,y+h+2),(x-2,y,x,y+h),(x+w,y,x+w+2,y+h)):
                    assert not packed.crop(strip).getchannel('A').getbbox(),(name,'padding not clear')
        contact_sheet(atlas,items)
        report[atlas]={'frames':len(items),'size':[width,height],'sha256':hashlib.sha256(png_path.read_bytes()).hexdigest()}
        print(f'{atlas}: {len(items)} frames, {width} x {height}',flush=True)
    existing=json.loads((ROOT/'faces.json').read_text())
    assert all(existing[k]==v for k,v in FACES.items())
    (ROOT/'faces.json').write_text(json.dumps({**existing, **FACES},indent=2)+'\n')
    shutil.copyfile(ROOT/'faces.json',OUT/'atlas/faces.json')
    assert traits_path.read_bytes()==traits_bytes,'traits.json changed during build'
    # A repeated animation image would indicate a lost pose or an accidental alias.
    for kind in ('treater','ghost','pumpkin','bat'):
        assert len({images['units'][f'enemy/{kind}/walk/{n}'].tobytes() for n in range(6)})==6
    preview_motion(images)
    references=[('scenery/house-1.svg',240,288),('boss/great-pumpkin-idle.svg',256,256),('icons/candy.svg',180,180),('ui/bat-1.svg',240,120)]
    reference=Image.new('RGB',(1040,340),'#48374f')
    for i,(name,w,h) in enumerate(references):
        im=render(ROOT.parent/name,w,h,renderer)
        reference.paste(im,(i*260+(260-w)//2,20+(288-h)//2),im)
    reference.save(ROOT/'preview-reference.png')
    report['checks']=['all contract names and sizes','PNG reopened and source pixels matched','2px transparent padding','portrait windows transparent','six distinct walk poses per enemy','traits.json unchanged']
    (ROOT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'PASS: {len(jobs)} frames; face anchors and contact sheets written; traits.json unchanged.',flush=True)



# Batch 3B: additive masters. Batch 1/2 helpers above remain import-compatible.
import base64
import os
import tempfile
import copy
import xml.etree.ElementTree as ET

B3 = {}
NEW_COSTUMES = {}
LEGEND_COLORS = {
    '561': ('#f69617', '#b22b22', GOLD), '900': (CREAM, '#bb3524', ORANGE),
    '942': ('#292334', '#d65660', '#ebc58b'), '1002': ('#706091', '#b6d39d', '#fa7d9c'),
    '1481': ('#91ba2c', '#416c39', '#cbed67'), '1514': ('#252529', '#f4f2e9', '#a7a7ad'),
    '1667': (CREAM, '#cbb889', '#fff9d3'), '1798': ('#fbc62d', '#714380', '#ffeda0'),
    '1881': ('#ffc727', '#ce710d', '#fff5af'), '1884': ('#e54b55', '#9a2538', '#ff945d')}
CREW_COLORS = {'ghosts': CREAM, 'witches': VIOLET, 'pumpkins': ORANGE, 'bats': '#e66d83'}


def atomic_output(target, data):
    """Publish one complete file; readers never see partially written JSON/PNG."""
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.'+target.name+'.', suffix='.tmp', dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            if isinstance(data, Image.Image):
                data.save(stream, format='PNG', optimize=True)
            else:
                stream.write(data.encode() if isinstance(data, str) else data)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def add3(atlas, name, w, h, art, grain=True):
    assert name not in B3.setdefault(atlas, {}), (atlas, name)
    target = ROOT/'svg/batch3b'/atlas/(name+'.svg')
    atomic_output(target, svg(w, h, art, name, grain=grain))
    B3[atlas][name] = (w, h, target)


def flame3(x, y, s=1, color=ORANGE):
    a = path('M0 23Q-28 12-17-8L-8 0Q-13-24 6-35 2-10 17-17 15-3 25 6 26 23 0 23Z',color,INK,2)
    a += path('M0 20Q-12 9-3-4L3 3 9-8Q21 15 0 20Z',GOLD,'none',0)
    a += path('M0 17Q-4 10 3 4L8 13Z',CREAM,'none',0)
    return group(a,f'translate({x} {y}) scale({s})')


def bone3(x, y, s=1, r=0):
    a=path('M-15-5Q-26-14-26-5-30 5-19 6L17 6Q29 15 29 4 30-6 19-5Z',CREAM,INK,2)
    a+=line('M-14-1 16-1',PAPER,2)
    return group(a,f'translate({x} {y}) rotate({r}) scale({s})')


def frog3(x,y,s=1,gold=False):
    col=GOLD if gold else '#99c337'
    a=ellipse(0,5,18,14,col,INK,2)+circle(-11,-8,8,col,INK,2)+circle(11,-8,8,col,INK,2)
    a+=circle(-11,-9,3,CREAM,INK,1)+circle(11,-9,3,CREAM,INK,1)+line('M-9 8Q0 15 10 7',INK,2)
    a+=path('M-12 14-23 20-8 21M12 14 23 20 8 21',col,INK,2)
    return group(a,f'translate({x} {y}) scale({s})')


def shield3(x,y,s=1):
    a=path('M-19-23Q0-14 19-23L17 7Q12 22 0 28-15 17-18 6Z',GOLD,INK,2.5)
    a+=path('M-13-15 0-12 13-16 12 7 0 19-12 6Z',PURPLE,INK,1.5)+star(0,0,9,CREAM,4,1)
    a+=line('M-14-10-13 3',CREAM,2)
    return group(a,f'translate({x} {y}) scale({s})')


def spear3(x,y,s=1,r=0):
    a=line('M-41 0 22 0',INK,6)+line('M-40-1 22-1',GOLD,3)
    a+=path('M16-7 40 0 16 8 20 0Z',CREAM,INK,2)+line('M-31-3-28 4M-25-3-22 4',RUST,1.5)
    return group(a,f'translate({x} {y}) rotate({r}) scale({s})')


def bat3(x,y,s=1,phase=0):
    lift=[-13,-4,10,1][phase%4]
    a=path(f'M-5 0Q-20 {lift-12}-36 {lift}L-30 {lift+15}Q-23 {lift+6}-18 16-10 8-4 17M5 0Q20 {lift-12} 36 {lift}L30 {lift+15}Q23 {lift+6} 18 16 10 8 4 17',PINK,INK,2)
    a+=path('M-10 2-10-14-2-7 6-15 10 2Q16 22 0 25-15 20-10 2Z',VIOLET,INK,2)
    a+=circle(-3,5,2,CREAM,'none',0)+circle(5,5,2,CREAM,'none',0)+path('M-3 12 0 17 3 12',CREAM,INK,1)
    return group(a,f'translate({x} {y}) scale({s})')


def brain3(x,y,s=1):
    a=path('M-23 8Q-32-4-20-10-23-22-9-22-3-30 8-22 23-24 25-9 36-1 24 10 13 22 1 15-13 24-23 8Z',PINK,INK,2)
    a+=line('M1-20Q-6-9 2-2-4 4 1 13M-18-11Q-4-13-12-1M8-15Q22-15 17-5L10-3M-22 4Q-9-1-9 12M9 6Q22 2 22 9',RUST,2)
    return group(a,f'translate({x} {y}) scale({s})')


def legend_parts(token, spec):
    atlas='hero-'+spec['costume'];col,shade,accent=LEGEND_COLORS[token]
    config=copy.deepcopy(json.loads((OUT/'atlas/rig.json').read_text())['costumes']['pitch-deck'])
    config['attack']=spec['attack'];config['weaponBehind']=token in ('900','1798','1884')
    torso=path('M16 6Q25 2 34 7L44 22 45 43Q25 55 4 43L5 22Z',col,INK,2.4)
    torso+=path('M34 10Q39 29 30 47L44 42 43 24Z',shade,'none',0,'opacity=".65"')
    extra=''
    if token=='561':
        torso+=line('M11 16 18 26 13 37M34 20 27 33 32 43',GOLD,2)+flame3(25,30,.28)
        torso+=path('M7 8 24 14 42 7 39 18 25 24 9 17Z','#b22b22',INK,2)+circle(25,17,4,GOLD,INK,1)
        extra=path('M43 8Q27 13 20 32L3 55 25 50 38 61 56 47 50 9Z','#b22b22',INK,2.4)+line('M43 15Q35 38 16 50',ORANGE,2)
    elif token=='900':
        torso=path('M14 7 35 7 39 43 25 50 8 43Z','#281c23',INK,2.4)
        torso+=line('M24 11 24 45',CREAM,3)
        for y in (15,24,33):torso+=path(f'M22 {y}Q5 {y-7} 10 {y+4}L21 {y+7}M27 {y}Q42 {y-7} 38 {y+4}L27 {y+7}',CREAM,INK,1)
        torso+=path('M12 43 23 40 37 43 35 50 25 47 15 50Z',CREAM,INK,1.5)
        extra=flame3(25,34,.75)+flame3(48,29,.54)
    elif token=='942':
        torso=path('M14 6 33 7 41 28 48 51 29 49 19 55 3 49 8 29Z',col,INK,2.4)
        torso+=line('M18 14Q7 28 17 46M25 18Q35 29 24 47M34 22 39 43',shade,2)
        torso+=path('M11 8 24 13 37 7 34 16 25 20 13 17Z','#514256',INK,1.5)
        extra=line('M40 9Q7 10 9 32 15 56 42 52M43 17Q19 14 20 31 18 42 40 43',shade,3)
    elif token=='1002':
        torso=path('M15 7 34 7 44 21 42 34 46 42 35 40 30 51 21 45 12 52 4 42 7 22Z',col,INK,2.4)
        torso+=path('M17 8 26 19 34 8 29 35 16 33Z',shade,INK,1.5)+path('M5 38 18 37 20 48 10 49Z',RUST,INK,1.5)
        torso+=line('M9 39 11 44M14 39 16 44M30 21 38 26M31 26 39 31',PINK,1.5)+circle(11,26,3,'#9a7948',INK,1)
        extra=path('M38 8 53 19 43 37 33 34 22 49 13 44 30 20Z','#403354',INK,2)+line('M25 33 37 19',PINK,1.5)
    elif token=='1481':
        torso+=ellipse(25,31,15,18,'#dbe97b',INK,1.6)+path('M7 9 14 4 24 13 33 4 42 10 35 19 25 16 16 20Z',shade,INK,1.5)
        for x,y in ((8,24),(39,27),(12,40),(35,42)):torso+=circle(x,y,2,shade,'none',0)
        torso+=line('M24 20 24 44',shade,1.2)
        extra=path('M43 12Q22 8 14 24L4 48 18 41 31 53 47 38Z',shade,INK,2)+frog3(29,29,.5)
    elif token=='1514':
        torso+=path('M8 10 20 15 37 6 42 16 26 25 10 21Z','#111116',INK,1.5)+line('M9 42 40 38',CREAM,3)
        for n in range(7):torso+=line(f'M{10+n*4} 26 {6+n*4} 37',accent,.7)
        extra=path('M43 8 18 16 4 51 22 42 30 58 52 38Z','#35343a',INK,2.5)+path('M37 14 15 38 22 40 47 19Z',CREAM,INK,1.2)
        for n in range(5):extra+=line(f'M{27+n*4} 26 {20+n*4} 42',accent,.8)
    elif token=='1667':
        torso=path('M14 6 35 7 41 31 48 51Q25 59 3 50L8 27Z',CREAM,INK,2.4)
        torso+=path('M17 7 24 18 35 8 28 34 39 51 29 54 18 37Z',shade,INK,1.5)+line('M10 37 9 46M20 41 21 48',PAPER,1.5)
        extra=path('M41 26Q18 21 6 3 0 34 11 48L17 43 22 54 28 45 36 58 47 35M45 25Q58 10 61 3 70 37 60 53L53 46 48 58 40 36Z',CREAM,INK,2)
        extra+=line('M12 20 33 41M9 29 24 43M56 21 47 41',shade,1.5)
    elif token=='1798':
        torso+=path('M6 17 13 7 24 16 34 7 43 18 35 33 25 39 13 33Z',GOLD,INK,1.6)
        torso+=path('M8 37 42 36 41 50 33 48 28 54 22 48 15 53 9 48Z',shade,INK,1.5)
        torso+=line('M18 18 25 23 33 18M25 23 25 33',CREAM,2)+star(25,29,5,ORANGE,4,1)
        extra=path('M43 8 17 19 4 55 26 50 38 60 54 45Z',shade,INK,2.4)+line('M38 16 18 46',PINK,2)
    elif token=='1881':
        torso+=path('M13 10Q24 5 33 13L28 24 12 24Z','#fff58e','none',0)+path('M11 31 28 29 23 45 9 42Z','#ffe667','none',0)
        torso+=line('M37 21 35 37', '#fffbd5',2.5)+star(13,18,4,CREAM,4,1)
        extra=path('M42 8Q20 12 12 36L3 52 25 48 38 61 52 43Z','#b67b15',INK,2)+line('M37 17 19 43',GOLD,3)
    else:
        torso+=path('M9 8 24 17 38 7 41 15 29 25 15 22Z',shade,INK,1.5)+path('M17 25 32 26 30 43 19 44Z','#f87f78','none',0)
        torso+=line('M7 43 41 42',shade,3)
        extra=line('M43 15Q24 37 16 28 4 15 4 38 5 58 29 49',INK,6)+line('M43 15Q24 37 16 28 4 15 4 38 5 58 29 49',shade,3)
        extra+=path('M24 41 37 48 26 57Z',col,INK,1.5)
    torso+=line('M8 45Q24 51 42 44',GOLD,2)+circle(25,46,2.5,CREAM,INK,.8)
    add3(atlas,'rig/torso',50,58,torso)
    for back in (True,False):
        arm='arm-back' if back else 'arm-front';leg='leg-back' if back else 'leg-front'
        skin={'561':col,'900':CREAM,'942':'#e7bc79','1002':'#b6d39d','1481':'#a8c935','1514':'#e4e4df','1667':CREAM,'1798':'#f3dac4','1881':col,'1884':'#ee626f'}[token]
        a=path('M7 3Q15 0 20 8L20 18 24 24 23 29Q14 36 6 28L4 12Q3 5 7 3Z',skin,INK,2.1)
        if token in ('942','1002','1481','1514','1667','1798'):
            a+=path('M7 3Q15 0 20 8L21 20Q14 25 5 20L3 12Z',col,INK,2)+line('M6 18 20 19',GOLD,2)
        elif token=='900':a=bone3(14,17,.48,85)+line('M5 30 20 30',GOLD,2)
        elif token=='1881':a+=line('M9 7 8 22',CREAM,2)
        else:a+=line('M6 17 20 18',GOLD,2)
        a+=line('M17 26 21 25',shade,1)
        if token=='1798' and back:a=group(a,'translate(9.24 4.8)')+shield3(15,36,.7)
        add3(atlas,'rig/'+arm,52 if token=='1798' and back else 30,64 if token=='1798' and back else 36,a)
        detail=line('M6 7Q11.4 8 16.8 7',GOLD,2)
        if token=='1514':detail+=line('M8 11 14.8 11M8 14 14.8 14',CREAM,1)
        boot=front_leg(col if token in ('561','1481','1881','1884') else shade,accent,back,detail)
        if token=='900':
            boot=group(bone3(11.4,10,.28,90)+path('M6 18Q11.4 15 17 18L19 23Q20 27 11.4 27 3 27 4 23Z',CREAM,INK,1.5)+line('M8 23 8 26M12 22 12 27M16 23 16 26',shade,1),f'rotate({4 if back else -4} 11.4 5.76)')
        add3(atlas,'rig/'+leg,30,32,boot)
    if extra:add3(atlas,'rig/extra',72,68,extra);config['pivots']['extra']=[43/72,20/68]
    weapons={
        '561':flame3(24,36,.55),'900':line('M20 46Q52 61 46 23',INK,5)+line('M20 46Q52 61 46 23',GOLD,2)+flame3(44,18,.45),
        '1002':brain3(25,40,.6),'1514':path('M18 51 23 25 36 7 45 4 42 17 29 30 23 53Z',CREAM,INK,2)+line('M25 29 37 14',INK,3),
        '1667':line('M20 53 29 12',INK,6)+line('M20 53 29 12',GOLD,3)+star(29,13,10,CREAM,4,2),
        '1798':spear3(24,33,.68,-68),'1881':ellipse(24,40,10,12,GOLD,INK,2)+ellipse(24,40,6,8,'none',CREAM,1.5),
        '1884':line('M20 54 33 16',INK,6)+line('M20 54 33 16',VIOLET,3)+path('M22 7 22 24 33 26 43 18 47 3 39 11 39 17 35 17 36 2 28 10 30 18 27 19Z',VIOLET,INK,2)}
    if token=='900':
        weapons[token]+=''.join(ellipse(x,y,3,4,'none',GOLD,1.5) for x,y in ((24,49),(31,50),(38,47),(43,40),(46,31)))
    if token in weapons:add3(atlas,'rig/weapon',64,64,weapons[token])
    NEW_COSTUMES[spec['costume']]=config


def crew_parts(name):
    atlas='hero-crew-'+name;col=CREW_COLORS[name]
    config=copy.deepcopy(json.loads((OUT/'atlas/rig.json').read_text())['costumes']['pitch-deck'])
    config['attack']='cast' if name=='witches' else 'slam';config['weaponBehind']=False
    torso=path('M14 6 35 6 43 26 47 49Q25 58 3 49L7 25Z',col,INK,2.4)
    torso+=path('M34 11 40 28 41 47 32 50 33 30Z',PURPLE,'none',0,'opacity=".22"')
    if name=='ghosts':
        torso=path('M14 6 35 7 43 31 48 52 38 47 32 55 24 49 16 54 9 47 2 51 7 26Z',CREAM,INK,2.4)
        torso+=ellipse(17,26,3,5,PURPLE,'none',0)+ellipse(31,26,3,5,PURPLE,'none',0)+ellipse(25,38,3,5,PURPLE,'none',0)
        extra=path('M43 9Q20 8 14 27L3 52 16 46 23 56 32 46 45 52 54 21Z',PAPER,INK,2)
    elif name=='witches':
        torso+=path('M15 7 24 19 34 7 30 37 37 49 17 50 18 31Z',CREAM,INK,1.5)+line('M6 37 44 36',ORANGE,5)
        torso+=path('M20 32 30 32 30 42 20 42Z',GOLD,INK,1.5)+star(11,27,4,GOLD,4,1)
        extra=path('M42 8 19 15 4 54 23 48 34 60 55 41Z',PURPLE,INK,2.2)+star(28,34,8,VIOLET,5,1)
    elif name=='pumpkins':
        torso+=line('M17 12Q8 28 18 47M32 12Q42 28 32 47',RUST,2)
        torso+=path('M11 25 18 18 21 28ZM29 28 32 18 39 25ZM15 35 21 38 25 34 29 39 36 34 32 45 19 43Z',PURPLE,INK,1)
        extra=path('M43 10Q25 7 15 22 6 34 5 50L22 45 35 58 55 36Z',GREEN,INK,2)+line('M40 16 18 42',MINT,2)
    else:
        torso+=path('M13 6 24 15 35 6 39 15 26 28 12 19Z',PURPLE,INK,1.5)+bat3(25,34,.4)
        extra=path('M43 22Q21 13 4 3L6 33 17 28 21 44 30 38 39 58 45 33M43 23Q60 9 69 3L69 33 61 27 56 44 48 38 44 56Z',PINK,INK,2.3)+line('M43 26 12 13 24 33M46 26 64 14 57 33',PURPLE,1.5)
    add3(atlas,'rig/torso',50,58,torso);add3(atlas,'rig/extra',74,66,extra)
    config['pivots']['extra']=[43/74,20/66]
    for part in ('arm-back','arm-front'):
        hand=path('M8 15Q4 22 6 29 10 35 18 32L24 28 23 23 19 20 18 16Z','#fafafa','#151515',2.1)+line('M17 25 21 24','#929292',1)
        sleeve=path('M7 3Q16 0 20 8L23 22 16 26 3 22 3 12Z',col,INK,2.1)+line('M5 20 21 21',GOLD,2)
        add3(atlas,'rig/'+part+'-skin',30,36,hand);add3(atlas,'rig/'+part,30,36,sleeve)
    for part in ('leg-back','leg-front'):
        boot=front_leg(PURPLE,LILAC,part=='leg-back',line('M6 8Q11.4 9 16.8 8',col,3))
        add3(atlas,'rig/'+part,30,32,boot)
    NEW_COSTUMES['crew-'+name]=config


def rings3(x,y,i,color,vertical=False):
    a=''
    for n in range(3):
        r=10+i*4+n*10
        a+=ellipse(x+n*13,y,r*.34 if vertical else r,r if vertical else r*.36,'none',color,3-n*.6, f'opacity="{.9-n*.2}"')
    return a


def sparks3(w,h,i,color=GOLD):
    a=''
    for n in range(7):
        angle=(n/7*math.tau)+i*.17;r=(12+i*7)*(1+(n%3)*.18)
        x=w/2+math.cos(angle)*r;y=h/2+math.sin(angle)*r*.65
        a+=star(x,y,max(2,7-i*.7),color,4,1)
    return a


def legend_effects(token):
    atlas='hero-legend-'+token;col,shade,accent=LEGEND_COLORS[token]
    if token=='561':proj=flame3(69,34,.85)+line('M10 21 36 25M3 41 33 39',GOLD,3)
    elif token=='900':proj=line('M5 34Q35 14 77 31',INK,7)+line('M5 34Q35 14 77 31',GOLD,3)+flame3(77,34,.5)
    elif token=='942':proj=rings3(34,32,0,'#e6bb81',True)+line('M8 26 18 24M7 41 18 43',PINK,2)
    elif token=='1002':proj=brain3(62,32,.75)+line('M5 25 30 27M17 42 37 39',PINK,3)
    elif token=='1481':proj=path('M3 34Q42 37 66 23 90 9 88 30 85 45 72 36L77 30Q79 36 83 29 87 16 69 29 40 45 3 43Z',PINK,INK,2)+line('M7 38 45 35',CREAM,1.5)
    elif token=='1514':proj=path('M4 49 84 8 60 29 93 18 48 48 67 29 13 53Z',CREAM,INK,2)+line('M9 45 62 18M21 51 79 28',INK,1)
    elif token=='1667':proj=path('M3 29 59 27 68 12 92 32 65 51 58 36 4 36Z',GOLD,INK,2)+path('M26 31 68 27 83 32 67 36Z',CREAM,'none',0)
    elif token=='1798':proj=spear3(47,32,1.05)+line('M6 19 27 19M5 46 26 46',GOLD,2)
    elif token=='1881':proj=ellipse(67,32,15,19,GOLD,INK,2)+ellipse(67,32,10,14,'none',CREAM,2)+star(67,32,7,ORANGE,4,1)+line('M5 25 34 26M12 41 40 39',GOLD,3)
    else:proj=''.join(group(flame3(67,32,.4),f'translate(0 {dy})')+line(f'M8 {32+dy} 49 {32+dy}',GOLD,2) for dy in (-18,0,18))
    add3(atlas,'wpn/proj',96,64,proj)
    for i in range(4):
        a=sparks3(96,96,i,accent)
        if token in ('561','900','1884'):a+=flame3(48,54,.6+i*.04,col if token!='900' else ORANGE)
        elif token=='1002':a+=brain3(48,52,.48*(1-i*.1))
        elif token=='1481':a+=path(f'M18 {60+i*3}Q48 {10+i*7} 79 {60+i*3}', 'none',PINK,7-i)
        elif token=='1514':a+=path(f'M{11+i*4} 78 81 {12+i*3} 58 51 87 25 33 75Z',CREAM,INK,2)
        elif token=='1798':a+=shield3(48,48,.6-i*.07)
        elif token=='942':a+=rings3(38,48,i,accent,True)
        else:a+=star(48,48,23+i*4,accent,4,2)
        add3(atlas,f'wpn/hit/{i}',96,96,group(a,extra=f'opacity="{1-i*.17}"'))
    for slot,count,w,h in [('special',6,192,128),('ultimate',8,256,192)]:
        for i in range(count):
            u=i/(count-1);cx=w/2;cy=h*.57;big=slot=='ultimate';a=''
            if token=='561':
                a+=path(f'M12 {h*.75}Q{cx} {h*.65} {w-12} {h*.75}L{w-24} {h*.92}Q{cx} {h*.83} 24 {h*.92}Z',RUST,'none',0,'opacity=".45"') if big else ellipse(cx,h*.78,w*.4,h*.13,'none',RUST,6)
                for n in range(7 if big else 6):
                    x=19+n*(w-38)/(6 if big else 5);y=cy+math.sin(n+i)*7
                    a+=flame3(x,y,(.55+math.sin(math.pi*u)*.5)*(1.25 if big else .8),ORANGE)
                a+=line(f'M12 {h*.82}Q{cx} {h*.63} {w-12} {h*.82}',GOLD,3)
            elif token=='900':
                if big:
                    for n in range(4):a+=flame3(37+n*48,116+math.sin(i+n)*8,1.1-n*.13,ORANGE)
                    a+=path('M35 112 75 86 119 101 153 62 212 83 181 113 209 130 155 141 97 122 24 139Z',PURPLE,INK,3)
                    a+=bone3(166,107,.95,-20)+line('M24 152 215 142',GOLD,4)
                    a+=circle(183,88,18,CREAM,INK,2)+ellipse(177,87,4,6,DARK,'none',0)+ellipse(190,87,4,6,DARK,'none',0)+path('M179 100 180 107 188 107 191 99',CREAM,INK,2)
                else:
                    a+=ellipse(cx,cy,68,39,'none',ORANGE,3)
                    for n in range(5):
                        ang=n*math.tau/5+i*.22;a+=bone3(cx+60*math.cos(ang),cy+34*math.sin(ang),.48,math.degrees(ang)+90)
            elif token=='942':
                if big:
                    for n in range(4):
                        offset=n*12+i*2;a+=path(f'M{18+offset} 15Q{cx-30} {cy} {18+offset} {h-14}M{w-18-offset} 15Q{cx+30} {cy} {w-18-offset} {h-14}','none', [shade,accent,VIOLET,PINK][n],4)
                    a+=ellipse(cx,cy,22+u*12,42,'none',accent,6)
                else:
                    a+=path('M17 64 168 10Q119 64 169 119Z',shade,'none',0,'opacity=".18"')
                    for n in range(3):a+=path(f'M{49+n*36+i*2} {47-n*14}Q{85+n*35} 64 {49+n*36+i*2} {81+n*14}','none',accent,4-n*.5)
            elif token=='1002':
                for n in range(5 if big else 2):
                    x=(n+1)*w/(6 if big else 3);y=cy+math.sin(n)*12
                    a+=ellipse(x,y+31,22,7,shade,INK,2)
                    a+=group(path('M-17 29-16 3-8-10-1-6 5-17 12-10 12 13 20 5 25 10 15 30Z','#b6d39d',INK,2)+line('M-8 0-6 18M3-4 3 15',GREEN,1.5),f'translate({x} {y+14-u*24})')
                    a+=star(x-18,y-16-u*12,5,PINK,4,1)
            elif token=='1481':
                if big:
                    for n in range(6):
                        x=25+n*40;y=40+((n*31+i*16)%104);a+=line(f'M{x} {y-25} {x} {y-8}',CREAM,2)+frog3(x,y,.57,True)
                    a+=ellipse(cx,169,103,9,'none',GOLD,3)
                else:
                    a+=ellipse(cx,86,76,26,'#b4c2e2',INK,2,'opacity=".45"')
                    for n in range(5):
                        x=29+n*33;y=28+(n*13+i*7)%42
                        a+=path(f'M{x} {y}Q{x-14} {y+23} {x} {y+25}Q{x+12} {y+22} {x} {y}Z','#8ebbc5',INK,1.5)
                    a+=frog3(cx,74,.75)
            elif token=='1514':
                if big:
                    a+=path('M13 17 245 9 237 177 10 182Z',CREAM,INK,5)
                    for n in range(12):
                        x=20+n*19;a+=line(f'M{x} 20 {cx+(x-cx)*.45} 63M{x} 172 {cx+(x-cx)*.45} 124',INK,1.7)
                    a+=path(f'M20 {151-i*2} 236 35 169 99 231 77 55 162 88 123Z',INK,'none',0)
                    a+=line('M41 151 217 47',CREAM,3)
                else:
                    for n in range(8):a+=line(f'M{9+n%3*9} {15+n*13} {174-n%3*17} {8+n*13}',CREAM,2+(n%2))
                    a+=path('M38 109 177 18 127 69 178 42 88 106Z',CREAM,INK,2)
            elif token=='1667':
                if big:
                    for n in range(4):
                        x=38+n*61;a+=path(f'M{x-12} 10 {x+9} 10 {x+24} 161 {x-27} 161Z',accent,'none',0,'opacity=".38"')
                        a+=line(f'M{x} 16 {x} 158',CREAM,5)+ellipse(x,161,25,8,'none',GOLD,3)+star(x,64+i%3*10,12,GOLD,4,1)
                else:
                    a+=ellipse(cx,44-u*14,63,20,'none',GOLD,7)+ellipse(cx,44-u*14,55,15,'none',CREAM,2)
                    for n in range(3):a+=star(49+n*48,92+(n%2)*10-i*4,9,accent,4,1)
            elif token=='1798':
                if big:
                    for n in range(6):
                        x=35+n*36;y=38+(n*23+i*17)%115;a+=spear3(x,y,.6,70)
                    a+=ellipse(cx,170,100,8,'none',GOLD,3)
                else:
                    for n in range(4):a+=shield3(38+n*40,69-(i%3)*2,.85)
                    a+=line('M20 108 172 108',CREAM,3)
            elif token=='1881':
                if big:
                    for n in range(9):
                        x=24+n*25;y=23+(n*29+i*19)%128
                        a+=line(f'M{x} {y-13} {x} {y-5}',CREAM,2)+ellipse(x,y,8,11,GOLD,INK,1.5)+star(x,y,4,CREAM,4,.6)
                    a+=ellipse(cx,170,106,8,'none',GOLD,3)
                else:
                    a+=path('M71 93 74 48 62 35 68 20 83 29 106 21 124 36 117 53 122 94Z',GOLD,INK,2.5)
                    a+=line('M81 44 81 82M98 30 101 47',CREAM,3)+sparks3(w,h,i,GOLD)
            else:
                if big:
                    a+=ellipse(cx,143,103,28,'none',RUST,8)+ellipse(cx,143,88,20,'none',GOLD,2)
                    a+=star(cx,120,67,PURPLE,5,3)+flame3(cx,90,1.15,RUST)
                    for x in (45,209):a+=flame3(x,128,.6)
                    a+=path('M30 40 69 47 64 69 31 63Z',CREAM,INK,2)+line('M37 47 62 52M36 55 54 58',RUST,2)
                else:
                    for n in range(3):
                        x=38+n*57;y=43+(n%2)*24+math.sin(i+n)*6
                        a+=group(bat3(0,0,1,i).replace(VIOLET,'#e54b55').replace(PINK,'#9a2538')+path('M-9-10-12-23-2-13M4-13 12-24 10-9',CREAM,INK,2)+line('M8 20Q24 37 32 20',RUST,3),f'translate({x} {y}) scale(.55)')+flame3(x-12,y+30,.24,RUST)
            a=group(a,f'translate({cx} {cy}) scale({.87+.1*math.sin(u*math.pi)+i*.003}) translate({-cx} {-cy})')
            add3(atlas,f'{slot}/{i}',w,h,a)
    for i in range(4):
        a=ellipse(96,190,79,17,'none',GOLD,2)+ellipse(96,190,72,12,'none',accent,3)
        for side in (-1,1):
            for n in range(4):
                x=96+side*(58+math.sin(n+i)*8);y=163-n*41
                if token in ('561','900','1884'):a+=flame3(x,y,.38+((i+n)%3)*.07,RUST if token=='1884' else ORANGE)
                elif token=='900':a+=bone3(x,y,.3,n*30)
                elif token=='1481':a+=frog3(x,y,.32,True)
                elif token=='1798':a+=shield3(x,y,.32)
                elif token=='1002':a+=brain3(x,y,.24)
                elif token=='942':a+=ellipse(x,y,7,15,'none',accent,2)
                elif token=='1514':a+=line(f'M{x} {y+15} {x-side*12} {y-12}',CREAM,3)
                else:a+=star(x,y,7+(i+n)%3,accent,4,1)
        a+=star(96,16,10,GOLD,4,1.5)
        add3(atlas,f'boss/{token}/aura/{i}',192,224,a)


def towers3():
    for kind in ('roost','cauldron','catapult','lighthouse','organ'):
        for level in range(1,4):
            a=tower_base(level)
            if kind=='roost':
                top=79-level*13
                a+=path(f'M46 {top+12} 111 {top+6} 115 165 79 177 43 164Z','#754650',INK,3)
                a+=path(f'M49 {top+23} 81 {top+13} 82 173 46 163Z','#ab685c',INK,2)
                a+=line(f'M52 {top+42} 79 {top+49} 110 {top+38}M53 126 110 115M52 150 111 140',RUST,2)
                a+=path(f'M63 {top+50}Q80 {top+19} 99 {top+45}L99 137 63 144Z',DARK,INK,3)
                a+=path(f'M25 {top+22} 73 {top-15} 131 {top+15} 104 {top+24} 78 {top+5} 42 {top+32}Z',VIOLET,INK,3)
                a+=line(f'M39 {top+21} 76 {top-7} 117 {top+14}',LILAC,2)
                a+=bat3(81,top+64,.5,0)
                a+=line('M33 147 125 132',INK,7)+line('M33 146 125 131',GOLD,3)
                if level>=2:
                    a+=path('M26 128 26 96 39 79 48 94 47 132Z',PURPLE,INK,3)+bat3(34,99,.32,2)
                    a+=path('M117 127 115 81 128 67 138 82 138 132Z',PURPLE,INK,3)+bat3(128,88,.28,1)
                if level==3:
                    a+=path('M70 34 69 15 79 5 89 16 87 38Z',DARK,INK,2)+circle(79,22,7,GOLD,INK,2)+line('M79 17 79 23 83 25',INK,1.5)
                    a+=bat3(25,52,.4,0)+bat3(131,44,.38,2)
            elif kind=='cauldron':
                a+=path('M46 166 38 184 49 185 61 169M103 165 111 184 122 180 115 160',PURPLE,INK,3)
                for x in (57,79,101):a+=flame3(x,169,.5)
                a+=path('M31 105Q22 163 60 175 113 188 134 143L129 103Z',PURPLE,INK,3)
                a+=path('M35 119Q39 156 61 163L65 116Z','#65507a','none',0)+line('M38 126 42 141',LILAC,3)
                a+=ellipse(80,105,55,21,VIOLET,INK,3)+ellipse(80,104,44,14,MINT,INK,2)
                a+=path('M51 105Q65 88 74 106 89 95 99 103L101 122Q96 132 91 121L90 111Q76 124 70 110L65 133Q56 143 53 131Z',MINT,INK,2)
                a+=line('M122 118Q151 110 143 139L132 145M34 119Q12 112 17 137L29 144',INK,5)
                a+=line('M87 107 112 62',INK,8)+line('M87 107 112 62',RUST,4)
                for n in range(level+1):a+=circle(53+n*23,84-n*10,6+n*2,MINT,INK,2)
                a+=star(84,150,12,GOLD,5,2)
                if level>=2:a+=path('M32 100 20 81 26 69 41 74 43 95Z',VIOLET,INK,2)+star(31,83,5,CREAM,4,1)
                if level==3:
                    a+=path('M47 63 58 53 69 24 78 41 101 38 88 53 113 63Q79 79 47 63Z',PURPLE,INK,3)+line('M61 58 88 55',GOLD,4)
                    a+=circle(43,44,7,MINT,INK,2)+circle(116,34,4,MINT,INK,1.5)
            elif kind=='catapult':
                a+=path('M24 149 57 125 139 145 110 165Z',RUST,INK,3)+path('M28 144 108 160 106 176 27 160Z','#c68a59',INK,3)
                a+=path('M39 147 59 72 73 69 100 153 86 151 66 101 53 151Z',RUST,INK,3)
                a+=path('M65 92 86 78 119 153 105 157Z','#dca468',INK,3)
                a+=line('M36 135 120 123',INK,7)+line('M36 135 120 123',GOLD,3)
                for x,y in ((39,171),(116,172)):
                    a+=circle(x,y,18,PURPLE,INK,3)+circle(x,y,11,'#bd8962',INK,2)+line(f'M{x-8} {y} {x+8} {y}M{x} {y-8} {x} {y+8}',GOLD,2)
                a+=line('M49 119 109 45',INK,13)+line('M49 119 109 45',GOLD,8)+line('M51 116 108 48',CREAM,2)
                a+=path('M94 44Q111 66 133 44L125 30 102 29Z',PURPLE,INK,3)
                a+=corn3(113,34,.85)
                a+=circle(64,101,11,GOLD,INK,3)+circle(64,101,4,ORANGE,INK,1)
                if level>=2:a+=corn3(30,129,.53)+corn3(126,131,.55)
                if level==3:
                    a+=path('M19 136 19 70 33 65 33 133Z',PURPLE,INK,2.5)+path('M29 71 63 60 51 80 62 95 30 97Z',ORANGE,INK,2)+star(43,79,8,GOLD,5,1.5)
                    a+=line('M87 72 114 95',GOLD,4)
            elif kind=='lighthouse':
                top=70-level*10
                a+=path(f'M61 {top+43} 99 {top+42} 113 164 82 177 49 165Z',CREAM,INK,3)
                a+=path(f'M85 {top+43} 99 {top+42} 113 164 82 177Z','#b7c9c5',INK,2)
                a+=path('M56 119 104 101 106 123 53 140Z',MINT,INK,2)
                a+=path('M72 167 72 144Q80 134 88 144L89 167Z',PURPLE,INK,2)
                a+=path(f'M46 {top+14} 80 {top+3} 114 {top+15} 112 {top+53} 81 {top+66} 47 {top+53}Z',VIOLET,INK,3)
                a+=path(f'M52 {top+21} 78 {top+29} 106 {top+20} 105 {top+47} 79 {top+56} 53 {top+46}Z',MINT,INK,2)
                a+=ellipse(79,top+35,14,20,CREAM,INK,2)+ellipse(74,top+32,2,4,PURPLE,'none',0)+ellipse(85,top+32,2,4,PURPLE,'none',0)
                a+=path(f'M39 {top+14} 79 {top-15} 122 {top+13} 81 {top+24}Z',PURPLE,INK,3)+line(f'M52 {top+13} 79 {top-6} 109 {top+13}',LILAC,2)
                a+=line(f'M44 {top+53} 81 {top+65} 117 {top+53}',GOLD,4)
                if level>=2:a+=path('M39 159 33 123 44 111 48 160M113 161 116 110 127 121 124 162',VIOLET,INK,3)
                if level==3:a+=star(80,18,12,MINT,4,2)+line('M16 68 33 64M126 59 147 51M131 86 148 88',MINT,4)
            else:
                a+=path('M30 141 126 129 132 172 82 184 29 170Z','#603c57',INK,3)
                a+=path('M35 143 82 157 124 143 125 162 82 176 34 162Z',GOLD,INK,2)
                for n in range(7):
                    x=38+n*12;top=75-abs(3-n)*-10-level*11
                    a+=path(f'M{x} 139 {x} {top+8}Q{x+4} {top-2} {x+8} {top+8}L{x+8} 142Z','#a397b4',INK,2.2)
                    a+=ellipse(x+4,top+10,3,6,DARK,INK,1)+line(f'M{x+2} {top+23} {x+2} 123',CREAM,1.4)
                    a+=line(f'M{x} {top+24} {x+8} {top+24}',GOLD,2)
                a+=path('M32 138 82 150 129 136 124 153 82 168 32 153Z',CREAM,INK,2.5)
                for n in range(9):
                    x=38+n*9;y=141+(x-38)*.16 if n<5 else 149-(x-78)*.3
                    a+=line(f'M{x} {y} {x-2} {y+13}',INK,1.3)
                    if n%3!=1:a+=line(f'M{x+3} {y+1} {x+2} {y+7}',INK,3)
                a+=path('M24 137 23 93 33 86 37 132M128 131 129 88 139 96 138 141',PURPLE,INK,3)
                if level>=2:a+=star(80,51,10,GOLD,5,2)
                if level==3:a+=path('M19 94 14 60 28 46 41 59 39 94M120 91 117 58 131 43 146 60 144 96',VIOLET,INK,3)+circle(27,67,6,MINT,INK,2)+circle(131,66,6,MINT,INK,2)
            add3('towers3',f'tower/{kind}/{level}',160,200,a)
    for i in range(4):add3('towers3',f'unit/bat/{i}',80,64,bat3(40,29,1,i))
    add3('towers3','proj/potion',56,64,potion3(28,34,.8))
    add3('towers3','proj/candycorn',72,80,corn3(36,40,1.2))
    for kind in ('potion','candycorn','soundwave'):
        for i in range(6):
            a=''
            if kind=='potion':
                a=ellipse(64,89,19+i*7,9+i*2,MINT,INK,2,f'opacity="{1-i*.1}"')
                for n in range(6):
                    x=64+math.cos(n*math.tau/6)*i*9;y=60+math.sin(n*math.tau/6)*i*6
                    a+=circle(x,y,8-i*.65,MINT,INK,1.5)
                a+=star(65,49-i*2,15-i,MINT,4,1.5)
            elif kind=='candycorn':
                a=ellipse(64,91,24+i*6,8+i*2,'none',GOLD,5-i*.4)
                for n in range(5):
                    ang=n*math.tau/5;a+=group(corn3(0,0,.29),f'translate({64+math.cos(ang)*(18+i*7)} {66+math.sin(ang)*(20+i*5)}) rotate({n*50+i*19})')
            else:
                a=rings3(42+i*3,64,i*.7,LILAC,True)
                a+=group(path('M0 10 0-12 16-16 16 7M0-12 16-16',PURPLE,INK,2)+ellipse(-4,10,6,4,GOLD,INK,1)+ellipse(12,8,6,4,GOLD,INK,1),f'translate({41+i*7} {35-i*2})')
            add3('towers3',f'fx/{kind}/{i}',128,128,a)
    beam=path('M4 94 503 6 503 186 4 98Z',MINT,'none',0,'opacity=".18"')+path('M4 95 503 43 503 149 4 97Z',CREAM,'none',0,'opacity=".25"')+line('M6 96 502 96',CREAM,3)
    add3('towers3','fx/lighthouse-beam',512,192,beam,grain=False)


def corn3(x,y,s=1):
    a=path('M-24 24Q-18-2-4-29 1-37 6-28L27 23Q26 30-24 24Z',GOLD,INK,2.5)
    a+=path('M-18 8 18 7 25 22Q5 27-23 21Z',ORANGE,INK,1.3)+path('M-8-20-3-30Q1-35 5-28L10-18Z',CREAM,INK,1.2)+line('M-13 1-8-10',CREAM,2)
    return group(a,f'translate({x} {y}) scale({s})')


def potion3(x,y,s=1,holy=False):
    a=path('M-8-26 8-26 8-12Q26-4 23 15 12 31-12 26-29 16-21-2L-8-13Z',CREAM if holy else '#a4cabc',INK,2.5)
    a+=path('M-19 3Q0-4 20 3L21 16Q3 30-17 18Z','#91cee1' if holy else MINT,INK,1.5)
    a+=path('M-10-29 10-29 10-21-10-21Z',GOLD,INK,2)+line('M-14-4-17 5',CREAM,3)
    if holy:a+=path('M-3-1 4-1 4 6 11 6 11 12 4 12 4 20-3 20-3 12-10 12-10 6-3 6Z',GOLD,INK,1.5)
    else:a+=star(0,12,10,VIOLET,5,1.5)
    return group(a,f'translate({x} {y}) scale({s})')


def item3(name,x,y,s=1):
    if name=='pumpkin-bomb':a=pumpkin(0,4,.83)+line('M2-20Q23-40 30-24',INK,4)+star(30,-25,7,GOLD,6,1)
    elif name=='holy-water':a=potion3(0,0,.94,True)
    elif name=='garlic':
        a=path('M-3-29 5-30 6-11Q31 4 23 22 11 34-9 26-28 33-29 13-31 2-8-11Z',CREAM,INK,2.5)
        a+=line('M-4-10Q-17 8-8 26M4-10Q17 6 10 28M-2-24 5-24',PAPER,2)+path('M-7-22-13-36 1-29 11-37 7-20Z',GREEN,INK,1.5)
    elif name=='candy-cane':
        a=path('M-24 27-4-17Q9-40 27-23 41-8 25 6L17-2Q25-11 17-15 11-19 6-9L-12 32Z',CREAM,INK,2.5)
        a+=path('M-22 22-16 9-5 15-11 29ZM-11-1-5-13 6-9 1 3ZM5-26Q14-30 21-26L15-15 8-14ZM29-19Q36-8 28 2L19-3 23-10Z',RUST,INK,1)
    else:
        a=line('M0 1 0 34M-25-4 26 2',INK,6)+line('M0 1 0 34M-25-4 26 2',GOLD,3)
        a+=path('M-15-9 13-8 27 4 17 9 12 1 15 27 4 20-5 29-16 22-13 0-22 8-28 1Z',VIOLET,INK,2)
        a+=pumpkin(0,-21,.45)+path('M-18-32 16-30 7-45-6-42-10-33Z',RUST,INK,2)+line('M-20-30 20-28',GOLD,3)
        a+=path('M-5 6 6 7 5 17-6 16Z',ORANGE,INK,1)+line('M-3 8 3 14M3 9-3 14',CREAM,1)
    return group(a,f'translate({x} {y}) scale({s})')


def items3():
    for name in ('pumpkin-bomb','holy-water','garlic','candy-cane','scarecrow'):
        add3('items','item/'+name,96,96,item3(name,48,53,.91))
        if name=='candy-cane':
            world=group(item3(name,0,0,1.5),'translate(80 44) rotate(56)')
            add3('items',f'item/{name}/world',160,96,world)
        else:
            add3('items',f'item/{name}/world',96,128 if name=='scarecrow' else 96,item3(name,48,72 if name=='scarecrow' else 52,1.25 if name=='scarecrow' else 1))
        for i in range(6):
            if name=='pumpkin-bomb':
                a=burst(64,65,20+i*7,ORANGE,2,i*12)+sparks3(128,128,i,GOLD)+flame3(64,65,.65-i*.045)
            elif name=='holy-water':
                a=ellipse(64,88,20+i*6,7+i*2,'none','#92d9e4',4)
                for n in range(6):
                    ang=n*math.tau/6;x=64+math.cos(ang)*(13+i*7);y=60+math.sin(ang)*(15+i*6)
                    a+=path(f'M{x} {y-12}Q{x-12} {y+7} {x} {y+9}Q{x+11} {y+6} {x} {y-12}Z','#92d9e4',INK,1.5)
                a+=star(64,58-i*2,17,CREAM,4,1)
            elif name=='garlic':
                a=''
                for n in range(7):
                    x=64+math.cos(n*math.tau/7)*(25+i*2);y=64+math.sin(n*math.tau/7)*25
                    a+=circle(x,y,19+(i+n)%3, '#dbe9a9',INK,1.5,'opacity=".55"')
                a+=line(f'M45 {78-i}Q33 {63-i} 47 {51-i}M77 {75-i}Q92 {64-i} 79 {49-i}',GREEN,3)
            elif name=='candy-cane':
                a=ellipse(64,84,30+i*4,8+i,'none',RUST,3)+sparks3(128,128,i,CREAM)
                a+=path('M52 40 74 40 74 73 52 73Z',GOLD,INK,2)+line('M57 45 69 68M69 45 57 68',RUST,3)
            else:
                a=ellipse(64,85,28+i*5,10+i,'none',VIOLET,3)+rings3(52,48,i*.5,GOLD,True)
                a+=star(64,44,10+i%3,GOLD,4,1)
            add3('items',f'item/{name}/fx/{i}',128,128,group(a,extra=f'opacity="{1-i*.075}"'))


def embed_svg3(source,x,y,w,h):
    encoded=base64.b64encode(Path(source).read_bytes()).decode()
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/svg+xml;base64,{encoded}"/>'


def boss3():
    sources={state:ROOT.parent/'boss'/f'great-pumpkin-{state}.svg' for state in ('idle','angry','hit','down')}
    def face(state,x=192,y=357,sx=1,sy=1,r=0,scale=1):
        return group(embed_svg3(sources[state],-154,-276,308,308),f'translate({x} {y}) rotate({r}) scale({sx*scale} {sy*scale})')
    for state,count in (('walk',6),('roll',6),('summon',4),('split',6),('hurt',1),('die',8)):
        for i in range(count):
            a=ellipse(192,358,129,15,DARK,'none',0,'opacity=".26"')
            if state=='walk':
                sx=[1.1,1.14,.94,.91,.98,1.07][i];sy=[.91,.85,1.03,1.08,.98,.93][i]
                lift=[0,0,26,34,18,0][i]
                a+=face('idle',y=357-lift,sx=sx,sy=sy,r=[-3,0,3,1,-3,-4][i])
                if i in (0,1,5):a+=ellipse(192,360,137+i,12,'none',GOLD,3)
            elif state=='roll':
                a+=group(embed_svg3(sources['angry'],-145,-145,290,290),f'translate(192 {201+[4,-8,0,4,-8,0][i]}) rotate({i*60}) scale({[1.05,.95,1,1.05,.95,1][i]} {[.92,1.03,1,.92,1.03,1][i]})')
                a+=line(f'M24 {168+i*3} 65 {162+i*3}M17 {219+i*2} 53 {219+i*2}M29 280 64 291',GOLD,5)
            elif state=='summon':
                a+=ellipse(192,337,153,25,'none',VIOLET,5)+ellipse(192,337,138,19,'none',GOLD,2)
                for n in range(6):
                    x=43+n*58;a+=star(x,305-(i*22+n*13)%100,10,GOLD,4,2)
                a+=face('angry',y=357-[0,12,25,6][i],sx=[1.04,.98,.95,1.08][i],sy=[.94,1.02,1.06,.9][i])
                for x in (45,338):a+=pumpkin(x,331-i*4,.66)
            elif state=='split':
                if i<3:
                    a+=face('angry',sx=1+i*.05,sy=1-i*.065)
                    a+=line(f'M186 92 210 145 175 190 218 245 183 301 197 341',GOLD,4+i*2)
                else:
                    for n,(x,y) in enumerate(((94,346),(196,278),(292,350))):
                        a+=face('angry',x=x+(n-1)*(i-3)*13,y=y-(i-3)*6,scale=.43,sx=1+(i-3)*.025,sy=1-(i-3)*.04)
                    a+=sparks3(384,384,i+4,GOLD)
            elif state=='hurt':
                a+=face('hit',x=181,y=358,sx=1.09,sy=.9,r=-7)+star(326,96,21,GOLD,6,3)
            else:
                if i<2:
                    a+=face('hit',sx=1.04+i*.09,sy=.96-i*.09)
                    a+=line('M185 89 201 151 174 201 218 244 181 302',CREAM,5+i*2)
                else:
                    fade=max(.15,1-(i-2)*.15)
                    for n in range(8):
                        angle=n*math.tau/8;radius=60+(i-2)*17
                        x=192+math.cos(angle)*radius;y=175+math.sin(angle)*radius*.7+(i-2)**2*3
                        shard=path('M-18-16Q0-26 25-10L8 16-11 12Z',ORANGE,INK,3)+line('M-10-13 5 9',RUST,2)
                        a+=group(shard,f'translate({x} {y}) rotate({n*37+i*21})',f'opacity="{fade}"')
                    for n in range(17):
                        angle=n*2.39996;radius=25+(i-1)*19+(n%4)*9
                        x=192+math.cos(angle)*radius;y=164+math.sin(angle)*radius*.67+(i-2)**2*3.5
                        a+=candy(x,min(361,y),.43+(n%3)*.08,n*31+i*23,[PINK,MINT,GOLD,VIOLET][n%4])
                    if i<5:a+=star(192,173,54-(i-2)*14,CREAM,8,3)
            name='boss/pumpkin/hurt' if state=='hurt' else f'boss/pumpkin/{state}/{i}'
            add3('boss',name,384,384,a,grain=False)
    add3('boss','boss/ui/bar',900,80,embed_svg3(ROOT.parent/'boss/hp-frame.svg',0,0,900,80),grain=False)
    fill='<defs><linearGradient id="health" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#ffdf87"/><stop offset=".3" stop-color="#ffae35"/><stop offset="1" stop-color="#c7511e"/></linearGradient></defs><path d="M0 0H64V22H0Z" fill="url(#health)"/><path d="M0 3H64" stroke="#fff1b2" stroke-width="2"/>'
    add3('boss','boss/ui/fill',64,22,fill,grain=False)
    a=path('M14 27 86 34 96 11 476 17 482 31 624 19 615 108 495 100 474 123 102 117 90 101 16 112Z',PURPLE,INK,5)
    a+=line('M32 39 89 46 105 25 464 30 480 44 604 34M32 96 88 85 109 104 464 111 489 86 601 94',GOLD,3)
    a+=embed_svg3(sources['angry'],24,8,116,116)+text(370,63,'THE GREAT PUMPKIN',26,CREAM,INK,2)+text(366,92,'KING OF HALLOWEEN',14,GOLD,'none',0)
    add3('boss','boss/ui/banner',640,136,a)


def cosmetics3():
    palette={PURPLE:'#754414',DARK:'#40270d',VIOLET:'#e7a82b',LILAC:'#ffe49a',CREAM:'#fff3bb',PAPER:'#ebd289',ORANGE:'#fac43b',RUST:'#b86f18',PINK:'#ffdf78',MINT:'#fff0a2',GREEN:'#bc842c',
             '#825455':'#8d601e','#aa694f':'#b68126','#d99963':'#e7b34b','#754747':'#835820','#8d5d56':'#956921','#756f96':'#a88a43','#aaa1b7':'#e7d28b','#996654':'#a87628','#d9a26f':'#ffe182','#746286':'#b38d41','#755047':'#ae7b24','#514342':'#73521b','#b49064':'#ecca6a','#a2765c':'#d6a74d','#d6a673':'#ffe19a','#b0b4c2':'#fff4c2','#756480':'#ad8637','#94839b':'#c7a052'}
    for kind in ('egg','tp','lantern','patch'):
        for level in range(1,4):
            source=ET.fromstring((ROOT/'svg'/f'tower/{kind}/{level}.svg').read_text())
            for node in source.iter():
                for attr in ('fill','stroke'):
                    value=node.get(attr)
                    if value in palette:node.set(attr,palette[value])
            artwork=ET.tostring(source,encoding='unicode')
            artwork+=star(81,183,7,CREAM,4,1.2)
            add3('skins3',f'skin/gold/tower/{kind}/{level}',160,200,artwork,grain=False)
    names=('gm','lfg','wagmi','rekt','hodl','moon','gn','ngmi')
    bubbles=['M18 28Q54 10 106 25 126 33 113 67L83 73 67 88 66 73Q19 82 12 60 5 42 18 28Z',
             'M14 12Q57 0 111 13 127 25 119 63L86 73 63 90 64 75Q9 84 6 55 2 25 14 12Z',
             'M8 23 18 10 43 14 58 3 76 13 109 7 116 22 124 39 116 62 88 70 66 90 62 74 29 78 15 67 4 51Z',
             'M15 17Q58 5 108 16 123 26 117 61L84 71 65 87 65 72Q16 81 9 58 2 29 15 17Z']
    for name in names:
        for i in range(4):
            a=group(path(bubbles[i],PURPLE,INK,3),'translate(1 2)')+path(bubbles[i],CREAM,INK,3)
            a+=line('M21 24Q42 15 62 16',VIOLET,2)
            cy=[37,32,29,33][i]
            if name=='gm':
                a+=star(64,cy,21,GOLD,10,2)+circle(64,cy,14,ORANGE,INK,2)+line(f'M55 {cy-1} 59 {cy-3}M69 {cy-3} 73 {cy-1}M58 {cy+6}Q64 {cy+10} 71 {cy+5}',INK,1.5)
            elif name=='lfg':
                a+=group(path('M-9 18-6-7 4-23 14-7 11 18Z',VIOLET,INK,2)+circle(3,-3,5,MINT,INK,1)+path('M-9 6-19 17-8 17M12 6 21 17 11 17',PINK,INK,1.5)+flame3(1,23,.2),f'translate(64 {cy}) rotate({[16,25,33,20][i]})')
            elif name=='wagmi':
                a+=path(f'M39 {cy+14} 39 {cy-4} 49 {cy-4} 49 {cy+6} 61 {cy+6} 61 {cy-12} 72 {cy-12} 72 {cy-2} 91 {cy-19} 93 {cy-5} 85 {cy-9} 71 {cy+14}Z',MINT,INK,2)+star(36,cy-13,7,GOLD,4,1)
            elif name=='rekt':
                a+=path(f'M41 {cy-17} 87 {cy-17} 91 {cy+15} 39 {cy+17}Z',VIOLET,INK,2)+line(f'M46 {cy-10} 81 {cy+10}M80 {cy-10} 46 {cy+10}',PINK,5)+star(94,cy-17,6,ORANGE,4,1)
            elif name=='hodl':
                a+=ellipse(64,cy,17,20,GOLD,INK,2)+star(64,cy,9,ORANGE,4,1)
                a+=path(f'M35 {cy+10} 45 {cy-1} 53 {cy+1} 51 {cy+13} 60 {cy+19} 55 {cy+24} 42 {cy+19}ZM94 {cy+10} 84 {cy-1} 76 {cy+1} 77 {cy+13} 68 {cy+19} 72 {cy+24} 85 {cy+19}Z',CREAM,INK,2)
            elif name=='moon':
                a+=circle(64,cy,22,LILAC,INK,2)+circle(54,cy-8,5,PURPLE,'none',0)+circle(71,cy+7,7,VIOLET,'none',0)+star(96,cy-12,7,GOLD,4,1)
                a+=line(f'M29 {cy+20} 38 {cy+12}',PINK,3)
            elif name=='gn':
                a+=path(f'M73 {cy-20}Q41 {cy-22} 45 {cy+10} 65 {cy+29} 84 {cy+9}Q57 {cy+14} 73 {cy-20}Z',VIOLET,INK,2)+star(87,cy-15,6,GOLD,4,1)
                a+=text(35,cy+5,'z',11,PURPLE,'none',0)
            else:
                a+=path(f'M40 {cy-17} 55 {cy-13} 65 {cy-2} 74 {cy-8} 82 {cy+6} 92 {cy+3} 87 {cy+23} 68 {cy+16} 76 {cy+12} 67 {cy+4} 60 {cy+11} 47 {cy-1}Z',PINK,INK,2)+path(f'M31 {cy-10}Q19 {cy+3} 31 {cy+5} 38 {cy+1} 31 {cy-10}Z',MINT,INK,1)
            a+=text(64,73,name.upper(),19 if len(name)<5 else 17,PURPLE,'none',0)
            add3('emotes2',f'emote/{name}/{i}',128,96,a)


def pack3(atlas,items,cap,*,pivots=None,scale='1',version='3B'):
    widths=range(math.ceil((max(im.width for im in items.values())+4)/64)*64,cap[0]+1,64)
    # Fill gaps beside tall effects; a shelf wastes enough space to exceed legend caps.
    choices=[]
    for width in widths:
        shelf_positions,shelf_height=shelf(items,width)
        if shelf_height<=cap[1]:choices.append((width,shelf_positions,shelf_height))
        free=[(0,0,width,cap[1])];positions={}
        for name,im in sorted(items.items(),key=lambda kv:(-max(kv[1].size),-kv[1].width*kv[1].height,kv[0])):
            ww,hh=im.width+4,im.height+4
            fits=[r for r in free if r[2]>=ww and r[3]>=hh]
            if not fits:break
            x,y,_,_=min(fits,key=lambda r:(min(r[2]-ww,r[3]-hh),max(r[2]-ww,r[3]-hh),r[1],r[0]))
            positions[name]=(x+2,y+2,im.width,im.height);remaining=[]
            for fx,fy,fw,fh in free:
                if x>=fx+fw or x+ww<=fx or y>=fy+fh or y+hh<=fy:
                    remaining.append((fx,fy,fw,fh));continue
                if x>fx:remaining.append((fx,fy,x-fx,fh))
                if x+ww<fx+fw:remaining.append((x+ww,fy,fx+fw-x-ww,fh))
                if y>fy:remaining.append((fx,fy,fw,y-fy))
                if y+hh<fy+fh:remaining.append((fx,y+hh,fw,fy+fh-y-hh))
            remaining=list(dict.fromkeys(remaining))
            free=[r for r in remaining if not any(r!=q and r[0]>=q[0] and r[1]>=q[1] and r[0]+r[2]<=q[0]+q[2] and r[1]+r[3]<=q[1]+q[3] for q in remaining)]
        if len(positions)==len(items):
            height=math.ceil(max(y+h+2 for x,y,w,h in positions.values())/64)*64
            if height<=cap[1]:choices.append((width,positions,height))
    assert choices,(atlas,'cannot fit atlas cap',cap)
    w,positions,h=min(choices,key=lambda v:(v[0]*v[2],max(v[0],v[2]),v[0]))
    packed=Image.new('RGBA',(w,h));frames={}
    for name,(x,y,ww,hh) in positions.items():
        packed.paste(items[name],(x,y))
        frames[name]={'frame':{'x':x,'y':y,'w':ww,'h':hh},'rotated':False,'trimmed':False,
                      'spriteSourceSize':{'x':0,'y':0,'w':ww,'h':hh},'sourceSize':{'w':ww,'h':hh},'pivot':{'x':.5,'y':1 if name.startswith(('tower/','skin/gold/tower/')) else .5}}
        if pivots is not None:frames[name]['pivot']=pivots[name]
    target=OUT/'atlas'/f'{atlas}.png'
    atomic_output(target,packed)
    metadata={'frames':frames,'meta':{'app':'Candy Siege art','version':version,'image':target.name,'format':'RGBA8888','size':{'w':w,'h':h},'scale':scale}}
    atomic_output(target.with_suffix('.json'),json.dumps(metadata,indent=2)+'\n')
    with Image.open(target) as shipped:
        for name,(x,y,ww,hh) in positions.items():
            assert shipped.crop((x,y,x+ww,y+hh)).tobytes()==items[name].tobytes(),(atlas,name,'pixel mismatch')
            for rect in ((x-2,y-2,x+ww+2,y),(x-2,y+hh,x+ww+2,y+hh+2),(x-2,y,x,y+hh),(x+ww,y,x+ww+2,y+hh)):
                assert not shipped.crop(rect).getchannel('A').getbbox(),(atlas,name,'padding')
    return {'frames':len(items),'size':[w,h],'pngBytes':target.stat().st_size,'jsonBytes':target.with_suffix('.json').stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}


def contact3(name,items,cols=6,cell=(196,200)):
    cw,ch=cell;im=Image.new('RGB',(cols*cw,48+math.ceil(len(items)/cols)*ch),'#33283f');d=ImageDraw.Draw(im)
    d.text((16,13),'CANDY SIEGE / '+name.upper(),font=font(19),fill=CREAM)
    for i,(key,value) in enumerate(items.items()):
        x=i%cols*cw;y=i//cols*ch+48
        d.rounded_rectangle((x+5,y+5,x+cw-5,y+ch-5),radius=10,fill='#48374f')
        thumb=value.copy();thumb.thumbnail((cw-18,ch-43),Image.Resampling.LANCZOS)
        im.paste(thumb,(x+(cw-thumb.width)//2,y+10+(ch-43-thumb.height)//2),thumb)
        label=key if len(key)<30 else key.replace('boss/pumpkin/','').replace('skin/gold/tower/','gold/')
        d.text((x+9,y+ch-24),label,font=font(11),fill=CREAM)
    return im


def embed_png3(im,x,y,w,h):
    stream=io.BytesIO();im.save(stream,format='PNG')
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/png;base64,{base64.b64encode(stream.getvalue()).decode()}"/>'


def cards3(rig,legends,images):
    import rig_preview as rp
    player=rp.Player(rig)
    products=[]
    for crew,color in CREW_COLORS.items():
        im=player.draw('crew-'+crew,'idle',350,250,CREAM,size=(256,256),origin=(125,216),scale=1.55)
        products.append(('crew-'+crew,crew.upper(), 'CREW COLLECTION',color,im,'OUTFIT'))
    for token,spec in legends.items():
        im=player.draw(spec['costume'],'idle',350,int(token),CREAM,size=(256,256),origin=(122,220),scale=1.48)
        products.append((spec['costume'],spec['name'].upper(),'LEGENDARY / '+token,LEGEND_COLORS[token][2],im,'1 OF 1'))
    im=Image.new('RGBA',(256,256));tower=images['skins3']['skin/gold/tower/egg/3'];im.alpha_composite(tower,(48,20))
    products.append(('gold-towers','GOLD STANDARD','FOUR TOWER FAMILIES',GOLD,im,'GOLD'))
    im=Image.new('RGBA',(256,256))
    for name,x,y in [('gm',3,40),('moon',117,37),('wagmi',63,113)]:im.alpha_composite(images['emotes2'][f'emote/{name}/3'],(x,y))
    products.append(('emote-pack','SAY IT LOUD','EIGHT ANIMATED EMOTES',PINK,im,'8 EMOTES'))
    im=Image.new('RGBA',(256,256));im.alpha_composite(images['towers3']['tower/roost/3'],(48,24))
    products.append(('bat-roost','BAT ROOST','WATCH THE SKIES',VIOLET,im,'TOWER'))
    candy_art=path('M47 145 127 121 209 145 201 200 128 224 53 201Z',RUST,INK,4)+path('M46 140 128 119 209 140 128 165Z',GOLD,INK,3)+path('M50 145 125 166 125 215 56 196Z',ORANGE,INK,2)
    for n in range(9):candy_art+=candy(66+n%3*56,94+n//3*28,.8,n*31,[PINK,MINT,GOLD][n%3])
    candy_art+=path('M113 151 137 150 137 218 126 222 112 216Z',GOLD,INK,2)+star(125,188,12,CREAM,5,2)
    add3('cards','card/starter-candy',256,256,card_art3('SWEET START','STARTER CANDY PACK',ORANGE,candy_art,'CANDY'))
    for key,title,subtitle,color,im,badge in products:
        a=embed_png3(im,0,-9,256,256)
        if key.startswith('crew-'):a+=embed_svg3(ROOT.parent/'crews'/f'{key[5:]}.svg',180,66,56,56)
        add3('cards','card/'+key,256,256,card_art3(title,subtitle,color,a,badge))


def card_art3(title,subtitle,color,illustration,badge,*,title_size=None):
    a=path('M23 8 232 12 245 26 241 229 227 247 21 242 9 227 12 23Z',DARK,INK,5)
    a+=path('M26 15 230 18 237 28 234 226 224 239 24 236 17 224 19 26Z',PURPLE,GOLD,2)
    a+=path('M26 59 230 55 230 185 24 190Z','#47314d','none',0)
    for n in range(9):
        x=25+n*26;a+=path(f'M128 171 {x} 60 {x+11} 60Z',color,'none',0,'opacity=".1"')
    a+=ellipse(128,177,81,13,DARK,'none',0,'opacity=".3"')
    a+=star(36,99,6,color,4,1)+star(220,159,7,color,4,1)+star(215,82,4,CREAM,4,.5)
    a+=illustration
    a+=path('M23 20 228 23 228 49 22 48Z',DARK,INK,1.5)+text(126,39,subtitle,10,color,'none',0)
    a+=path('M19 192 238 189 235 225 224 238 24 234 18 222Z',DARK,INK,2)
    a+=text(128,211,title,title_size or (16 if len(title)<16 else 13),CREAM,'none',0)
    a+=text(128,227,badge,9,color,'none',0)
    for x,y in ((24,24),(230,28),(25,227),(226,227)):a+=circle(x,y,2.5,GOLD,INK,1)
    return a


def rig_previews3(rig,legends,images):
    import rig_preview as rp
    rp.self_check(rig)
    player=rp.Player(rig)
    samples={c:{name:[{'t':round(i*clip['ms']/7,6),'parts':{p:{k:round(v,6) for k,v in tr.items()} for p,tr in rp.resolve(rig,c,name,i*clip['ms']/7).items()}} for i in range(8)] for name,clip in rig['clips'].items()} for c in NEW_COSTUMES}
    overview=Image.new('RGB',(1360,90+len(legends)*350),'#33283f');d=ImageDraw.Draw(overview)
    d.text((22,15),'CANDY SIEGE / THE TEN LEGENDS',font=font(26),fill=CREAM)
    d.text((22,55),'REAL PORTRAIT             IDLE                  ATTACK / RELEASE                 BOSS / 1.8x                        SPECIAL + ULTIMATE',font=font(13),fill=GOLD)
    for row,(token,spec) in enumerate(legends.items()):
        y=90+row*350;c=spec['costume'];attack='attack-'+spec['attack'];release=rig['clips'][attack]['events']['release']
        face=Image.open(OUT.parent/'chogs-256'/f'{token}.webp').convert('RGB').resize((150,150),Image.Resampling.LANCZOS)
        overview.paste(face,(22,y+45));d.text((22,y+211),'#'+token+' / '+spec['name'],font=font(13),fill=GOLD)
        for x,clip,t,scale in ((190,'idle',350,1.5),(432,attack,release,1.5),(700,'idle',350,2.7)):
            canvas=Image.new('RGBA',(350,350))
            if x==700:
                aura=images['hero-'+c][f'boss/{token}/aura/1'].resize((350,350),Image.Resampling.LANCZOS);canvas.alpha_composite(aura,(0,25))
            sprite=player.draw(c,clip,t,int(token),CREAM,size=(350,350),origin=(180,325),scale=scale)
            canvas.alpha_composite(sprite);overview.paste(canvas,(x,y),canvas)
        for n,slot in enumerate(('special','ultimate')):
            fx=images['hero-'+c][f'{slot}/3'].copy();fx.thumbnail((224,120),Image.Resampling.LANCZOS)
            overview.paste(fx,(1110+(224-fx.width)//2,y+15+n*131),fx)
            d.text((1090,y+122+n*131),spec[slot]['name'],font=font(12),fill=CREAM)
        d.line((20,y+347,1340,y+347),fill='#58425d',width=1)
    atomic_output(ROOT/'preview-legends.png',overview)
    # Every new costume exercises every existing clip through the batch-2 player.
    for c,config in NEW_COSTUMES.items():
        cw,ch=320,320;sheet=Image.new('RGB',(156+8*cw,52+len(rig['clips'])*ch),'#33283f');d=ImageDraw.Draw(sheet)
        token=int(c[7:]) if c.startswith('legend-') else 250
        d.text((14,14),c+' / SAME PLAYER AS RIG SAMPLES / EIGHT TIMES PER CLIP',font=font(18),fill=CREAM)
        for row,(name,clip) in enumerate(rig['clips'].items()):
            y=52+row*ch;d.text((8,y+114),name,font=font(13),fill=GOLD)
            for i in range(8):
                t=i*clip['ms']/7;im=player.draw(c,name,t,token,CREAM,size=(cw,ch),origin=(178,261),scale=.95)
                sheet.paste(im,(156+i*cw,y),im);d.text((165+i*cw,y+298),f'{t:.0f} ms',font=font(11),fill=LILAC)
                assert samples[c][name][i]['parts']=={p:{k:round(v,6) for k,v in tr.items()} for p,tr in rp.resolve(rig,c,name,t).items()}
        atomic_output(ROOT/'svg/batch3b'/f'preview-rig-{c}.png',sheet)
    return samples


def expected3(legends):
    expected={}
    for token,spec in legends.items():
        names={f'rig/{p}' for p in ('torso','arm-back','arm-front','leg-back','leg-front','extra')}
        if token not in ('942','1481'):names.add('rig/weapon')
        names|={'wpn/proj'}|{f'wpn/hit/{i}' for i in range(4)}|{f'special/{i}' for i in range(6)}|{f'ultimate/{i}' for i in range(8)}|{f'boss/{token}/aura/{i}' for i in range(4)}
        expected['hero-'+spec['costume']]=names
    for crew in CREW_COLORS:expected['hero-crew-'+crew]={f'rig/{p}' for p in ('torso','arm-back','arm-front','arm-back-skin','arm-front-skin','leg-back','leg-front','extra')}
    expected['boss']={f'boss/pumpkin/{state}/{i}' for state,count in [('walk',6),('roll',6),('summon',4),('split',6),('die',8)] for i in range(count)}|{'boss/pumpkin/hurt','boss/ui/bar','boss/ui/fill','boss/ui/banner'}
    expected['towers3']={f'tower/{k}/{l}' for k in ('roost','cauldron','catapult','lighthouse','organ') for l in range(1,4)}|{f'unit/bat/{i}' for i in range(4)}|{'proj/potion','proj/candycorn','fx/lighthouse-beam'}|{f'fx/{k}/{i}' for k in ('potion','candycorn','soundwave') for i in range(6)}
    expected['items']={f'item/{k}{suffix}' for k in ('pumpkin-bomb','holy-water','garlic','candy-cane','scarecrow') for suffix in ('','/world',*[f'/fx/{i}' for i in range(6)])}
    expected['skins3']={f'skin/gold/tower/{k}/{l}' for k in ('egg','tp','lantern','patch') for l in range(1,4)}
    expected['emotes2']={f'emote/{k}/{i}' for k in ('gm','lfg','wagmi','rekt','hodl','moon','gn','ngmi') for i in range(4)}
    expected['cards']={'card/'+k for k in [*['crew-'+k for k in CREW_COLORS],*[v['costume'] for v in legends.values()],'gold-towers','emote-pack','bat-roost','starter-candy']}
    return expected


def append_entries3(target,entries,field=None):
    """Append JSON object members without reserializing any existing entry."""
    raw=target.read_text();parsed=json.loads(raw);current=parsed[field] if field else parsed
    for key in set(current)&set(entries):assert current[key]==entries[key],(target.name,key,'existing value differs')
    missing={key:value for key,value in entries.items() if key not in current}
    if not missing:return
    if field:
        import re
        start=re.search(r'"'+re.escape(field)+r'"\s*:\s*',raw).end()
        _,end=json.JSONDecoder().raw_decode(raw,start)
        close=raw.rfind('}',start,end)
        serialized=json.dumps(missing,indent=2)[2:-2]
        addition=',\n'+'\n'.join('    '+line for line in serialized.splitlines())+'\n  '
    else:
        close=raw.rfind('}');addition=','+json.dumps(missing,separators=(',',':'))[1:-1]
    before=raw[:close].rstrip()
    atomic_output(target,before+addition+raw[close:])
    after=json.loads(target.read_text());result=after[field] if field else after
    assert all(result[k]==v for k,v in current.items()),target
    assert all(result[k]==v for k,v in entries.items()),target


def build_batch3b():
    B3.clear();NEW_COSTUMES.clear()
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    assert renderer,'Pillow and rsvg-convert or ImageMagick are required'
    legends=json.loads((OUT/'legends.json').read_text())['legends']
    rig_path=OUT/'atlas/rig.json';sample_path=OUT/'atlas/rig-samples.json'
    rig_before=json.loads(rig_path.read_text());samples_before=json.loads(sample_path.read_text())
    # Only the explicitly owned batch-3B outputs may change during this build.
    owned={'hero-'+v['costume'] for v in legends.values()}|{'hero-crew-'+n for n in CREW_COLORS}|{'boss','towers3','items','skins3','emotes2','cards'}
    protected={p:p.read_bytes() for p in (OUT/'atlas').iterdir() if p.is_file() and p.suffix in ('.png','.json') and p.stem not in owned|{'rig','rig-samples','props3'}}
    for token,spec in legends.items():legend_parts(token,spec);legend_effects(token)
    for crew in CREW_COLORS:crew_parts(crew)
    towers3();items3();cosmetics3();boss3()
    expected=expected3(legends)
    images={atlas:{} for atlas in B3}
    def render3(job):
        atlas,name,(w,h,source)=job
        # Boss frames are drawn on a 384 canvas and shipped at 320 so the atlas fits 2048x2048.
        size=(320,320) if name.startswith('boss/pumpkin/') else (w,h)
        im=render(source,w*2,h*2,renderer).resize(size,Image.Resampling.LANCZOS)
        assert im.getbbox(),(atlas,name,'empty')
        if name.startswith('rig/'):
            a=im.getchannel('A')
            for edge in ((0,0,w,1),(0,h-1,w,h),(0,0,1,h),(w-1,0,w,h)):
                assert a.crop(edge).getextrema()[1]<220,(atlas,name,'part clipped by frame')
        return atlas,name,im
    jobs=[(atlas,name,entry) for atlas,frames in B3.items() for name,entry in frames.items()]
    print(f'Rendering {len(jobs)} batch-3B SVG frames...',flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for atlas,name,im in pool.map(render3,jobs):images[atlas][name]=im
    report={}
    caps={'boss':(2048,2048),'towers3':(2048,1024),'cards':(2048,2048)}
    for atlas,items in images.items():
        assert set(items)==expected[atlas],(atlas,expected[atlas]-set(items),set(items)-expected[atlas])
        report[atlas]=pack3(atlas,items,caps.get(atlas,(1024,1024)))
        print(atlas,report[atlas]['size'],len(items),'frames',flush=True)
    rig=copy.deepcopy(rig_before);rig['costumes'].update(NEW_COSTUMES)
    for token,spec in legends.items():assert rig['costumes'][spec['costume']]['attack']==spec['attack']
    for crew in CREW_COLORS:assert 'rig/weapon' not in images['hero-crew-'+crew]
    new_samples=rig_previews3(rig,legends,images)
    cards3(rig,legends,images);images['cards']={}
    for name,entry in B3['cards'].items():
        _,_,im=render3(('cards',name,entry));images['cards'][name]=im
    assert set(images['cards'])==expected['cards']
    report['cards']=pack3('cards',images['cards'],caps['cards'])
    assert set(images)==set(expected)
    for atlas in ('towers3','items','skins3','emotes2','cards'):
        atomic_output(ROOT/'svg/batch3b'/f'preview-{atlas}.png',contact3(atlas,images[atlas],4 if atlas=='cards' else 6, (270,290) if atlas=='cards' else (196,224)))
    atomic_output(ROOT/'preview-boss.png',contact3('boss',images['boss'],6,(244,267)))
    # Numbered effects must animate, not silently alias a still under many names.
    for atlas,items in images.items():
        groups={}
        for name,im in items.items():
            prefix,_,last=name.rpartition('/')
            if last.isdigit() and not prefix.startswith(('tower/','skin/')):groups.setdefault(prefix,[]).append(im)
        for prefix,frames in groups.items():
            assert len({im.tobytes() for im in frames})==len(frames),(atlas,prefix,'duplicate animation frames')
    assert images['boss']['boss/ui/fill'].crop((0,0,1,22)).tobytes()==images['boss']['boss/ui/fill'].crop((63,0,64,22)).tobytes(),'health fill seam'
    assert all(p.read_bytes()==data for p,data in protected.items()),'earlier atlas changed during build'
    # Publish additive rig entries last, after their atlases and previews exist.
    append_entries3(sample_path,new_samples)
    append_entries3(rig_path,NEW_COSTUMES,'costumes')
    after=json.loads(rig_path.read_text());after_samples=json.loads(sample_path.read_text())
    assert all(after[k]==v for k,v in rig_before.items() if k!='costumes')
    assert all(after['costumes'][k]==v for k,v in rig_before['costumes'].items())
    assert all(after_samples[k]==v for k,v in samples_before.items())
    report['checks']=['all 3B contract frames and sizes','atlas caps','2px transparent padding','PNG round trip','all existing rig and sample values preserved','every legend attack matched','crew costumes omit weapons','all new clips rendered and sampled by rig_preview.py','distinct animation frames','tileable boss fill','earlier atlases unchanged']
    report['costumes']={k:v['attack'] for k,v in NEW_COSTUMES.items()}
    report['clips']=list(rig['clips'])
    outputs=[OUT/'atlas'/(atlas+suffix) for atlas in images for suffix in ('.png','.json')]
    outputs += [rig_path,sample_path,ROOT/'preview-legends.png',ROOT/'preview-boss.png']
    outputs += sorted((ROOT/'svg/batch3b').rglob('*.svg'))+sorted((ROOT/'svg/batch3b').glob('preview-*.png'))
    hashes={str(p.relative_to(ROOT.parents[1])):hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs}
    report_path=ROOT/'svg/batch3b/build-report.json'
    previous=json.loads(report_path.read_text()) if report_path.exists() else {}
    report['reproducesPreviousBuild']=previous.get('outputHashes')==hashes if previous else None
    report['outputHashes']=hashes
    report['fileBytes']={str(p.relative_to(ROOT.parents[1])):p.stat().st_size for p in outputs+[Path(__file__).resolve()]}
    atomic_output(report_path,json.dumps(report,indent=2)+'\n')
    print(f'ART CHECKS PASS: {sum(len(v) for v in images.values())} frames, {len(NEW_COSTUMES)} new costumes, {len(rig["clips"])} unchanged clips; reproduced previous build: {report["reproducesPreviousBuild"]}',flush=True)


def hero_image3e(rig,costume,parts,clip,t,*,density=2,scale=2,
                 size=(384,320),origin=(188,292)):
    """Use the existing rig resolver with density-compensated source pixels."""
    import rig_preview as rp
    image=Image.new('RGBA',size)
    config=rig['costumes'][costume];poses=rp.resolve(rig,costume,clip,t)
    order=list(rig['order'])
    if 'rig/weapon' in parts:
        order.insert(order.index('arm-front')+(not config['weaponBehind']),'weapon')
    token=int(costume[7:]) if costume.startswith('legend-') else 250
    for part in order:
        p=poses[part].copy()
        if part=='head':
            head,pivot,factor=rp.portrait(token,rig['R'])
            p['sx']*=factor;p['sy']*=factor
            rp.transformed(head,pivot,p,image,origin,scale)
            continue
        key='rig/'+part
        if key not in parts:continue
        im=parts[key];pv=config['pivots'].get(part,[.5,.5])
        pivot=(pv[0]*im.width,pv[1]*im.height)
        p['sx']/=density;p['sy']/=density
        if key+'-skin' in parts:
            rp.transformed(rp.tint(parts[key+'-skin'],CREAM),pivot,p,image,origin,scale)
        rp.transformed(im,pivot,p,image,origin,scale)
    return image


def cards3e(rig,heroes,renderer):
    dances=json.loads((OUT/'atlas/dances.json').read_text())
    poses={'floss':(600,PINK),'dab':(520,ORANGE),'moonwalk':(800,MINT),
           'robot':(600,VIOLET),'chicken':(200,GOLD),'breakdance':(480,PINK),
           'disco':(250,GOLD),'worm':(900,MINT)}
    assert set(poses)=={k for k,v in dances['dances'].items() if v['group']=='shop'}
    dance_rig={**rig,'clips':{**rig['clips'],**dances['clips']}}
    cards={}
    with tempfile.TemporaryDirectory(prefix='candy-cards3e-') as temporary:
        for name,(t,color) in poses.items():
            info=dances['dances'][name]
            hero=hero_image3e(dance_rig,'pitch-deck',heroes['pitch-deck'],info['clip'],t,
                              size=(768,768),origin=(384,580),scale=3)
            hero=hero.crop(hero.getbbox());hero.thumbnail((380,264),Image.Resampling.LANCZOS)
            illustration=embed_png3(hero,128-hero.width/4,187-hero.height/2,hero.width/2,hero.height/2)
            artwork=card_art3(info['name'].upper(),'DANCE COLLECTION',color,illustration,'SHOP DANCE',title_size=21)
            source=Path(temporary)/(name+'.svg')
            source.write_text(svg(256,256,artwork,'card/dance-'+name))
            cards['card/dance-'+name]=render(source,512,512,renderer).resize((256,256),Image.Resampling.LANCZOS)
    assert len({im.tobytes() for im in cards.values()})==8
    return cards


def build_batch3e():
    # rsvg renders at the requested density; raster enlargement is not a substitute.
    renderer=shutil.which('rsvg-convert')
    assert renderer,'Batch 3E requires rsvg-convert to rasterize the SVG masters at 2x'
    atlas_dir=OUT/'atlas';rig=json.loads((atlas_dir/'rig.json').read_text())
    heroes={};report={};too_large=[]
    for costume in rig['costumes']:
        atlas='hero-'+costume
        original=json.loads((atlas_dir/(atlas+'.json')).read_text())
        frames={k:v for k,v in original['frames'].items() if k.startswith('rig/')}
        assert frames,(costume,'no rig frames')
        parts={}
        for name,frame in frames.items():
            sources=[ROOT/'svg'/batch/atlas/(name+'.svg') for batch in ('chars','batch3b')]
            sources=[p for p in sources if p.is_file()]
            assert len(sources)==1,(costume,name,'missing or ambiguous SVG master')
            assert not frame['rotated'] and not frame['trimmed'],(costume,name)
            w,h=frame['sourceSize']['w'],frame['sourceSize']['h']
            assert frame['frame']['w']==w and frame['frame']['h']==h
            parts[name]=render(sources[0],w*2,h*2,renderer)
            if not parts[name].getbbox():
                # Bare-skin costumes intentionally keep empty clothing overlays.
                with Image.open(atlas_dir/(atlas+'.png')) as original_image:
                    x,y=frame['frame']['x'],frame['frame']['y']
                    assert not original_image.crop((x,y,x+w,y+h)).getbbox(),(costume,name,'lost artwork')
        try:
            report[atlas+'@2x']=pack3(atlas+'@2x',parts,(2048,2048),
                pivots={n:f['pivot'] for n,f in frames.items()},scale='2',version='3E')
        except AssertionError as error:
            if 'cannot fit atlas cap' not in str(error):raise
            too_large.append(costume);print('DOES NOT FIT:',costume,flush=True);continue
        shipped=json.loads((atlas_dir/(atlas+'@2x.json')).read_text())
        assert set(shipped['frames'])==set(frames)
        for name,f in shipped['frames'].items():
            assert f['pivot']==frames[name]['pivot'],(costume,name,'pivot changed')
            assert f['sourceSize']=={k:v*2 for k,v in frames[name]['sourceSize'].items()}
        heroes[costume]=parts
        print(atlas+'@2x',report[atlas+'@2x'],flush=True)
    if too_large:raise SystemExit('Costumes exceeding 2048x2048 (not shrunk): '+', '.join(too_large))
    cards=cards3e(rig,heroes,renderer)
    report['cards2']=pack3('cards2',cards,(2048,2048),version='3E')
    preview=contact3('cards2 / 256px',cards,4,(276,300))
    phone=contact3('cards2 / actual 128px',cards,8,(146,176))
    sheet=Image.new('RGB',(max(preview.width,phone.width),preview.height+phone.height),'#33283f')
    sheet.paste(preview,(0,0));sheet.paste(phone,(0,preview.height))
    atomic_output(ROOT/'preview-cards2.png',sheet)
    import rig_preview as rp
    costume='pitch-deck'
    low=hero_image3e(rig,costume,rp.atlas_images('hero-'+costume),'idle',350,
                     density=1,scale=1,size=(192,160),origin=(94,146))
    high=hero_image3e(rig,costume,heroes[costume],'idle',350)
    assert low.resize(high.size,Image.Resampling.BILINEAR).tobytes()!=high.tobytes()
    comparison=Image.new('RGB',(808,400),'#33283f');d=ImageDraw.Draw(comparison)
    d.text((18,14),'SAME SVG MASTERS / SAME POSE / SAME DISPLAY SIZE',font=font(19),fill=CREAM)
    for x,title,im in ((12,'1x composite enlarged 2x',low.resize(high.size,Image.Resampling.BILINEAR)),
                       (412,'2x parts rendered from SVG',high)):
        d.text((x+10,53),title,font=font(17),fill=GOLD)
        comparison.paste(im,(x,76),im)
    atomic_output(ROOT/'preview-2x.png',comparison)
    print('cards2',report['cards2'],flush=True)
    print(f'PASS: {len(heroes)} costumes, {sum(len(p) for p in heroes.values())} rig frames, 8 dance cards; all fit.',flush=True)


if __name__=='__main__':
    build_batch3e()
