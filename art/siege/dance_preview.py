#!/usr/bin/env python3
"""Dance review: python -B art/siege/dance_preview.py [--still]
Player/easing copied once from rig_preview.py at the start of art job 3C.
Independent of build.py and rig_preview.py while job 3B edits both.
Writes only preview-dances.png and preview-dances.webp; FFmpeg encodes WebP.
"""
import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFont
sys.dont_write_bytecode = True
from dances import ROOT, OUT, validate

CREAM = "#f4eedd"
GOLD = "#ffbe58"
LILAC = "#b1a0da"

def font(size):
    path = Path("/usr/share/fonts/TTF/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)

REST={'x':0.,'y':0.,'r':0.,'sx':1.,'sy':1.,'a':1.}
EASES=['linear','sineIn','sineOut','sineInOut','quadIn','quadOut','quadInOut',
       'cubicOut','backIn','backOut','bounceOut','elasticOut']


def ease(name,v):
    if name=='linear': return v
    if name.startswith('sine') and v in (0,1): return v
    if name=='sineIn': return 1-math.cos(v*math.pi/2)
    if name=='sineOut': return math.sin(v*math.pi/2)
    if name=='sineInOut': return .5*(1-math.cos(math.pi*v))
    if name=='quadIn': return v*v
    if name=='quadOut': return v*(2-v)
    if name=='quadInOut':
        v*=2
        if v<1: return .5*v*v
        v-=1
        return -.5*(v*(v-2)-1)
    if name=='cubicOut': return (v-1)**3+1
    if name=='backIn': return v*v*(2.70158*v-1.70158)
    if name=='backOut':
        v-=1
        return v*v*(2.70158*v+1.70158)+1
    if name=='bounceOut':
        if v<1/2.75: return 7.5625*v*v
        if v<2/2.75: return 7.5625*(v-1.5/2.75)**2+.75
        if v<2.5/2.75: return 7.5625*(v-2.25/2.75)**2+.9375
        return 7.5625*(v-2.625/2.75)**2+.984375
    if name=='elasticOut':
        if v in (0,1): return v
        return 2**(-10*v)*math.sin((v-.025)*2*math.pi/.1)+1
    raise ValueError(name)


def values(track,t):
    if not track: return REST.copy()
    if t<=track[0][0]: return {**REST,**track[0][1]}
    if t>=track[-1][0]: return {**REST,**track[-1][1]}
    for start,end in zip(track,track[1:]):
        if start[0]<=t<=end[0]:
            u=ease(end[2] if len(end)>2 else 'linear',(t-start[0])/(end[0]-start[0]))
            return {k:start[1].get(k,rest)+(end[1].get(k,rest)-start[1].get(k,rest))*u for k,rest in REST.items()}
    raise AssertionError('unreachable')


def compose(parent,local):
    r=math.radians(parent['r']);co=math.cos(r);si=math.sin(r)
    x=local['x']*parent['sx'];y=local['y']*parent['sy']
    return {'x':parent['x']+co*x-si*y,'y':parent['y']+si*x+co*y,
            'r':parent['r']+local['r'],'sx':parent['sx']*local['sx'],
            'sy':parent['sy']*local['sy'],'a':parent['a']*local['a']}


def resolve(rig,costume,clip_name,t):
    clip=rig['clips'][clip_name];tracks=clip['tracks'];config=rig['costumes'][costume]
    root=values(tracks.get('root'),t)
    result={};local={}
    for name,node in rig['skeleton'].items():
        p=values(tracks.get(name),t)
        joint=config['joints'].get(name,node['joint'])
        p['x']+=joint[0];p['y']+=joint[1]
        local[name]=p
    for name,node in rig['skeleton'].items():
        p=local[name]
        if node.get('parent'): p=compose(local[node['parent']],p)
        result[name]=compose(root,p)
    return result


def self_check(rig):
    # Compare the actual installed Phaser functions, not a second approximation.
    easing_dir=OUT.parents[1]/'node_modules/phaser/src/math/easing'
    modules={'linear':'linear/Linear','sineIn':'sine/In','sineOut':'sine/Out','sineInOut':'sine/InOut',
             'quadIn':'quadratic/In','quadOut':'quadratic/Out','quadInOut':'quadratic/InOut',
             'cubicOut':'cubic/Out','backIn':'back/In','backOut':'back/Out','bounceOut':'bounce/Out','elasticOut':'elastic/Out'}
    script='const d=JSON.parse(process.argv[1]);const r={}; for(const [n,p] of Object.entries(d)){const f=require(p);r[n]=[0,.125,.5,.875,1].map(v=>f(v));}process.stdout.write(JSON.stringify(r));'
    js=json.loads(subprocess.check_output(['node','-e',script,json.dumps({k:str(easing_dir/(v+'.js')) for k,v in modules.items()})]))
    for n,results in js.items():
        for v,want in zip((0,.125,.5,.875,1),results): assert abs(ease(n,v)-want)<1e-12,(n,v)
    assert values([[0,{'x':10}],[100,{},'quadIn']],50)['x']==7.5
    p=compose({'x':5,'y':7,'r':90,'sx':2,'sy':2,'a':.5},{'x':3,'y':4,'r':20,'sx':.5,'sy':.6,'a':.8})
    assert abs(p['x']+3)<1e-9 and abs(p['y']-13)<1e-9 and p['r']==110 and p['a']==.4
    for name,c in rig['clips'].items():
        assert c['ms']>0 and isinstance(c['loop'],bool)
        for part,track in c['tracks'].items():
            assert part=='root' or part in rig['skeleton']
            assert track[0][0]==0 and track[-1][0]==c['ms'],(name,part,'incomplete')
            assert all(a[0]<z[0] for a,z in zip(track,track[1:]))
            assert all(set(k[1])<=set(REST) and (len(k)==2 or k[2] in EASES) for k in track)
            if c['loop']: assert values(track,0)==values(track,c['ms']),(name,part,'loop seam')
            # Root scales stay uniform; stretched arms have an unrotated weapon child.
            if part == 'root':
                assert all(k[1].get('sx',1)==k[1].get('sy',1) for k in track)
        for event,times in c['events'].items():
            for t in times if isinstance(times,list) else [times]: assert 0<=t<=c['ms'],(name,event)
        if name.startswith('attack-') or name in ('special','ultimate'): assert 'release' in c['events']
    assert not rig['clips']['dance-faint']['loop']


def atlas_images(name):
    data=json.loads((OUT/'atlas'/f'{name}.json').read_text())
    with Image.open(OUT/'atlas'/f'{name}.png') as image:
        return {n:image.crop((f['frame']['x'],f['frame']['y'],f['frame']['x']+f['frame']['w'],f['frame']['y']+f['frame']['h'])).convert('RGBA') for n,f in data['frames'].items()}


def portrait(token,r=30,home=False):
    # The contract inscribes the full portrait at 64/61 R, avoiding a face-only crop.
    size=160; scale=size/112;cx=56*scale;cy=47*scale
    face=Image.open(OUT.parent/'chogs-256'/f'{token}.webp').convert('RGBA')
    d=round(2*31*64/61*scale);face=face.resize((d,d),Image.Resampling.LANCZOS)
    head=Image.new('RGBA',(size,size));head.alpha_composite(face,(round(cx-d/2),round(cy-d/2)))
    mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((cx-31*scale,cy-31*scale,cx+31*scale,cy+31*scale),fill=255)
    head.putalpha(ImageChops.multiply(head.getchannel('A'),mask))
    frame=atlas_images('units')['hero/frame/home' if home else 'hero/frame/guest'].resize((size,size),Image.Resampling.LANCZOS)
    head.alpha_composite(frame)
    # Crop only transparent bounds? No: preserve the batch-one frame exactly, including its ribbons.
    return head, (cx,cy),r/(31*scale)


def tint(image,color):
    rgb=tuple(int(color[i:i+2],16) for i in (1,3,5))
    result=ImageChops.multiply(image,Image.new('RGBA',image.size,(*rgb,255)))
    result.putalpha(image.getchannel('A'))
    return result


def transformed(image,pivot,p,canvas,origin,scale=1):
    if p['a']<=0 or not image.getbbox(): return
    r=math.radians(p['r']);co=math.cos(r);si=math.sin(r)
    sx=p['sx']*scale;sy=p['sy']*scale
    if abs(sx*sy)<1e-9: return
    tx=origin[0]+p['x']*scale;ty=origin[1]+p['y']*scale
    bounds=image.getbbox()
    if bounds:
        corners=[((x-pivot[0])*sx,(y-pivot[1])*sy) for x in (bounds[0],bounds[2]) for y in (bounds[1],bounds[3])]
        xs=[tx+co*x-si*y for x,y in corners];ys=[ty+si*x+co*y for x,y in corners]
        assert min(xs)>=-1 and max(xs)<=canvas.width+1 and min(ys)>=-1 and max(ys)<=canvas.height+1, ('preview clips a part',canvas.size,tuple(round(n,2) for n in (min(xs),min(ys),max(xs),max(ys))))
    left=max(0,math.floor(min(xs))-2);top=max(0,math.floor(min(ys))-2)
    right=min(canvas.width,math.ceil(max(xs))+2);bottom=min(canvas.height,math.ceil(max(ys))+2)
    tx-=left;ty-=top
    # Pillow maps destination pixels back to the source; this is inverse T R S.
    coeff=(co/sx,si/sx,pivot[0]-(co*tx+si*ty)/sx,
           -si/sy,co/sy,pivot[1]+(si*tx-co*ty)/sy)
    frame=image.transform((right-left,bottom-top),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC)
    if p['a']<1: frame.putalpha(frame.getchannel('A').point(lambda v:round(v*max(0,p['a']))))
    canvas.alpha_composite(frame,(left,top))


class Player:
    def __init__(self,rig):
        self.rig=rig
        self.images={c:atlas_images('hero-'+c) for c in ('pitch-deck', 'mascot-dragon')}
        self.heads={}
        self.skins={}
    def draw(self,c,clip,t,token=250,color='#f4eedd',size=(164,248),origin=(80,224),scale=1):
        image=Image.new('RGBA',size);d=ImageDraw.Draw(image)
        p=resolve(self.rig,c,clip,t);config=self.rig['costumes'][c];art=self.images[c]
        lift=max(0,-values(self.rig['clips'][clip]['tracks'].get('root'),t)['y'])
        rx=max(7,24-lift*.15)*scale
        d.ellipse((origin[0]-rx,origin[1]-4*scale,origin[0]+rx,origin[1]+3*scale),fill=(20,13,32,45))
        if token not in self.heads:self.heads[token]=portrait(token,self.rig['R'])
        order=list(self.rig['order'])
        if 'rig/weapon' in art:
            at=order.index('arm-front')+(0 if config['weaponBehind'] else 1);order.insert(at,'weapon')
        for part in order:
            if part=='head':
                head,pivot,hs=self.heads[token];hp=p[part].copy();hp['sx']*=hs;hp['sy']*=hs
                try:
                    transformed(head,pivot,hp,image,origin,scale)
                except AssertionError as error:
                    raise AssertionError((c,clip,t,part,str(error))) from error
                continue
            key='rig/'+part
            if key not in art:continue
            im=art[key];pv=config['pivots'].get(part,[.5,.5]);pivot=(pv[0]*im.width,pv[1]*im.height)
            if key+'-skin' in art:
                tk=(c,part,color)
                if tk not in self.skins:self.skins[tk]=tint(art[key+'-skin'],color)
                transformed(self.skins[tk],pivot,p[part],image,origin,scale)
            try:
                transformed(im,pivot,p[part],image,origin,scale)
            except AssertionError as error:
                raise AssertionError((c,clip,t,part,str(error))) from error
        return image




def finish_webp(path):
    # FFmpeg rounds its final packet short; WebP needs integer-ms 33/34/33 beats.
    data = bytearray(path.read_bytes())
    assert data[:4] == b'RIFF' and data[8:12] == b'WEBP'
    offset, frame = 12, 0
    while offset < len(data):
        size = int.from_bytes(data[offset + 4:offset + 8], 'little')
        assert offset + 8 + size <= len(data)
        if data[offset:offset + 4] == b'ANMF':
            assert size >= 16
            duration = round((frame + 1) * 1000 / 30) - round(frame * 1000 / 30)
            data[offset + 20:offset + 23] = duration.to_bytes(3, 'little')
            frame += 1
        offset += 8 + size + size % 2
    assert frame == 288 and offset == len(data)
    path.write_bytes(data)
    with Image.open(path) as movie:
        assert movie.n_frames == 288 and movie.info['loop'] == 0
        durations = []
        for i in range(movie.n_frames):
            movie.seek(i); movie.load(); durations.append(movie.info['duration'])
        assert durations == [round((i + 1) * 1000 / 30) - round(i * 1000 / 30) for i in range(288)]
        assert sum(durations) == 9600
    print('PASS: preview-dances.webp decoded, 288 frames / 9600 ms / 30 fps.', flush=True)

def generate(still=False):
    rig = json.loads((OUT / 'atlas/rig.json').read_text())
    pack = json.loads((OUT / 'atlas/dances.json').read_text())
    validate(pack, rig, json.loads((OUT / 'kits.json').read_text()))
    rig['clips'] = pack['clips']
    self_check(rig)
    # Exercise every costume joint layout, including newly arriving capes/rings/tails.
    samples = 0
    for costume in rig['costumes']:
        for name, clip in rig['clips'].items():
            for i in range(8):
                p = resolve(rig, costume, name, clip['ms'] * i / 7)
                assert all(math.isfinite(v) for part in p.values() for v in part.values())
                samples += 1
    player = Player(rig)
    traits = json.loads((OUT / 'traits.json').read_text())
    skins = json.loads((OUT / 'skins.json').read_text())
    si = traits['keys'].index('Skin')
    actors = [('pitch-deck', 7), ('mascot-dragon', 61)]
    colors = [skins[traits['values']['Skin'][traits['chogs'][str(token)][si]]]['tint'] for _, token in actors]
    dances = list(pack['dances'].items())
    cw, ch, label, header = 320, 180, 186, 74
    sheet = Image.new('RGB', (label + 8 * cw, header + len(dances) * ch), '#33283f')
    d = ImageDraw.Draw(sheet)
    d.text((16, 12), 'CANDY SIEGE / 34 BODY DANCES / 8 actual sample times per clip', font=font(22), fill=CREAM)
    d.text((16, 43), 'Each pair: pitch-deck #7 / mascot-dragon #61. Actual portrait + skin tint. Endpoints included. No face-effect overlays.', font=font(16), fill=LILAC)
    for row, (key, dance) in enumerate(dances):
        y = header + row * ch; clip = rig['clips'][dance['clip']]
        if row % 2 == 0: d.rectangle((0, y, sheet.width, y + ch - 1), fill='#2c2336')
        d.text((12, y + 38), dance['name'], font=font(17), fill=GOLD)
        d.text((12, y + 63), dance['group'], font=font(12), fill=LILAC)
        d.text((12, y + 83), f"{clip['ms']} ms / {'loop' if clip['loop'] else 'one-shot'}", font=font(12), fill=CREAM)
        for j in range(8):
            t = clip['ms'] * j / 7; x = label + j * cw
            for a, (costume, token) in enumerate(actors):
                im = player.draw(costume, dance['clip'], t, token, colors[a], size=(160, 158), origin=(80, 126), scale=.77)
                sheet.paste(im, (x + a * 160, y), im)
            d.text((x + 121, y + 160), f'{t:.0f} ms', font=font(11), fill=LILAC)
    sheet.save(ROOT / 'preview-dances.png')
    print(f'PASS: {samples} poses across {len(rig["costumes"])} costumes; rig/easing/loop checks; 544 rendered samples.', flush=True)
    if still: return

    # 9.6 s closes all 1.6/2.4/3.2 s loops; one-shots replay on a 2.4 s beat.
    # Stream to the installed encoder instead of retaining 288 full sheets in RAM.
    width, height, cw, ch, header = 1440, 950, 240, 148, 62
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo',
               '-pixel_format', 'rgb24', '-video_size', f'{width}x{height}', '-framerate', '30',
               '-i', '-', '-an', '-c:v', 'libwebp_anim', '-lossless', '1', '-compression_level', '3',
               '-loop', '0', str(ROOT / 'preview-dances.webp')]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
        try:
            for frame in range(288):
                t = frame * 1000 / 30
                movie = Image.new('RGB', (width, height), '#33283f'); d = ImageDraw.Draw(movie)
                d.text((14, 10), 'CANDY SIEGE / 34 dances / 30 fps / real portraits', font=font(21), fill=CREAM)
                d.text((14, 37), 'pitch-deck #7 + mascot-dragon #61 / loops at native speed / one-shots repeat every 2.4 s', font=font(12), fill=LILAC)
                for i, (key, dance) in enumerate(dances):
                    x = (i % 6) * cw; y = header + (i // 6) * ch; clip = rig['clips'][dance['clip']]
                    at = t % clip['ms'] if clip['loop'] else min(t % 2400, clip['ms'])
                    d.rectangle((x + 2, y + 2, x + cw - 3, y + ch - 3), fill='#2c2336')
                    d.text((x + 8, y + 7), dance['name'], font=font(13), fill=GOLD)
                    for a, (costume, token) in enumerate(actors):
                        im = player.draw(costume, dance['clip'], at, token, colors[a], size=(120, 116), origin=(60, 91), scale=.55)
                        movie.paste(im, (x + a * 120, y + 25), im)
                encoder.stdin.write(movie.tobytes())
                if frame % 60 == 0: print(f'WebP: {frame}/288 frames', flush=True)
        finally:
            encoder.stdin.close()
        assert encoder.wait() == 0, 'WebP encoding failed'
    finish_webp(ROOT / 'preview-dances.webp')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--still', action='store_true', help='render the contact sheet only during pose review')
    generate(parser.parse_args().still)
