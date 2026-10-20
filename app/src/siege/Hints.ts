import Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'
import { ENEMIES, TOWERS, towerStats } from './data/config'
import type { Point } from './data/config'
import { reducedMotion } from './data/save'
import { Route, distanceSq } from './world'
import type { Enemy } from './world'

// Map-feature hints, presentation only: they read the simulation but never write it, draw no random numbers and keep
// nothing in the snapshot. One at a time, at most twice per feature per run, never again once that feature has been used
// (by either co-op player), and never while the tutorial holds input.
type Feature = { at: Point; image?: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Text; used: () => boolean; line: () => string | null; shows: number; quietUntil: number; done: boolean }
// Shows per feature; seconds shown at least and at most; seconds before the same hint, or any hint, may return; seconds between checks.
const SHOWS = 2, MIN = 3, MAX = 6, REPEAT = 45, GAP = 8, CHECK = .25
const onField = (e: Enemy) => e.active && !e.returning && e.x > 0 && e.x < 1920 && e.y > 0 && e.y < 1080
export class Hints {
  active: Feature | null = null
  readonly features: Feature[] = []
  private scene: SiegeScene
  private ring: Phaser.GameObjects.Image
  private hand: Phaser.GameObjects.Image
  private text: Phaser.GameObjects.Text
  private since = 0
  private checkAt = 0
  private quietUntil = 4 // not over the opening's path preview and perk reveal
  private x = 0
  private tapY = 0
  private width = 0
  constructor(scene: SiegeScene) {
    this.scene = scene
    const s = scene, geometry = s.options.assets.geometry, sw = geometry.switch
    const count = (test: (e: Enemy) => boolean) => s.enemies.reduce((n, e) => n + (onField(e) && test(e) ? 1 : 0), 0)
    for (const p of s.props) {
      const data = p.data, kind = data.kind!, reach = data.reach && new Route(data.reach)
      // Ground enemies on, or about to reach, the stretch the lamp or grate covers (useProp's own test, with some lead).
      const under = (e: Enemy, gap: number) => !!reach && !ENEMIES[e.kind].flying && distanceSq(e, data) < 400 ** 2 && reach.nearest(e.x, e.y).gap < gap
      const line = kind === 'lamp' ? () => count(e => under(e, 130)) >= 2 ? 'Drop the lamp on them' : null
        : kind === 'grate' ? () => count(e => !e.boss && !e.route && under(e, 120)) >= 2 ? 'Open the grate under them' : null
        // Raising it reroutes marchers before the fork and drops those on the span (Town Square's fork is at the map's edge).
        : kind === 'bridge' ? () => sw && count(e => !e.boss && e.path === sw.path && (e.distance < s.fork || under(e, 80))) >= 2 ? 'Raise the bridge' : null
        : kind === 'bonfire' ? () => {
          let hidden = 0, ghosts = 0
          for (const e of s.enemies) if (onField(e) && !e.visible) { hidden++; if (e.kind === 'ghost') ghosts++ }
          return ghosts ? 'Light the bonfire to reveal ghosts' : s.dark && hidden >= 3 ? 'Light the bonfire to see them' : null
        }
        // The cannon aims at ground enemies on its stretch of road (useProp's own test).
        : kind === 'cannon' ? () => count(e => !ENEMIES[e.kind].flying && e.visible && !!reach && reach.nearest(e.x, e.y).gap < 110) >= 2 ? 'Fire the candy cannon' : null
        : kind === 'bell' ? () => count(() => true) >= 10 || count(e => distanceSq(e, geometry.porch) < 300 ** 2) ? 'Ring the bell to freeze them' : null
        : () => { // shop: Sugar Rush costs 50 candy (useProp) and only helps while towers have targets
          if (s.localCandy < 50) return null
          const towers = s.towers.flatMap(t => t ? [{ t, r: towerStats(t).range ** 2 }] : [])
          return count(e => e.visible && towers.some(({ t, r }) => distanceSq(t, e) < r)) >= 5 ? 'Sugar rush: towers fire faster' : null
        }
      this.features.push({ at: data, image: p.image, label: p.label, used: () => p.used || p.cooldown > 0 || kind === 'bonfire' && s.bonfire > 0 || kind === 'bridge' && s.bridgeUp, line, shows: 0, quietUntil: 0, done: false })
    }
    // Radioactive Ridge: a tower on a boosted pad gets +20% range and damage (towerStats), the same words as the build ring.
    const boosted = geometry.pads.flatMap((pad, i) => pad.boost ? [i] : [])
    if (boosted.length) this.features.push({ at: geometry.pads[boosted[0]], used: () => boosted.some(i => s.towers[i]), line: () => s.localCandy >= TOWERS.egg.levels[0].cost ? 'Boosted pad: +20% range and damage' : null, shows: 0, quietUntil: 0, done: false })
    // Above the darkness (depth 1950), so they read on Rare Row.
    this.ring = s.art.image(0, 0, 'hero/ring').setDepth(1952).setTint(0xffd477).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.hand = s.art.image(0, 0, 'teach/hand').setOrigin(.5, .94).setDisplaySize(72, 98).setDepth(2796).setVisible(false)
    this.text = s.add.text(0, 0, '', { fontFamily: '"Patrick Hand", sans-serif', fontSize: '38px', color: '#35253d', backgroundColor: '#ffefd0', padding: { x: 14, y: 4 } }).setOrigin(.5, 0).setDepth(2797).setVisible(false)
  }
  update() {
    const s = this.scene, now = s.presentationTime
    if (s.ended || s.focus.active) { this.end(); return }
    if (now >= this.checkAt) {
      this.checkAt = now + CHECK
      for (const f of this.features) if (!f.done && f.used()) f.done = true
      const active = this.active, age = now - this.since
      if (active && (active.done || age >= MAX || age >= MIN && !active.line())) this.end()
      if (!this.active && now >= this.quietUntil) for (const f of this.features) {
        if (f.done || f.shows >= SHOWS || now < f.quietUntil) continue
        const line = f.line()
        if (line) { this.show(f, line); break }
      }
    }
    if (this.active) this.draw(now - this.since)
  }
  private show(f: Feature, line: string) {
    this.active = f; this.since = this.scene.presentationTime; f.shows++
    f.label?.setVisible(false) // the hint line takes the label's place under the prop; the hand points at its middle
    const { x, y } = f.at
    this.x = x; this.tapY = f.image ? y - f.image.displayHeight * .55 : y - 20; this.width = f.image ? Math.max(150, f.image.displayWidth * .9) : 190
    this.ring.setPosition(x, f.image ? y - 6 : y)
    this.text.setText(line)
    const half = this.text.width / 2
    this.text.setPosition(Phaser.Math.Clamp(x, half + 16, 1920 - half - 16), Math.min(f.image ? y + 20 : y + 46, 1072 - this.text.height))
  }
  private draw(age: number) {
    const motion = !reducedMotion(), pulse = motion ? age % 1.4 / 1.4 : .3, fade = Math.min(1, age / .25), size = 1 + pulse * .45
    this.ring.setDisplaySize(this.width * size, this.width * .38 * size).setAlpha(fade * (1 - pulse) * .9).setVisible(true)
    this.hand.setPosition(this.x, this.tapY - (motion ? Math.abs(Math.sin(age * 3)) * 16 : 0)).setAlpha(fade).setVisible(true)
    this.text.setAlpha(fade).setVisible(true)
  }
  private end() {
    const f = this.active
    if (!f) return
    const now = this.scene.presentationTime
    f.label?.setVisible(true); f.quietUntil = now + REPEAT; this.quietUntil = now + GAP; this.active = null
    this.ring.setVisible(false); this.hand.setVisible(false); this.text.setVisible(false)
  }
}
