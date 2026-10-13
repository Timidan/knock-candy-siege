// chogHead API stable
import type Phaser from 'phaser'
import type { TraitData } from './data/traits'

export type HeadRef = { key: string; frame: string }
type Rect = { x: number; y: number; w: number; h: number }
type Frame = { frame: Rect; spriteSourceSize: Rect; sourceSize: { w: number; h: number }; rotated?: boolean; tint?: string; clip?: string; decal?: { anchor: { x: number; y: number }; size: { w: number; h: number } } }
type Meta = { image: string; eyeDecals?: Record<string, string[]>; decals?: Record<string, string>; grip?: Record<string, [number, number]> }
type Layer = { frame: Frame; meta: Meta; image: HTMLImageElement }
type Template = { anchors: Record<string, unknown> & { faceWindow: { centre: { x: number; y: number }; r: number }; faceMask: [number, number][] } }
type Sources = { layers: Map<string, Layer>; template: Template; traits: TraitData; skins: Record<string, { tint: string; face?: string }>; legends: { legends: Record<string, unknown> } }
const slug = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'none'
const makeCanvas = (width = 256, height = 320) => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c }
const json = async <T,>(url: string): Promise<T> => { const r = await fetch(url); if (!r.ok) throw new Error(`Could not load ${url}`); return r.json() }
let sources: Promise<Sources> | undefined
function loadSources() {
  return sources ??= (async () => {
    const [template, traits, skins, legends, atlases] = await Promise.all([
      json<Template>('/siege/atlas/chog-template.json'), json<TraitData>('/siege/traits.json'),
      json<Sources['skins']>('/siege/skins.json'), json<Sources['legends']>('/siege/legends.json'),
      Promise.all(Object.keys(import.meta.glob('/public/siege/atlas/chog-*.json')).filter(p => !p.endsWith('chog-template.json')).sort().map(async path => {
        const data = await json<{ frames: Record<string, Frame>; meta: Meta }>(path.replace('/public', ''))
        const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Could not load ${data.meta.image}`)); img.src = `/siege/atlas/${data.meta.image}` })
        if (image.width > 2048 || image.height > 2048) throw new Error(`Oversized Chog atlas: ${data.meta.image}`)
        return { data, image }
      })),
    ])
    const layers = new Map<string, Layer>()
    for (const { data, image } of atlases) for (const [name, frame] of Object.entries(data.frames)) {
      if (layers.has(name)) throw new Error(`Duplicate Chog layer: ${name}`)
      const f = frame.frame, s = frame.spriteSourceSize
      if (frame.rotated || frame.sourceSize.w !== 256 || frame.sourceSize.h !== 320 || f.w !== s.w || f.h !== s.h || Math.min(f.x, f.y, s.x, s.y) < 0 || Math.min(f.w, f.h) <= 0 || f.x + f.w > image.width || f.y + f.h > image.height || s.x + s.w > 256 || s.y + s.h > 320) throw new Error(`Invalid Chog layer: ${name}`)
      layers.set(name, { frame, meta: data.meta, image })
    }
    for (const name of ['base/back', 'base/face', 'base/blush', 'base/nose', 'eyes/placeholder', 'mouth/placeholder']) if (!layers.has(name)) throw new Error(`Missing Chog layer: ${name}`)
    return { layers, template, traits, skins, legends }
  })().catch(error => { sources = undefined; throw error })
}

type Atlas = { texture: Phaser.Textures.CanvasTexture; slots: Map<string, number>; width: number; height: number; columns: number; capacity: number; dirty: boolean; refs: HeadRef[] }

export class ChogHeads {
  readonly ready: Promise<void>
  readonly pivot = { x: 128, y: 174 }
  readonly anchors: Record<string, unknown> = {}
  private scene: Phaser.Scene
  private data!: Sources
  private headAtlas?: Atlas
  private windowAtlas?: Atlas
  private mask!: HTMLCanvasElement
  private queue = new Map<string, { id: number; left: boolean }>()
  private alive = true
  private pending = 0
  private batchFrame = 0
  private uploadFrame = -4
  private uploadNext = false
  private scratch = Array.from({ length: 5 }, () => { const canvas = makeCanvas(); return { canvas, ctx: canvas.getContext('2d')! } })
  private valuesCache = new Map<number, Record<string, string>>()
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.ready = loadSources().then(data => {
      this.data = data
      Object.assign(this.anchors, data.template.anchors)
      Object.assign(this.pivot, data.template.anchors.faceWindow.centre)
      const mask = makeCanvas(1024, 1280), ctx = mask.getContext('2d')!
      ctx.scale(4, 4); ctx.beginPath()
      data.template.anchors.faceMask.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
      ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill()
      this.mask = makeCanvas(); this.mask.getContext('2d')!.drawImage(mask, 0, 0, 256, 320)
    })
    // Detached scenes can use canvas() in React without creating any GPU texture.
    scene?.events?.on('postupdate', this.flush, this)
    scene?.events?.once('shutdown', () => this.dispose())
    scene?.events?.once('destroy', () => this.dispose())
  }
  private dispose() {
    this.alive = false; cancelAnimationFrame(this.pending); this.queue.clear(); this.scene?.events.off('postupdate', this.flush, this)
    for (const atlas of [this.headAtlas, this.windowAtlas]) if (atlas && this.scene?.textures?.exists(atlas.texture.key)) this.scene.textures.remove(atlas.texture.key)
  }
  prepare(ids: number[]): void {
    for (const id of ids) for (const left of [false, true]) { const key = `${id}:${left}`; if (!this.windowAtlas?.slots.has(key)) this.queue.set(key, { id, left }) }
    void this.ready.then(() => { if (this.alive && !this.pending) this.pending = requestAnimationFrame(() => this.drain()) }).catch(() => { this.queue.clear() })
  }
  private drain() {
    this.pending = 0
    if (!this.alive) return
    // Four face crops share an upload, once per four browser frames. Enemies
    // never consume full-head slots needed by the hero, legends and UI rigs.
    if (this.batchFrame++ % 4 === 0) {
      const win = this.atlas(true)
      for (let i = 0; i < 4 && this.queue.size; i++) {
        const [key, { id, left }] = this.queue.entries().next().value!
        this.queue.delete(key)
        if (!win.slots.has(key)) this.store(win, key, this.crop(this.canvas(id, left), left))
      }
      this.flush()
    }
    if (this.queue.size) this.pending = requestAnimationFrame(() => this.drain())
  }
  head(id: number, left = false): HeadRef {
    const atlas = this.atlas(false), key = `${id}:${left}`
    return this.cached(atlas, key) ?? this.store(atlas, key, this.canvas(id, left))
  }
  window(id: number, left = false): HeadRef {
    const atlas = this.atlas(true), key = `${id}:${left}`
    return this.cached(atlas, key) ?? this.store(atlas, key, this.crop(this.canvas(id, left), left))
  }
  canvas(id: number, left = false): HTMLCanvasElement {
    const values = this.values(id), skin = this.data.skins[values.Skin], layers = this.data.layers
    if (!skin) throw new Error(`Unknown Chog skin: ${values.Skin}`)
    if (this.isLegend(id)) return this.stack([`legend/${id}/back`, `legend/${id}/front`], skin.tint, left)
    const skull = values.Form === 'Skull' || values.Base === 'Skull'
    let aura = `aura/${slug(values.Aura)}`
    if (!layers.has(aura)) aura += '/0'
    const eye = `eyes/${slug(values.Eyes)}`, mouth = `mouth/${slug(values.Mouth)}`, head = `head/${slug(values.Head)}`
    const selectedEye = layers.has(eye) ? eye : 'eyes/placeholder'
    const names = [aura, ...(values.Base === 'Radioactive' ? ['form/radioactive/glow/0'] : []), `${head}/back`, 'base/back', ...(values.Skin === 'Multi Colored' ? ['skin/multi/stripes'] : []), skull ? 'form/skull/face' : 'base/face', ...({ Metal: ['skin/metal/shine'], Jade: ['skin/jade/shine'] }[values.Skin] ?? []), 'base/blush', ...(!skull ? ['base/nose'] : []), selectedEye, ...(layers.get(selectedEye)?.meta.eyeDecals?.[values.Eyes] ?? [])]
    if (layers.has(mouth)) { names.push(mouth); const decal = layers.get(mouth)!.meta.decals?.[mouth]; if (decal) names.push(decal) }
    else if (!skull) names.push('mouth/placeholder')
    // hidesSpikes hats supply their own opaque front/back silhouette, as in compose.py.
    names.push(`acc/${slug(values.Accessory)}/face`, `${head}/front`, `${head}/decal`)
    return this.stack(names, skin.tint, left, skin.face)
  }
  auraFrames(id: number): HeadRef[] | null {
    const values = this.values(id)
    if (this.isLegend(id)) return null
    const aura = `aura/${slug(values.Aura)}`, glow = values.Base === 'Radioactive'
    if (!this.data.layers.has(aura) && !this.data.layers.has(`${aura}/0`) && !glow) return null
    const atlas = this.atlas(false)
    return [0, 1, 2, 3].map(i => {
      const key = `aura:${id}:${i}`
      return this.cached(atlas, key) ?? this.store(atlas, key, this.stack([this.data.layers.has(aura) ? aura : `${aura}/${i}`, ...(glow ? [`form/radioactive/glow/${i}`] : [])], this.data.skins[values.Skin].tint, false))
    })
  }
  accessory(id: number): { ref: HeadRef; grip: { x: number; y: number } } | null {
    const values = this.values(id), name = `acc/${slug(values.Accessory)}/hand`, layer = this.data.layers.get(name)
    if (!layer || this.isLegend(id)) return null
    const atlas = this.atlas(false), key = `acc:${slug(values.Accessory)}`, [x, y] = layer.meta.grip?.[name] ?? [185, 272]
    const decal = layer.meta.decals?.[name]
    const ref = this.cached(atlas, key) ?? this.store(atlas, key, this.stack([name, ...(decal ? [decal] : [])], this.data.skins[values.Skin].tint, false))
    return { ref, grip: { x: x / 2, y: y / 2 } }
  }
  isLegend(id: number): boolean { return !!this.data?.legends.legends[String(id)] || this.values(id).Base === '1:1' }
  private values(id: number) {
    if (!this.data) throw new Error('Await ChogHeads.ready before composing')
    const cached = this.valuesCache.get(id)
    if (cached) return cached
    const row = this.data.traits.chogs[String(id)]
    if (!row || row.length !== this.data.traits.keys.length) throw new Error(`Unknown Chog: ${id}`)
    const values = Object.fromEntries(this.data.traits.keys.map((key, i) => [key, row[i] ? this.data.traits.values[key][row[i]] : '']))
    this.valuesCache.set(id, values); return values
  }
  private stack(names: string[], tint: string, left: boolean, face?: string) {
    const canvas = makeCanvas(), ctx = canvas.getContext('2d')!
    let fur: HTMLCanvasElement | undefined, faceAlpha: HTMLCanvasElement | undefined
    for (const name of names) {
      if (!this.data.layers.has(name)) continue
      const layer = this.layer(name, tint, left)
      if (name === 'base/face' && face && face.toLowerCase() !== '#f4eedd') this.tint(layer, face)
      if (name === 'base/back') { const saved = this.scratch[3]; saved.ctx.clearRect(0, 0, 256, 320); saved.ctx.drawImage(layer, 0, 0); fur = saved.canvas }
      if (name === 'skin/multi/stripes' && fur) this.clip(layer, fur)
      if (name === 'base/face' || name === 'form/skull/face') { const saved = this.scratch[4]; saved.ctx.clearRect(0, 0, 256, 320); saved.ctx.drawImage(layer, 0, 0); faceAlpha = saved.canvas }
      if (name.startsWith('skin/') && name.endsWith('/shine') && faceAlpha) this.clip(layer, faceAlpha)
      ctx.drawImage(layer, 0, 0)
    }
    return canvas
  }
  private layer(name: string, color: string, left: boolean) {
    const { frame: f, image } = this.data.layers.get(name)!, rect = f.frame, s = f.spriteSourceSize
    const { canvas, ctx } = this.scratch[0]; ctx.clearRect(0, 0, 256, 320)
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, s.x, s.y, s.w, s.h)
    if (name === 'base/back' || f.tint === 'skin') this.tint(canvas, color)
    if (f.clip === 'faceMask') this.clip(canvas, this.mask)
    if (!left) return canvas
    const { canvas: moved, ctx: mc } = this.scratch[1]; mc.clearRect(0, 0, 256, 320); mc.save()
    if (name.endsWith('/decal')) {
      if (!f.decal) throw new Error(`Missing decal registration: ${name}`)
      mc.drawImage(canvas, Math.round(256 - 2 * f.decal.anchor.x), 0)
    } else { mc.translate(256, 0); mc.scale(-1, 1); mc.drawImage(canvas, 0, 0) }
    mc.restore(); return moved
  }
  private tint(canvas: HTMLCanvasElement, color: string) {
    const { canvas: original, ctx: copy } = this.scratch[2]; copy.clearRect(0, 0, 256, 320); copy.drawImage(canvas, 0, 0)
    const ctx = canvas.getContext('2d')!
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(original, 0, 0); ctx.globalCompositeOperation = 'source-over'
  }
  private clip(canvas: HTMLCanvasElement, mask: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!; ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, 0, 0); ctx.globalCompositeOperation = 'source-over'
  }
  private crop(canvas: HTMLCanvasElement, left: boolean) {
    const { centre, r } = this.data.template.anchors.faceWindow, cx = left ? 256 - centre.x : centre.x
    const result = makeCanvas(160, 160), ctx = result.getContext('2d')!
    ctx.beginPath(); ctx.arc(80, 80, 80, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(canvas, cx - r, centre.y - r, r * 2, r * 2, 0, 0, 160, 160)
    return result
  }
  private atlas(window: boolean) {
    const existing = window ? this.windowAtlas : this.headAtlas
    if (existing) return existing
    const width = window ? 64 : 128, height = window ? 64 : 160, columns = 1024 / width
    if (!this.scene?.textures) throw new Error('A live Phaser scene is required for Chog atlas frames')
    const atlasHeight = window ? 1024 : 512
    const texture = this.scene.textures.createCanvas(window ? 'siege-faces' : 'siege-chog-heads', 1024, atlasHeight)!
    const atlas: Atlas = { texture, slots: new Map(), width, height, columns, capacity: columns * Math.floor(atlasHeight / height), dirty: false, refs: [] }
    for (let i = 0; i < atlas.capacity; i++) { texture.add(String(i), 0, i % columns * width, Math.floor(i / columns) * height, width, height); atlas.refs.push({ key: texture.key, frame: String(i) }) }
    if (window) this.windowAtlas = atlas; else this.headAtlas = atlas
    return atlas
  }
  private cached(atlas: Atlas, key: string): HeadRef | undefined {
    const slot = atlas.slots.get(key)
    return slot === undefined ? undefined : atlas.refs[slot]
  }
  private store(atlas: Atlas, key: string, canvas: HTMLCanvasElement): HeadRef {
    let slot = atlas.slots.size
    if (slot >= atlas.capacity) {
      // Recycle in FIFO order, keeping frames still displayed by a hero, HUD or enemy.
      // Aura consumers retain all four refs, even though only one cel is visible.
      const live = new Set<number>()
      const visit = (objects: Phaser.GameObjects.GameObject[]) => {
        for (const object of objects) {
          const item = object as Phaser.GameObjects.Image & { list?: Phaser.GameObjects.GameObject[] }
          if (item.visible === false) continue
          if (item.texture === atlas.texture) live.add(Number(item.frame.name))
          if (item.list) visit(item.list)
        }
      }
      visit(this.scene.children.list)
      const auras = new Set([...atlas.slots].filter(([name, n]) => name.startsWith('aura:') && live.has(n)).map(([name]) => name.slice(0, name.lastIndexOf(':'))))
      const first = [...atlas.slots].find(([name, n]) => !live.has(n) && !auras.has(name.slice(0, name.lastIndexOf(':')))) ?? atlas.slots.entries().next().value!
      slot = first[1]; atlas.slots.delete(first[0])
    }
    atlas.slots.set(key, slot)
    const x = slot % atlas.columns * atlas.width, y = Math.floor(slot / atlas.columns) * atlas.height, ctx = atlas.texture.context
    ctx.clearRect(x, y, atlas.width, atlas.height); ctx.drawImage(canvas, x, y, atlas.width, atlas.height); atlas.dirty = true
    return atlas.refs[slot]
  }
  private flush() {
    const frame = this.scene.game.loop.frame
    // Scene creation and stopped-loop tools may flush immediately. During play
    // at most one atlas is uploaded per four frames, alternating when both dirty.
    if (this.scene.game.loop.running && frame - this.uploadFrame < 4) return
    const atlas = this.uploadNext ? this.windowAtlas?.dirty ? this.windowAtlas : this.headAtlas : this.headAtlas?.dirty ? this.headAtlas : this.windowAtlas
    if (atlas?.dirty) { atlas.texture.refresh(); atlas.dirty = false; this.uploadFrame = frame; this.uploadNext = atlas === this.headAtlas }
  }
}
