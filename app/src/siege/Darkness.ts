import Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'

export type Light = { x: number; y: number; r: number }
// Rare Row's darkness: a quarter-resolution black layer over the whole world (2400 × 1080), with soft cut-outs where there is light.
// The canvas is stretched with smoothing, so edges stay soft and the layer costs about 0.65 MB of texture.
const SCALE = .25, WIDTH = 2400, HEIGHT = 1080, LEFT = -240, ALPHA = .85
export class Darkness {
  private image: Phaser.GameObjects.Image
  private texture: Phaser.Textures.CanvasTexture
  private stamp: { image: CanvasImageSource; x: number; y: number; w: number; h: number }
  private fade = 0
  private key = ''
  private since = 1
  constructor(scene: SiegeScene) {
    const atlas = scene.options.assets.atlases.find(a => a.key === 'props3')!, f = atlas.data.frames['amb/light'].frame
    this.stamp = { image: atlas.image, x: f.x, y: f.y, w: f.w, h: f.h }
    this.texture = scene.textures.createCanvas('siege-dark', WIDTH * SCALE, HEIGHT * SCALE)!
    this.image = scene.add.image(LEFT + WIDTH / 2, HEIGHT / 2, 'siege-dark').setDisplaySize(WIDTH, HEIGHT).setDepth(1950)
  }
  // While the bonfire burns the whole layer fades out (`fade` 0 to 1); `lights` are the cut-outs in design pixels.
  update(lights: Light[], dt: number, bonfire: boolean) {
    this.fade = Phaser.Math.Clamp(this.fade + (bonfire ? dt : -dt) * 1.4, 0, 1)
    this.image.setVisible(this.fade < 1)
    // At 2× and 3× speed the world ticks several times per frame; the layer redraws at most 30 times a second.
    this.since += dt
    if (this.fade >= 1 || this.since < 1 / 30) return
    const key = `${this.fade.toFixed(2)}|${lights.map(l => `${Math.round(l.x / 3)},${Math.round(l.y / 3)},${Math.round(l.r / 3)}`).join(';')}`
    if (key === this.key) return
    this.key = key; this.since = 0
    const ctx = this.texture.context, { image, x, y, w, h } = this.stamp
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
    ctx.fillStyle = `rgba(0,0,0,${ALPHA * (1 - this.fade)})`; ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
    ctx.globalCompositeOperation = 'destination-out'
    for (const light of lights) { const r = light.r * SCALE; ctx.drawImage(image, x, y, w, h, (light.x - LEFT) * SCALE - r, light.y * SCALE - r, r * 2, r * 2) }
    this.texture.refresh()
  }
}
