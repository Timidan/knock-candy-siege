import Phaser from 'phaser'
import { Art, loadImage } from './assets'
import { ChogHeads } from './chogHead'
import { ShapePool, circle, plate } from './renderShapes'
import { Quality } from './Quality'
import type { AssetPack } from './assets'
import { ENEMIES, TOWERS, TRAPS, SPELLS, LIMITS, STARTING_CANDY, starsFor, SPECIALISATIONS, SPEC_COST, rankCost, towerStats, seededRandom, TARGETING, towerLock, CONSUMABLES } from './data/config'
import type { EnemyKind, Point, SpellKind, Status, TowerKind, TrapKind, Specialisation, Targeting, ConsumableKind } from './data/config'
import { LEVELS, TUTORIAL } from './data/level1'
import type { TutorialAction, LevelProp, Wave, BossSpawn } from './data/level1'
import { endlessWave, endlessHealth, endlessScore, shuffledKinds } from './data/endless'
import { NIGHTS } from './data/endless'
import type { Daily } from './data/endless'
import { eliteBonus, modifiersFor, traitsFor, MODIFIERS } from './data/traits'
import { reducedMotion } from './data/save'
import type { Settings } from './data/save'
import { Sfx } from './Sfx'
import { Route, clearStatuses, distanceSq } from './world'
import type { Ally, Blocker, DamageNumber, Effect, Enemy, Projectile, Tower, Trap, UnitArt } from './world'
import { Hud } from './Hud'
import { Darkness } from './Darkness'
import type { Light } from './Darkness'
import { spawnBoss, preloadBoss, updateBoss, drawBoss, bossAbsorbs, bossRevives, bossDeath, updateCorpses, releaseBoss } from './Boss'
import type { ArtState } from './Boss'
import type { Rig } from './hero/Rig'
import { Hero } from './hero/Hero'
import { Signature } from './hero/Signature'
import { TutorialFocus } from './TutorialFocus'
import { canDance, CRYPTO_EMOTES } from './data/shop'
import { scoreFor } from './data/score'
import { specialTowerAttack } from './SpecialTowers'
import { useConsumable, updateConsumables } from './Consumables'
import type { PlacedItem } from './Consumables'
import type { StreetBonuses } from './street'

export type Command =
  | { type: 'build'; pad: number; kind: TowerKind }
  | { type: 'upgrade' | 'sell'; pad: number }
  | { type: 'specialise'; pad: number; spec: Specialisation }
  | { type: 'target'; pad: number; targeting: Targeting }
  | { type: 'consumable'; kind: ConsumableKind; x: number; y: number }
  | { type: 'trap'; kind: TrapKind; x: number; y: number }
  | { type: 'spell'; kind: SpellKind; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'ability' | 'ultimate' | 'wave' }
  | { type: 'emote'; name: string }
  | { type: 'talent' | 'prop'; index: number }
  | { type: 'speed' }
export type Mode = 'level' | 'endless' | 'daily'
export type Outcome = { level: number; mode: Mode; daily: number; theme: number; won: boolean; stars: number; jars: number; kills: number; wave: number; heroLevel: number; score: number; earlyCalls: number; seconds: number; date: string }
// A schedule entry is one enemy to spawn: on a road, or (edge) from an edge of the view; risen enemies pay no candy; boss entries spawn a legend or the Great Pumpkin.
export type Spawn = { chogId?: number; time: number; kind: EnemyKind; path: number; wave: number; distance?: number; route?: number; edge?: number; risen?: boolean; boss?: BossSpawn }
export type SceneOptions = { assets: AssetPack; level: number; mode: Mode; daily: Daily | null; seed: number; stars: Record<string, number>; street: StreetBonuses; seen: string[]; onDiscover: (keys: string[]) => void; hero: number; home: boolean; tutorial: boolean; costume: string; owned: number[]; victoryDance: string; settings: Settings; sfx: Sfx; onFullscreen?: () => void; onShop: () => void; onPause: () => void; onEnd: (result: Outcome) => void; onIntro: (kind: string) => void; onTutorial: () => void; onReady: () => void }
const WITCHING_WARNING = 3
const STATUS_KEYS = Object.keys(clearStatuses()) as Status[]
const DRAW_STATUSES: Status[] = ['freeze', 'charm', 'confuse', 'root', 'mark', 'bleed', 'fear', 'burn', 'poison', 'slow']
export class SiegeScene extends Phaser.Scene {
  options: SceneOptions
  art!: Art
  heads!: ChogHeads
  hud!: Hud
  focus!: TutorialFocus
  hudLayer!: Phaser.GameObjects.Layer
  private worldLayer!: Phaser.GameObjects.Layer
  private hudCamera!: Phaser.Cameras.Scene2D.Camera
  view = { width: 1920, height: 1080, left: 0, right: 1920, top: 0, bottom: 1080 }
  routes: Route[] = []
  flyRoutes: Route[] = []
  detour: Route | null = null
  bridgeUp = false
  fork = 0
  sugarRush = 0
  random: () => number
  visualRandom: () => number
  seed: number
  discovered: Set<string>
  props: { data: LevelProp; image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; cooldown: number; used: boolean; animation: number }[] = []
  private ambience: { image: Phaser.GameObjects.Image; kind: string; x: number; y: number; n: number }[] = []
  // Batch 3a: portals, toxic pools, boosted pads, the darkness layer and the bonfire.
  gone = false
  portals: { path: number; enter: Point; exit: Point; at: number; to: number; images: Phaser.GameObjects.Image[] }[] = []
  zones: { x: number; y: number; r: number; image: Phaser.GameObjects.Image }[] = []
  boostRings: Phaser.GameObjects.Image[] = []
  darkness: Darkness | null = null
  sources: Light[] = []
  bonfire = 0
  // Bosses and legend kits: temporary fighters and walls, ground hazards, the recently fallen, and boss art in flight.
  allies: Ally[] = []
  blockers: Blocker[] = []
  hazards: { x: number; y: number; r: number; life: number; pulse: number }[] = []
  fallen: { kind: EnemyKind; path: number }[] = []
  corpses: { holder: Phaser.GameObjects.Container | null; rig?: Rig; life: number; atlas: string }[] = []
  bossArt = new Map<string, ArtState>()
  bossOwned = new Set<string>()
  bossSheet?: AssetPack['atlases'][number]
  missTime = 0
  // Witching Hour warning: chevrons pulse at the edges until `until`.
  warning: { until: number } | null = null
  // Daily modifiers and endless scaling.
  speedScale = 1
  candyScale = 1
  shuffle: Partial<Record<EnemyKind, EnemyKind>> | null = null
  private plans: Wave[] = []
  private later: { at: number; run: () => void }[] = []
  // Run something a little later in simulated time (staggered strikes); it is dropped with the scene.
  after(seconds: number, run: () => void) { this.later.push({ at: this.clock + seconds, run }) }
  get level() { return LEVELS[this.options.level - 1] }
  get dark() { return !!this.options.assets.geometry.dark }
  get waveCount() { return this.level.endless ? Infinity : this.level.waves.length }
  // The wave plan: authored for levels, generated for endless, and with Costume Night's shuffle applied once.
  waveAt(i: number): Wave | undefined {
    if (i < 0 || i >= this.waveCount) return undefined
    const cached = this.plans[i]
    if (cached) return cached
    const base = this.level.endless ? endlessWave(i + 1, this.seed) : this.level.waves[i], shuffle = this.shuffle
    return this.plans[i] = shuffle ? { ...base, groups: base.groups.map(group => ({ ...group, type: shuffle[group.type] ?? group.type })) } : base
  }
  healthScale(wave: number) { return this.level.endless ? endlessHealth(wave) : 1 }
  routeFor(e: Enemy): Route { return e.route ?? (e.path >= this.routes.length ? e.path === this.routes.length + this.flyRoutes.length ? this.detour! : this.flyRoutes[e.path - this.routes.length] : this.routes[e.path]) }
  roadFor(kind: EnemyKind, path: number) { const sw = this.options.assets.geometry.switch; return this.bridgeUp && !ENEMIES[kind].flying && path === sw?.path ? this.routes.length + this.flyRoutes.length : this.entrancePath(kind, path) }
  enemies: Enemy[] = []
  private crowns: Enemy[] = []
  private lightPool: Light[] = []
  private lightCount = 0
  towers: (Tower | null)[] = []
  pads: Phaser.GameObjects.Image[] = []
  projectiles: Projectile[] = []
  effects: Effect[] = []
  numbers: DamageNumber[] = []
  traps: Trap[] = []
  items: PlacedItem[] = []
  itemCooldown = Object.fromEntries(Object.keys(CONSUMABLES).map(k => [k, 0])) as Record<ConsumableKind, number>
  freePumpkin = 0
  get crew() { return this.options.street.crew }
  towerLock(kind: TowerKind) { return towerLock(kind, this.options.stars, this.options.owned) }
  trapCost(kind: TrapKind) { return kind === 'pumpkin' && this.freePumpkin > 0 ? 0 : this.hero.trapCost(kind) }
  hero!: Hero
  candy = STARTING_CANDY
  jars = 20
  kills = 0
  earlyCalls = 0
  wave = 0
  speed = 1
  slowBeat = 0
  private combos = new Set<string>()
  private signatures: { player: Signature; enemy?: Enemy; generation?: number; bubble?: boolean }[] = []
  clock = 0
  private accumulator = 0
  countdown = 0
  paused = false
  ended = false
  selected = -1
  buildPage = 0
  previewTower: TowerKind | null = null
  previewSpec: Specialisation | null = null
  heroSelected = false
  tutorialStep = 0
  settings: Settings
  spellCooldown: Record<SpellKind, number> = { rain: 0, boo: 0 }
  mode: SpellKind | TrapKind | ConsumableKind | null = null
  pointer = { x: 960, y: 540 }
  emoteOpen = false
  quality = new Quality()
  renderScale = 1
  ready = false
  schedule: Spawn[] = []
  waveAlive: number[] = []
  private rewarded = new Set<number>()
  private paint!: ShapePool
  private range!: Phaser.GameObjects.Container
  private rangeFill!: Phaser.GameObjects.Image
  private rangeStroke!: Phaser.GameObjects.Image
  private rangeKey = ''
  private focusRing?: Phaser.GameObjects.Image
  private focusRadius = 0
  private overlay!: Phaser.GameObjects.Graphics
  private heroRing!: Phaser.GameObjects.Image
  private preview!: Phaser.GameObjects.Image
  private hudTime = 0
  private portraitTime = 0
  private holdTime = 0
  private holdAt: Point | null = null
  private dragStart: Point | null = null
  private beam: { from: Point; to: Point; life: number; color: number }[] = []
  private statsDraws = 0
  private statsPrevious = 0
  private motion = !reducedMotion()
  constructor(options: SceneOptions) { super('CandySiege'); this.options = options; this.seed = options.seed >>> 0; this.random = seededRandom(this.seed); this.visualRandom = seededRandom(this.seed ^ 0x57c0ffee); this.discovered = new Set(options.seen); this.settings = options.settings; this.tutorialStep = options.tutorial ? 0 : TUTORIAL.length }
  async create() {
    if (this.game.renderer.type === Phaser.WEBGL) {
      // No FX pass uses these four swap buffers; do not grow them with the expanded canvas.
      const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer
      for (const target of renderer.pipelines.UTILITY_PIPELINE.renderTargets) { target.resize(1, 1); target.setAutoResize(false) }
    }
    this.worldLayer = this.add.layer()
    this.hudLayer = this.add.layer().setDepth(1)
    this.hudCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)
    this.cameras.main.ignore(this.hudLayer); this.hudCamera.ignore(this.worldLayer)
    // New combat objects join the world; HUD roots explicitly move to their own layer.
    const added = (object: Phaser.GameObjects.GameObject) => { if (object.displayList === this.children) this.worldLayer.add(object) }
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, added)
    this.events.once('shutdown', () => { this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, added); this.scale.off('resize', this.layout, this) })
    this.events.once('destroy', () => { this.gone = true })
    this.heads = new ChogHeads(this)
    await this.heads.ready
    if (this.gone) return
    this.art = new Art(this, this.options.assets, this.settings.lite)
    this.art.pin(this.options.hero)
    const daily = this.options.mode === 'daily' ? this.options.daily : null
    if (daily) { this.speedScale = daily.theme === 1 ? 1.25 : 1; this.candyScale = daily.theme === 2 ? 2 : 1; this.shuffle = daily.theme === 3 ? shuffledKinds(daily.seed) : null }
    this.routes = this.options.assets.geometry.paths.map(path => new Route(path, true))
    this.flyRoutes = (this.options.assets.geometry.fly ?? []).map(path => new Route(path, true))
    const sw = this.options.assets.geometry.switch
    if (sw) {
      this.detour = new Route(sw.points, true)
      const base = this.options.assets.geometry.paths[sw.path]
      let i = 0; while (i + 1 < Math.min(base.length, sw.points.length) && Math.hypot(base[i + 1][0] - sw.points[i + 1][0], base[i + 1][1] - sw.points[i + 1][1]) < 3) i++
      this.fork = this.routes[sw.path].nearest(...base[i]).distance
    }
    this.drawMap()
    this.createWorld()
    this.range = this.add.container(0, 0).setDepth(8)
    this.paint = new ShapePool(this, 2000, 408)
    this.overlay = this.add.graphics().setDepth(3340)
    this.hudLayer.add(this.overlay)
    this.options.assets.geometry.pads.forEach((pad, i) => {
      this.pads.push(this.art.image(pad.x, pad.y, 'pad/empty').setDisplaySize(132, 66).setDepth(5)); this.towers[i] = null
      if (pad.boost) this.boostRings.push(this.art.image(pad.x, pad.y + 2, 'fx/boost/0').setDepth(4))
    })
    this.makePools()
    const spawn = this.routes[0].nearest(1080, 720)
    this.hero = new Hero(this, spawn)
    this.candy += this.options.street.candy; this.freePumpkin = this.options.street.trap ? 1 : 0
    if (this.options.owned.includes(23)) this.candy += 50
    this.heroRing = this.art.image(this.hero.x, this.hero.y, 'hero/ring').setDisplaySize(116, 44).setDepth(6)
    this.preview = this.art.image(0, 0, 'trap/pumpkin/0').setDepth(2900).setAlpha(.75).setVisible(false)
    if (this.dark) this.darkness = new Darkness(this)
    this.hud = new Hud(this)
    this.focus = new TutorialFocus(this)
    this.layout()
    this.scale.on('resize', this.layout, this)
    this.discover((['weapon', 'special', 'ultimate', 'passive', 'headgear', 'trinket', 'skin', 'suit', 'weaponMod'] as const).filter(slot => this.hero.kit[slot]).map(slot => `kit/${slot === 'weaponMod' ? 'weapon-mod' : slot}/${this.hero.kit[slot]}`))
    this.input.on('pointerdown', this.worldDown, this)
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.pointer = this.viewToWorld(p) })
    this.input.on('pointerup', this.worldUp, this)
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.paused || this.ended) return
      if (['Space', 'Escape', 'Digit1', 'Digit2', 'KeyE', 'KeyQ', 'KeyN', 'KeyR', 'KeyZ', 'KeyX'].includes(event.code)) event.preventDefault()
      if (this.focus.active) { this.focus.nudge(); return }
      if (event.code === 'Escape') { if (this.mode || this.selected >= 0 || this.emoteOpen || this.heroSelected || this.hud.wavePreviewOpen) this.cancel(); else this.pauseGame() }
      if (event.code === 'Space') this.pauseGame()
      if (event.code === 'Digit1') this.selectSpell('rain')
      if (event.code === 'Digit2') this.selectSpell('boo')
      if (event.code === 'KeyE') this.toggleEmotes()
      if (event.code === 'KeyQ') this.heroAbility()
      if (event.code === 'KeyR') this.command({ type: 'ultimate' })
      if (event.code === 'KeyZ') this.command({ type: 'talent', index: 0 })
      if (event.code === 'KeyX') this.command({ type: 'talent', index: 1 })
      if (event.code === 'KeyN') this.command({ type: 'wave' })
    })
    if (new URLSearchParams(location.search).has('siegeStats')) {
      Object.assign(window, { __siege: this }) // for automated playtests, including Canvas fallback
      this.events.once('destroy', () => { if ((window as Window & { __siege?: SiegeScene }).__siege === this) delete (window as Window & { __siege?: SiegeScene }).__siege })
    }
    if (new URLSearchParams(location.search).has('siegeStats') && this.game.renderer.type === Phaser.WEBGL) {
      const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl
      const drawArrays = gl.drawArrays.bind(gl), drawElements = gl.drawElements.bind(gl)
      gl.drawArrays = (...args) => { this.statsDraws++; drawArrays(...args) }
      gl.drawElements = (...args) => { this.statsDraws++; drawElements(...args) }
      const postRender = () => { this.statsPrevious = this.statsDraws; this.statsDraws = 0 }
      this.game.events.on('postrender', postRender)
      this.events.once('destroy', () => { gl.drawArrays = drawArrays; gl.drawElements = drawElements; this.game.events.off('postrender', postRender) })
    }
    this.ready = true
    this.hud.refresh()
    this.options.onReady()
    this.updateLights()
    if (this.dark) this.hud.toast('Rare Row is dark. Only light shows enemies: lanterns, your Chog, and the bonfire.', 6)
    else if (daily) this.hud.toast(`Daily #${daily.number} · ${this.level.name}\n${NIGHTS[daily.theme].name}: ${NIGHTS[daily.theme].text}`, 6)
    else if (this.options.mode === 'endless') this.hud.toast('Endless: the waves never stop. A new road opens every ten waves.', 6)
  }
  layout() {
    const r = this.renderScale, width = this.scale.width / r, height = this.scale.height / r, worldWidth = Math.min(2400, width)
    const camera = this.cameras.main
    camera.setViewport((width - worldWidth) * r / 2, (height - 1080) * r / 2, worldWidth * r, 1080 * r)
    if (!this.ended) camera.setZoom(r).centerOn(960, 540)
    this.hudCamera.setSize(width * r, height * r).setZoom(r).centerOn(width / 2, height / 2)
    const probe = document.querySelector('.siege-safe-area'), css = probe && getComputedStyle(probe), bounds = this.game.canvas.getBoundingClientRect()
    const x = width / (bounds.width || width), y = height / (bounds.height || height)
    this.view = { width, height, left: parseFloat(css?.paddingLeft || '0') * x, right: width - parseFloat(css?.paddingRight || '0') * x, top: parseFloat(css?.paddingTop || '0') * y, bottom: height - parseFloat(css?.paddingBottom || '0') * y }
    this.hud.layout(); this.focus.draw()
  }
  viewToWorld(point: Point): Point { return this.cameras.main.getWorldPoint(point.x, point.y) }
  worldToView(point: Point): Point {
    const c = this.cameras.main
    const x = (point.x - c.scrollX - c.width / 2) * c.zoomX, y = (point.y - c.scrollY - c.height / 2) * c.zoomY
    const rotation = (c as Phaser.Cameras.Scene2D.Camera & { rotation: number }).rotation
    const cos = Math.cos(rotation), sin = Math.sin(rotation)
    return { x: (Math.floor(c.x + c.width / 2 + .5) + x * cos - y * sin) / this.renderScale, y: (Math.floor(c.y + c.height / 2 + .5) + x * sin + y * cos) / this.renderScale }
  }
  discover(keys: string[]) {
    const fresh = keys.filter(k => !this.discovered.has(k))
    if (!fresh.length) return
    fresh.forEach(k => this.discovered.add(k)); this.options.onDiscover(fresh)
  }
  command(command: Command) {
    if (this.paused || this.ended || !this.ready) return
    if ('pad' in command && (!Number.isInteger(command.pad) || !this.pads[command.pad])) return
    if ('x' in command && (!Number.isFinite(command.x) || !Number.isFinite(command.y) || command.x < 0 || command.x > 1920 || command.y < 0 || command.y > 1080)) return
    if (this.focus.active) {
      const action = command.type === 'spell' ? command.kind : command.type
      if (TUTORIAL[this.tutorialStep]?.action !== action || ('pad' in command && command.pad !== 0)) return
    }
    switch (command.type) {
      case 'build': if (Object.hasOwn(TOWERS, command.kind)) this.build(command.kind, command.pad); break
      case 'upgrade': this.upgrade(command.pad); break
      case 'sell': this.sell(command.pad); break
      case 'specialise': this.specialise(command.pad, command.spec); break
      case 'target': { const t = this.towers[command.pad]; if (t && TARGETING.includes(command.targeting)) { t.targeting = command.targeting; this.hud.radial() }; break }
      case 'consumable': if (Object.hasOwn(CONSUMABLES, command.kind)) useConsumable(this, command.kind, command.x, command.y); break
      case 'trap': if (Object.hasOwn(TRAPS, command.kind)) this.placeTrap(command.kind, command.x, command.y); break
      case 'spell': if (Object.hasOwn(SPELLS, command.kind)) this.cast(command.kind, command.x, command.y); break
      case 'move': this.moveHero(command); break
      case 'ability': this.hero.abilityUse(); break
      case 'ultimate': this.hero.ultimateUse(); break
      case 'emote': this.chooseEmote(command.name); break
      case 'talent': if (command.index === 0 || command.index === 1) this.hero.chooseTalent(command.index); break
      case 'wave': this.callWave(); break
      case 'prop': this.useProp(command.index); break
      case 'speed': this.speed = this.speed % 3 + 1; this.hud.refresh(); break
    }
  }
  private specialise(pad: number, spec: Specialisation) {
    const t = this.towers[pad]
    if (!t || t.level !== 3 || t.spec || !Object.hasOwn(SPECIALISATIONS, spec) || SPECIALISATIONS[spec].kind !== t.kind || this.candy < SPEC_COST) return
    this.candy -= SPEC_COST; t.spent += SPEC_COST; t.spec = spec; t.pop = .4
    this.art.set(t.image, this.towerFrame(t.kind, t.level, spec)); this.discover([`spec/${spec}`])
    if (t.kind === 'patch') this.guardsFor(t)
    this.effect('fx/levelup/0', t.x, t.y - 80, .7, 1.5); this.cancel(); this.hud.toast(SPECIALISATIONS[spec].name)
  }
  private towerAttack(t: Tower, target: Enemy): boolean {
    const c = towerStats(t), damage = c.damage * this.towerBuff(t), spec = t.spec, rank = t.rank
    const special = specialTowerAttack(this, t, target, damage)
    if (special !== undefined) return special
    if (!spec) return this.fire(t.x, t.y - 125, target, damage, t.kind, c.splash)
    if (spec === 'moon') {
      const dx = target.x - t.x, dy = target.y - t.y, length = Math.hypot(dx, dy) || 1
      const end = { x: t.x + dx / length * c.range, y: t.y + dy / length * c.range }
      this.spriteBeam('fx/moonbeam', t, end, .35, 30); this.effect('fx/moonbeam-end/0', end.x, end.y - 50, .35)
      for (const e of this.enemies) if (e.active && e.visible && !e.returning && !e.status.charm) {
        const along = ((e.x - t.x) * dx + (e.y - t.y) * dy) / length
        if (along >= 0 && along <= c.range && Math.abs((e.x - t.x) * dy - (e.y - t.y) * dx) / length < 45) this.damage(e, damage, 'magic')
      }
      return true
    }
    const vortex = this.routeFor(target).at(Math.max(0, target.distance - 65), { x: 0, y: 0 })
    return this.fire(t.x, t.y - 125, target, damage, t.kind, c.splash, {
      frame: spec === 'rotten' ? 'proj/rotten-egg' : spec === 'golden' ? 'proj/golden-egg' : `proj/${TOWERS[t.kind].projectile}`, duration: t.kind === 'tp' ? .5 : .23, arc: t.kind === 'tp' ? 130 : 30,
      onHit: e => {
        const crit = spec === 'golden' && this.random() < .35
        const landed = this.damage(e, damage * (crit ? 3 : 1), t.kind === 'egg' ? 'egg' : t.kind === 'lantern' ? 'magic' : 'physical')
        if (crit) this.effect('fx/crit/0', e.x, e.y - 75, .5)
        if (!landed) return
        if (spec === 'rotten' && e.active) { e.poisonStacks = Math.min(5, e.poisonStacks + 1); this.status(e, 'poison', 5); this.effect('fx/poison-cloud/0', e.x, e.y - 35, .5, .65) }
        if (t.kind === 'tp' && e.active) { this.status(e, 'wrap', 3); this.status(e, 'slow', 2); e.slowPower = .5 }
        if (spec === 'mummy') { this.status(e, 'stun', .65 + rank * .2); this.effect('fx/mummy-wrap/0', e.x, e.y - 40, .65) }
        if (spec === 'tornado' && e.active && !e.mods.includes('slippery')) { const centre = this.routeFor(e).nearest(vortex.x, vortex.y).distance; e.distance = Math.max(0, e.distance + Phaser.Math.Clamp(centre - e.distance, -70 - rank * 15, 70 + rank * 15)); this.routeFor(e).at(e.distance, e) }
        if (spec === 'wisp') {
          let from: Point = e
          const targets = this.enemies.filter(other => other.active && other !== e && other.visible && !other.returning && !other.status.charm && distanceSq(e, other) < 210 ** 2).slice(0, 3)
          for (const other of targets) { this.spriteBeam('fx/wisp-chain', from, other, .35, 18); this.damage(other, damage * .6, 'magic'); from = other }
        }
      },
      after: spec === 'tornado' ? () => { this.effect('fx/tornado/0', vortex.x, vortex.y - 45, .8, 1.2) } : undefined,
    })
  }
  private createWorld() {
    const geometry = this.options.assets.geometry
    // Both ends of a portal sit on the road; an enemy walking into the first comes out of the second.
    for (const p of geometry.portals ?? []) {
      const route = this.routes[p.path], enter = { x: p.enter[0], y: p.enter[1] }, exit = { x: p.exit[0], y: p.exit[1] }
      this.portals.push({ path: p.path, enter, exit, at: route.nearest(enter.x, enter.y).distance, to: route.nearest(exit.x, exit.y).distance, images: [enter, exit].map(at => this.art.image(at.x, at.y + 14, 'prop/portal/0').setOrigin(.5, 1).setDepth(at.y)) })
    }
    for (const z of geometry.zones ?? []) this.zones.push({ ...z, image: this.art.image(z.x, z.y, 'fx/toxic/0').setDisplaySize(z.r * 2.35, z.r * 2.35).setDepth(3) })
    for (const data of geometry.props) if (data.use && data.kind) {
      const image = this.art.image(data.x, data.y, data.kind === 'bridge' ? 'prop/bridge/down' : `prop/${data.kind}/0`).setOrigin(.5, 1).setDepth(data.y)
      const label = this.add.text(data.x, data.y + 12, '', { fontFamily: '"Patrick Hand", sans-serif', fontSize: '30px', color: '#fff0d5', backgroundColor: '#241b30', padding: { x: 10, y: 4 } }).setOrigin(.5, 0).setDepth(2800)
      const index = this.props.length
      image.setInteractive().on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); if (this.mode) this.worldDown(p); else if (!this.focus.active) this.command({ type: 'prop', index }); else this.focus.input(this.viewToWorld(p), true) })
      this.props.push({ data, image, label, cooldown: 0, used: false, animation: 0 })
    }
    const add = (kind: string, x: number, y: number, n: number, size = 1) => {
      const image = this.art.image(x, y, `amb/${kind}${kind === 'leaf' || kind === 'bat' ? '/0' : ''}`).setDepth(kind === 'glow' ? 1800 : 1900).setScale(size).setVisible(!this.settings.lite)
      if (kind === 'glow' || kind === 'firefly') image.setBlendMode(Phaser.BlendModes.ADD)
      this.ambience.push({ image, kind, x, y, n })
    }
    if (!this.settings.lite) {
      for (const [n, y] of (geometry.ambient?.fog ?? []).entries()) { add('fog', 960, y, n); this.ambience.at(-1)!.image.setDisplaySize(2400, 180).setAlpha(.28) }
      for (const [n, g] of (geometry.ambient?.glows ?? []).entries()) { add('glow', g.x, g.y, n); this.ambience.at(-1)!.image.setDisplaySize(g.r * 2, g.r * 2) }
      for (let i = 0; i < Math.min(30, geometry.ambient?.fireflies ?? 0); i++) add('firefly', 100 + i * 137 % 1700, 220 + i * 173 % 650, i)
      if (geometry.ambient?.leaves) for (let i = 0; i < 10; i++) add('leaf', i * 199, i * 117 % 1080, i)
      if (geometry.ambient) for (let i = 0; i < 3; i++) add('bat', -100, 190 + i * 35, i)
    }
    this.updateWorld(0)
  }
  private updateWorld(dt: number) {
    this.sugarRush = Math.max(0, this.sugarRush - dt); this.bonfire = Math.max(0, this.bonfire - dt)
    for (const p of this.props) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.animation = Math.max(0, p.animation - dt)
      const kind = p.data.kind!, step = (n: number) => Math.min(n - 1, Math.floor((1 - p.animation) * n))
      const name = kind === 'lamp' ? p.animation ? `fall/${step(4)}` : p.used ? 'down' : '0' : kind === 'shop' ? p.animation ? `use/${step(6)}` : String(Math.floor(this.clock * 5) % 4)
        : kind === 'bell' ? p.animation ? `ring/${step(6)}` : '0' : kind === 'grate' ? p.animation ? `open/${step(4)}` : '0' : kind === 'bonfire' ? this.bonfire > 0 ? `burn/${Math.floor(this.clock * 8) % 6}` : '0'
        : p.animation ? `move/${step(4)}` : this.bridgeUp ? 'up' : 'down'
      this.art.set(p.image, `prop/${kind}/${name}`)
      p.label.setText(kind === 'lamp' && p.used ? 'Lamp down' : kind === 'bonfire' && this.bonfire > 0 ? `Burning · ${Math.ceil(this.bonfire)}s` : p.cooldown > 0 ? `${Math.ceil(p.cooldown)}s` : kind === 'lamp' ? 'Drop lamp' : kind === 'shop' ? 'Sugar rush · 50' : kind === 'bell' ? 'Ring the bell' : kind === 'grate' ? 'Open the grate' : kind === 'bonfire' ? 'Light the bonfire' : this.bridgeUp ? 'Lower bridge' : 'Raise bridge')
    }
    for (const portal of this.portals) for (const image of portal.images) this.art.set(image, `prop/portal/${Math.floor(this.clock * 8) % 6}`)
    for (const z of this.zones) this.art.set(z.image, `fx/toxic/${Math.floor(this.clock * 4) % 4}`)
    this.boostRings.forEach((ring, i) => this.art.set(ring, `fx/boost/${Math.floor(this.clock * 6 + i) % 4}`))
    if (this.settings.lite || this.quality.tier > 0) return
    for (const a of this.ambience) {
      const t = this.clock, i = a.n
      if (a.kind === 'fog') a.image.x = a.x + Math.sin(t * .06 + i) * 160
      if (a.kind === 'glow') a.image.setAlpha(.45 + Math.sin(t * 5 + i) * .06 + Math.sin(t * 13) * .025)
      if (a.kind === 'firefly') a.image.setPosition(a.x + Math.sin(t * .45 + i) * 45, a.y + Math.cos(t * .7 + i) * 24).setAlpha(.3 + Math.sin(t * 2 + i) * .25)
      if (a.kind === 'leaf') { this.art.set(a.image, `amb/leaf/${Math.floor(t * 3 + i) % 4}`); a.image.setPosition((a.x + t * 17 + Math.sin(t + i) * 22) % 2020 - 50, (a.y + t * 32) % 1180 - 50).setRotation(t * .5 + i) }
      if (a.kind === 'bat') { this.art.set(a.image, `amb/bat/${Math.floor(t * 9) % 4}`); a.image.setPosition((t % 28) * 220 - 400 - i * 65, a.y + Math.sin(t * 4 + i) * 10) }
    }
  }
  private useProp(index: number) {
    const p = this.props[index]
    if (!p || p.cooldown > 0) return
    // Endless: every prop works again, on a longer cooldown.
    const slow = this.level.endless ? 1.6 : 1
    if (p.data.kind === 'lamp') {
      if (p.used) return
      const reach = new Route(p.data.reach!)
      for (const e of this.enemies) if (e.active && !e.returning && !ENEMIES[e.kind].flying && reach.nearest(e.x, e.y).gap < 90) { this.damage(e, 170, 'physical'); this.status(e, 'stun', 3) }
      if (this.level.endless) p.cooldown = 40; else p.used = true
    } else if (p.data.kind === 'shop') {
      if (this.candy < 50) { this.hud.toast('Sugar rush costs 50 candy.'); return }
      this.candy -= 50; this.sugarRush = 10; p.cooldown = 24 * slow; this.hud.toast('Sugar rush! Towers attack 60% faster for 10 seconds.')
    } else if (p.data.kind === 'bell') {
      // Mon Manor: everyone, flyers included, is stunned for two seconds.
      for (const e of this.enemies) if (e.active && !e.returning) this.status(e, 'stun', 2)
      p.cooldown = 22 * slow; this.effect('fx/stun/0', p.data.x, p.data.y - 90, .8, 3.5); this.shake(.006); this.hud.toast('The bell tolls! Everyone freezes for 2 seconds.')
    } else if (p.data.kind === 'grate') {
      // Radioactive Ridge: whoever stands on the grate drops in and climbs out upstream, at the grate's return point.
      const reach = new Route(p.data.reach!), back = p.data.return!
      let dropped = 0
      for (const e of this.enemies) if (e.active && !e.returning && !e.boss && !e.route && !ENEMIES[e.kind].flying && reach.nearest(e.x, e.y).gap < 85) {
        this.effect('fx/poof/0', e.x, e.y - 20, .5, 1.2); e.returning = 5; e.art.root.setVisible(false)
        e.distance = this.routeFor(e).nearest(back[0], back[1]).distance; this.routeFor(e).at(e.distance, e); dropped++
      }
      p.cooldown = dropped ? 16 * slow : 1.5; this.hud.toast(dropped ? `${dropped} dropped down the grate. They climb out upstream in 5 seconds.` : 'Nobody is standing on the grate.')
    } else if (p.data.kind === 'bonfire') {
      // Rare Row: the whole map is lit, and every ghost revealed, for 20 seconds.
      this.bonfire = 20; p.cooldown = 45 * slow; this.hud.toast('The bonfire roars! Everything is lit for 20 seconds.')
    } else {
      const sw = this.options.assets.geometry.switch
      if (!sw || !this.detour) return
      this.bridgeUp = !this.bridgeUp; p.cooldown = 12 * slow
      const detourIndex = this.routes.length + this.flyRoutes.length, destination = this.bridgeUp ? detourIndex : sw.path
      const reach = new Route(p.data.reach!)
      for (const e of this.enemies) if (e.active && !e.boss && !ENEMIES[e.kind].flying && (e.path === sw.path || e.path === detourIndex)) {
        const crossing = reach.nearest(e.x, e.y)
        if (this.bridgeUp && e.path === sw.path && crossing.gap < 55 && crossing.distance > 0 && crossing.distance < reach.length) {
          this.effect('fx/blink/0', e.x, e.y, .8); e.returning = 6; e.art.root.setVisible(false); e.path = detourIndex; e.distance = this.fork; this.routeFor(e).at(e.distance, e)
        } else if (!e.returning && e.distance < this.fork) { e.path = destination; e.distance = this.routeFor(e).nearest(e.x, e.y).distance }
      }
      this.hud.toast(this.bridgeUp ? 'Bridge up! New arrivals take the long way. Fallen marchers return in 6 seconds.' : 'Bridge down. Marchers past the fork keep their route.')
    }
    p.animation = 1; this.options.sfx.play('build'); this.updateWorld(0)
  }
  private drawMap() {
    if (this.textures.exists('siege-background')) this.add.image(960, 540, 'siege-background')
    else {
      const g = this.add.graphics()
      g.fillStyle(0x342741); g.fillRect(0, 0, 1920, 1080)
      g.fillStyle(0x40314a); g.fillRoundedRect(40, 135, 1840, 795, 70)
      for (let i = 0; i < 90; i++) { const x = (i * 353 % 1840) + 40, y = (i * 173 % 740) + 170; g.fillStyle(i % 3 ? 0x544550 : 0x7e674e, .35); g.fillEllipse(x, y, 18 + i % 17, 7) }
      for (const route of this.routes) {
        g.lineStyle(115, 0x251e31); g.strokePoints(route.points, false)
        g.lineStyle(99, 0x8b716b); g.strokePoints(route.points, false)
        g.lineStyle(76, 0xac8976); g.strokePoints(route.points, false)
        for (let i = 15; i < route.points.length; i += 15) { const p = route.points[i]; g.fillStyle(0xcfb08c, .45); g.fillRoundedRect(p.x - 16, p.y - 6, 33, 13, 5) }
      }
      const p = this.options.assets.geometry.porch
      g.fillStyle(0x241b30); g.fillRoundedRect(p.x - 105, p.y - 185, 190, 235, 18)
      g.fillStyle(0xffd077); g.fillRoundedRect(p.x - 62, p.y - 125, 106, 135, 12)
      g.fillStyle(0x4a344e); g.fillTriangle(p.x - 140, p.y - 175, p.x + 110, p.y - 175, p.x - 15, p.y - 280)
      g.generateTexture('siege-map-fallback', 1920, 1080); g.destroy(); this.add.image(960, 540, 'siege-map-fallback')
      this.add.text(p.x - 18, p.y - 100, 'OUR\nPORCH', { fontFamily: '"Luckiest Guy", sans-serif', fontSize: '34px', color: '#40304a', align: 'center', fontStyle: 'bold' }).setOrigin(.5)
    }
    for (const prop of this.options.assets.geometry.props) if (prop.frame) this.art.image(prop.x, prop.y, prop.frame).setOrigin(.5, 1).setScale(prop.scale ?? 1).setDepth(prop.y)
  }
  private unit(kind: EnemyKind, id: number): UnitArt {
    const body = this.art.image(0, -50, `enemy/${kind}/walk/0`)
    const anchor = this.art.anchor(kind)
    const ref = this.heads.window(id)
    const face = this.add.image(anchor.x - 64, anchor.y - 114, ref.key, ref.frame).setDisplaySize(anchor.r * 2, anchor.r * 2)
    const icons = [0, 1].map(i => this.art.image(-19 + i * 38, -150, 'mod/wind').setDisplaySize(30, 30).setVisible(false))
    const status = this.art.image(0, -85, 'status/burn/0').setVisible(false).setName('status')
    const root = this.add.container(0, 0, [body, face, ...icons, status]).setDepth(100)
    return { root, body, face, icons, statusImage: status, drawFrame: -1, faceId: id, faceLeft: false, hitTint: false, statusFrame: -1 }
  }
  private makePools() {
    for (let i = 0; i < LIMITS.enemies; i++) {
      // Allocate a neutral face once; actual random Chogs are assigned only on spawn.
      const art = this.unit('treater', this.options.hero); art.root.setVisible(false)
      this.enemies.push({ returning: 0, casting: 0, poisonStacks: 0, active: false, generation: 0, wave: 0, kind: 'treater', id: 1, mods: [], path: 0, distance: 0, speed: 0, x: 0, y: 0, hp: 0, maxHp: 0, candy: 0, jars: 1, status: clearStatuses(), age: 0, hit: 0, attack: 0, skill: 0, lucky: false, revived: false, armour: false, visible: true, art, slowPower: .5, heroDot: false, sigCooldown: 0, shield: 0, gold: 0, lit: true })
    }
    for (let i = 0; i < LIMITS.projectiles; i++) this.projectiles.push({ active: false, target: null, generation: 0, life: 0, duration: 1, x: 0, y: 0, fromX: 0, fromY: 0, endX: 0, endY: 0, damage: 0, kind: 'egg', splash: 0, image: this.art.image(0, 0, 'proj/egg').setDepth(2100).setVisible(false) })
    for (let i = 0; i < LIMITS.effects; i++) this.effects.push({ active: false, image: this.art.image(0, 0, 'fx/poof/0').setDepth(2200).setVisible(false), text: null, life: 0, duration: 0, x: 0, y: 0, toX: 0, toY: 0, size: 1, name: '', mode: 'burst', count: 1, angle: 0 })
    const texture = this.textures.createCanvas('siege-digits', 1024, 64)!, context = texture.context
    const chars: Record<number, object> = {}
    context.font = '38px "Luckiest Guy", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillStyle = '#ffffff'
    for (const [i, char] of [...'0123456789+-!'].entries()) { context.fillText(char, i * 48 + 24, 5); chars[char.charCodeAt(0)] = { x: i * 48, y: 0, width: 48, height: 52, centerX: 24, centerY: 26, xOffset: 0, yOffset: 0, xAdvance: 32, kerning: {}, data: {}, u0: i * 48 / 1024, v0: 0, u1: (i + 1) * 48 / 1024, v1: 52 / 64 } }
    texture.refresh(); this.cache.bitmapFont.add('siege-digits', { data: { font: 'siege-digits', size: 40, lineHeight: 52, chars }, texture: 'siege-digits', frame: null })
    for (let i = 0; i < LIMITS.numbers; i++) this.numbers.push({ active: false, text: this.add.bitmapText(0, 0, 'siege-digits', '', 34).setOrigin(.5).setDepth(2300).setVisible(false), life: 0, x: 0, y: 0 })
  }
  // Edge swarms (Witching Hour) start just outside the visible view and walk straight at the porch; ghosts weave as they drift.
  private wildRoute(edge: number, kind: EnemyKind) {
    const half = this.cameras.main.width / this.renderScale / 2, porch = this.options.assets.geometry.porch
    const at = (t: number) => edge === 0 ? { x: 960 - half - 90, y: 60 + t * 960 } : edge === 1 ? { x: 960 + half + 90, y: 60 + t * 960 } : edge === 2 ? { x: 960 - half + 60 + t * (half * 2 - 120), y: -90 } : { x: 960 - half + 60 + t * (half * 2 - 120), y: 1170 }
    // Keep at least a few seconds of flight: an edge that is nearly on top of the porch is re-rolled along that edge.
    let from = at(.1 + this.random() * .8)
    for (let attempt = 0; attempt < 5 && Math.hypot(from.x - porch.x, from.y - porch.y) < 430; attempt++) from = at(.1 + this.random() * .8)
    return Route.wild(from, porch, kind === 'ghost' ? 55 + this.random() * 55 : 0, this.random() * 6.28)
  }
  private spawn(entry: Spawn): boolean {
    if (entry.boss) return spawnBoss(this, entry.boss, entry.wave)
    const { kind, path, wave, distance = 0, route } = entry
    const enemy = this.enemies.find(e => !e.active)
    if (!enemy) return false
    const id = entry.chogId ?? 1 + Math.floor(this.random() * 1969), traits = traitsFor(this.options.assets.traits, id), mods = modifiersFor(traits), config = ENEMIES[kind]
    const multiplier = 1 + eliteBonus(traits) * .5, health = this.healthScale(wave), wild = entry.edge === undefined ? undefined : this.wildRoute(entry.edge, kind)
    Object.assign(enemy, { active: true, generation: enemy.generation + 1, wave, kind, id, mods, path: wild ? -1 : route ?? this.roadFor(kind, path), route: wild, boss: undefined, distance, returning: 0, casting: 0, poisonStacks: 0, speed: config.speed * (mods.includes('wind') ? 1.2 : 1) * this.speedScale, hp: config.hp * multiplier * health, maxHp: config.hp * multiplier * health, candy: entry.risen ? 0 : Math.round(config.candy * multiplier * (mods.includes('rich') ? 2 : 1) * (this.level.endless ? 1 + wave * .02 : 1)), jars: Math.max(config.jars, mods.includes('hungry') ? 2 : 1), age: 0, hit: 0, attack: .5, skill: 4 + this.random() * 2, lucky: false, revived: false, armour: false, visible: kind !== 'ghost', slowPower: .5, heroDot: false, sigCooldown: 0, shield: 0, gold: 0, lit: true })
    for (const key of Object.keys(enemy.status) as Status[]) enemy.status[key] = 0
    this.art.set(enemy.art.body, `enemy/${kind}/walk/0`)
    const ref = this.heads.window(id)
    enemy.art.face.setTexture(ref.key, ref.frame).setVisible(true)
    enemy.art.root.setVisible(true).setAlpha(1).setScale(1)
    enemy.art.body.clearTint(); enemy.art.face.clearTint(); enemy.art.drawFrame = -1; enemy.art.faceId = -1; enemy.art.hitTint = false; enemy.art.statusFrame = -1
    enemy.art.icons.forEach((icon, i) => { icon.setVisible(!!mods[i]); if (mods[i]) this.art.set(icon, `mod/${mods[i]}`) })
    this.routeFor(enemy).at(distance, enemy)
    this.waveAlive[wave] = (this.waveAlive[wave] ?? 0) + 1
    const fresh = !this.discovered.has(`enemy/${kind}`)
    this.discover([`enemy/${kind}`, ...mods.map(m => `mod/${m}`)])
    if (fresh && !this.focus.active) { this.setPaused(true); this.options.onIntro(kind) }
    return true
  }
  callWave() {
    if (this.paused || this.ended || this.wave >= this.waveCount || (this.options.tutorial && this.tutorialStep === 0)) return
    this.hud.closePreview()
    const early = this.wave > 0 ? Math.ceil(Math.max(0, this.countdown) * 1.5) : 0
    if (early) { this.earlyCalls++; this.income(early); this.hud.toast(`Early call! +${early} candy`) }
    const data = this.waveAt(this.wave)!
    const wave = this.wave++
    this.hero.onWave()
    this.waveAlive[wave] = 0
    // Witching Hour: the edge swarms start three seconds after the warning, spread over all four edges.
    const warning = data.witching ? WITCHING_WARNING : 0
    let edge = Math.floor(this.random() * 4)
    for (const group of data.groups) for (let i = 0; i < group.count * (group.type === 'skeleton' ? 5 : 1); i++) this.schedule.push({ chogId: 1 + Math.floor(this.random() * 1969), time: this.clock + (group.edge ? warning : 0) + (group.delay ?? 0) + (group.type === 'skeleton' ? Math.floor(i / 5) * group.interval + i % 5 * .09 : i * group.interval), kind: group.type, path: group.path ?? 0, wave, ...(group.edge ? { edge: edge++ % 4 } : {}) })
    this.heads.prepare(this.schedule.filter(entry => entry.wave === wave && entry.chogId !== undefined).map(entry => entry.chogId!))
    if (data.boss) { this.schedule.push({ time: this.clock + (data.boss.delay ?? 0), kind: 'treater', path: 0, wave, boss: data.boss }); preloadBoss(this, data.boss.id) }
    // The next wave's boss art starts downloading now, so it is ready when the wave comes.
    const next = this.waveAt(this.wave)
    if (next?.boss) preloadBoss(this, next.boss.id)
    this.schedule.sort((a, b) => a.time - b.time)
    this.countdown = next?.countdown ?? 0
    this.options.sfx.play('wave-horn')
    if (data.witching) { this.warning = { until: this.clock + warning }; this.hud.banner("WITCHING HOUR: they're coming from everywhere!") }
    else this.hud.banner(`WAVE ${this.wave}  ·  ${data.name}`)
    this.tutorial('wave'); this.hud.refresh()
  }
  update(_time: number, delta: number) {
    if (!this.ready) return
    if (this.quality.update(this.game.loop.rawDelta, !this.paused && !this.ended && !this.focus.active)) this.applyQuality()
    const real = Math.min(delta / 1000, .06)
    this.hudTime += real; this.portraitTime += real
    if (this.portraitTime > .2) { this.art.refresh(); this.portraitTime = 0 }
    if (this.hudTime > .12) { this.hud.refresh(); this.hudTime = 0 }
    if (this.ended) {
      const clip = this.options.assets.rig.clips[this.hero.rig.clip]
      if (this.hero.rig.clip.startsWith('dance-') && !clip.loop && this.hero.rig.time >= clip.ms) this.hero.rig.play(this.hero.rig.clip)
      this.hero.rig.update(real); this.updateSignatures(real); this.updateEffects(real); this.drawUnits(real); return
    }
    if (this.paused) return
    if (this.focus.waiting) { this.drawUnits(0); this.drawSelection(); this.focus.draw(); this.hud.animate(this.time.now / 1000, real); return }
    if (this.holdAt && this.input.activePointer.isDown) {
      if (distanceSq(this.holdAt, this.pointer) > 28 ** 2) this.holdAt = null
      else { this.holdTime += real; if (this.holdTime > .55) { this.holdAt = null; this.toggleEmotes() } }
    }
    this.accumulator += real * this.speed * (this.slowBeat > 0 ? .25 : 1)
    this.slowBeat = Math.max(0, this.slowBeat - real)
    while (this.accumulator >= 1 / 45 && !this.paused && !this.ended) { this.tick(1 / 45); this.accumulator -= 1 / 45 }
    this.drawUnits(real * this.speed)
    this.drawSelection()
    this.hud.animate(this.clock, real)
    this.focus.draw()
  }
  tick(dt: number) {
    if (this.focus.waiting) return
    this.clock += dt
    this.updateWorld(dt)
    while (this.schedule[0]?.time <= this.clock) { const entry = this.schedule[0]; if (!this.spawn(entry)) break; this.schedule.shift(); if (this.paused) return }
    if (this.wave > 0 && this.wave < this.waveCount && !this.schedule.some(s => s.wave === this.wave - 1)) {
      // Tutorial actions get breathing room before the second wave calls itself.
      if (this.tutorialStep >= TUTORIAL.length) this.countdown -= dt
      if (this.countdown <= 0) this.callWave()
    }
    for (let w = 0; w < this.wave; w++) if (!this.rewarded.has(w) && !this.waveAlive[w] && !this.schedule.some(s => s.wave === w)) {
      const bonus = this.waveAt(w)!.bonus
      this.rewarded.add(w); this.income(bonus); this.hud.toast(`Wave cleared! +${Math.round(bonus * this.candyScale)} candy`)
    }
    for (const key of ['rain', 'boo'] as const) this.spellCooldown[key] = Math.max(0, this.spellCooldown[key] - dt)
    this.missTime = Math.max(0, this.missTime - dt)
    // Keep the rain lesson targets alive until the player casts; an upgraded Egg Stand would pick them off.
    if (this.tutorialStep !== 4) { this.updateTowers(dt); this.hero.update(dt) }
    this.updateLights(); this.darkness?.update(this.sources, dt, this.bonfire > 0)
    this.updateSignatures(dt)
    this.crowns.length = 0
    for (const enemy of this.enemies) if (enemy.active && enemy.mods.includes('crown')) this.crowns.push(enemy)
    for (const enemy of this.enemies) if (enemy.active) this.updateEnemy(enemy, dt)
    for (let i = this.later.length - 1; i >= 0; i--) if (this.later[i].at <= this.clock) { const { run } = this.later[i]; this.later.splice(i, 1); run() }
    this.updateAllies(dt); this.updateHazards(dt)
    this.updateProjectiles(dt)
    this.updateTraps(dt); updateConsumables(this, dt)
    this.updateEffects(dt)
    updateCorpses(this, dt)
    if (this.jars <= 0) this.finish(false)
    else if (this.wave === this.waveCount && !this.schedule.length && !this.enemies.some(e => e.active)) this.finish(true)
  }
  // Zombies and risen enemies fight beside the guards for a while, then crumble.
  summon(x: number, y: number, tint: number, life: number, hp: number, damage: number) {
    if (this.allies.length >= 8) return
    const image = this.art.image(x, y - 35, 'guard/knight/walk/0').setDisplaySize(75, 75).setTint(tint)
    this.allies.push({ x, y, hp, maxHp: hp, respawn: 0, cooldown: 0, slow: 0, image, life, damage })
    this.effect('fx/poof/0', x, y - 40, .5, 1)
  }
  // A wall of shields blocks the march for a few seconds.
  wall(x: number, y: number, life: number, name: string) {
    this.blockers.push({ x, y, life, radius: 80, image: this.art.image(x, y - 30, name).setDepth(y + 5) })
    this.effect('fx/poof/0', x, y - 30, .5, 1.2)
  }
  private updateAllies(dt: number) {
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i]
      a.life -= dt; a.cooldown -= dt
      if (a.life <= 0 || a.hp <= 0) { this.effect('fx/poof/0', a.x, a.y - 40, .5); a.image.destroy(); this.allies.splice(i, 1); continue }
      const target = this.target(a, 170, 'close', true)
      if (target && a.cooldown <= 0) { this.damage(target, a.damage, 'physical'); a.cooldown = .9; this.art.set(a.image, 'guard/knight/attack/0') }
      else this.art.set(a.image, `guard/knight/walk/${Math.floor(this.clock * 7) % 6}`)
      a.image.setPosition(a.x, a.y - 35).setDepth(a.y + 10)
    }
    for (let i = this.blockers.length - 1; i >= 0; i--) { const wall = this.blockers[i]; wall.life -= dt; wall.image.setAlpha(Math.min(1, wall.life)); if (wall.life <= 0) { wall.image.destroy(); this.blockers.splice(i, 1) } }
  }
  // Burning footprints: they scorch guards and the hero for a few seconds.
  private updateHazards(dt: number) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.life -= dt; h.pulse -= dt
      if (h.life <= 0) { this.hazards.splice(i, 1); continue }
      if (h.pulse > 0) continue
      h.pulse = .5; this.effect('status/burn/0', h.x, h.y - 20, .6, 1.3)
      for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (guard.hp > 0 && distanceSq(guard, h) < h.r ** 2) guard.hp -= 14
      for (const ally of this.allies) if (distanceSq(ally, h) < h.r ** 2) ally.hp -= 14
      if (this.hero.alive && distanceSq(this.hero, h) < h.r ** 2) this.hero.hurt(5)
    }
  }
  // The Scream: the world wobbles for a moment.
  warp() {
    if (reducedMotion() || !this.settings.shake) return
    const camera = this.cameras.main, wobble = { t: 0 }
    this.tweens.add({ targets: wobble, t: 1, duration: 1400, onUpdate: () => camera.setRotation(Math.sin(wobble.t * Math.PI * 6) * .03 * (1 - wobble.t)), onComplete: () => camera.setRotation(0) })
  }
  private updateEnemy(e: Enemy, dt: number) {
    if (e.returning > 0) { e.returning = Math.max(0, e.returning - dt); if (!e.returning) this.effect('fx/poof/0', e.x, e.y - 20, .5, 1.2); if (!e.boss) e.art.root.setVisible(e.returning === 0); return }
    e.sigCooldown = Math.max(0, e.sigCooldown - dt)
    e.age += dt; e.hit = Math.max(0, e.hit - dt); e.attack -= dt; e.skill -= dt
    for (const status of STATUS_KEYS) e.status[status] = Math.max(0, e.status[status] - dt)
    if (e.status.burn || e.status.poison || e.status.bleed) { this.damage(e, ((e.status.burn ? 13 : 0) + (e.status.poison ? 10 * Math.max(1, e.poisonStacks) : 0) + (e.status.bleed ? 12 : 0)) * dt, 'magic', false, e.heroDot); if (!e.active) return }
    if (!e.status.poison) e.poisonStacks = 0
    if (e.boss) updateBoss(this, e, dt)
    e.shield = Math.max(0, e.shield - dt); e.gold = Math.max(0, e.gold - dt)
    // On a dark map only light shows an enemy, and what can't be seen can't be hit; the bonfire (and Target Lock) reveal everything.
    e.lit = this.isLit(e)
    if (this.bonfire > 0) e.status.reveal = Math.max(e.status.reveal, .2)
    e.visible = (e.kind !== 'ghost' || e.status.reveal > 0) && (!this.dark || e.lit || e.status.reveal > 0 || !!e.boss)
    e.armour = e.mods.includes('metal')
    for (const other of this.crowns) if (other.active && !other.returning && other !== e && distanceSq(e, other) < 160 ** 2) { e.armour = true; break }
    if (e.skill <= 0 && !e.status.stun && !e.status.freeze && !e.status.fear && !e.status.charm && !e.status.confuse) {
      if (e.kind === 'witch') {
        e.casting = .7
        this.effect('fx/heal/0', e.x, e.y - 50, .7)
        for (const other of this.enemies) if (other.active && !other.returning && distanceSq(e, other) < 200 ** 2) { other.hp = Math.min(other.maxHp, other.hp + 45); this.effect('fx/heal/0', other.x, other.y - 45, .7, .65) }
      }
      if (e.mods.includes('laser')) {
        const tower = this.towers.find(t => t && distanceSq(e, t) < 350 ** 2)
        if (tower) { tower.stun = 1; this.addBeam(e, { x: tower.x, y: tower.y - 100 }, 0xff747f); this.effect('status/freeze/0', tower.x, tower.y - 120, 1, 1.4) }
      }
      if (e.mods.includes('wizard') && !e.status.stun) { e.distance += 80; this.effect('fx/poof/0', e.x, e.y - 50, .6) }
      if (e.mods.includes('gum')) for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (distanceSq(e, guard) < 120 ** 2) { guard.slow = 3; this.effect('trap/gum/0', guard.x, guard.y, .7, .5) }
      e.skill = 6
    }
    if (e.casting > 0) {
      e.casting = Math.max(0, e.casting - dt)
      if (!e.casting && !e.status.stun && !e.status.freeze && !e.status.root) { this.effect('fx/blink/0', e.x, e.y - 50, .6); e.distance += 120; this.routeFor(e).at(e.distance, e); this.effect('fx/blink/0', e.x, e.y - 50, .6) }
      return
    }
    if (e.status.charm > 0) {
      const target = this.target(e, 240, 'close')
      if (target && e.attack <= 0 && !e.status.stun && !e.status.freeze) { this.damage(target, Math.max(20, e.maxHp * .12), 'physical', true, true); e.attack = .65; this.addBeam(e, target, 0xff9fc9) }
      return
    }
    let blocked = false
    if (!ENEMIES[e.kind].flying || e.status.ground > 0) for (const item of this.items) if (item.kind === 'candy-cane' && distanceSq(e, item) < CONSUMABLES['candy-cane'].radius ** 2) { blocked = true; break }
    if ((!ENEMIES[e.kind].flying || e.status.ground > 0) && e.visible && !e.status.fear) {
      // Tower guards and temporary allies hold the road alike; a blocker is a wall that is only walked into.
      for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (this.clash(e, guard)) blocked = true
      for (const ally of this.allies) if (this.clash(e, ally)) blocked = true
      for (const wall of this.blockers) if (distanceSq(e, wall) < wall.radius ** 2) blocked = true
    }
    if (e.mods.includes('toxic')) for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (guard.hp > 0 && distanceSq(e, guard) < 110 ** 2) guard.hp -= dt * 12
    if (this.hero.hp > 0 && distanceSq(e, this.hero) < 90 ** 2) {
      if (e.mods.includes('toxic')) this.hero.hurt(10 * dt * this.hero.enemyDamage(e))
      if (e.attack <= 0 && !e.status.stun && !e.status.freeze && !e.status.fear) { this.hero.hurt((e.boss ? 24 : 11) * this.hero.enemyDamage(e)); e.attack = 1 }
    }
    const slow = e.status.slow && !e.mods.includes('burning') ? e.slowPower : 1
    const candle = e.mods.includes('candle') ? (Math.floor(e.age / 3) % 2 ? .65 : 1.5) : 1
    // Radioactive Ridge: ground enemies inside a toxic pool move 30% faster.
    let toxic = 1
    if (!e.route && !ENEMIES[e.kind].flying) for (const z of this.zones) if (distanceSq(e, z) < z.r ** 2) { toxic = 1.3; break }
    const decoy = !e.boss && !ENEMIES[e.kind].flying && !e.mods.includes('visor') && !e.status.fear ? this.items.find(item => item.kind === 'scarecrow' && item.hp > 0 && distanceSq(e, item) < CONSUMABLES.scarecrow.radius ** 2) : undefined
    const lure = decoy ? this.routeFor(e).nearest(decoy.x, decoy.y).distance : 0
    if (decoy && !blocked && !e.status.stun && !e.status.freeze && !e.status.root) {
      e.distance += Phaser.Math.Clamp(lure - e.distance, -dt * e.speed * slow, dt * e.speed * slow)
      if (Math.abs(e.distance - lure) < 55 && e.attack <= 0) { decoy.hp -= 24; e.attack = .8; this.effect('item/scarecrow/fx/0', decoy.x, decoy.y - 50, .3, .6) }
    }
    const held = !!decoy || !!e.boss && (e.boss.casting > 0 || e.boss.intro > 0 || e.boss.dash > 0)
    if (!e.status.stun && !e.status.freeze && !e.status.root && (!blocked || e.status.fear) && !held) e.distance += dt * e.speed * slow * candle * toxic * this.hero.enemySpeed(e) * (e.status.fear ? -1.25 : e.status.confuse ? Math.sin(e.age * 3) : 1)
    e.distance = Math.max(0, e.distance)
    // Mon Manor: walking into a portal comes out of its twin further along; flyers pass over.
    if (!e.route && !ENEMIES[e.kind].flying) for (const portal of this.portals) if (e.path === portal.path && e.distance >= portal.at && e.distance < portal.to) {
      this.effect('fx/teleport/0', e.x, e.y - 20, .6, 1.3); e.distance = portal.to + 4; this.routeFor(e).at(e.distance, e); this.effect('fx/teleport/0', e.x, e.y - 20, .6, 1.3)
    }
    this.routeFor(e).at(e.distance, e)
    if (decoy) { const pull = Math.max(0, 1 - Math.abs(e.distance - lure) / 70); e.x += (decoy.x - e.x) * pull; e.y += (decoy.y - e.y) * pull }
    if (e.distance >= this.routeFor(e).length) {
      if (e.kind === 'goblin') { this.effect('enemy/goblin/grab/0', e.x, e.y - 50, .7); this.exitPortrait(e, 'grab', .7, 1); this.effect('fx/grab/0', e.x, e.y - 75, .7) }
      this.jars = Math.max(0, this.jars - e.jars)
      this.effect('ui/jar', e.x, e.y - 60, 1.2, .65, 'jar', e.x + 150, e.y - 170)
      if (!e.boss) this.signature(e, true)
      this.options.sfx.play('jar-stolen'); this.shake(.004)
      this.removeEnemy(e)
    }
  }
  private clash(e: Enemy, guard: { x: number; y: number; hp: number }) {
    if (guard.hp <= 0 || distanceSq(e, guard) >= 66 ** 2) return false
    if (e.attack <= 0 && !e.status.stun && !e.status.freeze) { guard.hp -= (e.mods.includes('knife') ? 45 : e.boss ? 48 : 16) * this.hero.enemyDamage(e); e.attack = .8; this.effect('fx/splat/0', guard.x, guard.y - 30, .25, .4) }
    return true
  }
  private updateTowers(dt: number) {
    for (const tower of this.towers) if (tower) {
      tower.stun = Math.max(0, tower.stun - dt); tower.gold = Math.max(0, tower.gold - dt); tower.cooldown -= dt * this.hero.towerSpeed(tower) * (this.sugarRush > 0 ? 1.6 : 1); tower.pop = Math.max(0, tower.pop - dt)
      const config = towerStats(tower)
      if (tower.stun) continue
      if (tower.kind === 'lantern') for (const e of this.enemies) if (e.active && distanceSq(tower, e) <= config.range ** 2) { this.status(e, 'reveal', .2); e.visible = true }
      if (tower.kind === 'patch') {
        for (const guard of tower.guards) {
          guard.slow = Math.max(0, guard.slow - dt); guard.cooldown -= dt * (guard.slow ? .5 : 1) * this.hero.towerSpeed(tower) * (this.sugarRush > 0 ? 1.6 : 1)
          if (guard.hp <= 0) { guard.respawn -= dt; guard.image.setAlpha(.2); if (guard.respawn <= 0) { guard.hp = guard.maxHp; guard.respawn = 8; this.effect('fx/poof/0', guard.x, guard.y - 40, .5) }; continue }
          const target = this.target(guard, 150, 'close', true)
          if (target && guard.cooldown <= 0) { this.damage(target, config.damage * this.towerBuff(tower) * (tower.spec === 'knights' ? 1.4 : 1), 'physical'); if (tower.spec === 'vines') { this.status(target, 'root', 1 + tower.rank * .3); this.effect('fx/vines/0', target.x, target.y, .8) }; guard.cooldown = config.interval; this.art.set(guard.image, `guard/${tower.spec === 'knights' ? 'jack' : 'knight'}/attack/0`); if (!target.mods.includes('slippery')) target.distance = Math.max(0, target.distance - 5) }
          else this.art.set(guard.image, `guard/${tower.spec === 'knights' ? 'jack' : 'knight'}/walk/${Math.floor(this.clock * 7) % 6}`)
          guard.image.setPosition(guard.x, guard.y - 35).setAlpha(1).setDepth(guard.y + 10)
        }
      } else if (tower.cooldown <= 0) {
        const target = this.target(tower, config.range, tower.targeting, tower.kind === 'cauldron' || tower.kind === 'catapult', tower.kind === 'roost', tower.kind === 'lighthouse')
        // The Scream: half the shots go wide.
        if (target && this.missTime > 0 && this.random() < .5) { tower.cooldown = config.interval; this.effect('fx/poof/0', tower.x, tower.y - 120, .4, .8) }
        else if (target && this.towerAttack(tower, target)) { tower.cooldown = config.interval; tower.pop = .15; this.options.sfx.tower(tower.kind) }
      }
    }
  }
  private towerBuff(tower: Tower) { return this.hero.towerBuff(tower) }
  target(from: Point, range: number, mode: string, ground = false, air = false, hidden = false): Enemy | null {
    let best: Enemy | null = null, score = -Infinity
    for (const e of this.enemies) if (e.active && !e.returning && (e.visible || hidden) && (!air || ENEMIES[e.kind].flying) && e.status.charm <= 0 && (!ground || !ENEMIES[e.kind].flying || e.status.ground > 0)) {
      const distance = distanceSq(from, e)
      if (distance > range * range) continue
      const progress = e.distance / this.routeFor(e).length
      const next = mode === 'last' ? -progress : mode === 'strong' ? e.hp : mode === 'close' ? -distance : progress
      if (next > score) { score = next; best = e }
    }
    return best
  }
  heroAbility() { this.command({ type: 'ability' }) }
  abilityName() { return this.options.assets.kits.slots.special[this.hero.kit.special].name }
  fire(x: number, y: number, target: Enemy, damage: number, kind: TowerKind | 'hero', splash: number, options?: { frame: string; duration: number; arc: number; onHit: (enemy: Enemy) => void; after?: () => void }): boolean {
    const p = this.projectiles.find(item => !item.active)
    if (!p) return false
    Object.assign(p, { active: true, target, generation: target.generation, fromX: x, fromY: y, x, y, endX: target.x, endY: target.y - 45, life: 0, duration: options?.duration ?? (kind === 'tp' ? .5 : .23), damage, kind, splash, arc: options?.arc ?? (kind === 'tp' ? 130 : 30), frame: options?.frame, frameCount: options ? this.art.count(options.frame) : 1, onHit: options?.onHit, after: options?.after })
    this.art.set(p.image, options?.frame ?? `proj/${kind === 'hero' ? 'seed' : TOWERS[kind].projectile}`); p.image.setVisible(true).setPosition(x, y).setDisplaySize(kind === 'tp' ? 42 : 30, kind === 'tp' ? 42 : 30)
    if (options) p.image.setScale(1).setRotation(Math.atan2(target.y - y, target.x - x))
    return true
  }
  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) if (p.active) {
      p.life += dt
      if (p.frame && p.frameCount! > 1) this.art.set(p.image, p.frame.replace(/\/\d+$/, `/${Math.floor(p.life * 12) % p.frameCount!}`))
      if (p.target?.active && p.target.generation === p.generation) { p.endX = p.target.x; p.endY = p.target.y - 45 }
      const t = Math.min(1, p.life / p.duration)
      p.x = Phaser.Math.Linear(p.fromX, p.endX, t); p.y = Phaser.Math.Linear(p.fromY, p.endY, t) - Math.sin(t * Math.PI) * (p.arc ?? 30)
      p.image.setPosition(p.x, p.y).setRotation(p.kind === 'hero' || p.kind === 'roost' ? Math.atan2(p.endY - p.fromY, p.endX - p.fromX) : t * 5)
      if (t >= 1) {
        p.active = false; p.image.setVisible(false)
        const validTarget = p.target?.active && p.target.generation === p.generation
        const hit = (e: Enemy) => {
          if (!e.visible || e.status.charm > 0) return
          const egg = p.kind === 'egg' || p.kind === 'hero' && this.hero.kit.weapon === 'egg-lob'
          if (egg && e.status.wrap > 0) { e.status.wrap = 0; this.combo('eggsplosion', e); this.effect('fx/eggsplosion/0', e.x, e.y - 40, .7, 1.8); for (const other of this.enemies) if (other.active && other !== e && distanceSq(other, e) < (Math.max(75, p.splash) * 2) ** 2) this.damage(other, p.damage, 'magic', true, p.kind === 'hero') }
          if (p.onHit) { p.onHit(e); return }
          const landed = this.damage(e, p.damage, p.kind === 'lantern' ? 'magic' : p.kind === 'egg' ? 'egg' : 'physical')
          if (!landed || !e.active) return
          if (p.kind === 'tp') { this.status(e, 'slow', 2); this.status(e, 'wrap', 3); e.slowPower = .5 }

        }
        if (p.splash) for (const e of this.enemies) { if (e.active && distanceSq(e, { x: p.endX, y: p.endY + 45 }) <= p.splash ** 2) hit(e) }
        else if (p.target?.active && p.target.generation === p.generation) hit(p.target)
        if (validTarget) p.after?.()
        const heroHit = `hero-${this.hero.kit.costume}:wpn/hit/0`
        const hasHeroHit = p.kind === 'hero' && this.textures.get(`hero-${this.hero.kit.costume}`).has('wpn/hit/0')
        this.effect(hasHeroHit ? heroHit : p.kind === 'tp' ? 'fx/tp-wrap/0' : 'fx/splat/0', p.endX, p.endY, .32, p.splash ? 1.3 : .55)
        this.options.sfx.play('splat')
      }
    }
  }
  damage(e: Enemy, amount: number, type: 'magic' | 'physical' | 'egg', feedback = true, hero = false): boolean {
    if (!e.active || e.returning) return false
    if (feedback && e.mods.includes('smoke') && this.random() < .2) { this.effect('fx/poof/0', e.x, e.y - 50, .4, .75); return false }
    if (type !== 'magic') { if (e.kind === 'pumpkin' && type === 'egg') amount *= .2; if (e.armour) amount *= .65 }
    if (e.status.mark > 0) amount *= 1.5
    if (this.crew === 4 && ENEMIES[e.kind].flying) amount *= 1.25
    // Testudo and the Pumpkin's split absorb the hit; Sanctuary's shield turns it aside.
    if (e.boss && bossAbsorbs(this, e, feedback)) return false
    if (e.shield > 0) { if (feedback) this.effect('fx/crit/0', e.x, e.y - 80, .3, .7); return false }
    if (hero) { this.hero.dealt += Math.min(e.hp, amount); this.hero.addCharge(Math.min(e.hp, amount) * .022) }
    e.hp -= amount
    if (feedback) {
      e.hit = .16
      if (!e.mods.includes('slippery') && !e.boss) e.distance = Math.max(0, e.distance - Math.min(9, amount * .13))
      this.number(Math.ceil(amount), e.x, e.y - (e.boss ? 210 : 120), type === 'magic' ? 0xd3b0ff : 0xfff1c6)
      if (amount >= e.maxHp * .4 && !e.boss) this.signature(e, e.hp <= 0)
    }
    if (e.hp <= 0) {
      if (e.boss && bossRevives(this, e)) return true
      if (e.mods.includes('lucky') && !e.lucky) { e.lucky = true; e.hp = 1; this.effect('fx/levelup/0', e.x, e.y - 50, .5); return true }
      if (e.mods.includes('skull') && !e.revived) { e.revived = true; e.hp = e.maxHp * .4; this.status(e, 'stun', .7); this.effect('fx/poof/0', e.x, e.y - 50, .6); return true }
      this.kills++; this.income(this.hero.killIncome(e.candy) * (this.options.street.chog ? 1.1 : 1)); this.hero.onKill(e)
      // The last few fallen ground enemies can be raised again (Brainz).
      if (!e.boss && !e.route && e.path >= 0) { this.fallen.push({ kind: e.kind, path: e.path }); if (this.fallen.length > 8) this.fallen.shift() }
      if (e.boss) bossDeath(this, e)
      else {
        const count = this.settings.lite ? 2 : 4
        for (let i = 0; i < count; i++) this.effect('fx/coin', e.x + (this.visualRandom() - .5) * 50, e.y - 60, .65 + i * .1, .25, 'coin', 261, 82)
        this.effect(`enemy/${e.kind}/die/0`, e.x, e.y - 50, .3, .9)
        this.exitPortrait(e, 'die', .1, .9)
        this.effect('fx/candy-burst/0', e.x, e.y - 50, .5, .8)
        if (e.kind === 'skeleton') this.effect('fx/bones/0', e.x, e.y - 35, .7)
        if (e.kind === 'mummy') {
          this.effect('fx/split/0', e.x, e.y - 45, .7)
          for (let i = 0; i < 2; i++) this.schedule.push({ kind: 'mini', path: 0, route: e.path, wave: e.wave, time: this.clock + .05 + i * .18, distance: Math.max(0, e.distance - i * 18) })
          this.schedule.sort((a, b) => a.time - b.time)
        }
      }
      this.options.sfx.play('coin'); this.removeEnemy(e)
    }
    return true
  }
  private exitPortrait(e: Enemy, state: 'die' | 'grab', duration: number, scale: number) {
    const a = this.art.anchor(e.kind, 0, false, state)
    if (a.r > 0) {
      const left = e.art.body.flipX, ref = this.heads.window(e.id, left)
      this.effect(`${ref.key}:${ref.frame}`, e.x + (a.x - 64) * scale * (left ? -1 : 1), e.y - 50 + (a.y - 64) * scale, duration, a.r * 2 / e.art.face.width * scale)
    }
  }
  private removeEnemy(e: Enemy) { releaseBoss(this, e); e.active = false; e.art.root.setVisible(false); this.waveAlive[e.wave] = Math.max(0, this.waveAlive[e.wave] - 1) }
  private isLit(e: Enemy) {
    if (!this.dark || this.bonfire > 0) return true
    for (const light of this.sources) if (distanceSq(e, light) < light.r * light.r) return true
    return false
  }
  // Everything that casts light on a dark map: the street lights, each lantern's range, your Chog and the bonfire.
  updateLights() {
    this.lightCount = 0
    if (!this.dark) { this.sources.length = 0; return }
    const flicker = 1 + Math.sin(this.clock * 5) * .02
    for (const light of this.options.assets.geometry.lights ?? []) this.light(light.x, light.y, light.r * flicker)
    for (const t of this.towers) if (t?.kind === 'lantern') this.light(t.x, t.y - 60, towerStats(t).range)
    for (const e of this.enemies) if (e.active && e.status.reveal > 0) this.light(e.x, e.y - 45, 85)
    this.light(this.hero.x, this.hero.y - 40, 210)
    for (const p of this.props) if (p.data.kind === 'bonfire') this.light(p.data.x, p.data.y - 40, this.bonfire > 0 ? 260 : 75)
    this.sources.length = this.lightCount
  }
  private light(x: number, y: number, r: number) {
    const i = this.lightCount++, light = this.lightPool[i] ?? (this.lightPool[i] = { x: 0, y: 0, r: 0 })
    light.x = x; light.y = y; light.r = r; this.sources[i] = light
  }
  status(e: Enemy, status: Status, duration: number) {
    if (!e.active || e.returning || (status === 'slow' && e.mods.includes('burning'))) return
    // Bosses shrug off most control: no fear, charm or twisters, and the rest lasts about a third as long.
    if (e.boss) { if (status === 'fear' || status === 'charm' || status === 'ground') return; if (['slow', 'stun', 'freeze', 'root', 'wrap', 'confuse'].includes(status)) duration *= .35 }
    e.status[status] = Math.max(e.status[status], duration)
    if (status === 'charm') this.combo('charm', e)
  }
  income(amount: number) { this.candy += Math.round(amount * this.candyScale) }
  private build(kind: TowerKind, padIndex: number) {
    if (this.paused || this.ended || padIndex < 0 || this.towers[padIndex]) return
    if (this.tutorialStep === 0 && (kind !== 'egg' || padIndex !== 0)) { this.hud.toast('Start with an Egg Stand on the glowing pad.'); return }
    const locked = this.towerLock(kind)
    if (locked) { this.hud.toast(locked); return }
    const cost = TOWERS[kind].levels[0].cost
    if (this.candy < cost) { this.hud.toast('A little more candy first!'); return }
    const pad = this.options.assets.geometry.pads[padIndex]
    const tower: Tower = { ...pad, kind, level: 1, spec: null, rank: 0, spent: cost, targeting: 'first', cooldown: 0, stun: 0, image: this.art.image(pad.x, pad.y - 90, this.towerFrame(kind, 1)).setDepth(pad.y).setDisplaySize(144, 180), guards: [], pop: .4, boost: !!pad.boost, gold: 0 }
    this.discover([`tower/${kind}`]); this.towers[padIndex] = tower; this.candy -= cost
    if (kind === 'patch') this.guardsFor(tower)
    this.effect('fx/poof/0', pad.x, pad.y - 60, .6, 1.4); this.options.sfx.play('build'); this.tutorial('build'); this.cancel(); this.hud.toast(`${TOWERS[kind].name} built`); this.hud.refresh()
  }
  private upgrade(padIndex: number) {
    const tower = this.towers[padIndex]
    if (this.paused || this.ended || !tower || tower.level >= 3 && (!tower.spec || tower.rank >= 2)) return
    const cost = tower.spec ? rankCost(tower.rank) : TOWERS[tower.kind].levels[tower.level].cost
    if (this.candy < cost) { this.hud.toast('A little more candy first!'); return }
    this.candy -= cost; tower.spent += cost; if (tower.spec) tower.rank++; else tower.level++; tower.pop = .4
    this.art.set(tower.image, this.towerFrame(tower.kind, tower.level, tower.spec))
    if (tower.kind === 'patch') this.guardsFor(tower)
    this.effect('fx/levelup/0', tower.x, tower.y - 70, .8, 1.5); this.options.sfx.play('upgrade'); this.tutorial('upgrade'); this.cancel(); this.hud.toast(tower.spec ? `${SPECIALISATIONS[tower.spec].name} · Rank ${tower.rank}` : `${TOWERS[tower.kind].name} · Level ${tower.level}`); this.hud.refresh()
  }
  private sell(padIndex: number) {
    const tower = this.towers[padIndex]
    if (this.paused || this.ended || !tower) return
    if (this.tutorialStep < 3) { this.hud.toast('Keep your first tower for the tutorial.'); return }
    this.candy += Math.floor(tower.spent * .7); tower.image.destroy(); for (const guard of tower.guards) guard.image.destroy(); this.towers[padIndex] = null
    this.options.sfx.play('coin'); this.cancel(); this.hud.toast(`Tower sold · +${Math.floor(tower.spent * .7)} candy`); this.hud.refresh()
  }
  private guardsFor(tower: Tower) {
    const config = towerStats(tower), near = this.nearestPath(tower.x, tower.y)
    while (tower.guards.length < config.guards) {
      const i = tower.guards.length, x = near.x + (i - 1) * 43, y = near.y + (i % 2 ? 20 : -8)
      tower.guards.push({ x, y, hp: 100, maxHp: 100, respawn: 8, cooldown: 0, slow: 0, image: this.art.image(x, y - 35, 'guard/knight/walk/0').setDisplaySize(75, 75) })
    }
    for (const guard of tower.guards) { guard.maxHp = (75 + tower.level * 35 + tower.rank * 40) * (tower.spec === 'knights' ? 2 : 1) * (this.crew === 3 ? 1.25 : 1); guard.hp = guard.maxHp }
  }
  selectSpell(kind: SpellKind) {
    if (this.paused || this.ended || this.spellCooldown[kind] > 0) return
    this.cancel(); this.mode = kind; this.hud.toast(`${SPELLS[kind].name} · Tap a spot on the path`)
  }
  selectTrap(kind: TrapKind, point?: Point) {
    if (this.paused || this.ended || this.candy < this.trapCost(kind)) { this.hud.toast('Not enough candy for this trap.'); return }
    this.cancel(); this.mode = kind; this.dragStart = point ?? null; this.hud.toast(`${TRAPS[kind].name} · Drag onto the path\n${this.trapCost(kind)} candy`)
  }
  selectConsumable(kind: ConsumableKind, point?: Point) {
    if (this.paused || this.ended || this.itemCooldown[kind] > 0 || this.candy < CONSUMABLES[kind].cost) return
    this.cancel(); this.mode = kind; this.dragStart = point ?? null
    this.hud.toast(`${CONSUMABLES[kind].name} · ${CONSUMABLES[kind].description}\nDrag or tap the road · ${CONSUMABLES[kind].cost} candy`)
  }
  private cast(kind: SpellKind, x: number, y: number) {
    if (this.spellCooldown[kind] > 0) return
    const spell = SPELLS[kind]
    this.spellCooldown[kind] = spell.cooldown * this.hero.spellFactor
    for (const e of this.enemies) if (e.active && distanceSq({ x, y }, e) <= spell.radius ** 2) {
      if (kind === 'rain') this.damage(e, spell.damage, 'magic')
      else this.status(e, 'fear', 2)
    }
    this.effect(kind === 'rain' ? 'fx/candy-rain/0' : 'fx/boo/0', x, y - 30, 1, spell.radius / 45)
    if (kind === 'rain') { this.shake(.005); this.tutorial('rain'); for (let i = 0; i < (this.settings.lite ? 6 : 12); i++) this.effect('fx/coin', x + (this.visualRandom() - .5) * 280, y - 200, .5 + this.visualRandom() * .4, .25, 'jar', x + (this.visualRandom() - .5) * 220, y + 40) }
    else this.options.sfx.play('emote')
    this.cancel(); this.hud.refresh()
  }
  private placeTrap(kind: TrapKind, x: number, y: number) {
    const spot = this.nearestPath(x, y), config = TRAPS[kind]
    if (spot.gap > 65 || x < 50 || x > 1820 || y < 150 || y > 915) { this.hud.toast('Place it on the path. Candy is only spent when placed.'); return }
    if (this.candy < this.trapCost(kind)) { this.hud.toast('Not enough candy.'); this.cancel(); return }
    if (this.traps.length >= LIMITS.traps) { this.hud.toast('The path is full of surprises already.'); return }
    this.candy -= this.trapCost(kind)
    if (kind === 'pumpkin' && this.freePumpkin > 0) this.freePumpkin--
    this.traps.push({ x: spot.x, y: spot.y, kind, life: config.duration, armed: false, image: this.art.image(spot.x, spot.y, `trap/${kind}/0`).setDepth(7).setDisplaySize(100, 75) })
    this.effect('fx/poof/0', spot.x, spot.y, .4); this.options.sfx.play('build'); this.tutorial('trap'); this.cancel(); this.hud.refresh()
  }
  private updateTraps(dt: number) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i], config = TRAPS[trap.kind]
      let triggered = false
      for (const e of this.enemies) if (e.active && !ENEMIES[e.kind].flying && distanceSq(e, trap) < config.radius ** 2 && !(trap.kind === 'bowl' && e.mods.includes('visor'))) {
        triggered = true
        this.status(e, config.status, trap.kind === 'pumpkin' ? config.duration : .18)
        if (trap.kind === 'bowl') { e.status.fear = 0; if (e.status.burn > 0) { e.status.burn = 0; this.status(e, 'stun', 3); this.effect('fx/caramel/0', e.x, e.y, .9, 1.2); this.combo('caramel', e) } }
      }
      if (triggered && !trap.armed) { trap.armed = true; this.effect(trap.kind === 'pumpkin' ? 'fx/stun/0' : 'fx/splat/0', trap.x, trap.y, .5, 1.5); if (trap.kind === 'pumpkin') trap.life = 0 }
      if (trap.armed) trap.life -= dt
      this.art.set(trap.image, `trap/${trap.kind}/${trap.armed ? 1 : 0}`)
      if (trap.life <= 0) { trap.image.destroy(); this.traps.splice(i, 1) }
    }
  }
  entrancePath(kind: EnemyKind, path: number) { return ENEMIES[kind].flying && this.flyRoutes.length ? this.routes.length + path % this.flyRoutes.length : path % this.routes.length }
  nearestPath(x: number, y: number) {
    let nearest = this.routes[0].nearest(x, y)
    for (const route of [...this.routes.slice(1), ...(this.detour ? [this.detour] : [])]) { const point = route.nearest(x, y); if (point.gap < nearest.gap) nearest = point }
    return nearest
  }
  private worldDown(input: Phaser.Input.Pointer) {
    if (this.paused || this.ended) return
    const pointer = this.viewToWorld(input)
    if (!this.focus.input(pointer, true)) return
    void this.options.sfx.unlock()
    this.pointer.x = pointer.x; this.pointer.y = pointer.y
    if (this.mode) { if (this.mode === 'rain' || this.mode === 'boo') this.command({ type: 'spell', kind: this.mode, x: pointer.x, y: pointer.y }); else this.command(Object.hasOwn(CONSUMABLES, this.mode) ? { type: 'consumable', kind: this.mode as ConsumableKind, x: pointer.x, y: pointer.y } : { type: 'trap', kind: this.mode as TrapKind, x: pointer.x, y: pointer.y }); return }
    if (this.emoteOpen) { this.toggleEmotes(); return }
    this.hud.closePreview()
    if (this.selected >= 0) { this.cancel(); return }
    if (this.heroSelected) { this.command({ type: 'move', x: pointer.x, y: pointer.y }); return }
    if (distanceSq(pointer, this.hero) < 70 ** 2) { this.holdAt = { x: pointer.x, y: pointer.y }; this.holdTime = 0; this.selectHero(); this.hud.toast(`Chog #${this.options.hero} · ${this.abilityName()}\nTap ground to move · Hold to emote`); return }
    for (let i = 0; i < this.pads.length; i++) if (this.towers[i] ? Math.abs(pointer.x - this.pads[i].x) < 82 && pointer.y >= this.pads[i].y - 190 && pointer.y <= this.pads[i].y + 35 : distanceSq(pointer, this.pads[i]) < 82 ** 2) {
      if (this.tutorialStep === 0 && i !== 0) { this.hud.toast('The glowing pad first!'); return }
      this.cancel(); this.selected = i; this.hud.radial(); return
    }
    for (const enemy of this.enemies) if (enemy.active && (distanceSq(pointer, { x: enemy.x, y: enemy.y - 70 }) < 70 ** 2 || (Math.abs(pointer.x - enemy.x) < 45 && Math.abs(pointer.y - enemy.y + 150) < 25))) {
      const mods = enemy.mods.map(name => `${name}: ${MODIFIERS.find(m => m.name === name)?.enemy}`).join(' · ')
      this.hud.toast(`${ENEMIES[enemy.kind].name} #${enemy.id}${mods ? ` · ${mods}` : ''}`, 7); return
    }
  }
  selectHero() {
    if (this.paused || this.ended || this.hero.hp <= 0) return
    this.cancel(); this.heroSelected = true; this.hud.toast(`Your Chog · Tap the ground to move${this.hero.labels ? `\n${this.hero.labels}` : ''}`)
  }
  private moveHero(pointer: Point) {
    if (this.tutorialStep < 2 || this.hero.hp <= 0) return
    this.cancel()
    this.hero.rig.cancelDance()
    this.hero.target = { x: Phaser.Math.Clamp(pointer.x, 60, 1850), y: Phaser.Math.Clamp(pointer.y, 180, 885) }
    this.effect('hero/ring', pointer.x, pointer.y, .55, .8); this.tutorial('move')
  }
  private worldUp(input: Phaser.Input.Pointer) {
    this.holdAt = null
    if (this.paused || this.ended) return
    const pointer = this.viewToWorld(input)
    if (this.dragStart && this.mode && this.mode !== 'rain' && this.mode !== 'boo') {
      if (distanceSq(this.dragStart, pointer) > 30 ** 2 && this.focus.input(pointer, true)) this.command(Object.hasOwn(CONSUMABLES, this.mode) ? { type: 'consumable', kind: this.mode as ConsumableKind, x: pointer.x, y: pointer.y } : { type: 'trap', kind: this.mode as TrapKind, x: pointer.x, y: pointer.y })
      this.dragStart = null
    }
  }
  cancel() { this.buildPage = 0; this.mode = null; this.selected = -1; this.previewTower = null; this.previewSpec = null; this.heroSelected = false; this.dragStart = null; this.emoteOpen = false; this.preview?.setVisible(false); this.hud?.radial(); this.hud?.emotes(); this.hud?.closePreview(); this.hud?.closeSupplies() }
  toggleEmotes() { if (this.paused || this.ended) return; const open = !this.emoteOpen; this.cancel(); this.emoteOpen = open; this.hud.radial(); this.hud.emotes(); if (this.emoteOpen) this.tutorial('emote') }
  private chooseEmote(name: string) {
    if (this.hero.hp <= 0) return
    const dance = name === 'signature' ? this.hero.kit.emote : name
    if (!canDance(dance, this.hero.kit.emote, this.options.owned, this.options.assets.dances) && !(this.options.owned.includes(22) && CRYPTO_EMOTES.includes(name))) return
    this.hero.target = { x: this.hero.x, y: this.hero.y }
    if (name === 'signature') this.signature()
    else { this.hero.rig.dance(dance); this.emote(this.options.assets.dances[dance]?.emote ?? (CRYPTO_EMOTES.includes(name) ? name : 'gg'), this.hero.x, this.hero.y - 150) }
    if (name !== 'signature') this.options.sfx.emote(dance)
    this.emoteOpen = false; this.hud.emotes()
  }
  emote(name: string, x: number, y: number) { this.effect(`emote/${name}/0`, x, y, 1.7, 1, 'emote') }
  private tutorial(action: TutorialAction) {
    if (TUTORIAL[this.tutorialStep]?.action !== action) return
    this.tutorialStep++
    this.focus.acted()
    if (this.tutorialStep === TUTORIAL.length) { this.options.onTutorial(); this.hud.toast('You’re ready. Keep those jars safe!'); this.emote('gg', this.hero.x, this.hero.y - 150) }
    this.hud.refresh()
  }
  skipTutorial() { this.tutorialStep = TUTORIAL.length; this.cancel(); this.options.onTutorial(); this.hud.refresh(); this.focus.draw() }
  pauseGame() { if (!this.ended) { this.setPaused(true); this.options.onPause() } }
  setPaused(paused: boolean) { this.paused = paused; this.tweens.timeScale = paused ? 0 : 1; this.holdAt = null; this.dragStart = null; this.options.sfx.pause(paused) }
  towerFrame(kind: TowerKind, level: number, spec: Specialisation | null = null) { if (spec) return `tower/${kind}/${spec}`; return `${this.settings.gold && this.options.owned.includes(21) && ['egg', 'tp', 'lantern', 'patch'].includes(kind) ? 'skin/gold/' : ''}tower/${kind}/${level}` }
  applySettings(settings: Settings) {
    this.settings = settings; for (const a of this.ambience) a.image.setVisible(!settings.lite && this.quality.tier === 0); this.options.sfx.apply(settings); this.motion = !reducedMotion()
    for (const tower of this.towers) if (tower) this.art.set(tower.image, this.towerFrame(tower.kind, tower.level, tower.spec))
  }
  private finish(won: boolean) {
    if (this.ended) return
    this.cancel(); this.ended = true; this.hud.hide(); this.focus.draw()
    const mode = this.options.mode, daily = this.options.daily
    const result = { level: this.options.level, mode, daily: mode === 'daily' && daily ? daily.number : 0, theme: mode === 'daily' && daily ? daily.theme : 0, won, jars: this.jars, stars: won ? starsFor(this.jars) : 0, kills: this.kills, wave: this.wave, heroLevel: this.hero.level, earlyCalls: this.earlyCalls, seconds: this.clock, date: new Date().toISOString() }
    this.hero.rig.cancelDance(); this.hero.rig.play(won ? (this.options.assets.dances[this.options.victoryDance]?.clip ?? 'dance-gg') : 'faint')
    if (won && this.options.victoryDance === this.hero.kit.emote) this.hero.rig.emote()
    this.options.sfx.play(won ? 'victory' : 'defeat')
    if (won) this.options.sfx.emote(this.options.victoryDance)
    if (won) {
      // With the double-size parts the close-up can go from 2× to 3.4× and stay sharp; the pan offset keeps the hero left of the result panel.
      const sharp = this.hero.rig.sharpen(), camera = this.cameras.main, zoom = sharp ? 3.4 : 2, duration = reducedMotion() ? 0 : 950
      if (sharp) void this.sharpPortrait()
      camera.zoomTo(zoom * this.renderScale, duration, 'Sine.easeInOut'); camera.pan(this.hero.x + 235 * 2 / zoom, this.hero.y - 110 * 2 / zoom, duration, 'Sine.easeInOut')
      for (let i = 0; i < (this.settings.lite ? 24 : 48); i++) {
        const star = this.art.image(this.hero.x + (this.visualRandom() - .5) * 560, this.hero.y - 500 - this.visualRandom() * 140, 'ui/star-full').setDepth(2900).setScale(.16 + this.visualRandom() * .15).setTint([0xffd477, 0xfb8cac, 0xb2eccb][i % 3])
        this.tweens.add({ targets: star, y: this.hero.y + 60, x: star.x + (this.visualRandom() - .5) * 80, angle: reducedMotion() ? 0 : 180, alpha: 0, duration: reducedMotion() ? 0 : 1800 + this.visualRandom() * 1500, onComplete: () => star.destroy() })
      }
    }
    this.time.delayedCall(reducedMotion() || !won ? 0 : 1200, () => this.options.onEnd({ ...result, score: mode === 'endless' ? endlessScore(this.rewarded.size, this.kills) : scoreFor(result) }))
  }
  // The in-game portraits are 64px tiles; the close-up redraws the hero's face from the 256px original.
  private async sharpPortrait() {
    try {
      const image = await loadImage(`/chogs-256/${this.options.hero}.webp`)
      if (this.gone) return
      const texture = this.textures.exists('hero-hd') ? this.textures.get('hero-hd') as Phaser.Textures.CanvasTexture : this.textures.createCanvas('hero-hd', 256, 256)!, ctx = texture.context
      ctx.clearRect(0, 0, 256, 256); ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 256 * 61 / 128, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(image, 0, 0, 256, 256); ctx.restore(); texture.refresh()
      this.hero.rig.setPortrait('hero-hd')
    } catch { /* The 64px face stays if the portrait cannot be fetched. */ }
  }
  shake(intensity: number) { if (this.settings.shake && this.motion && !reducedMotion()) this.cameras.main.shake(110, intensity) }
  private addBeam(from: Point, to: Point, color: number) { if (this.beam.length < 12) this.beam.push({ from: { x: from.x, y: from.y - 50 }, to: { x: to.x, y: to.y - 30 }, life: .35, color }) }
  effect(name: string, x: number, y: number, duration: number, size = 1, mode: Effect['mode'] = 'burst', toX = x, toY = y) {
    const limit = this.settings.lite || this.quality.tier >= 2 ? LIMITS.effects / 2 : LIMITS.effects
    let effect: Effect | undefined
    for (let i = 0; i < limit; i++) if (!this.effects[i].active) { effect = this.effects[i]; break }
    if (!effect) return
    Object.assign(effect, { active: true, life: 0, duration, x, y, toX, toY, size, name, mode, count: this.art.count(name), angle: 0, width: undefined, height: undefined })
    this.art.set(effect.image, name); effect.image.setVisible(true).setAlpha(1).setScale(size).setPosition(x, y).setRotation(0).clearTint()
    return effect
  }
  number(value: number, x: number, y: number, color: number) {
    let number: DamageNumber | undefined
    for (let i = 0; i < (this.settings.lite || this.quality.tier >= 2 ? LIMITS.numbers / 2 : LIMITS.numbers); i++) if (!this.numbers[i].active) { number = this.numbers[i]; break }
    if (!number) return
    Object.assign(number, { active: true, life: 0, x: x + this.visualRandom() * 20 - 10, y }); number.text.setText(String(value)).setVisible(true).setTint(color).setAlpha(1).setPosition(x, y)
  }
  private updateEffects(dt: number) {
    for (const e of this.effects) if (e.active) {
      // An effect drawn from a dropped boss atlas ends with it.
      const split = e.name.indexOf(':')
      if (split > 0 && !this.textures.exists(e.name.slice(0, split))) { e.active = false; e.image.setVisible(false); continue }
      e.life += dt; const t = Math.min(1, e.life / e.duration)
      if (e.mode === 'coin' || e.mode === 'jar') { const ease = t * t; e.image.setPosition(Phaser.Math.Linear(e.x, e.toX, ease), Phaser.Math.Linear(e.y, e.toY, ease) - Math.sin(t * Math.PI) * 80).setRotation(t * 4).setAlpha(1 - Math.max(0, t - .8) * 5) }
      else {
        this.art.set(e.image, e.name.replace(/\/\d+$/, `/${Math.min(e.count - 1, Math.floor(t * e.count))}`))
        const bounce = this.motion ? e.mode === 'emote' ? Phaser.Math.Easing.Back.Out(Math.min(1, t * 5)) : 1 + Math.sin(t * Math.PI) * .35 : 1
        e.image.setScale(e.size * bounce).setRotation(e.angle).setAlpha(1 - Math.max(0, t - .65) / .35)
      }
      if (e.mode === 'travel') e.image.setPosition(Phaser.Math.Linear(e.x, e.toX, t), Phaser.Math.Linear(e.y, e.toY, t))
      if (e.width && e.height) e.image.setDisplaySize(e.width, e.height)
      if (t >= 1) { e.active = false; e.image.setVisible(false) }
    }
    for (const n of this.numbers) if (n.active) { n.life += dt; n.text.setPosition(n.x, n.y - n.life * 60).setAlpha(1 - n.life / .8); if (n.life >= .8) { n.active = false; n.text.setVisible(false) } }
    for (let i = this.beam.length - 1; i >= 0; i--) { this.beam[i].life -= dt; if (this.beam[i].life <= 0) this.beam.splice(i, 1) }
  }
  private drawUnits(_dt: number) {
    this.paint.begin()
    for (const e of this.enemies) if (e.active && !e.returning) {
      if (e.boss) { drawBoss(this, e); if (e.boss.child) this.bar(e.x, e.y - 190 * e.boss.scale, e.hp / e.maxHp, 0xffc17a, 80); continue }
      const frame = e.casting ? Math.min(3, Math.floor((.7 - e.casting) * 6)) : Math.floor(e.age * 9) % 6, bob = this.motion ? Math.sin(e.age * 14) * 3 : 0
      const route = this.routeFor(e), point = route.points[Math.min(route.points.length - 1, Math.floor(e.distance / route.length * (route.points.length - 1)) + 1)]
      const flip = (point.x < e.x) !== !!e.status.fear, key = frame + (e.casting ? 10 : e.hit ? 20 : 0), art = e.art
      if (art.drawFrame !== key || art.faceLeft !== flip) {
        art.drawFrame = key
        const anchor = this.art.anchor(e.kind, frame, !e.casting && e.hit > 0, e.casting ? 'cast' : 'walk')
        this.art.set(art.body, `enemy/${e.kind}/${e.casting ? `cast/${frame}` : e.hit ? 'hurt' : `walk/${frame}`}`)
        art.face.setPosition((anchor.x - 64) * (flip ? -1 : 1), anchor.y - 114).setDisplaySize(anchor.r * 2, anchor.r * 2)
        art.body.setFlipX(flip)
      }
      if (art.faceId !== e.id || art.faceLeft !== flip) {
        const face = this.heads.window(e.id, flip)
        art.face.setTexture(face.key, face.frame); art.faceId = e.id; art.faceLeft = flip
      }
      const emoting = this.motion && e.sigCooldown > 3.2, hop = emoting ? Math.abs(Math.sin((5 - e.sigCooldown) * 9)) : 0
      const spawn = this.motion ? Math.min(1, e.age * 5) : 1, squash = this.motion && e.hit ? .86 : emoting ? 1 - .14 * Math.cos((5 - e.sigCooldown) * 18) : 1
      if (e.art.root.depth !== e.y + 20) e.art.root.setDepth(e.y + 20)
      e.art.root.setPosition(e.x, e.y + bob - hop * 12).setScale(spawn * (2 - squash), spawn * squash)
      // On a dark map an enemy outside every light vanishes, leaving only two glowing eyes.
      const dim = this.dark && !e.lit && e.status.reveal <= 0 && this.bonfire <= 0
      const alpha = dim ? 0 : e.visible ? 1 : .22
      if (art.root.alpha !== alpha) art.root.setAlpha(alpha)
      if (dim) {
        const a = e.kind === 'ghost' ? .5 : .95
        this.paint.image('dot', e.x - 17, e.y - 74, 16, 16, 0xffd060, a * .3)
        this.paint.image('dot', e.x + 1, e.y - 74, 16, 16, 0xffd060, a * .3)
        this.paint.image('dot', e.x - 12.5, e.y - 69.5, 7, 7, 0xfff4b0, a)
        this.paint.image('dot', e.x + 5.5, e.y - 69.5, 7, 7, 0xfff4b0, a)
        continue
      }
      if (art.hitTint !== (e.hit > 0)) { art.hitTint = e.hit > 0; if (art.hitTint) { art.body.setTintFill(0xfff0cd); art.face.setTint(0xffffff) } else { art.body.clearTint(); art.face.clearTint() } }
      let statusName: Status | undefined
      for (const name of DRAW_STATUSES) if (e.status[name] > 0) { statusName = name; break }
      statusName ??= e.status.wrap ? 'root' : e.status.stun ? 'freeze' : undefined
      const statusFrame = Math.floor(this.clock * 8) % 4
      if (art.statusName !== statusName || art.statusFrame !== statusFrame) {
        art.statusName = statusName; art.statusFrame = statusFrame; art.statusImage.setVisible(!!statusName)
        if (statusName) this.art.set(art.statusImage, `status/${statusName}/${statusFrame}`)
      }
      this.bar(e.x, e.y - 124, e.hp / e.maxHp, e.visible ? 0x92dcb0 : 0xb9a5e1, 64)
      if (e.armour) this.paint.image('armour', e.x - 46, e.y - 17, 92, 34, 0xfbe394, .6)
    }
    for (const sig of this.signatures) if (sig.enemy) sig.player.root.setPosition(sig.enemy.art.face.x, sig.enemy.art.face.y)
    for (const tower of this.towers) if (tower) {
      const bob = this.motion ? Math.sin(this.clock * 2 + tower.x) * 2 : 0, pop = this.motion ? 1 + Math.sin(tower.pop / .4 * Math.PI) * .1 : 1
      tower.image.setPosition(tower.x, tower.y - 90 + bob).setDisplaySize(144 * pop, 180 / pop).setTint(tower.gold > 0 ? 0xffd45e : tower.stun ? 0xb9a4df : 0xffffff)
      for (const guard of tower.guards) if (guard.hp > 0) this.bar(guard.x, guard.y - 80, guard.hp / guard.maxHp, 0xffc17a, 45)
    }
    const hero = this.hero
    if (hero.rig.root.depth !== hero.y + 25) hero.rig.root.setDepth(hero.y + 25)
    hero.rig.root.setPosition(hero.x, hero.y).setAlpha(hero.hp > 0 ? 1 : .4)
    this.heroRing.setPosition(hero.x, hero.y).setAlpha(hero.hp > 0 ? .8 : .2)
    if (!this.ended) this.bar(hero.x, hero.y - 172, hero.hp / hero.maxHp, 0xffdc7b, 82)
    for (const beam of this.beam) {
      const dx = beam.to.x - beam.from.x, dy = beam.to.y - beam.from.y, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx)
      this.paint.image('white', beam.from.x + Math.sin(angle) * 3.5, beam.from.y - Math.cos(angle) * 3.5, length, 7, beam.color, beam.life / .35, angle)
      this.paint.image('white', beam.from.x + Math.sin(angle), beam.from.y - Math.cos(angle), length, 2, 0xffffff, 1, angle)
    }
    this.paint.end()
  }
  spriteBeam(frame: string, from: Point, to: Point, duration: number, width: number, color = 0xffffff) {
    const fx = this.effect(frame, (from.x + to.x) / 2, (from.y + to.y) / 2 - 50, duration)
    if (fx) { fx.angle = Math.atan2(to.y - from.y, to.x - from.x); fx.width = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)); fx.height = width; fx.image.setTint(color) }
  }
  private combo(name: string, at: Point) {
    if (this.combos.has(name)) return
    this.combos.add(name); this.hud.toast(`COMBO! ${name === 'eggsplosion' ? 'Egg + TP = double splash' : name === 'caramel' ? 'Fire + candy bowl = caramel stun' : 'Charmed Chogs fight for you'}`)
    const text = this.add.text(at.x, at.y - 160, 'COMBO!', { fontFamily: '"Luckiest Guy", sans-serif', fontSize: '36px', color: '#ffe695', stroke: '#352342', strokeThickness: 5 }).setOrigin(.5).setDepth(2900)
    this.tweens.add({ targets: text, y: at.y - (this.motion ? 200 : 160), alpha: 0, duration: 1400, onComplete: () => text.destroy() })
  }
  signature(enemy?: Enemy, detached = false) {
    if (enemy && (enemy.sigCooldown > 0 || this.signatures.filter(s => s.enemy || s.generation !== undefined).length >= 2)) return
    if (!enemy && this.signatures.some(s => s.bubble)) return
    const id = enemy?.id ?? this.options.hero, assets = this.options.assets, row = assets.chogs.find(c => c.id === id)!
    const radius = enemy && !detached ? enemy.art.face.displayWidth * 61 / 128 : 48
    const player = new Signature(this, this.art, assets.signatures, assets.kits.emotes[String(id)], id, row.side.toLowerCase(), radius)
    if (enemy) {
      enemy.sigCooldown = 5
      if (!detached) { enemy.art.root.add(player.root); player.root.setPosition(enemy.art.face.x, enemy.art.face.y); enemy.art.face.setVisible(false) }
      else player.root.setPosition(Phaser.Math.Clamp(enemy.x - 40, 70, 1850), Math.max(100, enemy.y - 150)).setDepth(2800)
    } else {
      this.hero.rig.emote()
      const bubble = plate(this, -66, -64, 132, 140, 22, 0xffefd0, 1, 0x352342, 4)
      player.root.addAt(bubble, 0); player.root.setPosition(Phaser.Math.Clamp(this.hero.x, 70, 1850), Math.max(100, this.hero.y - 225)).setDepth(2800)
    }
    this.options.sfx.emote(assets.kits.emotes[String(id)], !!enemy)
    this.signatures.push({ player, enemy: detached ? undefined : enemy, generation: enemy?.generation, bubble: !enemy })
  }
  private updateSignatures(dt: number) {
    for (let i = this.signatures.length - 1; i >= 0; i--) {
      const sig = this.signatures[i], e = sig.enemy
      if (sig.player.update(dt) && (!e || e.active && e.generation === sig.generation)) continue
      if (e && e.generation === sig.generation) e.art.face.setVisible(true)
      sig.player.destroy(); this.signatures.splice(i, 1)
    }
  }
  private bar(x: number, y: number, value: number, color: number, width: number) { this.paint.bar(x, y, value, color, width) }
  private showRange(x: number, y: number, radius: number, color: number, alpha: number, strokeAlpha: number, line: number) {
    const key = `${radius}:${line}`
    if (key !== this.rangeKey) {
      this.rangeKey = key; this.range.removeAll(true)
      this.rangeFill = circle(this, radius, 0xffffff, 1)
      this.rangeStroke = circle(this, radius, 0xffffff, 0, 0xffffff, line)
      this.range.add([this.rangeFill, this.rangeStroke])
    }
    this.range.setPosition(x, y).setVisible(true)
    this.rangeFill.setTint(color).setAlpha(alpha); this.rangeStroke.setTint(color).setAlpha(strokeAlpha)
  }
  private drawSelection() {
    this.range.setVisible(false); this.overlay.clear(); this.preview.setVisible(false); this.focusRing?.setVisible(false)
    if (this.selected >= 0 && (this.towers[this.selected] || this.previewTower)) {
      const tower = this.towers[this.selected], pad = this.pads[this.selected], radius = tower ? towerStats(tower).range : TOWERS[this.previewTower!].levels[0].range
      this.showRange(pad.x, pad.y, radius, 0xffe3a3, .07, .6, 3)
    }
    if (this.mode) {
      const spell = this.mode === 'rain' || this.mode === 'boo'
      const item = Object.hasOwn(CONSUMABLES, this.mode)
      const config = spell ? SPELLS[this.mode as SpellKind] : item ? CONSUMABLES[this.mode as ConsumableKind] : TRAPS[this.mode as TrapKind]
      const point = spell ? this.pointer : this.nearestPath(this.pointer.x, this.pointer.y)
      const valid = spell || ('gap' in point && Number(point.gap) <= (item ? 90 : 65))
      this.showRange(point.x, point.y, config.radius, valid ? config.color : 0xff6666, .15, .8, 4)
      if (!spell) { this.art.set(this.preview, item ? `item/${this.mode}/world` : `trap/${this.mode}/0`); this.preview.setDisplaySize(95, 70).setPosition(point.x, point.y).setVisible(true).setTint(valid ? 0xffffff : 0xff7777) }
    }
    const target = this.focus.target
    if (target) {
      if (this.focusRadius !== target.radius) { this.focusRing?.destroy(); this.focusRadius = target.radius; this.focusRing = circle(this, target.radius, 0xffdc76, 0, 0xffdc76, 4).setDepth(3340).setAlpha(.8); this.hudLayer.add(this.focusRing) }
      const p = target.world ? this.worldToView(target) : target; this.focusRing!.setPosition(p.x, p.y).setVisible(true)
    }
    this.art.set(this.pads[0], this.tutorialStep === 0 ? 'pad/glow' : 'pad/empty')
    this.drawWarning()
  }
  // Witching Hour: pulsing chevrons mark every edge the swarm will pour in from.
  private drawWarning() {
    if (!this.warning) return
    if (this.clock >= this.warning.until) { this.warning = null; return }
    const cam = this.cameras.main, v = this.view, g = this.overlay, pulse = reducedMotion() ? .85 : .6 + Math.sin(this.clock * 9) * .35
    const r = this.renderScale, x0 = Math.max(cam.x / r, v.left) + 40, x1 = Math.min((cam.x + cam.width) / r, v.right) - 40, y0 = Math.max(cam.y / r, v.top) + 40, y1 = Math.min(cam.y / r + 1080, v.bottom) - 40
    const chevron = (x: number, y: number, dx: number, dy: number, alpha: number) => {
      // A chevron pointing along (dx, dy): two arms meeting at the tip.
      const px = -dy, py = dx
      for (const [width, color] of [[26, 0x241b30], [13, 0xffb45c]] as const) g.lineStyle(width, color, alpha).beginPath().moveTo(x - dx * 34 + px * 54, y - dy * 34 + py * 54).lineTo(x + dx * 34, y + dy * 34).lineTo(x - dx * 34 - px * 54, y - dy * 34 - py * 54).strokePath()
    }
    for (let j = 0; j < 3; j++) {
      const alpha = Phaser.Math.Clamp(pulse - j * .12, .3, 1)
      for (let i = 1; i <= 3; i++) {
        const fy = y0 + (y1 - y0) * i / 4, fx = x0 + (x1 - x0) * i / 4
        chevron(x0 + j * 44, fy, 1, 0, alpha); chevron(x1 - j * 44, fy, -1, 0, alpha); chevron(fx, y0 + j * 44, 0, 1, alpha); chevron(fx, y1 - j * 44, 0, -1, alpha)
      }
    }
  }
  private applyQuality() {
    for (const a of this.ambience) a.image.setVisible(!this.settings.lite && this.quality.tier === 0)
    const scale = this.quality.tier >= 3 ? .75 : 1
    if (this.renderScale === scale) return
    this.renderScale = scale
    // EXPAND uses the configured minimum buffer, not devicePixelRatio. Cameras
    // and HUD retain design coordinates; only the physical canvas gets smaller.
    Object.assign(this.game.config, { width: 1920 * scale, height: 1080 * scale })
    this.scale.setGameSize(1920 * scale, 1080 * scale)
    this.layout()
  }
  private textureMB() {
    if (this.game.renderer.type !== Phaser.WEBGL) return 0
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer
    // RGBA allocations, including text and render targets; driver overhead is not exposed by WebGL.
    return Math.round(renderer.glTextureWrappers.reduce((bytes, texture) => bytes + texture.width * texture.height * 4, 0) / 1048576 * 10) / 10
  }
  stats() {
    const count = (list: Phaser.GameObjects.GameObject[]): number => list.reduce((total, object) => total + 1 + (object instanceof Phaser.GameObjects.Container || object instanceof Phaser.GameObjects.Layer ? count(object.list) : 0), 0)
    return { quality: this.quality.tier, renderScale: this.renderScale, fps: Math.round(this.game.loop.actualFps), objects: count(this.children.list), enemies: this.enemies.filter(e => e.active).length, draws: this.statsPrevious, textureMB: this.textureMB() }
  }
}
