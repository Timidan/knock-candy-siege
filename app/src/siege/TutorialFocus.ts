import Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'
import type { Point } from './data/config'
import { TUTORIAL } from './data/level1'
import { reducedMotion } from './data/save'

export type FocusTarget = Point & { radius: number; world: boolean }
export class TutorialFocus {
  private shade: Phaser.GameObjects.Image
  private texture: Phaser.Textures.CanvasTexture
  private previous = ''
  private ripple: Phaser.GameObjects.Image
  private gesture = ''
  private gestureAt = 0
  private from = { x: 0, y: 0 }
  private destination = { x: 0, y: 0 }
  private resumeUntil = 0
  private scene: SiegeScene
  constructor(scene: SiegeScene) {
    this.scene = scene
    this.texture = scene.textures.createCanvas('tutorial-shade', 480, 270)!
    this.shade = scene.add.image(960, 540, 'tutorial-shade').setDisplaySize(1920, 1080).setDepth(3335)
    this.ripple = scene.art.image(0, 0, 'combat/ring/0').setDepth(3336).setVisible(false)
    scene.hudLayer.add([this.shade, this.ripple])
  }
  get active() { return !this.scene.ended && this.scene.tutorialStep < TUTORIAL.length }
  get target() { return this.active ? this.scene.hud.tutorialTarget(TUTORIAL[this.scene.tutorialStep].target) : null }
  get waiting() { return this.active && this.scene.time.now >= this.resumeUntil }
  acted() { this.resumeUntil = this.scene.time.now + 350 }
  permits(point: Point, world: boolean) {
    const target = this.target
    return !this.active || !!target && target.world === world && Math.hypot(point.x - target.x, point.y - target.y) <= target.radius
  }
  input(point: Point, world: boolean) {
    const input = world ? point : { x: point.x / this.scene.renderScale, y: point.y / this.scene.renderScale }
    if (this.permits(input, world)) { this.acted(); return true }
    this.nudge(); return false
  }
  nudge() { this.gestureAt = this.scene.time.now - 380; if (this.target) this.scene.hud.nudgeTarget(this.target) }
  draw() {
    const target = this.target, s = this.scene
    this.shade.setVisible(!!target)
    s.hud.hand.setVisible(!!target)
    this.ripple.setVisible(false)
    if (!target) { this.gesture = ''; return }
    const point = target.world ? s.worldToView(target) : target, v = s.view
    const width = Math.ceil(v.width / 4), height = Math.ceil(v.height / 4)
    const key = `${Math.round(point.x)},${Math.round(point.y)},${target.radius},${width},${height}`
    if (key !== this.previous) {
      this.previous = key
      if (this.texture.width !== width || this.texture.height !== height) { this.texture.setSize(width, height); this.shade.setTexture('tutorial-shade') }
      this.shade.setPosition(v.width / 2, v.height / 2).setDisplaySize(v.width, v.height)
      const ctx = this.texture.context, x = point.x * width / v.width, y = point.y * height / v.height, r = target.radius / 4
      ctx.clearRect(0, 0, width, height); ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'destination-out'
      const glow = ctx.createRadialGradient(x, y, r, x, y, r + 10); glow.addColorStop(0, '#000'); glow.addColorStop(1, '#0000')
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'source-over'; this.texture.refresh()
    }
    const motion = !reducedMotion(), hand = s.hud.hand
    const next = { x: Phaser.Math.Clamp(point.x, v.left + 60, v.right - 60), y: Math.max(v.top + 160, point.y) }
    const gesture = `${s.tutorialStep}/${s.selected}/${s.previewTower}/${s.mode}/${s.heroSelected}`
    if (gesture !== this.gesture || Math.hypot(next.x - this.destination.x, next.y - this.destination.y) > 100) {
      this.from = this.gesture ? { x: hand.x, y: hand.y } : { x: next.x, y: next.y - 60 }
      this.destination = next; this.gesture = gesture; this.gestureAt = s.time.now
    }
    const elapsed = s.time.now - this.gestureAt, t = Math.max(0, elapsed - 380) % 1200
    let lift = 0, squash = 0
    if (motion) {
      if (t < 300) lift = 60 * (1 - Phaser.Math.Easing.Sine.In(t / 300))
      else if (t < 410) squash = Phaser.Math.Easing.Back.Out((t - 300) / 110)
      else if (t < 710) { lift = 60 * Phaser.Math.Easing.Sine.Out((t - 410) / 300); squash = 1 - (t - 410) / 300 }
      else lift = 60
    }
    if (motion && elapsed < 380) {
      const glide = Phaser.Math.Easing.Sine.InOut(elapsed / 380)
      hand.setPosition(Phaser.Math.Linear(this.from.x, next.x, glide), Phaser.Math.Linear(this.from.y, next.y - 60, glide))
    } else hand.setPosition(next.x, next.y - lift)
    hand.setDisplaySize(104 * (1 + squash * .14), 140 * (1 - squash * .18))
    if (motion && !s.settings.lite && s.quality.tier < 2) {
      const pulse = ((elapsed - 680 + 1200) % 1200) / 1200
      s.art.set(this.ripple, `combat/ring/${Math.min(3, Math.floor(pulse * 4))}`)
      this.ripple.setPosition(point.x, point.y).setDisplaySize(target.radius * (1.1 + pulse), target.radius * (1.1 + pulse)).setAlpha((1 - pulse) * .8).setVisible(true)
    }
  }
}
