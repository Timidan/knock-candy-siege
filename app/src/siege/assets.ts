import Phaser from 'phaser'
import type { ChogHeads } from './chogHead'
import { ENEMIES, TOWERS, TRAPS, EMOTES, EMOTE_LABELS } from './data/config'
import type { EnemyKind } from './data/config'
import { LEVEL1, readGeometry, mapFile } from './data/level1'
import type { LevelGeometry } from './data/level1'
import type { TraitData } from './data/traits'
import { MODIFIERS } from './data/traits'
import { withLegends } from './data/kits'
import type { KitData, ChogRow, Skin, Kit, LegendInfo } from './data/kits'
import type { RigData, Clip } from './hero/pose'
import type { SignatureData } from './hero/Signature'

// Vite refreshes this inventory when the art job adds files; absent optional files never issue 404s.
const inventory = import.meta.glob([
  '/public/siege/{traits,kits,skins,legends}.json', '/public/chogs.json', '/public/siege/atlas/hero-*@2x.json', '/public/siege/atlas/cards2.json', '/public/siege/atlas/{rig,sig}.json', '/public/siege/atlas/{kit,fx2,sig,units2,props}.{png,json}', '/public/siege/atlas/{units,fx,ui}.{png,json}', '/public/siege/atlas/faces.json',
  '/public/siege/levels/level{1,2,3}.{json,webp}', '/public/siege/atlas/dances.json',
  '/public/siege/audio/sfx/{throw,splat,coin,hit,hero-step,laser,boo,sell,guard-hit}-{1,2,3}.{ogg,mp3}', '/public/siege/audio/sfx/{armor,guard-attack}-{1,2}.{ogg,mp3}',
  '/public/siege/audio/sfx/{build,upgrade,wave,jar-stolen,emote,victory,defeat,candy-cascade,trap,ui-open,ui-click,ui-close,ui-confirm,ui-error,ui-toggle}-1.{ogg,mp3}',
], { query: '?url', import: 'default', eager: true })
export const hasAsset = (path: string) => `/public${path}` in inventory
type Anchor = { x: number; y: number; r: number; die?: { x: number; y: number; r: number }[]; cast?: { x: number; y: number; r: number }[]; grab?: { x: number; y: number; r: number }[]; frames?: { x: number; y: number; r?: number }[]; hurt?: { x: number; y: number; r: number } }
export type Dance = { name: string; clip: string; group: 'universal' | 'shop' | 'signature'; loop: boolean; emote?: string; sig?: string }
export type LegendFile = { legends: Record<string, LegendInfo>; greatPumpkin: { name: string; phases: string[] } }
export type AssetPack = { traits: TraitData; kits: KitData; legends: LegendFile; chogs: ChogRow[]; skins: Record<string, Skin>; rig: RigData; dances: Record<string, Dance>; signatures: SignatureData; geometry: LevelGeometry; faces: Record<string, Anchor>; atlases: { key: string; image: HTMLImageElement; data: { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> } }[]; background?: HTMLImageElement }
// Queue images before starting the clocks; small JSON requests keep the launch path moving.
const IDLE = 15_000, CAP = 180_000
let received = 0
const completed = new Map<string, Blob>()
let free = 2
const waiting: (() => void)[] = []
function acquire(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  if (free) { free--; return Promise.resolve() }
  return new Promise((resolve, reject) => {
    const next = () => { signal?.removeEventListener('abort', cancel); resolve() }
    const cancel = () => { waiting.splice(waiting.indexOf(next), 1); reject(signal!.reason) }
    waiting.push(next)
    signal?.addEventListener('abort', cancel, { once: true })
  })
}
const release = () => { const next = waiting.shift(); if (next) next(); else free++ }
async function download(url: string, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted()
  const cached = completed.get(url)
  if (cached) return cached
  const stop = new AbortController(), cancel = () => stop.abort(signal?.reason)
  const timeout = () => stop.abort(new DOMException(`Download stalled: ${url}`, 'TimeoutError'))
  const started = performance.now()
  let progress = 0
  // Before the first byte, the browser may be queuing this request behind other images.
  // Once it starts, only this file's bytes extend its idle deadline; another file cannot hide a body stall.
  const idle = setInterval(() => {
    if (performance.now() - (progress || Math.max(started, received)) >= IDLE) timeout()
  }, 500)
  // The 3.7 MB Chog aura needs over 120 s when two downloads share a 50 KB/s link.
  const cap = setTimeout(timeout, CAP)
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    signal?.throwIfAborted()
    const response = await fetch(url, { signal: stop.signal, priority: 'high' })
    if (!response.ok || !response.body) throw new Error(`Could not load ${url}`)
    const reader = response.body.getReader(), chunks: BlobPart[] = []
    try {
      for (let part = await reader.read(); !part.done; part = await reader.read()) {
        if (!part.value.byteLength) continue
        chunks.push(part.value)
        progress = received = performance.now()
      }
    } finally { reader.releaseLock() }
    const blob = new Blob(chunks, { type: response.headers.get('Content-Type') ?? '' })
    completed.set(url, blob)
    return blob
  } catch (error) { stop.abort(); throw error }
  finally { clearInterval(idle); clearTimeout(cap); signal?.removeEventListener('abort', cancel) }
}
export const loadJson = async (url: string, signal?: AbortSignal) => {
  const blob = await download(url, signal)
  try { return JSON.parse(await blob.text()) }
  catch (error) { completed.delete(url); throw error }
}
export async function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  await acquire(signal)
  const blob = await download(url, signal).finally(release)
  signal?.throwIfAborted()
  const src = URL.createObjectURL(blob), img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { img.src = ''; clean(); reject(signal!.reason) }
      const clean = () => { img.onload = null; img.onerror = null; signal?.removeEventListener('abort', cancel) }
      img.onload = () => { clean(); resolve() }
      img.onerror = () => { clean(); completed.delete(url); reject(new Error(`Image unavailable: ${url}`)) }
      signal?.addEventListener('abort', cancel, { once: true })
      img.src = src
    })
    return img
    // A loaded atlas's img.src is reused as a CSS background by the menus' sprites, so its object URL lives for the page.
  } catch (error) { URL.revokeObjectURL(src); throw error }
}
export async function loadAssets(signal: AbortSignal): Promise<AssetPack> {
  const json = async (path: string) => hasAsset(path) ? loadJson(path, signal).catch(() => null) : null
  const [traits, baseKits, skins, chogs, rig, signatures, faces, dances, legends, ...atlases] = await Promise.all([
    json('/siege/traits.json'), json('/siege/kits.json'), json('/siege/skins.json'), json('/chogs.json'), json('/siege/atlas/rig.json'), json('/siege/atlas/sig.json'), json('/siege/atlas/faces.json'),
    json('/siege/atlas/dances.json'), json('/siege/legends.json'),
    ...['units', 'fx', 'ui', 'kit', 'sig'].map(async key => {
      if (!hasAsset(`/siege/atlas/${key}.png`) || !hasAsset(`/siege/atlas/${key}.json`)) return null
      try {
        const [data, image] = await Promise.all([json(`/siege/atlas/${key}.json`), loadImage(`/siege/atlas/${key}.png`, signal)])
        return data?.frames && image.width <= 2048 && image.height <= 2048 ? { key, image, data } : null
      } catch { return null }
    }),
  ])
  if (!traits?.keys || !traits?.values || !traits?.chogs) throw new Error('The Chog trait list could not be loaded. Please try again.')
  if (!baseKits?.slots || !baseKits?.assign || !skins || !chogs?.chogs || !rig?.clips || !signatures?.frames) throw new Error('The hero kit could not be loaded. Please try again.')
  if (!legends?.legends || !legends?.greatPumpkin) throw new Error('The legends could not be loaded. Please try again.')
  const kits = withLegends(baseKits, legends)
  if (!dances?.clips || !dances?.dances) throw new Error('The dances could not be loaded. Please try again.')
  rig.clips = { ...rig.clips, ...dances.clips as Record<string, Clip> }
  for (const key of ['kit', 'sig']) if (!atlases.some(atlas => atlas?.key === key)) throw new Error(`The ${key} art could not be loaded. Please try again.`)
  const geometry = LEVEL1.geometry
  const pack: AssetPack = { traits, kits, legends, skins, chogs: chogs.chogs, rig, dances: dances.dances, signatures, geometry, faces: faces ?? {}, atlases: atlases.filter(Boolean) as AssetPack['atlases'] }
  return pack
}

export async function loadAtlas(key: string, signal?: AbortSignal): Promise<AssetPack['atlases'][number]> {
    const [data, image] = await Promise.all([loadJson(`/siege/atlas/${key}.json`, signal), loadImage(`/siege/atlas/${key}.png`, signal)])
    if (!data.frames || image.width > 2048 || image.height > 2048) throw new Error(`Invalid atlas: ${key}`)
    return { key, image, data }
}
export async function loadLevelAssets(pack: AssetPack, level: number, signal: AbortSignal, daily = false): Promise<AssetPack> {
  const geometry = readGeometry(await loadJson(`/siege/levels/${mapFile(level)}.json`, signal))
  if (!geometry) throw new Error('The map could not be loaded. Please retry.')
  // props3 carries the batch 3 props, the portal, the map effects, the darkness light and the daily icons.
  const newProps = !!(geometry.portals || geometry.zones || geometry.dark || geometry.props.some(p => p.kind === 'bell' || p.kind === 'grate' || p.kind === 'bonfire'))
  const keys = ['units2', 'fx2', 'fx3', 'towers3', 'items', ...(geometry.props.some(p => p.use) || geometry.ambient ? ['props'] : []), ...(newProps || daily ? ['props3'] : [])]
  const normal = `/siege/levels/${geometry.background}`, wide = normal.replace(/\.webp$/, '-wide.webp')
  const backgroundImage = loadImage(wide, signal).catch(() => loadImage(normal, signal))
  const [background, ...atlases] = await Promise.all([backgroundImage, ...keys.map(key => loadAtlas(key, signal))])
  return { ...pack, geometry, background, atlases: [...pack.atlases, ...atlases] }
}

// A legend's special and ultimate art live in its own atlas; every other hero loads one atlas for each.
export function heroAtlasKeys(kit: Kit, costume = '') {
  const sharp = (name: string) => hasAsset(`/siege/atlas/${name}@2x.json`) ? [`${name}@2x`] : []
  return [`hero-${kit.costume}`, ...sharp(`hero-${kit.costume}`), ...(kit.legend ? [] : [`special-${kit.special}`, `ult-${kit.ultimate}`]), ...(costume ? [`hero-${costume}`, ...sharp(`hero-${costume}`)] : [])]
}
export async function loadHeroAssets(pack: AssetPack, kit: Kit, signal: AbortSignal, costume = '', owned: number[] = []): Promise<AssetPack> {
  const keys = [...heroAtlasKeys(kit, costume), ...(owned.includes(21) ? ['skins3'] : []), ...(owned.includes(22) ? ['emotes2'] : [])]
  const atlases = await Promise.all([...new Set(keys)].filter(key => !pack.atlases.some(a => a.key === key)).map(key => loadAtlas(key, signal)))
  return { ...pack, atlases: [...pack.atlases, ...atlases] }
}

export class Art {
  private scene: Phaser.Scene
  private faces: Record<string, Anchor>
  private atlasKeys: string[]
  private frameCache = new Map<string, [string, string]>()
  private anchorCache = new Map<string, Anchor>()
  constructor(scene: Phaser.Scene, pack: AssetPack, _lite = false) {
    this.scene = scene
    this.faces = pack.faces
    this.atlasKeys = pack.atlases.map(a => a.key)
    for (const atlas of pack.atlases) scene.textures.addAtlas(atlas.key, atlas.image, atlas.data)
    if (pack.background) scene.textures.addImage('siege-background', pack.background)

  }
  frame(name: string): [string, string] {
    const cached = this.frameCache.get(name)
    if (cached) return cached
    const split = name.indexOf(':')
    if (split >= 0) { const ref: [string, string] = [name.slice(0, split), name.slice(split + 1)]; this.frameCache.set(name, ref); return ref }
    for (const atlas of this.atlasKeys) if (this.scene.textures.exists(atlas) && this.scene.textures.get(atlas).has(name)) { const ref: [string, string] = [atlas, name]; this.frameCache.set(name, ref); return ref }
    const base = name.replace(/\/(walk|die|attack)\/\d+$/, '/walk/0').replace(/\/(hurt)$/, '/walk/0').replace(/\/\d+$/, '/0')
    // Built on the first missing frame only: with the full art it would be 16 MB of unused GPU memory.
    if (!this.scene.textures.exists('siege-fallback')) this.makeFallback()
    const texture = this.scene.textures.get('siege-fallback')
    return ['siege-fallback', texture.has(name) ? name : texture.has(base) ? base : 'dot']
  }
  addAssets(pack: AssetPack) { for (const atlas of pack.atlases) this.addAtlas(atlas) }
  addAtlas(atlas: AssetPack['atlases'][number]) {
    if (this.scene.textures.exists(atlas.key)) return
    this.scene.textures.addAtlas(atlas.key, atlas.image, atlas.data); this.atlasKeys.push(atlas.key); this.frameCache.clear()
  }
  // Boss art is loaded when its wave is called and dropped after the fight, to stay inside the texture budget.
  removeAtlas(key: string) { this.frameCache.clear(); this.atlasKeys = this.atlasKeys.filter(k => k !== key); if (this.scene.textures.exists(key)) this.scene.textures.remove(key) }
  count(name: string) {
    const [key, frame] = this.frame(name), texture = this.scene.textures.get(key), stem = frame.replace(/\/\d+$/, '')
    if (stem === frame) return 1
    let n = 0; while (texture.has(`${stem}/${n}`)) n++
    return Math.max(1, n)
  }
  image(x: number, y: number, name: string) { return this.scene.add.image(x, y, ...this.frame(name)) }
  // A texture made at run time (the boss UI sheet) joins the lookup like an atlas.
  useTexture(key: string) { this.atlasKeys.push(key); this.frameCache.clear() }
  // Compare the texture itself, not its key: an atlas that was removed and loaded again reuses the key.
  set(image: Phaser.GameObjects.Image, name: string) { const [key, frame] = this.frame(name); if (image.texture !== this.scene.textures.get(key) || image.frame.name !== frame) image.setTexture(key, frame) }
  anchor(kind: EnemyKind | 'hero', frame = 0, hurt = false, state: 'walk' | 'cast' | 'grab' | 'die' = 'walk'): Anchor {
    const key = `${kind}:${frame}:${hurt}:${state}`, cached = this.anchorCache.get(key)
    if (cached) return cached
    const fallback = kind === 'hero' ? { x: 56, y: 56, r: 41 } : { x: 64, y: 52, r: 27 }
    const anchor = this.faces[kind]
    if (!anchor || ![anchor.x, anchor.y, anchor.r].every(Number.isFinite) || anchor.r <= 0) return fallback
    const resolved = { ...anchor, ...(hurt && anchor.hurt ? anchor.hurt : (state === 'walk' ? anchor.frames?.[frame] : anchor[state]?.[frame])) }
    this.anchorCache.set(key, resolved); return resolved
  }
  // Existing portrait consumers share the composed window atlas during the conversion.
  pin(_id: number) {}
  face(id: number) { return (this.scene as Phaser.Scene & { heads: ChogHeads }).heads.window(id).frame }
  refresh() {} // ChogHeads uploads dirty canvas atlases once at postupdate.
  private makeFallback() {
    const names: { name: string; color: string; label: string; shape?: string }[] = [{ name: 'dot', color: '#fff1c7', label: '' }]
    for (const [kind, tower] of Object.entries(TOWERS)) for (let lv = 1; lv <= 3; lv++) names.push({ name: `tower/${kind}/${lv}`, color: `#${tower.color.toString(16)}`, label: `${kind === 'egg' ? 'EGG' : kind === 'tp' ? 'TP' : kind === 'patch' ? 'PATCH' : 'BOO'} ${lv}`, shape: 'tower' })
    names.push({ name: 'pad/empty', color: '#9e8373', label: '+', shape: 'pad' }, { name: 'pad/glow', color: '#ffe09a', label: '+', shape: 'pad' })
    for (const [kind, enemy] of Object.entries(ENEMIES)) names.push({ name: `enemy/${kind}/walk/0`, color: `#${enemy.color.toString(16)}`, label: '', shape: kind })
    names.push({ name: 'guard/knight/walk/0', color: '#ffb965', label: '♜', shape: 'treater' }, { name: 'hero/frame/guest', color: '#d6c5ff', label: '', shape: 'ring' }, { name: 'hero/frame/home', color: '#ffd56c', label: '', shape: 'ring' }, { name: 'hero/ring', color: '#f3c96f', label: '', shape: 'pad' })
    for (const name of ['egg', 'tp', 'wisp', 'seed']) names.push({ name: `proj/${name}`, color: name === 'wisp' ? '#c8a4ff' : '#ffe9b5', label: '', shape: 'projectile' })
    for (const name of ['splat', 'poof', 'candy-burst', 'tp-wrap', 'candy-rain', 'boo', 'levelup', 'stun']) names.push({ name: `fx/${name}/0`, color: name === 'boo' ? '#c4b3fb' : '#ffe4a0', label: '', shape: 'effect' })
    names.push({ name: 'fx/coin', color: '#ffda6f', label: '•', shape: 'projectile' })
    for (const [name, trap] of Object.entries(TRAPS)) names.push({ name: `trap/${name}/0`, color: `#${trap.color.toString(16)}`, label: name === 'pumpkin' ? '!' : name === 'bowl' ? 'CANDY' : 'GUM', shape: 'pad' })
    for (const name of EMOTES) names.push({ name: `emote/${name}/0`, color: '#fff2d5', label: EMOTE_LABELS[name], shape: 'bubble' })
    for (const mod of MODIFIERS) names.push({ name: `mod/${mod.name}`, color: '#d6c2ef', label: mod.name.slice(0, 2).toUpperCase(), shape: 'icon' })
    for (const name of ['jar', 'candy', 'star-full', 'star-empty', 'pause']) names.push({ name: `ui/${name}`, color: '#ffd377', label: name === 'jar' ? 'JAR' : name === 'candy' ? '•' : name === 'pause' ? 'Ⅱ' : '★', shape: 'icon' })
    const texture = this.scene.textures.createCanvas('siege-fallback', 2048, 2048)!, ctx = texture.context
    names.forEach((item, i) => {
      const x = i % 10 * 200, y = Math.floor(i / 10) * 240
      const tower = item.shape === 'tower', pad = item.shape === 'pad'
      const w = tower || pad ? 160 : item.name.startsWith('hero/frame') ? 112 : 128, h = tower ? 200 : pad ? 80 : 128
      ctx.save(); ctx.translate(x + w / 2 + 2, y + h / 2 + 2); ctx.lineWidth = 5; ctx.strokeStyle = '#251e32'; ctx.fillStyle = item.color
      ctx.beginPath()
      if (tower) { ctx.roundRect(-62, -78, 124, 167, 17); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#372e43'; ctx.fillRect(-67, 27, 134, 10); ctx.fillStyle = '#fff0d0' }
      else if (pad) { ctx.ellipse(0, 0, 73, 31, -.04, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
      else if (item.shape === 'ring') { ctx.arc(0, 0, 51, 0, Math.PI * 2); ctx.lineWidth = 7; ctx.strokeStyle = item.color; ctx.stroke() }
      else if (item.shape === 'bubble') { ctx.roundRect(-59, -42, 118, 77, 18); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, 35); ctx.lineTo(-20, 51); ctx.lineTo(18, 35); ctx.fill(); ctx.stroke() }
      else if (item.shape === 'bat') { ctx.moveTo(-60, -25); ctx.lineTo(-25, 43); ctx.lineTo(0, 20); ctx.lineTo(25, 43); ctx.lineTo(60, -25); ctx.lineTo(0, -42); ctx.closePath(); ctx.fill(); ctx.stroke() }
      else if (item.shape === 'ghost') { ctx.moveTo(-43, 45); ctx.lineTo(-44, -9); ctx.arc(0, -9, 44, Math.PI, 0); ctx.lineTo(44, 45); ctx.lineTo(22, 31); ctx.lineTo(0, 48); ctx.lineTo(-22, 31); ctx.closePath(); ctx.fill(); ctx.stroke() }
      else { ctx.ellipse(0, 3, item.shape === 'projectile' ? 19 : 47, item.shape === 'projectile' ? 25 : 52, -.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
      ctx.fillStyle = '#30233b'; ctx.font = `bold ${item.shape === 'icon' ? 26 : 22}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.label, 0, tower ? 53 : 0)
      ctx.restore(); texture.add(item.name, 0, x + 2, y + 2, w, h)
    })
    texture.refresh()
  }
}
