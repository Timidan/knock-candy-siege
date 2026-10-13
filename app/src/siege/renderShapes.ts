import Phaser from 'phaser'

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
  private root: Phaser.GameObjects.Container
  private images: Phaser.GameObjects.Image[] = []
  private bars: { back: Phaser.GameObjects.Image; fill: Phaser.GameObjects.NineSlice }[] = []
  private used = 0
  private barUsed = 0
  private visible = 0
  constructor(scene: Phaser.Scene, depth: number, capacity: number) {
    const key = shapeTexture(scene)
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
  image(frame: string, x: number, y: number, width: number, height: number, tint: number, alpha = 1, rotation = 0) {
    if (width <= 0 || height <= 0 || alpha <= 0) return
    const image = this.images[this.used++]
    if (!image) { this.used--; return }
    if (image.frame.name !== frame) image.setFrame(frame)
    image.setPosition(x, y).setDisplaySize(width, height).setTint(tint).setAlpha(alpha).setRotation(rotation)
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
