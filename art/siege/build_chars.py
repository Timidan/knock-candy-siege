#!/usr/bin/env python3
"""Batch 2A editable drawing masters. Run: python art/siege/build.py.
Only character atlases, additive face data and preview-* files are written.
"""
import colorsys
import hashlib
import json
import math
import shutil
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
from PIL.PngImagePlugin import PngInfo
import build as b
from build import (ROOT, OUT, INK, PURPLE, DARK, VIOLET, LILAC, CREAM, PAPER,
                   ORANGE, RUST, GOLD, PINK, MINT, GREEN, path, line, ellipse,
                   circle, group, star, candy, pumpkin, egg, paper_roll, lantern)

COSTUMES = {'pitch-deck':'flick', 'scepter':'cast', 'ball-chain':'swing',
            'fastball':'throw', 'slingshot':'shoot', 'egg-lob':'throw', 'junk':'throw',
            'blaster':'shoot', 'fan':'fan', 'ray-gun':'shoot', 'anime':'beam', 'tickle':'slap',
            **{f'mascot-{k}':'slam' for k in ('duck','shark','banana','dragon','toad','mummy')}}
COLORS = dict(zip(COSTUMES, [PURPLE,VIOLET,CREAM,ORANGE,VIOLET,MINT,'#ac8866',
                          '#b66b49',PINK,CREAM,ORANGE,CREAM,GOLD,'#6386a8',GOLD,
                          GREEN,'#7cab76',CREAM]))
FRAMES = {}
RIG_COSTUMES = {}
NEW_FACES = {}


def add(atlas, name, w, h, art, holes=()):
    assert name not in FRAMES.setdefault(atlas, {}), (atlas,name)
    target=ROOT/'svg'/'chars'/atlas/(name+'.svg')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(b.svg(w,h,art,name,holes,grain=name not in ('wpn/beam','wpn/zap')))
    FRAMES[atlas][name]=(w,h,target,holes)


def bandages(shape=''):
    return shape + line('M6 9 26 14M5 17 25 22M5 26 22 31', '#a39baf', 1.5)


def card(x=0,y=0,s=1,r=0):
    a=path('M-13-9 11-12 15 8-10 11Z',CREAM,INK,1.8)
    a+=path('M-11-7 11-10 12-5-10-2Z',VIOLET,'none',0)
    a+=star(-5,3,3,GOLD,4,1)+line('M1 0 9-1M1 4 7 3',PURPLE,1.2)
    return group(a,f'translate({x} {y}) rotate({r}) scale({s})')


def baseball(x=0,y=0,s=1):
    a=circle(0,0,10,CREAM,INK,2)
    a+=line('M-7-7Q4 0-5 9M5-8Q-3 0 8 5',RUST,1.3)
    a+=line('M-5-5-2-5M-3-1 0-2M-3 4 0 3M4-5 6-4M3 0 5 1',RUST,1)
    a+=line('M-7-3-6-5', '#fffaf1',2)
    return group(a,f'translate({x} {y}) scale({s})')


def fan(x=0,y=0,s=1,r=0):
    a=path('M0 15-26-6Q-13-26 10-20L29-3Z',CREAM,INK,2.2)
    a+=path('M-26-6Q-13-26 10-20L29-3 22 2Q-2-13-20 0Z',PINK,INK,1.3)
    a+=line('M0 15-18-9M0 15-7-15M0 15 7-15M0 15 19-6',RUST,1.2)
    a+=path('M-6-4Q0-13 7-4L2-3 5 2-2 0Z',GOLD,INK,1)
    return group(a,f'translate({x} {y}) rotate({r}) scale({s})')


def gun(x=0,y=0,s=1,ray=False):
    a=path('M-10 2-6 17 3 16 5 3Z',RUST,INK,2)
    a+=path('M-18-10 13-13 22-7 22 4 10 9-18 6Z',MINT if ray else PINK,INK,2.4)
    a+=path('M-18-10 10-12 14-7-18-5Z',CREAM,'none',0)
    a+=path('M11-12 23-11 28-7 27 3 19 6 12 4Z',VIOLET,INK,2)
    a+=ellipse(26,-3,4,6,GOLD,INK,1.5)
    a+=circle(-7,-2,5,VIOLET,INK,1.5)+circle(-7,-2,2,CREAM,'none',0)
    a+=line('M-13 11-5 10',GOLD,2)
    if ray:
        a+=line('M-4-13-5-21',INK,2)+circle(-5,-22,4,GOLD,INK,1.5)
        a+=ellipse(20,-3,4,11,'none',GOLD,2)
    return group(a,f'translate({x} {y}) scale({s})')


def duck(x=0,y=0,s=1,r=0):
    a=path('M-19 3-25-5-16-1Q-8 0-7-12-6-23 7-22 20-22 17-8 25-2 18 9 8 19-10 14-19 3Z',GOLD,INK,2.3)
    a+=path('M12-11 26-9 22-3 11-4Z',ORANGE,INK,1.5)+circle(10,-15,2,INK,'none',0)
    a+=path('M-12 3Q0-4 7 4 6 11-6 10',ORANGE,INK,1.5)
    a+=line('M-2-16Q0-20 5-19',CREAM,2)
    return group(a,f'translate({x} {y}) rotate({r}) scale({s})')


def junk_piece(n,x,y,s=1,r=0):
    if n==0:
        a=path('M-9-13 10-12 8 15-10 12-13-3Z','#8295a3',INK,2)+ellipse(0,-12,10,4,CREAM,INK,2)
        a+=line('M-6-5 5-3M-6 2 3 4M-3 8 4 9',PURPLE,2)
    elif n==1:
        a=path('M-9-17 5-17 5 1 15 4 19 12 16 16-14 15-15 8-9 2Z',RUST,INK,2)
        a+=path('M-15 12 19 12 17 17-15 17Z',PURPLE,INK,1.5)+line('M-8-10 3-10M-8-4 2-4M-8 2 2 2',GOLD,2)
    elif n==2:
        a=path('M-5-19 4-19 4-9 11-3 10 17-10 16-11-3-5-9Z',MINT,INK,2)
        a+=path('M-6-20 5-20 5-15-6-15Z',GOLD,INK,1.5)+path('M-9 0 9 0 9 10-9 10Z',CREAM,INK,1.2)
        a+=star(0,5,4,PINK,4,1)
    else:
        a=path('M-22 0-30-8-30 8Z',CREAM,INK,1.8)+line('M-24 0 17 0',INK,5)
        a+=line('M-24 0 17 0',CREAM,2.8)+line('M-13 0-17-9M-13 0-17 9M-4 0-7-8M-4 0-7 8M5 0 3-6M5 0 3 6',INK,4)
        a+=line('M-13 0-17-9M-13 0-17 9M-4 0-7-8M-4 0-7 8M5 0 3-6M5 0 3 6',CREAM,2)
        a+=ellipse(20,0,10,9,CREAM,INK,2)+circle(23,-2,2,INK,'none',0)
    return group(a,f'translate({x} {y}) rotate({r}) scale({s})')


def hero_parts(c):
    atlas='hero-'+c
    col=COLORS[c]
    mascot=c.startswith('mascot-')
    bare=c=='tickle'
    pivots={'torso':[.5,.88],'arm-front':[.42,.2],'arm-back':[.42,.2],
            'leg-front':[.38,.18],'leg-back':[.38,.18], 'weapon':[.32,.72], 'extra':[.7,.3]}
    joints={'head':[0,-78], 'torso':[0,-18], 'arm-front':[18,-44], 'arm-back':[-16,-46],
            'leg-front':[9,-21], 'leg-back':[-9,-22]}
    # Five-pixel overlaps at shoulders/hips keep the inked joints closed in every pose.
    torso=path('M17 6Q24 2 33 7L44 22 45 43Q25 55 4 43L5 22Z',col,INK,2.4)
    torso+=path('M33 9Q36 29 30 47L44 43 44 24Z',DARK,'none',0,'opacity=".19"')
    torso+=line('M11 23 10 35',CREAM,2,'opacity=".48"')
    if c=='pitch-deck':
        torso+=path('M15 8 24 12 34 8 30 34 23 43 17 28Z',CREAM,INK,1.6)
        torso+=path('M24 14 28 18 24 22 28 34 24 39 20 33 22 22 19 18Z',ORANGE,INK,1.1)
        torso+=path('M13 7 8 22 16 24 14 30 23 43 19 21ZM34 7 39 21 32 25 34 30 25 43 29 22Z',VIOLET,INK,1.5)
        torso+=line('M35 31 41 30',GOLD,2)
    elif c=='scepter':
        torso=path('M13 7 35 7 43 31 47 50Q26 60 2 50L7 27Z',VIOLET,INK,2.4)
        torso+=path('M15 8 24 19 33 8 28 35 36 53 20 55 16 33Z',GOLD,INK,1.7)
        torso+=path('M4 45Q24 52 44 45L47 50Q24 58 1 50Z',PURPLE,INK,1.6)
        torso+=star(10,33,4,CREAM,4,1)+star(37,37,5,MINT,4,1)+circle(24,20,3,PINK,INK,1)
    elif c in ('ball-chain','mascot-mummy'):
        for y in (15,25,35,45):
            torso+=path(f'M6 {y} 42 {y-2} 43 {y+4} 5 {y+7}Z',PURPLE if c=='ball-chain' else PAPER,INK,1)
        if c=='ball-chain':
            torso+=path('M13 25 25 25 25 33 13 33Z',GOLD,INK,1.2)+line('M17 27 17 31M21 27 21 31',DARK,1)
        else:
            torso+=line('M13 20 21 17M25 40 32 36M12 40 17 43', '#9c8599',1.4)
    elif c=='fastball':
        torso+=path('M14 7 24 15 35 7 31 4 24 9 17 3Z',CREAM,INK,1.5)
        torso+=path('M4 29 11 31 10 46 4 43ZM37 29 44 28 45 43 38 46Z',CREAM,INK,1.3)
        torso+=path('M15 25 21 20 31 22 35 31 28 38 17 35Z',PURPLE,INK,1.4)+star(25,29,7,GOLD,5,1)
        torso+=line('M7 43Q25 52 43 43',CREAM,2)
    elif c=='slingshot':
        torso+=path('M11 8Q25-4 37 9L34 20 26 24 14 20Z',PURPLE,INK,2)
        torso+=path('M14 11 24 16 34 10 29 26 21 26Z',LILAC,INK,1.5)
        torso+=path('M16 35 34 35 37 43 13 43Z',PURPLE,INK,1.5)
        torso+=line('M21 20 20 31M29 20 30 29',GOLD,1.5)
    elif c=='egg-lob':
        torso+=path('M15 6Q24 18 34 6L31 4Q24 11 18 3Z',GREEN,INK,1.5)
        torso+=egg(25,32,.37,-10)
        torso+=line('M8 43Q26 49 42 43',GREEN,1.8)
    elif c=='junk':
        torso=path('M13 7 34 7 44 20 42 33 48 46 36 43 31 52 22 46 14 51 9 42 2 44 6 20Z','#ac8866',INK,2.4)
        torso+=path('M11 24 22 26 19 39 9 36ZM28 35 38 32 41 45 29 47Z',VIOLET,INK,1.4)
        torso+=line('M12 25 11 28M18 27 18 30M30 37 33 36M30 43 33 42',CREAM,1.2)
        torso+=line('M34 13 8 43',DARK,7)+line('M34 13 8 43',RUST,4)
    elif c=='blaster':
        torso+=path('M14 8 22 14 23 44 14 44 11 24ZM33 8 26 14 26 46 39 42 38 22Z',RUST,INK,1.5)
        torso+=path('M15 5 24 11 32 5 35 11 26 20 22 20 11 11Z',CREAM,INK,1.5)
        torso+=line('M24 20 24 43',GOLD,1.5)+path('M7 38 18 37 18 44 8 44ZM30 37 40 36 40 43 30 44Z',GOLD,INK,1.3)
        torso+=star(35,25,4,MINT,5,1)
    elif c=='fan':
        torso+=path('M15 6 36 9 16 36 11 22Z',RUST,INK,1.4)
        torso+=path('M33 7 16 30 36 33 38 18Z',PINK,INK,1.4)
        torso+=path('M7 32Q25 38 43 30L43 39 8 42Z',GOLD,INK,1.4)
        torso+=path('M31 36 38 42 35 52 28 44Z',GOLD,INK,1.4)
        torso+=line('M20 21Q28 14 32 19M21 24 29 22',CREAM,1.4)
    elif c=='ray-gun':
        torso+=path('M12 8Q24 16 36 7L39 15Q25 24 10 16Z',PAPER,INK,2)
        torso+=path('M12 24 35 22 37 37 12 39Z',VIOLET,INK,1.8)
        torso+=path('M17 28 26 27 26 32 17 33Z',MINT,INK,1)+circle(31,28,2,ORANGE,INK,1)
        torso+=line('M10 42 38 41',PURPLE,4)+line('M38 22Q50 28 39 42',GOLD,3)
    elif c=='anime':
        torso+=path('M13 5 25 14 36 5 32 29 23 38 18 24Z',PURPLE,INK,1.4)
        torso+=path('M13 5 28 31 20 33 8 14ZM37 8 20 36 26 37 42 18Z',GOLD,INK,1.4)
        torso+=path('M7 35 41 34 42 41 7 42Z',VIOLET,INK,1.5)
        torso+=path('M23 38 35 43 40 53 29 47 23 42 14 49 12 43Z',VIOLET,INK,1.5)
    elif c=='mascot-duck':
        torso+=path('M14 9 25 16 35 9 34 37 16 37Z',MINT,INK,1.5)
        torso+=ellipse(24,36,22,10,GOLD,INK,2)+ellipse(24,33,12,4,ORANGE,INK,1.4)
        torso+=duck(42,27,.55)
    elif c=='mascot-shark':
        torso=path('M12 8 29 4 39 13 46 42Q28 56 4 42L7 25Z','#6386a8',INK,2.4)
        torso+=path('M24 11Q35 16 34 48L18 48Q15 30 24 11Z',CREAM,INK,1.5)
        torso+=path('M9 15 18 17 15 23 21 22 22 29 28 23 33 25 33 17 41 16',CREAM,INK,1.2)
        torso+=line('M39 27 41 30M38 33 42 36',PURPLE,1.5)
    elif c=='mascot-banana':
        torso=path('M14 3Q8 18 11 35 19 53 36 52L46 47Q28 41 29 22L37 7 30 3Z',GOLD,INK,2.4)
        torso+=path('M17 8Q14 31 24 42L36 49 29 49Q8 41 11 18Z',ORANGE,'none',0)
        torso+=path('M14 4 23 2 33 4 31 10 18 11Z',RUST,INK,1.6)
        torso+=line('M23 13Q19 26 26 37',CREAM,2.3)
    elif c=='mascot-dragon':
        torso+=path('M17 12 33 12 36 43Q24 51 12 43Z',GOLD,INK,1.5)
        torso+=line('M15 24 33 24M14 32 34 32M14 40 34 40',RUST,1.3)
        torso+=path('M4 23 1 19 3 12 8 17M43 17 47 13 48 20 44 26',VIOLET,INK,1.5)
    elif c=='mascot-toad':
        torso+=ellipse(24,31,15,18,'#d0d6a0',INK,1.6)
        for x,y in [(7,23),(38,16),(39,39),(12,13)]: torso+=circle(x,y,2.5,GREEN,INK,.8)
        torso+=path('M5 14 11 4 21 7 24 15 30 7 41 5 45 15Z',MINT,INK,1.5)
    elif bare:
        torso=''
    if bare:
        skin=path('M16 6Q27 1 36 13 45 22 44 43Q25 56 5 43L5 24Q4 10 16 6Z','#fafafa','#151515',2.4)
        skin+=path('M31 14Q35 31 28 47L41 43 43 26Z','#d8d8d8','none',0)+line('M21 36Q25 39 28 35','#909090',1.3)
        add(atlas,'rig/torso-skin',50,58,skin)
    if c=='mascot-duck':pivots['torso']=[25/64,.88]
    add(atlas,'rig/torso',64 if c=='mascot-duck' else 50,58,torso)
    for back in (True,False):
        name='arm-back' if back else 'arm-front'
        # Rounded upper arm, bent wrist and mitten silhouette remain contiguous.
        hand=path('M8 15Q4 22 6 29 10 35 18 32L24 28 23 23 19 20 18 16Z','#fafafa','#151515',2.1)
        hand+=path('M7 24Q14 29 21 24L21 29 15 33 9 31Z','#dedede','none',0)+line('M17 24 21 25','#8e8e8e',1.1)
        sleeve=path('M7 3Q15 0 20 8L21 20Q15 25 6 20L3 12Z',col,INK,2.1)
        sleeve+=path('M16 5 19 12 20 20 15 22 14 11Z',DARK,'none',0,'opacity=".2"')
        if bare:
            hand=path('M7 3Q15 0 20 8L20 18 24 24 23 29Q14 36 6 28L4 12Q3 5 7 3Z','#fafafa','#151515',2.1)+line('M17 25 21 24','#8e8e8e',1.1)
            sleeve=''
        elif c in ('ball-chain','mascot-mummy'):
            sleeve+=line('M5 9 18 13M5 17 20 20',PURPLE if c=='ball-chain' else '#9e95a6',3 if c=='ball-chain' else 1.3)
        elif c in ('scepter','fan'):
            sleeve=path('M8 3 19 5 26 24Q17 34 2 24L4 11Z',col,INK,2.1)+line('M4 23Q14 29 23 22',GOLD,3)
        elif c in ('fastball','anime'):
            sleeve+=line('M6 18 20 18',CREAM if c=='fastball' else VIOLET,3)
        elif c=='ray-gun':
            sleeve+=line('M6 18 20 18',ORANGE,4)+circle(12,10,3,VIOLET,INK,1)
        if mascot and c not in ('mascot-duck','mascot-banana'):
            sleeve+=hand.replace('#fafafa',col).replace('#151515',INK).replace('#dedede',PAPER)
            if c=='mascot-dragon': sleeve+=path('M9 30 9 25 13 29 15 25 18 29 21 26',CREAM,INK,1)
        else: add(atlas,'rig/'+name+'-skin',30,36,hand)
        add(atlas,'rig/'+name,30,36,sleeve)
        name='leg-back' if back else 'leg-front'
        detail=''
        if c in ('anime','fastball','ray-gun'):
            detail+=path('M5.4 2Q11.4 1 17.4 2L17.4 13Q11.4 15 5.4 13Z',col,INK,1.6)+line('M6 10 16.8 10',VIOLET if c=='anime' else GOLD,2)
            if c=='fastball':detail+=line('M8 15 14.8 15M8 17 14.8 17',CREAM,1)
        if c in ('ball-chain','mascot-mummy'):
            detail+=line('M5.5 7 17 8M5 13 17.5 14',PURPLE if c=='ball-chain' else '#a39baf',2)
        if c=='pitch-deck':detail+=line('M5 17Q11.4 14 17.8 17',LILAC,1)
        if c in ('mascot-dragon','mascot-toad'):
            detail+=line('M7 23 7 26M12 23 12 27M17 23 17 26',CREAM if c=='mascot-dragon' else GREEN,1.3)
        boot=b.front_leg(PURPLE if not mascot else col,LILAC,back,detail)
        if bare or c=='mascot-duck':
            skin=b.front_leg('#fafafa','#ffffff',back,line('M8 23 8 26M14 23 14 26','#929292',1.1),ink='#151515',shade='#d8d8d8')
            add(atlas,'rig/'+name+'-skin',30,32,skin)
            boot='' if bare else group(path('M5.4 2Q11.4 1 17.4 2L17.4 12Q11.4 14 5.4 12Z',MINT,INK,2),f'rotate({4 if back else -4} 11.4 5.76)')
        add(atlas,'rig/'+name,30,32,boot)
    extra=''
    if c=='scepter':
        extra=path('M36 6Q26 33 3 53L24 50 36 60 54 43 50 7Z',PURPLE,INK,2.3)+path('M40 11Q31 40 16 48L25 45 35 54 45 41Z',PINK,INK,1.5)
    elif c=='junk':
        extra=path('M24 15 44 13Q63 31 55 53 31 69 11 52 6 35 24 15Z',GREEN,INK,2.3)+path('M24 15 19 4 33 8 42 2 46 13Z',MINT,INK,1.8)+line('M23 16 47 14',GOLD,3)+path('M18 34 34 29 37 46 20 49Z',RUST,INK,1.5)+line('M22 36 29 34M23 43 31 41',CREAM,1.2)
    elif c=='ray-gun':
        extra=path('M19 9 43 7 47 44 19 47Z',PAPER,INK,2.3)+path('M15 17 23 17 23 42 15 42Z',GOLD,INK,1.6)+line('M29 17 38 16M30 25 39 24M30 34 40 33',PURPLE,2)
    elif c=='mascot-shark':
        extra=path('M47 14Q30 29 15 23L3 5 3 32 16 40 5 52Q24 54 39 37L57 29Z','#6386a8',INK,2.3)+line('M19 34 36 29',CREAM,1.6)
    elif c=='mascot-dragon':
        extra=path('M48 18Q18 34 5 24 7 53 34 48 51 41 59 30Z',GREEN,INK,2.3)+path('M11 28 13 18 21 27 29 18 34 29 43 20 47 31Z',GOLD,INK,1.5)
        extra+=path('M40 25 13 3 10 17 2 20 18 27 22 42Z',VIOLET,INK,2)+line('M39 25 12 16 22 29',PINK,1.6)
    elif c=='mascot-mummy':
        extra=path('M44 12Q19 17 26 33 31 51 3 46L5 56Q42 64 36 34 31 25 50 23Z',CREAM,INK,2)+line('M26 30 34 28M25 48 30 57', '#a39baf',1.3)
    elif c=='mascot-banana':
        extra=path('M41 7Q47 23 55 34L38 29 27 15Q24 38 4 48L17 25 22 9Z',GOLD,INK,2.3)+line('M27 13 17 30',CREAM,2)
    if extra:
        add(atlas,'rig/extra',64,64,extra)
        joints['extra']=[-13,-43]
    if not mascot and not bare and c!='anime':
        w=h=64; weapon=''
        if c=='pitch-deck': weapon=card(18,39,.75,-36)+card(28,32,.85,-12)+card(39,31,.9,18)
        elif c=='scepter': weapon=line('M20 53 29 12',INK,6)+line('M20 53 29 12',GOLD,3.5)+star(29,12,10,MINT,5,2)+circle(29,12,4,CREAM,INK,1)+path('M22 27Q40 26 34 14', 'none',ORANGE,2)
        elif c=='ball-chain':
            weapon=line('M18 46Q37 55 41 26',INK,5)+line('M18 46Q37 55 41 26',PAPER,2.5)+circle(42,17,13,'#6d708b',INK,2.3)+line('M33 14Q34 9 40 8',CREAM,2)
            weapon+=line('M22 48 23 53M31 46 34 50M37 36 41 37',INK,1.5)
        elif c=='fastball': weapon=baseball(24,42,1)
        elif c=='slingshot':
            weapon=path('M20 52 19 31 6 18 10 12 25 28 37 10 43 15 29 34 29 52Z',RUST,INK,2.4)+line('M9 14 25 23 40 12',GOLD,2.6)+line('M23 34 24 46',CREAM,2)
        elif c=='egg-lob': weapon=egg(24,41,.7,-20)
        elif c=='junk': weapon=junk_piece(0,25,38,.85,-18)
        elif c=='blaster': weapon=gun(25,34,.85)
        elif c=='ray-gun': weapon=gun(25,34,.85,True)
        elif c=='fan': weapon=fan(24,30,.85,10)
        add(atlas,'rig/weapon',w,h,weapon)
        pivots['weapon']=[20/64,46/64]
        joints['weapon']=[3,23]
    RIG_COSTUMES[c]={'attack':COSTUMES[c], 'pivots':pivots,'joints':joints,
                     'weaponBehind':c in ('scepter','ball-chain','slingshot')}


def hits(c, color):
    for i in range(4):
        if c=='tickle':
            a=''
            for j in range(3):
                x=27+math.cos(j*2.1+i*.35)*(9+i*5);y=28+math.sin(j*2.1+i*.35)*(9+i*4)
                a+=star(x,y,[6,10,7,3][i],[PINK,GOLD,MINT][j],4,1.3)
            if i<3: a+=line('M17 24Q25 36 33 23',CREAM,2)
        elif c=='egg-lob':
            a=ellipse(32,41,10+i*5,11-i*2,CREAM,INK,1.7)+ellipse(33,40,5+i*2,5-i*.7,GOLD,INK,1.2)
            if i<3:
                a+=path(f'M10 {25+i*4} 14 {16+i*3} 18 {26+i*4}ZM43 {16+i*3} 49 {12+i*4} 52 {23+i*4}Z',CREAM,INK,1.3)
        else:
            a=b.burst(32,32,[10,26,19,5][i],color,1.5,phase=i*.18)
            if i<3: a+=star(32,32,[7,14,10][i],CREAM,4,1)
            for j in range(5):
                t=j*math.tau/5+i*.13; r=12+i*6
                a+=line(f'M{32+math.cos(t)*r:.2f} {32+math.sin(t)*r:.2f} {32+math.cos(t)*(r+4):.2f} {32+math.sin(t)*(r+4):.2f}',color,2 if i<3 else 1.2)
        add('hero-'+c,f'wpn/hit/{i}',64,64,a)


def weapon_effects(c):
    atlas='hero-'+c
    color={'scepter':MINT,'slingshot':VIOLET,'ray-gun':MINT,'anime':GOLD}.get(c,COLORS[c])
    if c.startswith('mascot-'):
        suit=c[7:]
        for i in range(6):
            r=[18,41,75,103,119,122][i]
            a=''
            if i<4:
                a+=path(f'M{128-r} 82Q128 {72-r*.42} {128+r} 82L{128+r-8} 90Q128 {84-r*.28} {128-r+8} 90Z',GOLD if suit=='banana' else color,INK,2)
                a+=ellipse(128,88,r,8+i*4,'none',CREAM,3)
            else:
                a+=ellipse(128,88,r,20,'none',color,2,'stroke-dasharray="22 19"')
            for j in range(6):
                x=128+math.cos(j*math.pi/3+.2)*r*.87;y=82-abs(math.sin(j*1.8))*[5,18,37,43,30,12][i]
                a+=path(f'M{x-4} {y+5} {x-7} {y-4} {x+1} {y-8} {x+6} {y+2}Z',GOLD,INK,1.4)
                if i in (1,2,3): a+=line(f'M{x} {y+9} {128+(x-128)*.7} 85',CREAM,2)
            if i==1: a+=b.burst(128,71,29,CREAM,1.5)
            add(atlas,f'wpn/slam/{i}',256,128,a)
        for i in range(4):
            if suit=='duck':
                a=ellipse(64,45,44,18,'none',GOLD,2,'stroke-dasharray="13 7"')
                for j in range(3):
                    t=j*math.tau/3+i*.75
                    a+=duck(64+math.cos(t)*39,43+math.sin(t)*18,.45,-10+15*math.sin(t))
                w,h=128,88
            elif suit=='shark':
                gap=[22,13,2,8][i]
                a=path(f'M12 {42-gap}Q64 {4-gap/2} 116 {42-gap}L111 {48-gap}Q64 {25-gap/2} 17 {48-gap}Z','#6386a8',INK,2)
                a+=path(f'M12 {49+gap}Q64 {89+gap/3} 116 {49+gap}L111 {43+gap}Q64 {65+gap/3} 17 {43+gap}Z','#6386a8',INK,2)
                for j in range(6):
                    x=22+j*15; arch=abs(2.5-j)*2
                    a+=path(f'M{x} {30-gap+arch}l7 20 7-20Z',CREAM,INK,1.5)+path(f'M{x} {60+gap-arch}l7-20 7 20Z',CREAM,INK,1.5)
                if i==2: a+=star(64,45,15,GOLD,4,1.5)
                w,h=128,96
            elif suit=='banana':
                a=path('M35 16Q38 39 10 49L4 44 19 41 29 27 28 15ZM35 18Q36 40 60 44L63 53Q43 53 33 34 28 48 20 55L16 52Q26 37 28 20Z',GOLD,INK,2)
                a+=line('M32 20 32 29',CREAM,2)+path('M27 12 36 12 36 20 28 21Z',RUST,INK,1.5)
                a=group(a,f'translate(0 {[-9,-4,0,0][i]}) rotate({[-32,14,-5,0][i]} 32 40)')
                w,h=72,64
            elif suit=='dragon':
                a=path(f'M8 48Q39 {20-i*3} 74 33L{114+i*9} {13+i*4} 104 43 146 38 126 59 157 69 98 78Q41 79 8 48Z',ORANGE,INK,2)
                a+=path('M12 49Q54 34 103 48L123 57 95 59 112 68Q56 65 12 49Z',GOLD,'none',0)+path('M12 49 79 49 99 57 75 61Z',CREAM,'none',0)
                a+=star(137,25+i*11,5,GOLD,4,1)
                w,h=168,96
            elif suit=='toad':
                reach=[45,106,148,80][i]
                a=path(f'M4 43Q{reach*.5} 24 {reach} 37Q{reach+17} 46 {reach+1} 58L{reach-8} 51Q{reach+4} 46 {reach-5} 45Q55 34 4 54Z',PINK,INK,2.3)
                a+=line(f'M9 46Q{reach*.55} 30 {reach} 43',CREAM,2)
                w,h=176,80
            else:
                a=path(['M6 74Q19 34 75 23L94 26 91 38Q36 27 17 79Z','M11 70Q106 106 107 29L94 32Q91 79 16 57Z','M23 19 101 30 98 44 22 34ZM20 49 103 55 99 70 23 64ZM30 77 94 73 93 87 33 91Z','M27 20 101 30 97 44 23 34ZM24 49 102 51 100 66 23 64ZM27 77 100 70 96 85 32 92Z'][i],CREAM,INK,2)
                a+=line('M46 29 46 37M74 54 74 65M54 80 55 89', '#a399ab',1.5)
                w,h=128,104
            add(atlas,f'wpn/twist/{i}',w,h,a)
        return
    if c=='fan':
        for i in range(4):
            a=path(f'M{14+i*4} 6Q{99-i*3} 40 {17+i*5} 81L{34+i*4} 62Q{69-i*2} 39 {14+i*4} 6Z',MINT,INK,2)
            a+=line(f'M12 23Q64 {32+i*2} 23 63',CREAM,2.5)+line('M5 36 23 39M3 49 16 49',MINT,2)
            add(atlas,f'wpn/gust/{i}',96,88,a)
        return
    hits(c,color)
    if c=='pitch-deck': add(atlas,'wpn/proj',48,32,card(27,16,1,0)+line('M2 15 9 15M4 23 12 22',GOLD,2))
    elif c=='scepter':
        for i in range(2):
            a=path(f'M3 14 31 14 27 {4+i*3} 62 19 27 {34-i*3} 31 24 3 24 13 19Z',VIOLET,INK,1.6)+path('M10 19 40 13 57 19 39 23Z',MINT,'none',0)+star(48,19,8,CREAM,4,1)
            add(atlas,f'wpn/proj/{i}',64,38,a)
    elif c=='ball-chain':
        for i in range(4):
            a=path('M27 45Q104-6 164 57 197 117 140 158L156 128Q170 49 90 35Z',PAPER,INK,2)
            a+=line('M52 36Q143 9 174 97',CREAM,4)+circle(166,108,19,'#73768e',INK,3)+line('M154 102Q155 94 164 94',CREAM,3)
            a=group(a,f'rotate({[-110,-25,55,135][i]} 96 96)')
            add(atlas,f'wpn/arc/{i}',192,192,a)
    elif c=='fastball':
        add(atlas,'wpn/proj',72,36,path('M3 7 48 11 60 18 43 26 3 29 16 20Z',GOLD,INK,1.5)+line('M5 18 34 18',CREAM,3)+baseball(54,18,1.1))
    elif c=='slingshot':
        add(atlas,'wpn/proj',32,24,candy(18,12,.48,0,PINK))
        add(atlas,'wpn/zap',64,24,path('M0 12 12 12 22 3 35 18 45 7 54 12 64 12','none',INK,6)+path('M0 12 12 12 22 3 35 18 45 7 54 12 64 12','none',MINT,3))
    elif c=='egg-lob':
        add(atlas,'wpn/proj',36,44,egg(18,22,.95,0))
        a=path('M2 25Q8 5 25 4L20 14 40 8 32 25 55 17Q54 46 27 51Z',ORANGE,INK,2)+path('M8 29 25 15 21 30 43 26 33 44Z',GOLD,'none',0)+egg(37,34,.85,58)
        add(atlas,'wpn/proj-fire',64,60,a)
    elif c=='junk':
        for i in range(4): add(atlas,f'wpn/junk/{i}',72 if i==3 else 44,48,junk_piece(i,36 if i==3 else 22,24,1,0))
    elif c=='blaster':
        for i,col in enumerate((PINK,MINT,GOLD)): add(atlas,f'wpn/proj/{i}',40,24,candy(23,12,.52,0,col)+line('M1 11 7 11',CREAM,2))
    elif c=='tickle':
        for i in range(3):
            a=path('M11 41Q9 34 20 30L20 13Q20 7 25 9L29 27 29 7Q34 1 37 9L37 26 41 9Q47 6 47 14L44 29 52 19Q59 18 57 25L48 43 50 54 29 61 21 46Z',CREAM,INK,2)
            a+=path('M2 22Q14 4 22 6M5 30 13 21','none',GOLD,3)
            add(atlas,f'wpn/slap/{i}',72,72,group(a,f'rotate({[-18,12,36][i]} 36 36)'))
    if c in ('ray-gun','anime'):
        col=MINT if c=='ray-gun' else GOLD
        a=path('M0 4H96V24H0Z',col,'none',0)+path('M0 9H96V19H0Z',CREAM,'none',0)+line('M0 4H96M0 24H96',INK,1.5)+line('M0 14H96','#ffffff',3)
        add(atlas,'wpn/beam',96,28,a)
    if c in ('blaster','ray-gun'):
        for i in range(3):
            a=path(['M4 24 18 15 13 6 29 13 42 7 39 21 51 25 35 30 41 42 26 35 13 43 16 31Z','M3 24 27 13 32 3 40 16 60 12 52 26 61 36 40 32 31 45 25 34Z','M4 24 22 20 33 13 39 24 33 33 23 28Z'][i],GOLD if c=='blaster' else MINT,INK,1.5)+star(27,24,[10,14,6][i],CREAM,4,1)
            add(atlas,f'wpn/muzzle/{i}',64,48,a)
    if c=='anime':
        for i in range(4):
            r=[8,13,20,24][i]
            a=circle(32,32,r,GOLD,INK,2)+circle(30,30,r*.67,CREAM,'none',0)
            a+=path(f'M{32-r-4} 38Q{12-i*3} 8 36 8M{32+r+3} 24Q{52+i*2} 58 28 57','none',ORANGE,2)
            a+=star(12,18+i*7,4,CREAM,4,1)
            add(atlas,f'wpn/charge/{i}',64,64,a)
        for i in range(3):
            a=b.burst(30,40,[23,34,28][i],GOLD,2)+star(30,40,[16,23,18][i],CREAM,4,1)
            a+=line('M6 29 20 29M5 48 18 47',CREAM,3)
            add(atlas,f'wpn/beam-end/{i}',72,80,a)


def rig_data():
    clips={}
    def clip(name,ms,tracks,events=None,loop=False):
        clips[name]={'loop':loop,'ms':ms,'events':events or {},'tracks':tracks}
    def tr(*poses):
        return [[t,v,e] for t,v,e in poses]
    def seq(times,values,eases=None):
        return [[t,v,(eases or ['sineInOut']*len(times))[i]] for i,(t,v) in enumerate(zip(times,values))]
    clip('idle',1600,{
        'torso':seq([0,800,1600],[{}, {'sy':.95,'sx':1.025,'y':1.5},{}]),
        'head':seq([0,800,1600],[{}, {'y':1.8,'r':-2},{}]),
        'arm-front':seq([0,800,1600],[{}, {'r':-5,'y':1},{}]),
        'arm-back':seq([0,800,1600],[{}, {'r':4,'y':1},{}]),
        'extra':seq([0,600,1100,1600],[{}, {'r':5},{'r':-3},{}])},loop=True)
    ts=[0,100,200,300,400,500,600]
    clip('walk',600,{
        'root':seq(ts,[{'y':0},{'y':2},{'y':-3},{'y':0},{'y':2},{'y':-3},{'y':0}]),
        'torso':seq(ts,[{'r':-3},{'r':-1,'sx':1.035,'sy':.97},{'r':2,'sy':1.035},{'r':3},{'r':1,'sx':1.035,'sy':.97},{'r':-2,'sy':1.035},{'r':-3}]),
        'head':seq(ts,[{'r':2},{'r':1,'y':1},{'r':-2,'y':.5},{'r':-2},{'r':-1,'y':1},{'r':2,'y':.5},{'r':2}]),
        # Each foot plants at its step event, then lifts on the opposite half-cycle.
        'leg-front':seq(ts,[{}, {'r':-2,'y':-2},{'r':-3,'y':3},{}, {'r':-6,'x':1,'y':-7},{'r':-4,'x':1,'y':-2},{}]),
        'leg-back':seq(ts,[{}, {'r':6,'x':-1,'y':-7},{'r':4,'x':-1,'y':-2},{}, {'r':2,'y':-2},{'r':3,'y':3},{}]),
        'arm-front':seq(ts,[{'r':24},{'r':16},{'r':-8},{'r':-24},{'r':-16},{'r':8},{'r':24}]),
        'arm-back':seq(ts,[{'r':-24},{'r':-16},{'r':8},{'r':24},{'r':16},{'r':-8},{'r':-24}]),
        'weapon':seq(ts,[{'r':5},{'r':-3},{'r':-8},{'r':-5},{'r':3},{'r':8},{'r':5}]),
        'extra':seq(ts,[{'r':-7},{'r':-2},{'r':7},{'r':9},{'r':2},{'r':-7},{'r':-7}])}, {'step':[0,300]},True)
    # Offset poses retain five-pixel limb overlaps; the head counter-rotates the chest.
    clip('attack-throw',760,{
        'root':seq([0,200,340,430,560,760],[{}, {'x':-4},{'x':-5},{'x':5},{'x':3},{}]),
        'torso':seq([0,240,370,450,760],[{}, {'r':-13,'sx':.94,'sy':1.06},{'r':-8},{'r':13,'sx':1.08,'sy':.94},{}]),
        'arm-front':seq([0,230,340,420,500,760],[{}, {'r':135,'x':-3,'y':-4},{'r':148,'x':-3,'y':-5},{'r':-88,'x':2},{'r':-49,'y':3},{}],['linear','backOut','sineInOut','quadIn','cubicOut','sineOut']),
        'arm-back':seq([0,230,420,760],[{}, {'r':-48},{'r':35},{}]),
        'head':seq([0,260,425,760],[{}, {'r':-9,'x':-2},{'r':8,'x':3},{}]),
        'weapon':seq([0,330,419,420,580,650,760],[{}, {'r':-20},{'r':-15},{'a':0},{'a':0},{},{}]),
        'leg-front':seq([0,230,420,760],[{}, {'r':-12,'y':-2},{'r':-20,'x':3},{}]),
        'extra':seq([0,300,470,620,760],[{}, {'r':14},{'r':-18},{'r':5},{}])},{'release':420})
    clip('attack-flick',480,{
        'torso':seq([0,150,230,340,480],[{}, {'r':-6},{'r':8},{'r':3},{}]),
        'head':seq([0,170,240,480],[{}, {'r':-4},{'r':5},{}]),
        'arm-front':seq([0,150,220,270,480],[{}, {'r':26,'y':-3},{'r':-65,'x':3},{'r':-54,'x':2},{}],['linear','sineInOut','quadIn','backOut','sineOut']),
        'weapon':seq([0,150,220,300,480],[{}, {'r':32},{'r':-48},{'r':-20},{}]),
        'arm-back':seq([0,150,240,480],[{}, {'r':-16},{'r':14},{}])},{'release':220})
    clip('attack-swing',900,{
        'root':seq([0,260,480,600,900],[{}, {'x':-3},{'x':5},{'x':2},{}]),
        'torso':seq([0,230,470,590,900],[{}, {'r':-17,'sx':.94},{'r':18,'sx':1.08},{'r':8},{}]),
        'head':seq([0,260,500,660,900],[{}, {'r':-10,'x':-3},{'r':10,'x':4},{'r':-3},{}]),
        'arm-front':seq([0,230,470,590,900],[{}, {'r':135},{'r':-85,'x':3},{'r':-35},{}],['linear','backOut','quadIn','cubicOut','sineOut']),
        'weapon':seq([0,260,470,620,900],[{}, {'r':-48},{'r':88},{'r':30},{}]),
        'arm-back':seq([0,250,470,900],[{}, {'r':-30},{'r':32},{}]),
        'leg-front':seq([0,240,470,900],[{}, {'r':8},{'r':-22,'x':3},{}])},{'release':470})
    clip('attack-shoot',560,{
        'arm-front':seq([0,160,245,280,380,560],[{}, {'r':-68},{'r':-68},{'r':-85,'x':-4,'y':-2},{'r':-62},{}]),
        'arm-back':seq([0,180,245,295,560],[{}, {'r':-78,'x':3},{'r':-78,'x':3},{'r':-91,'x':1},{}]),
        'weapon':seq([0,160,245,285,400,560],[{}, {'r':66},{'r':66},{'r':57},{'r':70},{}]),
        'root':seq([0,240,290,410,560],[{}, {},{'x':-4},{'x':1},{}]),
        'head':seq([0,180,290,440,560],[{}, {'r':4,'x':2},{'r':-6,'x':-2},{'r':2},{}]),
        'torso':seq([0,180,290,560],[{}, {'r':5},{'r':-7},{}])},{'release':245})
    clip('attack-slam',1100,{
        'root':seq([0,240,390,520,620,700,820,1100],[{}, {'y':5},{'y':-45},{'y':-51},{'y':-44},{'y':0},{'y':-5},{}],['linear','sineIn','cubicOut','sineOut','quadIn','quadIn','sineOut','sineInOut']),
        'torso':seq([0,240,390,620,700,850,1100],[{}, {'sx':1.2,'sy':.75,'y':8},{'sx':.9,'sy':1.13},{'sy':1.12},{'sx':1.3,'sy':.65,'y':10},{'sx':.95,'sy':1.06},{}]),
        'head':seq([0,240,420,620,700,850,1100],[{}, {'y':15,'r':-6},{'y':-3,'r':5},{'r':10},{'y':23,'sx':1.13,'sy':.86},{'y':-3,'r':-3},{}]),
        'arm-front':seq([0,240,410,620,700,850,1100],[{}, {'r':32},{'r':-150},{'r':-145},{'r':-27,'y':7},{'r':12},{}]),
        'arm-back':seq([0,240,410,620,700,1100],[{}, {'r':-30},{'r':135},{'r':128},{'r':28,'y':7},{}]),
        'leg-front':seq([0,240,430,620,700,1100],[{}, {'r':-25},{'r':-38,'y':-7},{'r':-8},{'r':-23},{}]),
        'leg-back':seq([0,240,430,620,700,1100],[{}, {'r':25},{'r':32,'y':-9},{'r':8},{'r':23},{}]),
        'extra':seq([0,240,470,700,880,1100],[{}, {'r':12},{'r':-25},{'r':24},{'r':-8},{}])},{'release':700,'land':700})
    clip('attack-cast',960,{
        'arm-front':seq([0,200,410,540,700,960],[{}, {'r':35},{'r':-132},{'r':-111},{'r':-82},{}]),
        'weapon':seq([0,210,420,540,700,960],[{}, {'r':-18},{'r':94},{'r':62},{'r':45},{}]),
        'arm-back':seq([0,260,520,710,960],[{}, {'r':-45},{'r':42},{'r':25},{}]),
        'torso':seq([0,200,420,580,960],[{}, {'sy':.9,'sx':1.06},{'sy':1.08,'r':-5},{'r':8},{}]),
        'head':seq([0,220,410,580,960],[{}, {'y':3,'r':-6},{'y':-4,'r':-8},{'r':7},{}]),
        'extra':seq([0,260,550,780,960],[{}, {'r':8},{'r':-20},{'r':8},{}])},{'release':540})
    clip('attack-beam',1400,{
        'root':seq([0,400,740,800,1000,1400],[{}, {'x':-4},{'x':-4},{'x':-7},{'x':-3},{}]),
        'torso':seq([0,300,700,800,1120,1400],[{}, {'r':-12,'sx':1.1,'sy':.9},{'r':-10,'sx':1.12,'sy':.88},{'r':12,'sy':1.04},{'r':7},{}]),
        'head':seq([0,300,700,800,1150,1400],[{}, {'x':-2,'y':4,'r':-7},{'x':-2,'y':3,'r':-4},{'x':4,'r':6},{'r':4},{}]),
        'arm-front':seq([0,300,690,800,1080,1400],[{}, {'r':38,'x':-3},{'r':34,'x':-3},{'r':-91,'x':3},{'r':-87,'x':3},{}],['linear','sineInOut','sineInOut','quadIn','sineInOut','sineOut']),
        'arm-back':seq([0,300,700,800,1080,1400],[{}, {'r':-30,'x':3},{'r':-33,'x':3},{'r':-99,'x':3},{'r':-96,'x':3},{}]),
        'leg-front':seq([0,300,800,1400],[{}, {'r':-20,'x':2},{'r':-25,'x':3},{}]),
        'leg-back':seq([0,300,800,1400],[{}, {'r':21,'x':-2},{'r':28,'x':-3},{}])},{'release':800})
    clip('attack-fan',700,{
        'torso':seq([0,200,340,460,700],[{}, {'r':-12},{'r':13},{'r':7},{}]),
        'head':seq([0,210,350,500,700],[{}, {'r':-9},{'r':9},{'r':-2},{}]),
        'arm-front':seq([0,210,340,460,700],[{}, {'r':115},{'r':-83},{'r':-55},{}],['linear','backOut','quadIn','sineOut','sineInOut']),
        'weapon':seq([0,210,340,470,700],[{}, {'r':-35},{'r':68},{'r':20},{}]),
        'arm-back':seq([0,200,340,700],[{}, {'r':-40},{'r':33},{}]),
        'extra':seq([0,210,360,520,700],[{}, {'r':12},{'r':-18},{'r':5},{}])},{'release':340})
    clip('attack-slap',420,{
        'arm-front':seq([0,130,205,275,420],[{}, {'r':42},{'r':-93,'x':3},{'r':-65},{}],['linear','backOut','quadIn','sineOut','sineOut']),
        'arm-back':seq([0,150,250,420],[{}, {'r':-22},{'r':28},{}]),
        'head':seq([0,140,230,420],[{}, {'r':-8},{'r':9,'x':2},{}]),
        'torso':seq([0,130,220,420],[{}, {'r':-8},{'r':11},{}])},{'release':205})
    clip('special',1000,{
        'head':seq([0,220,400,580,760,1000],[{}, {'y':5,'r':-8,'sy':.94,'sx':1.04},{'y':-7,'r':5,'sy':1.06},{'r':-4},{'r':2},{}]),
        'torso':seq([0,230,410,700,1000],[{}, {'sy':.87,'sx':1.08},{'sy':1.12,'sx':.95},{'sy':.98},{}]),
        'arm-front':seq([0,240,410,680,1000],[{}, {'r':35},{'r':-126},{'r':-100},{}]),
        'arm-back':seq([0,240,410,680,1000],[{}, {'r':-35},{'r':126},{'r':100},{}]),
        'extra':seq([0,260,480,740,1000],[{}, {'r':10},{'r':-20},{'r':5},{}])},{'release':400})
    # The ultimate shares the slam's acting but adds a longer, higher airborne hold.
    ultimate=json.loads(json.dumps(clips['attack-slam']))
    ultimate['ms']=1600
    for track in ultimate['tracks'].values():
        for key in track: key[0]=round(key[0]*1600/1100)
    for key in ultimate['tracks']['root']:
        if key[1].get('y',0)<-10: key[1]['y']*=1.55
    ultimate['events']={'release':1018,'land':1018}
    clips['ultimate']=ultimate
    clip('hurt',460,{
        'root':seq([0,75,180,330,460],[{}, {'x':-7},{'x':-4},{'x':1},{}],['linear','quadOut','sineInOut','sineOut','sineInOut']),
        'torso':seq([0,75,240,460],[{}, {'r':-14,'sx':.91,'sy':1.05},{'r':5},{}]),
        'head':seq([0,90,220,460],[{}, {'r':-17,'x':-3},{'r':5},{}]),
        'arm-front':seq([0,100,230,460],[{}, {'r':-48},{'r':10},{}]),
        'extra':seq([0,120,290,460],[{}, {'r':20},{'r':-8},{}])})
    faint_pose={'r':-82,'x':-32,'y':-28}
    clip('faint',900,{
        'root':seq([0,180,390,590,710,900],[{}, {'r':8,'x':3},{'r':-27,'x':-10},{'r':-88,'x':-32,'y':-28},{'r':-78,'x':-32,'y':-28},faint_pose],['linear','sineOut','quadIn','quadIn','sineOut','sineInOut']),
        'head':seq([0,200,590,720,900],[{}, {'r':-12},{'r':12,'x':3},{'r':-5},{'r':3}]),
        'arm-front':seq([0,250,590,900],[{}, {'r':-55},{'r':65},{'r':52}]),
        'arm-back':seq([0,280,590,900],[{}, {'r':50},{'r':-35},{'r':-25}]),
        'leg-front':seq([0,300,600,900],[{}, {'r':-20},{'r':18},{'r':12}])})
    clip('revive',1100,{
        'root':seq([0,250,460,650,800,1100],[faint_pose,{'r':-82,'x':-32,'y':-28},{'r':-20,'x':-6,'y':-20},{'y':-28},{'y':0},{}]),
        'head':seq([0,300,500,800,950,1100],[{'r':3},{'r':-10},{'r':8},{'y':9,'sy':.92},{'y':-3},{}]),
        'arm-front':seq([0,300,580,800,1100],[{'r':52},{'r':-45},{'r':-145},{'r':-30},{}]),
        'arm-back':seq([0,300,580,800,1100],[{'r':-25},{'r':40},{'r':140},{'r':30},{}]),
        'leg-front':seq([0,300,580,800,1100],[{'r':12},{'r':-20},{'r':-35},{'r':-20},{}]),
        'torso':seq([0,300,580,800,1100],[{}, {'sx':1.1,'sy':.9},{'sx':.9,'sy':1.12},{'sx':1.12,'sy':.86},{}])})
    ts=[0,200,400,600,800,1000,1200]
    clip('victory',1200,{
        'root':seq(ts,[{'r':-5},{'y':-10,'r':6},{'r':6},{'r':5},{'y':-10,'r':-6},{'r':-6},{'r':-5}]),
        'head':seq(ts,[{'r':-6},{'r':5},{'r':-2},{'r':6},{'r':-5},{'r':2},{'r':-6}]),
        'arm-front':seq(ts,[{'r':-110},{'r':-150},{'r':-85},{'r':-55},{'r':-90},{'r':-135},{'r':-110}]),
        'arm-back':seq(ts,[{'r':55},{'r':90},{'r':135},{'r':110},{'r':150},{'r':85},{'r':55}]),
        'leg-front':seq(ts,[{'r':-8},{'r':-30,'y':-4},{'r':-12},{'r':8},{'r':18},{'r':5},{'r':-8}]),
        'leg-back':seq(ts,[{'r':8},{'r':18},{'r':5},{'r':-8},{'r':-30,'y':-4},{'r':-12},{'r':8}]),
        'extra':seq(ts,[{'r':8},{'r':-9},{'r':-15},{'r':-8},{'r':9},{'r':15},{'r':8}])},loop=True)
    clip('emote',900,{
        'root':seq([0,140,320,480,600,900],[{}, {'y':3},{'y':-16,'r':-5},{'y':0,'r':4},{'r':-2},{}]),
        'head':seq([0,160,350,510,670,900],[{}, {'y':4,'r':-8},{'r':7},{'y':4,'r':-5},{'r':3},{}]),
        'torso':seq([0,140,320,480,650,900],[{}, {'sx':1.1,'sy':.88},{'sx':.95,'sy':1.06},{'sx':1.12,'sy':.86},{'sx':.98,'sy':1.02},{}]),
        'arm-front':seq([0,180,340,560,900],[{}, {'r':25},{'r':-55},{'r':15},{}]),
        'arm-back':seq([0,180,340,560,900],[{}, {'r':-25},{'r':55},{'r':-15},{}])})
    clip('spawn',1000,{
        'root':seq([0,290,430,570,730,1000],[{'y':-100},{'y':-28},{'y':0},{'y':-8},{'y':0},{}],['linear','quadIn','quadIn','sineOut','sineIn','sineOut']),
        'torso':seq([0,300,430,580,740,1000],[{'sx':.9,'sy':1.12},{'sx':.9,'sy':1.12},{'sx':1.25,'sy':.7},{'sx':.94,'sy':1.08},{'sx':1.04,'sy':.96},{}]),
        'head':seq([0,300,430,580,760,1000],[{'y':-5,'r':-7},{'y':-3,'r':-4},{'y':18,'sx':1.1,'sy':.9},{'y':-4,'r':5},{'y':2,'r':-2},{}]),
        'arm-front':seq([0,290,430,620,1000],[{'r':-140},{'r':-115},{'r':-20,'y':6},{'r':12},{}]),
        'arm-back':seq([0,290,430,620,1000],[{'r':140},{'r':115},{'r':20,'y':6},{'r':-12},{}]),
        'extra':seq([0,350,480,680,1000],[{'r':-35},{'r':-28},{'r':26},{'r':-8},{}])},{'land':430})
    return {'R':30,'skeleton':{'head':{'joint':[0,-78]},'torso':{'joint':[0,-18]},
        'arm-back':{'joint':[-16,-46]},'arm-front':{'joint':[18,-44]},
        'leg-back':{'joint':[-9,-22]},'leg-front':{'joint':[9,-21]},
        'extra':{'joint':[-13,-43]},'weapon':{'parent':'arm-front','joint':[3,23]}},
        'order':['extra','leg-back','arm-back','torso','leg-front','head','arm-front'],
        'costumes':RIG_COSTUMES,'clips':clips}


def enemy_pose(kind,i,special=None):
    bob=b.BOBS[i]; small=kind in ('mini','skeleton')
    a=ellipse(65,118,24 if small else 35,5,DARK,'none',0,'opacity=".22"')
    col={'witch':VIOLET,'mummy':CREAM,'mini':CREAM,'goblin':GREEN,'skeleton':CREAM}[kind]
    limbs=path(b.LEGS[i][0],PURPLE,INK,3)+path(b.LEGS[i][1],col,INK,3)
    if kind in ('mummy','mini'):
        limbs+=line(['M39 101 48 106M78 99 85 95','M51 101 60 103M83 101 91 97','M52 94 62 95M66 102 74 102','M68 99 74 93M47 103 54 108','M66 101 74 98M50 108 58 108','M48 99 56 99M71 97 78 101'][i], '#a99ba7',2)
    if kind=='skeleton':
        limbs=path(b.LEGS[i][0],PURPLE,INK,3)+path(b.LEGS[i][1],CREAM,INK,3)
        limbs+=line(['M55 90 45 100 37 109M69 91 78 99 91 108','M56 92 55 104 50 110M71 93 86 100 94 111','M54 89 56 99 63 102M67 89 68 107','M54 89 67 100 85 110M69 90 57 103 38 110','M53 92 66 99 77 112M70 92 55 105 58 112','M50 87 50 106M74 86 76 96 66 103'][i],CREAM,4)
    body=limbs
    body+=group(path(b.ARMS[i][0],col),f'translate(0 {bob})')
    hx,hy,r=71,47+bob,21
    if kind=='witch':
        body+=path(f'M49 {61+bob} 83 {62+bob}Q90 85 {103+[0,-4,3,6,-2,-5][i]} {109+bob}L82 {105+bob} 69 {117+bob} 58 {107+bob} 35 {110+bob} 40 87Z',PURPLE,INK,3)
        body+=path(f'M57 {67+bob} 67 {80+bob} 59 {106+bob} 45 {108+bob}Z',VIOLET,INK,1.8)
        body+=path(f'M55 {63+bob} 73 {82+bob} 87 {62+bob} 84 {78+bob} 73 {89+bob} 54 {77+bob}Z',MINT,INK,2)
        body+=star(76,97+bob,7,GOLD,5,1.5)
        body+=circle(hx,hy,25,LILAC,INK,3)
        body+=path(f'M45 {31+bob} 61 {4+bob} 86 {7+bob} 79 {15+bob} 94 {33+bob}Z',VIOLET,INK,3)
        body+=path(f'M47 {25+bob}Q69 {18+bob} 88 {24+bob}L91 {30+bob} 44 {33+bob}Z',RUST,INK,1.8)
        body+=path(f'M28 {35+bob}Q60 {24+bob} 96 {31+bob}L111 {39+bob}Q66 {51+bob} 25 {42+bob}Z',PURPLE,INK,3)
        body+=path(f'M58 {27+bob} 64 {25+bob} 66 {31+bob} 59 {32+bob}Z',GOLD,INK,1.3)
        body+=line(f'M55 {18+bob} 61 {10+bob}',LILAC,2)
        angle=([-35,-85,25,10][special] if special is not None else [-7,-3,6,12,4,-5][i])
        wand=line('M100 87 105 47',INK,6)+line('M100 87 105 47',GOLD,3)+star(105,45,9,MINT,5,2)
        if special is not None:
            wand+=star(114,33,5,GOLD,4,1)+star(89,44,4,CREAM,4,1)
        body+=group(wand,f'rotate({angle} 96 {74+bob})')
        body+=ellipse(100,79+bob,7,6,MINT,INK,2)
    elif kind in ('mummy','mini'):
        body+=path(f'M48 {62+bob}Q66 54 86 {64+bob}L90 {98+bob} 70 104 42 98Z',CREAM,INK,3)
        for yy in (67,78,89): body+=path(f'M45 {yy+bob} 86 {yy-4+bob} 87 {yy+4+bob} 44 {yy+9+bob}Z',PAPER,INK,1.2)
        body+=path(f'M43 {78+bob}Q25 {82+bob} 28 {100+bob} 36 111 15 110L13 103Q27 105 22 96 19 78 42 {69+bob}Z',CREAM,INK,2)
        body+=group(path(b.ARMS[i][1],CREAM)+line('M89 68 102 70M94 78 106 80', '#a99ba7',2),f'translate(0 {bob})')
        body+=path(f'M44 {44+bob}Q43 {15+bob} 73 {14+bob} 104 {16+bob} 102 {47+bob}L93 {71+bob} 50 {72+bob}Z',CREAM,INK,3)
        body+=circle(hx,hy,24,PAPER,INK,2)
        body+=path(f'M46 {30+bob} 96 {19+bob} 100 {27+bob} 43 {39+bob}ZM50 {64+bob} 96 {58+bob} 94 {69+bob} 51 {75+bob}Z',CREAM,INK,1.5)
        body+=line(f'M50 {25+bob} 57 {27+bob}M77 {19+bob} 82 {23+bob}M62 {67+bob} 66 {72+bob}', '#a99ba7',1.4)
    elif kind=='goblin':
        hx,hy,r=76,46+bob,19
        body+=path(f'M51 {63+bob} 85 {59+bob} 90 84 73 96 42 93 47 79Z',GREEN,INK,3)
        body+=path(f'M48 77 70 83 86 72 89 80 71 91 45 85Z',RUST,INK,2)
        body+=path('M68 81 77 79 78 87 69 89Z',GOLD,INK,1.5)
        body+=path(f'M49 {34+bob} 24 {18+bob} 33 {49+bob} 51 {58+bob}M94 {35+bob} 119 {28+bob} 105 {52+bob} 92 {57+bob}',MINT,INK,2.5)
        body+=path(f'M45 {35+bob}Q63 {8+bob} 86 {20+bob}L102 {42+bob} 96 {67+bob} 54 {70+bob}Z',GREEN,INK,3)
        body+=circle(hx,hy,22,MINT,INK,2)
        body+=path(f'M48 {29+bob} 59 {8+bob} 85 {6+bob} 99 {23+bob}Q80 {17+bob} 62 {37+bob}Z',RUST,INK,2.5)
        body+=line(f'M57 {26+bob} 66 {16+bob} 85 {13+bob}',GOLD,2)
        sack=path('M18 58 36 54Q54 70 48 100 27 117 8 101 0 80 18 58Z','#b48c64',INK,2.6)+path('M17 60 13 48 26 51 33 43 39 56Z',GOLD,INK,2)+line('M15 59 39 56',RUST,4)+path('M11 87 25 82 29 98 15 102Z',GREEN,INK,1.5)
        body+=group(sack,f'rotate({[8,1,-10,-6,3,10][i]} 32 75)')
        body+=group(path(b.ARMS[i][1],MINT),f'translate(0 {bob})')
        if special is not None:
            pos=[(111,78,-15),(98,58,-35),(60,51,-65),(29,67,15)][special]
            jar=path('M-8-13 8-13 10-7Q17 18 0 18-17 18-10-7Z',MINT,INK,2)+path('M-10-17 10-17 10-10-10-10Z',GOLD,INK,2)+candy(0,3,.37,20,PINK)
            body+=group(jar,f'translate({pos[0]} {pos[1]}) rotate({pos[2]})')
            body+=line(f'M95 {72+bob}Q85 57 {pos[0]} {pos[1]+7}',INK,11)+line(f'M95 {72+bob}Q85 57 {pos[0]} {pos[1]+7}',MINT,7)
    else:
        body+=path(f'M51 {60+bob} 83 {60+bob} 85 {95+bob} 48 {96+bob}Z',PURPLE,INK,3)
        body+=line(f'M66 {65+bob} 67 {94+bob}',CREAM,5)
        for yy in (69,77,85): body+=line(f'M53 {yy+bob}Q67 {yy+8+bob} 80 {yy-1+bob}',CREAM,3)
        body+=group(path(b.ARMS[i][1],PURPLE),f'translate(0 {bob})')
        body+=line(f'M88 {66+bob} 96 {78+bob} 105 {83+bob}',CREAM,4)
        body+=path(f'M43 {47+bob}Q34 {14+bob} 66 {11+bob} 106 {8+bob} 104 {44+bob}L96 {59+bob} 95 {75+bob} 48 {73+bob} 47 {59+bob}Z',CREAM,INK,3)
        body+=circle(hx,hy,24,DARK,INK,2)
        body+=line(f'M55 {65+bob} 55 {73+bob}M65 {66+bob} 65 {74+bob}M77 {66+bob} 77 {74+bob}M87 {64+bob} 87 {73+bob}',PURPLE,2)
        body+=path(f'M48 {26+bob} 42 {20+bob} 46 {14+bob}M85 {14+bob} 91 {20+bob} 85 {26+bob}','none', '#a299a9',1.6)
    if small:
        scale=.64 if kind=='mini' else .67
        tx=65*(1-scale);ty=118*(1-scale)
        a+=group(body,f'translate({tx} {ty}) scale({scale})')
        hx,hy,r=hx*scale+tx,hy*scale+ty,r*scale
    else: a+=body
    return a,(hx,hy,r)


def units():
    for kind in ('witch','mummy','mini','goblin','skeleton'):
        anchors=[]
        for i in range(6):
            a,h=enemy_pose(kind,i)
            add('units2',f'enemy/{kind}/walk/{i}',128,128,a,[h]);anchors.append(dict(zip(('x','y','r'),h)))
        a,h=enemy_pose(kind,1)
        # Uniform recoil preserves the circular window, even on the smaller swarm units.
        a=group(a,'translate(10 8) rotate(-10 64 64) scale(.92)')+star(25,34,10,GOLD,4,1.5)
        x,y,r=h; rad=math.radians(-10)
        hurt=(10+64+(x*.92-64)*math.cos(rad)-(y*.92-64)*math.sin(rad),8+64+(x*.92-64)*math.sin(rad)+(y*.92-64)*math.cos(rad),r*.92)
        add('units2',f'enemy/{kind}/hurt',128,128,a,[hurt])
        deaths=[]
        for i in range(3):
            if i==0:
                a,h=enemy_pose(kind,1)
                a=group(a,'translate(-5 43) scale(1.08 .63)')+candy(104,39,.4,-30,PINK)
                h=(h[0]*1.08-5,h[1]*.63+43,h[2]*.63);holes=[h]
            else:
                a=b.burst(64,69,42,GOLD,2) if i==1 else ellipse(64,117,25,4,DARK,'none',0,'opacity=".2"')
                for j in range(5):
                    t=j*math.tau/5-.5;r=29 if i==1 else 45
                    a+=candy(64+math.cos(t)*r,65+math.sin(t)*r+(12 if i==2 else 0),.53 if i==1 else .34,j*41+i*45,[PINK,MINT,GOLD,ORANGE,VIOLET][j])
                if i==2: a+=star(64,63,7,CREAM,4,1)+star(111,24,5,GOLD,4,1)
                h=(64,64,0);holes=[]
            add('units2',f'enemy/{kind}/die/{i}',128,128,a,holes);deaths.append(dict(zip(('x','y','r'),h)))
        data={**anchors[0],'frames':anchors,'hurt':dict(zip(('x','y','r'),hurt)),'die':deaths}
        if kind in ('witch','goblin'):
            move='cast' if kind=='witch' else 'grab';data[move]=[]
            for i in range(4):
                a,h=enemy_pose(kind,[0,2,3,1][i],i)
                add('units2',f'enemy/{kind}/{move}/{i}',128,128,a,[h]);data[move].append(dict(zip(('x','y','r'),h)))
        NEW_FACES[kind]=data
    for i in range(6): add('units2',f'guard/jack/walk/{i}',96,96,jack(i))
    for i in range(3): add('units2',f'guard/jack/attack/{i}',96,96,jack(i,True))
    for kind in ('knight','jack'):
        for i in range(2):
            add('units2',f'guard/{kind}/cheer/{i}',96,96,cheer(kind,i))


def cheer(kind,i):
    jack_knight=kind=='jack';dy=4 if i==0 else 0
    a=ellipse(48,91,29,4,DARK,'none',0,'opacity=".24"')
    body=group(path(b.LEGS[1 if i==0 else 3][0],PURPLE)+path(b.LEGS[1 if i==0 else 3][1],LILAC),'translate(2 4) scale(.69)')
    body+=path('M31 44 61 42 67 68 48 79 28 69Z','#8594ad',INK,2.5)+path('M33 49 45 53 44 70 33 64Z',CREAM,INK,1.5)
    body+=line('M32 48 21 36 15 21M63 47 75 35 77 21',INK,11)+line('M32 48 21 36 15 21M63 47 75 35 77 21',LILAC,6)
    body+=pumpkin(48,29,.65,True)
    body+=path('M28 28Q27 6 47 6 69 5 68 27L60 27 59 18 35 20 35 29Z','#8594ad',INK,2.4)
    if jack_knight:body+=path('M31 15 29 3 41 10 49 2 55 10 67 4 65 17Z',GOLD,INK,1.7)
    else:body+=path('M44 7Q31-2 23 8L19 18 33 13 43 16Z',PINK,INK,2)
    shield=path('M5 13 16 8 29 15 26 31 17 39 7 30Z',VIOLET,INK,2.2)
    shield+=pumpkin(17,22,.24,True) if jack_knight else star(17,22,7,GOLD,5,1.3)
    body+=group(shield,f'rotate({-13 if i==0 else 12} 17 24)')
    sword=path('M74 27 75 8 79 2 84 9 82 28Z',CREAM,INK,2)+line('M70 27 87 29',GOLD,4)+line('M77 30 77 37',RUST,4)
    body+=group(sword,f'rotate({-9 if i==0 else 12} 77 32)')
    a+=group(body,f'translate(0 {dy})')
    a+=star(33,12 if i==0 else 7,4,GOLD,4,1)
    return a


def jack(i,attack=False,cheer=False):
    idx=[2,0,3][i] if attack else i;bob=b.BOBS[idx]*.5
    a=ellipse(48,90,33,5,DARK,'none',0,'opacity=".24"')
    a+=group(path(b.LEGS[idx][0],PURPLE)+path(b.LEGS[idx][1],LILAC),'translate(-1 6) scale(.72)')
    a+=path(f'M25 {44+bob} 66 {44+bob} 70 73 48 84 27 76Z',PURPLE,INK,2.5)
    a+=path(f'M28 {43+bob} 48 {49+bob} 65 {41+bob} 65 69 48 80 29 69Z','#8594ad',INK,2.5)
    a+=path(f'M34 {47+bob} 45 {53+bob} 45 71 35 67Z',CREAM,INK,1.5)
    a+=path(f'M24 {43+bob} 17 {51+bob} 30 {55+bob} 39 {46+bob}ZM59 {43+bob} 67 {38+bob} 78 {48+bob} 64 {54+bob}Z',LILAC,INK,2)
    a+=pumpkin(48,30+bob,.7,True)
    a+=path(f'M27 {28+bob}Q24 {5+bob} 45 {4+bob} 67 {1+bob} 71 {24+bob}L64 {31+bob} 62 {19+bob} 33 {22+bob} 33 {34+bob}Z','#8594ad',INK,2.5)
    a+=path(f'M35 {12+bob} 29 {1+bob} 44 {8+bob} 50 {0+bob} 57 {8+bob} 67 {2+bob} 65 {16+bob}Z',GOLD,INK,1.8)
    a+=line(f'M34 {18+bob} 59 {15+bob}',CREAM,2)
    shield=path('M7 45 26 40 39 49 35 72 22 87 8 72Z',PURPLE,INK,2.5)+path('M11 49 25 45 34 51 30 70 22 80 12 68Z',VIOLET,INK,1.5)+pumpkin(23,59,.32,True)
    a+=group(shield,f'rotate({[-12,-5,5,12,4,-7][idx]} 24 55)')
    sword=path('M65 66 67 29 74 17 83 29 77 68Z',CREAM,INK,2.5)+path('M76 24 76 61 72 62Z',LILAC,'none',0)+line('M61 63 83 67',GOLD,5)+line('M70 69 68 79',RUST,5)
    angle=[-80,55,86][i] if attack else (-30 if cheer else [-13,-6,6,13,4,-8][idx])
    if attack and i>0:sword=group(sword,'translate(66 66) scale(.72) translate(-66 -66)')
    a+=group(sword,f'translate({-7 if attack and i>0 else 0} 0) rotate({angle} 66 66)')
    if attack and i==1: a+=path('M45 4Q94 9 93 69L84 79Q89 29 45 4Z',GOLD,INK,1.5)+line('M63 14Q84 28 87 49',CREAM,2)
    return group(a,'translate(2 3) scale(.95 .94)')


def towers2():
    for family,style in [('egg','rotten'),('egg','golden'),('tp','mummy'),('tp','tornado'),('lantern','wisp'),('lantern','moon'),('patch','knights'),('patch','vines')]:
        a=b.tower_base(3)
        if family=='egg':
            col=GREEN if style=='rotten' else GOLD
            a+=path('M26 126 79 109 134 127 129 167 80 182 29 166Z',PURPLE,INK,3)
            a+=path('M32 130 76 143 76 174 33 163Z',col,INK,2)+path('M83 144 128 132 123 161 83 174Z',RUST if style=='golden' else GREEN,INK,2)
            a+=path('M24 124 25 66 35 62 38 128ZM123 127 123 62 135 65 136 125Z',RUST,INK,3)
            a+=line('M29 69 31 116M128 69 130 111',GOLD,2)
            a+=path('M15 61 38 43 122 43 146 61 138 82Q119 91 107 80 94 91 80 80 65 93 52 82 36 94 18 82Z',col,INK,3)
            a+=path('M17 61 40 45 121 45 143 61Z',MINT if style=='rotten' else CREAM,INK,2)
            a+=line('M45 47 43 61M78 46 78 62M112 47 114 62',col,9)
            if style=='rotten':
                a+=path('M47 50Q28 17 59 12 70-2 85 10 105 0 116 22 122 40 102 51Z',GREEN,INK,2.5)
                a+=egg(80,30,1.08,0)+path('M62 23 76 32 85 23 97 34M67 37 79 43 89 35','none',GREEN,3)
                a+=path('M58 112Q44 96 60 91L64 80 70 94Q87 94 79 110Z',MINT,INK,2)
                a+=ellipse(82,120,37,11,INK,INK,2)+ellipse(82,118,32,7,MINT,INK,1.5)
                for x,y in [(55,110),(94,101),(109,112)]: a+=circle(x,y,6,MINT,INK,1.5)
                a+=b.group(b.modifier('toxic'),'translate(57 139) scale(.66)')
            else:
                a+=path('M53 41 41 12 63 23 80 3 99 22 123 12 111 43Z',GOLD,INK,3)+egg(81,33,.8,0)
                a+=path('M29 117 57 95 82 99 102 88 131 111 128 126 82 140 29 127Z',GOLD,INK,2.5)
                for x,y in [(55,114),(82,109),(106,111)]: a+=egg(x,y,.55).replace(CREAM,GOLD)
                a+=star(82,155,12,CREAM,5,2)+star(21,98,9,GOLD,4,1.5)+star(139,99,8,GOLD,4,1.5)
        elif family=='tp':
            a+=path('M40 162 41 63 80 49 120 62 122 162 80 177Z',PURPLE,INK,3)
            a+=path('M44 64 79 77 79 171 45 159Z',LILAC,INK,2)
            if style=='mummy':
                for yy in (78,102,126,149): a+=path(f'M36 {yy} 124 {yy-13} 126 {yy+1} 35 {yy+15}Z',CREAM,INK,2)
                a+=path('M52 58 40 27 52 15 80 8 110 18 123 41 111 59Z',GOLD,INK,3)
                a+=path('M58 31 96 24 101 51 60 58Z',PURPLE,INK,2)
                a+=path('M61 35 73 32 71 40 62 42ZM85 31 98 28 96 37 87 39Z',MINT,INK,1.5)
                a+=paper_roll(120,111,.73,35)+path('M115 130Q150 128 146 99L135 97Q141 119 119 118Z',CREAM,INK,2)
                a+=path('M46 145Q15 151 17 125L29 123Q26 137 47 132Z',CREAM,INK,2)
                a+=line('M52 84 52 98M96 99 96 111M69 127 69 138', '#a99baa',1.5)
            else:
                a+=path('M32 73 81 55 130 71 119 95 80 107 40 94Z',VIOLET,INK,3)
                for j in range(4):
                    yy=82-j*18;rx=19+j*8
                    a+=path(f'M{80-rx} {yy}Q{80-rx-13} {yy-16} {80+rx} {yy-20}L{80+rx+6} {yy-10}Q{80-rx+6} {yy-6} {80-rx+4} {yy+5}Z',CREAM,INK,2)
                a+=paper_roll(112,30,.64,25)+paper_roll(44,49,.51,-35)
                a+=b.group(b.modifier('wind'),'translate(55 115) scale(1.05)')
                a+=line('M25 108Q10 81 32 71M134 112Q155 88 139 70',MINT,3)
        elif family=='lantern':
            a+=path('M54 164 65 101 55 83 80 68 105 83 94 102 108 164 80 178Z',PURPLE,INK,3)
            a+=path('M61 161 73 104 80 99 79 170Z',LILAC,INK,2)
            if style=='wisp':
                a+=line('M80 101 80 30M77 65Q25 49 24 80M84 66Q132 50 139 79',PURPLE,12)
                a+=line('M77 96 77 36M75 62Q29 48 25 74',LILAC,3)
                for x,y,s in [(24,104,.74),(139,102,.72),(80,49,1.06)]: a+=lantern(x,y,s,True)
                a+=path('M63 142Q33 124 50 109L63 97 59 118Q91 131 102 108 122 139 95 151Z',MINT,INK,2.5)
                a+=circle(69,134,3,PURPLE,'none',0)+circle(81,135,3,PURPLE,'none',0)
                a+=star(31,30,8,MINT,4,1.5)+star(130,36,9,GOLD,4,1.5)
            else:
                a+=path('M99 7Q42 1 23 48 13 92 57 116L74 105Q41 96 44 60 47 31 74 26Z',GOLD,INK,3)
                a+=path('M99 7Q65 16 57 37 25 74 57 107Q24 92 31 57 41 25 74 15Z',CREAM,'none',0)
                a+=circle(89,65,27,VIOLET,INK,3)+circle(89,65,18,MINT,INK,2)+star(89,65,13,CREAM,4,1.5)
                a+=line('M91 92 100 117',GOLD,6)+star(130,34,11,GOLD,5,2)+star(134,84,7,CREAM,4,1.5)
                a+=ellipse(83,150,20,9,PURPLE,INK,2)+star(84,146,10,MINT,4,1.5)
        else:
            a+=path('M21 139 80 120 140 139 136 169 80 186 24 168Z',GREEN,INK,3)
            a+=path('M24 140 80 123 137 140 80 160Z','#514342',INK,2)
            if style=='knights':
                a+=path('M33 139 31 48 43 48 43 60 55 60 55 47 68 47 68 139ZM98 140 97 47 109 47 109 60 122 60 122 48 135 48 131 143Z',PURPLE,INK,3)
                a+=path('M35 76 64 77 63 130 36 136ZM101 77 131 76 129 136 101 130Z',LILAC,INK,2)
                a+=path('M62 67 81 53 102 67 100 82 61 82Z',GOLD,INK,2.5)
                a+=pumpkin(80,112,.88,True)+path('M59 108Q56 81 80 78 106 79 103 108L94 102 91 91 67 91 67 106Z','#8594ad',INK,2.5)
                a+=path('M50 47 52 10 56 6 58 11 59 47Z',GOLD,INK,2)+path('M58 12 104 15 94 32 58 31Z',PINK,INK,2)+star(77,22,7,CREAM,5,1.5)
                a+=path('M36 149 56 143 70 151 66 169 53 178 39 169Z',VIOLET,INK,2)+pumpkin(54,157,.28,True)
            else:
                a+=path('M38 151Q3 102 31 75 61 72 43 104 22 116 32 87M113 156Q159 130 142 96 124 73 112 99 112 119 130 117','none',INK,13)
                a+=path('M38 151Q3 102 31 75 61 72 43 104 22 116 32 87M113 156Q159 130 142 96 124 73 112 99 112 119 130 117','none',MINT,8)
                a+=path('M58 135Q31 101 56 63L74 59Q101 81 99 131Z',GREEN,INK,3)
                a+=pumpkin(79,82,1.17,True)
                a+=path('M53 58 46 31 68 39 79 12 95 36 116 29 105 57Z',MINT,INK,3)
                a+=path('M68 132Q56 162 87 163 111 156 95 140','none',INK,11)+path('M68 132Q56 162 87 163 111 156 95 140','none',MINT,6)
                for x,y in [(22,116),(138,131),(43,153)]: a+=path(f'M{x} {y}q-13-20-22-7 6 13 22 7Z',GOLD,INK,2)
        add('units2',f'tower/{family}/{style}',160,200,a)


def kit_icons(kits):
    icons={}
    def put(slot,family,art): icons[f'kit/{slot}/{family}']=art
    def mod(name): return group(b.modifier(name),'translate(8 8)')
    heart=path('M32 52Q3 36 10 20 20 7 32 23 44 7 55 21 63 38 32 52Z',PINK,INK,2.7)+line('M17 25Q19 18 24 24',CREAM,2.5)
    bolt=path('M35 5 12 35 29 34 24 59 53 24 35 27 46 6Z',GOLD,INK,2.5)+line('M35 16 23 30',CREAM,2)
    peel=path('M29 12Q32 37 8 49L5 43 21 28 24 13ZM31 13Q33 35 57 40L60 51Q43 53 30 35 24 51 15 54L12 49Q23 33 24 15Z',GOLD,INK,2.4)+path('M24 9 33 9 33 17 24 17Z',RUST,INK,1.5)
    for f in kits['slots']['weapon']:
        a={'pitch-deck':card(20,35,.95,-25)+card(38,28,1.1,14),
           'scepter':line('M17 53 39 14',INK,7)+line('M17 53 39 14',GOLD,4)+star(39,15,13,MINT,5,2),
           'ball-chain':line('M8 45Q25 65 37 32',INK,6)+line('M8 45Q25 65 37 32',PAPER,3)+circle(40,24,17,'#73768e',INK,2.5)+line('M29 22Q30 14 38 13',CREAM,3),
           'fastball':baseball(33,27,1.7)+b.text(33,59,'143',13,CREAM,INK,1),
           'slingshot':path('M25 57 25 32 7 16 12 8 32 27 48 8 55 15 38 34 37 56Z',RUST,INK,2.7)+line('M11 12 30 19 51 12',GOLD,3)+line('M30 36 30 49',CREAM,2),
           'mascot':path('M15 11 39 11 38 32 53 41 54 51 9 51 8 42 17 29Z',VIOLET,INK,2.5)+b.burst(32,51,18,GOLD,1.5)+path('M12 43 52 43 51 51 12 52Z',PINK,INK,2),
           'egg-lob':egg(33,32,1.25,-12),
           'junk':junk_piece(0,24,30,1.1,-17)+junk_piece(1,43,39,.78,10),
           'blaster':gun(32,27,1.02),
           'fan':fan(31,31,1.03),
           'ray-gun':gun(30,28,1.03,True),
           'anime':circle(32,32,17,GOLD,INK,2.5)+star(32,32,12,CREAM,4,1.5)+path('M6 18Q10 4 23 8M44 55Q59 52 59 35','none',ORANGE,3),
           'tickle':path('M17 52 9 36Q8 29 14 30L23 36 21 14Q24 8 28 14L30 31 31 9Q36 5 38 12L37 31 44 13Q49 10 50 17L45 34 53 26Q60 25 57 33L46 52Z',CREAM,INK,2.5)}[f]
        put('weapon',f,a)
    for f,a in {
        'laser':mod('laser'),
        'target-lock':circle(32,32,19,'none',PINK,4)+circle(32,32,5,GOLD,INK,2)+line('M32 4 32 18M32 46 32 60M4 32 18 32M46 32 60 32',CREAM,3),
        'deal-with-it':path('M5 20H27V25H37V20H59V37H54V42H40V36H36V29H28V36H24V42H10V37H5Z',INK,INK,1)+line('M11 24 19 24M41 24 49 24',CREAM,3),
        'tear-flood':path('M5 49Q11 22 33 13 53 3 60 25 59 39 45 39 34 32 42 25 26 29 28 43 40 51 58 51L58 58H7Z',MINT,INK,2.5)+line('M13 45Q20 24 37 21',CREAM,3),
        'charm':heart+star(10,10,6,GOLD,4,1.3),
        'play-dead':path('M12 49Q8 12 31 10 57 9 53 49L44 45 36 56 26 47 16 55Z',CREAM,INK,2.5)+line('M19 25 27 33M19 33 27 25M36 25 44 33M36 33 44 25',PURPLE,2.5),
        'stare-down':path('M7 22 28 29 24 40 8 34ZM36 29 57 22 56 34 40 40Z',GOLD,INK,2.5)+line('M21 28 21 35M43 28 43 35',INK,4),
        'confetti':path('M10 54 24 23 44 42Z',VIOLET,INK,2.5)+line('M17 45 33 45M21 34 32 40',PINK,3)+star(42,17,9,GOLD,5,1.5)+path('M19 12 25 5 31 12 25 18ZM47 32 55 27 60 36 52 39Z',MINT,INK,1.5),
        'pep-talk':path('M11 26 29 25 48 11 49 49 29 38 12 38Z',ORANGE,INK,2.5)+path('M17 38 28 38 24 54 16 53Z',RUST,INK,2)+line('M53 16 59 12M55 29 62 29M54 43 60 48',GOLD,2.5),
    }.items(): put('special',f,a)
    for f,a in {
        'meteor':path('M7 9 41 11 58 27 54 51 31 57 15 41Z',ORANGE,INK,2.5)+path('M12 13 42 22 25 32Z',GOLD,'none',0)+path('M27 47 35 23 52 45 50 53 30 55Z',GOLD,INK,2)+path('M30 39 44 35 39 29 35 25Z',CREAM,INK,1),
        'tidal':path('M5 53Q15 13 35 9 57 5 60 27 56 43 41 36 32 28 42 23 20 27 33 44 45 49 58 47L59 59 5 59Z',MINT,INK,2.5)+path('M10 48Q16 22 34 16 51 12 54 25','none',CREAM,3),
        'twister':mod('wind'),
        'vanish':mod('smoke')+path('M25 50 45 18 52 11 51 27 33 53Z',CREAM,INK,2),
        'arcane':path('M7 31Q1 15 16 16 20 2 32 9 48 2 50 17 63 16 58 33Z',VIOLET,INK,2.5)+path('M30 29 23 43 33 41 28 60 46 36 35 38 41 27Z',MINT,INK,2),
        'bloom':path('M32 59 32 28M31 44Q10 27 7 43 15 56 31 49M33 51Q48 28 58 39 58 54 33 56','none',GREEN,5)+circle(23,23,11,PINK,INK,2)+circle(37,16,11,PINK,INK,2)+circle(46,29,11,PINK,INK,2)+circle(31,35,11,PINK,INK,2)+circle(32,25,9,GOLD,INK,2),
        'love-bomb':circle(30,38,20,PURPLE,INK,2.5)+line('M39 19Q35 6 48 8',GOLD,3)+star(52,10,7,GOLD,4,1.3)+group(heart,'translate(13 23) scale(.5)'),
        'purify':star(32,30,26,CREAM,4,2.5)+star(32,30,15,GOLD,4,1.5)+ellipse(32,53,25,6,'none',MINT,2),
        'thunder':bolt,
        'candy-bomb':circle(31,35,19,VIOLET,INK,2.5)+candy(31,35,.86,0,PINK)+line('M37 17Q38 4 49 9',GOLD,3)+star(54,10,6,GOLD,4,1),
    }.items(): put('ultimate',f,a)
    for f,a in {
        'money-mouth':mod('rich'),'sticky':mod('gum'),
        'rainbow-trail':''.join(path(f'M{8+j*6} 53Q{7+j*6} 15 44 13','none',col,6) for j,col in enumerate((PINK,ORANGE,GOLD,MINT,VIOLET))),
        'sweet-tooth':path('M16 10Q25 5 32 11 44 3 51 14 58 23 48 46 39 61 34 45L29 38 24 51Q18 59 14 46 6 26 16 10Z',CREAM,INK,2.5)+candy(42,39,.55,20,PINK),
        'honk':path('M12 25 30 25 53 10 52 43 29 34 14 36Z',GOLD,INK,2.5)+circle(15,37,11,PINK,INK,2.5)+line('M58 13 62 8M58 29 63 29',CREAM,2),
        'tough':mod('metal'),
        'pity':circle(31,31,23,LILAC,INK,2.5)+line('M16 24 25 20M39 20 47 24M24 44Q31 37 38 44',INK,2.5)+path('M17 31Q7 45 17 47 24 44 17 31Z',MINT,INK,1.5),
        'cheerful':circle(32,32,24,GOLD,INK,2.5)+line('M15 25 20 21 25 25M39 25 44 21 49 25',INK,2.5)+path('M18 35Q32 44 47 34 41 53 30 51 20 46 18 35Z',PURPLE,INK,2),
    }.items(): put('passive',f,a)
    for f,a in {
        'royal':mod('crown'),'spellcraft':mod('wizard'),'hellfire':mod('burning'),'armored':mod('metal'),
        'degen-luck':path('M9 43Q9 13 31 13 52 14 49 35L61 43 36 48 17 45Z',VIOLET,INK,2.5)+star(29,29,10,GOLD,5,1.5),
        'focus':path('M8 17 54 17 53 31 9 32Z',CREAM,INK,2.5)+circle(32,24,7,PINK,INK,1.5)+path('M48 31 61 50 48 44 43 52 39 32Z',PINK,INK,2),
        'bucket-shield':path('M18 11 46 11 53 44 60 48 53 54 8 54 4 47 12 43Z',ORANGE,INK,2.5)+path('M15 35 49 35 52 45 12 45Z',GOLD,INK,2)+star(32,26,7,CREAM,5,1.4),
        'chill':path('M11 32Q8 8 31 8 58 7 53 35L59 49 44 52 42 31 23 31 20 52 7 49Z',LILAC,INK,2.5)+path('M15 21 50 20 49 32 14 33Z',CREAM,INK,2)+star(32,25,7,GOLD,5,1.3),
        'prankster':circle(32,32,21,PINK,INK,2.5)+ellipse(24,23,7,5,CREAM,'none',0)+line('M8 9 14 14M51 10 57 5M53 51 59 57',GOLD,3),
        'oddity':peel,
        'bareheaded':path('M9 46Q4 14 28 11 52 6 56 36L49 52 17 53Z',MINT,INK,2.5)+path('M14 16 18 4 28 14',VIOLET,INK,2)+line('M24 30 29 29M42 29 47 28',INK,3)+path('M33 35 37 34 36 38Z',PINK,INK,1),
    }.items(): put('headgear',f,a)
    for f,a in {
        'lucky-frog':circle(20,18,10,MINT,INK,2)+circle(44,18,10,MINT,INK,2)+ellipse(32,36,24,19,MINT,INK,2.5)+circle(20,18,3,INK,'none',0)+circle(44,18,3,INK,'none',0)+line('M18 38Q33 49 47 37',INK,2),
        'lucky-coin':mod('rich'),
        'snack-bag':path('M17 12 45 12 51 54 12 54Z',PINK,INK,2.5)+line('M18 18 44 18M17 49 46 49',GOLD,3)+candy(32,34,.65,0,GOLD),
        'smoke-puff':path('M7 45 43 28 50 40 13 57Z',RUST,INK,2.5)+path('M42 28 49 25 56 38 49 41Z',ORANGE,INK,2)+line('M44 23Q29 12 44 7 53 5 51 13',LILAC,4),
        'pump':path('M20 21 43 21 43 50 20 50Z',MINT,INK,2.5)+line('M31 11 31 60',MINT,4)+path('M48 22 53 8 60 22Z',MINT,INK,1.5),
        'dump':path('M20 13 43 13 43 43 20 43Z',PINK,INK,2.5)+line('M31 4 31 55',PINK,4)+path('M48 40 54 55 61 40Z',PINK,INK,1.5),
        'heart':heart,'shiv':mod('knife'),
    }.items(): put('trinket',f,a)
    for f,a in {
        'metal':mod('metal'),
        'jade':path('M17 7 44 7 58 27 31 58 6 27Z',MINT,INK,2.5)+path('M17 7 22 27 6 27M44 7 40 27 58 27M22 27 31 58 40 27Z',GREEN,INK,1.5)+line('M21 12 41 12',CREAM,2),
        'multi':''.join(path(f'M32 32 32 7A25 25 0 0 1 57 32Z',col,INK,1.5, f'transform="rotate({i*90} 32 32)"') for i,col in enumerate((PINK,GOLD,MINT,VIOLET))),
        'rare-tone':path('M12 17 31 6 53 18 52 43 32 58 11 42Z',VIOLET,INK,2.5)+star(32,31,17,GOLD,5,2),
        'common':ellipse(32,33,22,23,CREAM,INK,2.5)+line('M17 27Q18 18 25 15',PAPER,3),
    }.items(): put('skin',f,a)
    for f,a in {
        'duck':duck(31,33,1),
        'shark':path('M10 47 15 20 29 8 35 18 50 25 58 43 49 56 20 56Z','#6386a8',INK,2.5)+path('M16 39 51 38 45 50 23 51Z',PURPLE,INK,2)+path('M18 40 23 46 28 40 33 47 39 40 44 45 49 40',CREAM,INK,1.2)+circle(43,28,3,INK,'none',0),
        'banana':peel,
        'dragon':path('M9 45 12 16 24 21 31 9 37 21 53 24 60 36 47 44 48 55 16 55Z',GREEN,INK,2.5)+path('M12 17 9 5 22 14M33 17 37 4 41 20Z',GOLD,INK,1.7)+circle(38,28,3,INK,'none',0)+path('M47 38 58 38 52 44Z',CREAM,INK,1.3),
        'toad':circle(19,17,10,MINT,INK,2)+circle(44,17,10,MINT,INK,2)+ellipse(32,37,25,20,GREEN,INK,2.5)+ellipse(32,42,17,11,'#d0d6a0',INK,1.5)+circle(19,17,3,INK,'none',0)+circle(44,17,3,INK,'none',0),
        'mummy':path('M12 48 10 22Q11 6 32 7 56 8 55 29L51 53 18 56Z',CREAM,INK,2.5)+path('M11 20 51 10 54 21 10 32ZM11 40 53 30 52 43 15 52Z',PAPER,INK,1.5)+path('M19 30 28 27 29 34 21 36ZM37 26 47 23 46 31 38 33Z',PURPLE,INK,1.5),
    }.items(): put('suit',f,a)
    put('weapon-mod','fire',mod('burning'));put('weapon-mod','electric',bolt)
    expected={f'kit/{slot}/{family}' for slot,entries in kits['slots'].items() if slot!='emote' for family in entries if family!='none'}
    assert set(icons)==expected, (expected-set(icons),set(icons)-expected)
    for name,art in icons.items(): add('kit',name,64,64,art)


def sample_skins(traits):
    idx=traits['keys'].index('Skin');skins={};representatives={}
    for skin in traits['values']['Skin']:
        ids=[int(token) for token,row in traits['chogs'].items() if traits['values']['Skin'][row[idx]]==skin]
        # Many portraits vote, so glasses, mouth accessories and nose patches do not dominate.
        per=[];votes=Counter();bins={}
        for token in sorted(ids)[:60]:
            with Image.open(OUT.parent/'chogs-256'/f'{token}.webp') as im:
                rgb=im.convert('RGB');count=Counter()
                for x in range(122,185,2):
                    for y in range(131,178,2):
                        pixel=rgb.getpixel((x,y))
                        if max(pixel)<48:continue
                        key=tuple(v//12 for v in pixel)
                        count[key]+=1;bins.setdefault(key,[]).append(pixel)
                if not count:continue
                key=count.most_common(1)[0][0];votes[key]+=1;per.append((token,key))
        assert votes,skin
        key=votes.most_common(1)[0][0]
        values=bins[key];rgb=tuple(round(sum(p[channel] for p in values)/len(values)) for channel in range(3))
        # The legendary contract intentionally specifies gold instead of their ten unique materials.
        if skin=='':rgb=(255,190,88)
        color='#%02x%02x%02x'%rgb
        skins[skin]={'tint':color};representatives[skin]=next(token for token,k in per if k==key)
        if skin=='Metal':skins[skin]['shine']=True
        if skin=='Multi Colored':
            # Distinct chromatic clusters from the actual face region, ordered by hue.
            candidates=sorted(bins,key=lambda k:len(bins[k]),reverse=True);cycle=[]
            for k in candidates:
                vs=bins[k];rgb=tuple(round(sum(p[ch] for p in vs)/len(vs)) for ch in range(3))
                hue,sat,val=colorsys.rgb_to_hsv(*(v/255 for v in rgb))
                if sat<.25 or val<.35 or any(sum((a-z)**2 for a,z in zip(rgb,old))<4400 for old in cycle):continue
                cycle.append(rgb)
                if len(cycle)==5:break
            assert len(cycle)>=3
            skins[skin]['cycle']=['#%02x%02x%02x'%rgb for rgb in sorted(cycle,key=lambda rgb:colorsys.rgb_to_hsv(*(v/255 for v in rgb))[0])]
            skins[skin]['tint']=skins[skin]['cycle'][0]
    return skins,representatives


def expected_frames(kits):
    names={}
    for c in COSTUMES:
        e={'rig/'+p for p in ('torso','arm-front','arm-back','leg-front','leg-back')}
        # Parts with skin or extras are explicit, preventing a lost layer from passing by accident.
        if c in ('tickle','mascot-duck'):
            e.update({'rig/leg-front-skin','rig/leg-back-skin'})
        if c=='tickle':e.add('rig/torso-skin')
        if not c.startswith('mascot-') or c in ('mascot-duck','mascot-banana'):
            e.update({'rig/arm-front-skin','rig/arm-back-skin'})
        if c in ('scepter','junk','ray-gun','mascot-shark','mascot-dragon','mascot-banana','mascot-mummy'):e.add('rig/extra')
        if c not in ('tickle','anime') and not c.startswith('mascot-'):e.add('rig/weapon')
        def frames(prefix,n):e.update(f'wpn/{prefix}/{i}' for i in range(n))
        if c.startswith('mascot-'):frames('slam',6);frames('twist',4)
        elif c=='fan':frames('gust',4)
        else:
            frames('hit',4)
            if c in ('pitch-deck','fastball','slingshot','egg-lob'):e.add('wpn/proj')
            if c=='scepter':frames('proj',2)
            if c=='ball-chain':frames('arc',4)
            if c=='slingshot':e.add('wpn/zap')
            if c=='egg-lob':e.add('wpn/proj-fire')
            if c=='junk':frames('junk',4)
            if c=='blaster':frames('proj',3)
            if c in ('blaster','ray-gun'):frames('muzzle',3)
            if c in ('ray-gun','anime'):e.add('wpn/beam')
            if c=='anime':frames('charge',4);frames('beam-end',3)
            if c=='tickle':frames('slap',3)
        names['hero-'+c]=e
    e=set()
    for kind in ('witch','mummy','mini','goblin','skeleton'):
        e.update(f'enemy/{kind}/walk/{i}' for i in range(6));e.update(f'enemy/{kind}/die/{i}' for i in range(3));e.add(f'enemy/{kind}/hurt')
    e.update(f'enemy/witch/cast/{i}' for i in range(4));e.update(f'enemy/goblin/grab/{i}' for i in range(4))
    e.update(f'guard/jack/walk/{i}' for i in range(6));e.update(f'guard/jack/attack/{i}' for i in range(3))
    e.update(f'guard/{k}/cheer/{i}' for k in ('knight','jack') for i in range(2))
    e.update('tower/'+k for k in ('egg/rotten','egg/golden','tp/mummy','tp/tornado','lantern/wisp','lantern/moon','patch/knights','patch/vines'))
    names['units2']=e
    names['kit']={f'kit/{slot}/{family}' for slot,entries in kits['slots'].items() if slot!='emote' for family in entries if family!='none'}
    return names


def pack(atlas,items):
    cap=(2048,1024) if atlas=='units2' else (1024,1024)
    widths=range(math.ceil((max(im.width for im in items.values())+4)/64)*64,cap[0]+1,64)
    options=[(w,*b.shelf(items,w)) for w in widths];options=[o for o in options if o[2]<=cap[1]]
    assert options,(atlas,'atlas cap')
    w,positions,h=min(options,key=lambda o:(o[0]*o[2],max(o[0],o[2]),o[0]))
    image=Image.new('RGBA',(w,h));frames={}
    for name,(x,y,ww,hh) in positions.items():
        image.paste(items[name],(x,y))
        frames[name]={'frame':{'x':x,'y':y,'w':ww,'h':hh},'rotated':False,'trimmed':False,
                     'spriteSourceSize':{'x':0,'y':0,'w':ww,'h':hh},'sourceSize':{'w':ww,'h':hh},'pivot':{'x':.5,'y':.5}}
    target=OUT/'atlas'/f'{atlas}.png';image.save(target)
    (OUT/'atlas'/f'{atlas}.json').write_text(json.dumps({'frames':frames,'meta':{'app':'Candy Siege character art','version':'2A','image':target.name,'format':'RGBA8888','size':{'w':w,'h':h},'scale':'1'}},indent=2)+'\n')
    with Image.open(target) as shipped:
        for name,(x,y,ww,hh) in positions.items():
            assert shipped.crop((x,y,x+ww,y+hh)).tobytes()==items[name].tobytes()
            for rect in ((x-2,y-2,x+ww+2,y),(x-2,y+hh,x+ww+2,y+hh+2),(x-2,y,x,y+hh),(x+ww,y,x+ww+2,y+hh)):
                assert not shipped.crop(rect).getchannel('A').getbbox(),(atlas,name,'padding')
    b.contact_sheet(atlas,items)
    return {'frames':len(items),'size':[w,h],'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}


def unit_previews(images):
    units=images['units2'];sheet=Image.new('RGB',(1040,760),'#33283f');d=ImageDraw.Draw(sheet)
    d.text((16,12),'NEW ENEMIES / six poses at 64px + face windows + candy pop',font=b.font(19),fill=CREAM)
    import rig_preview as rp
    portrait=Image.open(OUT.parent/'chogs-256/250.webp').convert('RGBA')
    for row,kind in enumerate(NEW_FACES):
        y=54+row*138;d.text((10,y+25),kind,font=b.font(14),fill=GOLD)
        for i in range(10):
            suffix=f'walk/{i}' if i<6 else ['hurt','die/0','die/1','die/2'][i-6]
            frame=units[f'enemy/{kind}/{suffix}'];fa=NEW_FACES[kind]
            anchor=fa['frames'][i] if i<6 else fa['hurt'] if i==6 else fa['die'][i-7]
            composite=Image.new('RGBA',frame.size);r=anchor['r']
            if r:
                s=round(r*2*64/61);face=portrait.resize((s,s),Image.Resampling.LANCZOS)
                mask=Image.new('L',(s,s));margin=s/2-r;ImageDraw.Draw(mask).ellipse((margin,margin,s-margin,s-margin),fill=255);face.putalpha(mask)
                composite.alpha_composite(face,(round(anchor['x']-s/2),round(anchor['y']-s/2)))
            composite.alpha_composite(frame);im=composite.resize((64,64),Image.Resampling.LANCZOS)
            sheet.paste(im,(115+i*90,y+2),im);d.text((115+i*90,y+86),suffix,font=b.font(10),fill=LILAC)
    sheet.save(ROOT/'preview-units2-motion.png')
    icons=images['kit'];sheet=Image.new('RGB',(8*170,math.ceil(len(icons)/8)*108+44),'#33283f');d=ImageDraw.Draw(sheet)
    d.text((16,12),'KIT / 64px and 32px readability',font=b.font(18),fill=CREAM)
    for i,(name,im) in enumerate(icons.items()):
        x=i%8*170;y=i//8*108+44
        sheet.paste(im,(x+6,y),im);small=im.resize((32,32),Image.Resampling.LANCZOS);sheet.paste(small,(x+100,y+16),small)
        d.text((x+5,y+70),'/'.join(name.split('/')[1:]),font=b.font(10),fill=CREAM)
    sheet.save(ROOT/'preview-kit-phone.png')


def main():
    evidence=ROOT/'preview-chars-build.png'
    previous=Image.open(evidence).info if evidence.exists() else {}
    renderer=shutil.which('rsvg-convert') or shutil.which('magick')
    assert renderer,'Pillow and rsvg-convert or ImageMagick are required'
    readonly={n:(OUT/n).read_bytes() for n in ('traits.json','kits.json')}
    traits=json.loads(readonly['traits.json']);kits=json.loads(readonly['kits.json'])
    original=json.loads((ROOT/'faces.json').read_text());batch1={k:original[k] for k in ('treater','ghost','pumpkin','bat','hero')}
    assert hashlib.sha256(json.dumps(batch1,sort_keys=True,separators=(',',':')).encode()).hexdigest()=='fc616b0f30a71e712f2198a697a58b676af4ecbafa1787eaecd003d1fb3f1a51','batch 1 face values changed'
    for c in COSTUMES:hero_parts(c);weapon_effects(c)
    units();towers2();kit_icons(kits)
    expected=expected_frames(kits)
    assert set(FRAMES)==set(expected)
    for atlas,entries in FRAMES.items():assert set(entries)==expected[atlas],(atlas,expected[atlas]-set(entries),set(entries)-expected[atlas])
    images={atlas:{} for atlas in FRAMES};jobs=[(atlas,name,entry) for atlas,frames in FRAMES.items() for name,entry in frames.items()]
    def render(job):
        atlas,name,(w,h,source,holes)=job
        im=b.render(source,w*2,h*2,renderer).resize((w,h),Image.Resampling.LANCZOS)
        if name.startswith(('rig/','guard/')):
            alpha=im.getchannel('A')
            for edge in ((0,0,w,1),(0,h-1,w,h),(0,0,1,h),(w-1,0,w,h)):
                assert alpha.crop(edge).getextrema()[1]<200,(atlas,name,'ink cut by frame')
        if name in ('wpn/beam','wpn/zap'):
            assert im.crop((0,0,1,h)).tobytes()==im.crop((w-1,0,w,h)).tobytes(),(atlas,name,'tile seam')
        assert im.getbbox() or name+'-skin' in FRAMES[atlas],(atlas,name,'empty')
        for x,y,r in holes:
            for dx,dy in ((0,0),(.5,0),(-.5,0),(0,.5),(0,-.5)):
                assert im.getpixel((round(x+r*dx),round(y+r*dy)))[3]==0,(atlas,name,'face hole')
        return atlas,name,im
    print(f'Rendering {len(jobs)} character SVG frames...',flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for atlas,name,im in pool.map(render,jobs):images[atlas][name]=im
    report={}
    for atlas,items in images.items():
        report[atlas]=pack(atlas,items)
        print(f'{atlas}: {len(items)} frames, {report[atlas]["size"]}',flush=True)
    merged={**original,**NEW_FACES}
    assert all(merged[k]==v for k,v in batch1.items())
    for target in (ROOT/'faces.json',OUT/'atlas/faces.json'):target.write_text(json.dumps(merged,indent=2)+'\n')
    rig=rig_data();skins,reps=sample_skins(traits)
    assert set(skins)==set(traits['values']['Skin'])
    assert all(row['attack'] in {k[7:] for k in rig['clips'] if k.startswith('attack-')} for row in rig['costumes'].values())
    for token,row in traits['chogs'].items():
        body=traits['values']['Body'][row[traits['keys'].index('Body')]];family=kits['assign']['Body'][body]
        costume='mascot-'+kits['assign']['Suit'][body] if family=='mascot' else family
        assert costume in rig['costumes'],(token,costume)
    (OUT/'atlas/rig.json').write_text(json.dumps(rig,indent=2)+'\n');(OUT/'skins.json').write_text(json.dumps(skins,indent=2)+'\n')
    for atlas,items in images.items():
        if atlas.startswith('hero-'):
            for name,im in items.items():
                if name.endswith('-skin'):assert im.size==items[name[:-5]].size
    for kind in NEW_FACES:
        assert len({images['units2'][f'enemy/{kind}/walk/{i}'].tobytes() for i in range(6)})==6
        assert all(d['r']==0 for d in merged[kind]['die'][1:])
    unit_previews(images)
    import rig_preview
    print('Rendering rig contact sheets, samples and 30 fps animation...',flush=True)
    samples=rig_preview.generate(rig,skins,reps)
    assert all((OUT/n).read_bytes()==data for n,data in readonly.items()),'read-only kit or traits changed'
    assert all(json.loads((OUT/'atlas/faces.json').read_text())[k]==v for k,v in batch1.items())
    # Build evidence stays in a preview artifact, inside this job's permitted output set.
    report['checks']={'contract_frames':len(jobs),'costumes':len(COSTUMES),'chogs':len(traits['chogs']),
                      'clips':len(rig['clips']),'rig_samples':samples,'batch1_faces_unchanged':True,
                      'phaser_easing_parity':True,'padding_px':2,'skins':len(skins)}
    d=Image.new('RGB',(1100,780),'#33283f');draw=ImageDraw.Draw(d)
    draw.text((24,15),'BATCH 2A / CONTRACT BUILD',font=b.font(22),fill=CREAM)
    for i,(name,v) in enumerate(report.items()):draw.text((24,55+i*31),f'{name}: {v["frames"]} frames / {v["size"][0]} x {v["size"][1]}' if name!='checks' else json.dumps(v),font=b.font(14 if name!='checks' else 10),fill=GOLD if name=='checks' else CREAM)
    outputs=[OUT/'atlas'/f'{atlas}.{ext}' for atlas in FRAMES for ext in ('png','json')]
    outputs += [OUT/'atlas'/name for name in ('rig.json','rig-samples.json','faces.json')]
    outputs += [OUT/'skins.json',ROOT/'faces.json']
    outputs += [ROOT/f'preview-{atlas}.png' for atlas in FRAMES]
    outputs += [ROOT/f'preview-rig-{c}.png' for c in COSTUMES]
    outputs += [ROOT/name for name in ('preview-rig.webp','preview-rig-overview.png','preview-rig-motion.png','preview-skins.png','preview-units2-motion.png','preview-kit-phone.png')]
    outputs += sorted((ROOT/'svg/chars').rglob('*.svg'))
    hashes={str(p.relative_to(ROOT.parents[1])):hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs}
    inputs=[ROOT/n for n in ('build.py','build_chars.py','rig_preview.py')]+[OUT/'traits.json',OUT/'kits.json',OUT/'atlas/units.png',OUT/'atlas/units.json']
    source_hash=hashlib.sha256(b''.join(p.read_bytes() for p in inputs)).hexdigest()
    if previous.get('source_hash')==source_hash:
        old=json.loads(previous['outputs'])
        assert old==hashes,('rebuild is not deterministic',[n for n,v in hashes.items() if old.get(n)!=v])
        print(f'REPRODUCIBLE: {len(hashes)} output files match the previous build.',flush=True)
    metadata=PngInfo();metadata.add_text('source_hash',source_hash);metadata.add_text('outputs',json.dumps(hashes,sort_keys=True))
    d.save(evidence,pnginfo=metadata)
    print(json.dumps(report['checks'],indent=2),flush=True)


if __name__=='__main__':main()
