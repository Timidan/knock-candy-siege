#!/usr/bin/env python3
"""Compose registered Chog trait layers. Pillow only; no game/server required."""
import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
DATA = HERE.parents[2] / 'knock/app/public/siege'
SIZE = (256, 320)


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-') or 'none'


def tint(image, color):
    return ImageChops.multiply(image, Image.new('RGBA', image.size, color))


class Compositor:
    def __init__(self, atlas_dir=DATA / 'atlas'):
        self.atlas_dir = Path(atlas_dir)
        self.template = json.loads((self.atlas_dir / 'chog-template.json').read_text())
        self.traits = json.loads((DATA / 'traits.json').read_text())
        self.skins = json.loads((DATA / 'skins.json').read_text())
        self.frames, self.images, self.missing = {}, {}, []
        for path in sorted(self.atlas_dir.glob('chog-*.json')):
            if path.name == 'chog-template.json':
                continue
            data = json.loads(path.read_text())
            if not isinstance(data.get('frames'), dict):
                raise ValueError(f'{path.name}: expected Phaser JSON Hash frames')
            for name, frame in data['frames'].items():
                if name in self.frames:
                    raise ValueError(f'duplicate frame {name!r} in {path.name}')
                self.frames[name] = (path, data.get('meta', {}), frame)
        for name in ('base/back', 'base/face', 'base/blush', 'base/nose',
                     'eyes/placeholder', 'mouth/placeholder'):
            if name not in self.frames:
                raise ValueError(f'missing base frame {name}; run build_chogs.py')

    def values(self, chog_id):
        row = self.traits['chogs'].get(str(chog_id))
        if row is None:
            raise ValueError(f'unknown Chog id {chog_id}')
        if len(row) != len(self.traits['keys']):
            raise ValueError(f'Chog {chog_id}: trait count does not match keys')
        result = {}
        for key, index in zip(self.traits['keys'], row):
            values = self.traits['values'][key]
            if not isinstance(index, int) or not 0 <= index < len(values):
                raise ValueError(f'Chog {chog_id}: invalid {key} index {index}')
            result[key] = values[index] if index else ''
        return result

    def layer(self, name, color, left=False):
        path, meta, frame = self.frames[name]
        image_path = path.parent / meta.get('image', path.with_suffix('.png').name)
        if image_path not in self.images:
            with Image.open(image_path) as source:
                if max(source.size) > 2048:
                    raise ValueError(f'{image_path.name}: exceeds 2048px atlas limit')
                self.images[image_path] = source.convert('RGBA')
        atlas = self.images[image_path]
        rect, offset = frame['frame'], frame['spriteSourceSize']
        x, y, w, h = (rect[k] for k in ('x', 'y', 'w', 'h'))
        sx, sy, sw, sh = (offset[k] for k in ('x', 'y', 'w', 'h'))
        if (frame.get('rotated', False) or frame['sourceSize'] != {'w': 256, 'h': 320}
                or (w, h) != (sw, sh) or min(x, y, sx, sy) < 0
                or min(w, h) <= 0 or x + w > atlas.width or y + h > atlas.height
                or sx + w > 256 or sy + h > 320):
            raise ValueError(f'{path.name}:{name}: invalid/unregistered frame geometry')
        tile = atlas.crop((x, y, x + w, y + h))
        if name == 'base/back' or frame.get('tint') == 'skin':
            tile = tint(tile, color)
        layer = Image.new('RGBA', SIZE)
        layer.alpha_composite(tile, (sx, sy))
        if frame.get('clip') == 'faceMask':
            mask = Image.new('L', (SIZE[0] * 4, SIZE[1] * 4))
            points = self.template['anchors']['faceMask']
            ImageDraw.Draw(mask).polygon([(x * 4, y * 4) for x, y in points], fill=255)
            mask = mask.resize(SIZE, Image.Resampling.LANCZOS)
            layer.putalpha(ImageChops.multiply(layer.getchannel('A'), mask))
        if name.endswith('/decal'):
            decal = frame.get('decal')
            if not decal or 'anchor' not in decal or 'size' not in decal:
                raise ValueError(f'{name}: decal requires anchor and size metadata')
            cx, cy = decal['anchor']['x'], decal['anchor']['y']
            dw, dh = decal['size']['w'], decal['size']['h']
            if (min(dw, dh) <= 0 or sx < cx - dw / 2 or sy < cy - dh / 2
                    or sx + w > cx + dw / 2 or sy + h > cy + dh / 2):
                raise ValueError(f'{name}: decal pixels exceed declared anchor/size box')
            if left:
                # Move the registration centre; keep glyph pixels in reading order.
                moved = Image.new('RGBA', SIZE)
                moved.alpha_composite(layer, (round(SIZE[0] - 2 * cx), 0))
                return moved
        elif left:
            return ImageOps.mirror(layer)
        return layer

    def meta_rule(self, atlas_frame, key):
        """A rule from the meta of the atlas holding `atlas_frame` (the swarm documents its rules there)."""
        return self.frames[atlas_frame][1].get(key, {}) if atlas_frame in self.frames else {}

    def head(self, values, color, left=False, window=False, face=None, legend=None):
        self.missing = []
        names = {key: slug(values.get(key, '')) for key in ('Aura', 'Eyes', 'Mouth', 'Head', 'Accessory')}
        if legend:
            # One-of-ones have hand-made heads that replace the whole stack.
            stack = [f'legend/{legend}/back', f'legend/{legend}/front']
            result = Image.new('RGBA', SIZE)
            for name in stack:
                if name in self.frames:
                    result.alpha_composite(self.layer(name, color, left))
            return self.window(result, left) if window else result
        skull = values.get('Form') == 'Skull' or values.get('Base') == 'Skull'
        skin = values.get('Skin', '')
        aura = f"aura/{names['Aura']}"
        if aura not in self.frames:
            aura += '/0'
        eye, mouth, head = f"eyes/{names['Eyes']}", f"mouth/{names['Mouth']}", f"head/{names['Head']}"
        stack = [aura]
        if values.get('Base') == 'Radioactive':
            stack.append('form/radioactive/glow/0')
        stack += [head + '/back', 'base/back']
        if skin == 'Multi Colored':
            stack.append('skin/multi/stripes')
        stack.append('form/skull/face' if skull else 'base/face')
        stack += {'Metal': ['skin/metal/shine'], 'Jade': ['skin/jade/shine']}.get(skin, [])
        stack.append('base/blush')
        if not skull:
            stack.append('base/nose')
        stack.append(eye if eye in self.frames else 'eyes/placeholder')
        if eye not in self.frames:
            self.missing.append(eye + ' (placeholder)')
        stack += self.meta_rule('eyes/placeholder' if eye not in self.frames else eye, 'eyeDecals').get(values.get('Eyes', ''), [])
        if mouth in self.frames:
            stack.append(mouth)
            decal = self.meta_rule(mouth, 'decals').get(mouth)
            if decal:
                stack.append(decal)
        elif not skull:
            stack.append('mouth/placeholder')
        stack += [f"acc/{names['Accessory']}/face", head + '/front', head + '/decal']
        result = Image.new('RGBA', SIZE)
        face_alpha = fur_alpha = None
        for name in stack:
            if name not in self.frames:
                continue
            layer = self.layer(name, color, left)
            if name == 'base/face' and face and face.lower() != '#f4eedd':
                layer = tint(layer, face)  # Black fur changes the face colour too.
            if name == 'base/back':
                fur_alpha = layer.getchannel('A')
            if name == 'skin/multi/stripes':
                layer.putalpha(ImageChops.multiply(layer.getchannel('A'), fur_alpha))  # bands live on the fur
            if name in ('base/face', 'form/skull/face'):
                face_alpha = layer.getchannel('A')
            if name.startswith('skin/') and name.endswith('/shine') and face_alpha is not None:
                layer.putalpha(ImageChops.multiply(layer.getchannel('A'), face_alpha))
            result.alpha_composite(layer)
        for key, candidates in (('Aura', [aura]), ('Head', [head + x for x in ('/front', '/back', '/decal')]),
                                ('Accessory', [f"acc/{names['Accessory']}/face", f"acc/{names['Accessory']}/hand"])):
            if values.get(key) and not any(name in self.frames for name in candidates):
                self.missing.append(f'{key}: {values[key]} (no layer)')
        return self.window(result, left) if window else result

    def window(self, result, left):
        circle = self.template['anchors']['faceWindow']
        cx, cy, r = circle['centre']['x'], circle['centre']['y'], circle['r']
        if left:
            cx = SIZE[0] - cx
        result = result.crop((cx - r, cy - r, cx + r, cy + r))
        mask = Image.new('L', (r * 8, r * 8))
        ImageDraw.Draw(mask).ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
        result.putalpha(ImageChops.multiply(result.getchannel('A'), mask.resize(result.size, Image.Resampling.LANCZOS)))
        return result

    def compose(self, chog_id, left=False, window=False):
        values = self.values(chog_id)
        skin = self.skins[values['Skin']]
        legend = str(chog_id) if values.get('Base') == '1:1' else None
        return self.head(values, skin['tint'], left, window, skin.get('face'), legend)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('chog_id', type=int)
    parser.add_argument('--left', action='store_true', help='mirror the head but preserve decal lettering')
    parser.add_argument('--window', action='store_true', help='transparent circular faceWindow crop')
    parser.add_argument('-o', '--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        compositor = Compositor()
        result = compositor.compose(args.chog_id, args.left, args.window)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        result.save(args.output, format='PNG')
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'compose: {error}\n')
    print(f'Wrote {args.output} ({result.width}x{result.height})')
    if compositor.missing:
        print('Pending trait art: ' + '; '.join(compositor.missing), file=sys.stderr)


if __name__ == '__main__':
    main()
