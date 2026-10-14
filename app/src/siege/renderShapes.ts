import Phaser from 'phaser'
import type { Route } from './world'
import type { LevelGeometry } from './data/level1'

// The illustrated background already includes the road. Bake the exposed curb
// union once, with the original road interior/scenery preserved in the same map
// texture. Nothing is redrawn when a bridge moves or the quality tier changes.
export function curbedMap(scene: Phaser.Scene, routes: Route[], geometry: LevelGeometry) {
  const key = 'siege-curbed-map'
  if (!scene.textures.exists(key)) {
    const source = scene.textures.get('siege-background').getSourceImage() as HTMLImageElement
    const texture = scene.textures.createCanvas(key, source.width, source.height)!, c = texture.context
    const margin = (source.width - 1920) / 2
    c.translate(margin, 0); c.lineCap = 'round'; c.lineJoin = 'round'
    const stroke = (width: number, color: string) => {
      c.lineWidth = width; c.strokeStyle = color
      c.beginPath()
      for (const route of routes) {
        c.moveTo(route.points[0].x, route.points[0].y)
        for (let i = 1; i < route.points.length; i++) c.lineTo(route.points[i].x, route.points[i].y)
      }
      c.stroke()
    }
    // All routes form one outline, so forks and shared sections have no seams.
    stroke(151, '#110720'); stroke(143, '#7A6699')
    c.globalCompositeOperation = 'destination-out'; stroke(139, '#000')
    // Illustrated decks and water take precedence, including the fixed crossing.
    const bridge = geometry.props.find(p => p.kind === 'bridge')
    if (bridge?.reach) {
      const xs = bridge.reach.map(p => p[0])
      c.clearRect(Math.min(...xs) - 6, 0, Math.max(...xs) - Math.min(...xs) + 12, 1080)
    }
    for (const prop of geometry.props) if ('type' in prop && prop.type === 'lamp') c.clearRect(prop.x - 22, prop.y - 140, 44, 146)
    c.clearRect(geometry.porch.x - 116, geometry.porch.y - 100, 250, 170)
    c.globalCompositeOperation = 'source-over'
    // Rare Row's existing gold trim and lighting carry most of its contrast.
    if (geometry.dark) {
      c.globalCompositeOperation = 'destination-in'; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-margin, 0, source.width, source.height)
    }
    c.globalCompositeOperation = 'destination-over'; c.drawImage(source, -margin, 0)
    c.globalCompositeOperation = 'source-over'; texture.refresh()
  }
  return scene.add.image(960, 540, key)
}

// Small shared masks; moving/fading shapes are ordinary batched image quads.
const KEY = 'siege-shapes'
export function shapeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return KEY
  const texture = scene.textures.createCanvas(KEY, 256, 256)!, c = texture.context
  c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); texture.add('white', 0, 0, 0, 4, 4)
  c.beginPath(); c.arc(24, 16, 12, 0, Math.PI * 2); c.fill(); texture.add('dot', 0, 12, 4, 24, 24)
  for (const [i, width] of [49, 68, 84, 86].entries()) { const y = 100 + i * 12; c.beginPath(); c.roundRect(0, y, width, 10, 4); c.fill(); texture.add(`bar-${width}`, 0, 0, y, width, 10) }
  c.beginPath(); c.roundRect(0, 50, 12, 6, 3); c.fill()
  texture.add('fill', 0, 0, 50, 12, 6)
  c.lineWidth = 2; c.beginPath(); c.ellipse(46, 76, 44, 15, 0, 0, Math.PI * 2); c.strokeStyle = '#fff'; c.stroke(); texture.add('armour', 0, 0, 59, 92, 34)
  // A shield bubble: clear in the middle, bright at the rim, with one highlight.
  const bubble = c.createRadialGradient(148, 48, 18, 148, 48, 46)
  bubble.addColorStop(0, 'rgba(255,255,255,0)'); bubble.addColorStop(.75, 'rgba(255,255,255,.28)'); bubble.addColorStop(1, 'rgba(255,255,255,.75)')
  c.beginPath(); c.arc(148, 48, 45, 0, Math.PI * 2); c.fillStyle = bubble; c.fill(); c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke()
  c.beginPath(); c.arc(148, 48, 34, Math.PI * 1.1, Math.PI * 1.45); c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); texture.add('bubble', 0, 100, 0, 96, 96)
  // A soft round glow.
  const glow = c.createRadialGradient(212, 140, 0, 212, 140, 40)
  glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = glow; c.fillRect(172, 100, 80, 80); texture.add('glow', 0, 172, 100, 80, 80)
  texture.refresh(); return KEY
}

// Cache a plate at its design size. Text and hit areas stay independent.
export function plate(scene: Phaser.Scene, x: number, y: number, width: number, height: number, radius: number, fill: number, alpha = 1, stroke = fill, line = 0) {
  const key = `siege-plate-${width}-${height}-${radius}-${fill}-${alpha}-${stroke}-${line}`, pad = Math.ceil(line / 2) + 1
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(fill, alpha).fillRoundedRect(pad, pad, width, height, radius)
    if (line) g.lineStyle(line, stroke).strokeRoundedRect(pad, pad, width, height, radius)
    g.generateTexture(key, Math.ceil(width + pad * 2), Math.ceil(height + pad * 2)); g.destroy()
  }
  return scene.add.image(x - pad, y - pad, key).setOrigin(0)
}

export function circle(scene: Phaser.Scene, radius: number, fill: number, alpha = 0, stroke = fill, line = 0) {
  const key = `siege-circle-${radius}-${fill}-${alpha}-${stroke}-${line}`, pad = Math.ceil(line / 2) + 1, size = Math.ceil((radius + pad) * 2)
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 })
    if (alpha) g.fillStyle(fill, alpha).fillCircle(size / 2, size / 2, radius)
    if (line) g.lineStyle(line, stroke).strokeCircle(size / 2, size / 2, radius)
    g.generateTexture(key, size, size); g.destroy()
  }
  return scene.add.image(0, 0, key)
}

// HUD-only 2x bakes. These canvases upload once; animation uses image transforms.
export function hudPlate(scene: Phaser.Scene, width: number, height: number, accent: string, traits = false, radius = traits ? 28 : 32) {
  const key = `siege-hud-plate-${width}-${height}-${accent}-${traits}-${radius}`, pad = traits ? 28 : 8
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, (width + pad * 2) * 2, (height + pad * 2) * 2)!, c = texture.context
    c.scale(2, 2); c.translate(pad, pad)
    c.beginPath(); c.roundRect(0, 0, width, height, radius)
    if (traits) { c.shadowColor = accent; c.shadowBlur = 22 }
    c.fillStyle = traits ? '#1C0D30' : 'rgba(27,15,43,.72)'; c.fill()
    c.strokeStyle = accent; c.lineWidth = traits ? 3 : 2.5; c.stroke(); c.shadowBlur = 0
    const inset = Math.max(16, radius * .65)
    c.beginPath(); c.roundRect(inset, 8, width - inset * 2, 3, 1.5); c.fillStyle = traits ? '#b3a3ff' : 'rgba(255,255,255,.24)'; c.fill()
    texture.refresh()
  }
  return scene.add.image(-pad, -pad, key).setOrigin(0).setScale(.5)
}

export function hudDisc(scene: Phaser.Scene, size: number, accent: string) {
  const key = `siege-hud-disc-${size}-${accent}`, side = size + 8
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, side * 2, side * 2)!, c = texture.context
    c.scale(2, 2); c.translate(side / 2, side / 2)
    const fill = c.createLinearGradient(0, -size / 2, 0, size / 2)
    fill.addColorStop(0, '#43255f'); fill.addColorStop(1, '#1B0F2B')
    c.beginPath(); c.arc(0, 0, size / 2 - 3, 0, Math.PI * 2); c.fillStyle = fill; c.fill()
    c.strokeStyle = '#10091b'; c.lineWidth = 7; c.stroke()
    c.strokeStyle = accent; c.lineWidth = 3; c.stroke()
    c.beginPath(); c.arc(0, 0, size / 2 - 10, -Math.PI * .86, -Math.PI * .14)
    c.strokeStyle = '#ffffff55'; c.lineWidth = 2.5; c.stroke()
    texture.refresh()
  }
  return scene.add.image(0, 0, key).setDisplaySize(side, side)
}

export function comicBanner(scene: Phaser.Scene) {
  const key = 'siege-comic-banner'
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, 1440, 280)!, c = texture.context
    c.scale(2, 2)
    c.beginPath(); c.moveTo(30, 7); c.lineTo(714, 7); c.lineTo(690, 133); c.lineTo(6, 133); c.closePath()
    c.fillStyle = '#1C0D30'; c.fill(); c.strokeStyle = '#FFB800'; c.lineWidth = 5; c.stroke()
    c.beginPath(); c.moveTo(38, 17); c.lineTo(696, 17); c.strokeStyle = '#FFD23F66'; c.lineWidth = 3; c.stroke()
    texture.refresh()
  }
  return scene.add.image(0, 0, key).setScale(.5)
}

// A cooldown mask is at most 150px, refreshed only when its HUD value changes
// (8 Hz maximum). Keeping one tiny mask per active button avoids a 17 MB sheet
// of mostly unused percentage frames. It is still a single sprite at render time.
let sweepId = 0
export function setSweep(scene: Phaser.Scene, image: Phaser.GameObjects.Image, ratio: number, radius: number, line = 0) {
  const step = Math.round(Phaser.Math.Clamp(ratio, 0, 1) * 100)
  let state = image.getData('sweep') as { texture: Phaser.Textures.CanvasTexture; step: number } | undefined
  if (!state) {
    const size = Math.ceil((radius + line / 2 + 2) * 2), key = `siege-sweep-${sweepId++}`
    state = { texture: scene.textures.createCanvas(key, size, size)!, step: -1 }; image.setData('sweep', state).setTexture(key)
    image.once('destroy', () => { if (scene.textures.exists(key)) scene.textures.remove(key) })
  }
  if (state.step === step) return
  state.step = step
  const c = state.texture.context, size = state.texture.width, center = size / 2
  c.clearRect(0, 0, size, size); c.beginPath()
  if (!line) c.moveTo(center, center)
  c.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * step / 100)
  if (line) { c.lineWidth = line; c.strokeStyle = '#ffd675'; c.stroke() }
  else { c.closePath(); c.fillStyle = 'rgba(22,15,33,.78)'; c.fill() }
  state.texture.refresh()
}

// Reuse the same quads in draw order. The pool is allocated before the first wave.
export class ShapePool {
  private key: string
  private root: Phaser.GameObjects.Container
  private images: Phaser.GameObjects.Image[] = []
  private bars: { back: Phaser.GameObjects.Image; fill: Phaser.GameObjects.NineSlice }[] = []
  private used = 0
  private barUsed = 0
  private visible = 0
  constructor(scene: Phaser.Scene, depth: number, capacity: number) {
    const key = this.key = shapeTexture(scene)
    this.root = scene.add.container(0, 0).setDepth(depth)
    for (let i = 0; i < capacity; i++) {
      const image = scene.add.image(0, 0, key, 'white').setOrigin(0)
      this.root.add(image); this.images.push(image)
    }
    // 96 enemies, 36 guards, and the hero. A three-slice fill keeps the rounded
    // ends at three pixels while its middle stretches, with one display object.
    for (let i = 0; i < 133; i++) {
      const back = scene.add.image(0, 0, key, 'bar-68').setOrigin(0).setTint(0x241c32).setAlpha(.9)
      const fill = scene.add.nineslice(0, 0, key, 'fill', 64, 6, 3, 3, 0, 0).setOrigin(0)
      this.root.add([back, fill]); this.bars.push({ back, fill })
    }
    // Only submitted quads enter rendering or the world's depth sort. Keep the
    // inactive pool separately, with parent ownership for correct transforms.
    this.root.list.length = 0
    scene.events.once('shutdown', () => { for (const image of this.images) image.destroy(); for (const b of this.bars) { b.back.destroy(); b.fill.destroy() } })
  }
  begin() { this.used = 0; this.barUsed = 0; this.visible = 0 }
  end() { this.root.list.length = this.visible }
  image(frame: string, x: number, y: number, width: number, height: number, tint: number, alpha = 1, rotation = 0, add = false) { this.sprite(this.key, frame, x, y, width, height, tint, alpha, rotation, add) }
  // Any loaded atlas frame (a status icon, a shield) can use the same quads; `add` lights it additively.
  sprite(key: string, frame: string, x: number, y: number, width: number, height: number, tint: number, alpha = 1, rotation = 0, add = false) {
    if (width <= 0 || height <= 0 || alpha <= 0) return
    const image = this.images[this.used++]
    if (!image) { this.used--; return }
    if (image.texture.key !== key || image.frame.name !== frame) image.setTexture(key, frame)
    image.setPosition(x, y).setDisplaySize(width, height).setTint(tint).setAlpha(alpha).setRotation(rotation).setBlendMode(add ? 1 : 0)
    this.root.list[this.visible++] = image
  }
  bar(x: number, y: number, value: number, color: number, width: number) {
    const bar = this.bars[this.barUsed++]
    if (!bar) { this.barUsed--; return }
    const frame = `bar-${width + 4}`
    if (bar.back.frame.name !== frame) bar.back.setFrame(frame)
    bar.back.setPosition(x - width / 2 - 2, y - 2)
    this.root.list[this.visible++] = bar.back
    const fill = width * Phaser.Math.Clamp(value, 0, 1)
    if (fill <= 0) return
    if (bar.fill.width !== Math.max(6, fill)) bar.fill.setSize(Math.max(6, fill), 6)
    bar.fill.setScale(Math.min(1, fill / 6), 1).setPosition(x - width / 2, y).setTint(color)
    this.root.list[this.visible++] = bar.fill
  }
}
