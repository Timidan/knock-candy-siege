import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { AssetPack } from '../assets'
import type { Kit, Skin } from '../data/kits'
import { pose, trackPose } from './pose'
import { reducedMotion } from '../data/save'
import { ChogHeads } from '../chogHead'

let previewHeads: ChogHeads | undefined
export async function loadPreviewHeads() {
  const heads = previewHeads ??= new ChogHeads(new Phaser.Scene())
  try { await heads.ready; return heads }
  catch (error) { previewHeads = undefined; throw error }
}

// The picker, shop and exported PNG share the pose player and costume/weapon split.
export function heroPainter(assets: AssetPack, kit: Kit, heads: ChogHeads, costume = kit.costume) {
  const outfit = assets.atlases.find(a => a.key === `hero-${costume}`)!, weapon = assets.atlases.find(a => a.key === `hero-${kit.costume}`)!
  // Art job 3E ships every costume again at twice the pixel size (same frame names, rig parts only): showcase renders use it instead of upscaling the 1× parts.
  const outfit2 = assets.atlases.find(a => a.key === `hero-${costume}@2x`), weapon2 = assets.atlases.find(a => a.key === `hero-${kit.costume}@2x`)
  const sig = assets.atlases.find(a => a.key === 'sig')!, head = heads.canvas(kit.id)
  const headScale = .44 * assets.rig.R / 30
  const config = assets.rig.costumes[costume], skin = assets.skins[kit.skinValue] as Skin & { face?: string }, tinted = new Map<string, HTMLCanvasElement>()
  const order = [...assets.rig.order]; order.splice(order.indexOf('arm-front') + (assets.rig.costumes[kit.costume].weaponBehind ? 0 : 1), 0, 'weapon')
  const paint = (ctx: CanvasRenderingContext2D, clip = 'idle', time = 0) => {
    const poses = pose(assets.rig, costume, clip, time), signature = assets.dances[clip.replace(/^dance-/, '')]?.sig
    for (const name of order) {
      const part = poses[name]; ctx.save(); ctx.translate(part.x, part.y); ctx.rotate(part.r * Math.PI / 180); ctx.scale(part.sx, part.sy); ctx.globalAlpha *= Math.max(0, Math.min(1, part.a))
      if (name === 'head') {
        const r = assets.rig.R, def = signature ? assets.signatures[signature] : undefined
        ctx.save()
        const move = trackPose(def?.layers.find(l => l.portrait)?.portrait, time)
        ctx.translate(move.x * r / 48, move.y * r / 48); ctx.rotate(move.r * Math.PI / 180); ctx.scale(move.sx, move.sy)
        ctx.drawImage(head, -heads.pivot.x * headScale, -heads.pivot.y * headScale, 256 * headScale, 320 * headScale)
        for (const layer of def?.layers ?? []) {
          if (!layer.frames || time < (layer.at ?? 0)) continue
          const anchors = heads.anchors as Record<string, [number, number]>
          const near = anchors.eyeNear, far = anchors.eyeFar
          const point = layer.anchor === 'centre' ? [heads.pivot.x, heads.pivot.y] : layer.anchor === 'eyes' && near && far ? [(near[0] + far[0]) / 2, (near[1] + far[1]) / 2] : anchors[layer.anchor === 'eye0' ? 'eyeNear' : layer.anchor === 'eye1' ? 'eyeFar' : layer.anchor === 'top' ? 'headTop' : layer.anchor ?? 'nose']
          if (!point) continue
          const n = Math.floor((time - (layer.at ?? 0)) * layer.fps! / 1000), f = sig.data.frames[`${layer.frames}/${layer.loop ? n % layer.count! : Math.min(n, layer.count! - 1)}`]?.frame
          if (!f) continue
          const [ox, oy] = layer.origin ?? [.5, .5]
          ctx.save(); ctx.translate((point[0] - heads.pivot.x) * headScale, (point[1] - heads.pivot.y) * headScale); ctx.rotate(layer.rotate === 'eyes' && near && far ? Math.atan2(far[1] - near[1], far[0] - near[0]) : 0); ctx.scale(r / 48, r / 48)
          ctx.drawImage(sig.image, f.x, f.y, f.w, f.h, -f.w * ox, -f.h * oy, f.w, f.h); ctx.restore()
        }
        ctx.restore()
      } else {
        const atlas = name === 'weapon' ? weapon : outfit, atlas2 = name === 'weapon' ? weapon2 : outfit2
        for (const key of [`rig/${name}-skin`, `rig/${name}`]) {
          const f = atlas.data.frames[key]?.frame
          if (!f) continue
          const [ox, oy] = (name === 'weapon' ? assets.rig.costumes[kit.costume] : config).pivots[name] ?? [.5, .5]
          // The part is placed by its 1× size; the pixels come from the 2× frame when there is one.
          const sharp = atlas2?.data.frames[key]?.frame, source = sharp ? atlas2! : atlas, g = sharp ?? f
          if (key.endsWith('-skin') || costume === 'tickle' && atlas === outfit) {
            const color = costume === 'tickle' ? skin.cycle ? skin.cycle[Math.floor(time / 500) % skin.cycle.length] : skin.tint : skin.face ?? skin.tint
            let patch = tinted.get(key + color + (sharp ? '@2x' : ''))
            if (!patch) {
              patch = document.createElement('canvas'); patch.width = g.w; patch.height = g.h
              const pc = patch.getContext('2d')!; pc.drawImage(source.image, g.x, g.y, g.w, g.h, 0, 0, g.w, g.h)
              pc.globalCompositeOperation = 'multiply'; pc.fillStyle = color; pc.fillRect(0, 0, g.w, g.h)
              pc.globalCompositeOperation = 'destination-in'; pc.drawImage(source.image, g.x, g.y, g.w, g.h, 0, 0, g.w, g.h); tinted.set(key + color + (sharp ? '@2x' : ''), patch)
            }
            ctx.drawImage(patch, -f.w * ox, -f.h * oy, f.w, f.h)
          } else ctx.drawImage(source.image, g.x, g.y, g.w, g.h, -f.w * ox, -f.h * oy, f.w, f.h)
        }
      }
      ctx.restore()
    }
  }
  // How far the painted rig may be scaled: 2× with the 1× parts (batch 2d's cap), 4× when the double-size parts are available.
  return Object.assign(paint, { sharp: !!outfit2 && (!!weapon2 || !weapon) })
}

export function HeroPreview({ assets, kit, costume = kit.costume, dance = 'idle', lite = false, still = false }: { assets: AssetPack; kit: Kit; costume?: string; dance?: string; lite?: boolean; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null), [error, setError] = useState(false)
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext('2d')!, controller = new AbortController()
    let frame = 0, start = 0, last = 0
    setError(false)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    void loadPreviewHeads().then(heads => {
      if (controller.signal.aborted) return
      const paint = heroPainter(assets, kit, heads, costume), clip = assets.dances[dance]?.clip ?? 'idle'
      const draw = (time: number) => {
        if (controller.signal.aborted) return
        if (!start) start = time
        if (!last || time - last >= 40) {
          last = time
          ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.scale(lite ? .5 : 1, lite ? .5 : 1)
          ctx.fillStyle = '#24192f'; ctx.strokeStyle = kit.home ? '#ffd477' : '#b69acb'; ctx.lineWidth = 3
          ctx.beginPath(); ctx.roundRect(28, 28, 364, 424, [48, 12, 48, 12]); ctx.fill(); ctx.stroke()
          ctx.strokeStyle = '#73597f'; ctx.lineWidth = 1; ctx.strokeRect(42, 42, 336, 396)
          ctx.fillStyle = '#ffe0a3'; ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.fillText('✦', 74, 92); ctx.fillText('✦', 346, 402)
          ctx.fillStyle = '#76547988'; ctx.beginPath(); ctx.ellipse(210, 385, 115, 21, 0, 0, Math.PI * 2); ctx.fill()
          // The double-size parts lift the old 2× cap: legends are taller, so they get a little less.
          const zoom = paint.sharp ? kit.legend ? 2.35 : 2.5 : 2
          ctx.translate(210, 375); ctx.scale(zoom, zoom)
          paint(ctx, clip, still || reducedMotion() ? assets.rig.clips[clip].ms * .4 : (time - start) % assets.rig.clips[clip].ms); ctx.restore()
        }
        if (!still && !reducedMotion()) frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => { controller.abort(); cancelAnimationFrame(frame) }
  }, [assets, kit.id, kit.costume, kit.home, costume, dance, lite, still])
  return <><canvas ref={ref} className="siege-rig-preview" width={lite ? 210 : 420} height={lite ? 240 : 480} aria-label={`Chog #${kit.id} · ${assets.dances[dance]?.name ?? 'idle'} character preview`} />{error && <small role="status">Character unavailable. Reopen this preview to retry.</small>}</>
}
