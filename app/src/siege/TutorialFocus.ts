import type Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'
import type { Point } from './data/config'
import { TUTORIAL } from './data/level1'
import { reducedMotion } from './data/save'

export type FocusTarget = Point & { radius: number; world: boolean }
export class TutorialFocus {
  private shade: Phaser.GameObjects.Image
  private texture: Phaser.Textures.CanvasTexture
  private previous = ''
  private bounce = 0
  private resumeUntil = 0
  private scene: SiegeScene
  constructor(scene: SiegeScene) {
    this.scene = scene
    this.texture = scene.textures.createCanvas('tutorial-shade', 480, 270)!
    this.shade = scene.add.image(960, 540, 'tutorial-shade').setDisplaySize(1920, 1080).setDepth(3335)
    scene.hudLayer.add(this.shade)
  }
  get active() { return !this.scene.ended && this.scene.tutorialStep < TUTORIAL.length }
  get target() { return this.active ? this.scene.hud.tutorialTarget(TUTORIAL[this.scene.tutorialStep].target) : null }
  get gatheringCrowd() { return this.scene.tutorialStep === 4 && this.scene.enemies.filter(e => e.active && e.x > 110 && e.x < 1800).length < 2 }
  get waiting() {
    // Let the actual first wave enter the road before asking the player to bomb a crowd.
    if (this.gatheringCrowd) return false
    return this.active && this.scene.time.now >= this.resumeUntil
  }
  acted() { this.resumeUntil = this.scene.time.now + 350 }
  permits(point: Point, world: boolean) {
    const target = this.target
    if (this.gatheringCrowd && this.scene.mode === 'rain') return false
    return !this.active || !!target && target.world === world && Math.hypot(point.x - target.x, point.y - target.y) <= target.radius
  }
  input(point: Point, world: boolean) {
    const input = world ? point : { x: point.x / this.scene.renderScale, y: point.y / this.scene.renderScale }
    if (this.permits(input, world)) { this.acted(); return true }
    this.nudge(); return false
  }
  nudge() { this.bounce = this.scene.time.now; this.scene.hud.hand.setText('☟ HERE!'); if (this.target) this.scene.hud.nudgeTarget(this.target) }
  draw() {
    const target = this.target, s = this.scene
    this.shade.setVisible(!!target)
    s.hud.hand.setVisible(!!target)
    if (!target) return
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
    const elapsed = s.time.now - this.bounce, bounce = !reducedMotion() && elapsed < 500 ? Math.sin(elapsed / 500 * Math.PI * 3) * 14 : 0
    s.hud.hand.setPosition(Math.max(v.left + 80, Math.min(v.right - 80, point.x)), Math.max(v.top + 50, point.y - target.radius - 20 + bounce)).setFontSize(elapsed < 700 ? 42 : 64)
    if (elapsed >= 700) s.hud.hand.setText('☟')
  }
}
