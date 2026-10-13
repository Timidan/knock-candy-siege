#!/usr/bin/env python3
"""Candy Siege 3C: authored body choreography; no atlas or costume mutations.

python -B art/siege/dances.py          # validate, then atomically publish
python -B art/siege/dance_preview.py   # contact sheet and 30 fps review
Pose times are milliseconds. Omitted transform values reset to rig REST.
"""
import json
import math
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / 'knock/app/public/siege'
REST = {'x': 0, 'y': 0, 'r': 0, 'sx': 1, 'sy': 1, 'a': 1}
EASES = {'linear', 'sineIn', 'sineOut', 'sineInOut', 'quadIn', 'quadOut',
         'quadInOut', 'cubicOut', 'backIn', 'backOut', 'bounceOut', 'elasticOut'}
UNIVERSAL = ('boo', 'trick', 'treat', 'lol', 'taunt', 'heart', 'cry', 'gg')
SHOP = ('floss', 'dab', 'moonwalk', 'robot', 'chicken', 'breakdance', 'disco', 'worm')
REQUIRED = {'root', 'head', 'arm-front', 'arm-back', 'leg-front', 'leg-back'}


def pose(root=(0, 0, 0), head=0, nod=0, arms=(0, 0), legs=(0, 0), feet=(0, 0),
         chest=0, extra=0, reach=1, **parts):
    """Keep shoulders/hips attached; only feet lift and the neck nods locally."""
    p = {
        'root': dict(zip(('x', 'y', 'r'), root)),
        'head': {'r': head, 'y': nod},
        'torso': {'r': chest},
        'arm-front': {'r': arms[0], 'sx': 1, 'sy': reach},
        'arm-back': {'r': arms[1], 'sx': 1, 'sy': reach},
        'leg-front': {'r': legs[0], 'y': feet[0]},
        'leg-back': {'r': legs[1], 'y': feet[1]},
        'extra': {'r': extra},
    }
    for part, transform in parts.items():
        p[part.replace('_', '-')].update(transform)
    return p


def spin(angle, **kwargs):
    # Rotate about the hips, not the floor, so the portrait never sweeps underground.
    a = math.radians(angle)
    return pose(root=(-50 * math.sin(a), -72 + 50 * math.cos(a), angle), **kwargs)


def choreography():
    pack = {'clips': {}, 'dances': {}}

    def add(key, name, group, ms, beats, loop=True):
        assert beats[0][0] == 0 and beats[-1][0] < ms
        end = beats[0][1] if loop else pose()
        beats = [*beats, (ms, end)]
        tracks = {part: [[time, p[part], ease[0] if ease else 'sineInOut']
                         for time, p, *ease in beats] for part in end}
        # The held prop leaves the hands for the dance, with a 100 ms handoff.
        tracks['weapon'] = [[0, {'a': 1}, 'linear'], [100, {'a': 0}, 'linear'],
                            [ms - 100, {'a': 0}, 'linear'], [ms, {'a': 1}, 'linear']]
        clip = 'dance-' + key
        pack['clips'][clip] = {'loop': loop, 'ms': ms, 'events': {}, 'tracks': tracks}
        pack['dances'][key] = {'name': name, 'clip': clip, 'group': group, 'loop': loop}
        if group == 'universal': pack['dances'][key]['emote'] = key
        if group == 'signature': pack['dances'][key]['sig'] = key

    # Universal: broad silhouettes, readable even without their bubble overlay.
    add('boo', 'Boo!', 'universal', 2400, [
        (0, pose(root=(-5, 0, -4), head=8, arms=(-142, 142), legs=(-8, 8), extra=7)),
        (300, pose(root=(-10, -5, -8), head=-6, nod=-2, arms=(-165, 120), legs=(12, -12), extra=-5)),
        (600, pose(root=(0, -12, 0), head=10, arms=(-150, 155), legs=(18, -18), extra=-10)),
        (900, pose(root=(10, -5, 8), head=-8, nod=2, arms=(-120, 165), legs=(-12, 12), extra=5)),
        (1200, pose(root=(5, 0, 4), head=-8, arms=(-142, 142), legs=(8, -8), extra=-7)),
        (1500, pose(root=(10, -5, 8), head=6, nod=-2, arms=(-120, 165), legs=(-12, 12), extra=5)),
        (1800, pose(root=(0, -12, 0), head=-10, arms=(-155, 150), legs=(-18, 18), extra=10)),
        (2100, pose(root=(-10, -5, -8), head=8, nod=2, arms=(-165, 120), legs=(12, -12), extra=-5)),
    ])
    add('trick', 'Trick!', 'universal', 2400, [
        (0, pose()), (220, pose(root=(0, 2, -8), head=8, arms=(25, -25), legs=(-14, 12))),
        (480, pose(root=(0, -10, 8), head=-10, arms=(-145, 75), legs=(16, -16), extra=-12)),
        *[(650 + i * 86, spin(i * 45, head=(-1)**i * 8,
                              arms=(-145, 110), legs=(-25, 25)), 'linear') for i in range(9)],
        # Reverse flourish returns the numerical angle home without a wrap seam.
        *[(1338 + i * 52, spin(360 - i * 45, head=(-1)**i * 6,
                               arms=(-100, 100), legs=(-20, 20)), 'linear') for i in range(1, 9)],
        (1820, pose(head=8, arms=(-90, 90), legs=(5, -5))),
        (1930, pose(root=(0, 1, 22), head=15, nod=4, arms=(55, 35), legs=(-12, 12))),
        (2120, pose(root=(0, 1, 22), head=15, nod=4, arms=(55, 35), legs=(-12, 12))),
        (2280, pose(root=(0, -2, -3), head=-5, arms=(-25, 15), legs=(5, -5))),
    ], False)
    add('treat', 'Treat?', 'universal', 2400, [
        (0, pose(head=-5, arms=(-62, -50), legs=(-8, 8))),
        (260, pose(root=(0, 2, -5), head=8, nod=3, arms=(-72, -60), legs=(-20, 20))),
        (470, pose(root=(0, -19, 4), head=-8, nod=-2, arms=(-80, -70), legs=(28, -28), extra=-12)),
        (650, pose(root=(0, 1, 3), head=5, nod=3, arms=(-64, -55), legs=(-16, 16), extra=12)),
        (900, pose(root=(0, -7, -2), head=-5, arms=(-90, -80), legs=(8, -8))),
        (1200, pose(head=5, arms=(-62, -50), legs=(8, -8))),
        (1460, pose(root=(0, 2, 5), head=-8, nod=3, arms=(-72, -60), legs=(20, -20))),
        (1670, pose(root=(0, -19, -4), head=8, nod=-2, arms=(-80, -70), legs=(-28, 28), extra=12)),
        (1850, pose(root=(0, 1, -3), head=-5, nod=3, arms=(-64, -55), legs=(16, -16), extra=-12)),
        (2100, pose(root=(0, -7, 2), head=5, arms=(-90, -80), legs=(-8, 8))),
    ])
    add('lol', 'LOL', 'universal', 1600, [
        (0, pose(root=(0, 0, -5), head=-12, arms=(48, -40), legs=(-12, 12))),
        (200, pose(root=(0, -5, -10), head=-18, nod=-2, arms=(55, -50), legs=(-18, 18))),
        (360, pose(root=(0, 1, 8), head=15, nod=4, arms=(16, -40), legs=(-48, 8), feet=(-5, 0))),
        (480, pose(root=(0, 0, 12), head=18, nod=5, arms=(5, -48), legs=(-55, 8), feet=(-5, 0))),
        (650, pose(root=(0, -4, -6), head=-14, arms=(55, -48), legs=(-15, 15))),
        (800, pose(root=(1, 0, -4), head=12, nod=3, arms=(45, -40), legs=(-12, 12))),
        (960, pose(root=(-1, -4, -9), head=-16, arms=(55, -48), legs=(-18, 18))),
        (1120, pose(root=(1, 0, -4), head=12, nod=3, arms=(45, -40), legs=(-12, 12))),
        (1320, pose(root=(-1, -4, -9), head=-16, arms=(55, -48), legs=(-18, 18))),
    ])
    add('taunt', 'Taunt', 'universal', 1600, [
        (0, pose(root=(-6, 0, -5), head=6, arms=(-132, 120), legs=(-16, 16))),
        (200, pose(root=(-6, -8, -4), head=-5, arms=(-145, 138), legs=(-26, 20), extra=8)),
        (400, pose(root=(6, 0, 5), head=-6, nod=2, arms=(-110, 118), legs=(16, -16))),
        (570, pose(root=(6, -8, 4), head=5, arms=(-65, 145), legs=(20, -26), extra=-8)),
        (700, pose(root=(6, -3, 3), head=-7, arms=(-110, 145), legs=(16, -16))),
        (830, pose(root=(6, 0, 5), head=5, nod=2, arms=(-65, 140), legs=(16, -16))),
        (980, pose(root=(6, -8, 4), head=-5, arms=(-118, 138), legs=(20, -26))),
        (1200, pose(root=(-6, 0, -5), head=6, arms=(-132, 120), legs=(-16, 16))),
        (1400, pose(root=(-6, -8, -4), head=-5, arms=(-145, 138), legs=(-26, 20))),
    ])
    add('heart', 'Heart', 'universal', 3200, [
        (0, pose(root=(-6, 0, -6), head=8, arms=(70, -70), legs=(-10, 10))),
        (400, pose(root=(-10, -5, -9), head=12, nod=-2, arms=(175, -175), legs=(8, -8), reach=3, extra=9)),
        (800, pose(root=(0, -9, 0), head=-3, arms=(175, -175), legs=(15, -15), reach=3)),
        (1200, pose(root=(10, -5, 9), head=-12, nod=-2, arms=(175, -175), legs=(-8, 8), reach=3, extra=-9)),
        (1600, pose(root=(6, 0, 6), head=-8, arms=(175, -175), legs=(10, -10), reach=3)),
        (2000, pose(root=(10, -5, 9), head=-12, nod=-2, arms=(175, -175), legs=(-8, 8), reach=3, extra=-9)),
        (2400, pose(root=(0, -9, 0), head=3, arms=(175, -175), legs=(-15, 15), reach=3)),
        (2800, pose(root=(-10, -5, -9), head=12, nod=-2, arms=(175, -175), legs=(8, -8), reach=3, extra=9)),
    ])
    add('cry', 'Cry', 'universal', 2400, [
        (0, pose()), (230, pose(root=(0, 0, -5), head=14, nod=3, arms=(155, -150), legs=(-15, 15))),
        (520, pose(root=(0, 12, 6), head=18, nod=5, arms=(165, -165), legs=(-88, 85))),
        (730, pose(root=(-2, 10, 3), head=9, nod=3, arms=(151, -171), legs=(-88, 85))),
        (900, pose(root=(2, 12, 8), head=20, nod=5, arms=(170, -155), legs=(-88, 85))),
        (1070, pose(root=(-2, 10, 3), head=9, nod=3, arms=(151, -171), legs=(-88, 85))),
        (1240, pose(root=(2, 12, 8), head=20, nod=5, arms=(170, -155), legs=(-88, 85))),
        (1450, pose(root=(-2, 10, 3), head=9, nod=3, arms=(151, -171), legs=(-88, 85))),
        (1660, pose(root=(2, 12, 8), head=20, nod=5, arms=(170, -155), legs=(-88, 85))),
        (1930, pose(root=(0, 8, 0), head=8, nod=3, arms=(130, -130), legs=(-65, 65))),
        (2200, pose(root=(0, -3, -3), head=-5, arms=(25, -25), legs=(8, -8))),
    ], False)
    add('gg', 'GG', 'universal', 2000, [
        (0, pose()), (200, pose(root=(0, 0, -5), head=-5, arms=(-15, 15), legs=(-8, 8))),
        (500, pose(root=(0, 0, 24), head=16, nod=4, arms=(55, -15), legs=(-12, 12))),
        (780, pose(root=(0, 0, 24), head=16, nod=4, arms=(55, -15), legs=(-12, 12))),
        (1030, pose(root=(0, -4, -5), head=-8, arms=(-130, 15), legs=(10, -10), reach=1.2)),
        (1220, pose(root=(0, 0, 0), head=6, arms=(-140, 10), legs=(-8, 8), reach=1.2)),
        (1580, pose(head=-4, nod=-2, arms=(-140, 10), legs=(-8, 8), reach=1.2)),
        (1770, pose(head=4, arms=(-70, 5), legs=(5, -5))),
    ], False)

    # Shop pack: iconic arm lines, footwork and floorwork, with held accents.
    add('floss', 'Floss', 'shop', 2400, [
        (0, pose(root=(-9, 0, -5), head=8, arms=(-68, -64), legs=(-14, 14), extra=10)),
        (180, pose(root=(-12, -3, -7), head=10, arms=(-78, -75), legs=(-18, 18), extra=14)),
        (390, pose(root=(10, 0, 6), head=-8, arms=(55, 58), legs=(14, -14), extra=-10)),
        (600, pose(root=(12, -3, 7), head=-10, arms=(72, 70), legs=(18, -18), extra=-14)),
        (810, pose(root=(-9, 0, -5), head=8, arms=(-45, -72), legs=(-14, 14), extra=10)),
        (990, pose(root=(-12, -3, -7), head=10, arms=(-70, -85), legs=(-18, 18), extra=14)),
        (1200, pose(root=(9, 0, 5), head=-8, arms=(68, 64), legs=(14, -14), extra=-10)),
        (1380, pose(root=(12, -3, 7), head=-10, arms=(78, 75), legs=(18, -18), extra=-14)),
        (1590, pose(root=(-10, 0, -6), head=8, arms=(-55, -58), legs=(-14, 14), extra=10)),
        (1800, pose(root=(-12, -3, -7), head=10, arms=(-72, -70), legs=(-18, 18), extra=14)),
        (2010, pose(root=(9, 0, 5), head=-8, arms=(72, 45), legs=(14, -14), extra=-10)),
        (2190, pose(root=(12, -3, 7), head=-10, arms=(85, 70), legs=(18, -18), extra=-14)),
    ])
    add('dab', 'Dab', 'shop', 1600, [
        (0, pose()), (220, pose(root=(0, 2, -8), head=-8, nod=2, arms=(28, -28), legs=(-18, 18))),
        (370, pose(root=(2, -5, 14), head=24, nod=5, arms=(-133, -125), legs=(-24, 28), reach=1.2), 'cubicOut'),
        (520, pose(root=(2, 0, 10), head=20, nod=4, arms=(-128, -120), legs=(-22, 24), reach=1.2)),
        (1000, pose(root=(2, 0, 10), head=20, nod=4, arms=(-128, -120), legs=(-22, 24), reach=1.2)),
        (1230, pose(root=(0, -3, -3), head=-6, arms=(-45, 15), legs=(8, -8))),
        (1420, pose(head=3, nod=1, arms=(-10, 5), legs=(-4, 4))),
    ], False)
    add('moonwalk', 'Moonwalk', 'shop', 3200, [
        (0, pose(root=(18, 0, -7), head=6, arms=(18, -22), legs=(-30, 25))),
        (400, pose(root=(9, -2, -7), head=2, nod=-1, arms=(8, -12), legs=(0, 2), feet=(-4, 0)), 'linear'),
        (800, pose(root=(0, 0, -7), head=-4, arms=(-22, 18), legs=(25, -30)), 'linear'),
        (1200, pose(root=(-9, -2, -7), head=2, nod=-1, arms=(-12, 8), legs=(2, 0), feet=(0, -4)), 'linear'),
        (1600, pose(root=(-18, 0, -7), head=6, arms=(18, -22), legs=(-30, 25)), 'linear'),
        # The return is a second glide facing the other shoulder, not a teleport.
        (1850, pose(root=(-18, -4, 7), head=-12, arms=(-18, 22), legs=(30, -25))),
        (2150, pose(root=(-9, -2, 7), head=-2, arms=(-8, 12), legs=(0, -2), feet=(0, -4)), 'linear'),
        (2450, pose(root=(0, 0, 7), head=4, arms=(22, -18), legs=(-25, 30)), 'linear'),
        (2750, pose(root=(9, -2, 7), head=-2, arms=(12, -8), legs=(-2, 0), feet=(-4, 0)), 'linear'),
        (3000, pose(root=(18, 0, 7), head=-6, arms=(-18, 22), legs=(30, -25)), 'linear'),
    ])
    add('robot', 'Robot', 'shop', 2400, [
        (0, pose(root=(-4, 0, -4), head=-18, arms=(-90, 0), legs=(-12, 12))),
        (300, pose(root=(-4, 0, -4), head=-18, arms=(-90, 0), legs=(-12, 12)), 'linear'),
        (420, pose(root=(0, -3, 0), head=18, arms=(-90, 90), legs=(12, -12)), 'linear'),
        (720, pose(root=(0, -3, 0), head=18, arms=(-90, 90), legs=(12, -12)), 'linear'),
        (840, pose(root=(4, 0, 4), head=0, nod=3, arms=(0, 90), legs=(0, 0)), 'linear'),
        (1080, pose(root=(4, 0, 4), head=0, nod=3, arms=(0, 90), legs=(0, 0)), 'linear'),
        (1200, pose(root=(4, -3, 4), head=18, arms=(90, 0), legs=(12, -12)), 'linear'),
        (1500, pose(root=(4, -3, 4), head=18, arms=(90, 0), legs=(12, -12)), 'linear'),
        (1620, pose(root=(0, 0, 0), head=-18, arms=(90, -90), legs=(-12, 12)), 'linear'),
        (1920, pose(root=(0, 0, 0), head=-18, arms=(90, -90), legs=(-12, 12)), 'linear'),
        (2040, pose(root=(-4, -3, -4), head=0, nod=-2, arms=(0, -90), legs=(0, 0)), 'linear'),
        (2280, pose(root=(-4, -3, -4), head=0, nod=-2, arms=(0, -90), legs=(0, 0)), 'linear'),
    ])
    add('chicken', 'Chicken', 'shop', 1600, [
        (0, pose(root=(-3, 0, -5), head=8, nod=3, arms=(-68, 68), legs=(-12, 12))),
        (200, pose(root=(-3, -8, -5), head=-8, nod=-3, arms=(-115, 115), legs=(-40, 15), feet=(-3, 0))),
        (400, pose(root=(3, 0, 5), head=8, nod=4, arms=(-55, 55), legs=(12, -12))),
        (600, pose(root=(3, -8, 5), head=-8, nod=-3, arms=(-115, 115), legs=(15, -40), feet=(0, -3))),
        (800, pose(root=(-3, 0, -5), head=8, nod=4, arms=(-55, 55), legs=(-12, 12))),
        (1000, pose(root=(-3, -8, -5), head=-8, nod=-3, arms=(-115, 115), legs=(-40, 15), feet=(-3, 0))),
        (1200, pose(root=(3, 0, 5), head=8, nod=4, arms=(-55, 55), legs=(12, -12))),
        (1400, pose(root=(3, -8, 5), head=-8, nod=-3, arms=(-115, 115), legs=(15, -40), feet=(0, -3))),
    ])
    add('breakdance', 'Breakdance', 'shop', 2400, [
        *[(i * 120, spin(i * 45, head=(-1)**i * 8,
                         arms=(-110 if i % 2 else -65, 65 if i % 2 else 110),
                         legs=(-70 if i % 2 else -55, 55 if i % 2 else 70)), 'linear') for i in range(9)],
        (1200, spin(360, head=5, arms=(-65, 65), legs=(-55, 55))),
        *[(1200 + i * 120, spin(360 - i * 45, head=(-1)**i * 8,
                                arms=(-65 if i % 2 else -110, 110 if i % 2 else 65),
                                legs=(-55 if i % 2 else -70, 70 if i % 2 else 55)), 'linear') for i in range(1, 9)],
    ])
    add('disco', 'Disco', 'shop', 2400, [
        (0, pose(root=(-7, 0, -8), head=8, arms=(-145, -35), legs=(-18, 18), reach=1.25)),
        (250, pose(root=(-9, -5, -10), head=-8, nod=-2, arms=(-153, -40), legs=(-25, 20), reach=1.25)),
        (500, pose(root=(6, 0, 8), head=10, nod=3, arms=(35, -40), legs=(18, -18), reach=1.25)),
        (750, pose(root=(8, -4, 10), head=6, arms=(45, -35), legs=(20, -25), reach=1.25)),
        (1000, pose(root=(-7, 0, -8), head=-8, arms=(-145, -35), legs=(-18, 18), reach=1.25)),
        (1200, pose(root=(7, 0, 8), head=-8, arms=(35, 145), legs=(18, -18), reach=1.25)),
        (1450, pose(root=(9, -5, 10), head=8, nod=-2, arms=(40, 153), legs=(20, -25), reach=1.25)),
        (1700, pose(root=(-6, 0, -8), head=-10, nod=3, arms=(40, -35), legs=(-18, 18), reach=1.25)),
        (1950, pose(root=(-8, -4, -10), head=-6, arms=(35, -45), legs=(-25, 20), reach=1.25)),
        (2200, pose(root=(7, 0, 8), head=8, arms=(35, 145), legs=(18, -18), reach=1.25)),
    ])
    add('worm', 'Worm', 'shop', 2400, [
        (0, pose(root=(-42, -34, 82), head=-12, nod=-2, arms=(-65, 70), legs=(25, -25), extra=-8)),
        (300, pose(root=(-42, -42, 72), head=15, nod=4, arms=(-120, 100), legs=(-12, 12), extra=12)),
        (600, pose(root=(-42, -30, 92), head=-18, nod=-3, arms=(-80, 55), legs=(-50, 40), extra=-15)),
        (900, pose(root=(-42, -40, 103), head=10, nod=3, arms=(-45, 100), legs=(35, -35), extra=10)),
        (1200, pose(root=(-42, -34, 82), head=-12, nod=-2, arms=(-65, 70), legs=(25, -25), extra=-8)),
        (1500, pose(root=(-42, -42, 72), head=15, nod=4, arms=(-120, 100), legs=(-12, 12), extra=12)),
        (1800, pose(root=(-42, -30, 92), head=-18, nod=-3, arms=(-80, 55), legs=(-50, 40), extra=-15)),
        (2100, pose(root=(-42, -40, 103), head=10, nod=3, arms=(-45, 100), legs=(35, -35), extra=10)),
    ])

    # Signature motions leave the head visible for the face effect owned by the engine.
    add('rainbow-barf', 'Rainbow Barf', 'signature', 2000, [
        (0, pose()), (260, pose(root=(0, 0, -9), head=-12, arms=(50, -45), legs=(-14, 14))),
        (480, pose(root=(0, 1, 18), head=18, nod=4, arms=(-45, 35), legs=(-20, 18)), 'cubicOut'),
        (700, pose(root=(0, 0, 13), head=10, nod=2, arms=(-35, 30), legs=(-16, 14))),
        (900, pose(root=(0, 0, -6), head=-10, arms=(48, -42), legs=(-14, 14))),
        (1110, pose(root=(0, 1, 22), head=20, nod=5, arms=(-55, 40), legs=(-22, 20)), 'cubicOut'),
        (1350, pose(root=(0, 1, 15), head=13, nod=3, arms=(-35, 30), legs=(-16, 14))),
        (1700, pose(root=(0, -3, -3), head=-5, arms=(20, -15), legs=(8, -8))),
    ], False)
    add('bubble-pop', 'Bubble Pop', 'signature', 1600, [
        (0, pose()), (260, pose(head=-6, nod=-2, arms=(-55, 55), legs=(-12, 12), torso={'sx':1.06, 'sy':1.04})),
        (500, pose(root=(0, -9, -3), head=8, arms=(-80, 80), legs=(18, -18), torso={'sx':1.08, 'sy':1.06})),
        (750, pose(root=(0, -15, 3), head=-8, arms=(-100, 100), legs=(-25, 25), torso={'sx':1.08, 'sy':1.06})),
        (860, pose(root=(0, -5, -5), head=13, nod=4, arms=(-145, 145), legs=(32, -32)), 'cubicOut'),
        (1080, pose(root=(0, 1, 3), head=-8, nod=3, arms=(-35, 35), legs=(-18, 18))),
        (1270, pose(root=(0, -7, -2), head=5, arms=(-50, 50), legs=(12, -12))),
        (1460, pose(head=-3, arms=(-10, 10), legs=(-5, 5))),
    ], False)
    add('bling', 'Bling', 'signature', 2000, [
        (0, pose()), (240, pose(root=(0, 1, -5), head=8, arms=(-60, 60), legs=(-15, 15))),
        (470, pose(root=(0, -5, 0), head=-10, nod=-2, arms=(-140, 140), legs=(-24, 24), reach=1.2)),
        (650, pose(root=(-5, 0, -6), head=10, arms=(-145, 125), legs=(-20, 20), reach=1.2)),
        (950, pose(root=(5, 0, 6), head=-10, arms=(-125, 145), legs=(-20, 20), reach=1.2)),
        (1240, pose(root=(-5, 0, -6), head=10, arms=(-145, 125), legs=(-20, 20), reach=1.2)),
        (1550, pose(root=(0, -4, 0), head=-8, arms=(-140, 140), legs=(-24, 24), reach=1.2)),
        (1780, pose(head=5, arms=(-45, 45), legs=(-8, 8))),
    ], False)
    add('coin-flip', 'Coin Flip', 'signature', 2000, [
        (0, pose()), (230, pose(root=(0, 1, 5), head=8, nod=2, arms=(-55, 10), legs=(-12, 12))),
        (470, pose(root=(0, -5, -7), head=-18, nod=-4, arms=(-150, 25), legs=(12, -12)), 'cubicOut'),
        (720, pose(root=(0, 0, -5), head=-20, nod=-4, arms=(-80, 15), legs=(-8, 8))),
        (1000, pose(root=(0, 0, 0), head=-10, nod=-2, arms=(-75, 10), legs=(-8, 8))),
        (1250, pose(root=(0, 1, 8), head=12, nod=3, arms=(-58, 5), legs=(-14, 14))),
        (1360, pose(root=(0, -3, 3), head=5, arms=(-95, 15), legs=(10, -10)), 'cubicOut'),
        (1580, pose(head=-7, arms=(-90, 10), legs=(-8, 8))),
        (1810, pose(head=3, arms=(-25, 5), legs=(5, -5))),
    ], False)
    add('drool', 'Drool', 'signature', 2400, [
        (0, pose(root=(-5, 0, 8), head=10, nod=3, arms=(-55, -45), legs=(-15, 15))),
        (300, pose(root=(2, -3, 13), head=-6, nod=1, arms=(-75, -60), legs=(12, -12), extra=-8)),
        (600, pose(root=(6, 1, 5), head=14, nod=4, arms=(-45, -40), legs=(-20, 20))),
        (900, pose(root=(2, -4, 10), head=-8, arms=(-80, -65), legs=(12, -12), extra=8)),
        (1200, pose(root=(-5, 0, 8), head=10, nod=3, arms=(-55, -45), legs=(-15, 15))),
        (1500, pose(root=(-8, -3, 3), head=-8, arms=(-70, -55), legs=(20, -20))),
        (1800, pose(root=(3, 1, 12), head=16, nod=4, arms=(-50, -40), legs=(-18, 18))),
        (2100, pose(root=(6, -4, 6), head=-6, arms=(-80, -65), legs=(12, -12))),
    ])
    add('honk-honk', 'Honk Honk', 'signature', 1600, [
        (0, pose(root=(-7, 0, -10), head=12, arms=(-80, 30), legs=(-20, 20))),
        (200, pose(root=(-7, -18, -8), head=-10, arms=(-135, 95), legs=(-35, 30), extra=14)),
        (400, pose(root=(0, 1, 0), head=12, nod=4, arms=(-40, 40), legs=(-18, 18))),
        (600, pose(root=(7, -18, 8), head=10, arms=(-95, 135), legs=(30, -35), extra=-14)),
        (800, pose(root=(7, 0, 10), head=-12, arms=(-30, 80), legs=(20, -20))),
        (1000, pose(root=(7, -18, 8), head=10, arms=(-95, 135), legs=(30, -35), extra=-14)),
        (1200, pose(root=(0, 1, 0), head=-12, nod=4, arms=(-40, 40), legs=(-18, 18))),
        (1400, pose(root=(-7, -18, -8), head=-10, arms=(-135, 95), legs=(-35, 30), extra=14)),
    ])
    add('flirt', 'Flirt', 'signature', 2000, [
        (0, pose()), (250, pose(root=(-6, 0, -8), head=10, arms=(-55, 45), legs=(-10, 10))),
        (430, pose(root=(6, -2, 8), head=-10, arms=(-35, 65), legs=(10, -10))),
        (610, pose(root=(-6, 0, -8), head=10, arms=(-65, 35), legs=(-10, 10))),
        (790, pose(root=(6, -2, 8), head=-10, arms=(-35, 65), legs=(10, -10))),
        (1030, pose(root=(-3, 0, 6), head=18, nod=3, arms=(158, 25), legs=(-12, 12))),
        (1280, pose(root=(0, -5, -10), head=-24, nod=-3, arms=(-155, 40), legs=(15, -15)), 'cubicOut'),
        (1550, pose(root=(3, 0, -5), head=-10, arms=(-70, 45), legs=(-8, 8))),
        (1800, pose(head=7, arms=(-25, 10), legs=(5, -5))),
    ], False)
    add('sob', 'Sob', 'signature', 2400, [
        (0, pose(root=(-2, 0, 4), head=12, nod=4, arms=(163, -163), legs=(-12, 12))),
        (240, pose(root=(2, -3, 7), head=5, nod=2, arms=(155, -172), legs=(-18, 18))),
        (480, pose(root=(-2, 0, 4), head=16, nod=5, arms=(172, -155), legs=(-12, 12))),
        (720, pose(root=(2, -3, 7), head=5, nod=2, arms=(155, -172), legs=(-18, 18))),
        (960, pose(root=(-2, 0, 4), head=16, nod=5, arms=(172, -155), legs=(-12, 12))),
        (1200, pose(root=(0, -5, -6), head=-14, nod=-2, arms=(160, -160), legs=(-22, 22))),
        (1560, pose(root=(2, 0, 6), head=16, nod=5, arms=(172, -155), legs=(-12, 12))),
        (1800, pose(root=(-2, -3, 4), head=5, nod=2, arms=(155, -172), legs=(-18, 18))),
        (2040, pose(root=(2, 0, 6), head=16, nod=5, arms=(172, -155), legs=(-12, 12))),
    ])
    add('grr', 'Grr', 'signature', 1600, [
        (0, pose(root=(-5, 0, -5), head=10, arms=(-115, 115), legs=(-18, 18))),
        (250, pose(root=(-5, -6, -8), head=-8, arms=(-145, 100), legs=(-50, 10), feet=(-4, 0))),
        (400, pose(root=(-5, 1, 5), head=15, nod=4, arms=(-65, 80), legs=(-20, 20)), 'quadIn'),
        (600, pose(root=(0, -3, 0), head=-8, arms=(-125, 125), legs=(-18, 18))),
        (800, pose(root=(5, 0, 5), head=-10, arms=(-115, 115), legs=(18, -18))),
        (1050, pose(root=(5, -6, 8), head=8, arms=(-100, 145), legs=(10, -50), feet=(0, -4))),
        (1200, pose(root=(5, 1, -5), head=-15, nod=4, arms=(-80, 65), legs=(-20, 20)), 'quadIn'),
        (1400, pose(root=(0, -3, 0), head=8, arms=(-125, 125), legs=(-18, 18))),
    ])
    add('heart-eyes', 'Heart Eyes', 'signature', 3200, [
        (0, pose(root=(-6, -7, -7), head=10, arms=(-60, 60), legs=(20, -20), extra=8)),
        (400, pose(root=(-10, -14, -10), head=14, nod=-2, arms=(-80, 70), legs=(30, -12), extra=12)),
        (800, pose(root=(0, -23, 0), head=-4, arms=(-100, 100), legs=(30, -30))),
        (1200, pose(root=(10, -14, 10), head=-14, nod=-2, arms=(-70, 80), legs=(12, -30), extra=-12)),
        (1600, pose(root=(6, -7, 7), head=-10, arms=(-60, 60), legs=(20, -20), extra=-8)),
        (2000, pose(root=(10, -14, 10), head=-14, nod=-2, arms=(-70, 80), legs=(12, -30), extra=-12)),
        (2400, pose(root=(0, -23, 0), head=4, arms=(-100, 100), legs=(30, -30))),
        (2800, pose(root=(-10, -14, -10), head=14, nod=-2, arms=(-80, 70), legs=(30, -12), extra=12)),
    ])
    add('laser-blink', 'Laser Blink', 'signature', 1600, [
        (0, pose()), (230, pose(root=(0, 1, 5), head=10, nod=4, arms=(50, -50), legs=(-20, 20))),
        (420, pose(root=(0, -7, -5), head=-12, nod=-3, arms=(-115, 115), legs=(-30, 30)), 'cubicOut'),
        (620, pose(root=(0, 0, 0), head=0, arms=(-95, 95), legs=(-25, 25))),
        (850, pose(root=(-2, -2, -2), head=5, arms=(-100, 100), legs=(-27, 27))),
        (1050, pose(root=(2, 0, 2), head=-5, arms=(-95, 95), legs=(-25, 25))),
        (1270, pose(root=(0, -3, 0), head=-5, arms=(-65, 65), legs=(-15, 15))),
        (1460, pose(head=3, arms=(-15, 15), legs=(-5, 5))),
    ], False)
    add('faint', 'Faint', 'signature', 2400, [
        (0, pose()), (240, pose(root=(-4, 0, -12), head=16, arms=(-45, 30), legs=(-16, 16))),
        (450, pose(root=(4, 0, 16), head=-20, arms=(-25, 55), legs=(16, -16))),
        (640, pose(root=(-4, -2, -22), head=24, arms=(-65, 40), legs=(-18, 18))),
        (950, pose(root=(-45, -30, 88), head=8, arms=(-80, 75), legs=(-20, 30)), 'quadIn'),
        (1080, pose(root=(-45, -36, 82), head=-8, arms=(-95, 90), legs=(-30, 40))),
        (1260, pose(root=(-45, -30, 88), head=8, arms=(-80, 75), legs=(-20, 30))),
        (1490, pose(root=(-45, -30, 88), head=8, arms=(-80, 75), legs=(-20, 30))),
        (1740, pose(root=(-24, -22, 45), head=-15, arms=(-135, 110), legs=(-45, 45))),
        (2050, pose(root=(0, -12, -7), head=-10, arms=(-100, 100), legs=(20, -20))),
        (2260, pose(root=(0, 1, 3), head=6, nod=3, arms=(-25, 25), legs=(-14, 14))),
    ], False)
    add('waterworks', 'Waterworks', 'signature', 2400, [
        (0, pose(root=(-4, 0, -5), head=-18, arms=(-75, 75), legs=(-18, 18))),
        (300, pose(root=(-4, -7, -8), head=-24, nod=-3, arms=(-135, 125), legs=(-45, 12), feet=(-4, 0))),
        (500, pose(root=(-4, 1, 5), head=12, nod=4, arms=(-45, 55), legs=(-22, 22)), 'quadIn'),
        (800, pose(root=(4, -7, 8), head=-24, nod=-3, arms=(-125, 135), legs=(12, -45), feet=(0, -4))),
        (1000, pose(root=(4, 1, -5), head=-12, nod=4, arms=(-55, 45), legs=(-22, 22)), 'quadIn'),
        (1200, pose(root=(0, -4, 0), head=-22, arms=(-100, 100), legs=(-18, 18))),
        (1500, pose(root=(-4, -7, -8), head=-24, nod=-3, arms=(-135, 125), legs=(-45, 12), feet=(-4, 0))),
        (1700, pose(root=(-4, 1, 5), head=12, nod=4, arms=(-45, 55), legs=(-22, 22)), 'quadIn'),
        (2000, pose(root=(4, -7, 8), head=-24, nod=-3, arms=(-125, 135), legs=(12, -45), feet=(0, -4))),
        (2200, pose(root=(4, 1, -5), head=-12, nod=4, arms=(-55, 45), legs=(-22, 22)), 'quadIn'),
    ])
    add('scan', 'Scan', 'signature', 2400, [
        (0, pose(root=(-3, 0, -3), head=-18, arms=(-45, 90), legs=(-12, 12))),
        (350, pose(root=(-3, 0, -3), head=-18, arms=(-45, 90), legs=(-12, 12)), 'linear'),
        (500, pose(root=(0, -2, 0), head=0, nod=-2, arms=(-90, 90), legs=(8, -8)), 'linear'),
        (950, pose(root=(0, -2, 0), head=0, nod=-2, arms=(-90, 90), legs=(8, -8)), 'linear'),
        (1100, pose(root=(3, 0, 3), head=18, arms=(-90, 45), legs=(12, -12)), 'linear'),
        (1450, pose(root=(3, 0, 3), head=18, arms=(-90, 45), legs=(12, -12)), 'linear'),
        (1600, pose(root=(0, -2, 0), head=0, nod=3, arms=(-65, 65), legs=(-8, 8)), 'linear'),
        (2050, pose(root=(0, -2, 0), head=0, nod=3, arms=(-65, 65), legs=(-8, 8)), 'linear'),
        (2250, pose(root=(-3, 0, -3), head=-18, arms=(-45, 90), legs=(-12, 12)), 'linear'),
    ])
    add('deal-with-it', 'Deal With It', 'signature', 2000, [
        (0, pose()), (320, pose(root=(0, 0, 5), head=8, arms=(155, 25), legs=(-12, 12))),
        (660, pose(root=(3, -3, -18), head=-10, nod=-2, arms=(-75, 55), legs=(24, -16))),
        (950, pose(root=(3, 0, -14), head=5, arms=(48, -45), legs=(20, -12))),
        (1300, pose(root=(3, 0, -14), head=5, arms=(48, -45), legs=(20, -12))),
        (1550, pose(root=(3, -2, -12), head=-6, arms=(45, -40), legs=(18, -12))),
        (1780, pose(root=(0, 0, 3), head=4, arms=(20, -20), legs=(-8, 8))),
    ], False)
    add('giggle', 'Giggle', 'signature', 1600, [
        (0, pose(root=(-3, 0, -4), head=10, nod=2, arms=(150, -40), legs=(-10, 10))),
        (200, pose(root=(-3, -8, -7), head=-7, arms=(160, -55), legs=(-22, 18))),
        (400, pose(root=(3, 0, 4), head=12, nod=4, arms=(148, -35), legs=(10, -10))),
        (600, pose(root=(3, -8, 7), head=-7, arms=(160, -55), legs=(18, -22))),
        (800, pose(root=(-3, 0, -4), head=10, nod=2, arms=(150, -40), legs=(-10, 10))),
        (1000, pose(root=(-3, -8, -7), head=-7, arms=(160, -55), legs=(-22, 18))),
        (1200, pose(root=(3, 0, 4), head=12, nod=4, arms=(148, -35), legs=(10, -10))),
        (1400, pose(root=(3, -8, 7), head=-7, arms=(160, -55), legs=(18, -22))),
    ])
    add('steam', 'Steam', 'signature', 1600, [
        (0, pose(root=(-2, 0, -5), head=10, arms=(-125, 125), legs=(-18, 18))),
        (180, pose(root=(2, 1, 5), head=-10, nod=3, arms=(-145, 110), legs=(-22, 22))),
        (360, pose(root=(-2, -16, -5), head=12, arms=(-110, 150), legs=(-38, 38), extra=12)),
        (540, pose(root=(2, 1, 5), head=-12, nod=4, arms=(-150, 110), legs=(-22, 22)), 'quadIn'),
        (720, pose(root=(-2, -6, -5), head=10, arms=(-115, 145), legs=(-26, 26))),
        (900, pose(root=(2, 1, 5), head=-10, nod=3, arms=(-145, 110), legs=(-22, 22))),
        (1080, pose(root=(-2, -16, -5), head=12, arms=(-110, 150), legs=(-38, 38), extra=-12)),
        (1260, pose(root=(2, 1, 5), head=-12, nod=4, arms=(-150, 110), legs=(-22, 22)), 'quadIn'),
        (1440, pose(root=(-2, -6, -5), head=10, arms=(-115, 145), legs=(-26, 26))),
    ])
    add('side-eye', 'Side Eye', 'signature', 2400, [
        (0, pose()), (350, pose(root=(-2, 0, -3), head=5, arms=(20, -15), legs=(-8, 8))),
        (850, pose(root=(-8, 0, -12), head=18, nod=2, arms=(45, -35), legs=(-18, 12))),
        (1250, pose(root=(-10, -2, -14), head=22, nod=3, arms=(50, -40), legs=(-20, 14))),
        (1700, pose(root=(-10, -2, -14), head=22, nod=3, arms=(50, -40), legs=(-20, 14))),
        (2050, pose(root=(-4, 0, -5), head=10, arms=(25, -20), legs=(-10, 8))),
        (2250, pose(root=(0, -2, 2), head=-4, arms=(-5, 5), legs=(5, -5))),
    ], False)
    return pack


def validate(pack, rig, kits):
    dances, clips = pack['dances'], pack['clips']
    signatures = set(kits['slots']['emote'])
    assert len(dances) == len(clips) == 34
    assert {k for k, d in dances.items() if d['group'] == 'universal'} == set(UNIVERSAL)
    assert {k for k, d in dances.items() if d['group'] == 'shop'} == set(SHOP)
    assert {k for k, d in dances.items() if d['group'] == 'signature'} == signatures
    for key, dance in dances.items():
        assert dance['clip'] == 'dance-' + key and dance['name']
        if dance['group'] == 'universal': assert dance['emote'] == key
        if dance['group'] == 'signature': assert dance['sig'] == key
        clip = clips[dance['clip']]
        # Stretched arms compose without shear because their weapon never rotates locally.
        assert all(k[1].get('r', 0) == 0 for k in clip['tracks']['weapon'])
        assert isinstance(clip['loop'], bool) and clip['loop'] == dance['loop']
        assert (1600 if clip['loop'] else 1200) <= clip['ms'] <= (3200 if clip['loop'] else 2400)
        assert REQUIRED <= clip['tracks'].keys()
        for part, track in clip['tracks'].items():
            assert part == 'root' or part in rig['skeleton'], (key, part)
            assert track[0][0] == 0 and track[-1][0] == clip['ms'], (key, part)
            assert all(a[0] < b[0] for a, b in zip(track, track[1:])), (key, part)
            for time, p, easing in track:
                assert math.isfinite(time) and easing in EASES and set(p) <= REST.keys()
                assert all(isinstance(v, (float, int)) and math.isfinite(v) for v in p.values())
                assert 0 <= p.get('a', 1) <= 1 and p.get('sx', 1) > 0 and p.get('sy', 1) > 0
                if part == 'root': assert p.get('sx', 1) == p.get('sy', 1)
            if clip['loop']:
                assert {**REST, **track[0][1]} == {**REST, **track[-1][1]}, (key, part, 'seam')
            else:
                assert {**REST, **track[0][1]} == REST == {**REST, **track[-1][1]}, (key, part, 'recovery')
            if part in REQUIRED:
                assert any({**REST, **p} != {**REST, **track[0][1]} for _, p, _ in track), (key, part, 'static')
    return len(dances)


def main():
    pack = choreography()
    count = validate(pack, json.loads((OUT / 'atlas/rig.json').read_text()),
                     json.loads((OUT / 'kits.json').read_text()))
    target = OUT / 'atlas/dances.json'
    # Keep readers on either complete version, including when another art build runs.
    with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, prefix='.dances-', suffix='.tmp', delete=False) as f:
        temporary = Path(f.name)
        try:
            json.dump(pack, f, separators=(',', ':'), allow_nan=False)
            f.write('\n'); f.flush(); os.fsync(f.fileno())
            os.chmod(temporary, 0o644)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
    print(f'{count} dances validated and atomically published to {target}')


if __name__ == '__main__':
    main()
