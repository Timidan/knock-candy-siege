import Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'
import { EMOTES, SPELLS, TARGETING, TOWERS, SPECIALISATIONS, SPEC_COST, rankCost, CONSUMABLES } from './data/config'
import type { TowerKind, TrapKind, Specialisation, ConsumableKind } from './data/config'
import type { FocusTarget } from './TutorialFocus'
import { Rig } from './hero/Rig'
import { SHOP_ITEMS, CRYPTO_EMOTES } from './data/shop'
import { TUTORIAL } from './data/level1'
import { reducedMotion } from './data/save'
import { NIGHTS } from './data/endless'
import { bossLead, bossFraction } from './Boss'
import type { BossState } from './Boss'
import type { Enemy } from './world'
import { plate, circle, shapeTexture, setSweep, hudPlate, hudDisc, comicBanner } from './renderShapes'

type Button = { root: Phaser.GameObjects.Container; face: Phaser.GameObjects.Image; front: Phaser.GameObjects.Container; lip: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; sweep: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; size: number; enabled: boolean; pressed?: number; costLabel?: Phaser.GameObjects.Text; hot?: boolean }
const DISPLAY = '"Luckiest Guy", sans-serif'
const BODY = '"Patrick Hand", sans-serif'
// At rest, docked controls let the road and enemies show through: plates at .75,
// icons and numbers at .85 so they stay readable.
const REST = .85, PLATE = .75
const candyFormat = new Intl.NumberFormat('en-US')
// One reveal per level in this page session, including scene teardown/restarts; never touches the player's save.
const revealedLevels = new Set<number>()
type RuleMoment = { x: number; y: number; key: string; enemy: Enemy; generation: number; icon: string; copy: string; age: number }
export class Hud {
  scene: SiegeScene
  hand: Phaser.GameObjects.Image
  private radialRoot: Phaser.GameObjects.Container
  private wheel: Phaser.GameObjects.Container
  private ruleRoot: Phaser.GameObjects.Container
  private ruleIcon: Phaser.GameObjects.Image
  private ruleText: Phaser.GameObjects.Text
  private ruleQueue: RuleMoment[] = []
  private taughtRules = new Set<string>()
  private rule: RuleMoment | null = null
  private candyRoot: Phaser.GameObjects.Container
  private candyPlate: Phaser.GameObjects.Image
  private candy: Phaser.GameObjects.BitmapText
  private jars: Phaser.GameObjects.BitmapText
  private jarRoot: Phaser.GameObjects.Container
  private jarLoss: Phaser.GameObjects.Text
  private alarm: Phaser.GameObjects.Image
  private alarmAge = 1
  private wave: Phaser.GameObjects.Text
  private portrait: Button
  private ability: Button
  private ultimate: Button
  private ultimateRing: Phaser.GameObjects.Image
  private ultimateKey: Phaser.GameObjects.Text
  private ultimateReady = false
  private ultimateBurst = 1
  private keyHints = matchMedia('(any-pointer: fine)').matches
  private perks: Button[] = []
  private perkRoot: Phaser.GameObjects.Container
  private perkAge = -1
  private talentCard: Phaser.GameObjects.Container
  private talentTitle?: Phaser.GameObjects.Text
  private talentLevel = 0
  private talentTimer?: Phaser.Time.TimerEvent
  private talentTick = 0
  private talentBar?: Phaser.GameObjects.Image
  private health: Phaser.GameObjects.Image
  private pulsing: Button[] = []
  private top: Phaser.GameObjects.Container
  private bottom: Phaser.GameObjects.Container
  private topRight: Phaser.GameObjects.Container
  private bottomRight: Phaser.GameObjects.Container
  private entrances: Phaser.GameObjects.Container
  private rain: Button
  private boo: Button
  private emoteButton: Button
  private trapButtons: Record<TrapKind, Button>
  private itemButtons: Partial<Record<ConsumableKind, Button>> = {}
  private supplies: Phaser.GameObjects.Container
  private suppliesOpen = false
  private suppliesButton: Button
  private calls: (Button & { early: Phaser.GameObjects.Text; bounty: Phaser.GameObjects.Image })[] = []
  private speed: Button
  private tutorialCard: Phaser.GameObjects.Container
  private tutorialText: Phaser.GameObjects.Text
  private toastText: Phaser.GameObjects.Text
  private waveBanner: Phaser.GameObjects.Container
  private bannerText: Phaser.GameObjects.Text
  private preview: Phaser.GameObjects.Container
  private statsText: Phaser.GameObjects.Text
  private statsAt = 0
  private toastUntil = 0
  private toastValue = ''
  private toastPages: string[] = []
  private toastStart = 0
  private toastSeconds = 3.5
  private previewWave = -1
  private previewPath = -1
  private candyRoll = { value: 0 }
  private candyTarget = -1
  private radialButtons: { button: Button; cost: number; kind?: TowerKind }[] = []
  private buttons = new Set<Button>()
  private dancePreviews: { rig: Rig; scale: number; clip: string }[] = []
  private emotePage = 0
  // The boss bar and banner exist only while a boss does, so they never hold a dropped boss texture.
  private boss: { root: Phaser.GameObjects.Container; fill: Phaser.GameObjects.Image; width: number; shown: number } | null = null
  private bossBannerRoot: Phaser.GameObjects.Container | null = null
  private bossLetterbox: Phaser.GameObjects.Container
  private bossBars: Phaser.GameObjects.Image[]
  constructor(scene: SiegeScene) {
    this.scene = scene
    shapeTexture(scene)
    const release = (pointer?: Phaser.Input.Pointer) => this.releasePresses(pointer?.id)
    const cancel = () => this.releasePresses()
    scene.input.on('pointerup', release).on('pointerupoutside', release)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    scene.events.once('shutdown', () => {
      scene.input.off('pointerup', release).off('pointerupoutside', release)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    })
    const top = this.top = scene.add.container(0, 0).setDepth(3000)
    const bottom = this.bottom = scene.add.container(0, 0).setDepth(3000)
    this.topRight = scene.add.container(0, 0).setDepth(3000)
    this.bottomRight = scene.add.container(0, 0).setDepth(3000)
    bottom.add(hudPlate(scene, 640, 330, '#836EF9').setPosition(12, 746))
    this.bottomRight.add(hudPlate(scene, 478, 330, '#FF7A00').setPosition(1392, 746))
    this.supplies = scene.add.container(0, 0).setDepth(3210).setVisible(false)
    this.entrances = scene.add.container(0, 0).setDepth(3000)
    this.bossLetterbox = scene.add.container(0, 0).setDepth(3325).setVisible(false)
    this.bossBars = [0, 1].map(() => scene.add.image(0, 0, 'siege-shapes', 'white').setOrigin(0).setTint(0x120d1b))
    this.bossLetterbox.add(this.bossBars); scene.hudLayer.add(this.bossLetterbox)
    this.radialRoot = scene.add.container(0, 0).setDepth(3200)
    this.wheel = scene.add.container(0, 0).setDepth(3300)
    top.add(plate(scene, 24, 24, 620, 222, 28, 0x241b30, .96, 0xc7a2cb, 4).setAlpha(PLATE))
    this.jarRoot = scene.add.container(74, 82); top.add(this.jarRoot)
    this.jarRoot.add([plate(scene, -36, -38, 168, 76, 22, 0x513a52, .6, 0xc7a2cb, 2).setAlpha(PLATE), scene.art.image(0, -1, 'ui/jar').setDisplaySize(49, 60)])
    this.jars = scene.add.bitmapText(44, 0, 'siege-digits', '', 44).setOrigin(0, .5); this.jarRoot.add(this.jars)
    this.jarLoss = this.text(90, 53, '', 44, '#EF4444').setOrigin(.5).setStroke('#241b30', 5).setVisible(false); this.jarRoot.add(this.jarLoss)
    this.alarm = scene.art.image(0, 0, 'teach/alarm').setOrigin(0).setDepth(2990).setVisible(false)
    scene.hudLayer.add(this.alarm)
    this.candyRoot = scene.add.container(261, 82); top.add(this.candyRoot)
    this.candyPlate = plate(scene, -38, -38, 236, 76, 22, 0x513a52, .6, 0xffdf92, 2).setAlpha(PLATE)
    this.candyRoot.add([this.candyPlate, scene.art.image(0, 0, 'ui/candy').setDisplaySize(56, 56)])
    this.candy = scene.add.bitmapText(46, 0, 'siege-digits', '', 44).setOrigin(0, .5); this.candyRoot.add(this.candy)
    top.add(this.text(548, 53, 'WAVE', 34).setOrigin(.5))
    this.wave = this.text(548, 100, '', 40).setOrigin(.5).setResolution(2); top.add(this.wave)
    const daily = scene.options.mode === 'daily' ? scene.options.daily : null
    if (daily) {
      const night = NIGHTS[daily.theme], icon = this.button(top, 548, 182, night.icon, 78, () => this.toast(`Daily #${daily.number} · ${night.name}\n${night.text}`))
      icon.icon.setDisplaySize(52, 52)
    }
    this.speed = this.button(this.topRight, scene.options.onFullscreen ? 1560 : 1696, 88, 'ui/speed-1', 128, () => { scene.cancel(); scene.command({ type: 'speed' }); this.refresh() })
    if (scene.options.onFullscreen) {
      const full = this.button(this.topRight, 1696, 88, '', 128, () => scene.options.onFullscreen?.())
      full.root.setData('tutorialSkip', true); full.label.setText('⛶').setFontFamily(BODY).setFontSize(64)
    }
    const pause = this.button(this.topRight, 1832, 88, 'ui/pause', 128, () => { scene.cancel(); scene.pauseGame() })
    pause.root.setData('tutorialSkip', true)
    this.portrait = this.button(bottom, 100, 984, `hero/frame/${scene.options.home ? 'home' : 'guest'}`, 152, () => scene.selectHero(), false, false, '#FFD23F')
    const heads = scene.heads, ref = heads.head(scene.options.hero)
    this.portrait.icon.setTexture(ref.key, ref.frame).setOrigin(heads.pivot.x / 256, heads.pivot.y / 320).setPosition(0, -3).setDisplaySize(145, 181.25)
    this.portrait.root.add(plate(scene, -68, 80, 136, 22, 9, 0x171020, 1, 0xffdf9a, 3))
    this.health = plate(scene, -63, 85, 126, 12, 5, 0xffffff); this.portrait.root.add(this.health)
    // A legend's special and ultimate icons come from its own atlas.
    const legendArt = scene.hero.kit.legend ? `hero-${scene.hero.kit.costume}:` : ''
    this.ability = this.button(bottom, 266, 984, legendArt ? `${legendArt}special/2` : `kit/special/${scene.hero.kit.special}`, 132, () => { scene.cancel(); scene.heroAbility(); this.toast(scene.abilityName()) }, false, false, '#FFD23F')
    this.ultimate = this.button(bottom, 266, 830, legendArt ? `${legendArt}ultimate/3` : `kit/ultimate/${scene.hero.kit.ultimate}`, 132, () => { scene.cancel(); scene.command({ type: 'ultimate' }) }, false, false, '#FFD23F')
    this.ultimateRing = scene.art.image(0, 0, 'combat/ring/0').setTint(0xffd477).setVisible(false)
    this.ultimateKey = this.text(0, -47, 'R', 24).setOrigin(.5).setStroke('#241b30', 4).setVisible(this.keyHints)
    this.ultimate.root.addAt(this.ultimateRing, 0); this.ultimate.root.add(this.ultimateKey)
    const keyboardUsed = () => {
      this.keyHints = true; this.ultimateKey.setVisible(true)
      if (this.talentTitle?.active) this.talentTitle.setText(`LEVEL ${this.talentLevel} · PICK A TALENT [Z / X]`)
    }
    scene.input.keyboard?.on('keydown', keyboardUsed)
    scene.events.once('shutdown', () => scene.input.keyboard?.off('keydown', keyboardUsed))
    // The card pauses play, so it sits above popups and banners whose tweens freeze with it.
    this.talentCard = scene.add.container(960, 165).setDepth(3345).setVisible(false)
    this.perkRoot = scene.add.container(0, 0).setDepth(2995).setVisible(false)
    scene.hudLayer.add(this.perkRoot)
    if (revealedLevels.has(scene.options.level)) this.perkAge = 3.7
    this.perkRoot.add(hudPlate(scene, 920, 274, '#836EF9', true))
    this.perkRoot.add(this.text(30, 40, `CHOG #${scene.options.hero} · TRAITS ACTIVE`, 32, '#FFD23F'))
    // Compact copy describes the resolved kit, never a made-up NFT bonus.
    const shortEffects: Record<string, string> = {
      'rainbow-trail': 'Trail slows + hurts', 'sweet-tooth': 'Candy heals', honk: 'Every 10th hit confuses',
      pity: 'Nearby foes −10% speed', cheerful: 'Nearby towers +5% damage', royal: 'Nearby towers +15% damage',
      'degen-luck': '10% double candy', 'bucket-shield': 'Block first hit / wave', chill: 'Slow immune · soften hits',
      oddity: 'Unique combat effect', 'lucky-frog': 'One revive / level', 'snack-bag': '+1 jar / wave',
      'smoke-puff': 'Blind foes when hit', pump: 'Kill streak speed', dump: 'Slow nearby foes',
      heart: 'Regenerate health', multi: 'Random buff / wave', 'rare-tone': 'One status resistance', common: 'Your Chog’s colour',
    }
    for (const [i, slot] of (['passive', 'headgear', 'trinket', 'skin'] as const).entries()) {
      const family = scene.hero.kit[slot], info = scene.options.assets.kits.slots[slot][family]
      if (family === 'none') continue
      const button = this.button(top, 96 + i * 138, 180, `kit/${slot}/${family}`, 84, () => this.toast(`${info.name} · ${info.effect || 'Your portrait’s own colour'}`), false, false, '#836EF9')
      button.icon.setDisplaySize(48, 48); button.root.setVisible(this.perkAge >= 3.7)
      const n = this.perks.length, x = 28 + n % 2 * 442, y = 79 + Math.floor(n / 2) * 88
      const pill = scene.add.container(x, y)
      pill.add([plate(scene, 0, 0, 424, 76, 32, 0x2e1a47, 1, 0x836ef9, 2), scene.art.image(40, 38, `kit/${slot}/${family}`).setDisplaySize(50, 50)])
      pill.add(this.text(78, 23, info.name, 27, '#fff5d6'))
      const effect = this.text(78, 53, shortEffects[family] || info.effect, 28, '#d9d0ff', true)
      if (effect.width > 326) effect.setScale(326 / effect.width, 1)
      pill.add(effect); this.perkRoot.add(pill); this.perks.push(button)
    }
    this.rain = this.button(bottom, 416, 984, 'fx/candy-rain/1', 132, () => scene.selectSpell('rain'), false, false, '#836EF9')
    this.boo = this.button(bottom, 566, 984, 'fx/boo/2', 132, () => scene.selectSpell('boo'), false, false, '#836EF9')
    this.emoteButton = this.button(bottom, 100, 830, 'emote/lol/0', 124, () => scene.toggleEmotes(), false, false, '#FFD23F')
    this.trapButtons = {} as Record<TrapKind, Button>
    for (const [i, kind] of (['pumpkin', 'bowl', 'gum'] as const).entries()) {
      const b = this.button(this.bottomRight, 1488 + i * 152, 984, `trap/${kind}/0`, 132, p => scene.selectTrap(kind, scene.viewToWorld(p)))
      this.cost(b, scene.trapCost(kind)); this.trapButtons[kind] = b
    }
    this.suppliesButton = this.button(this.bottomRight, 1792, 824, 'item/pumpkin-bomb', 120, () => {
      const open = !this.suppliesOpen; scene.cancel(); this.suppliesOpen = open; this.supplies.setVisible(open)
      if (open) this.toast('Supplies · drag an item to the road, or select it and tap a target.'); this.refresh()
    }, false, false, '#22C55E')
    this.suppliesButton.root.add(this.text(0, -82, 'SUPPLIES', 30).setOrigin(.5).setStroke('#241b30', 5))
    this.supplies.add(plate(scene, -380, -80, 760, 172, 24, 0x241b30, .97, 0xc7a2cb, 3).setAlpha(PLATE))
    for (const [i, kind] of (Object.keys(CONSUMABLES) as ConsumableKind[]).entries()) {
      const b = this.button(this.supplies, (i - 2) * 146, 0, `item/${kind}`, 124, p => scene.selectConsumable(kind, scene.viewToWorld(p)), false, false, '#22C55E')
      this.cost(b, CONSUMABLES[kind].cost); this.itemButtons[kind] = b
    }
    this.preview = scene.add.container(0, 0).setDepth(3250).setVisible(false)
    const entrances = [...scene.routes, ...scene.flyRoutes]
    entrances.forEach(() => {
      const index = this.calls.length
      const b = this.button(this.entrances, 0, 0, 'ui/speed-1', 144, () => this.callPreview(index), false, false, '#22C55E')
      b.icon.setPosition(0, -20).setDisplaySize(64, 64)
      b.label.setPosition(0, 31).setFontSize(36)
      const early = this.text(0, -25, 'EARLY', 28, '#FFD23F').setOrigin(.5).setVisible(false)
      const bounty = scene.art.image(40, 24, 'ui/candy').setDisplaySize(34, 34).setVisible(false)
      b.root.add([early, bounty]); this.calls.push(Object.assign(b, { early, bounty }))
    })
    this.tutorialCard = scene.add.container(1120, 217).setDepth(3500)
    this.tutorialCard.add(plate(scene, -600, -75, 1200, 150, 22, 0xffefd0, .98, 0x251c2d, 4))
    this.tutorialText = this.text(-568, 0, '', 34, '#35253d', true).setWordWrapWidth(990)
    this.tutorialCard.add(this.tutorialText)
    const skip = this.button(this.tutorialCard, 524, 0, '', 120, () => scene.skipTutorial())
    skip.root.setData('tutorialSkip', true)
    skip.label.setText('SKIP').setFontSize(34)
    this.toastText = this.text(1030, 968, '', 34, '#35253d', true).setOrigin(.5).setAlign('center').setWordWrapWidth(710).setPadding(22, 12).setBackgroundColor('#ffefd0').setStroke('#ffefd0', 2).setDepth(3320).setVisible(false)
    this.waveBanner = scene.add.container(960, -130).setDepth(3320).setVisible(false)
    this.waveBanner.add(comicBanner(scene).setDisplaySize(768, 184))
    this.bannerText = this.text(0, -5, '', 40, '#FFD23F').setResolution(2).setOrigin(.5).setAlign('center').setWordWrapWidth(570)
    this.waveBanner.add(this.bannerText)
    // One reusable badge; rule events queue behind it, never stack over combat.
    this.ruleRoot = scene.add.container(0, 0).setDepth(3310).setVisible(false)
    this.ruleIcon = scene.art.image(-282, 0, 'enemy/pumpkin/walk/0').setDisplaySize(92, 92)
    this.ruleText = this.text(-210, 0, '', 34, '#fff5d6').setWordWrapWidth(508).setStroke('#1B0F2B', 3)
    this.ruleRoot.add([comicBanner(scene), circle(scene, 48, 0x2e1a47, 1, 0xffb800, 2).setPosition(-282, 0), this.ruleIcon, this.ruleText])
    scene.hudLayer.add(this.ruleRoot)
    this.hand = scene.art.image(0, 0, 'teach/hand').setOrigin(.5, .94).setDisplaySize(104, 140).setDepth(3350)
    this.statsText = this.text(1130, 24, '', 34, '#fff0d5', true).setOrigin(.5, 0).setWordWrapWidth(850).setAlign('center').setPadding(8).setBackgroundColor('#20162cdd').setDepth(3600).setVisible(new URLSearchParams(location.search).has('siegeStats'))
    this.pulsing = [this.ability, this.ultimate, this.rain, this.boo, ...this.calls]
    scene.hudLayer.add([top, bottom, this.topRight, this.bottomRight, this.entrances, this.radialRoot, this.wheel, this.talentCard, this.preview, this.supplies, this.tutorialCard, this.toastText, this.waveBanner, this.hand, this.statsText])
  }
  layout() {
    const s = this.scene, v = s.view, centre = (v.left + v.right) / 2
    this.top.setPosition(v.left, v.top)
    this.perkRoot.setPosition(centre - 460, v.top + 268)
    this.alarm.setDisplaySize(v.width, v.height)
    this.topRight.setPosition(v.right - 1920, v.top)
    this.bottom.setPosition(v.left, v.bottom - 1080 - 24)
    this.bottomRight.setPosition(v.right - 1920, v.bottom - 1080 - 24)
    this.supplies.setPosition(v.right - 560, v.bottom - 280)
    this.tutorialCard.setPosition(Math.min(v.right - 624, Math.max(v.left + 624, centre + 160)), v.top + 333)
    this.talentCard.setPosition(centre, v.top + 315)
    this.statsText.setPosition(centre, v.top + 24).setFontSize(26).setWordWrapWidth(Math.max(340, v.right - v.left - 1110))
    this.toastText.setPosition(centre, v.bottom - 112)
    this.waveBanner.x = centre
    if (this.boss) { const left = v.left + 690, right = v.right - 1920 + 1470; this.boss.root.setPosition((left + right) / 2, v.top + 72) }
    const camera = s.cameras.main
    ;[...s.routes, ...s.flyRoutes].forEach((route, i) => {
      const entry = route.points.find(p => p.x >= camera.midPoint.x - camera.width / camera.zoom / 2 && p.x <= camera.midPoint.x + camera.width / camera.zoom / 2 && p.y >= 0 && p.y <= 1080) ?? route.points[0]
      const p = s.worldToView(entry)
      // A road that enters low on the left would sit on the emote button, so such a call button waits above it.
      const x = Phaser.Math.Clamp(p.x, v.left + 84, v.right - 84)
      this.calls[i].root.setPosition(x, Phaser.Math.Clamp(p.y, v.top + (p.x < v.left + 700 ? 330 : 84), x < v.left + 190 ? v.bottom - 420 : v.bottom - 200))
    })
    if (s.selected >= 0) this.radial()
    if (s.emoteOpen) this.emotes()
    this.closePreview()
  }
  private text(x: number, y: number, value: string, size: number, color = '#fff0d5', body = false) {
    return this.scene.add.text(x, y, value, { fontFamily: body ? BODY : DISPLAY, fontSize: `${size}px`, color, resolution: 1, padding: { top: 6, bottom: 6 } }).setOrigin(0, .5)
  }
  porchAlarm(lost: number) {
    this.alarmAge = 0
    this.jarLoss.setText(`−${lost}`).setAlpha(1).setVisible(true)
    this.animateAlarm(0)
  }
  private animateAlarm(dt: number) {
    const s = this.scene, motion = !reducedMotion()
    this.alarmAge += dt
    const t = this.alarmAge
    this.alarm.setVisible(t < .35 && motion && !s.settings.lite && s.quality.tier < 2).setAlpha(.45 * Math.max(0, 1 - t / .35))
    this.jarRoot.x = 74 + (motion && s.settings.shake && t < .3 ? Math.sin(t * Math.PI * 40) * 8 : 0)
    this.jarLoss.setVisible(t < .8).setAlpha(Math.min(1, Math.max(0, (.8 - t) / .25)))
  }
  ruleMoment(key: string, enemy: Enemy, icon: string, copy: string) {
    if (this.taughtRules.has(key) || this.ruleQueue.some(rule => rule.key === key)) return
    this.ruleQueue.push({ x: enemy.x, y: enemy.y, key, enemy, generation: enemy.generation, icon, copy, age: 0 })
  }
  private animateRules(dt: number) {
    const s = this.scene, v = s.view, motion = !reducedMotion() && !s.settings.lite && s.quality.tier < 2
    if (!this.rule) {
      this.ruleQueue = this.ruleQueue.filter(rule => {
        const alive = rule.enemy.active && rule.enemy.generation === rule.generation
        if (alive) { rule.x = rule.enemy.x; rule.y = rule.enemy.y }
        return alive || rule.key !== 'trait'
      })
      const index = this.ruleQueue.findIndex(rule => { const p = s.worldToView(rule); return p.x >= v.left + 30 && p.x <= v.right - 30 && p.y >= v.top && p.y <= v.bottom })
      if (index < 0) return
      this.rule = this.ruleQueue.splice(index, 1)[0]; this.taughtRules.add(this.rule.key)
      s.art.set(this.ruleIcon, this.rule.key === 'trait' ? this.rule.icon : `enemy/${this.rule.enemy.kind}/walk/0`); this.ruleIcon.setDisplaySize(92, 92)
      this.ruleText.setText(this.rule.copy.replace(' · ', '!\n')).setScale(1); this.ruleText.setScale(Math.min(1, 104 / this.ruleText.height)); this.ruleRoot.setVisible(true); s.options.sfx.play('callout')
    }
    const rule = this.rule
    rule.age += dt
    // Keep the full reading time at the last position if the unit dies or its pool slot is reused.
    if (rule.enemy.active && rule.enemy.generation === rule.generation) { rule.x = rule.enemy.x; rule.y = rule.enemy.y }
    const p = s.worldToView(rule)
    this.ruleRoot.setPosition(Phaser.Math.Clamp(p.x, v.left + 376, v.right - 376), Phaser.Math.Clamp(p.y - 180, v.top + 285, v.bottom - 240))
    const enter = Math.min(1, rule.age / .22), exit = Math.max(0, (rule.age - 2.42) / .18)
    this.ruleRoot.setScale(motion ? Phaser.Math.Easing.Back.Out(enter) * (1 - exit * .15) : 1).setAlpha(Math.min(1, enter * 3) * (1 - exit))
    if (rule.age >= 2.6) { this.ruleRoot.setVisible(false); this.rule = null }
  }
  candyTargetPosition() { const p = this.candyRoot.getWorldTransformMatrix(); return { x: p.tx, y: p.ty } }
  private animatePerks(dt: number) {
    const s = this.scene
    if (this.perkAge >= 3.7) return
    if (this.perkAge < 0) {
      if (s.focus.active || this.tutorialCard.visible || s.paused || this.talentCard.visible || this.bossBannerRoot) return
      revealedLevels.add(s.options.level); this.perkAge = 0
    }
    this.perkAge += dt
    const age = this.perkAge, motion = !reducedMotion() && !s.settings.lite && s.quality.tier < 2
    const enter = Phaser.Math.Clamp(age / .35, 0, 1), exit = Phaser.Math.Clamp((age - 3.35) / .35, 0, 1)
    const x = (s.view.left + s.view.right) / 2 - 460, y = s.view.top + 268
    const portrait = this.portrait.root.getWorldTransformMatrix()
    const shrink = motion ? Phaser.Math.Easing.Cubic.InOut(exit) : 0, scale = 1 - shrink * .94
    this.perkRoot.setVisible(age < 3.7).setAlpha(Math.min(1, enter * 4) * (1 - Math.max(0, (exit - .7) / .3)))
      .setScale(motion ? (.86 + .14 * Phaser.Math.Easing.Back.Out(enter)) * scale : 1)
      .setPosition(Phaser.Math.Linear(x, portrait.tx - 460 * .06, shrink), Phaser.Math.Linear(y, portrait.ty - 137 * .06, shrink) - (motion ? (1 - Phaser.Math.Easing.Back.Out(enter)) * 46 : 0))
    if (age >= 3.7) for (const button of this.perks) button.root.setVisible(true)
  }
  candyArrived() {
    const s = this.scene
    s.options.sfx.play('candy-arrive')
    s.tweens.killTweensOf([this.candyRoot, this.candyPlate])
    this.candyRoot.setScale(1); this.candyPlate.setTint(0xffe39a).setAlpha(1)
    s.tweens.add({ targets: this.candyPlate, alpha: PLATE, duration: 240, onComplete: () => this.candyPlate.clearTint() })
    if (!reducedMotion()) s.tweens.add({ targets: this.candyRoot, scaleX: 1.12, scaleY: .88, duration: 90, yoyo: true, ease: 'Sine.Out' })
  }
  hide() { this.scene.hudLayer.setVisible(false) }
  coversControl(x: number, y: number, radius: number) {
    for (const b of this.buttons) {
      if (!b.root.visible || !b.root.parentContainer?.visible) continue
      const p = b.root.getWorldTransformMatrix()
      if (Math.hypot(p.tx - x, p.ty - y) < b.size / 2 + radius) return true
    }
    return false
  }
  nudgeTarget(target: FocusTarget) {
    if (reducedMotion()) return
    const button = target.world ? undefined : [...this.buttons].find(b => { const p = b.root.getWorldTransformMatrix(); return Math.hypot(p.tx - target.x, p.ty - target.y) < 4 })
    const object = button?.root ?? (this.scene.tutorialStep === 0 ? this.scene.pads[0] : null)
    if (!object) return
    this.scene.tweens.killTweensOf(object)
    const x = button ? 1 : 132 / (object as Phaser.GameObjects.Image).width, y = button ? 1 : 66 / (object as Phaser.GameObjects.Image).height
    object.setScale(x, y)
    this.scene.tweens.add({ targets: object, scaleX: x * 1.1, scaleY: y * 1.1, duration: 120, yoyo: true, ease: 'Sine.Out' })
  }
  private button(parent: Phaser.GameObjects.Container, x: number, y: number, frame: string, size: number, action: (pointer: Phaser.Input.Pointer) => void, slot = false, previewUnavailable = false, accent = '#FF7A00'): Button {
    const s = this.scene, root = s.add.container(x, y), front = s.add.container(0, 0)
    const lip = circle(s, size / 2 - 4, Phaser.Display.Color.HexStringToColor(accent).color, .8, 0x10091b, 3).setPosition(0, 12)
    const glow = circle(s, size / 2 + 3, 0xffffff, 0, 0xffffff, 6).setTint(0xffdf92).setVisible(false)
    const sweep = s.add.image(0, 0, 'siege-shapes', 'white').setVisible(false)
    const icon = s.art.image(0, 0, frame || 'ui/candy').setVisible(!!frame)
    const scale = size * .65 / Math.max(icon.width, icon.height); icon.setScale(scale)
    const label = this.text(0, 0, '', 40, slot ? '#35253d' : '#fff5d6').setResolution(2).setOrigin(.5).setAlign('center')
    const face = (slot ? s.art.image(0, 0, 'ui/radial-slot') : hudDisc(s, size, accent)).setDisplaySize(size, size)
    front.add([face, icon, sweep, label]); root.add([glow, lip, front]); parent.add(root)
    const hitSize = Math.max(120, size)
    root.setSize(hitSize, hitSize).setInteractive(new Phaser.Geom.Circle(hitSize / 2, hitSize / 2, hitSize / 2), Phaser.Geom.Circle.Contains)
    const b: Button = { root, face, front, lip, icon, label, sweep, glow, size, enabled: true }
    this.buttons.add(b); root.once('destroy', () => this.buttons.delete(b))
    // Touch fires over on press and out on release, so this also lights a pressed control.
    root.on('pointerover', () => { b.hot = true; this.shade(b) }).on('pointerout', () => { b.hot = false; this.shade(b) })
    root.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      if (!root.getData('tutorialSkip') && s.focus && !s.focus.input(p, false)) return
      if ((!b.enabled && !previewUnavailable) || s.paused || s.ended) return
      void s.options.sfx.unlock()
      action(p)
      // Actions still run on down (including trap drag). Lower the face over its lip; the hit area stays fixed.
      if (root.active && root.input?.enabled && b.enabled && !s.paused && !s.ended) {
        b.pressed = p.id
        front.y = 10; face.setDisplaySize(size, size)
        this.shade(b)
      }
    })
    return b
  }
  releasePresses(pointerId?: number) {
    for (const b of this.buttons) if (b.pressed !== undefined && (pointerId === undefined || b.pressed === pointerId)) this.release(b)
  }
  private release(b: Button) {
    b.pressed = undefined; b.front.y = 0; b.face.setDisplaySize(b.size, b.size); this.shade(b)
  }
  private enabled(b: Button, enabled: boolean) {
    if (!enabled && b.pressed !== undefined) this.release(b)
    b.enabled = enabled; b.root.setAlpha(enabled ? 1 : .65); b.icon.setTint(enabled ? 0xffffff : 0x777777)
  }
  private shade(b: Button) {
    const s = this.scene, matrix = b.root.getWorldTransformMatrix(), skip = b.root.getData('tutorialSkip')
    const allowed = skip || !s.focus || s.focus.permits({ x: matrix.tx, y: matrix.ty }, false)
    // During the tutorial the only allowed control (besides skip/pause) is the current step's target, so it stays lit.
    // Disabled (.65) and tutorial-blocked (.38) controls keep their existing look.
    const rest = allowed && b.enabled && (skip || !s.focus?.active) && !this.lit(b)
    b.root.setAlpha(rest ? REST : allowed ? b.enabled ? 1 : .65 : .38)
    if (this.bossBannerRoot) b.root.setAlpha(.35)
    b.face.setAlpha(rest ? PLATE / REST : 1); b.lip.setAlpha(rest ? PLATE / REST : 1)
    b.icon.setTint(allowed && b.enabled ? 0xffffff : 0x777777)
  }
  // Open popups and the tutorial card are in use; docked controls light up when hovered, pressed or selected.
  private lit(b: Button) {
    const s = this.scene, m = s.mode, parent = b.root.parentContainer
    if (b.pressed !== undefined || b.hot || parent === this.radialRoot || parent === this.wheel || parent === this.tutorialCard) return true
    const chosen = m === 'rain' ? this.rain : m === 'boo' ? this.boo : m ? this.trapButtons[m as TrapKind] ?? this.itemButtons[m as ConsumableKind] : undefined
    return b === chosen || b === this.calls[this.previewPath] || b === this.portrait && s.heroSelected || b === this.emoteButton && s.emoteOpen || b === this.suppliesButton && this.suppliesOpen
  }
  private cost(b: Button, value: number, refund = false) {
    if (b.costLabel) { b.costLabel.setText(`${refund ? '+' : ''}${value}`); return }
    const y = b.size / 2 - 8, width = refund ? 136 : 114
    b.root.add(plate(this.scene, -width / 2, y - 22, width, 44, 16, 0xffdf95, 1, 0x34233b, 3))
    b.root.add(this.scene.art.image(-width / 2 + 22, y, 'ui/candy').setDisplaySize(28, 28))
    b.costLabel = this.text(16, y, `${refund ? '+' : ''}${value}`, 34, '#35253d').setResolution(2).setOrigin(.5)
    b.root.add(b.costLabel)
  }
  private open(panel: Phaser.GameObjects.Container) {
    this.scene.tweens.killTweensOf(panel); panel.setVisible(true).setAlpha(1)
    if (!reducedMotion()) { const y = panel.y; panel.y += 18; panel.alpha = 0; this.scene.tweens.add({ targets: panel, y, alpha: 1, duration: 160, ease: 'Cubic.Out' }) }
  }
  private close(panel: Phaser.GameObjects.Container) {
    this.scene.tweens.killTweensOf(panel)
    for (const b of this.buttons) if (b.root.parentContainer === panel && b.pressed !== undefined) this.release(b)
    for (const child of panel.list) child.disableInteractive()
    if (!panel.visible) return
    if (reducedMotion()) { panel.setVisible(false); return }
    this.scene.tweens.add({ targets: panel, y: panel.y + 18, alpha: 0, duration: 120, onComplete: () => panel.setVisible(false) })
  }
  refresh() {
    const s = this.scene, factor = s.hero.spellFactor
    if (s.ended) return
    if (this.candyTarget !== s.candy) {
      const first = this.candyTarget < 0; this.candyTarget = s.candy
      s.tweens.killTweensOf(this.candyRoll)
      if (reducedMotion() || first) this.candyRoll.value = s.candy
      else s.tweens.add({ targets: this.candyRoll, value: s.candy, duration: 300, ease: 'Cubic.Out' })
    }
    if (reducedMotion() || this.candy.text === '') this.candy.setText(candyFormat.format(Math.round(this.candyRoll.value))).setScale(1)
    this.candy.setScale(Math.min(1, 150 / this.candy.getTextBounds().local.width))
    this.jars.setText(String(s.jars)); this.wave.setText(s.level.endless ? String(s.wave) : `${s.wave}/${s.waveCount}`)
    s.art.set(this.speed.icon, `ui/speed-${s.speed}`)
    this.enabled(this.portrait, s.hero.hp > 0)
    this.portrait.label.setText(`Lv ${s.hero.level}`).setPosition(0, 57).setFontSize(34).setStroke('#241b30', 5)
    if (this.portrait.label.style.color !== '#fff0d5') this.portrait.label.setColor('#fff0d5')
    this.cooldown(this.ability, s.hero.hp <= 0 ? s.hero.respawn : s.hero.ability, s.hero.hp <= 0 ? 12 : s.hero.abilityTotal)
    this.cooldown(this.ultimate, 100 - s.hero.charge, 100)
    const ready = s.hero.charge >= 100
    if (ready && !this.ultimateReady) this.ultimateBurst = 0
    this.ultimateReady = ready
    this.ultimate.label.setText(ready ? 'READY' : `${Math.floor(s.hero.charge)}%`).setFontSize(ready ? 30 : 34).setPosition(0, ready ? 32 : 0)
    this.enabled(this.ultimate, s.hero.charge >= 100 && s.hero.hp > 0)
    const health = Phaser.Math.Clamp(s.hero.hp / s.hero.maxHp, 0, 1)
    this.health.setScale(health, 1).setTint(health < .3 ? 0xff876e : 0xa7d987).setVisible(health > 0)
    this.talents()
    // refresh() keeps running while paused, so the countdown drains at the HUD's 8 Hz rate.
    if (this.talentTimer && this.talentBar) this.talentBar.scaleX = 1 - this.talentTimer.getProgress()
    if (this.talentTimer) { const left = Math.ceil(this.talentTimer.getRemainingSeconds()); if (left <= 3 && left !== this.talentTick) { this.talentTick = left; s.options.sfx.play('talent-tick') } }
    this.cooldown(this.rain, s.spellCooldown.rain, SPELLS.rain.cooldown * factor)
    this.cooldown(this.boo, s.spellCooldown.boo, SPELLS.boo.cooldown * factor)
    for (const kind of ['pumpkin', 'bowl', 'gum'] as const) { this.enabled(this.trapButtons[kind], s.candy >= s.trapCost(kind)); this.cost(this.trapButtons[kind], s.trapCost(kind)); if (kind === 'pumpkin' && s.freePumpkin > 0) this.trapButtons[kind].costLabel?.setText('FREE').setFontSize(26); else this.trapButtons[kind].costLabel?.setFontSize(34) }
    this.calls.forEach((b, path) => {
      const wave = s.waveAt(s.wave)
      b.root.setVisible(!this.bossBannerRoot && !!wave && wave.groups.some(g => !g.edge && s.entrancePath(g.type, g.path ?? 0) === path))
      this.enabled(b, !!wave && s.tutorialStep > 0)
      const early = s.wave > 0 && s.countdown > 0
      b.early.setVisible(early); b.bounty.setVisible(early); b.icon.setVisible(!early)
      b.label.setText(s.wave === 0 ? 'GO' : `+${Math.ceil(Math.max(0, s.countdown) * 1.5)}`)
      b.label.setPosition(early ? -17 : 0, early ? 24 : 31)
      b.sweep.setVisible(!!s.wave && !!wave).setScale(1)
      if (s.wave && wave) setSweep(s, b.sweep, s.countdown / wave.countdown, b.size / 2 - 3, 6)
    })
    const step = TUTORIAL[s.tutorialStep]
    if (step) {
      const copy = s.tutorialStep === 0 ? (s.selected !== 0 ? step.text : s.previewTower === 'egg' ? 'Tap again to build' : 'Tap Egg Stand') : `${step.title}\n${step.text}`
      this.tutorialCard.setVisible(true); this.tutorialText.setText(`${s.tutorialStep + 1}/7  ${copy}`)
    }
    else if (this.tutorialCard.visible && this.tutorialCard.alpha === 1) this.close(this.tutorialCard)
    for (const item of this.radialButtons) this.enabled(item.button, s.candy >= item.cost && (!item.kind || !s.towerLock(item.kind)))
    for (const [kind, b] of Object.entries(this.itemButtons) as [ConsumableKind, Button][]) { this.cooldown(b, s.itemCooldown[kind], CONSUMABLES[kind].cooldown); this.enabled(b, s.itemCooldown[kind] <= 0 && s.candy >= CONSUMABLES[kind].cost) }
    this.suppliesButton.root.setVisible(!s.focus?.active)
    this.suppliesButton.glow.setVisible(this.suppliesOpen)
    for (const button of this.buttons) this.shade(button)
    if (this.previewWave !== s.wave) this.closePreview()
    if (this.statsText.visible && s.time.now >= this.statsAt) { this.statsAt = s.time.now + 500; const stats = s.stats(); this.statsText.setText(`${stats.fps} FPS · Q${stats.quality} · ${stats.enemies} foes · ${stats.objects} objects · ${s.game.renderer.type === Phaser.WEBGL ? stats.draws + ' draws · GPU tex ≈' + stats.textureMB + ' MB' : 'Canvas'}`) }
  }
  private cooldown(b: Button, remaining: number, total: number) {
    this.enabled(b, remaining <= 0)
    b.label.setText(remaining > 0 ? String(Math.ceil(remaining)) : '').setStroke('#241b30', 5)
    if (b.label.style.color !== '#fff0d5') b.label.setColor('#fff0d5')
    b.sweep.setVisible(remaining > 0)
    if (remaining > 0) setSweep(this.scene, b.sweep, remaining / total, b.size / 2 - 7)
  }
  radial() {
    const s = this.scene
    this.radialButtons = []
    if (s.selected < 0) { this.close(this.radialRoot); return }
    s.tweens.killTweensOf(this.radialRoot); this.radialRoot.removeAll(true)
    const pad = s.worldToView(s.pads[s.selected]), tower = s.towers[s.selected], v = s.view
    this.radialRoot.setPosition(Phaser.Math.Clamp(pad.x, v.left + 300, v.right - 300), Phaser.Math.Clamp(pad.y, v.top + 390, v.bottom - 340))
    this.radialRoot.add(s.add.graphics().lineStyle(4, 0xffdf95, .7).lineBetween(0, 0, pad.x - this.radialRoot.x, pad.y - this.radialRoot.y))
    this.radialRoot.add(s.art.image(0, 0, 'ui/radial-ring').setDisplaySize(360, 360))
    const close = this.button(this.radialRoot, 0, 0, '', 124, () => { if (tower) s.cancel(); else { s.buildPage = 1 - s.buildPage; s.previewTower = null; this.radial() } }); close.label.setText(tower ? '×' : `${s.buildPage + 1}/2\n${s.buildPage ? '← BACK' : 'MORE →'}`).setFontSize(tower ? 52 : 30)
    if (!tower) {
      const kinds = (Object.keys(TOWERS) as TowerKind[]).slice(s.buildPage ? 4 : 0, s.buildPage ? 9 : 4)
      for (const [i, kind] of kinds.entries()) {
        const angle = Math.PI + i * Math.PI * 2 / kinds.length, config = TOWERS[kind], locked = s.towerLock(kind)
        const b = this.button(this.radialRoot, Math.cos(angle) * (s.buildPage ? 196 : 180), Math.sin(angle) * (s.buildPage ? 196 : 180), `tower/${kind}/1`, 136, () => {
          if (locked) { this.toast(`${config.name} · ${config.description}\n${locked}`); return }
          if (s.previewTower === kind) s.command({ type: 'build', pad: s.selected, kind })
          else {
            s.previewTower = kind
            for (const item of this.radialButtons) { item.button.glow.setVisible(false); item.button.label.setText(item.kind && s.towerLock(item.kind) ? 'LOCKED' : '') }
            b.glow.setVisible(true).setTint(0xffe296)
            this.refresh()
            b.label.setText('✓').setPosition(43, -43).setFontFamily(BODY).setColor('#ffe296').setStroke('#241b30', 4)
            this.toast(`${config.name} · ${config.description}\n${config.levels[0].cost} candy · Tap again to build${s.options.assets.geometry.pads[s.selected]?.boost ? '\nBoosted pad: +20% range and damage' : ''}`)
          }
        }, true, true)
        this.cost(b, config.levels[0].cost)
        if (locked) b.label.setText('LOCKED').setFontSize(22).setPosition(0, -42).setColor('#fff0d5').setStroke('#241b30', 5)
        this.radialButtons.push({ button: b, cost: config.levels[0].cost, kind })
      }
    } else {
      const next = tower.spec ? tower.rank < 2 ? { cost: rankCost(tower.rank) } : null : TOWERS[tower.kind].levels[tower.level]
      if (tower.level === 3 && !tower.spec && TOWERS[tower.kind].specialisations.length > 0) {
        Object.entries(SPECIALISATIONS).filter(([, v]) => v.kind === tower.kind).forEach(([key, spec], i) => {
          const b = this.button(this.radialRoot, i ? 164 : -164, -140, `tower/${tower.kind}/${key}`, 136, () => { if (s.previewSpec === key) s.command({ type: 'specialise', pad: s.selected, spec: key as Specialisation }); else { s.previewSpec = key as Specialisation; this.toast(`${spec.name} · ${spec.description}\n${SPEC_COST} candy · Tap again to choose`) } }, true, true)
          this.cost(b, SPEC_COST); this.radialButtons.push({ button: b, cost: SPEC_COST })
          b.root.add(this.text(0, -106, spec.name.replace(' ', '\n'), 30).setOrigin(.5).setAlign('center').setStroke('#241b30', 5))
        })
      } else {
        const up = this.button(this.radialRoot, -156, -88, s.towerFrame(tower.kind, Math.min(3, tower.level + 1), tower.spec), 136, () => s.command({ type: 'upgrade', pad: s.selected }), true)
        if (next) this.cost(up, next.cost)
        up.root.add(this.text(0, -96, next ? tower.spec ? `RANK ${tower.rank + 1}` : 'UPGRADE' : 'MAX', 34).setOrigin(.5).setStroke('#241b30', 5))
        this.radialButtons.push({ button: up, cost: next?.cost ?? Infinity })
      }
      const sell = this.button(this.radialRoot, 156, tower.level === 3 && !tower.spec && TOWERS[tower.kind].specialisations.length > 0 ? 80 : -88, 'ui/knock-coin', 136, () => s.command({ type: 'sell', pad: s.selected }), true)
      this.cost(sell, Math.floor(tower.spent * .7), true)
      sell.root.add(this.text(0, -96, 'SELL', 34).setOrigin(.5).setStroke('#241b30', 5))
      const target = this.button(this.radialRoot, 0, 180, '', 144, () => { s.command({ type: 'target', pad: s.selected, targeting: TARGETING[(TARGETING.indexOf(tower.targeting) + 1) % TARGETING.length] }) }, true)
      target.label.setText(`↻\n${tower.targeting}`).setFontFamily(BODY).setFontSize(34)
    }
    this.open(this.radialRoot); this.refresh()
  }
  closeSupplies() { this.suppliesOpen = false; this.supplies.setVisible(false) }
  private callPreview(path: number) {
    const s = this.scene
    if (this.previewPath === path && this.previewWave === s.wave) { s.cancel(); s.command({ type: 'wave' }); return }
    s.cancel(); this.preview.removeAll(true); this.previewPath = path; this.previewWave = s.wave
    const wave = s.waveAt(s.wave)!, counts = new Map<string, number>()
    for (const group of wave.groups) if (!group.edge && s.entrancePath(group.type, group.path ?? 0) === path) counts.set(group.type, (counts.get(group.type) ?? 0) + group.count * (group.type === 'skeleton' ? 5 : 1))
    const extra = [wave.witching ? 'Witching Hour: swarms from every edge' : '', wave.boss ? `Boss: ${wave.boss.id === 'pumpkin' ? 'The Great Pumpkin' : s.options.assets.legends.legends[String(wave.boss.id)].name}` : ''].filter(Boolean)
    const button = this.calls[path], width = Math.max(extra.length ? 560 : 380, counts.size * 112 + 44), tall = extra.length * 40
    const v = s.view
    this.preview.setPosition(Phaser.Math.Clamp(button.root.x + width / 2 + 90, v.left + width / 2 + 24, v.right - 24 - width / 2), Phaser.Math.Clamp(button.root.y, v.top + 340, v.bottom - 300))
    this.preview.add(plate(s, -width / 2, -140 - tall / 2, width, 280 + tall, 22, 0xffefd0, 1, 0x241b30, 4))
    this.preview.add(this.text(0, -99 - tall / 2, `WAVE ${s.wave + 1}`, 38, '#35253d').setOrigin(.5))
    let i = 0
    for (const [kind, count] of counts) {
      const x = (i++ - (counts.size - 1) / 2) * 112
      this.preview.add(s.art.image(x, -10 - tall / 2, `enemy/${kind}/walk/0`).setDisplaySize(88, 88))
      this.preview.add(this.text(x, 48 - tall / 2, `×${count}`, 36, '#35253d').setOrigin(.5))
    }
    extra.forEach((line, n) => this.preview.add(this.text(0, 88 - tall / 2 + n * 40, line, 32, n ? '#8a3a28' : '#5b3a8a', true).setOrigin(.5)))
    this.preview.add(this.text(0, 104 + tall / 2, 'Tap the entrance again', 34, '#35253d', true).setOrigin(.5))
    this.open(this.preview)
  }
  get wavePreviewOpen() { return this.previewPath >= 0 }
  closePreview() { this.previewPath = -1; this.previewWave = this.scene.wave; this.close(this.preview) }
  emotes() {
    const s = this.scene
    this.dancePreviews = []
    if (!s.emoteOpen) { this.close(this.wheel); return }
    this.wheel.removeAll(true)
    const hero = s.worldToView(s.hero), v = s.view
    this.wheel.setPosition(Phaser.Math.Clamp(hero.x, v.left + 310, v.right - 310), Phaser.Math.Clamp(hero.y - 80, v.top + 350, v.bottom - 460))
    this.wheel.add(circle(s, 280, 0x2e203c, .97, 0xf3d3e1, 4))
    const ownedDances = SHOP_ITEMS.filter(i => i.kind === 'dance' && s.options.owned.includes(i.id)).map(i => i.key)
    const pages: string[][] = [[...EMOTES], ownedDances, s.options.owned.includes(22) ? CRYPTO_EMOTES : []]
    const names = pages[this.emotePage]
    names.forEach((name, i) => {
      const angle = i * Math.PI / 4 - Math.PI / 2, dance = s.options.assets.dances[name]
      const b = this.button(this.wheel, Math.cos(angle) * 198, Math.sin(angle) * 198, dance ? '' : `emote/${name}/0`, 128, () => s.command({ type: 'emote', name }))
      if (dance) {
        const rig = new Rig(s, s.art, s.options.assets, s.hero.kit, () => {}, s.options.costume || s.hero.kit.costume)
        rig.play('idle'); rig.dance(name); b.root.add(rig.root); rig.root.setPosition(0, 37).setScale(.78)
        this.dancePreviews.push({ rig, scale: .78, clip: dance.clip })
        b.root.add(s.art.image(39, -40, `emote/${dance.emote ?? 'gg'}/0`).setDisplaySize(53, 40))
      }
      b.root.add(this.text(0, 76, dance?.name ?? name.toUpperCase(), 26).setOrigin(.5).setStroke('#241b30', 4))
    })
    if (!names.length) this.wheel.add(this.text(0, -175, 'Find your next move\nin the shop', 32).setOrigin(.5).setAlign('center'))
    const signature = this.button(this.wheel, 0, 0, '', 160, () => s.command({ type: 'emote', name: 'signature' }))
    const rig = new Rig(s, s.art, s.options.assets, s.hero.kit, () => {}, s.options.costume || s.hero.kit.costume)
    rig.play('idle'); rig.emote(); signature.root.add(rig.root); rig.root.setPosition(0, 36).setScale(.9)
    this.dancePreviews.push({ rig, scale: .9, clip: s.options.assets.dances[s.hero.kit.emote].clip })
    signature.label.setText('Signature').setFontFamily(BODY).setFontSize(30).setPosition(0, 57).setColor('#ffe3ae').setStroke('#241b30', 4)
    signature.front.remove(signature.label); signature.root.add(signature.label)
    const page = this.button(this.wheel, -90, 370, '', 128, () => { this.emotePage = (this.emotePage + 1) % 3; this.emotes() })
    page.label.setText(`${this.emotePage + 1}/3 →`).setFontSize(30)
    const shop = this.button(this.wheel, 90, 370, 'ui/knock-coin', 128, () => { s.cancel(); s.setPaused(true); s.options.onShop() })
    shop.label.setText('SHOP').setFontSize(30).setPosition(0, 48)
    this.open(this.wheel)
  }
  private talents() {
    const s = this.scene, hero = s.hero, level = s.tutorialStep < TUTORIAL.length ? 0 : hero.talentLevels[0] ?? 0
    // While a menu, an enemy intro or the shop holds the pause, a new card waits, so its countdown never resumes play behind them.
    // It also waits for the finished tutorial's card and spotlight to clear; pausing would freeze them on screen.
    if (level === this.talentLevel || level && (s.paused || this.tutorialCard.visible) && !this.talentTimer) return
    this.talentLevel = level; this.talentCard.removeAll(true); this.talentCard.setVisible(!!level)
    this.talentTimer?.remove(); this.talentTimer = undefined
    s.input.keyboard?.off('keydown', this.talentKey, this)
    const choices = level ? hero.choices : null
    if (!choices) return
    // Each card holds its own pause for at most ten seconds; scene.time keeps running while paused.
    s.setPaused(true); s.options.sfx.play('talent-open'); this.talentTick = 0
    this.talentTimer = s.time.delayedCall(10000, () => this.pickTalent(0, true))
    s.input.keyboard?.on('keydown', this.talentKey, this)
    this.talentCard.add(plate(s, -360, -64, 720, 272, 20, 0x2e203c, .97, 0xffd58b, 3))
    this.talentTitle = this.text(0, -34, `LEVEL ${level} · PICK A TALENT${this.keyHints ? ' [Z / X]' : ''}`, 34).setOrigin(.5)
    this.talentCard.add(this.talentTitle)
    choices.forEach((choice, i) => {
      const x = i ? 176 : -176, panel = this.scene.add.container(x, 82).setSize(340, 180).setInteractive()
      panel.add(plate(this.scene, -166, -90, 332, 180, 12, 0xffefd0))
      panel.add(this.text(0, -54, choice.name, 34, '#35253d').setOrigin(.5))
      panel.add(this.text(0, 22, choice.effect, 34, '#35253d', true).setOrigin(.5).setWordWrapWidth(302).setAlign('center'))
      panel.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.pickTalent(i) })
      this.talentCard.add(panel)
    })
    this.talentCard.add(plate(s, -330, 184, 660, 14, 7, 0x171020))
    this.talentBar = plate(s, -330, 184, 660, 14, 7, 0xffd58b); this.talentCard.add(this.talentBar)
  }
  // Held keys repeat; ignoring repeats keeps one press from answering the next card too.
  private talentKey(event: KeyboardEvent) {
    if (!event.repeat && (event.code === 'KeyZ' || event.code === 'KeyX')) this.pickTalent(event.code === 'KeyZ' ? 0 : 1)
  }
  // The scene ignores commands while paused, so resume first. Resetting talentLevel makes the refresh
  // open the next card, or close this one, even if the choice was somehow refused.
  private pickTalent(index: number, auto = false) {
    const s = this.scene, choice = s.hero.choices?.[index]
    if (!this.talentTimer || !choice) return
    this.talentTimer.remove(); this.talentTimer = undefined
    s.setPaused(false); s.command({ type: 'talent', index })
    if (auto) this.toast(`Auto-picked: ${choice.name}`)
    this.talentLevel = -1; this.refresh()
  }
  toast(value: string, seconds = 3.5) {
    if (this.toastValue === value && this.scene.presentationTime < this.toastUntil) return
    this.toastValue = value; this.toastStart = this.scene.presentationTime; this.toastSeconds = seconds
    const lines = this.toastText.getWrappedText(value)
    this.toastPages = []
    // Three-line pages keep long trait descriptions inside the gap below the road.
    for (let i = 0; i < lines.length; i += 3) this.toastPages.push(lines.slice(i, i + 3).join('\n'))
    this.toastUntil = this.toastStart + seconds * this.toastPages.length
    this.scene.tweens.killTweensOf(this.toastText)
    const v = this.scene.view, y = v.bottom - 112
    this.toastText.setText(this.toastPages[0] ?? '').setPosition((v.left + v.right) / 2, reducedMotion() ? y : y + 10).setVisible(true)
    if (!reducedMotion()) this.scene.tweens.add({ targets: this.toastText, y, duration: 150, ease: 'Cubic.Out' })
  }
  banner(value: string) {
    this.scene.tweens.killTweensOf(this.waveBanner)
    const v = this.scene.view, y = v.top + 490
    this.bannerText.setText(value.replace('  ·  ', '\n')); this.waveBanner.setVisible(true).setPosition((v.left + v.right) / 2, reducedMotion() ? y : -130)
    this.scene.tweens.add({ targets: this.waveBanner, y, duration: reducedMotion() ? 0 : 250, hold: 1700, yoyo: true, onComplete: () => this.waveBanner.setVisible(false) })
  }
  // The bar sits between the resource plate and the speed buttons; its fill drains smoothly.
  bossBar(e: Enemy) {
    const s = this.scene, b = e.boss!, v = s.view
    this.boss?.root.destroy()
    const root = s.add.container(0, 0).setDepth(3050); s.hudLayer.add(root)
    const left = v.left + 690, right = v.right - 1920 + 1470, k = Phaser.Math.Clamp((right - left) / 560, .8, 1.7)
    root.setPosition((left + right) / 2, v.top + 72)
    root.add(s.textures.exists('boss-ui') ? s.art.image(0, 0, 'boss/ui/bar').setScale(k) : plate(s, -280 * k, -40 * k, 560 * k, 80 * k, 16, 0x261442, 1, 0xffc86b, 3))
    const fill = (s.textures.exists('boss-ui') ? s.art.image(-226 * k, -k, 'boss/ui/fill') : s.add.image(-226 * k, -k, 'siege-shapes', 'white').setTint(0xffc86b)).setOrigin(0, .5); fill.setDisplaySize(452 * k, 22 * k); root.add(fill); if (s.textures.exists('boss-ui')) root.sendToBack(fill)
    root.add(this.text(0, 46 * k, b.name.toUpperCase(), 34, '#fff0d5').setOrigin(.5).setStroke('#241b30', 6))
    if (b.rig) {
      root.add(circle(s, 40, 0xffc86b, 0, 0xffc86b, 6).setPosition(-250 * k, 0))
      root.add(s.add.image(-250 * k, 0, 'siege-faces', s.art.face(b.id as number)).setDisplaySize(40 * 128 / 61, 40 * 128 / 61)); root.sendToBack(root.list[root.list.length - 1])
    }
    this.boss = { root, fill, width: 452 * k, shown: 1 }
    root.setAlpha(0); s.tweens.add({ targets: root, alpha: 1, duration: reducedMotion() ? 0 : 300 })
    this.layout()
  }
  private animateBoss(dt: number) {
    const s = this.scene, bar = this.boss
    if (!bar) return
    const lead = bossLead(s)
    if (!lead) { const root = bar.root; this.boss = null; s.tweens.add({ targets: root, alpha: 0, duration: reducedMotion() ? 0 : 500, onComplete: () => root.destroy() }); return }
    const target = bossFraction(s, lead)
    bar.shown += (target - bar.shown) * Math.min(1, dt * 4)
    bar.fill.setDisplaySize(Math.max(1, bar.width * bar.shown), bar.fill.displayHeight)
    bar.fill.setTint(lead.boss!.phase === 2 || target < .5 ? 0xff9a7a : 0xffffff)
  }
  // The introduction: the boss's banner slides in with its name (a legend wears its real portrait over the Pumpkin icon).
  bossBanner(b: BossState) {
    const s = this.scene, v = s.view, k = 1.35
    if (this.bossBannerRoot) { s.tweens.killTweensOf(this.bossBannerRoot); this.bossBannerRoot.destroy() }
    const root = s.add.container((v.left + v.right) / 2, -150).setDepth(3330); s.hudLayer.add(root)
    root.add(s.textures.exists('boss-ui') ? s.art.image(0, 0, 'boss/ui/banner').setScale(k) : plate(s, -320 * k, -68 * k, 640 * k, 136 * k, 18, 0x261442, 1, 0xffc86b, 3))
    if (b.rig) {
      const legend = s.options.assets.legends.legends[String(b.id)]
      root.add(plate(s, -130 * k, -29 * k, 358 * k, 60 * k, 8, 0x261442))
      root.add(this.text(70 * k, -10 * k, b.name.toUpperCase(), 46, '#ede3d1').setOrigin(.5))
      root.add(this.text(70 * k, 20 * k, `LEGEND · ${legend.boss.move.toUpperCase()}`, 26, '#f4b551').setOrigin(.5))
      root.add([circle(s, 52 * k, 0x261442, 1).setPosition(-248 * k, 0), circle(s, 50 * k, 0xffc86b, 0, 0xffc86b, 6).setPosition(-248 * k, 0)])
      root.add(s.add.image(-248 * k, 0, 'siege-faces', s.art.face(b.id as number)).setDisplaySize(50 * k * 128 / 61, 50 * k * 128 / 61))
    }
    if (!b.rig && !s.textures.exists('boss-ui')) root.add(this.text(0, 0, b.name.toUpperCase(), 46, '#ede3d1').setOrigin(.5))
    this.bossBannerRoot = root
    this.closePreview(); this.calls.forEach(b => b.root.setVisible(false))
    for (const button of this.buttons) this.shade(button)
    const motion = !reducedMotion() && !s.settings.lite && s.quality.tier < 2, duration = motion ? 300 : 0, hold = motion ? 1500 : 1800
    const y = v.top + 250
    root.y = motion ? v.top - 180 : y
    this.bossLetterbox.setVisible(true)
    s.tweens.killTweensOf(this.bossBars)
    this.bossBars.forEach((bar, i) => {
      const at = i ? v.height - 80 : 0
      bar.setDisplaySize(v.width, 80).setPosition(0, motion ? i ? v.height : -80 : at)
      s.tweens.add({ targets: bar, y: at, duration, hold, yoyo: true, ease: 'Sine.Out' })
    })
    s.tweens.add({ targets: root, y, duration, ease: 'Back.Out', hold, yoyo: true, onComplete: () => {
      root.destroy()
      if (this.bossBannerRoot === root) { this.bossBannerRoot = null; this.bossLetterbox.setVisible(false); this.refresh() }
    } })
  }
  tutorialTarget(target: string): FocusTarget | null {
    if (target === 'pad') {
      if (this.scene.selected === 0 && this.radialButtons.length) {
        const button = this.radialButtons.find(b => b.kind === 'egg')?.button ?? this.radialButtons[0].button
        return { x: this.radialRoot.x + button.root.x, y: this.radialRoot.y + button.root.y, radius: 76, world: false }
      }
      const pad = this.scene.pads[0]
      return { x: pad.x, y: pad.y - (this.scene.towers[0] ? 80 : 0), radius: 85, world: true }
    }
    const s = this.scene
    if (target === 'trap' && s.mode === 'pumpkin') return { ...s.nearestPath(620, 630), radius: 65, world: true }
    if (target === 'rain' && s.mode === 'rain') {
      const crowd = s.enemies.find(e => e.active && e.x > 110 && e.x < 1800) ?? s.nearestPath(380, 550)
      return { x: crowd.x, y: crowd.y, radius: 110, world: true }
    }
    const b = target === 'wave' ? this.calls.find(b => b.root.visible) : target === 'trap' ? this.trapButtons.pumpkin : target === 'rain' ? this.rain : target === 'emote' ? this.emoteButton : target === 'hero' && !s.heroSelected ? this.portrait : null
    if (b) { const p = b.root.getWorldTransformMatrix(); return { x: p.tx, y: p.ty, radius: b.size / 2 + 6, world: false } }
    if (target === 'hero') return { x: Math.min(1800, s.hero.x + 160), y: Math.min(875, s.hero.y), radius: 65, world: true }
    return null
  }
  animate(time: number, dt = 1 / 60) {
    const motion = !reducedMotion(), s = this.scene
    const value = candyFormat.format(Math.round(this.candyRoll.value))
    if (this.candy.text !== value) { this.candy.setText(value).setScale(1); this.candy.setScale(Math.min(1, 150 / this.candy.getTextBounds().local.width)); if (motion) this.candy.y = -6 }
    this.candy.y = motion ? this.candy.y * Math.exp(-17.26 * dt) : 0
    this.toastText.setVisible(time < this.toastUntil)
    if (this.toastText.visible) this.toastText.setText(this.toastPages[Math.floor((time - this.toastStart) / this.toastSeconds)] ?? '')
    const pulse = motion && !s.settings.lite && s.quality.tier < 2
    for (const b of this.pulsing) b.glow.setVisible(b.enabled).setAlpha(pulse ? .55 + Math.sin(time * 4) * .25 : .65)
    this.ultimateBurst += dt
    const burst = Math.min(1, this.ultimateBurst / .36)
    this.ultimateRing.setVisible(pulse && this.ultimateReady && burst < 1).setDisplaySize(140 + 100 * burst, 140 + 100 * burst).setAlpha(1 - burst)
    this.portrait.glow.setVisible(s.heroSelected).setTint(0xffe296)
    this.animateAlarm(dt)
    this.animatePerks(dt)
    this.animateRules(dt)
    this.animateBoss(dt)
    for (const preview of this.dancePreviews) {
      if (!preview.rig.root.active || !this.wheel.visible) continue
      const clip = s.options.assets.rig.clips[preview.clip]
      if (preview.rig.time >= clip.ms) { preview.rig.time = 0; preview.rig.play(preview.clip); if (preview.clip === s.options.assets.dances[s.hero.kit.emote].clip) preview.rig.emote() }
      preview.rig.update(dt); preview.rig.root.setScale(preview.scale)
    }
  }
}
