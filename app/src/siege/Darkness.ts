import Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'

export type Light = { x: number; y: number; r: number }
// Keep the original soft mask and compositing, but upload at most once per four
// rendered frames (15 Hz at 60 fps). Bonfire fades only change image alpha.
const SCALE = .25, WIDTH = 2400, HEIGHT = 1080, LEFT = -240, ALPHA = .85
export class Darkness {
  private image: Phaser.GameObjects.Image
  private texture: Phaser.Textures.CanvasTexture
  private stamp: { image: CanvasImageSource; x: number; y: number; w: number; h: number }
  private previous = new Float32Array(128 * 3)
  private count = -1
  private frame = -4
  private fade = 0
  constructor(scene: SiegeScene) {
    const atlas = scene.options.assets.atlases.find(a => a.key === 'props3')!, f = atlas.data.frames['amb/light'].frame
    this.stamp = { image: atlas.image, x: f.x, y: f.y, w: f.w, h: f.h }
    this.texture = scene.textures.createCanvas('siege-dark', WIDTH * SCALE, HEIGHT * SCALE)!
    this.image = scene.add.image(LEFT + WIDTH / 2, HEIGHT / 2, 'siege-dark').setDisplaySize(WIDTH, HEIGHT).setDepth(1950).setAlpha(ALPHA)
  }
  update(lights: Light[], dt: number, bonfire: boolean) {
    this.fade = Phaser.Math.Clamp(this.fade + (bonfire ? dt : -dt) * 1.4, 0, 1)
    this.image.setVisible(this.fade < 1).setAlpha(ALPHA * (1 - this.fade))
    const frame = this.image.scene.game.loop.frame
    if (this.fade >= 1 || frame - this.frame < 4) return
    let changed = this.count !== lights.length
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i], at = i * 3, x = Math.round(l.x / 3), y = Math.round(l.y / 3), r = Math.round(l.r / 3)
      if (this.previous[at] !== x || this.previous[at + 1] !== y || this.previous[at + 2] !== r) changed = true
      this.previous[at] = x; this.previous[at + 1] = y; this.previous[at + 2] = r
    }
    if (!changed) return
    this.count = lights.length; this.frame = frame
    const ctx = this.texture.context, { image, x, y, w, h } = this.stamp
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, WIDTH * SCALE, HEIGHT * SCALE)
    ctx.globalCompositeOperation = 'destination-out'
    for (const light of lights) { const r = light.r * SCALE; ctx.drawImage(image, x, y, w, h, (light.x - LEFT) * SCALE - r, light.y * SCALE - r, r * 2, r * 2) }
    this.texture.refresh()
  }
}
