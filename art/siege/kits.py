"""Builds app/public/siege/kits.json: every Chog trait value -> a family -> an ability in the hero's kit.

Slots: Body -> weapon, Eyes -> special, Aura -> ultimate, Mouth -> passive (and signature emote), Head -> headgear perk,
Accessory -> trinket, Skin -> resistance, Form/Base/Tier -> quirks. Run: python3 kits.py (checks every value is assigned).
"""
import json, pathlib, re, sys

ROOT = pathlib.Path.home() / 'Desktop/chogathon/knock/app/public/siege'
traits = json.loads((ROOT / 'traits.json').read_text())

# family id -> (display name, effect summary). Numbers live in the engine's data; these are the design contract.
FAMILIES = {
    'weapon': {
        'pitch-deck': ('Pitch Deck', 'throws a fan of three business cards; light damage to three targets'),
        'scepter': ('Scepter Bolt', 'magic bolt that ignores armour'),
        'ball-chain': ('Ball & Chain', 'spins a ball and chain: melee area damage'),
        'fastball': ('Fastball', 'very fast throw that bounces to a second enemy'),
        'slingshot': ('Slingshot', 'rapid small shots; electric hoodies chain-zap'),
        'mascot': ('Mascot Slam', 'leaps and slams: area damage; each mascot suit adds its own twist'),
        'egg-lob': ('Egg Lob', 'classic arcing egg with splash; fire shirts set it alight'),
        'junk': ('Junk Toss', 'throws a random piece of junk: can, boot or bottle, random damage'),
        'blaster': ('Pellet Blaster', 'cone of candy pellets'),
        'fan': ('Paper Fan Gust', 'gust in a line that knocks enemies back'),
        'ray-gun': ('Ray Gun', 'piercing beam'),
        'anime': ('Anime Beam', 'charged beam that pierces the whole path (rare outfits only)'),
        'tickle': ('Tickle Slap', 'fast melee slaps'),
    },
    'special': {
        'laser': ('Laser Sweep', 'sweeps a beam along the path; fire burns, green poisons, cyan freezes, purple pierces'),
        'target-lock': ('Target Lock', 'marks the 3 toughest enemies: +50% damage taken; reveals ghosts'),
        'deal-with-it': ('Deal With It', 'sunglasses drop: stuns everyone nearby'),
        'tear-flood': ('Tear Flood', 'a wave of tears that slows and pushes enemies back'),
        'charm': ('Charm', 'three enemies fight for you for 4 seconds'),
        'play-dead': ('Play Dead', 'untargetable, then a jump scare that stuns'),
        'stare-down': ('Stare Down', 'fear cone: enemies walk back'),
        'confetti': ('Confetti Bomb', 'confuses enemies: they wander'),
        'pep-talk': ('Pep Talk', 'nearby towers +30% attack speed'),
    },
    'ultimate': {
        'meteor': ('Candy Corn Meteor', 'huge area hit that leaves fire'),
        'tidal': ('Tidal Wave', 'a wave sweeps the path backwards'),
        'twister': ('Twister', 'pulls enemies together and drops flyers'),
        'vanish': ('Vanishing Act', 'enemies lose their target; the hero backstabs'),
        'arcane': ('Arcane Storm', 'a storm of homing bolts'),
        'bloom': ('Bloom', 'roots enemies and refills 3 candy jars'),
        'love-bomb': ('Love Bomb', 'a wave that charms everything it touches'),
        'purify': ('Purify', 'strips enemy buffs, reveals all, frees stunned towers'),
        'thunder': ('Thunder Chain', 'lightning that chains through 12 enemies'),
        'candy-bomb': ('Candy Bomb', 'a giant candy bomb'),
    },
    'passive': {
        'money-mouth': ('Money Mouth', '+15% candy from kills'),
        'sticky': ('Sticky', 'attacks slow by 20%'),
        'rainbow-trail': ('Rainbow Trail', 'walking leaves a rainbow that slows and hurts'),
        'sweet-tooth': ('Sweet Tooth', 'heals by collecting dropped candy'),
        'honk': ('Honk', 'every 10th attack confuses'),
        'tough': ('Tough', '+20% hero health'),
        'pity': ('Pity', 'enemies near the hero move 10% slower'),
        'cheerful': ('Cheerful', 'nearby towers +5% damage'),
    },
    'headgear': {
        'royal': ('Royal Command', 'towers near the hero +15% damage'),
        'spellcraft': ('Spellcraft', 'spell cooldowns -20%'),
        'hellfire': ('Hellfire', 'hero attacks burn'),
        'armored': ('Armored', '+30% hero armour'),
        'degen-luck': ('Degen Luck', '10% chance of double candy drops'),
        'focus': ('Focus', '+10% critical hits'),
        'bucket-shield': ('Bucket Shield', 'blocks the first hit each wave'),
        'chill': ('Chill', 'immune to slows; enemies near the hero hit softer'),
        'prankster': ('Prankster', 'one more of each trap'),
        'oddity': ('Oddity', 'a one-of-a-kind effect (banana lure, poison mushroom, magic 8-ball, extra laser)'),
        'bareheaded': ('Bareheaded', '+5% move speed'),
    },
    'trinket': {
        'lucky-frog': ('Lucky Frog', 'revives once per level'),
        'lucky-coin': ('Lucky Coin', '+50 starting candy'),
        'snack-bag': ('Snack Bag', 'refills a candy jar every wave'),
        'smoke-puff': ('Smoke Puff', 'a blinding cloud when hit'),
        'pump': ('Pump', 'speeds up on a kill streak'),
        'dump': ('Dump', 'enemies near the hero slow down'),
        'heart': ('Heart', 'hero regenerates health'),
        'shiv': ('Shiv', 'critical hits'),
        'none': ('No trinket', ''),
    },
    'skin': {
        'metal': ('Metal', 'armoured: eggs bounce off'), 'jade': ('Jade', 'lucky drops'), 'multi': ('Multi Colored', 'a random buff each wave'),
        'rare-tone': ('Rare tone', 'small resistance to one status'), 'common': ('Common tone', ''),
    },
    'suit': {  # Mascot Slam's twist, by suit
        'duck': ('Duck', 'the slam quacks: enemies hit are stunned briefly'), 'shark': ('Shark', 'the slam bites: enemies bleed'),
        'banana': ('Banana', 'the slam leaves a peel: enemies slip back'), 'dragon': ('Dragon', 'the slam breathes fire: enemies burn'),
        'toad': ('Toad', 'a tongue pulls the nearest enemy into the slam'), 'mummy': ('Mummy', 'bandages root enemies hit'),
    },
    'weapon-mod': {  # outfit variants that change a weapon's element
        'fire': ('Fire', 'attacks set enemies alight'), 'electric': ('Electric', 'attacks chain-zap to a second enemy'),
    },
    'emote': {
        'rainbow-barf': ('Rainbow Barf', 'a rainbow streams from the mouth'), 'bubble-pop': ('Bubble Pop', 'blows a gum bubble that pops'),
        'bling': ('Bling', 'the gold tooth sparkles'), 'coin-flip': ('Coin Flip', 'flips a coin from the mouth'),
        'drool': ('Drool', 'drools at the candy'), 'honk-honk': ('Honk Honk', 'a clown honk with confetti'),
        'flirt': ('Flirt', 'lip bite and a wink heart'), 'sob': ('Sob', 'big cartoon tears'), 'grr': ('Grr', 'gritted teeth and steam'),
        'heart-eyes': ('Heart Eyes', 'hearts float up'), 'laser-blink': ('Laser Blink', 'eyes flash laser beams'),
        'faint': ('Faint', 'X eyes and a wobble'), 'waterworks': ('Waterworks', 'tears spray out'), 'scan': ('Scan', 'a visor scan line'),
        'deal-with-it': ('Deal With It', 'sunglasses slide down'), 'giggle': ('Giggle', 'bounces with laughter'),
        'steam': ('Steam', 'steam from the ears'), 'side-eye': ('Side Eye', 'a slow suspicious zoom'),
    },
}

def body(v):
    s = v.lower()
    if v in ('Gojo', 'Guko'): return 'anime'
    if any(k in s for k in ('tuxedo', 'gangster', 'ceo', 'mafia', 'vest')) and 'army' not in s: return 'pitch-deck'
    if any(k in s for k in ('robe', 'wizard', 'jesus', 'golden armor')): return 'scepter'
    if any(k in s for k in ('inmate', 'prisoner', 'stripe', 'squid')): return 'ball-chain'
    if any(k in s for k in ('trackset', 'jersey', 'tank', 'sleeveless')): return 'fastball'
    if 'hoodie' in s: return 'slingshot'
    if any(k in s for k in ('duck', 'shark', 'banana', 'dragon', 'toad', 'mummy')): return 'mascot'
    if any(k in s for k in ('homeless', 'holed')): return 'junk'
    if any(k in s for k in ('jacket', 'army')): return 'blaster'
    if any(k in s for k in ('chinese', 'yukata')): return 'fan'
    if any(k in s for k in ('astro', 'sci fi')): return 'ray-gun'
    if v == '': return 'tickle'
    return 'egg-lob'  # shirts, tees, polos and slogan shirts

def eyes(v):
    s = v.lower()
    if 'laser' in s: return 'laser'
    if any(k in s for k in ('visor', 'vr', 'viper', '3d glass')): return 'target-lock'
    if any(k in s for k in ('glass', 'thug')): return 'deal-with-it'
    if any(k in s for k in ('cry', 'tear')): return 'tear-flood'
    if s == 'heart': return 'charm'
    if s in ('dead', 'xd'): return 'play-dead'
    if any(k in s for k in ('angry', 'mog', 'smirk', 'side eye')): return 'stare-down'
    if 'clown' in s: return 'confetti'
    return 'pep-talk'

def aura(v):
    s = v.lower()
    if any(k in s for k in ('burning', 'fiery', 'fire')): return 'meteor'
    if any(k in s for k in ('aqua', 'cool')): return 'tidal'
    if 'wind' in s: return 'twister'
    if 'smoke' in s: return 'vanish'
    if any(k in s for k in ('purple', 'violet', 'royal')): return 'arcane'
    if any(k in s for k in ('mint', 'green')): return 'bloom'
    if any(k in s for k in ('rose', 'pink')): return 'love-bomb'
    if any(k in s for k in ('yellow', 'white', 'clean')): return 'purify'
    if 'electric' in s: return 'thunder'
    return 'candy-bomb'

def mouth(v):
    s = v.lower()
    if any(k in s for k in ('gold tooth', 'btc coin', 'mon coin')): return 'money-mouth'
    if 'bubblegum' in s: return 'sticky'
    if 'rainbow' in s: return 'rainbow-trail'
    if 'drool' in s: return 'sweet-tooth'
    if 'clown' in s: return 'honk'
    if any(k in s for k in ('lip bite', 'grit')): return 'tough'
    if any(k in s for k in ('sad', 'worried')): return 'pity'
    return 'cheerful'

def head(v):
    s = v.lower()
    if any(k in s for k in ('crown', 'wreath', 'thorn', 'holy', 'diamond')): return 'royal'
    if any(k in s for k in ('wizard', '3rd eye')): return 'spellcraft'
    if 'horn' in s: return 'hellfire'
    if any(k in s for k in ('spartan', 'plumber', 'robber', 'mafia')): return 'armored'
    if 'bucket' in s: return 'bucket-shield'
    if any(k in s for k in ('hair', 'durag', 'wig', 'headband', 'bandana', 'head wrap')): return 'focus'
    if any(k in s for k in ('russian', 'peace')): return 'chill'
    if 'clown' in s: return 'prankster'
    if any(k in s for k in ('banana', 'shroom', '8 ball', 'laser')): return 'oddity'
    if v == '': return 'bareheaded'
    return 'degen-luck'  # the many crypto and slogan caps and beanies

def accessory(v):
    return {'Fwog': 'lucky-frog', 'PEPE': 'lucky-frog', 'Coin': 'lucky-coin', 'SB': 'snack-bag', 'Cigar': 'smoke-puff',
            'Green Candle': 'pump', 'Red Candle': 'dump', 'Heart': 'heart', 'Knife': 'shiv'}.get(v, 'none')

def skin(v):
    return {'Metal': 'metal', 'Jade': 'jade', 'Multi Colored': 'multi'}.get(v, 'common' if v in ('Pink', 'Origin', 'Red', 'Black', 'Yellow', '') else 'rare-tone')

def emote(mouth_v, eyes_v):
    m, e = mouth_v.lower(), eyes_v.lower()
    by_mouth = {'rainbow puke': 'rainbow-barf', 'bubblegum': 'bubble-pop', 'gold tooth': 'bling', 'btc coin': 'coin-flip', 'mon coin': 'coin-flip',
                'drooling': 'drool', 'clown mouth': 'honk-honk', 'lip bite': 'flirt', 'sad': 'sob', 'worried': 'sob', 'grit': 'grr'}
    if m in by_mouth: return by_mouth[m]
    if e == 'heart': return 'heart-eyes'
    if 'laser' in e: return 'laser-blink'
    if e in ('dead', 'xd'): return 'faint'
    if 'cry' in e or 'tear' in e: return 'waterworks'
    if any(k in e for k in ('visor', 'vr', 'viper')): return 'scan'
    if 'glass' in e or 'thug' in e: return 'deal-with-it'
    if 'angry' in e or 'mog' in e: return 'steam'
    if 'side eye' in e or 'smirk' in e: return 'side-eye'
    return 'giggle'

def suit(v):
    s = v.lower()
    return next((k for k in ('duck', 'shark', 'banana', 'dragon', 'toad', 'mummy') if k in s), None)

def weapon_mod(v):
    s = v.lower()
    if 'fire' in s: return 'fire'
    if any(k in s for k in ('electro', 'glitch')): return 'electric'
    return None

# Aura-less Chogs (about half) take their ultimate from their home neighbourhood's colour instead.
# The 10 legendaries have no background; they get hand-made kits.
def background(v):
    s = v.lower()
    if s == 'mon' or s == 'radioactive': return 'thunder'
    if s.startswith('deep'): return 'vanish'
    if 'sky blue' in s: return 'twister'
    if any(k in s for k in ('purple', 'lavender')): return 'arcane'
    if 'magenta' in s or 'ros' in s: return 'love-bomb'
    if any(k in s for k in ('sun', 'orange', 'red')): return 'meteor'
    if any(k in s for k in ('aqua', 'blue')): return 'tidal'
    if any(k in s for k in ('mint', 'green')): return 'bloom'
    if any(k in s for k in ('lemon', 'yellow', 'gold')): return 'purify'
    return 'candy-bomb'  # coral and peach pinks

RULES = {'Body': ('weapon', body), 'Eyes': ('special', eyes), 'Aura': ('ultimate', aura), 'Mouth': ('passive', mouth),
         'Head': ('headgear', head), 'Accessory': ('trinket', accessory), 'Skin': ('skin', skin)}
assign = {}
for key, (slot, fn) in RULES.items():
    assign[key] = {v: fn(v) for v in traits['values'][key]}
    unknown = {v: f for v, f in assign[key].items() if f not in FAMILIES[slot]}
    if unknown: sys.exit(f'{key}: unknown families {unknown}')
assign['Suit'] = {v: suit(v) for v in traits['values']['Body'] if assign['Body'][v] == 'mascot'}
assign['WeaponMod'] = {v: m for v in traits['values']['Body'] if (m := weapon_mod(v)) and assign['Body'][v] in ('egg-lob', 'slingshot')}
chogs = json.loads((ROOT.parent / 'chogs.json').read_text())['chogs']
assign['Background'] = {v: background(v) for v in sorted({c['background'] for c in chogs}) if v}
if None in assign['Suit'].values(): sys.exit(f'mascot body without a suit: {assign["Suit"]}')

# Per-Chog signature emote, computed once so the engine just looks it up.
k = traits['keys']
emotes = {}
for cid, row in traits['chogs'].items():
    emotes[cid] = emote(traits['values']['Mouth'][row[k.index('Mouth')]], traits['values']['Eyes'][row[k.index('Eyes')]])

out = {'slots': {slot: {fid: {'name': n, 'effect': e} for fid, (n, e) in fams.items()} for slot, fams in FAMILIES.items()},
       'assign': assign, 'emotes': emotes,
       'quirks': {'Form:Skull': 'Undead: revives once, immune to fear', 'Base:Radioactive': 'Toxic: attacks poison',
                  'Base:1:1': 'Legendary: unique golden ultimate', 'Tier': 'Rare +1, Epic +2, Legendary +3 starting hero level'}}
(ROOT / 'kits.json').write_text(json.dumps(out, separators=(',', ':')))
from collections import Counter
for key, (slot, _) in RULES.items():
    c = Counter()
    for row in traits['chogs'].values():
        c[assign[key][traits['values'][key][row[k.index(key)]]]] += 1
    print(f'{slot:9} ({key}): ' + ', '.join(f'{f} {n}' for f, n in c.most_common()))
print('emotes:', ', '.join(f'{f} {n}' for f, n in Counter(emotes.values()).most_common()))
aura_i = k.index('Aura')
noaura = [c['background'] for c in chogs if c['background'] and traits['chogs'][str(c['id'])][aura_i] == 0]
print('no-aura ultimates:', ', '.join(f'{f} {n}' for f, n in Counter(assign['Background'][b] for b in noaura).most_common()))
print('suits:', assign['Suit']); print('weapon mods:', assign['WeaponMod'])
