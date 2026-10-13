#!/usr/bin/env python3
"""Batch 2B + 3A + 3D SVG masters. Run: python art/siege/build_fx.py

Standalone: shared drawing helpers and Rosie geometry copied from the frozen
build-batch1-snapshot.py, never imported from the concurrently edited build.py.
The default build writes only seven wide maps and /tmp/preview-wide.png.
Use --combat to write only the fx3 atlas and /tmp/knock-combat-atlas.png.
Earlier batch entry points and drawing masters remain available below.
No server, network or app changes; outputs are replaced atomically.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
import io
import json
import math
import random
import shutil
import subprocess
import tempfile
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
BLUE = '#56bfe1'
WHITE = '#fffbea'
FRAMES = {}
SIG = {}

def atomic_write(target, content):
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.'+target.name+'.', delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(content)
            handle.close()
            temporary.chmod(0o644)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)

def save_image(target, image, format='PNG', **options):
    content = io.BytesIO()
    image.save(content, format, **options)
    atomic_write(target, content.getvalue())

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

def house(x,y,s=1,color='#b06b84',porch=False):
    """Crooked cottage with a visible roof plane, side wall and warm front facade."""
    b=ellipse(145,268,150,39,DARK,'none',0,'opacity=".3"')
    b+=path('M31 120 205 110 260 149 259 255 199 282 31 258Z',color,INK,5)
    b+=path('M205 113 258 148 258 254 199 281Z','#614158',INK,4)
    b+=path('M36 150 194 149 194 258 35 243Z','#cc94a0',INK,3)
    b+=line('M41 180 192 179M39 205 192 207M38 228 193 233M209 176 253 164M205 206 253 190M204 235 252 215','#885d78',2)
    b+=path('M186 80 180 9 218 4 228 115Z',RUST,INK,4)
    b+=path('M175 10 172-2 217-8 228 4Z',PAPER,INK,3)
    b+=line('M187 26 219 23M190 46 223 42M207 24 209 45',INK,2)
    b+=path('M7 153 41 92 107 16 126 9 241 106 283 162 196 149 89 154Z',PURPLE,INK,5)
    b+=path('M11 141 108 17 212 128 204 143 89 149Z','#6f567f',INK,3)
    b+=path('M109 17 128 9 242 106 275 151 211 131Z','#3e2c5e',INK,3)
    b+=line('M39 111 89 109 184 115M59 85 119 77 158 86M80 58 122 48M103 25 116 35','#ac7e9d',3)
    b+=line('M72 113 78 136M133 111 146 138M87 84 97 107M128 79 140 109M107 52 120 77','#382542',2)
    b+=path('M4 145 87 145 111 132 213 136 216 154 112 149 91 161 7 161Z',PURPLE,INK,4)
    b+=line('M14 149 88 150M119 140 205 144',LILAC,3)
    b+=path('M118 257 117 194Q112 166 138 165 168 164 168 191L168 264Z',PURPLE,INK,4)
    b+=path('M124 253 123 193Q122 173 139 173 158 172 159 193L159 258Z',ORANGE,INK,2.5)
    b+=line('M138 177 139 252M127 213 156 216',RUST,2)
    b+=circle(149,224,3,GOLD,INK,1)
    b+=path('M49 174 94 174 96 218 48 215Z',GOLD,INK,4)
    b+=line('M70 177 71 215M51 194 92 196',PURPLE,4)
    b+=path('M215 183 242 173 242 207 215 219Z',GOLD,INK,3)+line('M228 180 228 211M217 199 240 191',PURPLE,3)
    b+=path('M81 126 86 94Q102 76 118 95L125 123Z',GOLD,INK,3)+line('M103 91 104 125M87 111 121 112',PURPLE,3)
    b+=path('M111 255 168 262 183 275 109 270ZM103 271 179 278 193 291 94 285Z','#a1899c',INK,3)
    b+=lantern(181,191,.36)
    b+=line('M38 163Q79 190 115 164',DARK,2)
    for j in range(5):
        b+=path(f'M{44+j*15} {170+int(7*math.sin(j*.8))}l6 9 6-8Z',[ORANGE,PINK,MINT][j%3],INK,1)
    b+=pumpkin(41,248,.55)+pumpkin(190,265,.42)
    if porch:
        b+=path('M107 284 215 270 238 288 127 308Z','#d2ac9d',INK,3)
        b+=path('M127 308 238 288 239 299 126 321Z','#946479',INK,3)
        for xx,yy in [(89,262),(186,252),(213,260)]:
            jar=path('M-11-15 10-15 12-6Q22 20 0 20-22 20-13-6Z','#b9c6c8',INK,2)+path('M-12-17 12-17 12-10-12-10Z',GOLD,INK,2)+candy(0,6,.45,0,PINK)
            b+=group(jar,f'translate({xx} {yy})')
        b+=path('M38 229 89 231 88 245 39 243Z',PURPLE,INK,2)+text(64,240,'CANDY',9,CREAM,'none',0)
    return group(b,f'translate({x} {y}) scale({s})')

def tree(x,y,s=1,pine=False):
    b=ellipse(0,8,44,15,DARK,'none',0,'opacity=".28"')
    b+=path('M-9 4-7-54-26-79-20-87-1-68 8-103 18-99 9-60 25-76 31-70 10-43 11 6 24 13 0 10-19 14Z','#795368',INK,3)
    if pine:
        b+=path('M0-153 20-120 13-119 35-87 26-87 49-49Q24-32-4-35L-44-43-23-84-33-80-10-118-20-115Z','#4d365d',INK,4)
        b+=path('M0-150 7-119-7-119 4-94-18-86-9-110Z','#80617d','none',0)
        b+=line('M-25-59-10-55M-12-93-3-88M6-67 16-62','#b0809d',2)
    else:
        b+=path('M-40-62Q-62-76-43-94-53-117-25-118-19-142 6-126 30-136 38-114 58-111 48-88 65-68 44-55 22-40 6-54-16-39-30-56Z','#6c486a',INK,4)
        b+=path('M-44-99Q-42-114-26-111-16-135 2-120 18-126 27-116Q5-107-5-100-27-112-44-99Z','#a57491','none',0)
        b+=line('M-40-82Q-27-90-20-81M-14-111Q-3-105 1-97M18-69Q31-63 41-77','#3f2a4a',3)
        b+=line('M-26-115-18-118M5-116 15-117','#c69eae',2)
    return group(b,f'translate({x} {y}) scale({s})')

def fence(x,y,length,angle=0):
    b=path(f'M0-29 {length}-29 {length}-21 0-21ZM0-8 {length}-8 {length}-1 0-1Z','#b68c9e',INK,2)
    for j in range(int(length/23)+1):
        xx=j*23
        b+=path(f'M{xx-5} 6 {xx-6}-39 {xx}-49 {xx+6}-40 {xx+5} 6Z','#c8a4b4',INK,2)
        b+=line(f'M{xx-2}-34 {xx-1}-14',CREAM,1)
    return group(b,f'translate({x} {y}) rotate({angle})')

ROAD = [
    [(-100,560),(70,560),(230,584),(335,529)],
    [(335,529),(426,481),(401,325),(534,322)],
    [(534,322),(660,313),(752,300),(792,432)],
    [(792,432),(847,584),(712,679),(791,753)],
    [(791,753),(863,832),(1077,816),(1126,689)],
    [(1126,689),(1180,559),(1110,433),(1244,408)],
    [(1244,408),(1380,380),(1473,437),(1513,526)],
    [(1513,526),(1552,614),(1601,618),(1768,614)],
]

PADS=[(267,404),(535,499),(653,179),(951,440),(612,759),(986,615),(1302,672),(1422,275)]

def road_points():
    points=[]
    for seg in ROAD:
        for j in range(24):
            t=j/24
            points.append([round(sum(seg[k][axis]*[ (1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3][k] for k in range(4)),3) for axis in (0,1)])
    return points+[list(ROAD[-1][-1])]

def render(source,w,h,renderer):
    if Path(renderer).name=='rsvg-convert':
        cmd=[renderer,'--width',str(w),'--height',str(h),str(source)]
    else:
        cmd=[renderer,'-background','none',str(source),'-resize',f'{w}x{h}!','png:-']
    result=subprocess.run(cmd,check=True,capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGBA')

def shelf(items,width):
    rows=[]
    bottom=2
    positions={}
    for name,img in sorted(items.items(),key=lambda kv:(-kv[1].height,-kv[1].width,kv[0])):
        w,h=img.size
        fits=[row for row in rows if row[0]+w+2<=width and row[2]>=h]
        if fits:
            row=max(fits,key=lambda r:r[0])
        else:
            row=[2,bottom,h];rows.append(row);bottom+=h+4
        positions[name]=(row[0],row[1],w,h)
        row[0]+=w+4
    return positions,bottom

def font(size):
    return ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf',size) if Path('/usr/share/fonts/TTF/DejaVuSans.ttf').exists() else ImageFont.load_default(size=size)

# Batch-two sources live below their atlas name, so short frame keys never clash.
def add(atlas, name, w, h, body, grain=True):
    entries = FRAMES.setdefault(atlas, {})
    assert name not in entries, (atlas, name)
    target = ROOT / 'svg' / ('batch3a' if atlas=='props3' else 'batch2b') / atlas / (name + '.svg')
    atomic_write(target, svg(w, h, body, name, grain=grain).encode())
    entries[name] = (w, h, target)


def glow(x, y, rx, ry, color=GOLD, alpha=.6):
    key = 'g' + color.lstrip('#')
    return (f'<defs><radialGradient id="{key}"><stop stop-color="{color}" stop-opacity="{alpha}"/>'
            f'<stop offset=".4" stop-color="{color}" stop-opacity="{alpha*.45}"/>'
            f'<stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient></defs>'
            + ellipse(x, y, rx, ry, f'url(#{key})', 'none', 0))


def heart(x, y, s=1, color=PINK, angle=0):
    b = path('M0 13C-33-6-17-29 0-13 16-31 36-8 0 13Z', color, INK, 2.5)
    b += line('M-16-10Q-14-18-8-14', WHITE, 2.5)
    return group(b, f'translate({x} {y}) rotate({angle}) scale({s})')


def drop(x, y, s=1, color=BLUE, angle=0):
    b = path('M0-17C-2-7-15 3-11 11-7 22 13 18 12 6 11-2 3-9 0-17Z', color, INK, 2)
    b += line('M-6 5Q-10 11-3 13', WHITE, 2)
    return group(b, f'translate({x} {y}) rotate({angle}) scale({s})')


def flame(x, y, s=1, phase=0):
    tip = [-7, 4, 12, -3, -11, 3][phase % 6]
    b = glow(0, -13, 37, 49, ORANGE)
    b += path(f'M0 24C-36 19-29-5-20-23L-17-9Q-4-23 {tip}-48Q{tip+22}-31 12-16L25-26C42 9 25 27 0 24Z', ORANGE, INK, 2.5)
    b += path(f'M0 19C-17 15-17 3-7-11L-3-26Q13-8 11 0L17-6Q24 17 0 19Z', GOLD, 'none', 0)
    b += path('M0 16Q-9 7 1-7 13 9 0 16Z', WHITE, 'none', 0)
    return group(b, f'translate({x} {y}) scale({s})')


def sparkburst(x, y, r, color=GOLD, phase=0):
    pts = []
    for j in range(24):
        a = j*math.pi/12 + phase*.12
        rr = r * ([1,.33,.74,.4][j % 4])
        pts.append(f'{math.cos(a)*rr:.2f},{math.sin(a)*rr:.2f}')
    b = glow(0, 0, r*1.2, r*1.2, color)
    b += path('M'+' '.join(pts)+'Z', color, INK, 2)
    b += star(0, 0, r*.53, WHITE, 6, 0)
    return group(b, f'translate({x} {y})')


def motes(x, y, radius, phase, color=GOLD, count=7):
    b = ''
    for j in range(count):
        a = j*math.tau/count + phase*.2
        xx = x+math.cos(a)*radius*(.75+(j%3)*.12)
        yy = y+math.sin(a)*radius*.7
        b += star(xx, yy, 2+(j+phase)%4, color, 4, .7)
    return b


def ring(x, y, rx, ry, color, phase, sw=4):
    b = glow(x,y,rx*1.15,ry*1.5,color,.35)
    b += ellipse(x,y,rx,ry,'none',color,sw)
    b += ellipse(x,y,rx*.92,ry*.87,'none',WHITE,max(1,sw*.4), 'stroke-dasharray="24 13 5 9"')
    for j in range(3):
        a=phase*.8+j*math.tau/3
        b+=star(x+math.cos(a)*rx,y+math.sin(a)*ry,5,color,4,1)
    return b


def smoke(x, y, s, phase, color=LILAC):
    b=''
    for j in range(7):
        a=j*math.tau/7+phase*.15
        xx=math.cos(a)*(12+phase*4); yy=math.sin(a)*(8+phase*4)
        rr=max(4,16-phase*1.2+(j%3)*3)
        b+=circle(xx,yy,rr,color,INK,2)
        b+=line(f'M{xx-rr*.55} {yy-rr*.25}q2-8 10-7',CREAM,1.5)
    return group(b,f'translate({x} {y}) scale({s})')


def wave(phase, big=False):
    # The crest opens, overhangs, curls into a barrel, then collapses into foam.
    crests=[(69,25,15),(73,13,25),(75,5,35),(81,8,42),(87,29,35),(84,49,23)]
    cx,cy,bulge=crests[phase%6]
    b=glow(59,68,48,31,BLUE,.55)
    b+=path(f'M5 84Q25 83 38 61C47 43 40 {cy+7} {cx-20} {cy}C{cx+13} {cy-9} {cx+bulge*.25} {cy+31} {cx-10} {cy+34}Q{cx+5} {cy+19} {cx-8} {cy+15}C{cx-24} {cy+11} {cx-18} 68 94 77L96 88Q54 100 5 84Z','#377cae',INK,1.6)
    b+=path(f'M8 82Q30 78 41 58C48 38 46 {cy+8} {cx-17} {cy+3}Q{cx+5} {cy-3} {cx+5} {cy+17}Q{cx-9} {cy+4} {cx-19} {cy+20}C50 52 65 80 92 81Q50 94 8 82Z',BLUE,'none',0)
    b+=path(f'M38 57C46 34 43 {cy+8} {cx-18} {cy+1}C{cx+12} {cy-9} {cx+14} {cy+25} {cx-10} {cy+34}Q{cx+2} {cy+23} {cx-3} {cy+14}L{cx-10} {cy+19} {cx-16} {cy+11} {cx-22} {cy+20} {cx-28} {cy+16}Z',WHITE,INK,1)
    b+=line('M22 78Q45 61 50 38M47 80Q61 89 79 85','#b8f1e8',2)
    for j in range(9 if big else 5):
        xx=18+j*9; yy=86+math.sin(j+phase)*3
        b+=ellipse(xx,yy,5+(j%3),2.7,WHITE,'none',0)
    for j in range(5):
        b+=drop(48+j*9,(18+j*13+phase*7)%64+8,.14+j*.016,WHITE,-35+j*12)
    if phase>=4:
        b+=path('M37 82Q31 59 24 64L32 81Q18 71 15 79L22 88M72 82Q88 60 87 49L92 63 86 81',WHITE,INK,1)
    return b


def vortex(phase, color=CREAM):
    b=glow(50,56,48,43,VIOLET,.4)
    b+=path(f'M18 15Q47 {5+phase} 85 18L64 78 53 93 41 84Z',LILAC,INK,1.5)
    for j in range(5):
        yy=21+j*14; rr=37-j*6
        off=math.sin(phase*1.05+j)*4
        b+=path(f'M{50-rr+off} {yy-4}Q{48+off} {yy+10} {50+rr+off} {yy-3}L{48+rr+off} {yy+4}Q{48+off} {yy+18} {51-rr+off} {yy+2}Z',color,INK,1.2)
        b+=line(f'M{54-rr+off} {yy-3}Q48 {yy+6} {45+rr+off} {yy-2}',WHITE,1.6)
    for j in range(4):
        a=phase*1.1+j*1.7
        b+=candy(50+math.cos(a)*(34-j*5),30+j*13,.18,math.degrees(a),[PINK,GOLD,MINT][j%3])
    b+=line(f'M7 {25+phase*2}Q45 5 88 26M19 58Q34 67 44 66',MINT,1.8)
    return b


def bolt(phase, color=GOLD):
    shift=[0,9,-6,4][phase%4]
    main=f'M{53+shift} 4 35 31 50 34 31 65 46 63 35 96 69 51 54 50 70 21 55 25 68 4Z'
    b=glow(50,50,39,51,color,.55)+path(main,color,INK,1.5)
    b+=path(f'M{55+shift} 5 42 29 57 30 38 60 54 55 39 88 62 53 48 55 63 26 49 30Z',WHITE,'none',0)
    b+=line('M44 38 25 29 29 17 16 8M53 58 77 66 68 79 85 88',color,4)
    b+=line('M44 38 25 29 29 17 16 8M53 58 77 66 68 79 85 88',WHITE,1.4)
    return b


def vines(phase, color=GREEN):
    b=''
    for j in range(4):
        xx=14+j*23; height=[18,36,58,68,61,54][phase%6]
        d=f'M{xx} 93C{xx-22} 74 {xx+30} {90-height} {xx+4} {91-height}Q{xx-9} {91-height} {xx-2} {104-height}'
        b+=line(d,INK,6)+line(d,color,3.8)
        b+=path(f'M{xx+1} 70Q{xx-19} 48 {xx-19} 65Q{xx-16} 74 {xx+1} 70M{xx+3} 56Q{xx+27} 36 {xx+22} 56Q{xx+14} 63 {xx+3} 56',MINT,INK,1)
    b+=ellipse(50,91,43,5,'none',GOLD,1.5)
    return b


def shades(w=60):
    b=path('M-29-8H-5L-3-5H3L5-8H29V-2H25V9H19V12H7V9H4V1H-4V9H-7V12H-19V9H-25V-2H-29Z',INK,INK,1)
    b+=path('M-22-5H-18L-22 1ZM-16-5H-12L-20 4H-24ZM10-5H14L7 2V-2ZM17-5H21L12 4H8Z',CREAM,'none',0)
    return group(b,f'scale({w/60})')


def reticle(phase, color=PINK):
    radius=[36,31,24,21][phase%4]
    b=glow(50,50,45,45,color,.25)
    b+=circle(50,50,radius,'none',color,2, 'stroke-dasharray="14 7"')
    for a in (0,90,180,270):
        b+=group(line(f'M{50-radius+8} {50-radius}H{50-radius}V{50-radius+8}',INK,6)+line(f'M{50-radius+8} {50-radius}H{50-radius}V{50-radius+8}',color,3),f'rotate({a} 50 50)')
    b+=line('M43 50H57M50 43V57',WHITE,2)
    return b


def confetti(phase):
    b=''
    for j in range(17):
        a=j*2.399+phase*.07; rr=12+phase*6+(j%3)*3
        x=50+math.cos(a)*rr; y=49+math.sin(a)*rr*.8+phase*1.2
        b+=group(path('M-2-4 3-4 2 4-3 3Z',[PINK,GOLD,MINT,VIOLET][j%4],INK,.8),f'translate({x:.2f} {y:.2f}) rotate({j*37+phase*29})')
    return b


def candy_jar(phase):
    b=glow(50,52,43,45,MINT,.4)
    b+=path('M32 17H68V28Q83 38 80 77Q80 90 50 90T20 77Q17 38 32 28Z','#a6cccd',INK,2)
    b+=path('M26 60Q50 66 74 58V78Q48 91 26 77Z',VIOLET,INK,1)
    for j in range(2+phase):
        b+=candy(34+(j*19)%34,74-(j//2)*15,.3,j*43,[PINK,GOLD,MINT][j%3])
    b+=path('M29 10H71V22H29Z',GOLD,INK,2)+line('M27 38V64',WHITE,3)
    b+=star(73,25-phase*3,8,MINT,4,1)
    return b


def effect(kind, i, n=6):
    """Draw distinct silhouettes in a 100-square; the caller sizes their frames."""
    p=i/max(1,n-1)
    if kind in ('wave','tidal'):
        return wave(i,kind=='tidal')
    if kind=='twister':
        return vortex(i)
    if kind=='meteor':
        b=glow(53,55,47,49,ORANGE)
        b+=path(f'M13 5 43 19 35 3 68 24 71 8Q{104-i*2} 45 82 78L35 86Q20 66 13 5Z',ORANGE,INK,1.5)
        b+=path('M22 15 49 34 46 10 72 36 73 21Q96 56 76 74L38 79Z',GOLD,'none',0)
        corn=path('M49 30Q51 23 57 31L83 76Q87 87 73 89L28 86Q19 85 25 74Z',GOLD,INK,2)
        corn+=path('M37 54 49 31Q53 24 57 32L69 54Z',WHITE,'none',0)
        corn+=path('M37 54H69L81 75 26 75Z',ORANGE,'none',0)
        corn+=line('M39 55 31 74',WHITE,2)
        b+=group(corn,f'rotate({-24+i*5} 52 60)')
        b+=line(f'M8 {27+i*3} 18 {49+i*3}M77 4 88 28',WHITE,1.6)
        return b
    if kind in ('impact','blast','eggsplosion'):
        r=[9,24,40,44,39,31][i%6]
        b=ring(50,74, min(45,10+i*8),min(15,3+i*2),GOLD,i,2)
        if i<4:
            b+=sparkburst(50,54,r,ORANGE if kind=='impact' else GOLD,i)
        else:
            b+=smoke(50,54,.65,i-2,CREAM)
        for j in range(7):
            a=j*math.tau/7; rr=10+i*6
            x=50+math.cos(a)*rr; y=53+math.sin(a)*rr*.6
            if kind=='blast':
                b+=candy(x,y,.16+i*.025,j*45+i*25,[PINK,MINT,GOLD][j%3])
            elif kind=='eggsplosion':
                b+=group(path('M-5-8 3-5 6 3-6 8-2-1Z',CREAM,INK,1),f'translate({x} {y}) rotate({j*33+i*14})')
            else:
                b+=path(f'M{x-3} {y+2}l2-7 6 2-2 7Z',RUST,INK,1)
        if kind=='eggsplosion':
            b+=ellipse(50,77,18+i*3,5+i,GOLD,INK,1)
        return b
    if kind=='fire':
        b=ellipse(50,84,43,9,RUST,INK,1.5)
        for j in range(5):
            b+=flame(18+j*16,71-math.sin(j)*7,.48+(j%2)*.14,i+j)
        return b
    if kind in ('smoke','blink'):
        b=smoke(50,50,.3+p*.65,i,LILAC if kind=='smoke' else VIOLET)
        if kind=='blink': b+=ring(50,60,12+p*33,6+p*9,MINT,i,2)+motes(50,50,35,i,MINT)
        return b
    if kind=='slash':
        b=glow(50,50,48,35,VIOLET,.6)
        b+=path(f'M{8+i*2} 86Q{70+i*4} 79 89 7Q70 50 {21+i*4} 59L4 70 28 67Z',VIOLET,INK,1.5)
        b+=path('M13 81Q65 76 87 14Q65 62 13 81Z',WHITE,'none',0)
        b+=line('M11 64Q47 54 61 32M36 87 62 75',PINK,1.5)
        return b
    if kind=='storm':
        b=glow(50,49,49,44,VIOLET)
        b+=smoke(50,39,.88,0,PURPLE)+smoke(48,34,.71,1,VIOLET)
        for j in range(3):
            b+=group(bolt(i+j,VIOLET),f'translate({10+j*27} 52) scale(.22 .38)')
        b+=motes(50,42,39,i,MINT)
        return b
    if kind in ('bolt','arcane-bolt'):
        return bolt(i,VIOLET if kind=='arcane-bolt' else GOLD)
    if kind in ('hit','crit','talent','revive'):
        color=MINT if kind=='revive' else VIOLET if kind=='talent' else GOLD
        b=sparkburst(50,50,[12,32,43,28,21,11][i%6],color,i)
        if kind in ('talent','revive'):
            b+=ring(50,80,12+i*6,5+i,color,i,2)
            if kind=='revive':
                b+=path('M43 53Q22 54 12 29L28 32 22 20Q45 29 47 45M57 53Q78 54 88 29L72 32 78 20Q55 29 53 45',WHITE,INK,1.5)
                b+=heart(50,49,.8,MINT)+ellipse(50,23,12,4,'none',GOLD,2)
            else:
                b+=path('M36 55 34 83 50 75 66 83 64 55Z',VIOLET,INK,1.5)
                b+=star(50,46,25,GOLD,5,1.8)+star(50,46,14,WHITE,5,.8)
        return b+motes(50,50,14+i*6,i,color)
    if kind in ('bloom','roots','vines'):
        b=vines(i)
        if kind=='bloom':
            for j in range(5):
                x=18+j*16; y=30+math.sin(j*2)*12
                for a in range(0,360,72):
                    b+=group(ellipse(x,y-7,5+min(i,3),10,PINK if j%2 else GOLD,INK,1),f'rotate({a+i*8} {x} {y})')
                b+=circle(x,y,5,WHITE,INK,1)
            b+=motes(50,50,35,i,MINT)
        return b
    if kind=='jar': return candy_jar(i)
    if kind in ('love-bomb','candy-bomb','confetti-bomb'):
        bob=[-10,-6,0,7,3,-2][i%6]
        b=glow(50,53,44,44,PINK if kind=='love-bomb' else GOLD)
        b+=line(f'M32 {15+bob} 38 {34+bob}M65 {8+bob} 68 {26+bob}',WHITE,2)
        if kind=='love-bomb':
            b+=heart(50,58+bob,1.55,PINK,-10+i*6)
            b+=line(f'M53 {23+bob}Q65 {11+bob} 70 {23+bob}',INK,3)+sparkburst(72,22+bob,7,GOLD,i)
        elif kind=='candy-bomb':
            b+=candy(50,57+bob,1.85,-18+i*10,ORANGE)
        else:
            b+=circle(50,55+bob,24,VIOLET,INK,2)+path(f'M33 {37+bob} 64 {72+bob}M28 {54+bob} 52 {79+bob}','none',PINK,7)
            b+=line(f'M56 {32+bob}Q76 {18+bob} 72 {10+bob}',INK,3)+sparkburst(74,12+bob,6,GOLD,i)
        return b
    if kind=='heart-wave':
        b=ring(50,58,8+i*7,5+i*5,PINK,i,3)
        for j in range(7):
            a=j*math.tau/7+i*.06
            b+=heart(50+math.cos(a)*(12+i*5),54+math.sin(a)*(9+i*4),.2+i*.035,PINK,math.degrees(a)+90)
        return b
    if kind=='light':
        width=[4,9,22,28,20,11][i]
        b=glow(50,50,width*1.8,57,GOLD)
        b+=path(f'M{50-width} 2H{50+width}L{50+width*.7} 90Q50 100 {50-width*.7} 90Z',GOLD,'none',0,'opacity=".38"')
        b+=path(f'M{50-width*.35} 1H{50+width*.35}L{50+width*.2} 91Q50 95 {50-width*.2} 91Z',WHITE,'none',0)
        b+=ring(50,90,11+i*5,4+i,GOLD,i,1.6)+motes(50,49,30,i,WHITE)
        return b
    if kind in ('ring','shock','aura'):
        color=GOLD if kind=='ring' else MINT if kind=='aura' else VIOLET
        b=ring(50,56,9+i*7,6+i*4,color,i,3)
        if kind=='aura':
            for j in range(5):
                x=18+j*16; y=70-(i*13+j*11)%47
                b+=path(f'M{x} {y}l-4 9h3v10h3V{y+9}h4Z',WHITE,INK,.7)
        return b
    if kind in ('flare','scorch','splash'):
        if kind=='flare':return sparkburst(50,50,24+i*9,WHITE,i)
        if kind=='scorch':
            b=ellipse(50,64,15+i*9,8+i*3,PURPLE,INK,1)
            b+=line('M19 64 35 56 41 66 57 49 70 59 83 53',ORANGE,2)
            return b+flame(50,49,.35+i*.1,i)
        b=ellipse(50,77,18+i*7,7+i*2,BLUE,INK,1.5)
        for j in range(7):
            a=-math.pi+j*math.pi/6
            b+=drop(50+math.cos(a)*(16+i*9),68+math.sin(a)*(17+i*11),.23,BLUE,math.degrees(a)+90)
        return b
    if kind=='reticle':return reticle(i)
    if kind=='mark':return reticle(3)+path('M41 11 50 22 59 11Z',GOLD,INK,1.5)
    if kind in ('hearts','heart-mark'):
        b=''
        for j in range(3 if kind=='hearts' else 1):
            b+=heart(30+j*23 if kind=='hearts' else 50,66-(i*8+j*15)%42,.6+math.sin(i+j)*.1,PINK,-15+j*15)
        return b+motes(50,50,33,i,GOLD,4)
    if kind in ('ghost','scare'):
        s=[.45,.7,1,1.08,.93,.65][i]
        b=glow(50,48,47,45,MINT)
        ghost=path('M-24 25Q-30-29 0-33 35-30 29 27L18 19 9 30-1 20-12 28-19 18Z',MINT,INK,2)
        ghost+=ellipse(-10,-9,4,7,PURPLE,'none',0)+ellipse(12,-9,4,7,PURPLE,'none',0)+ellipse(1,9,6+i%3,7+i%3,PURPLE,'none',0)
        b+=group(ghost,f'translate(50 {60-i*5}) scale({s})')
        if kind=='scare': b+=motes(50,50,40,i,WHITE)+line('M7 20 21 32M81 15 74 30M9 66 24 60M83 72 73 63',GOLD,3)
        return b
    if kind=='cone':
        b=glow(62,50,42,47,VIOLET)
        b+=path(f'M6 50Q{55-i*2} {38-i*4} 92 10L83 29 95 40 84 51 96 68 82 72 92 92Q54 {65+i*2} 6 50Z',VIOLET,INK,1.2,'opacity=".55"')
        b+=line('M10 50 83 22M10 50 89 51M10 50 84 79',LILAC,2)
        return b
    if kind=='eyes':
        b=path('M8 29 44 45 37 68Q12 65 8 29ZM55 45 92 29Q90 65 61 68Z',CREAM,INK,2)
        b+=ellipse(34+i,52,4,10,PINK,INK,1)+ellipse(68+i,52,4,10,PINK,INK,1)
        return b
    if kind=='confetti':return sparkburst(50,50,max(5,32-i*4),GOLD,i)+confetti(i)
    if kind=='megaphone':
        b=path('M26 40 72 18 78 71 30 60Z',ORANGE,INK,2)+ellipse(74,45,11,27,GOLD,INK,2)
        b+=path('M26 56 30 82 43 80 39 55Z',PURPLE,INK,2)+path('M14 39H32V61H14Z',LILAC,INK,2)
        b+=line(f'M89 24 96 {16-i*2}M90 46H98M89 67 96 {76+i}',WHITE,2)
        return b
    raise ValueError(kind)


SPECIALS = {
    'laser': [('beam',1,192,32,'beam'),('flare',3,64,64,'flare'),('scorch',4,96,64,'scorch')],
    'target-lock': [('reticle',4,80,80,'reticle'),('mark',1,64,64,'mark')],
    'deal-with-it': [('shades',1,72,32,'shades'),('shock',6,128,96,'shock')],
    'tear-flood': [('wave',6,256,128,'wave'),('splash',4,112,96,'splash')],
    'charm': [('hearts',6,96,112,'hearts'),('mark',4,56,64,'heart-mark')],
    'play-dead': [('ghost',6,96,128,'ghost'),('scare',6,128,128,'scare')],
    'stare-down': [('cone',4,256,192,'cone'),('eyes',4,96,64,'eyes')],
    'confetti': [('bomb',6,88,112,'confetti-bomb'),('burst',6,128,128,'confetti')],
    'pep-talk': [('megaphone',4,96,96,'megaphone'),('aura',4,128,128,'aura')],
}
ULTIMATES = {
    'meteor': [('meteor',4,192,224,'meteor'),('impact',6,288,176,'impact'),('fire',4,208,112,'fire')],
    'tidal': [('wave',6,384,256,'tidal')],
    'twister': [('twister',6,256,288,'twister')],
    'vanish': [('smoke',6,208,208,'smoke'),('slash',4,256,192,'slash')],
    'arcane': [('storm',4,256,176,'storm'),('bolt',3,128,240,'arcane-bolt'),('hit',4,160,160,'hit')],
    'bloom': [('bloom',6,240,208,'bloom'),('roots',4,208,128,'roots'),('jar',4,96,128,'jar')],
    'love-bomb': [('bomb',4,192,208,'love-bomb'),('wave',6,288,208,'heart-wave')],
    'purify': [('light',6,176,320,'light'),('ring',6,256,112,'ring')],
    'thunder': [('bolt',4,176,320,'bolt'),('chain',1,192,40,'chain'),('hit',4,160,160,'hit')],
    'candy-bomb': [('bomb',4,224,192,'candy-bomb'),('blast',6,288,224,'blast')],
}


def tile(kind, w, h):
    # Identical endpoint value and tangent; tile seams remain invisible at any length.
    if kind=='beam':
        b=''
        for yy,alpha in [(h*.44,.06),(h*.33,.13),(h*.23,.35),(h*.11,1)]:
            b+=path(f'M0 {h/2-yy}H{w}V{h/2+yy}H0Z',WHITE,'none',0,f'opacity="{alpha}"')
        return b
    if kind=='moon':
        b=path(f'M0 {h*.27}Q{w*.25} 0 {w*.5} {h*.27}T{w} {h*.27}V{h*.73}Q{w*.75} {h} {w*.5} {h*.73}T0 {h*.73}Z',LILAC,'none',0,'opacity=".5"')
        return b+line(f'M0 {h/2}H{w}',MINT,9,'opacity=".25"')+line(f'M0 {h/2}H{w}',WHITE,3)
    color=MINT if kind=='wisp' else LILAC if kind=='moon' else GOLD
    d=f'M0 {h/2}L{w/8} {h/2} {w/4} {h*.24} {w*.4} {h*.76} {w*.6} {h*.24} {w*.75} {h*.76} {w*.875} {h/2}H{w}'
    return line(d,color,12,'opacity=".12"')+line(d,color,7,'opacity=".3"')+line(d,color,4)+line(d,WHITE,1.6)


def specials_ultimates():
    for prefix,specs in [('special',SPECIALS),('ult',ULTIMATES)]:
        for atlas,sequences in specs.items():
            for name,count,w,h,kind in sequences:
                for i in range(count):
                    if kind in ('beam','chain'):
                        b=tile(kind,w,h)
                    elif kind=='shades': b=group(shades(66), 'translate(36 12)')
                    else:b=group(effect(kind,i,count),f'scale({w/100} {h/100})')
                    add(f'{prefix}-{atlas}',name if count==1 else f'{name}/{i}',w,h,b,grain=kind not in ('beam','chain'))

def signature():
    specs={
        'rainbow-barf':[('stream','mouth',88,80,(.82,.12),'none')],
        'bubble-pop':[('bubble','mouth',80,80,(.5,.5),'none')],
        'bling':[('tooth','mouth',48,40,(.5,.5),'none')],
        'coin-flip':[('coin','mouth',48,72,(.5,.9),'none')],
        'drool':[('drip','mouth',44,64,(.5,.14),'none')],
        'honk-honk':[('nose','nose',48,48,(.5,.5),'none'),('party','top',96,56,(.5,1),'none')],
        'flirt':[('kiss','mouth',72,56,(.18,.6),'none')],
        'sob':[('tear','eye0',32,64,(.5,.12),'none'),('tear','eye1',32,64,(.5,.12),'none')],
        'grr':[('teeth','mouth',48,32,(.5,.5),'none'),('anger','top',60,42,(.5,1),'none')],
        'heart-eyes':[('heart','eye0',40,48,(.5,.65),'eyes'),('heart','eye1',40,48,(.5,.65),'eyes')],
        'laser-blink':[('laser','eye0',88,32,(.13,.5),'eyes'),('laser','eye1',88,32,(.13,.5),'eyes')],
        'faint':[('cross','eye0',28,28,(.5,.5),'eyes'),('cross','eye1',28,28,(.5,.5),'eyes'),('stars','top',88,40,(.5,1),'none')],
        'waterworks':[('spray','eye0',68,64,(.2,.12),'none'),('spray','eye1',68,64,(.2,.12),'none')],
        'scan':[('visor','eyes',68,32,(.5,.5),'eyes')],
        'deal-with-it':[('lens','eye0',32,48,(.5,.73),'eyes'),('lens','eye1',32,48,(.5,.73),'eyes'),('bridge','eyes',22,48,(.5,.73),'eyes')],
        'steam':[('steam','top',112,64,(.5,1),'none')],
        'side-eye':[('squint','eye0',32,28,(.5,.5),'eyes'),('squint','eye1',32,28,(.5,.5),'eyes')],
        'giggle':[('ha','top',88,48,(.5,1),'none')],
    }
    for emote,layers in specs.items():
        desc={'ms':1600,'layers':[]}
        drawn=set()
        for name,anchor,w,h,origin,rotate in layers:
            key=f'sig/{emote}/{name}'
            desc['layers'].append({'frames':key,'count':6,'fps':9 if emote in ('deal-with-it','coin-flip','bubble-pop') else 12,'loop':emote not in ('deal-with-it','bubble-pop','faint'),'anchor':anchor,'origin':list(origin),'rotate':rotate,'at':0})
            if name in drawn:continue
            drawn.add(name)
            for i in range(6):
                b=''
                if name=='stream':
                    length=[18,31,47,58,62,58][i]
                    b=path(f'M2-6Q-14 1-21 17T{-length} 53L{-length+17} 59Q-16 28 6 5Z',INK,INK,2.4)
                    for j,color in enumerate(['#ff786b',ORANGE,GOLD,'#93d7a3','#65c3e7',VIOLET]):
                        b+=line(f'M{1+j*.5} {-4+j*1.6}C{-15+j*2} {4+j*2} {-16+j*2} {25+j*2} {-length+j*3} {53+j}',color,3.6)
                    b+=line(f'M-4-2Q-15 7-20 20',WHITE,1.5)
                    b+=drop(-length+6,59,.17,PINK,-30)+star(-length-3,41,4,GOLD,4,1)
                elif name=='bubble':
                    r=[5,12,21,30,35,4][i]
                    if i<5:
                        b=circle(0,0,r,PINK,INK,2)+ellipse(-r*.3,-r*.35,max(1,r*.27),max(1,r*.15),WHITE,'none',0)
                        b+=path(f'M{-r*.5} {r*.55}Q{r*.5} {r*.9} {r*.8} {-r*.2}','none','#b54780',2)
                    else:
                        b=sparkburst(0,0,24,PINK,i)
                        for a in range(0,360,60):b+=group(path('M0-29q7-4 9 3l-6 4Z',PINK,INK,1),f'rotate({a})')
                elif name=='tooth':
                    b=path('M-11-7 7-9 9 7Q0 13-8 6Z',GOLD,INK,2)+line('M-6-3 4-4',WHITE,2)
                    b+=star(10,-8,5+i%3*2,WHITE,4,1)+star(-17,9,3+i%2,GOLD,4,.8)
                elif name=='coin':
                    yy=[0,-19,-35,-43,-24,-3][i]; rx=[9,4,1.8,7,10,5][i]
                    b=ellipse(0,yy,rx,11,GOLD,INK,2)+ellipse(-1,yy,rx*.6,7,'none',ORANGE,1)
                    b+=line(f'M0 {yy-4}V{yy+4}M-3 {yy-2}H3',WHITE,1.5)
                    b+=line(f'M-9 {yy+15}q-6 9-3 13',GOLD,1.5)
                elif name=='drip':
                    length=[10,19,27,38,45,22][i]
                    b=path(f'M-7-3Q0 2 7-2L4 {length-5}Q13 {length+8} 2 {length+8}-9 {length+8}-2 {length-4}Z',MINT,INK,1.7)
                    b+=line(f'M1 3 0 {length}',WHITE,2)
                    if i>2:b+=drop(13,42,.25,MINT)
                elif name=='nose':
                    r=[12,17,12,18,12,15][i]
                    b=circle(0,0,r,'#ef6864',INK,2)+ellipse(-r*.3,-r*.4,r*.3,r*.18,WHITE,'none',0)
                    b+=line(f'M{-r-4}-6l-5-4M{r+4}-6l5-4',GOLD,2)
                elif name=='party':b=group(confetti(i),'translate(-45 -49) scale(.9 .8)')
                elif name=='kiss':
                    b=path('M-8 0Q-3-9 1-3 6-8 10 0Q2 10-8 0Z',PINK,INK,1.6)
                    b+=heart(16+i*6,-i*3,.25+i*.025,PINK,-15)+line(f'M12 7l{8+i*3}-2',GOLD,1.5)
                elif name in ('tear','spray'):
                    if name=='tear':
                        length=[21,29,37,43,32,25][i]
                        b=path(f'M-5-2Q0 2 5-2L6 {length-5}Q14 {length+5} 2 {length+8}-9 {length+6}-5 {length-2}Z',BLUE,INK,1.5)
                        b+=line(f'M0 5 1 {length}',WHITE,2)
                    else:
                        xx=22+i*3; yy=26+i*3
                        b=path(f'M-4-3Q{xx+8}-9 {xx+14} {yy}L{xx+7} {yy+6}Q{xx+1} 0 2 4Z',BLUE,INK,1.5)
                        b+=line(f'M1-1Q{xx+4}-3 {xx+9} {yy}',WHITE,2)+drop(xx+12,yy+10,.25,BLUE)
                elif name=='teeth':
                    b=path('M-19-7Q0-2 19-6L16 9Q-1 13-18 7Z',CREAM,INK,2)
                    b+=line('M-16 1H16M-8-4V9M0-3V10M8-3V9',INK,1.3)
                elif name=='anger':
                    b=group(line('M-15-23Q-3-25-4-13M7-26Q4-13 17-13M-4-4Q-5-12-16-9M7-3Q6-11 17-9',INK,6)+line('M-15-23Q-3-25-4-13M7-26Q4-13 17-13M-4-4Q-5-12-16-9M7-3Q6-11 17-9',ORANGE,3),f'rotate({[-8,8,-5,5,0,-3][i]})')
                elif name=='heart':b=heart(0,-2-i%3,.53+i%3*.06,PINK,-8+i*3)+star(12,-21,2+i%2,GOLD,4,.6)
                elif name=='laser':
                    strength=[.25,.5,1,1,.7,.3][i]
                    b=glow(18,0,48,15,PINK,.7)+circle(0,0,6,PINK,INK,1.5)
                    b+=path(f'M0-4 63 {-7*strength} 72 0 63 {7*strength} 0 4Z',PINK,INK,1)
                    b+=line('M0 0H69',WHITE,2.3)+star(0,0,8+i%3,GOLD,4,.7)
                elif name=='cross':
                    b=line('M-8-8 8 8M8-8-8 8',INK,7)+line('M-8-8 8 8M8-8-8 8',CREAM,3)
                elif name=='stars':b=ring(0,-16,34,9,GOLD,i,1.5)
                elif name=='visor':
                    b=path('M-31-10Q0-15 31-10V9Q0 16-31 9Z',PURPLE,INK,2)
                    b+=path('M-27-7H27V6H-27Z',MINT,'none',0,'opacity=".6"')
                    x=-24+i*9
                    b+=line(f'M{x}-8V9',WHITE,3)+line('M-22-3H-12',WHITE,1.4)
                elif name in ('lens','bridge'):
                    yy=[-22,-17,-9,2,0,0][i]
                    if name=='lens':
                        b=group(path('M-14-7H14V4H10V9H-9V6H-13Z',INK,INK,1)+path('M-10-5H-6L-11 1ZM-3-5H1L-9 5H-13Z',WHITE,'none',0),f'translate(0 {yy})')
                    else:b=line(f'M-10 {yy-3}Q0 {yy-8} 10 {yy-3}',INK,3)
                elif name=='steam':
                    for side in (-1,1):
                        b+=group(smoke(0,0,.32+i*.025,i%3,CREAM),f'translate({side*36} {-16-i*4})')
                        b+=line(f'M{side*25}-4Q{side*45}-12 {side*31}-24',CREAM,4)
                elif name=='squint':
                    b=path('M-13-4Q0-9 13-4L12 5Q0 10-12 5Z',WHITE,INK,2)
                    b+=ellipse(4+min(i,3)*1.5,0,3,5,PURPLE,'none',0)+line('M-14-5 13-5',INK,3)
                elif name=='ha':
                    b=text(-19,-19-i%2*4,'HA',18,GOLD,INK,2)+text(17,-7+i%2*3,'HA',17,CREAM,INK,2)
                    b+=line('M-37-13-41-18M36-21 41-26',PINK,2)
                add('sig',f'{key}/{i}',w,h,group(b,f'translate({w*origin[0]} {h*origin[1]})'))
        if emote=='faint':track=[[0,{}],[240,{'r':-10,'y':-3},'backOut'],[620,{'r':65,'y':13,'sx':1.08,'sy':.85},'quadIn'],[1200,{'r':65,'y':13,'sx':1.08,'sy':.85}],[1600,{},'backOut']]
        elif emote=='side-eye':track=[[0,{}],[700,{'x':-3,'sx':1.08,'sy':1.08},'sineInOut'],[1250,{'x':-3,'sx':1.08,'sy':1.08}],[1600,{},'sineInOut']]
        else:track=[[0,{}],[180,{'y':-3,'r':-4,'sx':.97,'sy':1.04},'sineOut'],[360,{'y':1,'r':4,'sx':1.04,'sy':.97},'sineInOut'],[540,{'y':-2,'r':-3},'sineInOut'],[720,{},'sineInOut'],[1600,{}]]
        desc['layers'].append({'portrait':track})
        SIG[emote]=desc


def status(name,i):
    b=''
    if name=='burn':b=flame(32,43,.61,i)
    elif name=='poison':
        b=smoke(32,36,.44,i%3,MINT)+circle(20,17-i%3*2,4,MINT,INK,1)+circle(41,10+i,3,MINT,INK,1)
        b+=ellipse(26,34,2,4,PURPLE,'none',0)+ellipse(38,34,2,4,PURPLE,'none',0)+line('M27 44 37 44',PURPLE,2)
    elif name=='slow':
        b=path(f'M9 25Q22 19 33 25 44 18 55 26L50 {44+i*2}Q44 55 40 40L33 {52-i}Q26 62 23 42Q13 53 11 40Z',PINK,INK,2)
        b+=line('M16 28Q22 24 27 28',WHITE,2)
    elif name=='freeze':
        b=path('M12 49 8 25 21 7 38 5 54 20 57 44 42 58 24 55Z','#7cc8e2',INK,2,'fill-opacity=".67"')
        b+=path('M21 8 28 26 11 25M28 26 48 21 38 6M28 26 23 53M28 26 44 56','none',WHITE,2)
        b+=star(44,13+i*2,5,WHITE,6,0)
    elif name=='fear':b=group(effect('ghost',i,4),'scale(.64)')
    elif name=='charm':b=heart(32,35,.75+i%2*.08)+star(13,14+i*3,4,GOLD,4,1)
    elif name=='confuse':
        b=ring(32,28,23,10,VIOLET,i,2)+text(32,55,'?',23,CREAM,INK,2)
    elif name=='root':b=group(vines(i+1),'translate(2 2) scale(.6)')
    elif name=='mark':b=group(reticle(i),'scale(.64)')
    elif name=='bleed':
        b=drop(31,27+i*3,.85,'#df6680')+drop(48,42-i,.3,PINK)
        b+=line('M12 15 17 8M9 27 15 22',CREAM,2)
    return b


SHARED = [('fx/crit',4,96,96,'crit'),('fx/poison-cloud',6,144,112,'poison-cloud'),
          ('fx/mummy-wrap',6,112,128,'wrap'),('fx/tornado',6,192,192,'twister'),
          ('fx/moonbeam-end',3,64,80,'hit'),('fx/vines',6,144,112,'vines'),
          ('fx/heal',6,96,112,'heal'),('fx/blink',6,128,144,'blink'),
          ('fx/split',6,144,112,'split'),('fx/grab',4,96,96,'grab'),
          ('fx/bones',6,128,112,'bones'),('fx/eggsplosion',6,160,128,'eggsplosion'),
          ('fx/caramel',4,144,80,'caramel'),('fx/revive',6,128,144,'revive'),('fx/talent',6,128,144,'talent')]


def shared_effects():
    for name in 'burn poison slow freeze fear charm confuse root mark bleed'.split():
        for i in range(4):add('fx2',f'status/{name}/{i}',64,64,status(name,i))
    for name,col in [('rotten-egg',MINT),('golden-egg',GOLD)]:
        b=egg(37,33,1.15,45).replace(CREAM,col)
        b+=line('M4 31 13 27M8 43 18 38',col,3)
        if name=='rotten-egg':b+=path('M32 21 38 25 33 30 41 34','none',GREEN,2)+circle(45,39,3,GREEN,'none',0)
        else:b=glow(35,33,31,30,GOLD)+b+star(49,17,5,WHITE,4,1)
        add('fx2',f'proj/{name}',64,64,b)
    for name,kind in [('fx/wisp-chain','wisp'),('fx/moonbeam','moon')]:add('fx2',name,160,32,tile(kind,160,32),grain=False)
    for name,count,w,h,kind in SHARED:
        for i in range(count):
            if kind=='poison-cloud':
                b=smoke(50,57,.65+i*.04,i,MINT)+motes(50,43,23+i*3,i,GREEN,5)
                b+=ellipse(40,53,3,5,PURPLE,'none',0)+ellipse(60,53,3,5,PURPLE,'none',0)
            elif kind in ('wrap','split'):
                b=''
                for j in range(5):
                    yy=24+j*13; off=(i-2)*4 if kind=='split' else math.sin(i+j)*5
                    width=25+i*2 if kind=='split' else 29
                    b+=path(f'M{50-width+off} {yy-5}Q50 {yy+6} {50+width+off} {yy-4}L{48+width+off} {yy+4}Q50 {yy+14} {52-width+off} {yy+2}Z',CREAM,INK,1.4)
                    b+=line(f'M{40+off} {yy+1}l6 1',LILAC,1,'stroke-dasharray="2 2"')
                if kind=='split':
                    b+=path(f'M{46-i*2} 15 54 32 43 49 54 65 47 88','none',VIOLET,2+i)
                    b+=motes(50,52,14+i*5,i,GOLD)
            elif kind=='heal':
                b=ring(50,81,24+i*3,8+i*.5,MINT,i,2)
                for j in range(3):
                    x=24+j*26;y=65-(i*9+j*17)%48
                    b+=path(f'M{x-4} {y-10}h8v6h6v8h-6v6h-8v-6h-6v-8h6Z',MINT,INK,1.5)
                b+=motes(50,46,34,i,WHITE)
            elif kind=='grab':
                b=path('M25 49 32 40 28 20Q31 13 36 20L43 39 40 13Q45 7 49 15L52 38 57 16Q63 13 63 20L62 42 70 30Q77 27 76 37L72 62Q70 81 42 78L17 62Q13 55 21 53L33 58Z',MINT,INK,2)
                b+=candy(50+i*3,52-i*3,.55,-25+i*15,GOLD)
                b+=line('M21 37 12 27M80 64 89 60',WHITE,2)
            elif kind=='bones':
                b=''
                for j in range(7):
                    a=j*math.tau/7+i*.18;r=12+i*6
                    bone=path('M-9-4Q-17-11-17-3-23 3-13 6L9 6Q18 12 18 4 24-3 13-5Z',CREAM,INK,1.6)+line('M-9 1H9',PAPER,2)
                    b+=group(bone,f'translate({50+math.cos(a)*r} {49+math.sin(a)*r*.72}) rotate({j*47+i*19}) scale(.52)')
            elif kind=='caramel':
                b=path('M9 61Q-1 43 22 43 23 28 41 33 58 21 70 39 93 32 90 53 103 64 77 74 47 85 18 70Z','#b8753f',INK,2)
                b+=ellipse(51,58,32,12,GOLD,INK,1.3)
                b+=path(f'M25 61Q{20+i*2} 32 33 22L37 57M64 60Q73 26 83 30L77 65',GOLD,INK,1.5)
                b+=line('M31 56Q47 45 64 53',WHITE,2)
            else:b=effect(kind,i,count)
            add('fx2',f'{name}/{i}',w,h,group(b,f'scale({w/100} {h/100})'))

def lamp_art(angle=0):
    b=ellipse(112,151,22,6,DARK,'none',0,'opacity=".3"')
    pole=path('M-9-4-5-104 5-104 9-4Z',PURPLE,INK,2.5)
    pole+=line('M-3-10-2-98',LILAC,2)+lantern(0,-116,.64)
    b+=group(pole,f'translate(112 151) rotate({angle})')
    if angle>15:b+=line('M104 147 112 139 120 145',GOLD,2)
    return b


def shop_art(i=0,using=False):
    b=ellipse(89,164,82,11,DARK,'none',0,'opacity=".28"')
    b+=path('M28 57 125 50 153 70 150 151 117 167 26 153Z','#b98a64',INK,3)
    b+=path('M125 52 153 70 150 151 118 166Z','#6e525c',INK,2.5)
    b+=path('M30 73 120 74 116 155 28 147Z','#ebc778',INK,2.5)
    b+=path('M34 87 111 86 111 129 33 129Z',PURPLE,INK,2)
    for j in range(3):
        b+=group(candy_jar((i+j)%4),f'translate({35+j*24} 96) scale(.22 .25)')
    b+=path('M20 52Q72 23 137 40L163 76 14 80Z',GOLD,INK,3)
    for j in range(5):
        x=29+j*25
        b+=path(f'M{x} {49-j*2}l12-3 18 31-17 1Z',CREAM,INK,1.2)
    b+=path('M15 78Q24 94 36 80 46 94 58 80 70 92 81 79 93 90 105 78 117 88 128 77 143 88 160 77',GOLD,INK,2.5)
    b+=path('M22 130 118 132 132 142 27 142Z',RUST,INK,2)
    b+=path('M44 141 103 142 103 156 43 154Z',PURPLE,INK,1.5)
    b+=candy(74,147,.48,-7,PINK)
    b+=path('M66 29 68 12 111 9 111 30Z',PURPLE,INK,2)
    b+=candy(88,19,.64,-8,GOLD)
    b+=line('M30 56Q76 37 124 46',WHITE,2)
    if using:
        b+=glow(88,78,78,76,GOLD,.55)
        for j in range(4):
            b+=candy(32+j*36,60-(i*8+j*9)%43,.36,(-1)**j*(i*20),[PINK,MINT,GOLD][j%3])
        b+=star(123,103,5+i%3*2,WHITE,4,1)
    else:b+=star(135,96,3+i%3,GOLD,4,.7)
    return b


def bridge_art(progress=0):
    b=ellipse(120,117,109,8,DARK,'none',0,'opacity=".28"')
    # Hinged on the left bank; the deck shortens in x and lifts into its chains.
    endx=236-progress*132; endy=109-progress*84
    b+=path('M1 108 21 105 21 124 1 126ZM222 108 238 105 238 124 222 126Z','#688c8a',INK,2)
    b+=path(f'M6 116 6 51 {endx} {endy-61} {endx} {endy}Z','#b59178',INK,3)
    for j in range(12):
        t=j/12;x=6+(endx-6)*t;y=116+(endy-116)*t
        b+=line(f'M{x} {y-62}V{y}', '#624b60',1.5)
    b+=line(f'M8 57 {endx-2} {endy-57}',CREAM,3)
    b+=line(f'M8 108 {endx-2} {endy-6}',GOLD,3)
    for y in (52,116):
        b+=path(f'M2 {y}V{y-40}l7-6 7 6v40Z',PURPLE,INK,2)
        b+=circle(9,y-32,3,GOLD,INK,1)
    b+=line(f'M9 16 {endx} {endy-63}M9 79 {endx} {endy}',INK,3,'stroke-dasharray="3 4"')
    b+=circle(10,111,5,GOLD,INK,1.5)+line('M8 108 12 113',CREAM,1.5)
    if progress>0:b+=line('M208 76 215 67M212 92 224 86',MINT,2)
    return b


def props():
    for name,angle in [('0',0),('fall/0',-7),('fall/1',14),('fall/2',38),('fall/3',48),('down',46)]:
        add('props',f'prop/lamp/{name}',224,160,lamp_art(angle))
    for i in range(4):add('props',f'prop/shop/{i}',176,176,shop_art(i))
    for i in range(6):add('props',f'prop/shop/use/{i}',176,176,shop_art(i,True))
    for name,p in [('down',0),('up',1),('move/0',.1),('move/1',.32),('move/2',.7),('move/3',.95)]:
        add('props',f'prop/bridge/{name}',240,184,group(bridge_art(p),'translate(0 56)'))
    fog='<defs><linearGradient id="fog" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#c6d6da" stop-opacity="0"/><stop offset=".48" stop-color="#c6d6da" stop-opacity=".17"/><stop offset="1" stop-color="#c6d6da" stop-opacity="0"/></linearGradient></defs>'
    fog+=path('M0 0H384V80H0Z','url(#fog)','none',0)
    add('props','amb/fog',384,80,fog,grain=False)
    add('props','amb/firefly',20,20,glow(10,10,10,10,GOLD,.8)+circle(10,10,1.8,WHITE,'none',0),grain=False)
    add('props','amb/glow',128,128,glow(64,64,64,64,GOLD,.5),grain=False)
    for i in range(4):
        leaf=path('M-12 1Q-7-13 12-6Q7 12-12 1Z',ORANGE if i%2 else PINK,INK,1.1)+line('M-11 3 8-4',GOLD,1)
        add('props',f'amb/leaf/{i}',32,32,group(leaf,f'translate(16 16) rotate({i*68}) scale({[1,.65,.95,.5][i]} 1)'))
        yy=[-10,-3,6,11][i]
        bat=path(f'M0 0Q-13 {yy-10}-25 {yy-6}L-21 {yy+9}Q-14 {yy+2}-11 11L-4 8M0 0Q13 {yy-10}25 {yy-6}L21 {yy+9}Q14 {yy+2}11 11L4 8',PURPLE,INK,1.2)
        bat+=path('M-5 5-4-7 0-3 4-7 5 5Q0 13-5 5Z',PURPLE,INK,1)+circle(-2,1,1,GOLD,'none',0)+circle(2,1,1,GOLD,'none',0)
        add('props',f'amb/bat/{i}',56,40,group(bat,'translate(28 22)'))


def distance(point, points):
    x,y=point
    best=float('inf')
    for (ax,ay),(bx,by) in zip(points,points[1:]):
        dx,dy=bx-ax,by-ay
        t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy or 1)))
        best=min(best,math.hypot(x-ax-t*dx,y-ay-t*dy))
    return best


def garden_detail(paths,pads,palette,seed=29,bounds=(14,1906),count=730):
    rng=random.Random(seed);b=''
    colors={'rosie':('#a67b8d','#d39aa6','#694655'),'lemon':('#8e9663','#dacf8b','#505b46'),'mint':('#6f9990','#a1c9b3','#3e6264'),
            'monad':('#746a9b','#b6a1d9','#3e3558'),'radioactive':('#748b51','#bad279','#344533'),
            'rare':('#5e6458','#a99766','#2b3031'),'town':('#749586','#c5c391','#3c5d54')}
    mid,light,shade=colors[palette]
    for j in range(count):
        x,y=rng.randrange(*bounds),rng.randrange(14,1066)
        if min(distance((x,y),pp) for pp in paths)<87 or min((math.hypot(x-px,y-py) for px,py in pads),default=float('inf'))<91:continue
        if palette=='mint' and 817<x<1083:continue
        if j%11==0:
            b+=ellipse(x,y+3,20,8,shade,'none',0,'opacity=".3"')
            for k in range(5):
                xx=x+rng.randrange(-15,16); yy=y+rng.randrange(-6,5)
                b+=group(path('M-6 0Q-1-8 7-4Q5 4-6 0Z',[mid,light,RUST][k%3],shade,.8),f'translate({xx} {yy}) rotate({k*57})')
        elif j%9==0:
            for k in range(3):
                xx=x+k*7; yy=y-(k%2)*4
                b+=line(f'M{xx} {yy}v-9',shade,1.2)
                b+=circle(xx,yy-10,3,light,'none',0)+circle(xx,yy-10,1,GOLD,'none',0)
        elif j%7==0:b+=path(f'M{x-5} {y}l3-5 8 1 2 5Z',mid,shade,1)+line(f'M{x-2} {y-3}h5',light,1)
        else:b+=line(f'M{x-4} {y}l2-5 3 4 4-6',mid,1.3)
    return b


def level_rosie():
    rng=random.Random(1208)
    points=road_points()
    road='M'+' '.join(f'{x},{y}' for x,y in points)
    b='<defs><radialGradient id="night"><stop offset="0" stop-color="#84596f"/><stop offset=".7" stop-color="#644760"/><stop offset="1" stop-color="#392b47"/></radialGradient><radialGradient id="lampglow"><stop offset="0" stop-color="#ffbe58" stop-opacity=".27"/><stop offset="1" stop-color="#ffbe58" stop-opacity="0"/></radialGradient></defs>'
    b+=path('M0 0H1920V1080H0Z','url(#night)','none',0)
    # Broad patches establish gardens before small texture, without visual clutter on the road.
    b+=path('M-40 295C80 251 183 252 288 239S409 242 337 322 283 440 153 453-35 480-40 295ZM852-80C850 23 951 23 1023 103S1139 239 1049 301 892 321 851 245 806 93 852-80ZM326 840C423 781 565 757 625 842S647 949 579 1086L201 1088Q221 904 326 840Z','#704c65','none',0)
    b+=path('M873 532C951 503 1031 465 1072 507S1080 638 1039 684 924 732 873 682 831 563 873 532ZM1226 516C1303 484 1413 523 1421 607S1405 738 1341 781 1234 845 1200 783 1175 539 1226 516Z','#755c70','none',0)
    b+=path('M0 21Q512 60 772 4M1176 1039Q1559 958 1920 990','none','#30243c',27,'opacity=".25"')
    # Road shoulder, lower-right ink edge, dusty centre; path is exactly this polyline.
    b+=line(road,'#483442',139)
    b+=line(road,'#967787',127)
    b+=line(road,'#c09aaa',111)
    b+=line(road,'#b88e9f',91)
    b+=line(road,'#d3afba',3,'stroke-dasharray="2 43" opacity=".45"')
    # Individually inked curb stones hug both edges, with stable gaps around bends.
    travelled=0
    last=points[0]
    for index,(x,y) in enumerate(points[1:-1],1):
        travelled+=math.hypot(x-last[0],y-last[1]); last=(x,y)
        if travelled<24:
            continue
        travelled=0
        dx,dy=points[index+1][0]-points[index-1][0],points[index+1][1]-points[index-1][1]
        length=math.hypot(dx,dy)
        nx,ny=-dy/length,dx/length
        a=math.degrees(math.atan2(dy,dx))
        for side in (-1,1):
            xx,yy=x+nx*side*62,y+ny*side*62
            stone=path('M-9-4 7-5 10 3-8 5Z','#b396a6' if side==-1 else '#957889','#675065',1.3)
            b+=group(stone,f'translate({xx:.2f} {yy:.2f}) rotate({a:.2f})')
    b+=garden_detail([points],PADS,'rosie')
    props=[]
    # Quiet tufts and fallen leaves avoid the road and the clear building circles.
    for j in range(580):
        x,y=rng.randrange(18,1902),rng.randrange(18,1062)
        if min(math.hypot(x-px,y-py) for px,py in points)<86 or min(math.hypot(x-px,y-py) for px,py in PADS)<85:
            continue
        col=rng.choice(['#a57b90','#493b51','#906c85','#b88992'])
        if j%4:
            b+=line(f'M{x-5} {y}l3-6 3 6 4-5',col,1.5)
        else:
            b+=path(f'M{x-4} {y}q4-7 9-3-1 7-9 3Z',col,'none',0)
    for x,y in PADS:
        b+=ellipse(x,y+8,84,39,DARK,'none',0,'opacity=".16"')
        b+=path(f'M{x-77} {y}Q{x-62} {y-36} {x} {y-37} {x+73} {y-33} {x+78} {y}Q{x+68} {y+35} {x} {y+36} {x-67} {y+32} {x-77} {y}Z','#876b72','#503d4f',2)
        # Bare garden clearing; the engine overlays pad/empty or pad/glow here.
        for xx,yy in [(-67,-15),(63,12),(-42,28),(51,-23)]:
            b+=path(f'M{x+xx-5} {y+yy}l4-5 7 2-2 5Z','#b998a7','#624b60',1.2)
    scenery=[(75,34,.79,'#a06d83'),(902,20,.77,'#926381'),(1208,-36,.7,'#a77486'),(1549,7,.66,'#996783'),(266,872,.82,'#a67088'),(837,939,.78,'#a06d83'),(1437,829,.78,'#a87588')]
    for x,y,s,c in scenery:
        b+=house(x,y,s,c)
        props.append({'type':'house','x':x,'y':y,'scale':s})
    for x,y,ll,a in [(27,312,244,3),(399,216,137,-8),(834,305,172,8),(1202,205,182,3),(1552,244,254,-4),(192,839,237,-6),(1248,934,127,3),(1586,789,299,-3)]:
        b+=fence(x,y,ll,a)
        props.append({'type':'fence','x':x,'y':y})
    for x,y,s,pine in [(48,421,1.1,True),(373,223,.8,False),(755,194,.72,True),(1143,202,.85,False),(1391,134,.75,True),(1840,291,.95,False),(1876,906,1.1,True),(145,999,1.15,False),(91,796,.9,True),(421,725,.8,False),(505,1000,.85,True),(1075,993,.8,False),(1304,1009,1.0,True),(1798,1065,.8,False),(112,130,.8,False)]:
        b+=tree(x,y,s,pine)
        props.append({'type':'tree','x':x,'y':y,'scale':s})
    for x,y in [(459,302),(894,856),(1168,330),(1568,529),(1707,789)]:
        b+=ellipse(x,y,108,58,'url(#lampglow)','none',0)
        b+=ellipse(x+9,y+4,25,8,DARK,'none',0,'opacity=".3"')
        b+=path(f'M{x-8} {y} {x-4} {y-76} {x+4} {y-77} {x+7} {y}Z',PURPLE,INK,2)
        b+=lantern(x,y-94,.62)
        b+=line(f'M{x-2} {y-7} {x-1} {y-75}',LILAC,1.5)
        props.append({'type':'lamp','x':x,'y':y,'light':{'x':x,'y':y-94,'radius':108}})
    for j,(x,y) in enumerate([(37,691),(68,702),(342,814),(367,822),(454,262),(1102,301),(1522,771),(1557,782),(1817,750),(1835,770),(694,1000),(719,1004)]):
        b+=pumpkin(x,y,.35 if j%2 else .53)
        props.append({'type':'pumpkin','x':x,'y':y})
    # The porch is the only large, brightly lit destination on the right.
    b+=ellipse(1754,612,176,92,'url(#lampglow)','none',0)
    b+=house(1610,279,1.09,'#b67988',True)
    props.append({'type':'porch-house','x':1610,'y':279,'scale':1.09})
    b+=path('M1699 647 1698 669 1706 670 1708 645Z','#996c68',INK,2)
    b+=path('M1667 643 1725 630 1734 652 1672 665Z',CREAM,INK,2)+text(1701,651,'TREATS',10,PURPLE,'none',0)
    # Fireflies are quiet painted accents; dynamic fog and particles belong to the engine.
    for x,y in [(318,723),(79,369),(874,312),(1034,886),(1396,797),(1853,183),(661,913),(1352,315)]:
        b+=circle(x,y,6,GOLD,'none',0,'opacity=".13"')+circle(x,y,1.8,GOLD,'none',0)
    # A soft illustrated border holds attention at the road without masking gameplay.
    b+=path('M0 1014Q39 976 78 1018 105 980 139 1025L193 1080H0ZM1920 1000Q1878 970 1844 1012 1805 973 1775 1028L1732 1080H1920Z',PURPLE,INK,3)
    # The former painted lamp is now a bottom-centred interactive sprite.
    props.append({'kind':'lamp','x':174,'y':661,'use':True,'reach':[[174,661],[273,565]]})
    for x,y in [(180,744),(566,928),(1040,347),(1225,837)]:
        b+=path(f'M{x-17} {y}v-32q17-25 34 0v32Z','#9c8c9c',INK,2)
        b+=line(f'M{x} {y-33}v20M{x-7} {y-26}h14',PURPLE,2)
        b+=ellipse(x,y+3,25,6,'#493b51','none',0)
        props.append({'type':'gravestone','x':x,'y':y})
    data={'size':[1920,1080],'background':'level1.webp','name':'Rosie Row','palette':'rosie','paths':[points],'pads':[{'x':x,'y':y} for x,y in PADS],'porch':{'x':1768,'y':614},'props':props,
          'ambient':{'fireflies':12,'leaves':True,'fog':[925],'glows':[{'x':p['x'],'y':p['y']-94,'r':75} for p in props if p.get('type')=='lamp']}}
    return b,data


def validate_world3(key,data):
    assert data['size']==[1920,1080] and 10<=len(data['pads'])<=12
    routes=data['paths']+([data['switch']['points']] if 'switch' in data else [])
    for pp in routes:
        assert pp[-1]==list(data['porch'].values()),(key,'porch')
        assert not (0<=pp[0][0]<=1920 and 0<=pp[0][1]<=1080),(key,'spawn')
    for pad in data['pads']:
        edge=[(pad['x']+77*math.cos(a*math.tau/48),pad['y']+37*math.sin(a*math.tau/48)) for a in range(48)]
        clearance=min(distance(p,pp) for p in edge for pp in routes)
        assert clearance>70,(key,pad,'clearing intersects road',round(clearance,1))
    for portal in data.get('portals',[]):
        pp=data['paths'][portal['path']]
        assert portal['enter'] in pp and portal['exit'] in pp
        assert pp.index(portal['enter'])<pp.index(portal['exit'])
    for prop in data['props']:
        assert prop['use'] and len(prop['reach'])>=2
        assert any(all(distance(p,pp)<1 for p in prop['reach']) for pp in routes),(key,prop['kind'],'reach off path')
        if 'return' in prop:
            assert any(prop['return'] in pp and prop['reach'][0] in pp and pp.index(prop['return'])<pp.index(prop['reach'][0]) for pp in data['paths'])
    for zone in data.get('zones',[]):
        assert zone['kind']=='toxic' and distance((zone['x'],zone['y']),routes[0])<1
    if key=='townsquare':
        assert len(data['paths'])==4 and 'dark' not in data
        assert {p['kind'] for p in data['props']}=={'lamp','shop','bridge','bell','grate','bonfire'}
        assert len(data['props'])==6
        base=data['paths'][data['switch']['path']];alt=data['switch']['points']
        assert base[0]==alt[0] and base[-1]==alt[-1]
        assert sum(math.dist(a,b) for a,b in zip(alt,alt[1:]))>sum(math.dist(a,b) for a,b in zip(base,base[1:]))
    if key=='level6':assert data['dark'] and len(data['lights'])==5


def preview_world3(key,background,data,images):
    from PIL import ImageChops
    im=background.convert('RGBA')
    for prop in data['props']:
        name=f'prop/{prop["kind"]}/'+('down' if prop['kind']=='bridge' else '0')
        sprite=images[name]
        im.alpha_composite(sprite,(round(prop['x']-sprite.width/2),round(prop['y']-sprite.height)))
    for portal in data.get('portals',[]):
        sprite=images['prop/portal/0']
        for x,y in [portal['enter'],portal['exit']]:im.alpha_composite(sprite,(round(x-sprite.width/2),round(y-sprite.height)))
    outputs=[]
    if data.get('dark'):
        mask=Image.new('L',im.size,round(255*.85))
        for light in data['lights']:
            x,y,r=light.values();cut=Image.new('L',im.size)
            sprite=images['amb/light'].getchannel('A').resize((r*2,r*2),Image.Resampling.LANCZOS)
            cut.paste(sprite,(x-r,y-r));mask=ImageChops.subtract(mask,cut)
        darkness=Image.new('RGBA',im.size,(0,0,0,0));darkness.putalpha(mask)
        dark=Image.alpha_composite(im,darkness)
        dest=ROOT/'preview-level6-darkness.png';save_image(dest,dark.convert('RGB'));outputs.append(dest)
    d=ImageDraw.Draw(im)
    colors=['#ffe49a','#f499da','#7be9ed','#f6ab69']
    paths=data['paths']+([data['switch']['points']] if 'switch' in data else [])
    for j,pp in enumerate(paths):
        col=colors[j%4];d.line([tuple(p) for p in pp],fill=col,width=3)
        for k in range(6,len(pp)-1,12):
            x,y=pp[k];nx,ny=pp[k+1];a=math.atan2(ny-y,nx-x)
            d.polygon([(x+8*math.cos(a),y+8*math.sin(a)),(x+6*math.cos(a+2.5),y+6*math.sin(a+2.5)),(x+6*math.cos(a-2.5),y+6*math.sin(a-2.5))],fill=col)
    for i,pad in enumerate(data['pads']):
        x,y=pad['x'],pad['y'];col='#caff83' if pad.get('boost') else CREAM
        d.ellipse((x-77,y-37,x+77,y+37),outline=col,width=3)
        d.text((x-10,y-11),str(i+1)+(' +' if pad.get('boost') else ''),font=font(20),fill=col,stroke_width=2,stroke_fill=INK)
    for prop in data['props']:
        d.line([tuple(p) for p in prop['reach']],fill='#fc7769',width=5)
        x,y=prop['x'],prop['y'];d.ellipse((x-6,y-6,x+6,y+6),fill='#fc7769',outline=CREAM,width=2)
        d.text((x+11,y+7),prop['kind'],font=font(18),fill=CREAM,stroke_width=2,stroke_fill=INK)
        if 'return' in prop:
            rx,ry=prop['return'];d.line([(x,y),(rx,ry)],fill=MINT,width=2)
            d.ellipse((rx-24,ry-24,rx+24,ry+24),outline=MINT,width=4)
            d.text((rx+27,ry-18),'RETURN',font=font(18),fill=MINT,stroke_width=2,stroke_fill=INK)
    for portal in data.get('portals',[]):
        d.line([tuple(portal['enter']),tuple(portal['exit'])],fill=VIOLET,width=3)
        for name in ('enter','exit'):
            x,y=portal[name];d.ellipse((x-63,y-25,x+63,y+25),outline='#d8b7ff',width=4)
            d.text((x-35,y+30),name.upper(),font=font(18),fill=CREAM,stroke_width=2,stroke_fill=INK)
    for zone in data.get('zones',[]):
        x,y,r=zone['x'],zone['y'],zone['r'];d.ellipse((x-r,y-r,x+r,y+r),outline='#caff83',width=3)
        d.text((x-r,y+r+6),'TOXIC / SPEED',font=font(16),fill=MINT,stroke_width=2,stroke_fill=INK)
    for light in data.get('lights',[]):
        x,y,r=light.values();d.ellipse((x-r,y-r,x+r,y+r),outline=GOLD,width=2)
        d.text((x-25,y-r+5),'LIGHT',font=font(15),fill=GOLD,stroke_width=2,stroke_fill=INK)
    d.rounded_rectangle((18,17,1114,67),8,fill='#211332ed')
    d.text((33,30),data['name']+' / arrows: paths / cream: pads / coral: prop reach / violet: portals / green: zones / gold: lights',font=font(17),fill=CREAM)
    dest=ROOT/f'preview-{key}.png';save_image(dest,im.convert('RGB'));outputs.append(dest)
    return outputs


def main():
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    assert renderer,'rsvg-convert or ImageMagick is required'
    # Earlier art belongs to other batches; hashing it detects accidental writes.
    protected=list((OUT/'levels').glob('level[123].*'))
    protected += [p for p in (OUT/'atlas').iterdir() if p.stem in ('props','fx2','sig') or p.stem.startswith(('special-','ult-'))]
    before={p:hashlib.sha256(p.read_bytes()).digest() for p in protected}
    levels={key:world3(key) for key in ('level4','level5','level6','townsquare')}
    for key,(_,data) in levels.items():validate_world3(key,data)
    props3()
    expected={'prop/bell/0','prop/grate/0','prop/bonfire/0','amb/light'}
    for name,count in [('prop/bell/ring',6),('prop/grate/open',4),('prop/bonfire/burn',6),('prop/portal',6),('fx/teleport',6),('fx/toxic',4),('fx/boost',4),('amb/ember',4)]:
        expected|={f'{name}/{i}' for i in range(count)}
    expected|={f'daily/{name}' for name in ('blood-moon','candy-rain','costume-night','quiet')}
    assert set(FRAMES['props3'])==expected and len(expected)==48
    def draw(job):
        name,(w,h,source)=job
        im=render(source,w*2,h*2,renderer).resize((w,h),Image.Resampling.LANCZOS)
        assert im.getchannel('A').getbbox(),(name,'empty')
        return name,im
    print('Rendering batch 3A: 48 frames and four maps...',flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:images=dict(pool.map(draw,FRAMES['props3'].items()))
    outputs=pack('props3',images)+[preview_atlas('props3',images)]
    atlas=json.loads((OUT/'atlas/props.json').read_text())
    with Image.open(OUT/'atlas/props.png') as sheet:
        for name in ('prop/lamp/0','prop/shop/0','prop/bridge/down'):
            f=atlas['frames'][name]['frame'];images[name]=sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).convert('RGBA')
    for key,(body,data) in levels.items():
        source=ROOT/'svg/batch3a/levels'/f'{key}.svg'
        atomic_write(source,svg(1920,1080,body,data['name']).encode())
        background=render(source,1920,1080,renderer)
        target=OUT/'levels'/f'{key}.webp'
        save_image(target,background.convert('RGB'),'WEBP',quality=95,method=6)
        atomic_write(target.with_suffix('.json'),(json.dumps(data,indent=2)+'\n').encode())
        assert json.loads(target.with_suffix('.json').read_text())==data
        with Image.open(target) as im:assert im.size==(1920,1080)
        outputs += [target,target.with_suffix('.json')]+preview_world3(key,background,data,images)
        length=lambda pp:round(sum(math.dist(a,b) for a,b in zip(pp,pp[1:])),2)
        summary={'level':key,'paths_px':[length(p) for p in data['paths']],'pads':data['pads'],
                 'props':[{k:v for k,v in p.items() if k!='reach'}|{'reach_points':len(p['reach'])} for p in data['props']],
                 **{k:data[k] for k in ('portals','zones','dark','lights') if k in data}}
        if 'switch' in data:summary['detour_px']=length(data['switch']['points'])
        print(json.dumps(summary),flush=True)
    for p,digest in before.items():assert hashlib.sha256(p.read_bytes()).digest()==digest,(p,'earlier asset changed')
    outputs+=list((ROOT/'svg/batch3a').rglob('*.svg'))
    digest=hashlib.sha256()
    for p in sorted(outputs):
        digest.update(str(p.relative_to(ROOT.parents[1])).encode());digest.update(p.read_bytes())
    for p in outputs:
        if p.suffix!='.svg':print(f'{p.relative_to(ROOT.parents[1])}: {p.stat().st_size} bytes',flush=True)
    print(f'SVG masters: {len(list((ROOT/"svg/batch3a").rglob("*.svg")))} / {sum(p.stat().st_size for p in outputs if p.suffix==".svg")} bytes',flush=True)
    print(f'art/siege/build_fx.py: {Path(__file__).stat().st_size} bytes',flush=True)
    print('PASS: 48 contract frames, atlas caps, 2px padding, JSON, off-screen paths, porch endpoints, pad clearance, portal order, upstream grate returns, earlier assets unchanged.',flush=True)
    print('REPRODUCIBILITY SHA256 '+digest.hexdigest(),flush=True)





def sample_curves(curves):
    pts=[]
    for seg in curves:
        for j in range(24):
            t=j/24;weights=[(1-t)**3,3*(1-t)**2*t,3*(1-t)*t*t,t**3]
            pts.append([round(sum(seg[k][a]*weights[k] for k in range(4)),3) for a in (0,1)])
    return pts+[list(curves[-1][-1])]


def painted_road(paths,palette):
    colors={'lemon':['#42473c','#969671','#d7c78b','#c5b57f'], 'mint':['#2b464b','#829b93','#bdd2bc','#aac4b0'],
            'monad':['#272034','#706381','#b5a3bd','#a08bac'], 'radioactive':['#29392e','#718263','#aaa980','#969670'],
            'rare':['#14141c','#9d824a','#777065','#59535a'], 'town':['#283e40','#829a8d','#cdbca0','#baa68c']}
    b=''
    roads=['M'+' '.join(f'{x},{y}' for x,y in points) for points in paths]
    # Paint a road union, then only its exposed kerbs; junctions have no dividers.
    for color,width in zip(colors[palette],[139,127,111,91]):
        for road in roads:b+=line(road,color,width)
    for road in roads:b+=line(road,CREAM,2,'stroke-dasharray="2 43" opacity=".35"')
    stones=set()
    for points in paths:
        last=points[0];travel=0
        for k,(x,y) in enumerate(points[1:-1],1):
            travel+=math.dist(last,(x,y));last=(x,y)
            if travel<26:continue
            travel=0;dx=points[k+1][0]-points[k-1][0];dy=points[k+1][1]-points[k-1][1]
            ll=math.hypot(dx,dy);nx=-dy/ll;ny=dx/ll
            for side in (-1,1):
                xx,yy=x+nx*side*62,y+ny*side*62
                key=(round(xx),round(yy))
                if key in stones or min(distance((xx,yy),pp) for pp in paths)<58:continue
                stones.add(key)
                stone=path('M-9-4 7-5 10 3-8 5Z',colors[palette][1],colors[palette][0],1)
                b+=group(stone,f'translate({xx} {yy}) rotate({math.degrees(math.atan2(dy,dx))})')
    return b


def clearing(x,y,palette):
    fill={'lemon':'#929268','mint':'#6c9285','monad':'#726381','radioactive':'#6e8650','rare':'#535b4a','town':'#6c9285'}[palette]
    b=ellipse(x,y+8,84,39,DARK,'none',0,'opacity=".2"')
    b+=path(f'M{x-77} {y}Q{x-62} {y-36} {x} {y-37} {x+73} {y-33} {x+78} {y}Q{x+68} {y+35} {x} {y+36} {x-67} {y+32} {x-77} {y}Z',fill,'#40534e',2)
    for xx,yy in [(-66,-12),(63,12),(-43,28),(51,-23)]:b+=path(f'M{x+xx-4} {y+yy}l4-5 7 2-2 5Z',CREAM,'#526e64',1)
    return b


def themed_house(x,y,s,palette,porch=False):
    b=house(x,y,s,'#b9a674' if palette=='lemon' else '#7ba996',porch)
    substitutions=({'#cc94a0':'#dac589','#614158':'#62624c','#885d78':'#9c8b61','#6f567f':'#747458','#ac7e9d':'#b2a476','#3e2c5e':'#464c49'} if palette=='lemon' else {'#cc94a0':'#a1c6b3','#614158':'#3e6566','#885d78':'#648f83','#6f567f':'#557574','#ac7e9d':'#8ab4a3','#3e2c5e':'#314f62'})
    for a,z in substitutions.items():b=b.replace(a,z)
    return b


def themed_tree(x,y,s,palette):
    b=tree(x,y,s)
    colors=('#728064','#a8b478','#d1dba0') if palette=='lemon' else ('#497c72','#83b7a0','#b0d8b7')
    for a,z in zip(['#6c486a','#a57491','#c69eae'],colors):b=b.replace(a,z)
    return b


def awning(x,y,s=1):
    b=path('M0 0 73-5 83 18-5 21Z',GOLD,INK,2)
    for j in range(4):b+=path(f'M{j*20+5} 0l9-1 6 20h-12Z',CREAM,INK,1)
    b+=line('M-5 21Q6 29 17 21 28 29 39 21 51 28 61 20 72 26 83 18',INK,2)
    return group(b,f'translate({x} {y}) scale({s})')


def lemonade(x,y,s=1):
    b=path('M-43-8 37-8 40 40-39 39Z','#b29160',INK,2)
    b+=line('M-30-61V-9M29-61V-9',PURPLE,4)+awning(-43,-65)
    b+=path('M-46-13 44-15 47-5-46-3Z',CREAM,INK,2)
    b+=path('M-20-35H-5L-7-14H-18Z',GOLD,INK,1.5)+path('M9-36H25L23-15H11Z',GOLD,INK,1.5)
    b+=line('M-10-36-7-47M17-36 14-46',MINT,2)
    b+=circle(0,18,14,GOLD,INK,2)+line('M0 5V30M-12 18H12M-8 9 8 27M-8 27 8 9',CREAM,1.3)
    return group(b,f'translate({x} {y}) scale({s})')


def string_lights(points):
    b=line('M'+' '.join(f'{x},{y}' for x,y in points),INK,2)
    for i,(x,y) in enumerate(points[1:-1]):
        color=[GOLD,PINK,MINT][i%3]
        b+=glow(x,y+5,14,16,color,.4)+line(f'M{x} {y}v5',INK,1.5)+ellipse(x,y+8,3,5,color,INK,1)
    return b


def new_level(number):
    if number==2:
        prefix=sample_curves([
            [(-100,380),(80,385),(270,344),(450,380)],
            [(450,380),(619,402),(634,583),(800,576)],
            [(800,576),(905,574),(927,527),(1030,540)]])
        branch=sample_curves([
            [(590,-100),(575,23),(608,170),(710,259)],
            [(710,259),(807,333),(844,451),(1030,540)]])
        common=sample_curves([
            [(1030,540),(1156,556),(1190,691),(1330,640)],
            [(1330,640),(1437,601),(1419,494),(1537,525)],
            [(1537,525),(1595,542),(1602,614),(1768,614)]])
        paths=[prefix[:-1]+common,branch[:-1]+common];allpaths=paths
        pads=[(218,231),(351,540),(460,166),(571,670),(978,300),(852,737),(1102,745),(1260,375),(1450,790),(1450,335)]
        palette='lemon';porch=(1768,614)
        props_data=[{'kind':'shop','x':1090,'y':495,'use':True,'reach':common[:36]}]
        scenery=[(52,0,.73),(280,807,.79),(799,817,.72),(1470,858,.7),(1480,4,.65),(948,-4,.67)]
        ground_colors=('#6c7451','#505c48','#313b38')
    else:
        prefix=sample_curves([
            [(-100,660),(85,675),(240,626),(380,660)],
            [(380,660),(532,700),(514,492),(700,500)]])
        direct=sample_curves([
            [(700,500),(752,500),(780,500),(815,500)],
            [(815,500),(905,500),(995,500),(1085,500)],
            [(1085,500),(1175,500),(1224,457),(1320,460)]])
        detour=sample_curves([
            [(700,500),(755,501),(725,343),(746,260)],
            [(746,260),(756,208),(774,210),(815,210)],
            [(815,210),(905,210),(995,210),(1085,210)],
            [(1085,210),(1230,208),(1137,456),(1320,460)]])
        common=sample_curves([
            [(1320,460),(1447,460),(1357,658),(1510,650)],
            [(1510,650),(1604,646),(1661,650),(1768,650)]])
        paths=[prefix[:-1]+direct[:-1]+common]
        alternate=prefix[:-1]+detour[:-1]+common
        allpaths=paths+[alternate]
        pads=[(192,490),(245,830),(517,827),(530,347),(694,91),(1325,227),(1220,671),(1454,299),(1494,828),(1680,803)]
        palette='mint';porch=(1768,650)
        props_data=[{'kind':'bridge','x':965,'y':545,'use':True,'reach':[[815,500],[1085,500]]}]
        scenery=[(16,32,.84),(333,11,.77),(1421,2,.75),(38,905,.67),(1237,890,.63)]
        ground_colors=('#4f8074','#3b625e','#233e47')
    a,z,c=ground_colors
    b=f'<defs><radialGradient id="land"><stop stop-color="{a}"/><stop offset=".72" stop-color="{z}"/><stop offset="1" stop-color="{c}"/></radialGradient></defs>'
    b+=path('M0 0H1920V1080H0Z','url(#land)','none',0)
    for x,y,rx,ry in [(265,130,225,140),(583,850,250,170),(1130,80,260,150),(1620,900,280,155),(1140,590,255,180)]:b+=ellipse(x,y,rx,ry,a,'none',0,'opacity=".28"')
    # Entire curves, including shared ends, use the same data the engine follows.
    b+=painted_road(allpaths,palette)
    b+=garden_detail(allpaths,pads,palette,420+number)
    for x,y in pads:b+=clearing(x,y,palette)
    if number==3:
        b+=path('M846-20Q828 160 848 335T844 660Q824 895 847 1100H1074Q1098 890 1078 661T1080 332Q1061 141 1082-20Z','#263e52',INK,5)
        b+=path('M864-20Q846 160 864 335T860 660Q842 895 863 1100H1058Q1082 890 1062 661T1064 332Q1045 141 1066-20Z','#4f8994','none',0)
        for y in range(12,1080,44):
            b+=line(f'M881 {y}q40 10 78 0M984 {y+21}q32-7 62 0','#8fc7c0',2,'opacity=".55"')
        for yy in range(-10,1100,35):
            for xx in (841,1077):b+=path(f'M{xx-10} {yy}l20-2 1 25-20 2Z','#799992','#354f58',1.5)
        # Fixed north bridge remains painted. Main drawbridge is a runtime sprite.
        bridge=path('M811 177 1089 177 1089 256 1068 270 1068 245 834 245 834 270 811 254Z','#799992',INK,3)
        bridge+=path('M811 167 1089 167 1089 248 811 248Z','#b9cdb5',INK,2)
        for xx in range(820,1090,28):bridge+=line(f'M{xx} 169V246','#76968a',1.5)
        for yy in (170,246):
            bridge+=line(f'M810 {yy}H1090',PURPLE,6)+line(f'M810 {yy-2}H1090',CREAM,2)
            for xx in (820,900,980,1080):bridge+=path(f'M{xx-7} {yy+3}v-24l7-5 7 5v24Z','#abc6b3',INK,1.5)
        b+=bridge
        props_data.append({'type':'fixed-bridge','x':950,'y':255})
        for x,y,angle in [(916,804,-8),(990,64,14)]:
            boat=ellipse(0,5,52,10,'none','#a0d1c8',2)+path('M-50-5Q0 28 50-5L36 16Q0 33-34 15Z','#b79779',INK,3)+path('M-39-6Q0-22 39-6 0 13-39-6Z',PURPLE,INK,2)+line('M-20 0 16-3',CREAM,3)+line('M-28-24 26 29',RUST,5)
            b+=group(boat,f'translate({x} {y}) rotate({angle})')
            props_data.append({'type':'boat','x':x,'y':y})
        for x,y in [(889,348),(918,369),(1011,651),(989,674),(925,945),(976,971)]:
            b+=path(f'M{x+17} {y}A20 10 0 1 1 {x+10} {y-8}L{x} {y}Z',MINT,INK,1.5)+line(f'M{x} {y}l-11 4',GREEN,1)
            b+=heart(x-5,y-5,.16,PINK)
            props_data.append({'type':'lily','x':x,'y':y})
        # The willow silhouette hangs in long, separated fronds above the canal.
        b+=path('M1128 1046 1138 867 1110 811 1127 794 1159 854 1194 807 1207 827 1169 879 1172 1044Z','#665766',INK,4)
        for j in range(9):
            x=1034+j*25;y=797+math.sin(j)*17
            b+=path(f'M1160 824Q{x} {y-84} {x-13} {y+71}Q{x-29} {y+126} {x+2} {y+172}Q{x-5} {y+71} {x+21} {y+29}Q{x+53} {y-23} 1160 824Z','#70a58b',INK,2)
            b+=line(f'M1160 817Q{x+5} {y-41} {x} {y+130}',MINT,1.5)
        props_data.append({'type':'willow','x':1154,'y':1046})
    for x,y,s in scenery:
        b+=themed_house(x,y,s,palette)
        props_data.append({'type':'house','x':x,'y':y,'scale':s})
        if number==2:
            b+=awning(x+34*s,y+168*s,s*.84)
            props_data.append({'type':'awning','x':round(x+34*s),'y':round(y+168*s)})
    for x,y,ll in ([(45,833,178),(745,906,123),(1310,115,164),(1640,847,192)] if number==2 else [(51,421,247),(312,989,268),(1244,110,136),(1568,890,219)]):
        b+=fence(x,y,ll).replace('#c8a4b4','#c1c49d' if number==2 else '#abd0c0')
        props_data.append({'type':'fence','x':x,'y':y})
    trees=([(57,246),(395,100),(652,896),(937,958),(1512,964),(1865,860),(1764,203)] if number==2 else [(56,315),(385,331),(650,990),(714,953),(1839,871),(1857,254)])
    for j,(x,y) in enumerate(trees):
        b+=themed_tree(x,y,.85+(j%3)*.12,palette)
        props_data.append({'type':'tree','x':x,'y':y})
    if number==2:
        for x,y in [(202,738),(990,206),(1385,925)]:
            b+=lemonade(x,y,.92)
            props_data.append({'type':'lemonade-stand','x':x,'y':y})
        for xx,yy,length in [(39,101,405),(850,39,398),(335,890,340)]:
            pts=[[xx+j*length/10,yy+math.sin(j*math.pi/10)*46] for j in range(11)]
            b+=string_lights(pts)
            props_data.append({'type':'string-lights','x':xx,'y':yy})
    b+=glow(porch[0],porch[1],170,84,GOLD,.3)
    b+=themed_house(1610,porch[1]-335,1.09,palette,True)
    props_data.append({'type':'porch-house','x':1610,'y':porch[1]-335,'scale':1.09})
    for x,y in [(39,778),(352,913),(1798,739)]:
        b+=pumpkin(x,y,.44)
        props_data.append({'type':'pumpkin','x':x,'y':y})
    data={'size':[1920,1080],'background':f'level{number}.webp','name':'Lemon Lane' if number==2 else 'Mint Mews','palette':palette,'paths':paths,'pads':[{'x':x,'y':y} for x,y in pads], 'porch':{'x':porch[0],'y':porch[1]},'props':props_data,
          'ambient':{'fireflies':14 if number==2 else 20,'leaves':True,'fog':[940] if number==2 else [750,990],'glows':[{'x':1090,'y':403,'r':80}] if number==2 else [{'x':1165,'y':928,'r':60}]}}
    if number==3:
        data['switch']={'prop':'bridge','path':0,'points':alternate}
        data['fly']=[[[-100,430],[520,455],[960,475],[1370,510],list(porch)]]
    return b,data

def check_contract(kits):
    assert set(SPECIALS)==set(kits['slots']['special'])
    assert set(ULTIMATES)==set(kits['slots']['ultimate'])
    assert set(SIG)==set(kits['slots']['emote']) and len(SIG)==18
    for prefix,specs in [('special',SPECIALS),('ult',ULTIMATES)]:
        for name,rows in specs.items():
            expected={key if n==1 else f'{key}/{i}' for key,n,w,h,kind in rows for i in range(n)}
            assert set(FRAMES[f'{prefix}-{name}'])==expected
    expected={f'status/{name}/{i}' for name in 'burn poison slow freeze fear charm confuse root mark bleed'.split() for i in range(4)}
    expected|={f'{name}/{i}' for name,n,w,h,kind in SHARED for i in range(n)}
    expected|={'proj/rotten-egg','proj/golden-egg','fx/wisp-chain','fx/moonbeam'}
    assert set(FRAMES['fx2'])==expected
    expected={f'prop/lamp/{x}' for x in ['0','down']+[f'fall/{i}' for i in range(4)]}
    expected|={f'prop/shop/{i}' for i in range(4)}|{f'prop/shop/use/{i}' for i in range(6)}
    expected|={f'prop/bridge/{x}' for x in ['up','down']+[f'move/{i}' for i in range(4)]}
    expected|={'amb/fog','amb/glow','amb/firefly'}|{f'amb/{x}/{i}' for x in ['leaf','bat'] for i in range(4)}
    assert set(FRAMES['props'])==expected
    expected=set()
    for emote,data in SIG.items():
        for layer in data['layers']:
            if 'portrait' in layer:continue
            assert layer['anchor'] in ('mouth','nose','eye0','eye1','eyes','top','centre')
            assert layer['rotate'] in ('eyes','none') and all(0<=v<=1 for v in layer['origin'])
            expected|={f"{layer['frames']}/{i}" for i in range(layer['count'])}
    assert set(FRAMES['sig'])==expected


def pack(atlas,items):
    cap=(1024,512) if atlas.startswith('special-') else (2048,1024) if atlas in ('sig','fx2') else (1024,1024)
    choices=[]
    for width in range(64,cap[0]+1,32):
        if max(im.width+4 for im in items.values())>width:continue
        positions,height=shelf(items,width)
        # Shelf's rows are exact; remove only empty outer canvas, never frame pixels.
        width_used=max(x+w+2 for x,y,w,h in positions.values())
        height_used=max(y+h+2 for x,y,w,h in positions.values())
        if height_used<=cap[1]:choices.append((width_used*height_used,width_used,height_used,positions))
    assert choices,(atlas,'exceeds cap',cap)
    _,width,height,positions=min(choices,key=lambda v:(v[0],max(v[1],v[2])))
    sheet=Image.new('RGBA',(width,height));frames={}
    for name,(x,y,w,h) in positions.items():
        sheet.paste(items[name],(x,y))
        frames[name]={'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':w,'h':h},'sourceSize':{'w':w,'h':h},'pivot':{'x':.5,'y':.5}}
    data={'frames':frames,'meta':{'app':'Candy Siege batch 3A' if atlas=='props3' else 'Candy Siege batch 2B','version':'2.0','image':f'{atlas}.png','format':'RGBA8888','size':{'w':width,'h':height},'scale':'1'}}
    # sig.json is deliberately both a JSON Hash atlas and the keyed emote manifest.
    if atlas=='sig':data.update(SIG)
    (OUT/'atlas'/f'{atlas}.png').parent.mkdir(parents=True,exist_ok=True)
    dest=OUT/'atlas'/f'{atlas}.png';save_image(dest,sheet)
    jsonpath=dest.with_suffix('.json');atomic_write(jsonpath,(json.dumps(data,indent=2)+'\n').encode())
    assert json.loads(jsonpath.read_text())==data
    with Image.open(dest) as packed:
        assert packed.size==(width,height)
        for name,(x,y,w,h) in positions.items():
            assert packed.crop((x,y,x+w,y+h)).tobytes()==items[name].tobytes()
            for box in [(x-2,y-2,x+w+2,y),(x-2,y+h,x+w+2,y+h+2),(x-2,y,x,y+h),(x+w,y,x+w+2,y+h)]:
                assert not packed.crop(box).getchannel('A').getbbox(),(atlas,name,'padding')
    print(f'{atlas}: {len(frames)} frames, {width} x {height}',flush=True)
    return [dest,jsonpath]


def preview_sequences(prefix,specs,images):
    rows=[(name,key,n) for name,seq in specs.items() for key,n,w,h,kind in seq]
    cw,ch=160,114;sheet=Image.new('RGB',(1150,45+len(rows)*ch),'#2c2238');d=ImageDraw.Draw(sheet)
    d.text((16,12),f'CANDY SIEGE / {prefix.upper()} / anticipation > release > follow-through',font=font(17),fill=CREAM)
    for row,(atlas,key,count) in enumerate(rows):
        yy=45+row*ch
        d.text((10,yy+6),atlas,font=font(13),fill=GOLD);d.text((10,yy+26),key,font=font(12),fill=CREAM)
        for i in range(count):
            x=177+i*cw
            d.rounded_rectangle((x,yy+3,x+cw-5,yy+ch-4),8,fill='#48374f')
            im=images[f'{prefix}-{atlas}'][key if count==1 else f'{key}/{i}'].copy()
            im.thumbnail((145,93),Image.Resampling.LANCZOS)
            sheet.paste(im,(x+(cw-im.width)//2,yy+7+(91-im.height)//2),im)
            d.text((x+5,yy+ch-18),str(i),font=font(10),fill=LILAC)
    dest=ROOT/f'preview-{prefix}-2b.png';sheet.save(dest);return dest


def preview_atlas(atlas,items):
    cols=10;cw=124;ch=124
    sheet=Image.new('RGB',(cols*cw,40+math.ceil(len(items)/cols)*ch),'#2c2238');d=ImageDraw.Draw(sheet)
    d.text((12,10),f'CANDY SIEGE / {atlas.upper()} / {len(items)} FRAMES',font=font(16),fill=CREAM)
    for j,(name,im) in enumerate(items.items()):
        x=j%cols*cw;y=40+j//cols*ch
        d.rounded_rectangle((x+3,y+3,x+cw-3,y+ch-3),7,fill='#48374f')
        thumb=im.copy();thumb.thumbnail((112,94),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+(cw-thumb.width)//2,y+5+(94-thumb.height)//2),thumb)
        d.text((x+5,y+ch-24),name,font=font(9),fill=CREAM)
    dest=ROOT/f'preview-{atlas}.png';save_image(dest,sheet);return dest


def ease(name,t):
    if name=='sineInOut':return (1-math.cos(math.pi*t))/2
    if name=='sineOut':return math.sin(math.pi*t/2)
    if name=='quadIn':return t*t
    if name=='backOut':return 1+2.70158*(t-1)**3+1.70158*(t-1)**2
    return t


def portrait_pose(track,t):
    defaults={'x':0,'y':0,'r':0,'sx':1,'sy':1}
    if t>=track[-1][0]:return defaults|track[-1][1]
    for left,right in zip(track,track[1:]):
        if left[0]<=t<=right[0]:
            a=defaults|left[1];b=defaults|right[1];q=ease(right[2] if len(right)>2 else 'linear',(t-left[0])/(right[0]-left[0]))
            return {k:a[k]+(b[k]-a[k])*q for k in defaults}
    return defaults|track[0][1]


def signature_preview(images):
    anchors=json.loads((ROOT.parent/'anchors.json').read_text())['sides']
    chogs=json.loads((OUT.parent/'chogs.json').read_text())['chogs']
    byid={str(c['id']):c for c in chogs}
    samples=[('250','right',48),('1','left',48),('250','right',30),('1','left',30)]
    for token,side,r in samples:assert byid[token]['side'].lower()==side
    portraits={token:Image.open(OUT.parent/f'chogs-256/{token}.webp').convert('RGBA') for token,_,_ in samples}
    # Each case includes all three phases on the real portrait at its native radius.
    cw=588;rh=190;left=151
    sheet=Image.new('RGB',(left+cw*4,77+len(SIG)*rh),'#2c2238');d=ImageDraw.Draw(sheet)
    d.text((12,10),'SIGNATURES / real token IDs / 0, 3, 5 / reference R48 + in-game R30',font=font(17),fill=CREAM)
    for c,(token,side,r) in enumerate(samples):d.text((left+c*cw+10,44),f'{side.title()} #{token} / R={r}',font=font(16),fill=GOLD)
    for row,(emote,desc) in enumerate(SIG.items()):
        yy=77+row*rh
        d.text((9,yy+57),emote,font=font(13),fill=CREAM)
        for col,(token,side,r) in enumerate(samples):
            face=anchors[side]['anchors']
            points={k:face[k] for k in ('mouth','nose')}
            points|={'eye0':face['eyes'][0],'eye1':face['eyes'][1],'eyes':[(face['eyes'][0][a]+face['eyes'][1][a])/2 for a in (0,1)]}
            for sample,i in enumerate([0,3,5]):
                canvas=Image.new('RGBA',(320,320));center=160
                portrait=portraits[token]
                diameter=round(2*(64/61)*r)
                im=portrait.resize((diameter,diameter),Image.Resampling.LANCZOS)
                canvas.alpha_composite(im,(center-diameter//2,center-diameter//2))
                mask=Image.new('L',canvas.size);ImageDraw.Draw(mask).ellipse((center-r,center-r,center+r,center+r),fill=255)
                canvas.putalpha(mask)
                ImageDraw.Draw(canvas).ellipse((center-r,center-r,center+r,center+r),outline=GOLD,width=2)
                for layer in desc['layers']:
                    if 'portrait' in layer:continue
                    anchor=layer['anchor']
                    if anchor=='top':ax,ay=center,center-r-3*r/48
                    elif anchor=='centre':ax=ay=center
                    else:
                        ax,ay=[center+(v-500)/500*(64/61)*r for v in points[anchor]]
                    sprite=images['sig'][f"{layer['frames']}/{i}"].copy()
                    sprite=sprite.resize((max(1,round(sprite.width*r/48)),max(1,round(sprite.height*r/48))),Image.Resampling.LANCZOS)
                    overlay=Image.new('RGBA',canvas.size)
                    overlay.alpha_composite(sprite,(round(ax-sprite.width*layer['origin'][0]),round(ay-sprite.height*layer['origin'][1])))
                    if layer['rotate']=='eyes':
                        eyes=face['eyes'];angle=math.degrees(math.atan2(eyes[1][1]-eyes[0][1],eyes[1][0]-eyes[0][0]))
                        overlay=overlay.rotate(-angle,resample=Image.Resampling.BICUBIC,center=(ax,ay))
                    canvas.alpha_composite(overlay)
                track=next(l['portrait'] for l in desc['layers'] if 'portrait' in l)
                pose=portrait_pose(track,i*1000/desc['layers'][0]['fps'])
                sx,sy=pose['sx'],pose['sy']
                canvas=canvas.transform((320,320),Image.Transform.AFFINE,(1/sx,0,center-center/sx,0,1/sy,center-center/sy),Image.Resampling.BICUBIC)
                canvas=canvas.rotate(-pose['r'],Image.Resampling.BICUBIC,center=(center,center))
                imagebox=canvas.crop((84,64,280,244))
                x=left+col*cw+sample*196
                sheet.paste(imagebox,(x+round(pose['x']*r/48),yy+round(pose['y']*r/48)),imagebox)
                d.text((x+74,yy+177),str(i),font=font(10),fill=LILAC)
    dest=ROOT/'preview-sig.png';sheet.save(dest);return dest


def level_preview(number,background,data,images):
    im=background.convert('RGBA')
    for prop in data['props']:
        if not prop.get('use'):continue
        kind=prop['kind'];name=f'prop/{kind}/'+('down' if kind=='bridge' else '0')
        sprite=images['props'][name]
        im.alpha_composite(sprite,(round(prop['x']-sprite.width/2),round(prop['y']-sprite.height)))
    d=ImageDraw.Draw(im)
    paths=data['paths']
    if 'switch' in data:paths=paths+[data['switch']['points']]
    for j,pp in enumerate(paths):
        color=['#ffd669','#f096dc','#f1a0e2'][j%3]
        d.line([tuple(p) for p in pp],fill=color,width=4)
        for k in range(0,len(pp),12):
            x,y=pp[k];d.ellipse((x-4,y-4,x+4,y+4),fill=INK,outline=color,width=2)
    if 'fly' in data:
        for pp in data['fly']:d.line([tuple(p) for p in pp],fill='#94e9ec',width=2)
    for j,pad in enumerate(data['pads']):
        x,y=pad['x'],pad['y']
        d.ellipse((x-77,y-37,x+77,y+37),outline='#eaffd0',width=3)
        d.text((x-9,y-10),str(j+1),font=font(22),fill=CREAM,stroke_width=2,stroke_fill=INK)
    for prop in data['props']:
        if not prop.get('use'):continue
        d.line([tuple(p) for p in prop['reach']],fill='#fc7769',width=6)
        x,y=prop['x'],prop['y'];d.ellipse((x-8,y-8,x+8,y+8),fill='#fc7769',outline=CREAM,width=2)
        d.text((x+15,y+10),prop['kind']+' / reach',font=font(18),fill=CREAM,stroke_width=2,stroke_fill=INK)
    d.rounded_rectangle((18,17,809,70),8,fill='#211332df')
    d.text((33,31),data['name']+' / yellow + pink: routes / red: prop reach / cyan: flyers',font=font(19),fill=CREAM)
    dest=ROOT/f'preview-level{number}.png';im.convert('RGB').save(dest);return dest


def validate_level(number,data,old_level):
    assert data['size']==[1920,1080]
    if number==1:
        assert data['paths']==old_level['paths'] and data['pads']==old_level['pads'] and data['porch']==old_level['porch'],'Rosie geometry changed'
        assert len(data['paths'][0])==193 and len(data['pads'])==8
    else:assert len(data['pads'])==10
    paths=data['paths'][:]
    if 'switch' in data:
        alt=data['switch']['points'];base=paths[data['switch']['path']]
        assert alt[0]==base[0] and alt[-1]==base[-1]
        length=lambda pp:sum(math.dist(a,b) for a,b in zip(pp,pp[1:]))
        assert length(alt)>length(base)+200
        paths.append(alt)
    for pp in paths+data.get('fly',[]):
        assert pp[-1]==[data['porch']['x'],data['porch']['y']]
        assert pp[0][0]<0 or pp[0][1]<0 or pp[0][0]>1920 or pp[0][1]>1080
    for pad in data['pads']:
        if number==1:
            # Original clearings are immutable; retain batch one's clearance check.
            assert min(distance((pad['x'],pad['y']),pp) for pp in paths)>110
            continue
        # Check the entire actual clearing ellipse, not just its centre.
        perimeter=[(pad['x']+77*math.cos(a*math.tau/48),pad['y']+37*math.sin(a*math.tau/48)) for a in range(48)]
        clearance=min(distance(p,pp) for p in perimeter for pp in paths)
        assert clearance>70,(number,pad,'pad edge too close to road',round(clearance,1))
        if number==3:assert pad['x']+77<824 or pad['x']-77>1098,(pad,'pad over canal')
    assert len([p for p in data['props'] if p.get('use')])==1


def build_batch2():
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    assert renderer,'rsvg-convert or ImageMagick is required'
    readonly={p:p.read_bytes() for p in [OUT/'kits.json',OUT/'traits.json']}
    old_level=json.loads((OUT/'levels/level1.json').read_text())
    kits=json.loads(readonly[OUT/'kits.json'])
    specials_ultimates();signature();shared_effects();props()
    check_contract(kits)
    # Validate geometry before spending time on rasterisation.
    levels=[level_rosie(),new_level(2),new_level(3)]
    for n,(_,data) in enumerate(levels,1):validate_level(n,data,old_level)
    jobs=[(atlas,name,entry) for atlas,frames in FRAMES.items() for name,entry in frames.items()]
    images={a:{} for a in FRAMES}
    def render_job(job):
        atlas,name,(w,h,source)=job
        im=render(source,w*2,h*2,renderer).resize((w,h),Image.Resampling.LANCZOS)
        assert im.getchannel('A').getbbox(),(atlas,name,'empty frame')
        return atlas,name,im
    print(f'Rendering {len(jobs)} batch 2B frames with {Path(renderer).name}...',flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for atlas,name,im in pool.map(render_job,jobs):images[atlas][name]=im
    outputs=[]
    for atlas,items in images.items():outputs+=pack(atlas,items)
    for prefix,specs in [('special',SPECIALS),('ult',ULTIMATES)]:outputs.append(preview_sequences(prefix,specs,images))
    for atlas in ('fx2','props'):outputs.append(preview_atlas(atlas,images[atlas]))
    outputs.append(signature_preview(images))
    for n,(body,data) in enumerate(levels,1):
        source=ROOT/'svg/batch2b/levels'/f'level{n}.svg';source.parent.mkdir(parents=True,exist_ok=True)
        source.write_text(svg(1920,1080,body,data['name']))
        background=render(source,1920,1080,renderer)
        target=OUT/'levels'/f'level{n}.webp';target.parent.mkdir(parents=True,exist_ok=True)
        background.convert('RGB').save(target,'WEBP',quality=95,method=6)
        target.with_suffix('.json').write_text(json.dumps(data,indent=2)+'\n')
        assert json.loads(target.with_suffix('.json').read_text())==data
        assert Image.open(target).size==(1920,1080)
        outputs.extend([target,target.with_suffix('.json'),level_preview(n,background,data,images)])
        lengths=[round(sum(math.dist(a,b) for a,b in zip(pp,pp[1:])),2) for pp in data['paths']]
        summary={'level':n,'paths':len(data['paths']),'path_samples':[len(p) for p in data['paths']],'pads':len(data['pads']),'lengths_px':lengths,'interactive_props':[p for p in data['props'] if p.get('use')]}
        if 'switch' in data:
            pp=data['switch']['points'];summary['detour']={'samples':len(pp),'length_px':round(sum(math.dist(a,b) for a,b in zip(pp,pp[1:])),2)}
        if 'fly' in data:summary['fly_lengths_px']=[round(sum(math.dist(a,b) for a,b in zip(pp,pp[1:])),2) for pp in data['fly']]
        # The printed prop list is short; full reach samples live in the shipped JSON.
        summary['interactive_props']=[{'kind':p['kind'],'x':p['x'],'y':p['y'],'reach_points':len(p['reach'])} for p in data['props'] if p.get('use')]
        print(json.dumps(summary),flush=True)
    for p,original in readonly.items():assert p.read_bytes()==original,(p,'read-only input changed')
    outputs+=list((ROOT/'svg/batch2b').rglob('*.svg'))
    digest=hashlib.sha256()
    for p in sorted(outputs):
        digest.update(str(p.relative_to(ROOT.parents[1])).encode());digest.update(p.read_bytes())
    print(f'PASS: {len(jobs)} contract frames; caps, untrimmed rectangles, 2px padding, all emote references, JSON, pad clearance and preserved level-1 geometry.',flush=True)
    print('REPRODUCIBILITY SHA256 '+digest.hexdigest(),flush=True)


def bell_art(phase=None):
    b=ellipse(72,171,58,10,DARK,'none',0,'opacity=".3"')
    b+=path('M22 169 25 34 36 28 42 169ZM106 169 104 28 115 34 122 169Z','#62506c',INK,3)
    b+=path('M16 35 32 13 72 3 111 13 128 35Z',PURPLE,INK,3)
    b+=line('M27 29 72 12 118 29',LILAC,2)+line('M31 44 29 158M113 44 116 158',LILAC,2)
    angle=0 if phase is None else [-8,-22,18,27,-15,5][phase]
    bell=path('M-7 0V-7H7V0M-29 54Q-17 47-18 21Q-18 1 0 0 20 0 19 21Q18 44 31 54Z',GOLD,INK,3)
    bell+=path('M-19 44Q0 53 23 43L30 54Q0 65-29 54Z','#c28647',INK,2)
    bell+=ellipse(0,55,30,7,GOLD,INK,2)+circle(0,62,7,ORANGE,INK,2)
    bell+=line('M-9 12Q-13 20-12 34',CREAM,3)+path('M-4 16 0 10 4 16 0 22Z',VIOLET,INK,1)
    b+=group(bell,f'translate(72 43) rotate({angle})')
    b+=line(f'M{77+angle*.3} 112Q61 126 72 144',CREAM,3)+circle(72,146,5,CREAM,INK,2)
    b+=path('M16 166 129 166 134 180 11 180Z','#8e7e9c',INK,3)
    if phase is not None:
        b+=line(f'M12 67Q{3+phase} 89 14 110M132 65Q{142-phase} 87 131 107',GOLD,3)
        b+=star(19,121,5,CREAM,4,1)+star(125,119,5,CREAM,4,1)
    return b


def grate_art(phase=None):
    b=ellipse(72,77,64,31,'#6f7972',INK,3)+ellipse(72,76,55,24,DARK,INK,2)
    for x,y in [(16,73),(72,51),(128,74),(72,101)]:b+=circle(x,y,3,GOLD,INK,1)
    opening=0 if phase is None else [.15,.45,.8,1][phase]
    cover=ellipse(0,0,53,23,'#839589',INK,3)
    for x in range(-40,41,13):
        hh=math.sqrt(1-(x/52)**2)*18
        cover+=line(f'M{x} {-hh}V{hh}',INK,5)+line(f'M{x+3} {-hh+2}V{hh-2}',MINT,1)
    b+=group(cover,f'translate(72 {76-opening*49}) scale(1 {1-opening*.55})')
    b+=line(f'M20 66V{65-opening*46}M124 66V{65-opening*46}',INK,3)
    if opening:
        b+=line('M45 80l8 8 8-8M70 87l8 8 8-8',MINT,3)
        b+=glow(72,81,44,14,MINT,.4)
    return b


def bonfire_art(phase=None):
    b=ellipse(72,132,61,20,DARK,'none',0,'opacity=".3"')
    for i in range(9):
        a=i*math.tau/9;x=72+49*math.cos(a);y=128+15*math.sin(a)
        b+=ellipse(x,y,13,8,'#887c79',INK,2)+line(f'M{x-5} {y-3}h7',PAPER,1.5)
    for angle in (-24,24):
        log=path('M-43-7H38Q48 0 38 8H-43Z','#805743',INK,2.5)+ellipse(-43,0,6,8,'#c59166',INK,2)+line('M-32-3H24',GOLD,1.4)
        b+=group(log,f'translate(72 124) rotate({angle})')
    if phase is None:
        b+=path('M53 117 67 93 74 107 85 97 96 122Z','#59494b',INK,2)+line('M64 116 70 109',ORANGE,2)
    else:
        b+=glow(72,91,66,62,ORANGE,.7)
        b+=flame(72,100,1.6,phase)+flame(47,116,.8,(phase+2)%6)+flame(94,116,.8,(phase+4)%6)
        for j in range(4):
            x=48+(j*17+phase*7)%55;y=14+(j*17+phase*9)%57
            b+=path(f'M{x} {y}l3-7 2 5-3 5Z',GOLD,'none',0)
    return b


def portal_art(phase):
    b=glow(80,154,76,30,VIOLET,.6)+ellipse(80,168,62,14,'#615174',INK,3)
    b+=path('M25 162 24 82Q21 19 78 13 138 18 138 83L136 162 120 164 122 80Q120 35 80 32 40 37 41 82L42 164Z','#827398',INK,3)
    b+=ellipse(81,101,41,65,PURPLE,INK,3)+glow(81,103,41,64,VIOLET,.9)
    for j in range(3):
        a=phase*60+j*120
        swirl=line('M-30 0C-30-39 26-45 27-9 28 17-13 25-14 4Q-15-8 0-7',VIOLET if j%2 else '#d8b7ff',3-j*.5)
        b+=group(swirl,f'translate(81 101) scale(.95 1.5) rotate({a})')
    for j,(x,y) in enumerate([(28,71),(38,39),(65,22),(100,23),(127,44),(134,77),(132,121),(31,121)]):
        b+=path(f'M{x-4} {y}l4-5 4 5-4 5Z',CREAM if j%3==phase%3 else VIOLET,INK,1)
    b+=ellipse(81,165,37,5,VIOLET,'none',0)+star(79,14,8,GOLD,4,1.5)
    return b


def toxic_art(phase):
    b=glow(64,64,62,59,'#b9ed64',.5)
    b+=path('M12 62Q5 36 28 29 30 9 55 17 77 2 93 25 120 26 116 55 131 77 108 89 107 116 78 110 58 126 40 105 10 110 15 86 0 77 12 62Z','#688e37',INK,2.5,'fill-opacity=".8"')
    b+=path('M23 58Q22 35 47 34 67 15 91 37 117 46 99 69 116 91 87 97 53 112 37 91 15 92 23 58Z','#b6df5b','#d9fc94',2,'fill-opacity=".65"')
    for j in range(5):
        x=32+(j*23)%65;y=38+(j*19)%51;r=3+(j+phase)%4
        b+=circle(x,y,r,'#d9fc94','#6c983c',1)+line(f'M{x-1} {y-2}h2',WHITE,1)
    b+=line('M36 77l9-7-2 10 12-8M76 47l9-7-2 10 12-8',WHITE,2)
    return b


def boost_art(phase):
    b=glow(84,44,82,40,'#c5ff77',.65)
    b+=ellipse(84,44,72,29,'none','#a6e455',3)+ellipse(84,44,62,22,'none',WHITE,1.5)
    for side in (-1,1):
        x=84+side*49
        b+=path(f'M{x-8} 46l8-7 8 7M{x-8} {40-phase*2}l8-7 8 7','none','#dcffa0',3)
    for j in range(4):
        a=(j/4+phase/16)*math.tau
        b+=star(84+72*math.cos(a),44+29*math.sin(a),4,WHITE,4,0)
    return b


def props3():
    add('props3','prop/bell/0',112,144,group(bell_art(),'scale(.777778 .782609)'))
    for i in range(6):add('props3',f'prop/bell/ring/{i}',112,144,group(bell_art(i),'scale(.777778 .782609)'))
    add('props3','prop/grate/0',128,96,group(grate_art(),'scale(.888889 .857143)'))
    for i in range(4):add('props3',f'prop/grate/open/{i}',128,96,group(grate_art(i),'scale(.888889 .857143)'))
    add('props3','prop/bonfire/0',112,128,group(bonfire_art(),'scale(.777778 .8)'))
    for i in range(6):add('props3',f'prop/bonfire/burn/{i}',112,128,group(bonfire_art(i),'scale(.777778 .8)'))
    for i in range(6):
        add('props3',f'prop/portal/{i}',128,160,group(portal_art(i),'scale(.8 .869565)'))
        scale=[.88,.65,.25,.2,.62,.94][i]
        b=glow(56,64,52,62,VIOLET,.65)
        b+=group(path('M-21 29Q-25 11-20-4-30-8-23-17L-14-13Q-16-34 0-35 18-35 15-13L24-18Q31-9 22-4L24 28 8 25 0 31-10 25Z',LILAC,INK,2),f'translate(56 69) scale({scale} 1)')
        b+=ring(56,104,17+abs(2.5-i)*10,8,VIOLET,i,3)+motes(56,64,39,i,CREAM,6)
        add('props3',f'fx/teleport/{i}',96,112,group(b,'scale(.857143 .875)'))
    for i in range(4):
        add('props3',f'fx/toxic/{i}',128,128,toxic_art(i))
        add('props3',f'fx/boost/{i}',168,88,boost_art(i))
        b=''
        for j in range(3):
            x=9+j*11;y=33-(i*7+j*9)%26
            b+=glow(x,y,8,11,ORANGE,.7)+path(f'M{x} {y+4}l-2-5 3-6 2 6Z',GOLD,'none',0)
        add('props3',f'amb/ember/{i}',48,48,b,grain=False)
    light='<defs><radialGradient id="light"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
    add('props3','amb/light',256,256,ellipse(128,128,128,128,'url(#light)','none',0)+light,grain=False)
    # Reuse the original live-theme pictograms, cropping away their title ribbons.
    for name in ['blood-moon','candy-rain','costume-night','quiet']:
        import xml.etree.ElementTree as ET
        source=ET.fromstring((ROOT.parent/'themes'/f'{name}.svg').read_text())
        scene=list(source)[-1]
        picture=''.join(ET.tostring(child,encoding='unicode') for child in list(scene)[3:-1])
        b=path('M8 6 87 9 91 85 5 89Z',VIOLET if name=='quiet' else PURPLE,INK,3)
        b+=group(picture,'translate(-7 -14) scale(.57)')
        add('props3',f'daily/{name}',96,96,b)


def estate(x,y,s=1,gold=False,porch=False):
    b=house(0,0,1,'#676072' if gold else '#736091',porch)
    colors={'#cc94a0':'#77736b' if gold else '#9b83b6','#614158':'#3a353d' if gold else '#49395f',
            '#885d78':'#575057' if gold else '#735d96','#6f567f':'#363540' if gold else '#695388',
            '#ac7e9d':'#b19958' if gold else '#a88dc9','#3e2c5e':'#24252f' if gold else '#352947',
            GOLD:'#ffe49a' if gold else '#a68bff',ORANGE:'#c59c51' if gold else '#7856b6'}
    for a,z in colors.items():b=b.replace(a,z)
    trim=GOLD if gold else LILAC
    b+=line('M10 143 108 19 214 140M218 149 271 154M38 155V243M197 155V261',trim,4)
    for xx in (32,191):
        b+=path(f'M{xx-8} 250h21v11h-21ZM{xx-4} 164h12v84h-12Z',trim,INK,2)
        b+=line(f'M{xx+1} 175v62',CREAM,1)
    b+=path('M63 90 77 30 96 84ZM226 137 245 84 266 143Z',PURPLE,INK,3)
    b+=line('M77 31V12M245 85V69',trim,3)+star(77,12,6,trim,4,1)
    for xx,yy in [(72,194),(104,109),(229,195)]:
        b+=path(f'M{xx} {yy-9}l5 9-5 9-5-9Z',CREAM if gold else '#e2c7ff',INK,1)
    if gold:
        b+=path('M110 147 115 128 126 139 137 125 150 139 161 128 166 149Z',GOLD,INK,2)
        b+=circle(139,150,4,CREAM,INK,1)
    else:
        b+=line('M202 216Q229 195 243 233M203 226Q228 211 249 242','#53635b',3)
        for xx,yy in [(210,218),(229,214),(240,230)]:b+=ellipse(xx,yy,6,3,'#91a17d',INK,1)
    return group(b,f'translate({x} {y}) scale({s})')


def iron_fence(x,y,length,chain=False):
    b=''
    if chain:
        b+=path(f'M0-66H{length}V-5H0Z','#a2b59d','none',0,'fill-opacity=".08"')
        for xx in range(0,length+1,18):
            end=min(62,length-xx)
            b+=line(f'M{xx}-66l{end} {end}M{xx}-5l{end} {-end}','#9ba995',1)
        b+=line(f'M0-66H{length}M0-5H{length}',INK,3)
    else:
        b+=line(f'M0-13H{length}M0-46H{length}',INK,4)
        for xx in range(10,length,21):
            b+=line(f'M{xx} 0V-63',INK,4)+line(f'M{xx+1}-8V-53',LILAC,1)
            b+=path(f'M{xx}-73l-5 10 5 5 5-5Z',LILAC,INK,2)
            b+=line(f'M{xx}-42q10-15 20 0',INK,2)
    for xx in (0,length):
        b+=path(f'M{xx-5} 4V-78h10V4Z','#69736e' if chain else PURPLE,INK,2)
        b+=circle(xx,-80,5,GOLD if not chain else MINT,INK,1)
    return group(b,f'translate({x} {y})')


def hedge(points):
    d='M'+' '.join(f'{x},{y}' for x,y in points)
    b=group(line(d,DARK,33),'translate(3 7)','opacity=".35"')
    b+=line(d,INK,29)+line(d,'#344d48',23)+line(d,'#668270',16)
    for (x,y),(xx,yy) in zip(points,points[1:]):
        count=max(1,int(math.dist((x,y),(xx,yy))/15))
        for j in range(count):
            px=x+(xx-x)*j/count;py=y+(yy-y)*j/count
            b+=ellipse(px-3,py-5,7,4,'#78957a','none',0)
            b+=line(f'M{px-5} {py+2}q3-4 6-1','#344d48',1.4)
    return b


def barrel(x,y,s=1,tilt=0):
    b=ellipse(0,6,25,9,DARK,'none',0,'opacity=".3"')
    b+=path('M-19-48Q0-57 19-48V1Q0 12-19 1Z','#789348',INK,3)
    b+=ellipse(0,-48,19,7,'#a4b765',INK,2)+ellipse(0,-48,10,3,'#566447',INK,1)
    b+=line('M-19-36Q0-29 19-36M-19-8Q0-1 19-8',INK,4)+line('M-13-29V-14',MINT,2)
    b+=circle(1,-22,10,GOLD,INK,1.5)+circle(1,-22,2,INK,'none',0)
    for a in (0,120,240):b+=group(path('M-2-5-5-10 5-10 2-5Z',INK,'none',0),f'translate(1 -22) rotate({a})')
    return group(b,f'translate({x} {y}) rotate({tilt}) scale({s})')


def quarry(x,y,s=1):
    b=path('M-163-40-107-81 32-83 148-53 183 6 140 65 22 91-116 66-175 8Z','#66775c',INK,4)
    b+=path('M-151-28-85-61 41-61 132-38 151 10 115 46 10 68-105 45-147 7Z','#3f5248',INK,3)
    b+=path('M-118-10-65-36 39-33 106-13 119 13 77 39-19 45-103 24Z','#252f30',INK,3)
    b+=line('M-149-26-127 21-107 43M-86-60-70-36M42-61 35-34M130-38 106-13M141 51 113 21',INK,2)
    b+=line('M-145-38-99-61M-104 54-18 75M52-70 113-52','#9caa7c',3)
    b+=ellipse(0,16,67,24,'#7cab48',INK,2)+ellipse(-5,11,46,13,'#bcdf67','none',0)
    for j in range(5):b+=circle(-39+j*19,10+(j%2)*8,3+j%3,MINT,INK,1)
    for xx,yy in [(-138,-62),(140,-48),(93,65)]:b+=path(f'M{xx-12} {yy}l7-15 18 4 8 16-22 5Z','#a2ae85',INK,2)
    return group(b,f'translate({x} {y}) scale({s})')


def velvet(points):
    b=''
    for (x,y),(xx,yy) in zip(points,points[1:]):
        b+=line(f'M{x} {y-27}Q{(x+xx)/2} {(y+yy)/2+4} {xx} {yy-27}',INK,8)
        b+=line(f'M{x} {y-27}Q{(x+xx)/2} {(y+yy)/2+4} {xx} {yy-27}','#b04e60',5)
    for x,y in points:
        b+=ellipse(x,y,12,4,'#b38b47',INK,2)+line(f'M{x} {y}v-38',GOLD,5)+circle(x,y-39,7,GOLD,INK,2)
    return b


def fountain(x,y):
    b=ellipse(0,19,111,40,DARK,'none',0,'opacity=".3"')
    b+=ellipse(0,0,104,42,'#8aaba4',INK,4)+path('M-102 0V21Q0 88 102 21V0Q0 68-102 0Z','#5f8683',INK,3)
    b+=ellipse(0,-2,91,32,BLUE,INK,3)+ellipse(0,-4,75,23,'#8ed6cf',INK,2)
    b+=path('M-17-4-12-78 13-78 19-4Q0 8-17-4Z','#a7c6b4',INK,3)
    b+=ellipse(0,-78,53,19,'#88b6a9',INK,3)+ellipse(0,-82,46,13,BLUE,INK,2)
    b+=path('M-12-84-8-113H8L14-84Z',CREAM,INK,2)+star(0,-126,21,GOLD,5,3)
    for side in (-1,1):
        b+=line(f'M0-103Q{side*43}-156 {side*57}-35',BLUE,7)+line(f'M0-106Q{side*43}-159 {side*57}-38',CREAM,2)
        b+=line(f'M{side*35}-77Q{side*52}-61 {side*69}-13',BLUE,6)
    b+=line('M-73-2Q-51 6-34-2M29 9Q56 17 74 4',CREAM,2)
    return group(b,f'translate({x} {y})')


def world3(key):
    props_data=[]
    if key=='level4':
        paths=[sample_curves([
            [(-100,540),(70,547),(220,554),(340,540)],[(340,540),(449,528),(398,333),(530,320)],
            [(530,320),(655,306),(824,287),(865,380)],[(865,380),(924,518),(750,704),(850,770)],
            [(850,770),(939,834),(1142,847),(1220,770)],[(1220,770),(1324,666),(1190,451),(1330,430)],
            [(1330,430),(1436,408),(1509,412),(1550,500)],[(1550,500),(1591,594),(1620,630),(1768,630)]])]
        pads=[(270,355),(270,750),(585,515),(600,140),(1050,250),(1035,545),(610,890),(1010,960),(1420,740),(1530,265),(1740,840)]
        name='Mon Manor';palette='monad';ground=('#655779','#493959','#2a223e')
        props_data=[{'kind':'bell','x':1090,'y':428,'use':True,'reach':paths[0]}]
        mechanics={'portals':[{'path':0,'enter':paths[0][48],'exit':paths[0][120]}]}
    elif key=='level5':
        paths=[sample_curves([
            [(-100,760),(60,766),(245,768),(380,740)],[(380,740),(512,712),(407,494),(540,400)],
            [(540,400),(650,310),(800,258),(930,320)],[(930,320),(1080,393),(1020,572),(1170,650)],
            [(1170,650),(1252,692),(1303,782),(1420,730)],[(1420,730),(1541,674),(1444,529),(1560,520)],
            [(1560,520),(1642,517),(1632,590),(1768,590)]])]
        pads=[(180,590),(360,930),(340,400),(750,510),(760,160),(1080,190),(1360,400),(1010,820),(1270,940),(1560,900),(1750,185)]
        name='Radioactive Ridge';palette='radioactive';ground=('#64764c','#435a3e','#273e33')
        props_data=[{'kind':'grate','x':1420,'y':766,'use':True,'reach':paths[0][116:125],'return':paths[0][72]}]
        mechanics={'zones':[{'kind':'toxic','x':540,'y':400,'r':60},{'kind':'toxic','x':1170,'y':650,'r':64}]}
    elif key=='level6':
        paths=[sample_curves([
            [(-100,430),(77,452),(228,401),(350,410)],[(350,410),(485,420),(486,640),(650,680)],
            [(650,680),(768,710),(892,800),(1030,740)],[(1030,740),(1177,676),(1145,487),(1300,440)],
            [(1300,440),(1397,403),(1498,384),(1560,420)],[(1560,420),(1657,467),(1594,650),(1768,650)]])]
        pads=[(210,245),(230,650),(510,300),(610,870),(800,520),(1020,940),(1300,740),(1320,235),(1500,650),(1760,850),(1710,170)]
        name='Rare Row';palette='rare';ground=('#3c4242','#292e32','#161b24')
        props_data=[{'kind':'bonfire','x':1050,'y':565,'use':True,'reach':paths[0][65:84]}]
        mechanics={'dark':True,'lights':[{'x':300,'y':465,'r':185},{'x':740,'y':650,'r':180},
                   {'x':1150,'y':570,'r':185},{'x':1475,'y':425,'r':175},{'x':1845,'y':720,'r':160}]}
    else:
        left=sample_curves([[(-100,600),(110,600),(320,600),(480,600)],[(480,600),(605,600),(596,741),(710,740)],[(710,740),(820,739),(855,640),(960,640)]])
        common=sample_curves([[(1200,640),(1110,640),(1060,640),(960,640)]])
        north=sample_curves([[(1060,-100),(1040,78),(1328,30),(1320,210)],[(1320,210),(1316,320),(1298,354),(1290,460)],[(1290,460),(1287,571),(1291,624),(1200,640)]])
        east=sample_curves([[(2020,600),(1800,600),(1590,600),(1420,600)],[(1420,600),(1340,600),(1290,640),(1200,640)]])
        south=sample_curves([[(900,1180),(902,1061),(971,1030),(970,870)],[(970,870),(970,788),(960,727),(960,640)]])
        paths=[left,north[:-1]+common,east[:-1]+common,south]
        alternate=sample_curves([[(2020,600),(1930,600),(1890,600),(1860,600)],[(1860,600),(1790,602),(1880,884),(1790,885)],
                  [(1790,885),(1690,885),(1640,885),(1540,885)],[(1540,885),(1408,885),(1510,603),(1420,600)]])[:-1]+east[24:-1]+common
        pads=[(270,450),(300,790),(530,880),(730,570),(800,970),(1140,950),(1280,805),(1450,385),(1830,220),(1840,1040),(930,180),(1490,155)]
        name='Town Square';palette='town';ground=('#658876','#426858','#29473f')
        props_data=[{'kind':'lamp','x':250,'y':665,'use':True,'reach':[[240,600],[355,600]]},
                    {'kind':'shop','x':585,'y':538,'use':True,'reach':left[24:49]},
                    {'kind':'bridge','x':1660,'y':645,'use':True,'reach':[[1540,600],[1780,600]]},
                    {'kind':'bell','x':735,'y':394,'use':True,'reach':common},
                    {'kind':'grate','x':1290,'y':496,'use':True,'reach':north[44:54],'return':north[24]},
                    {'kind':'bonfire','x':1135,'y':809,'use':True,'reach':south[32:44]}]
        mechanics={'switch':{'prop':'bridge','path':2,'points':alternate}}
    porch=paths[0][-1];allpaths=paths+([mechanics['switch']['points']] if 'switch' in mechanics else [])
    data={'size':[1920,1080],'background':key+'.webp','name':name,'palette':palette,'paths':paths,
          'pads':[{'x':x,'y':y,**({'boost':True} if key=='level5' and i in (2,3,6) else {})} for i,(x,y) in enumerate(pads)],
          'porch':{'x':porch[0],'y':porch[1]},'props':props_data,'ambient':{'fireflies':6 if key=='level6' else 16,'leaves':key!='level5',
          'fog':[920,130] if key=='level4' else [970],'glows':mechanics.get('lights',[])},**mechanics}
    a,z,c=ground
    b=f'<defs><radialGradient id="land"><stop stop-color="{a}"/><stop offset=".72" stop-color="{z}"/><stop offset="1" stop-color="{c}"/></radialGradient></defs>'
    b+=path('M0 0H1920V1080H0Z','url(#land)','none',0)
    for x,y,rx,ry in [(220,140,260,150),(600,870,250,170),(1110,120,260,150),(1600,910,280,155),(1050,550,220,180)]:b+=ellipse(x,y,rx,ry,a,'none',0,'opacity=".28"')
    b+=painted_road(allpaths,palette)+garden_detail(allpaths,pads,palette,603+len(key))
    if key=='level6':
        road='M'+' '.join(f'{x},{y}' for x,y in paths[0])
        b+=line(road,'#ccaa60',61)+line(road,'#632b44',55)+line(road,'#843d52',42)
        b+=line(road,'#c86a75',2,'stroke-dasharray="3 33" opacity=".4"')
    for pad in data['pads']:
        x,y=pad['x'],pad['y'];b+=clearing(x,y,palette)
        if pad.get('boost'):
            b+=ellipse(x,y,72,29,'none','#b3ef62',3)+ellipse(x,y,62,22,'none','#dffe9c',1)
            b+=path(f'M{x-11} {y+10}l12-27-2 18h12l-15 19 3-15Z','#d1ed85',INK,2)
    if key=='level4':
        for pts in [[(50,70),(425,70),(425,207),(360,207),(360,133),(287,133),(287,215),(70,215),(70,140),(209,140)],
                    [(112,180),(231,180),(231,110),(110,110)],[(1140,88),(1330,88),(1330,250),(1200,250),(1200,169),(1280,169)],
                    [(346,974),(346,864),(425,864),(425,1020),(714,1020),(714,933)]]:b+=hedge(pts)
        for x,y,s in [(20,865,.75),(690,-15,.64),(1220,900,.59)]:b+=estate(x,y,s)
        for x,y,ll in [(35,880,228),(1607,174,237),(1660,957,230)]:b+=iron_fence(x,y,ll)
        # Open iron gate leaves frame the approach, without crossing the march.
        for x,y in [(103,432),(103,713)]:
            b+=path(f'M{x-20} {y}v-126l20-14 20 14v126Z','#746384',INK,3)
            b+=path(f'M{x-25} {y-125}l25-44 25 44Z',PURPLE,INK,3)+star(x,y-146,6,VIOLET,4,1)
            b+=iron_fence(x+23,y-15,60)
        for portal in data['portals']:
            for x,y in [portal['enter'],portal['exit']]:
                b+=glow(x,y,99,51,VIOLET,.7)+ellipse(x,y,63,25,'#5b477a',INK,3)
                b+=ellipse(x,y,51,18,'none',LILAC,2)
                for j in range(8):
                    ang=j*math.tau/8;b+=star(x+55*math.cos(ang),y+20*math.sin(ang),4,VIOLET,4,1)
        for x,y in [(55,260),(420,844),(1510,957),(1840,245)]:b+=themed_tree(x,y,.9,'mint').replace('#497c72','#4b5367').replace('#83b7a0','#798d81')
    elif key=='level5':
        for x,y,s in [(245,154,1.15),(726,860,.76),(1530,148,.85)]:b+=quarry(x,y,s)
        for x,y,ll in [(30,302,371),(1180,93,266),(1500,1030,376)]:b+=iron_fence(x,y,ll,True)
        for x,y,tilt in [(55,915,0),(103,912,-9),(448,156,12),(987,996,0),(1690,974,0),(1744,973,8),(1847,721,-11)]:
            b+=barrel(x,y,1,tilt)
        for zone in data['zones']:
            b+=group(toxic_art(0),f'translate({zone["x"]-zone["r"]} {zone["y"]-zone["r"]}) scale({zone["r"]/64})')
        for x,y in [(49,400),(1860,122)]:b+=themed_tree(x,y,.9,'lemon')
        for x,y in [(530,1035),(1190,90)]:
            b+=line(f'M{x} {y}v-55',INK,5)+path(f'M{x-22} {y-75}l44 2-3 34-43-3Z',GOLD,INK,3)
            b+=path(f'M{x} {y-67}l-12 20h24Z',INK,'none',0)+line(f'M{x} {y-62}v8',GOLD,2)+circle(x,y-51,1,GOLD,'none',0)
    elif key=='level6':
        for x,y,s in [(23,8,.65),(715,-14,.8),(1110,-30,.65),(40,807,.79),(1310,872,.66)]:b+=estate(x,y,s,True)
        for pts in [[(65,353),(160,343),(270,333)],[(588,779),(709,813),(850,849)],[(1310,359),(1430,335),(1530,341)]]:b+=velvet(pts)
        for x,y in [(385,961),(1670,1000),(1850,200)]:b+=themed_tree(x,y,1,'lemon').replace('#728064','#3d4742').replace('#a8b478','#6b7460')
        for light in data['lights']:
            x,y,r=light.values();b+=glow(x,y,r,r*.55,GOLD,.25)
            b+=group(lamp_art(),f'translate({x-112} {y-151+76})')
        b+=velvet([(1580,782),(1690,791),(1845,781)])
    else:
        b+=fountain(436,279)
        for x,y,col in [(74,140,PINK),(566,212,MINT),(42,951,GOLD),(1380,995,VIOLET)]:
            b+=group(shop_art(),'translate(%s %s) scale(.85)'%(x,y)).replace(GOLD,col)
        for x,y,ll in [(44,122,380),(461,42,360),(1072,948,403)]:
            pts=[[x+j*ll/12,y+math.sin(j*math.pi/12)*37] for j in range(13)]
            b+=string_lights(pts)
            for j,(xx,yy) in enumerate(pts[1:-1]):b+=path(f'M{xx-7} {yy+4}l14 1-6 17Z',[PINK,GOLD,MINT,VIOLET][j%4],INK,1)
        # A short canal makes the reusable bridge's open state legible; the south crossing is fixed.
        b+=path('M1550 290H1770V1000H1550Z','#607f7c',INK,3)+path('M1566 290H1754V1000H1566Z','#416d7a',INK,2)
        for y in range(310,1000,42):b+=line(f'M1580 {y}q40 9 72 0M1668 {y+13}q35-7 70 0',MINT,2,'opacity=".5"')
        # Only the fixed southern crossing is painted; the upper deck is a runtime sprite.
        b+=group(bridge_art(),'translate(1540 801)')
        for x,y in [(62,393),(652,1007),(1857,999),(1865,105)]:b+=themed_tree(x,y,.9,'mint')
    # Paired chevrons identify the grate's drop area and its upstream pipe outlet.
    for prop in props_data:
        if 'return' not in prop:continue
        gx,gy=prop['return']
        b+=path(f'M{gx-67} {gy+27}q-12-28 12-42l24 10-9 45Z','#566b60',INK,3)
        b+=ellipse(gx-38,gy+18,16,22,DARK,INK,3)+line(f'M{gx-44} {gy+20}l10-7-3 12 13-7','#cdf485',3)
        for x,y in [(gx,gy),(prop['x'],prop['y']-31)]:b+=line(f'M{x+16} {y+17}l-12-7 12-7M{x+29} {y+17}l-12-7 12-7','#d3ef89',3)
    b+=glow(porch[0],porch[1],145,65,GOLD,.3)
    if key=='townsquare':b+=themed_house(porch[0]-158,porch[1]-335,1.09,'lemon',True)
    else:b+=estate(porch[0]-158,porch[1]-335,1.09,key=='level6',True) if key!='level5' else themed_house(porch[0]-158,porch[1]-335,1.09,'lemon',True)
    for x,y in [(34,1052),(1900,1029),(1800,742)]:b+=pumpkin(x,y,.5)
    return b,data


def wide_paths(data):
    paths=data['paths']+([data['switch']['points']] if 'switch' in data else [])
    extended=[]
    for points in paths:
        points=[list(p) for p in points]
        for reverse in (False,True):
            if reverse:points.reverse()
            x,y=points[0];xx,yy=points[1]
            if (x<0 and xx>x) or (x>1920 and xx<x):
                edge=-340 if x<0 else 2260
                points.insert(0,[edge,y+(edge-x)*(yy-y)/(xx-x)])
            if reverse:points.reverse()
        extended.append(points)
    return paths,extended


def wide_scene(body,data):
    palette=data['palette']
    paths,extended=wide_paths(data)
    # Keep the original radial gradient's world-space origin and elliptical radius.
    gradient='night' if palette=='rosie' else 'land'
    body=body.replace(f'<radialGradient id="{gradient}">',
        f'<radialGradient id="{gradient}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(960 540) scale(960 540)">')
    ground=path('M0 0H1920V1080H0Z',f'url(#{gradient})','none',0)
    margin=''
    for side,bounds in enumerate(((-240,0),(1920,2160))):
        margin+=garden_detail(extended,[],palette,830+side,bounds,100)
        hx=-264 if side==0 else 1980
        tx=-88 if side==0 else 2058
        if palette=='radioactive':
            margin+=iron_fence(hx,240,180,True)
            for y in (120,945):
                margin+=group(path('M-51 0-34-26 5-34 44-16 53 9 11 23-40 15Z','#66775c',INK,3)
                    +line('M-34-26-12-8 44-16M-12-8 11 23','#9caa7c',2),f'translate({tx} {y})')
        elif palette=='rare':
            # Unlit outskirts: no new lamps, window light, glow sources or gold trim.
            margin+=iron_fence(hx,280,180).replace(GOLD,'#5e6458').replace(LILAC,'#5e6458')
        else:
            if palette=='monad':margin+=estate(hx,25,.72)
            elif palette=='rosie':margin+=house(hx,20,.72)
            else:margin+=themed_house(hx,20,.72,'lemon' if palette=='lemon' else 'mint')
            margin+=fence(hx,292,190).replace('#c8a4b4',
                {'rosie':'#c8a4b4','lemon':'#c1c49d','mint':'#abd0c0','monad':'#94849f','town':'#abd0c0'}[palette])
        for y in (185,875,1060):
            x=tx+(26 if y==875 else -25)
            if min(distance((x,y-45),p) for p in extended)<140:continue
            if palette=='rosie':margin+=tree(x,y,.92,y==875)
            else:
                foliage=themed_tree(x,y,.92,'lemon' if palette in ('lemon','radioactive','rare') else 'mint')
                if palette=='rare':
                    for a,z in [( '#728064','#3d4742'),('#a8b478','#566052'),('#d1dba0','#6b7460')]:foliage=foliage.replace(a,z)
                if palette=='monad':foliage=foliage.replace('#497c72','#4b5367').replace('#83b7a0','#798d81')
                margin+=foliage
    # New scenery stays outside the play area; existing edge objects keep their overflow.
    clip='<defs><clipPath id="margins"><path d="M-240 0H0V1080H-240ZM1920 0H2160V1080H1920Z"/></clipPath></defs>'
    body=body.replace(ground,path('M-240 0H2160V1080H-240Z',f'url(#{gradient})','none',0)
        +clip+group(margin,extra='clip-path="url(#margins)"'),1)
    for old,new in zip(paths,extended):
        road='M'+' '.join(f'{x},{y}' for x,y in old)
        wider='M'+' '.join(f'{x},{y}' for x,y in new)
        body=body.replace(f'd="{road}"',f'd="{wider}"')
    # Match the exposed kerbs without changing any of the original stone positions.
    stones=''
    for old,new in zip(paths,extended):
        for reverse in (False,True):
            pp=list(reversed(old)) if reverse else old
            qq=list(reversed(new)) if reverse else new
            if pp[0]==qq[0]:continue
            (x,y),(xx,yy)=qq[:2];length=math.hypot(xx-x,yy-y)
            dx,dy=(xx-x)/length,(yy-y)/length
            for step in range(20,int(length),26):
                for side in (-1,1):
                    px=x+dx*step-dy*side*62;py=y+dy*step+dx*side*62
                    col={'rosie':'#b396a6','lemon':'#969671','mint':'#829b93','monad':'#706381',
                         'radioactive':'#718263','rare':'#9d824a','town':'#829a8d'}[palette]
                    stones+=group(path('M-9-4 7-5 10 3-8 5Z',col,INK,1),
                        f'translate({px} {py}) rotate({math.degrees(math.atan2(dy,dx))})')
    body+=group(stones,extra='clip-path="url(#margins)"')
    if palette=='rosie':
        body+=path('M-240 1035Q-201 997-164 1031-125 992-90 1029-47 991 0 1014V1080H-240Z',PURPLE,INK,3)
        body+=path('M1920 1000Q1960 972 1996 1018 2032 982 2070 1026 2114 995 2160 1035V1080H1920Z',PURPLE,INK,3)
    return svg(2400,1080,body,data['name']+' — wide').replace('viewBox="0 0 2400 1080"','viewBox="-240 0 2400 1080"')


def build_wide():
    from PIL import ImageChops
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    assert renderer,'rsvg-convert or ImageMagick is required'
    keys=[f'level{i}' for i in range(1,7)]+['townsquare']
    protected=[OUT/'levels'/f'{key}.{ext}' for key in keys for ext in ('json','webp')]
    before={p:hashlib.sha256(p.read_bytes()).digest() for p in protected}
    preview=Image.new('RGB',(1920,1968),DARK);draw=ImageDraw.Draw(preview)
    draw.text((20,12),'Wide maps · cyan: original 1920 · gold: 19.5:9 (2340) · pink/blue: JSON routes',font=font(22),fill=CREAM)
    digests=[]
    with tempfile.TemporaryDirectory(prefix='candy-wide-') as temporary:
        for i,key in enumerate(keys):
            body,data=level_rosie() if i==0 else new_level(i+1) if i<3 else world3(key)
            stored=json.loads((OUT/'levels'/f'{key}.json').read_text())
            assert data==stored,(key,'drawing master differs from current JSON')
            source=Path(temporary)/f'{key}.svg'
            source.write_text(wide_scene(body,stored))
            wide=render(source,2400,1080,renderer).convert('RGB')
            original=Image.open(OUT/'levels'/f'{key}.webp').convert('RGB')
            # Preserve the already compressed centre exactly; a second lossy encode would alter it.
            wide.paste(original,(240,0))
            target=OUT/'levels'/f'{key}-wide.webp'
            save_image(target,wide,'WEBP',lossless=True,method=6)
            with Image.open(target) as decoded:
                assert decoded.size==(2400,1080)
                difference=ImageChops.difference(decoded.crop((240,0,2160,1080)).convert('RGB'),original)
                assert difference.getbbox() is None,(key,'centre changed')
            digest=hashlib.sha256(target.read_bytes()).hexdigest();digests.append(digest)
            print(f'{target.relative_to(ROOT.parents[1])}: {target.stat().st_size} bytes; centre difference=0; SHA256={digest}',flush=True)
            overlay=wide.copy();marks=ImageDraw.Draw(overlay)
            _,routes=wide_paths(stored)
            for j,points in enumerate(routes):
                marks.line([(x+240,y) for x,y in points],fill=['#ff77c8','#77cfff'][j%2],width=4)
            for points in stored.get('fly',[]):
                marks.line([(x+240,y) for x,y in points],fill='#ffffff',width=2)
            marks.rectangle((240,2,2159,1077),outline='#5dffef',width=5)
            marks.rectangle((30,8,2369,1071),outline='#ffcf59',width=5)
            x=(i%2)*960;y=58+(i//2)*477
            draw.text((x+12,y),f'{stored["name"]} · centre pixel difference: 0',font=font(20),fill=CREAM)
            preview.paste(overlay.resize((960,432),Image.Resampling.LANCZOS),(x,y+30))
    save_image(Path('/tmp/preview-wide.png'),preview)
    for p,digest in before.items():assert hashlib.sha256(p.read_bytes()).digest()==digest,(p,'original changed')
    print('/tmp/preview-wide.png',flush=True)
    print('PASS: seven 2400×1080 maps; exact decoded centres; all original maps and JSON unchanged.',flush=True)
    print('REPRODUCIBILITY SHA256 '+hashlib.sha256(''.join(digests).encode()).hexdigest(),flush=True)



def combat_frame(kind, frame):
    """Small ink-outlined marks, with the same cream, gold and paper grain as fx2."""
    t=frame/3
    if kind=='shield':
        b=ellipse(48,48,39-t*3,43-t*2,BLUE,INK,3,'fill-opacity=".13"')
        b+=ellipse(48,48,35-t*3,39-t*2,'none',CREAM,2,'opacity=".9"')
        b+=line('M23 39Q23 23 39 17M59 80Q72 74 77 62',WHITE,4)
        b+=path('M48 29 64 35 62 54Q58 66 48 71 38 66 34 54L32 35Z',BLUE,INK,2,'fill-opacity=".55"')
        b+=line('M40 48 46 55 57 41',CREAM,3)
        return b
    if kind=='dodge':
        b=''
        for i in range(3):
            x=25+i*18-frame*3
            body=path('M-13 22V-9Q-12-30 5-29 21-26 20-8V22L9 14 0 23-8 16Z',LILAC,INK,2,'fill-opacity=".65"')
            body+=ellipse(0,-10,2,4,CREAM,'none',0)+ellipse(11,-10,2,4,CREAM,'none',0)
            b+=group(body,f'translate({x} 47)',f'opacity="{.5+i*.16-t*.12}"')
        return b+line(f'M7 {70-frame*2}Q29 82 70 67M7 25H27M3 38H20',CREAM,3)
    if kind=='ricochet':
        return line(f'M8 {72-frame*5}Q45 69 78 18',INK,10)+line(f'M8 {72-frame*5}Q45 69 78 18',GOLD,6)+line('M33 74Q62 56 80 32',CREAM,2)+star(77,18,10-t*5,WHITE,4,2)
    if kind=='ring':
        r=23+frame*6
        return circle(48,48,r,'none',CREAM,3)+circle(48,48,r-6,'none',GOLD,1)+''.join(star(48+math.cos(a)*r,48+math.sin(a)*r,5-t*2,CREAM,4,1) for a in (0,math.pi/2,math.pi,math.pi*1.5))
    if kind=='impact-tp':
        return path(f'M9 {31+frame*3}Q37 9 74 32L83 45Q50 20 19 46Z',CREAM,INK,2)+path(f'M15 {60-frame*2}Q56 79 80 54L86 64Q59 89 15 73Z',PAPER,INK,2)+line('M32 31l5 8M52 28l3 9M36 70l2 7M61 69l2 7',INK,1)+star(49,48,10-t*5,WHITE,4,2)
    if kind=='impact-egg':
        b=path('M31 27Q38 33 43 23L46 8 53 27Q55 35 66 28L81 19 71 39Q69 43 84 48L90 55 69 61Q65 63 72 76L60 72Q53 64 49 85L41 74Q41 66 27 73L19 69 29 57Q33 50 15 45L8 36 31 38Z',CREAM,INK,2)
        b+=ellipse(49,49,15+frame,12,GOLD,INK,2)+line('M43 44q7-5 12 0',WHITE,3)
        return group(b,f'translate(48 48) scale({.75+frame*.08}) translate(-48 -48)')
    if kind=='impact-seed':
        return ''.join(group(path('M-4-8 5-4 4 7-3 9-6 1Z',RUST,INK,2),f'translate({48+math.cos(a)*(19+frame*6)} {48+math.sin(a)*(14+frame*5)}) rotate({i*55})') for i,a in enumerate([0,1.1,2.5,3.3,4.6]))+star(48,48,20-t*12,CREAM,6,2)
    colors={'block':'#00F0FF','crit':'#FFE600','impact-magic':VIOLET,'impact-hero':CREAM,'muzzle-egg':GOLD,'muzzle-tp':PAPER,'muzzle-lantern':VIOLET}
    col=colors[kind];r=(32 if kind=='crit' else 26)*(1-.45*t)
    b=star(48,48,r,col,8 if kind=='crit' else 4,3)+star(48,48,r*.54,WHITE,4,1)
    for i in range(5 if kind=='crit' else 3):
        a=i*math.tau/(5 if kind=='crit' else 3)+.25;d=28+frame*5
        x,y=48+math.cos(a)*d,48+math.sin(a)*d
        b+=star(x,y,6-t*3,col,4,1) if kind in ('crit','impact-magic','muzzle-lantern') else line(f'M{x} {y}l{math.cos(a)*7} {math.sin(a)*7}',col,3)
    if kind.startswith('muzzle-'):
        b=group(b,'translate(20 0) scale(.72 1)')+line('M8 37H23M4 49H24M9 61H23',col,3)
    return b


def build_combat():
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    assert renderer,'rsvg-convert or ImageMagick is required'
    kinds=['block','ricochet','dodge','crit','ring','shield','muzzle-egg','muzzle-tp','muzzle-lantern','impact-egg','impact-tp','impact-magic','impact-seed','impact-hero']
    items={}
    with tempfile.TemporaryDirectory(prefix='candy-combat-') as temporary:
        # Two reusable world frames: opaque carved stone and an independently
        # faded rune. The scene controls glyph opacity, never redraws the art.
        stone=ellipse(80,56,73,32,'#110720','none',0,'opacity=".45"')
        stone+=path('M10 44C10 4 150 4 150 44V53C150 94 10 94 10 53Z','#170d26','#110720',3)
        stone+=ellipse(80,43,70,32,'#231536','#492F6E',4)
        stone+=ellipse(80,43,58,24,'none','#492F6E',2)
        stone+=line('M18 29L29 34M14 50L24 49M39 16L45 23M76 12L77 20M117 16L111 23M145 32L133 35M140 60L130 55M106 74L103 65M58 73L61 65M27 65L34 59','#110720',3)
        stone+=line('M24 26Q74 1 130 25','#7A6699',2,'opacity=".45"')
        rune=ellipse(80,42,42,17,'none','#836EF9',2)
        rune+=path('M80 27L100 42 80 57 60 42Z','none','#836EF9',4)
        rune+=line('M80 32V52M69 42H91M32 42H40M120 42H128M80 18V23M80 61V66','#836EF9',3)
        for name,body in [('rune-pad',stone),('rune-glyph',rune)]:
            source=Path(temporary)/(name+'.svg');source.write_text(svg(160,96,body,name,grain=False))
            items['world/'+name]=render(source,160,96,renderer)
        for kind in kinds:
            for frame in range(4):
                name=f'combat/{kind}/{frame}';source=Path(temporary)/f'{kind}-{frame}.svg'
                source.write_text(svg(96,96,combat_frame(kind,frame),name))
                items[name]=render(source,96,96,renderer)
        # Down-pointing cartoon glove: the fingertip is at (56, 150).
        hand=path('M35 42L33 20Q34 12 44 13L85 17Q96 19 94 28L89 49Q103 61 91 82L73 93L72 137Q71 152 60 152Q50 152 50 139L49 100Q36 103 31 94L15 73Q8 62 17 56Q25 51 34 66L36 70L29 52Q26 44 35 42Z',CREAM,INK,5)
        hand+=path('M35 20L91 25L87 44L34 38Z',VIOLET,INK,4)
        hand+=line('M46 52L50 76M61 52L64 72M76 54L76 68',PAPER,4)
        hand+=line('M58 111L59 139',WHITE,5)+line('M40 26L79 30',LILAC,3)
        source=Path(temporary)/'hand.svg';source.write_text(svg(112,160,hand,'Tutorial glove',grain=False))
        items['teach/hand']=render(source,112,160,renderer)
        for name,body in {
            'path-dot':glow(32,32,32,30,'#ffb52e',1)+glow(34,32,24,23,GOLD,1)+path('M13 15L33 32 13 49M31 15L51 32 31 49','none',INK,10)+line('M13 15L33 32 13 49M31 15L51 32 31 49','#fff5bc',6),
            'path-arrow':glow(32,32,30,25,GOLD,.5)+path('M12 25H34V16L53 32 34 48V39H12Z',CREAM,INK,3),
        }.items():
            source=Path(temporary)/(name+'.svg');source.write_text(svg(64,64,body,name,grain=False))
            items['teach/'+name]=render(source,64,64,renderer)
        labels={'block':'BLOCK!','crit':'CRIT!','tink':'TINK','miss':'MISS',**{f'jar-{n}':f'−{n} jar'+('s' if n>1 else '') for n in range(1,11)}}
        for key,value in labels.items():
            name=f'combat/pop/{key}';source=Path(temporary)/f'{key}.svg'
            color = '#EF4444' if key.startswith('jar') else {'block':'#00F0FF','crit':'#FFE600','tink':'#C9D6FF','miss':'#FFFFFF'}[key]
            body = star(100, 35, 33, '#FF7A00', 10, 3) if key == 'crit' else ''
            if key == 'miss': body += text(100,46,value,36,'#FFFFFF','#C9D6FF',7).replace('<text ', '<text opacity=".2" ')
            body += text(100,46,value,36,color,'#1B0F2B',6)
            source.write_text(svg(200,70,body,name,grain=False));items[name]=render(source,200,70,renderer)
    # One small edge-gradient frame stretches over the HUD viewport.
    alarm=Image.new('RGBA',(256,144));pixels=alarm.load()
    for y in range(144):
        for x in range(256):
            edge=max(0,1-min(x/26,(255-x)/26,y/18,(143-y)/18))
            pixels[x,y]=(255, 48, 64, round(255*edge*edge))
    items['teach/alarm']=alarm
    with tempfile.TemporaryDirectory(prefix='candy-porch-') as temporary:
        source=Path(temporary)/'porch.svg';source.write_text(svg(128,128,glow(64,64,63,63,'#ff4555',1),'Porch alarm',grain=False))
        items['teach/porch-flash']=render(source,128,128,renderer)
    pack('fx3',items)
    preview=Image.new('RGB',(800,18*116),DARK);d=ImageDraw.Draw(preview)
    for row,kind in enumerate(kinds):
        d.text((8,row*116+40),kind,font=font(16),fill=CREAM)
        for i in range(4):preview.paste(items[f'combat/{kind}/{i}'],(210+i*135,row*116+8),items[f'combat/{kind}/{i}'])
    for i,key in enumerate(['block','tink','miss','jar-1']):preview.paste(items[f'combat/pop/{key}'],(i*198,15*116),items[f'combat/pop/{key}'])
    save_image(Path('/tmp/knock-combat-atlas.png'),preview.crop((0,0,800,16*116)))


if __name__=='__main__':
    import sys
    build_combat() if '--combat' in sys.argv else build_wide()
