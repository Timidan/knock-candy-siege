#!/usr/bin/env python3
"""Contract player, preview renderer and rig-samples source. Built by build.py.
Phaser 3.90 default easing equations are copied from its installed math/easing.
Resolved x/y are pivots; transforms scale, rotate, translate, then apply root.
"""
import json
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import build as b

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
    easing_dir=b.OUT.parents[1]/'node_modules/phaser/src/math/easing'
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
            # Parent scales stay uniform: the six-number sample format cannot encode shear.
            if part in ('root','arm-front'):
                assert all(k[1].get('sx',1)==k[1].get('sy',1) for k in track)
        for event,times in c['events'].items():
            for t in times if isinstance(times,list) else [times]: assert 0<=t<=c['ms'],(name,event)
        if name.startswith('attack-') or name in ('special','ultimate'): assert 'release' in c['events']
    assert not rig['clips']['faint']['loop']


def atlas_images(name):
    data=json.loads((b.OUT/'atlas'/f'{name}.json').read_text())
    with Image.open(b.OUT/'atlas'/f'{name}.png') as image:
        return {n:image.crop((f['frame']['x'],f['frame']['y'],f['frame']['x']+f['frame']['w'],f['frame']['y']+f['frame']['h'])).convert('RGBA') for n,f in data['frames'].items()}


def portrait(token,r=30,home=False):
    # The contract inscribes the full portrait at 64/61 R, avoiding a face-only crop.
    size=160; scale=size/112;cx=56*scale;cy=47*scale
    face=Image.open(b.OUT.parent/'chogs-256'/f'{token}.webp').convert('RGBA')
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
        self.images={c:atlas_images('hero-'+c) for c in rig['costumes']}
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
                transformed(head,pivot,hp,image,origin,scale)
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


def generate(rig,skins,representatives):
    self_check(rig)
    samples={c:{name:[{'t':round(i*clip['ms']/7,6),'parts':{p:{k:round(v,6) for k,v in tr.items()} for p,tr in resolve(rig,c,name,i*clip['ms']/7).items()}} for i in range(8)] for name,clip in rig['clips'].items()} for c in rig['costumes']}
    (b.OUT/'atlas/rig-samples.json').write_text(json.dumps(samples,separators=(',',':'))+'\n')
    player=Player(rig)
    traits=json.loads((b.OUT/'traits.json').read_text());skinindex=traits['keys'].index('Skin')
    token=250;skin=traits['values']['Skin'][traits['chogs'][str(token)][skinindex]];tint_color=skins[skin]['tint']
    for c in rig['costumes']:
        cw,ch=288,300;sheet=Image.new('RGB',(164+10*cw,64+len(rig['clips'])*ch),'#33283f');d=ImageDraw.Draw(sheet)
        d.text((18,18),f'{c.upper()} / R=30 / 10 times per clip / portrait #{token}',font=b.font(20),fill=b.CREAM)
        for row,(name,clip) in enumerate(rig['clips'].items()):
            y=64+row*ch;d.text((10,y+83),name,font=b.font(13),fill=b.CREAM)
            d.text((10,y+106),f"{clip['ms']} ms",font=b.font(12),fill=b.GOLD)
            for j in range(10):
                t=clip['ms']*j/9;x=164+j*cw
                im=player.draw(c,name,t,token,tint_color,size=(cw,ch),origin=(164,241),scale=.96)
                sheet.paste(im,(x,y),im)
                d.text((x+55,y+281),f'{t:.0f}',font=b.font(10),fill=b.LILAC)
                d.line((x+7,y+241,x+cw-7,y+241),fill='#65536e',width=1)
        sheet.save(b.ROOT/f'preview-rig-{c}.png')
    # A manageable review sheet shows each silhouette, wind-up, release and recovery.
    overview=Image.new('RGB',(1152,18*220+46),'#33283f');d=ImageDraw.Draw(overview)
    d.text((16,12),'HERO COSTUMES / rest - anticipation - release - follow-through / phone scale at right',font=b.font(17),fill=b.CREAM)
    for row,(c,config) in enumerate(rig['costumes'].items()):
        y=46+row*220;d.text((12,y+48),c,font=b.font(14),fill=b.GOLD)
        attack='attack-'+config['attack'];clip=rig['clips'][attack];release=clip['events']['release']
        for j,(name,t) in enumerate([('idle',0),(attack,release*.65),(attack,release),(attack,min(clip['ms'],release+130))]):
            im=player.draw(c,name,t,token,tint_color,size=(200,220),origin=(88,205),scale=1.08)
            overview.paste(im,(172+j*210,y),im)
        im=player.draw(c,'idle',0,token,tint_color,size=(100,130),origin=(48,115),scale=.62)
        overview.paste(im,(1035,y+26),im)
    overview.save(b.ROOT/'preview-rig-overview.png')
    skin_sheet=Image.new('RGB',(5*236,3*270+45),'#33283f');d=ImageDraw.Draw(skin_sheet)
    d.text((16,12),'PORTRAIT SAMPLES / multiply-tinted bare skin and hands',font=b.font(18),fill=b.CREAM)
    for i,(skin,data) in enumerate(skins.items()):
        x=(i%5)*236;y=(i//5)*270+45;token=representatives[skin]
        face=Image.open(b.OUT.parent/'chogs-256'/f'{token}.webp').convert('RGB').resize((100,100),Image.Resampling.LANCZOS)
        skin_sheet.paste(face,(x+7,y+32))
        im=player.draw('tickle','attack-slap',205,token,data['tint'],size=(128,220),origin=(52,203),scale=1.1)
        skin_sheet.paste(im,(x+107,y),im)
        d.text((x+10,y+227),f'{skin or "Legendary"}  {data["tint"]}',font=b.font(13),fill=b.CREAM)
        d.text((x+10,y+247),f'portrait #{token}',font=b.font(11),fill=b.LILAC)
    skin_sheet.save(b.ROOT/'preview-skins.png')
    # 33/34/33 ms is exactly 30 fps over each group of three WebP frames.
    frames=[];durations=[]
    for frame in range(108):
        t=frame*1000/30;sheet=Image.new('RGB',(6*200,3*220+42),'#33283f');d=ImageDraw.Draw(sheet)
        d.text((14,11),'CANDY SIEGE / walking + attacks / 30 fps / R=30',font=b.font(17),fill=b.CREAM)
        d.text((1100,11),f'{t/1000:.2f}s',font=b.font(17),fill=b.GOLD)
        for i,(c,config) in enumerate(rig['costumes'].items()):
            x=(i%6)*200;y=(i//6)*220+42
            name='walk' if t<1200 else 'attack-'+config['attack'];clip=rig['clips'][name]
            at=t%clip['ms'] if t<1200 else min(t-1200,clip['ms'])
            im=player.draw(c,name,at,250,tint_color,size=(200,220),origin=(84,194),scale=1.02)
            sheet.paste(im,(x,y),im);d.text((x+8,y+202),c,font=b.font(12),fill=b.GOLD)
        frames.append(sheet);durations.append([33,34,33][frame%3])
    frames[0].save(b.ROOT/'preview-rig.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True,method=4)
    with Image.open(b.ROOT/'preview-rig.webp') as movie:
        assert movie.n_frames==108 and movie.info['loop']==0
        actual=[]
        for i in range(movie.n_frames):
            movie.seek(i);movie.load();actual.append(movie.info['duration'])
        assert actual==durations and sum(actual)==3600
    # Three on-disk animation frames make review possible in static image viewers too.
    motion=Image.new('RGB',(1200*3,702))
    for j,index in enumerate((6,45,60)):motion.paste(frames[index],(1200*j,0))
    motion.save(b.ROOT/'preview-rig-motion.png')
    return len(samples)*len(rig['clips'])*8


if __name__=='__main__':
    from build_chars import sample_skins
    traits=json.loads((b.OUT/'traits.json').read_text());skins,reps=sample_skins(traits)
    generate(json.loads((b.OUT/'atlas/rig.json').read_text()),skins,reps)
