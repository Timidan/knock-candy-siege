import { attachRoom } from './net/session'
import { thumb } from '../images'
import type { CoopSession } from './net/session'
import type { Lockstep } from './net/Lockstep'
import type { CoopCommand, Player } from './net/protocol'
import { HASH_EVERY } from './net/protocol'
import Phaser from 'phaser'
import { Art, loadImage } from './assets'
import { ChogHeads } from './chogHead'
import { ShapePool, circle, plate, curbedMap, YOU, PARTNER, hex } from './renderShapes'
import { Quality } from './Quality'
import { haptic } from './haptics'
import type { AssetPack } from './assets'
import { ENEMIES, TOWERS, TRAPS, SPELLS, LIMITS, STARTING_CANDY, COOP_STARTING_CANDY, NIGHT_HEALTH, WAVE_HEALTH, KILL_CANDY_HEALTH, EARLY_CALL_CANDY_PER_SECOND, starsFor, SPECIALISATIONS, SPEC_COST, rankCost, towerStats, seededRandom, TARGETING, towerLock, CONSUMABLES, hypot, sine, GAUNTLET_HEALTH, GAUNTLET_WAVE_HEALTH, GAUNTLET_CANDY } from './data/config'
import type { EnemyKind, Point, SpellKind, Status, TowerKind, TrapKind, Specialisation, Targeting, ConsumableKind, SupplyKind } from './data/config'
import { LEVELS, TUTORIAL, TIPS } from './data/level1'
import type { TutorialAction, LevelProp, Wave, BossSpawn } from './data/level1'
import { endlessWave, endlessHealth, endlessScore, shuffledKinds } from './data/endless'
import { NIGHTS } from './data/endless'
import type { Daily } from './data/endless'
import { eliteBonus, modifiersFor, traitsFor, MODIFIERS } from './data/traits'
import { reducedMotion } from './data/save'
import type { Settings } from './data/save'
import { Sfx, KIND_PITCH, type Cue } from './Sfx'
import { Route, clearStatuses, distanceSq, reaction, wedgePoint, wedgeSpan } from './world'
import type { Ally, Blocker, DamageNumber, Effect, Enemy, Guard, Projectile, Reaction, Span, Tower, Trap, UnitArt } from './world'
import { Hud } from './Hud'
import { Darkness } from './Darkness'
import type { Light } from './Darkness'
import { spawnBoss, preloadBoss, updateBoss, drawBoss, bossAbsorbs, bossRevives, bossDeath, updateCorpses, releaseBoss } from './Boss'
import type { ArtState } from './Boss'
import type { Rig } from './hero/Rig'
import { Hero } from './hero/Hero'
import { Signature } from './hero/Signature'
import { TutorialFocus } from './TutorialFocus'
import { Hints } from './Hints'
import { canDance, CRYPTO_EMOTES } from './data/shop'
import { scoreFor } from './data/score'
import { gauntletScore } from './data/gauntlet'
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
  | { type: 'talent'; index: number; level?: number }
  | { type: 'prop'; index: number }
  | { type: 'speed' }
export type Mode = 'level' | 'endless' | 'daily' | 'gauntlet'
// legends: the Legend Gauntlet's legends defeated (0 in other modes).
export type Outcome = { party?: { id: number; level: number }[]; level: number; mode: Mode; daily: number; theme: number; won: boolean; stars: number; jars: number; kills: number; wave: number; legends: number; heroLevel: number; score: number; earlyCalls: number; seconds: number; date: string }
// A schedule entry is one enemy to spawn: on a road, or (edge: a quarter of the far-side stretch, see wildRoute) from the edges of the view; risen enemies pay no candy; boss entries spawn a legend or the Great Pumpkin.
export type Spawn = { chogId?: number; time: number; kind: EnemyKind; path: number; wave: number; distance?: number; route?: number; edge?: number; risen?: boolean; boss?: BossSpawn }
export type SceneOptions = { coop?: CoopSession; assets: AssetPack; level: number; mode: Mode; daily: Daily | null; seed: number; stars: Record<string, number>; street: StreetBonuses; seen: string[]; onDiscover: (keys: string[]) => void; hero: number; home: boolean; tutorial: boolean; costume: string; owned: number[]; victoryDance: string; settings: Settings; sfx: Sfx; onFullscreen?: () => void; onShop: () => void; onPause: () => void; onEnd: (result: Outcome) => void; onIntro: (kind: string) => void; onTutorial: () => void; onReady: () => void }
// Decorative cadence and amplitude, in seconds and design pixels, per tower family.
const TOWER_IDLE: Record<TowerKind, readonly [number, number]> = { egg: [2.4, .8], tp: [1.8, 1.2], lantern: [1.2, 2.4], patch: [1.5, .5], roost: [2.1, 1.4], cauldron: [1.7, .7], catapult: [1.1, .4], lighthouse: [.9, 1.5], organ: [1.4, .9] }
const WITCHING_WARNING = 3
// Rosie Row's candy cannon: its art, shots per volley and damage per shot (times the wave's health).
const CANNON = 'tower/catapult/3', CANNON_SHOTS = 5, CANNON_DAMAGE = 75
// Compass names for swarmSide, by eighths of a turn from screen right, clockwise.
const SIDES = ['right', 'bottom right', 'bottom', 'bottom left', 'left', 'top left', 'top', 'top right']
// Road routes start with a 450px off-screen run-up (Route); crossing it is an enemy's arrival at the entrance.
const ENTRANCE = 450
const STATUS_KEYS = Object.keys(clearStatuses()) as Status[]
const RISEN = 0xa8ffc4, CONFUSE = [0, 1, 2, 3].map(i => `status/confuse/${i}`)
// Golden Touch and frozen towers: dark to light, so the tower's own shading carries over.
const COAT_RAMPS = { gold: [[58, 30, 4], [138, 84, 10], [214, 158, 28], [255, 214, 86], [255, 247, 205]], ice: [[26, 52, 98], [62, 118, 178], [128, 192, 236], [200, 238, 255], [246, 253, 255]] }
const DRAW_STATUSES: Status[] = ['freeze', 'charm', 'confuse', 'root', 'mark', 'bleed', 'fear', 'burn', 'poison', 'slow']
type HitCue = { from?: Point; kind?: 'egg' | 'tp' | 'magic' | 'seed' | 'hero'; crit?: boolean }
const STATUS_POP: Partial<Record<Status, number>> = { burn: 0xffaa62, poison: 0xa8df8b, slow: 0x95dafa, stun: 0xffd56a, fear: 0xc2a4ef, charm: 0xffa9d0 }
export class SiegeScene extends Phaser.Scene {
  options: SceneOptions
  art!: Art
  heads!: ChogHeads
  hud!: Hud
  focus!: TutorialFocus
  hints!: Hints
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
  private pathPreview: { route: Route; path: number; start: number; span: number; skips: { at: number; to: number }[]; images: Phaser.GameObjects.Image[]; pulse: Phaser.GameObjects.Image; cueAge: number; alpha: number; selected: boolean }[] = []
  private previewWave = -1
  private previewBridge = false
  private previewTravel = 0
  private previewHideUntil = 0
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
  corpses: { holder: Phaser.GameObjects.Container | null; rig?: Rig; life: number; atlas: string; flee?: { x: number; y: number; dx: number; dy: number } }[] = []
  bossArt = new Map<string, ArtState>()
  bossOwned = new Set<string>()
  bossSheet?: AssetPack['atlases'][number]
  missTime = 0
  // Presentation time only; the scheduled swarm still starts after WITCHING_WARNING. away: the side the swarm comes from (swarmAway).
  warning: { until: number; away: Point } | null = null
  // Daily modifiers and endless scaling.
  speedScale = 1
  candyScale = 1
  shuffle: Partial<Record<EnemyKind, EnemyKind>> | null = null
  private plans: Wave[] = []
  private later: { at: number; run: () => void; state: unknown }[] = []
  // Run something a little later in simulated time (staggered strikes); it is dropped with the scene.
  after(seconds: number, run: () => void, state: unknown = null) { this.later.push({ at: this.clock + seconds, run, state }) }
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
  healthScale(wave: number) { return this.level.endless ? endlessHealth(wave) : this.level.gauntlet ? GAUNTLET_HEALTH * (1 + GAUNTLET_WAVE_HEALTH * wave) : (NIGHT_HEALTH[this.level.id - 1] ?? 1) * (1 + WAVE_HEALTH * wave) }
  killCandyScale(wave: number) { return 1 + KILL_CANDY_HEALTH * (this.healthScale(wave) - 1) }
  routeFor(e: Enemy): Route { return e.route ?? (e.path >= this.routes.length ? e.path === this.routes.length + this.flyRoutes.length ? this.detour! : this.flyRoutes[e.path - this.routes.length] : this.routes[e.path]) }
  roadFor(kind: EnemyKind, path: number) { const sw = this.options.assets.geometry.switch; return this.bridgeUp && !ENEMIES[kind].flying && path === sw?.path ? this.routes.length + this.flyRoutes.length : this.entrancePath(kind, path) }
  enemies: Enemy[] = []
  private crowns: Enemy[] = []
  private lightPool: Light[] = []
  private lightCount = 0
  towers: (Tower | null)[] = []
  pads: Phaser.GameObjects.Image[] = []
  private padGlyphs: Phaser.GameObjects.Image[] = []
  // One coat per pad: the gold (Golden Touch) or ice (a stunned tower) copy of the tower's frame laid over it, and its shine.
  private coats: { image: Phaser.GameObjects.Image; shine: Phaser.GameObjects.Image; kind: '' | 'gold' | 'ice'; peak: number; recede: number; flake: number }[] = []
  private coated = new Set<string>() // tower frames whose coats are made or on their way
  private coatKeys = { gold: new Map<string, string>(), ice: new Map<string, string>() } // frame name to coat texture key, so drawing builds no strings
  projectiles: Projectile[] = []
  effects: Effect[] = []
  private candyFlights: number[] = []
  private rewardText!: Phaser.GameObjects.BitmapText
  private rewardAt = -Infinity
  private rewardValue = 0
  private rewardPoint = { x: 0, y: 0 }
  numbers: DamageNumber[] = []
  traps: Trap[] = []
  items: PlacedItem[] = []
  itemCooldown = Object.fromEntries(Object.keys(CONSUMABLES).map(k => [k, 0])) as Record<ConsumableKind, number>
  // One stock per level, shared in co-op like candy; commands check it in the simulation.
  stock = Object.fromEntries([...Object.entries(TRAPS), ...Object.entries(CONSUMABLES)].map(([k, v]) => [k, v.stock])) as Record<SupplyKind, number>
  get crew() { return this.options.street.crew }
  towerLock(kind: TowerKind) { return towerLock(kind, this.localSelection.stars, this.localSelection.owned) }
  hero!: Hero // Stable player zero; simulation code never swaps this reference.
  heroes: Hero[] = []
  net?: Lockstep
  randomDraws = 0
  talentDeadlines = [0, 0]
  coopResult?: Outcome
  coopFinishAt = 0
  get localHero() { return this.heroes[this.options.coop?.client.player ?? 0] ?? this.hero }
  get localSelection() { return this.localHero.selection }
  get talentWaiting() { return !!this.options.coop && this.heroes.some(hero => !!hero.choices) }
  crewHas(kind: number) { return this.options.coop ? this.heroes.some(hero => hero.selection.street.crew === kind) : this.crew === kind }
  nearestHero(point: Point) { return this.heroes.filter(hero => hero.alive).reduce<Hero | null>((best, hero) => !best || distanceSq(hero, point) < distanceSq(best, point) ? hero : best, null) }
  networkStep(dt: number, turn: number) {
    if (this.ended) return
    for (let player = 0; player < this.heroes.length; player++) {
      const hero = this.heroes[player]
      if (!hero.choices) this.talentDeadlines[player] = 0
      else {
        if (!this.talentDeadlines[player]) this.talentDeadlines[player] = turn + 450
        if (turn >= this.talentDeadlines[player]) { hero.chooseTalent(0); this.talentDeadlines[player] = 0 }
      }
    }
    if (!this.talentWaiting) this.tick(dt)
  }
  candy = STARTING_CANDY
  // Co-op: each player's own candy, and the fraction of shared income not yet paid to them (simulation state; solo leaves both unset).
  wallets?: number[]
  candyCarry?: number[]
  jars = 20
  kills = 0
  killsByKind: Record<string, number> = {}
  bossesDefeated: string[] = []
  jarsLost = 0
  earlyCalls = 0
  wave = 0
  speed = 1
  // Wall-clock presentation only. Neither tick, the accumulator, nor rig releases wait for hit-stop.
  presentationTime = 0
  hitPause = 0
  private nextHitPause = 0
  private impactProjectile: Projectile | null = null
  private impactSound: Cue | null = null
  private impactKind: NonNullable<HitCue['kind']> = 'seed'
  private stepAt = 0
  private celebrating = false
  get presentationFrozen() { return this.hitPause > 0 && this.motion && this.settings.shake }
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
  private restoring = false
  ready = false
  schedule: Spawn[] = []
  waveAlive: number[] = []
  private rewarded = new Set<number>()
  paint!: ShapePool
  private range!: Phaser.GameObjects.Container
  private rangeFill!: Phaser.GameObjects.Image
  private rangeStroke!: Phaser.GameObjects.Image
  private rangeKey = ''
  private rangeSelection = ''
  private focusRing?: Phaser.GameObjects.Image
  private focusRadius = 0
  private warningRoot!: Phaser.GameObjects.Container
  private warningEdges: { stroke: Phaser.GameObjects.Image; arrows: Phaser.GameObjects.Image[] }[] = []
  private warningPorch = { x: 0, y: 0 }
  private span: Span = { x: 0, y: 0, dx: 0, dy: 0, u0: 0, u1: 0 }
  // The map's far side: the mean direction from the porch to where its roads and flight paths enter (set in create).
  private away = { x: -1, y: 0 }
  private heroRings: Phaser.GameObjects.Image[] = []
  // Co-op presentation only: commands accepted but not yet run (own ones from the tap, the partner's once relayed),
  // the ghosts and labels that show them, a pool of ground rings, and the YOU / #id tags over the Chogs.
  private queued: { player: Player; command: CoopCommand }[] = []
  private ghosts: { image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; key: string }[] = []
  private rings: Phaser.GameObjects.Image[] = []
  private ringCount = 0
  private heroTags: Phaser.GameObjects.Text[] = []
  private preview!: Phaser.GameObjects.Image
  private hudTime = 0
  private portraitTime = 0
  private openingSettle?: Phaser.Tweens.Tween
  private holdTime = 0
  private holdAt: Point | null = null
  private dragStart: Point | null = null
  private beam: { from: Point; to: Point; life: number; color: number }[] = []
  private statsDraws = 0
  private statsPrevious = 0
  private motion = !reducedMotion()
  constructor(options: SceneOptions) { super('CandySiege'); this.options = options; this.seed = options.seed >>> 0; const random = seededRandom(this.seed); this.random = () => { this.randomDraws++; return random() }; this.visualRandom = seededRandom(this.seed ^ 0x57c0ffee); this.discovered = new Set(options.seen); this.settings = options.settings; this.tutorialStep = options.tutorial ? 0 : TUTORIAL.length }
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
    // Canvas glyphs are permanent: wait for the display font before baking digits.
    await Promise.all([this.heads.ready, document.fonts.load('38px "Luckiest Guy"', '0123456789+-!').catch(() => [])])
    if (this.gone) return
    this.art = new Art(this, this.options.assets, this.settings.lite)
    this.art.pin(this.options.hero)
    const daily = this.options.mode === 'daily' ? this.options.daily : null
    if (daily) { this.speedScale = daily.theme === 1 ? 1.25 : 1; this.candyScale = daily.theme === 2 ? 2 : 1; this.shuffle = daily.theme === 3 ? shuffledKinds(daily.seed) : null }
    this.routes = this.options.assets.geometry.paths.map(path => new Route(path, true))
    this.flyRoutes = (this.options.assets.geometry.fly ?? []).map(path => new Route(path, true))
    const porch = this.options.assets.geometry.porch
    this.away = { x: 0, y: 0 }
    for (const [[x, y]] of [...this.options.assets.geometry.paths, ...(this.options.assets.geometry.fly ?? [])]) {
      const dx = x - porch.x, dy = y - porch.y, length = Math.sqrt(dx * dx + dy * dy) || 1
      this.away.x += dx / length; this.away.y += dy / length
    }
    const sw = this.options.assets.geometry.switch
    if (sw) {
      this.detour = new Route(sw.points, true)
      const base = this.options.assets.geometry.paths[sw.path]
      let i = 0; while (i + 1 < Math.min(base.length, sw.points.length) && hypot(base[i + 1][0] - sw.points[i + 1][0], base[i + 1][1] - sw.points[i + 1][1]) < 3) i++
      this.fork = this.routes[sw.path].nearest(...base[i]).distance
    }
    this.drawMap()
    this.createWorld()
    this.range = this.add.container(0, 0).setDepth(8)
    this.paint = new ShapePool(this, 2000, 408)
    this.warningRoot = this.add.container(0, 0).setDepth(2980).setVisible(false)
    this.hudLayer.add(this.warningRoot)
    this.warningEdges = Array.from({ length: 4 }, () => {
      const stroke = this.add.image(0, 0, 'siege-shapes', 'white').setTint(0xffb45c)
      const arrows = Array.from({ length: 3 }, () => this.art.image(0, 0, 'teach/path-arrow').setDisplaySize(48, 48))
      this.warningRoot.add([stroke, ...arrows]); return { stroke, arrows }
    })
    this.options.assets.geometry.pads.forEach((pad, i) => {
      this.pads.push(this.art.image(pad.x, pad.y, 'world/rune-pad').setDisplaySize(144, 86.4).setDepth(5)); this.towers[i] = null
      this.coats.push({ image: this.add.image(pad.x, pad.y, '__WHITE').setVisible(false).setDepth(pad.y + .1), shine: this.add.image(pad.x, pad.y, '__WHITE').setVisible(false).setDepth(pad.y + .2).setBlendMode(Phaser.BlendModes.ADD), kind: '', peak: 0, recede: -9, flake: 0 })
      // The rune is emissive on Rare Row; it marks a socket without revealing enemies.
      this.padGlyphs.push(this.art.image(pad.x, pad.y, 'world/rune-glyph').setDisplaySize(144, 86.4).setDepth(this.dark ? 1951 : 5.1).setAlpha(.3))
      if (pad.boost) this.boostRings.push(this.art.image(pad.x, pad.y + 2, 'fx/boost/0').setDepth(4))
    })
    this.makePools()
    const spawn = this.routes[0].nearest(1080, 720)
    this.hero = new Hero(this, spawn, this.options.coop?.players[0])
    this.heroes = [this.hero]
    if (this.options.coop) {
      const partner = this.options.coop.players[1]
      this.art.pin(partner.id)
      this.heroes.push(new Hero(this, { x: spawn.x + 95, y: spawn.y }, partner))
      // Each player starts with their own candy and their own perks: holder candy, A sweeter start and the Lucky Coin.
      this.wallets = this.heroes.map(({ selection, kit }) => COOP_STARTING_CANDY + selection.street.candy + (selection.owned.includes(23) ? 50 : 0) + (kit.trinket === 'lucky-coin' ? 50 : 0))
      this.candyCarry = [0, 0]; this.candy = 0
    } else {
      this.candy += this.options.street.candy
      if (this.options.owned.includes(23)) this.candy += 50
    }
    if (this.options.street.trap) this.stock.pumpkin++
    if (this.level.gauntlet) this.income(GAUNTLET_CANDY)
    // Co-op: your Chog stands on a ring in your colour with a YOU tag; your partner's has their colour and Chog number.
    this.heroRings = this.heroes.map((hero, player) => this.art.image(hero.x, hero.y, 'hero/ring').setDisplaySize(116, 44).setDepth(6).setTint(!this.options.coop ? 0xffffff : player === this.localPlayer ? YOU : PARTNER))
    if (this.options.coop) this.heroTags = this.heroes.map((hero, player) => this.add.text(0, 0, player === this.localPlayer ? 'YOU' : `#${hero.kit.id}`, { fontFamily: '"Luckiest Guy", sans-serif', fontSize: '28px', color: hex(player === this.localPlayer ? YOU : PARTNER), stroke: '#241b30', strokeThickness: 6 }).setOrigin(.5).setDepth(2750))
    this.preview = this.art.image(0, 0, 'trap/pumpkin/0').setDepth(2900).setAlpha(.75).setVisible(false)
    if (this.dark) this.darkness = new Darkness(this)
    this.hud = new Hud(this)
    // Co-op: a high-level Chog's starting talents resolve at once, to the left card on both peers, so the partner never waits.
    // Live level-ups keep the shared pause. A choice that is refused stays queued for that pause.
    if (this.options.coop) for (const hero of this.heroes) for (let n = hero.talentLevels.length; n > 0; n--) hero.chooseTalent(0)
    this.focus = new TutorialFocus(this)
    this.hints = new Hints(this)
    this.createPathPreview()
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
    const settleInput = () => this.cancelOpeningSettle()
    this.game.canvas.addEventListener('pointerdown', settleInput, true)
    window.addEventListener('keydown', settleInput, true)
    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('pointerdown', settleInput, true)
      window.removeEventListener('keydown', settleInput, true)
      this.cancelOpeningSettle()
    })
    this.startOpeningSettle()
    this.ready = true
    this.bindRecovery()
    this.hud.refresh()
    this.updateLights()
    if (this.options.coop) attachRoom(this)
    this.options.onReady()
    if (this.dark) this.hud.toast('Rare Row is dark. Only light shows enemies: lanterns, your Chog, and the bonfire.', 6)
    else if (daily) this.hud.toast(`Daily #${daily.number} · ${this.level.name}\n${NIGHTS[daily.theme].name}: ${NIGHTS[daily.theme].text}`, 6)
    else if (this.options.mode === 'endless') this.hud.toast('Endless: the waves never stop. A new road opens every ten waves.', 6)
    else if (this.level.gauntlet) this.hud.toast('Legend Gauntlet: all ten legends, one after another, each with its own move. Keep a jar and beat them all.', 6)
  }
  private cancelGesture() {
    this.holdAt = null; this.holdTime = 0
    this.cancel()
    for (const pointer of this.input.manager.pointers) pointer.reset()
    this.drawSelection()
  }
  private bindRecovery() {
    const orientation = () => `${screen.orientation?.type ?? ''}:${screen.orientation?.angle ?? window.orientation ?? ''}`
    let previous = orientation(), wasPaused = false, timerPaused = false
    let message: HTMLDialogElement | null = null
    const cancel = () => this.cancelGesture()
    const rotate = () => {
      const next = orientation()
      if (next === previous) return // Keyboard, browser chrome and ordinary resizes are not rotations.
      previous = next
      if (this.ended) return
      this.cancelGesture(); this.cancelOpeningSettle(); this.scale.refresh(); this.layout()
      if (!this.paused && !this.options.coop) this.pauseGame() // A talent card keeps its own pause and countdown.
    }
    const lost = () => {
      if (this.restoring || this.ended) return
      if (this.options.coop) { this.net?.stop('error'); this.options.coop.client.close(); return }
      wasPaused = this.paused; timerPaused = this.time.paused; this.restoring = true
      this.cancelGesture(); this.cancelOpeningSettle(); this.setPaused(true); this.time.paused = true
      // A DOM message survives loss of the canvas and sits above any existing menu.
      message = document.createElement('dialog')
      message.textContent = 'Restoring the street…'; message.setAttribute('aria-live', 'polite')
      Object.assign(message.style, { padding: '24px 32px', border: '2px solid #ffcf89', borderRadius: '18px', background: '#241b30', color: '#fff0d5', font: '24px "Patrick Hand", sans-serif' })
      message.addEventListener('cancel', event => event.preventDefault())
      document.body.append(message); message.showModal()
    }
    const restored = () => {
      if (!this.restoring) return
      this.restoring = false; this.time.paused = timerPaused
      message?.close(); message?.remove(); message = null
      this.layout()
      if (!wasPaused) this.pauseGame()
    }
    screen.orientation?.addEventListener('change', rotate)
    window.addEventListener('orientationchange', rotate)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchcancel', cancel)
    const renderer = this.game.renderer
    renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, lost)
    renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restored)
    this.events.once('shutdown', () => {
      screen.orientation?.removeEventListener('change', rotate)
      window.removeEventListener('orientationchange', rotate)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchcancel', cancel)
      renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, lost)
      renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, restored)
      message?.close(); message?.remove()
    })
  }
  private startOpeningSettle() {
    if (reducedMotion()) return
    const camera = this.cameras.main, scrollY = camera.scrollY
    camera.scrollY -= 24
    this.openingSettle = this.tweens.add({ targets: camera, scrollY, duration: 600, ease: 'Sine.InOut', onComplete: () => { this.openingSettle = undefined } })
  }
  private cancelOpeningSettle() {
    if (!this.openingSettle) return
    this.openingSettle.stop(); this.openingSettle = undefined
    this.cameras.main.setZoom(this.renderScale).centerOn(960, 540)
  }
  layout() {
    this.cancelOpeningSettle()
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
  worldToView(point: Point, out: Point = { x: 0, y: 0 }): Point {
    const c = this.cameras.main
    const x = (point.x - c.scrollX - c.width / 2) * c.zoomX, y = (point.y - c.scrollY - c.height / 2) * c.zoomY
    const rotation = (c as Phaser.Cameras.Scene2D.Camera & { rotation: number }).rotation
    const cos = Math.cos(rotation), sin = Math.sin(rotation)
    out.x = (Math.floor(c.x + c.width / 2 + .5) + x * cos - y * sin) / this.renderScale; out.y = (Math.floor(c.y + c.height / 2 + .5) + x * sin + y * cos) / this.renderScale
    return out
  }
  discover(keys: string[]) {
    const fresh = keys.filter(k => !this.discovered.has(k))
    if (!fresh.length) return
    fresh.forEach(k => this.discovered.add(k)); this.options.onDiscover(fresh)
  }
  command(command: Command) {
    if (this.options.coop) {
      if (command.type === 'speed' || this.ended || this.talentWaiting && command.type !== 'talent') return
      if (command.type === 'talent') command = { ...command, level: this.localHero.talentLevels[0] }
      // One change per tower at a time: a pad with a pending command from either player takes no other until it runs.
      const theirs = 'pad' in command && command.type !== 'build' ? this.towers[command.pad] : null
      if (theirs && theirs.owner !== this.localPlayer) { this.hud.toast("That's your partner's tower", 2); this.cancel(); return }
      const queued = 'pad' in command && command.type !== 'target' ? this.pendingAt(command.pad) : undefined
      if (queued) { this.hud.toast(queued.player !== this.localPlayer ? command.type === 'build' ? 'Your partner is building here' : 'Your partner is changing this tower' : 'On its way…', 2); this.cancel(); return }
      // A power already on its way is not sent twice.
      if ((command.type === 'ability' || command.type === 'ultimate' || command.type === 'spell') && this.queuedOwn(command.type, command.type === 'spell' ? command.kind : undefined)) return
      if (!this.net?.enqueue(command)) return
      this.readQueue(); this.hud.refresh()
      // Instant local feedback: the command itself runs for both players after the input delay.
      if (command.type === 'move') { this.effect('hero/ring', command.x, command.y, .55, .8)?.image.setTint(YOU); this.sfx('move', command) }
      if (['build', 'upgrade', 'sell', 'specialise', 'spell', 'trap', 'consumable', 'move', 'emote'].includes(command.type)) this.cancel()
      return
    }
    this.applyCommand(0, command)
  }
  get localPlayer(): Player { return this.options.coop?.client.player ?? 0 }
  // A command's own toasts and menu changes belong to the player who sent it. Co-op closes menus at the tap (command).
  private mine(player: Player) { return !this.options.coop || player === this.localPlayer }
  private settle(player: Player) { if (!this.options.coop && this.mine(player)) this.cancel() }
  readQueue() {
    this.queued.length = 0
    const net = this.net, local = this.localPlayer
    if (!net || !this.options.coop) return
    for (const command of net.own()) this.queued.push({ player: local, command })
    for (const commands of net.relayed(local ? 0 : 1).values()) for (const command of commands) this.queued.push({ player: local ? 0 : 1, command })
  }
  pendingAt(pad: number) { return this.queued.find(({ command }) => 'pad' in command && command.pad === pad && command.type !== 'target') }
  queuedOwn(type: Command['type'], kind?: string) { return this.queued.some(({ player, command }) => player === this.localPlayer && command.type === type && (!kind || 'kind' in command && command.kind === kind)) }
  applyCommand(player: Player, command: Command) {
    const hero = this.heroes[player]
    if (!hero || this.options.coop && this.talentWaiting && command.type !== 'talent') return
    if (this.paused || this.ended || !this.ready) return
    if ('pad' in command && (!Number.isInteger(command.pad) || !this.pads[command.pad])) return
    if ('x' in command && (!Number.isFinite(command.x) || !Number.isFinite(command.y) || command.x < 0 || command.x > 1920 || command.y < 0 || command.y > 1080)) return
    if (this.focus.active) {
      const action = command.type === 'spell' ? command.kind : command.type
      if (TUTORIAL[this.tutorialStep]?.action !== action || ('pad' in command && command.pad !== 0)) return
    }
    switch (command.type) {
      case 'build': if (Object.hasOwn(TOWERS, command.kind)) this.build(command.kind, command.pad, player); break
      case 'upgrade': this.upgrade(command.pad, player); break
      case 'sell': this.sell(command.pad, player); break
      case 'specialise': this.specialise(command.pad, command.spec, player); break
      case 'target': { const t = this.towers[command.pad]; if (t && TARGETING.includes(command.targeting) && this.owns(player, t)) { t.targeting = command.targeting; if (this.mine(player)) { this.hud.radial(); this.sfx('target', t) } }; break }
      case 'consumable': if (Object.hasOwn(CONSUMABLES, command.kind)) {
        const stock = this.stock[command.kind]
        useConsumable(this, command.kind, command.x, command.y, hero)
        // Co-op: a standing supply remembers who placed it; a thrown one gets a short mark where it lands.
        if (this.options.coop && this.stock[command.kind] < stock) { if (CONSUMABLES[command.kind].duration) this.items.at(-1)!.owner = player; else this.placed(command.x, command.y, player, 1.4) }
      }
      break
      case 'trap': if (Object.hasOwn(TRAPS, command.kind)) this.placeTrap(command.kind, command.x, command.y, player); break
      case 'spell': if (Object.hasOwn(SPELLS, command.kind)) { const ready = this.spellCooldown[command.kind] <= 0; this.cast(command.kind, command.x, command.y, hero, player); if (ready && this.spellCooldown[command.kind] > 0) this.placed(command.x, command.y, player, 1.1) }; break
      case 'move': this.moveHero(command, hero); break
      case 'ability': hero.abilityUse(); break
      case 'ultimate': hero.ultimateUse(); break
      case 'emote': this.chooseEmote(command.name, hero); break
      case 'talent': if ((command.index === 0 || command.index === 1) && (!this.options.coop || command.level === hero.talentLevels[0])) { hero.chooseTalent(command.index); this.talentDeadlines[player] = 0 }; break
      case 'wave': this.callWave(); break
      case 'prop': this.useProp(command.index, player); break
      case 'speed': this.speed = this.speed % 3 + 1; this.hud.refresh(); this.sfx('speed'); break
    }
  }
  private specialise(pad: number, spec: Specialisation, player: Player = 0) {
    const t = this.towers[pad]
    if (!t || t.level !== 3 || t.spec || !Object.hasOwn(SPECIALISATIONS, spec) || SPECIALISATIONS[spec].kind !== t.kind || !this.owns(player, t) || !this.spend(player, SPEC_COST)) return
    t.spent += SPEC_COST; t.spec = spec; t.pop = .4
    this.art.set(t.image, this.towerFrame(t.kind, t.level, spec)); this.discover([`spec/${spec}`])
    if (t.kind === 'patch') this.guardsFor(t)
    this.effect('fx/levelup/0', t.x, t.y - 80, .7, 1.5); this.sfx('spec', t); this.settle(player); if (this.mine(player)) this.hud.toast(SPECIALISATIONS[spec].name)
  }
  private towerAttack(t: Tower, target: Enemy): boolean {
    const c = towerStats(t), damage = c.damage * this.towerBuff(t), spec = t.spec, rank = t.rank
    const special = specialTowerAttack(this, t, target, damage)
    if (special !== undefined) return special
    if (!spec) return this.fire(t.x, t.y - 125, target, damage, t.kind, c.splash)
    if (spec === 'moon') {
      const dx = target.x - t.x, dy = target.y - t.y, length = hypot(dx, dy) || 1
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
        const landed = this.damage(e, damage * (crit ? 3 : 1), t.kind === 'egg' ? 'egg' : t.kind === 'lantern' ? 'magic' : 'physical', true, false, { crit })
        if (!landed) return
        if (spec === 'rotten' && e.active) { e.poisonStacks = Math.min(5, e.poisonStacks + 1); this.status(e, 'poison', 5); this.effect('fx/poison-cloud/0', e.x, e.y - 35, .5, .65) }
        if (t.kind === 'tp' && e.active) { this.status(e, 'wrap', 3); this.status(e, 'slow', 2); e.slowPower = .5 }
        if (spec === 'mummy') { this.status(e, 'stun', .65 + rank * .2); this.effect('fx/mummy-wrap/0', e.x, e.y - 40, .65) }
        if (spec === 'tornado' && e.active && !e.mods.includes('slippery')) { const centre = this.routeFor(e).nearest(vortex.x, vortex.y).distance; e.distance = Math.max(0, e.distance + Phaser.Math.Clamp(centre - e.distance, -70 - rank * 15, 70 + rank * 15)); this.routeFor(e).at(e.distance, e) }
        if (spec === 'wisp') {
          let from: Point = e
          const targets = this.enemies.filter(other => other.active && other !== e && other.visible && !other.returning && !other.status.charm && distanceSq(e, other) < 210 * 210).slice(0, 3)
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
      const image = this.art.image(data.x, data.y, data.kind === 'bridge' ? 'prop/bridge/down' : data.kind === 'cannon' ? CANNON : `prop/${data.kind}/0`).setOrigin(.5, 1).setDepth(data.y)
      const label = this.add.text(data.x, data.y + 12, '', { fontFamily: '"Patrick Hand", sans-serif', fontSize: '30px', color: '#fff0d5', backgroundColor: '#241b30', padding: { x: 10, y: 4 } }).setOrigin(.5, 0).setDepth(2800)
      const index = this.props.length
      image.setInteractive().on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); if (this.mode) this.worldDown(p); else if (!this.focus.active) this.command({ type: 'prop', index }); else this.focus.input(this.viewToWorld(p), true) })
      this.props.push({ data, image, label, cooldown: 0, used: false, animation: 0 })
    }
    if (!this.settings.lite) this.createAmbience()
    this.drawWorld(0)
  }
  // Fog, glows, fireflies, leaves and bats: made at the start, or when Lite mode is first turned off mid-run.
  private createAmbience() {
    const ambient = this.options.assets.geometry.ambient
    const add = (kind: string, x: number, y: number, n: number, size = 1) => {
      const image = this.art.image(x, y, `amb/${kind}${kind === 'leaf' || kind === 'bat' ? '/0' : ''}`).setDepth(kind === 'glow' ? 1800 : 1900).setScale(size).setVisible(!this.settings.lite)
      if (kind === 'glow' || kind === 'firefly') image.setBlendMode(Phaser.BlendModes.ADD)
      this.ambience.push({ image, kind, x, y, n })
    }
    for (const [n, y] of (ambient?.fog ?? []).entries()) { add('fog', 960, y, n); this.ambience.at(-1)!.image.setDisplaySize(2400, 180).setAlpha(.28) }
    for (const [n, g] of (ambient?.glows ?? []).entries()) { add('glow', g.x, g.y, n); this.ambience.at(-1)!.image.setDisplaySize(g.r * 2, g.r * 2) }
    for (let i = 0; i < Math.min(30, ambient?.fireflies ?? 0); i++) add('firefly', 100 + i * 137 % 1700, 220 + i * 173 % 650, i)
    if (ambient?.leaves) for (let i = 0; i < 10; i++) add('leaf', i * 199, i * 117 % 1080, i)
    if (ambient) for (let i = 0; i < 3; i++) add('bat', -100, 190 + i * 35, i)
  }
  private updateWorld(dt: number) {
    this.sugarRush = Math.max(0, this.sugarRush - dt); this.bonfire = Math.max(0, this.bonfire - dt)
    for (const p of this.props) {
      const waiting = p.cooldown > 0
      p.cooldown = Math.max(0, p.cooldown - dt)
      if (p.data.kind === 'bridge') {
        if (p.cooldown < 1e-9) p.cooldown = 0
        // The first ten seconds of the 50-second cooldown are spent raised.
        if (this.bridgeUp && p.cooldown <= 40 + 1e-9) {
          this.bridgeUp = false; p.animation = 1; this.sfx('bridge-down', p.data)
          const path = this.options.assets.geometry.switch!.path, detour = this.routes.length + this.flyRoutes.length
          for (const e of this.enemies) if (e.active && !e.boss && !e.returning && !ENEMIES[e.kind].flying && (e.path === path || e.path === detour) && e.distance < this.fork) {
            e.path = path; e.distance = this.routeFor(e).nearest(e.x, e.y).distance
          }
        }
      }
      if (waiting && !p.cooldown) this.sfx('prop-ready', p.data)
    }
  }
  private drawWorld(dt: number) {
    const time = this.presentationTime, idleTime = this.motion && !this.settings.lite && this.quality.tier < 2 ? time : 0
    for (const p of this.props) {
      p.animation = Math.max(0, p.animation - dt)
      if (this.presentationFrozen) continue
      const kind = p.data.kind!, step = (n: number) => Math.min(n - 1, Math.floor((1 - p.animation) * n))
      if (kind === 'cannon') { p.image.setScale(.8 * (1 + .12 * p.animation), .8 * (1 - .1 * p.animation)); p.label.setText(p.cooldown > 0 ? `${Math.ceil(p.cooldown)}s` : 'Fire the cannon'); continue }
      const name = kind === 'lamp' ? p.animation ? `fall/${step(4)}` : p.used ? 'down' : '0' : kind === 'shop' ? p.animation ? `use/${step(6)}` : String(Math.floor(idleTime * 5) % 4)
        : kind === 'bell' ? p.animation ? `ring/${step(6)}` : '0' : kind === 'grate' ? p.animation ? `open/${step(4)}` : '0' : kind === 'bonfire' ? this.bonfire > 0 ? `burn/${Math.floor(idleTime * 8) % 6}` : '0'
        : p.animation ? `move/${step(4)}` : this.bridgeUp ? 'up' : 'down'
      this.art.set(p.image, `prop/${kind}/${name}`)
      p.label.setText(kind === 'bridge' && this.bridgeUp ? `Raised · ${Math.ceil(p.cooldown - 40)}s` : kind === 'lamp' && p.used ? 'Lamp down' : kind === 'bonfire' && this.bonfire > 0 ? `Burning · ${Math.ceil(this.bonfire)}s` : p.cooldown > 0 ? `${Math.ceil(p.cooldown)}s` : kind === 'lamp' ? 'Drop lamp' : kind === 'shop' ? 'Sugar rush · 50' : kind === 'bell' ? 'Ring the bell' : kind === 'grate' ? 'Open the grate' : kind === 'bonfire' ? 'Light the bonfire' : 'Raise bridge')
    }
    if (this.presentationFrozen) return
    for (const portal of this.portals) for (const image of portal.images) this.art.set(image, `prop/portal/${Math.floor(idleTime * 8) % 6}`)
    for (const z of this.zones) this.art.set(z.image, `fx/toxic/${Math.floor(idleTime * 4) % 4}`)
    this.boostRings.forEach((ring, i) => this.art.set(ring, `fx/boost/${Math.floor(idleTime * 6 + i) % 4}`))
    if (!this.motion || this.settings.lite || this.quality.tier > 0) return
    for (const a of this.ambience) {
      const t = time, i = a.n
      if (a.kind === 'fog') a.image.x = a.x + Math.sin(t * .06 + i) * 160
      if (a.kind === 'glow') a.image.setAlpha(.45 + Math.sin(t * 5 + i) * .06 + Math.sin(t * 13) * .025)
      if (a.kind === 'firefly') a.image.setPosition(a.x + Math.sin(t * .45 + i) * 45, a.y + Math.cos(t * .7 + i) * 24).setAlpha(.3 + Math.sin(t * 2 + i) * .25)
      if (a.kind === 'leaf') { this.art.set(a.image, `amb/leaf/${Math.floor(t * 3 + i) % 4}`); a.image.setPosition((a.x + t * 17 + Math.sin(t + i) * 22) % 2020 - 50, (a.y + t * 32) % 1180 - 50).setRotation(t * .5 + i) }
      if (a.kind === 'bat') { this.art.set(a.image, `amb/bat/${Math.floor(t * 9) % 4}`); a.image.setPosition((t % 28) * 220 - 400 - i * 65, a.y + Math.sin(t * 4 + i) * 10) }
    }
  }
  private useProp(index: number, player: Player = 0) {
    const p = this.props[index]
    if (!p || p.cooldown > 0) return
    // Endless props recover more slowly; the timed bridge keeps its 50-second cycle.
    const slow = this.level.endless ? 1.6 : 1
    if (p.data.kind === 'lamp') {
      if (p.used) return
      const reach = new Route(p.data.reach!)
      for (const e of this.enemies) if (e.active && !e.returning && !ENEMIES[e.kind].flying && reach.nearest(e.x, e.y).gap < 90) { this.damage(e, 170, 'physical'); this.status(e, 'stun', 3) }
      if (this.level.endless) p.cooldown = 40; else p.used = true
    } else if (p.data.kind === 'shop') {
      if (!this.spend(player, 50)) { if (this.mine(player)) this.hud.toast('Sugar rush costs 50 candy.'); return }
      this.sugarRush = 10; p.cooldown = 24 * slow; this.hud.toast('Sugar rush! Towers attack 60% faster for 10 seconds.')
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
    } else if (p.data.kind === 'cannon') {
      // Rosie Row: a volley of candy corn at the leading ground enemies on the road it covers; an empty road costs nothing.
      const reach = new Route(p.data.reach!), from = { x: p.data.x, y: p.data.y - 120 }
      const leaders = this.enemies.filter(e => e.active && e.visible && !e.returning && !ENEMIES[e.kind].flying && reach.nearest(e.x, e.y).gap < 110)
        .sort((a, b) => b.distance / this.routeFor(b).length - a.distance / this.routeFor(a).length).slice(0, CANNON_SHOTS)
      if (!leaders.length) { if (this.mine(player)) this.hud.toast('The cannon has nothing to aim at yet.'); return }
      const damage = CANNON_DAMAGE * this.healthScale(Math.max(0, this.wave - 1))
      for (let i = 0; i < CANNON_SHOTS; i++) {
        const target = leaders[i % leaders.length]
        this.fire(from.x, from.y, target, damage, 'catapult', 70, { frame: 'proj/candycorn', duration: .7 + i * .09, arc: 220 + i * 25, onHit: e => { if (!ENEMIES[e.kind].flying) this.damage(e, damage, 'physical') }, after: () => { this.effect('fx/candycorn/0', target.x, target.y - 35, .6, 1.1) } })
      }
      p.cooldown = 25; this.effect('fx/poof/0', from.x, from.y, .5, 1.3); this.shake(.004); this.hud.toast('Candy cannon! A volley at the leaders.')
    } else if (p.data.kind === 'bonfire') {
      // Rare Row: the whole map is lit, and every ghost revealed, for 20 seconds.
      this.bonfire = 20; p.cooldown = 45 * slow; this.hud.toast('The bonfire roars! Everything is lit for 20 seconds.')
    } else {
      const sw = this.options.assets.geometry.switch
      if (!sw || !this.detour) return
      this.bridgeUp = true; p.cooldown = 50
      const detourIndex = this.routes.length + this.flyRoutes.length
      const reach = new Route(p.data.reach!)
      for (const e of this.enemies) if (e.active && !e.boss && !ENEMIES[e.kind].flying && (e.path === sw.path || e.path === detourIndex)) {
        const crossing = reach.nearest(e.x, e.y)
        if (e.path === sw.path && crossing.gap < 55 && crossing.distance > 0 && crossing.distance < reach.length) {
          this.effect('fx/blink/0', e.x, e.y, .8); e.returning = 6; e.art.root.setVisible(false); e.path = detourIndex; e.distance = this.fork; this.routeFor(e).at(e.distance, e)
        } else if (!e.returning && e.distance < this.fork) { e.path = detourIndex; e.distance = this.routeFor(e).nearest(e.x, e.y).distance }
      }
      this.hud.toast('Bridge up for 10 seconds! New arrivals take the long way. Fallen marchers return in 6 seconds.')
    }
    p.animation = 1; this.sfx(`prop-${p.data.kind!}`, p.data); this.drawWorld(0)
  }
  private drawMap() {
    if (this.textures.exists('siege-background')) curbedMap(this, [...this.routes, ...(this.detour ? [this.detour] : [])], this.options.assets.geometry)
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
    return { root, body, face, icons, statusImage: status, drawFrame: -1, faceId: id, faceLeft: false, hitTint: false, statusFrame: -1, reaction: reaction(), age: 0, walkAge: 0, blockUntil: 0, blockX: 0, blockY: 0, popAt: 0, deflectAt: 0, missAt: 0, statusSlot: 0, shown: false }
  }
  private makePools() {
    for (let i = 0; i < LIMITS.enemies; i++) {
      // Allocate a neutral face once; actual random Chogs are assigned only on spawn.
      const art = this.unit('treater', this.options.hero); art.root.setVisible(false)
      this.enemies.push({ returning: 0, casting: 0, poisonStacks: 0, active: false, generation: 0, wave: 0, kind: 'treater', id: 1, mods: [], path: 0, distance: 0, speed: 0, x: 0, y: 0, hp: 0, maxHp: 0, candy: 0, jars: 1, status: clearStatuses(), age: 0, hit: 0, attack: 0, skill: 0, lucky: false, revived: false, armour: false, visible: true, art, slowPower: .5, heroDot: false, sigCooldown: 0, shield: 0, gold: 0, lit: true })
    }
    for (let i = 0; i < LIMITS.projectiles; i++) this.projectiles.push({ active: false, target: null, generation: 0, life: 0, duration: 1, x: 0, y: 0, fromX: 0, fromY: 0, endX: 0, endY: 0, damage: 0, kind: 'egg', splash: 0, image: this.art.image(0, 0, 'proj/egg').setDepth(2100).setVisible(false) })
    for (let i = 0; i < LIMITS.effects; i++) this.effects.push({ active: false, image: this.art.image(0, 0, 'fx/poof/0').setDepth(2200).setVisible(false), text: null, life: 0, duration: 0, x: 0, y: 0, toX: 0, toY: 0, size: 1, name: '', mode: 'burst', count: 1, angle: 0, delay: 0, flip: false })
    const texture = this.textures.createCanvas('siege-digits', 2048, 128)!, context = texture.context
    const chars: Record<number, object> = {}
    context.font = '76px "Luckiest Guy", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillStyle = '#ffffff'
    for (const [i, char] of [...'0123456789+-!,/'].entries()) {
      const width = char === ',' ? 48 : 96
      context.fillText(char, i * 96 + width / 2, 10)
      chars[char.charCodeAt(0)] = { x: i * 96, y: 0, width, height: 104, centerX: width / 2, centerY: 52, xOffset: 0, yOffset: 0, xAdvance: char === ',' ? 32 : 64, kerning: {}, data: {}, u0: i * 96 / 2048, v0: 0, u1: (i * 96 + width) / 2048, v1: 104 / 128 }
    }
    texture.refresh(); this.cache.bitmapFont.add('siege-digits', { data: { font: 'siege-digits', size: 80, lineHeight: 104, chars }, texture: 'siege-digits', frame: null })
    this.rewardText = this.add.bitmapText(0, 0, 'siege-digits', '', 44).setOrigin(.5).setDepth(2310).setTint(this.options.coop ? YOU : 0xffdc83).setVisible(false)
    for (let i = 0; i < LIMITS.numbers; i++) this.numbers.push({ active: false, text: this.add.bitmapText(0, 0, 'siege-digits', '', 34).setOrigin(.5).setDepth(2300).setVisible(false), life: 0, x: 0, y: 0 })
  }
  // The side a wave's Witching Hour swarm comes from. Town Square's porch sits between four roads, so it has no single far side:
  // each Witching Hour (every tenth wave) takes the next road's side in turn, and that road is always open by then.
  swarmAway(wave: number): Point {
    if (!this.level.endless) return this.away
    const paths = this.options.assets.geometry.paths, [x, y] = paths[Math.floor(wave / 10) % paths.length][0], porch = this.options.assets.geometry.porch
    return { x: x - porch.x, y: y - porch.y }
  }
  swarmSide(wave: number) { const a = this.swarmAway(wave); return SIDES[Math.round(Math.atan2(a.y, a.x) / (Math.PI / 4)) & 7] }
  // Edge swarms (Witching Hour) start just outside the widest view (2400 wide, so off screen on every device and the same for both
  // co-op players) and walk straight at the porch; ghosts weave as they drift. They enter only from the edges inside the 90° wedge
  // facing away from the porch, never from the 270° around it; `edge` picks a quarter of that stretch, so the swarm spreads along it.
  private wildRoute(edge: number, kind: EnemyKind, wave: number) {
    const porch = this.options.assets.geometry.porch
    const from = wedgePoint(-330, -90, 2250, 1170, porch, this.swarmAway(wave), (edge + this.random()) / 4, this.span)
    return Route.wild(from, porch, kind === 'ghost' ? 55 + this.random() * 55 : 0, this.random() * 6.28)
  }
  private spawn(entry: Spawn): boolean {
    if (entry.boss) return spawnBoss(this, entry.boss, entry.wave)
    const { kind, path, wave, distance = 0, route } = entry
    const enemy = this.enemies.find(e => !e.active)
    if (!enemy) return false
    const id = entry.chogId ?? 1 + Math.floor(this.random() * 1969), traits = traitsFor(this.options.assets.traits, id), mods = modifiersFor(traits), config = ENEMIES[kind]
    const multiplier = 1 + eliteBonus(traits) * .5, health = this.healthScale(wave), wild = entry.edge === undefined ? undefined : this.wildRoute(entry.edge, kind, wave)
    Object.assign(enemy, { active: true, generation: enemy.generation + 1, wave, kind, id, mods, path: wild ? -1 : route ?? this.roadFor(kind, path), route: wild, boss: undefined, distance, returning: 0, casting: 0, poisonStacks: 0, speed: config.speed * (mods.includes('wind') ? 1.2 : 1) * this.speedScale, hp: config.hp * multiplier * health, maxHp: config.hp * multiplier * health, candy: entry.risen ? 0 : Math.round(config.candy * multiplier * (mods.includes('rich') ? 2 : 1)), jars: Math.max(config.jars, mods.includes('hungry') ? 2 : 1), age: 0, hit: 0, attack: .5, skill: 4 + this.random() * 2, lucky: false, revived: false, armour: false, visible: kind !== 'ghost', slowPower: .5, heroDot: false, sigCooldown: 0, shield: 0, gold: 0, lit: true })
    for (const key of Object.keys(enemy.status) as Status[]) enemy.status[key] = 0
    this.art.set(enemy.art.body, `enemy/${kind}/walk/0`)
    const ref = this.heads.window(id)
    enemy.art.face.setTexture(ref.key, ref.frame).setVisible(true)
    enemy.art.root.setVisible(true).setAlpha(1).setScale(1)
    enemy.art.body.clearTint(); enemy.art.face.clearTint(); enemy.art.drawFrame = -1; enemy.art.faceId = -1; enemy.art.hitTint = false; enemy.art.statusFrame = -1
    // Raised by a boss (Rise Again, the Pact's imps, the Pumpkin's last wave): they climb out of the ground glowing with grave light.
    enemy.art.risen = !!entry.risen; enemy.art.shielded = false
    if (entry.risen) { enemy.art.body.setTint(RISEN); enemy.art.face.setTint(RISEN) }
    this.resetReaction(enemy)
    enemy.art.icons.forEach((icon, i) => { icon.setVisible(!!mods[i]); if (mods[i]) this.art.set(icon, `mod/${mods[i]}`) })
    this.routeFor(enemy).at(distance, enemy)
    if (entry.risen) { this.effect('fx/poof/0', enemy.x, enemy.y - 10, .6, 1.5); this.effect('fx/bones/0', enemy.x, enemy.y - 30, .7, 1.1) }
    this.waveAlive[wave] = (this.waveAlive[wave] ?? 0) + 1
    const fresh = !this.discovered.has(`enemy/${kind}`)
    this.discover([`enemy/${kind}`, ...mods.map(m => `mod/${m}`)])
    // The tutorial run's first wave meets its treaters without a card, as when the tutorial spanned that wave: only build and call-wave stop play.
    if (fresh && !this.focus.active && !this.options.coop && !(this.options.tutorial && wave === 0)) { this.setPaused(true); this.options.onIntro(kind) }
    const modifier = MODIFIERS.find(rule => mods.includes(rule.name))
    if (modifier) this.hud.ruleMoment('trait', enemy, `mod/${modifier.name}`, `${modifier.name.toUpperCase()} · ${modifier.enemy}`)
    return true
  }
  private createPathPreview() {
    const routes = [...this.routes, ...this.flyRoutes, ...(this.detour ? [this.detour] : [])]
    this.pathPreview = routes.map((route, path) => {
      const first = route.points.findIndex(p => p.x >= 0 && p.x <= 1920 && p.y >= 0 && p.y <= 1080)
      const start = Math.max(0, first) / (route.points.length - 1) * route.length
      const skips = this.portals.filter(p => p.path === path).map(p => ({ at: p.at, to: p.to })).sort((a, b) => a.at - b.at)
      return { route, path, start, span: route.length - start - skips.reduce((sum, p) => sum + p.to - p.at, 0), skips, images: Array.from({ length: 10 }, () => this.art.image(0, 0, 'teach/path-dot').setDepth(6).setVisible(false)), pulse: this.art.image(0, 0, 'combat/ring/0').setDepth(6).setTint(0xffd477).setVisible(false), cueAge: 0, alpha: 0, selected: false }
    })
  }
  private drawPathPreview(dt: number) {
    const wave = this.waveAt(this.wave)
    if (this.previewWave !== this.wave || this.previewBridge !== this.bridgeUp) {
      this.previewWave = this.wave; this.previewBridge = this.bridgeUp
      // Edge-swarm paths do not exist until spawn's random draw; never invent a road or advance that RNG here.
      const paths = new Set(wave?.groups.filter(g => !g.edge && g.count > 0).map(g => this.roadFor(g.type, g.path ?? 0)))
      if (wave?.boss) paths.add(this.roadFor('treater', 0))
      for (const entry of this.pathPreview) { entry.selected = paths.has(entry.path); entry.cueAge = 0 }
    }
    const preparing = !!wave && !this.ended && this.presentationTime >= this.previewHideUntil && (this.wave === 0 || this.countdown > 0 && !this.schedule.some(e => e.wave === this.wave - 1))
    const moving = !reducedMotion() && !this.settings.lite && this.quality.tier < 2, count = moving ? 10 : 4
    if (moving) this.previewTravel += dt * 240
    for (const entry of this.pathPreview) {
      entry.alpha = this.ended ? 0 : Phaser.Math.Clamp(entry.alpha + (preparing && entry.selected ? 1 : -1) * dt / .25, 0, 1)
      if (preparing && entry.selected) entry.cueAge += dt
      entry.pulse.setVisible(moving && entry.selected && entry.cueAge < .75 && entry.alpha > 0)
      if (entry.pulse.visible) {
        entry.route.at(entry.start + 130, entry.pulse)
        const t = entry.cueAge / .75
        entry.pulse.setDisplaySize(90 + 100 * t, 90 + 100 * t).setAlpha(entry.alpha * (1 - t))
      }
      for (let i = 0; i < entry.images.length; i++) {
        const image = entry.images[i], visible = entry.alpha > 0 && i < count
        image.setVisible(visible)
        if (!visible) continue
        const along = moving ? (this.previewTravel + i * entry.span / count) % entry.span : (i + .5) * entry.span / count
        let distance = entry.start + along
        for (const skip of entry.skips) if (distance >= skip.at) distance += skip.to - skip.at
        entry.route.at(distance, image)
        const at = Math.min(entry.route.points.length - 2, Math.floor(distance / entry.route.length * (entry.route.points.length - 1))), a = entry.route.points[at], b = entry.route.points[at + 1]
        this.art.set(image, moving ? 'teach/path-dot' : 'teach/path-arrow')
        const fade = moving ? Math.min(1, along / 100, (entry.span - along) / 100) : 1
        image.setDisplaySize(moving ? 96 : 54, moving ? 96 : 54).setRotation(Math.atan2(b.y - a.y, b.x - a.x)).setAlpha(entry.alpha * fade * (moving ? 1 : .85))
      }
    }
  }
  callWave() {
    if (this.paused || this.ended || this.wave >= this.waveCount || (this.options.tutorial && this.tutorialStep === 0)) return
    this.hud.closePreview()
    const early = this.wave > 0 ? Math.ceil(Math.max(0, this.countdown) * EARLY_CALL_CANDY_PER_SECOND) : 0
    if (early) { this.earlyCalls++; const gain = this.income(early); this.hud.toast(`Early call! +${this.wallets ? gain : early} candy`); this.sfx('early-call') }
    const data = this.waveAt(this.wave)!
    this.previewHideUntil = this.presentationTime + .3
    const wave = this.wave++
    this.heroes.forEach(hero => hero.onWave())
    this.waveAlive[wave] = 0
    // Witching Hour: the edge swarms start three seconds after the warning, spread over the four quarters of the far-side stretch.
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
    this.options.sfx.play(data.witching ? 'witching' : 'wave-horn')
    if (data.witching) this.options.sfx.duck(2.5)
    if (data.witching) { this.warning = { until: this.presentationTime + 3.5, away: this.swarmAway(wave) }; this.hud.banner(`WITCHING HOUR: they're coming from the ${this.swarmSide(wave)}!`) }
    else this.hud.banner(`WAVE ${this.wave}  ·  ${data.name}`)
    this.tutorial('wave'); this.hud.refresh()
  }
  update(_time: number, delta: number) {
    if (!this.ready || this.restoring) return
    if (this.quality.update(this.game.loop.rawDelta, !this.paused && !this.ended && !this.focus.active)) this.applyQuality()
    const real = Math.min(delta / 1000, .06)
    if (!this.paused) { this.presentationTime += real; this.hitPause = Math.max(0, this.hitPause - real) }
    this.hudTime += real; this.portraitTime += real
    if (this.portraitTime > .2) { this.art.refresh(); this.portraitTime = 0 }
    if (this.hudTime > .12) { this.hud.refresh(); this.hudTime = 0 }
    this.drawPathPreview(this.paused ? 0 : real)
    this.hints.update()
    if (this.ended) {
      // Co-op: no more checkpoints once the final one matched, so the Chogs may dance.
      if (!this.celebrating && this.coopResult && this.net && this.net.verifiedTick >= this.coopFinishAt) this.celebrate(this.coopResult.won)
      if (this.celebrating) for (const hero of this.heroes) {
        const clip = this.options.assets.rig.clips[hero.rig.clip]
        if (hero.rig.clip.startsWith('dance-') && !clip.loop && hero.rig.time >= clip.ms) hero.rig.play(hero.rig.clip)
        hero.rig.update(real)
      }
      this.drawWorld(real); this.updateSignatures(real); this.updateEffects(real); updateCorpses(this, real); this.drawUnits(real); return
    }
    if (this.paused) return
    if (!this.focus.waiting) {
      if (this.holdAt && this.input.activePointer.isDown) {
        if (distanceSq(this.holdAt, this.pointer) > 28 ** 2) this.holdAt = null
        else { this.holdTime += real; if (this.holdTime > .55) { this.holdAt = null; this.toggleEmotes() } }
      }
      if (!this.options.coop) {
        this.accumulator += real * this.speed
        while (this.accumulator >= 1 / 45 && !this.paused && !this.ended) { this.tick(1 / 45); this.accumulator -= 1 / 45 }
      }
    }
    this.drawWorld(real)
    this.updateEffects(real)
    if (!this.presentationFrozen) { this.updateSignatures(real); updateCorpses(this, real) }
    this.darkness?.update(this.sources, real, this.bonfire > 0)
    this.drawUnits(this.focus.waiting ? 0 : real)
    if (this.options.coop) { this.readQueue(); this.drawQueued() }
    this.drawSelection()
    this.hud.animate(this.presentationTime, real)
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
      const bonus = this.waveAt(w)!.bonus, tip = this.options.tutorial ? TIPS[w] : undefined
      this.rewarded.add(w); const gain = this.income(bonus); this.hud.toast(`Wave cleared! +${gain} candy${tip ? `\nTip: ${tip}` : ''}`, tip ? 7 : undefined)
      if (w + 1 < this.waveCount) this.sfx('wave-clear')
    }
    for (const key of ['rain', 'boo'] as const) this.spellCooldown[key] = Math.max(0, this.spellCooldown[key] - dt)
    this.missTime = Math.max(0, this.missTime - dt)
    this.updateTowers(dt); this.heroes.forEach(hero => hero.update(dt))
    this.updateLights()
    this.crowns.length = 0
    for (const enemy of this.enemies) if (enemy.active && enemy.mods.includes('crown')) this.crowns.push(enemy)
    for (const enemy of this.enemies) if (enemy.active) this.updateEnemy(enemy, dt)
    for (let i = this.later.length - 1; i >= 0; i--) if (this.later[i].at <= this.clock) { const { run } = this.later[i]; this.later.splice(i, 1); run() }
    this.updateAllies(dt); this.updateHazards(dt)
    this.updateProjectiles(dt)
    this.updateTraps(dt); updateConsumables(this, dt)
    if (this.jars <= 0) this.finish(false)
    else if (this.wave === this.waveCount && !this.schedule.length && !this.enemies.some(e => e.active)) this.finish(true)
  }
  // Zombies and risen enemies fight beside the guards for a while, then crumble.
  summon(x: number, y: number, tint: number, life: number, hp: number, damage: number) {
    if (this.allies.length >= 8) return
    const image = this.art.image(x, y - 35, 'guard/knight/walk/0').setDisplaySize(75, 75).setTint(tint)
    this.allies.push({ x, y, hp, maxHp: hp, respawn: 0, cooldown: 0, slow: 0, image, life, damage })
    this.effect('fx/poof/0', x, y - 40, .5, 1); this.sfx('summon', { x, y })
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
      if (target && a.cooldown <= 0) { this.damage(target, a.damage, 'physical', true, false, { from: a }); a.cooldown = .9; a.poseUntil = this.presentationTime + .22 }
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
      for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (guard.hp > 0 && distanceSq(guard, h) < h.r * h.r) guard.hp -= 14
      for (const ally of this.allies) if (distanceSq(ally, h) < h.r * h.r) ally.hp -= 14
      for (const hero of this.heroes) if (hero.alive && distanceSq(hero, h) < h.r * h.r) hero.hurt(5)
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
    if (e.status.burn || e.status.poison || e.status.bleed) { this.damage(e, ((e.status.burn ? 13 : 0) + (e.status.poison ? 10 * Math.max(1, e.poisonStacks) : 0) + (e.status.bleed ? 12 : 0)) * dt, 'magic', false, e.heroDot ? this.heroes[e.heroOwner ?? 0] : false); if (!e.active) return }
    if (!e.status.poison) e.poisonStacks = 0
    if (e.boss) updateBoss(this, e, dt)
    e.shield = Math.max(0, e.shield - dt); e.gold = Math.max(0, e.gold - dt)
    // On a dark map only light shows an enemy, and what can't be seen can't be hit; the bonfire (and Target Lock) reveal everything.
    e.lit = this.isLit(e)
    if (this.bonfire > 0) e.status.reveal = Math.max(e.status.reveal, .2)
    e.visible = (e.kind !== 'ghost' || e.status.reveal > 0) && (!this.dark || e.lit || e.status.reveal > 0 || !!e.boss)
    if (e.kind === 'ghost' && e.visible !== e.art.shown) { e.art.shown = e.visible; if (e.visible) this.sfx('ghost-reveal', e) }
    e.armour = e.mods.includes('metal')
    for (const other of this.crowns) if (other.active && !other.returning && other !== e && distanceSq(e, other) < 160 * 160) { e.armour = true; break }
    if (e.skill <= 0 && !e.status.stun && !e.status.freeze && !e.status.fear && !e.status.charm && !e.status.confuse) {
      if (e.kind === 'witch') {
        e.casting = .7
        this.effect('fx/heal/0', e.x, e.y - 50, .7); this.sfx('witch-heal', e)
        for (const other of this.enemies) if (other.active && !other.returning && distanceSq(e, other) < 200 * 200) { other.hp = Math.min(other.maxHp, other.hp + 45); this.effect('fx/heal/0', other.x, other.y - 45, .7, .65) }
      }
      if (e.mods.includes('laser')) {
        const tower = this.towers.find(t => t && distanceSq(e, t) < 350 * 350)
        if (tower) { tower.stun = 1; this.addBeam(e, { x: tower.x, y: tower.y - 100 }, 0xff747f); this.effect('status/freeze/0', tower.x, tower.y - 120, 1, 1.4); this.sfx('laser-stun', tower) }
      }
      if (e.mods.includes('wizard') && !e.status.stun) { e.distance += 80; this.effect('fx/poof/0', e.x, e.y - 50, .6); this.sfx('wizard-blink', e) }
      if (e.mods.includes('gum')) for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (distanceSq(e, guard) < 120 * 120) { guard.slow = 3; this.effect('trap/gum/0', guard.x, guard.y, .7, .5); this.sfx('gum', guard) }
      e.skill = 6
    }
    if (e.casting > 0) {
      e.casting = Math.max(0, e.casting - dt)
      if (!e.casting && !e.status.stun && !e.status.freeze && !e.status.root) { this.effect('fx/blink/0', e.x, e.y - 50, .6); e.distance += 120; this.routeFor(e).at(e.distance, e); this.effect('fx/blink/0', e.x, e.y - 50, .6); this.sfx('witch-blink', e) }
      return
    }
    if (e.status.charm > 0) {
      const target = this.target(e, 240, 'close')
      if (target && e.attack <= 0 && !e.status.stun && !e.status.freeze) { this.damage(target, Math.max(20, e.maxHp * .12), 'physical', true, true); e.attack = .65; this.addBeam(e, target, 0xff9fc9) }
      return
    }
    let blocked = false
    if (!ENEMIES[e.kind].flying || e.status.ground > 0) for (const item of this.items) if (item.kind === 'candy-cane' && distanceSq(e, item) < CONSUMABLES['candy-cane'].radius * CONSUMABLES['candy-cane'].radius) { blocked = true; break }
    if ((!ENEMIES[e.kind].flying || e.status.ground > 0) && e.visible && !e.status.fear) {
      // Tower guards and temporary allies hold the road alike; a blocker is a wall that is only walked into.
      for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (this.clash(e, guard)) blocked = true
      for (const ally of this.allies) if (this.clash(e, ally)) blocked = true
      for (const wall of this.blockers) if (distanceSq(e, wall) < wall.radius * wall.radius) blocked = true
    }
    if (e.mods.includes('toxic')) for (const tower of this.towers) if (tower) for (const guard of tower.guards) if (guard.hp > 0 && distanceSq(e, guard) < 110 * 110) guard.hp -= dt * 12
    const targetHero = this.nearestHero(e)
    for (const hero of this.heroes) if (hero.alive && distanceSq(e, hero) < 90 * 90 && e.mods.includes('toxic')) hero.hurt(10 * dt * hero.enemyDamage(e))
    if (targetHero && distanceSq(e, targetHero) < 90 * 90 && e.attack <= 0 && !e.status.stun && !e.status.freeze && !e.status.fear) { targetHero.hurt((e.boss ? 24 : 11) * targetHero.enemyDamage(e), e); e.attack = 1 }
    const slow = e.status.slow && !e.mods.includes('burning') ? e.slowPower : 1
    const candle = e.mods.includes('candle') ? (Math.floor(e.age / 3) % 2 ? .65 : 1.5) : 1
    if (candle > 1 && Math.floor(e.age / 3) !== Math.floor((e.age - dt) / 3)) this.sfx('candle-pump', e)
    // Radioactive Ridge: ground enemies inside a toxic pool move 30% faster.
    let toxic = 1
    if (!e.route && !ENEMIES[e.kind].flying) for (const z of this.zones) if (distanceSq(e, z) < z.r * z.r) { toxic = 1.3; break }
    const decoy = !e.boss && !ENEMIES[e.kind].flying && !e.mods.includes('visor') && !e.status.fear ? this.items.find(item => item.kind === 'scarecrow' && item.hp > 0 && distanceSq(e, item) < CONSUMABLES.scarecrow.radius * CONSUMABLES.scarecrow.radius) : undefined
    const lure = decoy ? this.routeFor(e).nearest(decoy.x, decoy.y).distance : 0, from = e.distance
    if (decoy && !blocked && !e.status.stun && !e.status.freeze && !e.status.root) {
      e.distance += Phaser.Math.Clamp(lure - e.distance, -dt * e.speed * slow, dt * e.speed * slow)
      if (Math.abs(e.distance - lure) < 55 && e.attack <= 0) { decoy.hp -= 24; e.attack = .8; this.effect('item/scarecrow/fx/0', decoy.x, decoy.y - 50, .3, .6); this.sfx('decoy-hit', decoy) }
    }
    const held = !!decoy || !!e.boss && (e.boss.casting > 0 || e.boss.intro > 0 || e.boss.dash > 0)
    if (!e.status.stun && !e.status.freeze && !e.status.root && (!blocked || e.status.fear) && !held) e.distance += dt * e.speed * slow * candle * toxic * Math.min(...this.heroes.map(hero => hero.enemySpeed(e))) * (e.status.fear ? -1.25 : e.status.confuse ? sine(e.age * 3) : 1)
    e.distance = Math.max(0, e.distance)
    if (from < ENTRANCE && e.distance >= ENTRANCE && !e.route && !e.boss) this.sfx('arrive', e, KIND_PITCH[e.kind])
    // Mon Manor: walking into a portal comes out of its twin further along; flyers pass over.
    if (!e.route && !ENEMIES[e.kind].flying) for (const portal of this.portals) if (e.path === portal.path && e.distance >= portal.at && e.distance < portal.to) {
      this.effect('fx/teleport/0', e.x, e.y - 20, .6, 1.3); e.distance = portal.to + 4; this.routeFor(e).at(e.distance, e); this.effect('fx/teleport/0', e.x, e.y - 20, .6, 1.3); this.sfx('portal', e)
    }
    this.routeFor(e).at(e.distance, e)
    if (decoy) { const pull = Math.max(0, 1 - Math.abs(e.distance - lure) / 70); e.x += (decoy.x - e.x) * pull; e.y += (decoy.y - e.y) * pull }
    if (e.distance >= this.routeFor(e).length) {
      this.stealFeedback(e)
      this.jarsLost += Math.min(this.jars, e.jars)
      this.jars = Math.max(0, this.jars - e.jars)
      this.effect('ui/jar', e.x, e.y - 60, 1.2, .65, 'jar', e.x + 150, e.y - 170)
      if (!e.boss) this.signature(e, true)
      this.options.sfx.play('jar-stolen'); this.shake(.004)
      this.removeEnemy(e)
    }
  }
  private clash(e: Enemy, guard: Guard) {
    if (guard.hp <= 0 || distanceSq(e, guard) >= 66 * 66) return false
    e.art.blockUntil = this.presentationTime + .08; e.art.blockX = guard.x; e.art.blockY = guard.y; guard.blockUntil = this.presentationTime + .08
    if (e.attack <= 0 && !e.status.stun && !e.status.freeze) {
      guard.hp -= (e.mods.includes('knife') ? 45 : e.boss ? 48 : 16) * Math.min(...this.heroes.map(hero => hero.enemyDamage(e))); e.attack = .8
      const dx = guard.x - e.x, dy = guard.y - e.y, length = hypot(dx, dy) || 1
      guard.poseUntil = this.presentationTime + .24; guard.recoilX = dx / length * 5; guard.recoilY = dy / length * 5
      this.kick(e.art.reaction, e, -dx / length * 9, -dy / length * 9, 0)
      this.effect('combat/block/0', (e.x + guard.x) / 2, (e.y + guard.y) / 2 - 48, .24, .72)
      if (this.presentationTime >= e.art.popAt) { this.combatPop('block', guard.x, guard.y - 106); this.sfx('block', guard); e.art.popAt = this.presentationTime + 1.2 }
    }
    return true
  }
  private drawGuard(guard: Guard, kind: 'knight' | 'jack') {
    if (this.presentationFrozen) return
    const attack = Math.max(0, (guard.poseUntil ?? 0) - this.presentationTime), holding = (guard.blockUntil ?? 0) > this.presentationTime
    this.art.set(guard.image, attack || holding ? `guard/${kind}/attack/${Math.min(2, Math.floor((.24 - Math.min(.24, attack)) * 13))}` : `guard/${kind}/walk/0`)
    const recoil = this.motion ? attack / .24 : 0
    guard.image.setPosition(guard.x + (guard.recoilX ?? 0) * recoil, guard.y - 35 + (guard.recoilY ?? 0) * recoil).setAlpha(1).setDepth(guard.y + 10)
  }
  private updateTowers(dt: number) {
    for (const tower of this.towers) if (tower) {
      tower.stun = Math.max(0, tower.stun - dt); tower.gold = Math.max(0, tower.gold - dt); tower.cooldown -= dt * Math.max(...this.heroes.map(hero => hero.towerSpeed(tower))) * (this.sugarRush > 0 ? 1.6 : 1)
      const config = towerStats(tower)
      if (tower.stun) continue
      if (tower.kind === 'lantern') for (const e of this.enemies) if (e.active && distanceSq(tower, e) <= config.range * config.range) { this.status(e, 'reveal', .2); e.visible = true }
      if (tower.kind === 'patch') {
        for (const guard of tower.guards) {
          guard.slow = Math.max(0, guard.slow - dt); guard.cooldown -= dt * (guard.slow ? .5 : 1) * Math.max(...this.heroes.map(hero => hero.towerSpeed(tower))) * (this.sugarRush > 0 ? 1.6 : 1)
          // A fallen guard's respawn clock starts at 8; its first tick down is the fall.
          if (guard.hp <= 0) { if (guard.respawn === 8) this.sfx('guard-down', guard); guard.respawn -= dt; guard.image.setAlpha(.2); if (guard.respawn <= 0) { guard.hp = guard.maxHp; guard.respawn = 8; this.effect('fx/poof/0', guard.x, guard.y - 40, .5); this.sfx('guard-up', guard) }; continue }
          const target = this.target(guard, 150, 'close', true)
          if (target && guard.cooldown <= 0) { this.damage(target, config.damage * this.towerBuff(tower) * (tower.spec === 'knights' ? 1.4 : 1), 'physical', true, false, { from: guard }); if (tower.spec === 'vines') { this.status(target, 'root', 1 + tower.rank * .3); this.effect('fx/vines/0', target.x, target.y, .8) }; guard.cooldown = config.interval; guard.poseUntil = this.presentationTime + .24; this.sfx('fire-patch', guard); if (!target.mods.includes('slippery')) target.distance = Math.max(0, target.distance - 5) }
        }
      } else if (tower.cooldown <= 0) {
        const target = this.target(tower, config.range, tower.targeting, tower.kind === 'cauldron' || tower.kind === 'catapult', tower.kind === 'roost', tower.kind === 'lighthouse')
        // Explain the exact hidden-target rejection only while an otherwise ready tower is idle.
        if (!target && tower.kind !== 'roost' && tower.kind !== 'lighthouse') {
          const ghost = this.enemies.find(e => e.active && !e.returning && e.kind === 'ghost' && !e.visible && !e.status.reveal && !e.status.charm && distanceSq(tower, e) <= config.range * config.range)
          if (ghost) this.hud.ruleMoment('hidden', ghost, 'enemy/ghost/walk/0', 'HIDDEN · light it with a lantern')
        }
        // The Scream: half the shots go wide.
        if (target && this.missTime > 0 && this.random() < .5) {
          tower.cooldown = config.interval; this.towerShot(tower, target); this.combatPop('miss', tower.x, tower.y - 175); this.effect('fx/poof/0', tower.x, tower.y - 120, .4, .8); this.sfx('miss', tower)
          // The wasted shot visibly sails wide of its target.
          const wide = (this.visualRandom() < .5 ? -1 : 1) * (110 + this.visualRandom() * 60), proj = TOWERS[tower.kind].projectile
          if (proj) this.effect(proj === 'bat' ? 'unit/bat/0' : `proj/${proj}`, tower.x, tower.y - 125, .42, .9, 'travel', target.x + wide, target.y - 40 - Math.abs(wide) * .5)
        }
        else if (target && this.towerAttack(tower, target)) { tower.cooldown = config.interval; tower.pop = .15; this.towerShot(tower, target); this.sfx(`fire-${tower.kind}`, tower) }
      }
    }
  }
  private towerBuff(tower: Tower) { return Math.max(...this.heroes.map(hero => hero.towerBuff(tower))) }
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
  abilityName() { return this.options.assets.kits.slots.special[this.localHero.kit.special].name }
  fire(x: number, y: number, target: Enemy, damage: number, kind: TowerKind | 'hero', splash: number, options?: { owner?: number; frame: string; duration: number; arc: number; onHit: (enemy: Enemy) => void; after?: () => void }): boolean {
    const p = this.projectiles.find(item => !item.active)
    if (!p) return false
    Object.assign(p, { active: true, target, generation: target.generation, fromX: x, fromY: y, x, y, endX: target.x, endY: target.y - 45, life: 0, duration: options?.duration ?? (kind === 'tp' ? .5 : .23), damage, kind, splash, arc: options?.arc ?? (kind === 'tp' ? 130 : 30), frame: options?.frame, frameCount: options ? this.art.count(options.frame) : 1, onHit: options?.onHit, after: options?.after, owner: options?.owner })
    p.drawn = false
    return true
  }
  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) if (p.active) {
      p.life += dt
      if (p.target?.active && p.target.generation === p.generation) { p.endX = p.target.x; p.endY = p.target.y - 45 }
      const t = Math.min(1, p.life / p.duration)
      p.x = Phaser.Math.Linear(p.fromX, p.endX, t); p.y = Phaser.Math.Linear(p.fromY, p.endY, t) - sine(t * Math.PI) * (p.arc ?? 30)
      if (t >= 1) {
        p.active = false
        const validTarget = p.target?.active && p.target.generation === p.generation
        const hit = (e: Enemy) => {
          if (!e.visible || e.status.charm > 0) return
          const egg = p.kind === 'egg' || p.kind === 'hero' && this.heroes[p.owner ?? 0].kit.weapon === 'egg-lob'
          if (egg && e.status.wrap > 0) { e.status.wrap = 0; this.combo('eggsplosion', e); this.effect('fx/eggsplosion/0', e.x, e.y - 40, .7, 1.8); const reach = Math.max(75, p.splash) * 2; for (const other of this.enemies) if (other.active && other !== e && distanceSq(other, e) < reach * reach) this.damage(other, p.damage, 'magic', true, p.kind === 'hero' ? this.heroes[p.owner ?? 0] : false) }
          if (p.onHit) { p.onHit(e); return }
          const landed = this.damage(e, p.damage, p.kind === 'lantern' ? 'magic' : p.kind === 'egg' ? 'egg' : 'physical')
          if (!landed || !e.active) return
          if (p.kind === 'tp') { this.status(e, 'slow', 2); this.status(e, 'wrap', 3); e.slowPower = .5 }

        }
        this.impactProjectile = p; this.impactSound = null
        try {
          if (p.splash) for (const e of this.enemies) { if (e.active && distanceSq(e, { x: p.endX, y: p.endY + 45 }) <= p.splash * p.splash) hit(e) }
          else if (p.target?.active && p.target.generation === p.generation) hit(p.target)
          if (validTarget) p.after?.()
        } finally { this.impactProjectile = null }
        // One sound per projectile: a landed hit ('splat') speaks for its type, the potion and candy corn for their splash.
        if (this.impactSound) this.sfx(this.impactSound !== 'splat' ? this.impactSound : p.kind === 'cauldron' || p.kind === 'catapult' ? 'impact-splash' : `impact-${this.impactKind}`, { x: p.endX, y: p.endY })
        this.impactSound = null
      }
    }
  }
  resetReaction(e: Enemy) {
    Object.assign(e.art.reaction, reaction())
    Object.assign(e.art, { age: 0, walkAge: 0, blockUntil: 0, popAt: 0, deflectAt: 0, missAt: 0, statusSlot: 0, shown: false })
  }
  private kick(v: Reaction, at: Point, x: number, y: number, stop: number) {
    v.x = x; v.y = y; v.atX = at.x; v.atY = at.y; v.life = .28; v.stop = this.motion ? stop : 0
  }
  // All travel uses a copy of the incoming direction, never path progress or unit coordinates.
  private hitDirection(e: Enemy, cue?: HitCue) {
    const p = this.impactProjectile
    const dx = p ? p.endX - p.fromX : cue?.from ? e.x - cue.from.x : 0
    const dy = p ? p.endY - p.fromY + Math.PI * (p.arc ?? 30) : cue?.from ? e.y - cue.from.y : 1
    const length = Math.hypot(dx, dy) || 1
    return { x: dx / length, y: dy / length }
  }
  combatPop(name: string, x: number, y: number) {
    const pop = this.effect(`combat/pop/${name}`, x, y, .65, name === 'crit' ? 1.65 : 1.4, 'pop')
    if (pop && this.motion && !this.settings.lite && this.quality.tier < 2) pop.image.setScale(pop.size * .5)
    return pop
  }
  dodgeFeedback(at: Point) {
    this.effect('combat/dodge/0', at.x, at.y - 58, .36, 1.1, 'travel', at.x - (this.motion ? 38 : 0), at.y - 58)
    this.combatPop('miss', at.x, at.y - 142)
    if (!this.impactProjectile) this.sfx('miss', at)
  }
  shieldFeedback(at: Point) {
    this.effect('combat/shield/0', at.x, at.y - 75, .4, 1.9)
    this.effect('combat/block/0', at.x + 35, at.y - 82, .22, .7)
    this.combatPop('block', at.x, at.y - 166)
    if (!this.impactProjectile) this.sfx('block', at)
  }
  private deflectFeedback(e: Enemy, cue?: HitCue) {
    if (this.presentationTime < e.art.deflectAt) return
    e.art.deflectAt = this.presentationTime + .18
    const d = this.hitDirection(e, cue), x = e.x, y = e.y - (e.boss ? 95 : 55)
    this.effect('combat/block/0', x, y, .22, .8)
    const streak = this.effect('combat/ricochet/0', x - d.x * 24, y - d.y * 24, .28, 1)
    if (streak) streak.angle = Math.atan2(-d.y, -d.x) + Math.PI / 4
    this.effect('proj/egg', x, y, .3, .6, 'travel', x - d.x * (this.motion ? 95 : 0), y - d.y * (this.motion ? 95 : 0) - (this.motion ? 35 : 0))
    this.combatPop('tink', x, y - 76)
    if (!this.impactProjectile) this.sfx('armor', e)
  }
  private hitFeedback(e: Enemy, amount: number, type: 'magic' | 'physical' | 'egg', hero: boolean, cue: HitCue | undefined, deflected: boolean) {
    const p = this.impactProjectile, v = e.art.reaction, d = this.hitDirection(e, cue)
    const weight = Math.min(1, amount / 90), heavy = amount >= 35
    this.kick(v, e, d.x * (5 + weight * 23) * (e.boss ? .5 : 1), d.y * (5 + weight * 23) * (e.boss ? .5 : 1), heavy ? .03 + weight * .02 : 0)
    v.flash = .095
    e.art.body.setTintFill(0xffffff); e.art.face.setTintFill(0xffffff); e.art.hitTint = true
    e.boss?.rig?.flash()
    if (e.boss?.sprite) e.boss.sprite.setTintFill(0xffffff)
    if (!deflected) {
      const kind = cue?.kind ?? (type === 'magic' ? 'magic' : type === 'egg' ? 'egg' : p?.kind === 'tp' ? 'tp' : hero ? 'hero' : 'seed')
      const hit = this.effect(`combat/impact-${kind}/0`, e.x, e.y - (e.boss ? 100 : 55), .26, .7 + weight * .65)
      if (hit && kind !== 'tp') hit.angle = Math.atan2(d.y, d.x)
      // A projectile's sound plays once when it lands (updateProjectiles); melee, beams and blasts sound here, one per frame.
      if (p) this.impactKind = kind; else this.sfx(`impact-${kind}`, e)
      // A heavy blow (90+, where the kick and flash max out: catapult, crits, blasts, ultimates) lands with a body thump.
      if (amount >= 90) this.sfx('hurt', e)
    }
    if (cue?.crit) { this.combatPop('crit', e.x, e.y - (e.boss ? 210 : 140)); this.effect('combat/crit/0', e.x, e.y - (e.boss ? 125 : 72), .38, 1.5); this.sfx('crit', e) }
    // Multiple pellets / splash recipients share a beat, never repeatedly extend it.
    if ((cue?.crit || e.boss) && this.motion && this.settings.shake && this.presentationTime >= this.nextHitPause) {
      this.hitPause = cue?.crit ? .05 : .035; this.nextHitPause = this.presentationTime + .24
      this.shake(.0015 + weight * .0035 + (cue?.crit ? .001 : 0))
    }
  }
  private towerShot(t: Tower, target: Enemy) {
    const dx = target.x - t.x, dy = target.y - 45 - (t.y - 125), length = Math.hypot(dx, dy) || 1
    t.shotAt = this.presentationTime; t.aimX = dx / length; t.aimY = dy / length
    if (t.kind === 'egg' || t.kind === 'tp' || t.kind === 'lantern') {
      const muzzle = this.effect(`combat/muzzle-${t.kind}/0`, t.x + t.aimX * 24, t.y - 125 + t.aimY * 24, .18, .85)
      if (muzzle) { muzzle.angle = Math.atan2(dy, dx); muzzle.delay = this.motion ? .035 : 0; muzzle.image.setVisible(!muzzle.delay) }
    }
  }
  private stealFeedback(e: Enemy) {
    const route = this.routeFor(e), before = route.points[Math.max(0, route.points.length - 6)]
    const dx = before.x - e.x, dy = before.y - e.y, length = Math.hypot(dx, dy) || 1
    const runX = this.motion ? dx / length * 145 : 0, runY = this.motion ? dy / length * 145 : 0
    const b = e.boss
    if (b?.holder) {
      b.rig?.play('walk')
      if (b.rig) b.rig.facing = runX < 0 ? -1 : 1
      if (b.sprite) b.sprite.setFlipX(runX < 0)
      this.corpses.push({ holder: b.holder, rig: b.rig, life: .75, atlas: this.bossOwned.has(b.atlas) ? b.atlas : '', flee: { x: e.x, y: e.y, dx: runX, dy: runY } }); b.holder = null
    } else {
      const body = this.effect(`enemy/${e.kind}/walk/0`, e.x, e.y - 50, .75, 1, 'steal', e.x + runX, e.y - 50 + runY)
      if (body) { body.flip = runX < 0; body.image.setFlipX(body.flip) }
      const a = this.art.anchor(e.kind), ref = this.heads.window(e.id, runX < 0)
      const x = e.x + (a.x - 64) * (runX < 0 ? -1 : 1), y = e.y - 50 + a.y - 64
      this.effect(`${ref.key}:${ref.frame}`, x, y, .75, a.r * 2 / e.art.face.width, 'steal', x + runX, y + runY)
    }
    this.effect('combat/impact-hero/0', e.x + 24, e.y - 60, .23, .6)
    this.sfx('flee', e, 1, 1, .2) // as it starts to run
    const lost = Math.min(this.jars, e.jars)
    if (lost > 0) {
      haptic('jar')
      this.hud.porchAlarm(lost, e)
      const porch = this.options.assets.geometry.porch
      this.effect('teach/porch-flash', porch.x, porch.y - 90, .35, 3.6)
    }
  }
  damage(e: Enemy, amount: number, type: 'magic' | 'physical' | 'egg', feedback = true, hero: boolean | Hero = false, cue?: HitCue): boolean {
    if (!e.active || e.returning) return false
    if (feedback && e.mods.includes('smoke') && this.random() < .2) { if (this.impactProjectile) this.impactSound ??= 'miss'; if (this.presentationTime >= e.art.missAt) { this.dodgeFeedback(e); e.art.reaction.dodge = .22; e.art.missAt = this.presentationTime + .25 }; return false }
    const deflected = type === 'egg' && (e.kind === 'pumpkin' || e.armour)
    if (type !== 'magic') { if (e.kind === 'pumpkin' && type === 'egg') amount *= .2; if (e.armour) amount *= .65 }
    if (e.status.mark > 0) amount *= 1.5
    if (this.crewHas(4) && ENEMIES[e.kind].flying) amount *= 1.25
    // Testudo and the Pumpkin's split absorb the hit; Sanctuary's shield turns it aside.
    if (e.boss && bossAbsorbs(this, e, feedback)) { if (this.impactProjectile && this.impactSound !== 'splat') this.impactSound = type === 'egg' ? 'armor' : 'block'; if (feedback) { if (type === 'egg') this.deflectFeedback(e, cue); else this.shieldFeedback(e) }; return false }
    if (e.shield > 0) { if (this.impactProjectile && this.impactSound !== 'splat') this.impactSound = 'block'; if (feedback && this.presentationTime >= e.art.deflectAt) { this.shieldFeedback(e); e.art.deflectAt = this.presentationTime + .3 }; return false }
    if (hero) { const owner = hero === true ? this.hero : hero; owner.dealt += Math.min(e.hp, amount); owner.addCharge(Math.min(e.hp, amount) * .022) }
    e.hp -= amount
    if (this.impactProjectile && feedback) { if (!deflected) this.impactSound = 'splat'; else if (this.impactSound !== 'splat') this.impactSound = 'armor' }
    if (feedback) {
      e.hit = .16
      if (!e.mods.includes('slippery') && !e.boss) e.distance = Math.max(0, e.distance - Math.min(9, amount * .13))
      if (deflected) {
        this.deflectFeedback(e, cue)
        this.hud.ruleMoment('armour', e, 'mod/metal', 'ARMOURED · eggs bounce, use magic')
      }
      this.hitFeedback(e, amount, type, !!hero, cue, deflected)
      this.number(Math.ceil(amount), e.x, e.y - (e.boss ? 210 : 120), cue?.crit ? 0xffd15a : type === 'magic' ? 0xd3b0ff : 0xfff1c6, cue?.crit)
      if (amount >= e.maxHp * .4 && !e.boss) this.signature(e, e.hp <= 0)
    }
    if (e.hp <= 0) {
      if (e.boss && bossRevives(this, e)) return true
      if (e.mods.includes('lucky') && !e.lucky) { e.lucky = true; e.hp = 1; this.effect('fx/levelup/0', e.x, e.y - 50, .5); this.sfx('enemy-lucky', e); return true }
      if (e.mods.includes('skull') && !e.revived) { e.revived = true; e.hp = e.maxHp * .4; this.status(e, 'stun', .7); this.effect('fx/poof/0', e.x, e.y - 50, .6); this.sfx('enemy-revive', e); return true }
      if (this.wallets) {
        // Co-op: each player earns half, with their own Chog's perks and their own holder bonus. Pops show your share.
        const half = e.candy * this.killCandyScale(e.wave) / 2
        this.kills++
        const gains = this.heroes.map((hero, player) => this.earn(player as Player, hero.killIncome(half, true) * (hero.selection.street.chog ? 1.1 : 1) * this.candyScale))
        this.rewardFeedback(gains[this.localPlayer], e)
      } else {
        const candyBefore = this.candy
        this.kills++; this.income(Math.max(...this.heroes.map(hero => hero.killIncome(e.candy * this.killCandyScale(e.wave)))) * (this.options.street.chog ? 1.1 : 1))
        this.rewardFeedback(this.candy - candyBefore, e)
      }
      this.heroes.forEach(hero => hero.onKill(e))
      this.killsByKind[e.kind] = (this.killsByKind[e.kind] ?? 0) + 1
      // The last few fallen ground enemies can be raised again (Brainz).
      if (!e.boss && !e.route && e.path >= 0) { this.fallen.push({ kind: e.kind, path: e.path }); if (this.fallen.length > 8) this.fallen.shift() }
      if (e.boss) bossDeath(this, e)
      else {
        this.effect(`enemy/${e.kind}/die/0`, e.x, e.y - 50, .3, .9)
        this.exitPortrait(e, 'die', .1, .9)
        this.effect('fx/candy-burst/0', e.x, e.y - 50, .5, .8); this.sfx(`die-${e.kind}`, e)
        if (e.kind === 'skeleton') this.effect('fx/bones/0', e.x, e.y - 35, .7)
        if (e.kind === 'mummy') {
          this.effect('fx/split/0', e.x, e.y - 45, .7)
          for (let i = 0; i < 2; i++) this.schedule.push({ kind: 'mini', path: 0, route: e.path, wave: e.wave, time: this.clock + .05 + i * .18, distance: Math.max(0, e.distance - i * 18) })
          this.schedule.sort((a, b) => a.time - b.time)
        }
      }
      this.removeEnemy(e)
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
    const flicker = 1 + sine(this.clock * 5) * .02
    for (const light of this.options.assets.geometry.lights ?? []) this.light(light.x, light.y, light.r * flicker)
    for (const t of this.towers) if (t?.kind === 'lantern') this.light(t.x, t.y - 60, towerStats(t).range)
    for (const e of this.enemies) if (e.active && e.status.reveal > 0) this.light(e.x, e.y - 45, 85)
    for (const hero of this.heroes) this.light(hero.x, hero.y - 40, 210)
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
    const applied = e.status[status] <= 0 && duration > 0
    e.status[status] = Math.max(e.status[status], duration)
    if (applied && STATUS_POP[status]) {
      const x = e.x + (e.art.statusSlot++ % 3 - 1) * 42, y = e.y - (e.boss ? 190 : 132)
      const ring = this.effect('combat/ring/0', x, y, .5, .62)
      ring?.image.setTint(STATUS_POP[status]!)
      this.effect(`status/${status === 'stun' ? 'freeze' : status}/0`, x, y, .6, .48, 'emote')
    }
    if (status === 'charm') this.combo('charm', e)
  }
  // Shared income: solo's one pot, or co-op halves, each paid to its player. Returns what the local player received.
  income(amount: number) {
    if (!this.wallets) { const gain = Math.round(amount * this.candyScale); this.candy += gain; return gain }
    const gains = [this.earn(0, amount * this.candyScale / 2), this.earn(1, amount * this.candyScale / 2)]
    return gains[this.localPlayer]
  }
  // Whole candy now and the fraction carried to that player's next payout, so the split neither loses nor makes candy.
  private earn(player: Player, amount: number) {
    const total = this.candyCarry![player] + amount, whole = Math.floor(total)
    this.candyCarry![player] = total - whole; this.wallets![player] += whole
    return whole
  }
  // Candy a player can spend: their own in co-op, the one pot in solo. A purchase they cannot afford changes nothing.
  purse(player: Player) { return this.wallets ? this.wallets[player] : this.candy }
  get localCandy() { return this.purse(this.localPlayer) }
  get partnerCandy() { return this.wallets ? this.wallets[this.localPlayer ? 0 : 1] : 0 }
  private spend(player: Player, cost: number) {
    if (this.purse(player) < cost) return false
    if (this.wallets) this.wallets[player] -= cost; else this.candy -= cost
    return true
  }
  // Co-op: a tower takes changes only from the player who built it.
  private owns(player: Player, tower: Tower) {
    if (!this.options.coop || tower.owner === player) return true
    if (this.mine(player)) this.hud.toast("That's your partner's tower", 2)
    return false
  }
  private build(kind: TowerKind, padIndex: number, player: Player = 0) {
    const hero = this.heroes[player], mine = this.mine(player), built = this.towers[padIndex]
    if (this.paused || this.ended || padIndex < 0) return
    // Both players can tap one pad before either tower appears: the first command builds, the later one is refused for free.
    if (built) { if (mine && this.options.coop && built.owner !== player) this.hud.toast('Your partner is building here'); return }
    if (this.tutorialStep === 0 && (kind !== 'egg' || padIndex !== 0)) { this.hud.toast('Start with an Egg Stand on the glowing pad.'); return }
    const locked = towerLock(kind, hero.selection.stars, hero.selection.owned)
    if (locked) { if (mine) this.hud.toast(locked); return }
    const cost = TOWERS[kind].levels[0].cost
    if (!this.spend(player, cost)) { if (mine) this.hud.toast('A little more candy first!'); return }
    const pad = this.options.assets.geometry.pads[padIndex]
    const tower: Tower = { ...pad, kind, level: 1, spec: null, rank: 0, spent: cost, targeting: 'first', cooldown: 0, stun: 0, image: this.art.image(pad.x, pad.y - 90, this.towerFrame(kind, 1)).setDepth(pad.y).setDisplaySize(144, 180), guards: [], pop: .4, boost: !!pad.boost, gold: 0 }
    this.discover([`tower/${kind}`]); this.towers[padIndex] = tower
    if (this.options.coop) tower.owner = player
    if (kind === 'patch') this.guardsFor(tower)
    this.effect('fx/poof/0', pad.x, pad.y - 60, .6, 1.4); this.sfx('build', pad); this.tutorial('build'); this.settle(player); if (mine) this.hud.toast(`${TOWERS[kind].name} built`); this.hud.refresh()
  }
  private upgrade(padIndex: number, player: Player = 0) {
    const tower = this.towers[padIndex]
    if (this.paused || this.ended || !tower || tower.level >= 3 && (!tower.spec || tower.rank >= 2) || !this.owns(player, tower)) return
    const cost = tower.spec ? rankCost(tower.rank) : TOWERS[tower.kind].levels[tower.level].cost
    if (!this.spend(player, cost)) { if (this.mine(player)) this.hud.toast('A little more candy first!'); return }
    tower.spent += cost; if (tower.spec) tower.rank++; else tower.level++; tower.pop = .4
    this.art.set(tower.image, this.towerFrame(tower.kind, tower.level, tower.spec))
    if (tower.kind === 'patch') this.guardsFor(tower)
    this.effect('fx/levelup/0', tower.x, tower.y - 70, .8, 1.5); this.sfx('upgrade', tower); this.settle(player); if (this.mine(player)) this.hud.toast(tower.spec ? `${SPECIALISATIONS[tower.spec].name} · Rank ${tower.rank}` : `${TOWERS[tower.kind].name} · Level ${tower.level}`); this.hud.refresh()
  }
  private sell(padIndex: number, player: Player = 0) {
    const tower = this.towers[padIndex]
    if (this.paused || this.ended || !tower || !this.owns(player, tower)) return
    if (this.wallets) this.wallets[player] += Math.floor(tower.spent * .7); else this.candy += Math.floor(tower.spent * .7)
    tower.image.destroy(); for (const guard of tower.guards) guard.image.destroy(); this.towers[padIndex] = null
    this.sfx('sell', tower); this.settle(player); if (this.mine(player)) this.hud.toast(`Tower sold · +${Math.floor(tower.spent * .7)} candy`); this.hud.refresh()
  }
  private guardsFor(tower: Tower) {
    const config = towerStats(tower), near = this.nearestPath(tower.x, tower.y)
    while (tower.guards.length < config.guards) {
      const i = tower.guards.length, x = near.x + (i - 1) * 43, y = near.y + (i % 2 ? 20 : -8)
      tower.guards.push({ x, y, hp: 100, maxHp: 100, respawn: 8, cooldown: 0, slow: 0, image: this.art.image(x, y - 35, 'guard/knight/walk/0').setDisplaySize(75, 75) })
    }
    for (const guard of tower.guards) { guard.maxHp = (75 + tower.level * 35 + tower.rank * 40) * (tower.spec === 'knights' ? 2 : 1) * (this.crewHas(3) ? 1.25 : 1); guard.hp = guard.maxHp }
  }
  selectSpell(kind: SpellKind) {
    if (this.paused || this.ended || this.spellCooldown[kind] > 0) return
    this.cancel(); this.mode = kind; this.hud.toast(`${SPELLS[kind].name} · Tap a spot on the path`)
  }
  selectTrap(kind: TrapKind, point?: Point) {
    if (this.paused || this.ended) return
    if (this.stock[kind] <= 0) { this.hud.toast(`No ${TRAPS[kind].name}s left this level.`); return }
    this.cancel(); this.mode = kind; this.dragStart = point ?? null; this.hud.toast(`${TRAPS[kind].name} · Drag onto the path\n${this.stock[kind]} left this level`)
  }
  selectConsumable(kind: ConsumableKind, point?: Point) {
    if (this.paused || this.ended || this.itemCooldown[kind] > 0 || this.stock[kind] <= 0) return
    this.cancel(); this.mode = kind; this.dragStart = point ?? null
    this.hud.toast(`${CONSUMABLES[kind].name} · ${CONSUMABLES[kind].description}\nDrag or tap the road · ${this.stock[kind]} left this level`)
  }
  private cast(kind: SpellKind, x: number, y: number, hero = this.hero, player: Player = 0) {
    if (this.spellCooldown[kind] > 0) return
    const spell = SPELLS[kind]
    this.spellCooldown[kind] = spell.cooldown * hero.spellFactor
    for (const e of this.enemies) if (e.active && distanceSq({ x, y }, e) <= spell.radius * spell.radius) {
      if (kind === 'rain') this.damage(e, spell.damage, 'magic')
      else this.status(e, 'fear', 2)
    }
    this.effect(kind === 'rain' ? 'fx/candy-rain/0' : 'fx/boo/0', x, y - 30, 1, spell.radius / 45)
    this.sfx(kind === 'rain' ? 'spell-rain' : 'spell-boo', { x, y })
    if (kind === 'rain') { this.shake(.005); for (let i = 0; i < (this.settings.lite ? 6 : 12); i++) this.effect('fx/coin', x + (this.visualRandom() - .5) * 280, y - 200, .5 + this.visualRandom() * .4, .25, 'jar', x + (this.visualRandom() - .5) * 220, y + 40) }
    this.settle(player); this.hud.refresh()
  }
  private placeTrap(kind: TrapKind, x: number, y: number, player: Player = 0) {
    const spot = this.nearestPath(x, y), config = TRAPS[kind], mine = this.mine(player)
    if (spot.gap > 65 || x < 50 || x > 1820 || y < 150 || y > 915) { if (mine) this.hud.toast('Place it on the path. One is used only when placed.'); return }
    if (this.stock[kind] <= 0) { if (mine) this.hud.toast(`No ${config.name}s left this level.`); this.settle(player); return }
    if (this.traps.length >= LIMITS.traps) { if (mine) this.hud.toast('The path is full of surprises already.'); return }
    this.stock[kind]--
    this.traps.push({ x: spot.x, y: spot.y, kind, life: config.duration, armed: false, ...this.options.coop ? { owner: player } : {}, image: this.art.image(spot.x, spot.y, `trap/${kind}/0`).setDepth(7).setDisplaySize(100, 75) })
    this.effect('fx/poof/0', spot.x, spot.y, .4); this.sfx('trap-set', spot); this.settle(player); this.hud.refresh()
  }
  private updateTraps(dt: number) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i], config = TRAPS[trap.kind]
      let triggered = false
      for (const e of this.enemies) if (e.active && distanceSq(e, trap) < config.radius * config.radius) {
        if (ENEMIES[e.kind].flying) { this.hud.ruleMoment('flying', e, 'enemy/bat/walk/0', "FLYING · traps can't reach"); continue }
        if (trap.kind === 'bowl' && e.mods.includes('visor')) continue
        triggered = true
        this.status(e, config.status, trap.kind === 'pumpkin' ? config.duration : .18)
        if (trap.kind === 'bowl') { e.status.fear = 0; if (e.status.burn > 0) { e.status.burn = 0; this.status(e, 'stun', 3); this.effect('fx/caramel/0', e.x, e.y, .9, 1.2); this.combo('caramel', e) } }
      }
      if (triggered && !trap.armed) { trap.armed = true; this.effect(trap.kind === 'pumpkin' ? 'fx/stun/0' : 'fx/splat/0', trap.x, trap.y, .5, 1.5); this.sfx(`trap-${trap.kind}`, trap); if (trap.kind === 'pumpkin') trap.life = 0 }
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
    if (distanceSq(pointer, this.localHero) < 70 ** 2) { this.holdAt = { x: pointer.x, y: pointer.y }; this.holdTime = 0; this.selectHero(); this.hud.toast(`Chog #${this.localHero.kit.id} · ${this.abilityName()}\nTap ground to move · Hold to emote`); return }
    for (let i = 0; i < this.pads.length; i++) if (this.towers[i] ? Math.abs(pointer.x - this.pads[i].x) < 82 && pointer.y >= this.pads[i].y - 190 && pointer.y <= this.pads[i].y + 35 : distanceSq(pointer, this.pads[i]) < 82 ** 2) {
      if (this.tutorialStep === 0 && i !== 0) { this.hud.toast('The glowing pad first!'); return }
      const queued = this.pendingAt(i), tower = this.towers[i]
      if (tower && this.options.coop && tower.owner !== this.localPlayer) { this.cancel(); this.hud.toast(`Your partner's ${TOWERS[tower.kind].name} · Level ${tower.level}${tower.spec ? ` · ${SPECIALISATIONS[tower.spec].name}` : ''}`, 2); return }
      if (queued) { this.cancel(); this.hud.toast(queued.player !== this.localPlayer ? this.towers[i] ? 'Your partner is changing this tower' : 'Your partner is building here' : 'On its way…', 2); return }
      this.cancel(); this.selected = i; this.hud.radial(); return
    }
    for (const enemy of this.enemies) if (enemy.active && (distanceSq(pointer, { x: enemy.x, y: enemy.y - 70 }) < 70 ** 2 || (Math.abs(pointer.x - enemy.x) < 45 && Math.abs(pointer.y - enemy.y + 150) < 25))) {
      const mods = enemy.mods.map(name => `${name}: ${MODIFIERS.find(m => m.name === name)?.enemy}`).join(' · ')
      this.hud.toast(`${ENEMIES[enemy.kind].name} #${enemy.id}${mods ? ` · ${mods}` : ''}`, 7); return
    }
  }
  selectHero() {
    if (this.paused || this.ended || this.localHero.hp <= 0) return
    this.cancel(); this.heroSelected = true; this.hud.toast(`Your Chog · Tap the ground to move${this.localHero.labels ? `\n${this.localHero.labels}` : ''}`)
  }
  private moveHero(pointer: Point, hero = this.localHero) {
    if (hero.hp <= 0) return
    if (!this.options.coop) this.cancel()
    hero.rig.cancelDance()
    hero.target = { x: Phaser.Math.Clamp(pointer.x, 60, 1850), y: Phaser.Math.Clamp(pointer.y, 180, 885) }
    if (!this.options.coop) { this.effect('hero/ring', pointer.x, pointer.y, .55, .8); this.sfx('move', pointer) }
    else if (hero !== this.localHero) this.effect('hero/ring', pointer.x, pointer.y, .55, .8)?.image.setTint(PARTNER)
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
  cancel() { this.hud?.releasePresses(); this.buildPage = 0; this.mode = null; this.selected = -1; this.previewTower = null; this.previewSpec = null; this.heroSelected = false; this.dragStart = null; this.emoteOpen = false; this.preview?.setVisible(false); this.hud?.radial(); this.hud?.emotes(); this.hud?.closePreview(); this.hud?.closeSupplies() }
  toggleEmotes() { if (this.paused || this.ended) return; const open = !this.emoteOpen; this.cancel(); this.emoteOpen = open; this.hud.radial(); this.hud.emotes() }
  private chooseEmote(name: string, hero = this.localHero) {
    if (hero.hp <= 0) return
    const dance = name === 'signature' ? hero.kit.emote : name
    if (!canDance(dance, hero.kit.emote, hero.selection.owned, this.options.assets.dances) && !(hero.selection.owned.includes(22) && CRYPTO_EMOTES.includes(name))) return
    hero.target = { x: hero.x, y: hero.y }
    if (name === 'signature') this.signature(undefined, false, hero)
    else { hero.rig.dance(dance); this.emote(this.options.assets.dances[dance]?.emote ?? (CRYPTO_EMOTES.includes(name) ? name : 'gg'), hero.x, hero.y - 150) }
    if (name !== 'signature') this.options.sfx.emote(dance, false, this.pan(hero))
    if (!this.options.coop) { this.emoteOpen = false; this.hud.emotes() }
  }
  emote(name: string, x: number, y: number) { this.effect(`emote/${name}/0`, x, y, 1.7, 1, 'emote') }
  private tutorial(action: TutorialAction) {
    if (TUTORIAL[this.tutorialStep]?.action !== action) return
    this.tutorialStep++
    this.focus.acted()
    if (this.tutorialStep === TUTORIAL.length) { this.options.onTutorial(); this.hud.toast('You’re ready. Keep those jars safe!'); this.emote('gg', this.hero.x, this.hero.y - 150) }
    this.hud.refresh()
  }
  // A skip also ends the run's tips (TIPS): the player said they know the ropes.
  skipTutorial() { this.tutorialStep = TUTORIAL.length; this.options.tutorial = false; this.cancel(); this.options.onTutorial(); this.hud.refresh(); this.focus.draw() }
  pauseGame() { if (!this.ended) { this.setPaused(true); this.options.onPause() } }
  setPaused(paused: boolean) { if (this.options.coop) return; if (this.restoring && !paused) return; if (paused) this.hud?.releasePresses(); this.paused = paused; this.tweens.timeScale = paused ? 0 : 1; this.holdAt = null; this.dragStart = null; this.options.sfx.pause(paused) }
  towerFrame(kind: TowerKind, level: number, spec: Specialisation | null = null) { if (spec) return `tower/${kind}/${spec}`; return `${this.settings.gold && this.options.owned.includes(21) && ['egg', 'tp', 'lantern', 'patch'].includes(kind) ? 'skin/gold/' : ''}tower/${kind}/${level}` }
  applySettings(settings: Settings) {
    this.settings = settings
    if (!settings.lite && !this.ambience.length && this.ready) this.createAmbience()
    for (const a of this.ambience) a.image.setVisible(!settings.lite && this.quality.tier === 0); this.options.sfx.apply(settings); this.motion = !reducedMotion()
    for (const tower of this.towers) if (tower) this.art.set(tower.image, this.towerFrame(tower.kind, tower.level, tower.spec))
  }
  private finish(won: boolean) {
    if (this.ended) return
    this.cancel(); this.ended = true; this.hud.hide(); this.focus.draw()
    const mode = this.options.mode, daily = this.options.daily
    const result = { level: this.options.level, mode, daily: mode === 'daily' && daily ? daily.number : 0, theme: mode === 'daily' && daily ? daily.theme : 0, won, jars: this.jars, stars: won && !this.level.gauntlet ? starsFor(this.jars) : 0, kills: this.kills, wave: this.wave, legends: this.level.gauntlet ? this.bossesDefeated.length : 0, heroLevel: this.hero.level, earlyCalls: this.earlyCalls, seconds: this.clock, date: new Date().toISOString() }
    this.options.sfx.play(won ? 'victory' : 'defeat')
    if (won) this.closeUp()
    if (this.options.coop) {
      this.coopResult = { ...result, score: this.level.gauntlet ? gauntletScore(result.legends, result.jars) : scoreFor(result), party: this.heroes.map(hero => ({ id: hero.kit.id, level: hero.level })) }
      this.coopFinishAt = Math.ceil(((this.net?.tick ?? 0) + 1) / HASH_EVERY) * HASH_EVERY
      return // The result is released only after the final matching checkpoint; the Chogs dance then (update).
    }
    this.celebrate(won)
    this.time.delayedCall(reducedMotion() || !won ? 0 : 1200, () => this.options.onEnd({ ...result, score: mode === 'endless' ? endlessScore(this.rewarded.size, this.kills) : this.level.gauntlet ? gauntletScore(result.legends, result.jars) : scoreFor(result) }))
  }
  // Every Chog dances its victory dance, or faints. Rig clips and times are checkpoint state, so co-op starts this only after the final checkpoint matched.
  private celebrate(won: boolean) {
    this.celebrating = true
    for (const hero of this.heroes) {
      const dance = hero.selection.victoryDance
      hero.rig.cancelDance(); hero.rig.play(won ? (this.options.assets.dances[dance]?.clip ?? 'dance-gg') : 'faint')
      if (won && dance === hero.kit.emote) hero.rig.emote()
    }
    if (won) this.options.sfx.emote(this.localSelection.victoryDance)
  }
  // The victory close-up and star rain: camera, textures and sprites only, so co-op can run it before the final checkpoint.
  // With the double-size parts the zoom can go from 2× to 3.4× and stay sharp; two Chogs zoom out until both fit. The pan offset keeps them left of the result panel.
  private closeUp() {
    const xs = this.heroes.map(hero => hero.x), ys = this.heroes.map(hero => hero.y), left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys)
    const x = (left + right) / 2, y = (top + bottom) / 2, sharp = this.heroes.map(hero => hero.rig.sharpen()).every(Boolean)
    const camera = this.cameras.main, zoom = Phaser.Math.Clamp(Math.min(620 / (right - left + 100), 1080 / (bottom - top + 318)), 1.4, sharp ? 3.4 : 2), duration = reducedMotion() ? 0 : 950
    if (sharp) this.heroes.forEach((hero, i) => void this.sharpPortrait(hero, `hero-hd-${i}`))
    camera.zoomTo(zoom * this.renderScale, duration, 'Sine.easeInOut'); camera.pan(x + 235 * 2 / zoom, y - 110 * 2 / zoom, duration, 'Sine.easeInOut')
    for (let i = 0; i < (this.settings.lite ? 24 : 48); i++) {
      const star = this.art.image(x + (this.visualRandom() - .5) * (560 + right - left), top - 500 - this.visualRandom() * 140, 'ui/star-full').setDepth(2900).setScale(.16 + this.visualRandom() * .15).setTint([0xffd477, 0xfb8cac, 0xb2eccb][i % 3])
      this.tweens.add({ targets: star, y: bottom + 60, x: star.x + (this.visualRandom() - .5) * 80, angle: reducedMotion() ? 0 : 180, alpha: 0, duration: reducedMotion() ? 0 : 1800 + this.visualRandom() * 1500, onComplete: () => star.destroy() })
    }
  }
  // The in-game portraits are 64px tiles; the close-up redraws the hero's face from the 256px original.
  private async sharpPortrait(hero: Hero, key: string) {
    try {
      const image = await loadImage(thumb(hero.kit.id, true))
      if (this.gone) return
      const texture = this.textures.exists(key) ? this.textures.get(key) as Phaser.Textures.CanvasTexture : this.textures.createCanvas(key, 256, 256)!, ctx = texture.context
      ctx.clearRect(0, 0, 256, 256); ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 256 * 61 / 128, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(image, 0, 0, 256, 256); ctx.restore(); texture.refresh()
      hero.rig.setPortrait(key)
    } catch { /* The 64px face stays if the portrait cannot be fetched. */ }
  }
  // Presentation only: a cue panned slightly toward the side of the screen where it happens.
  pan(at: Point) { return Phaser.Math.Clamp(this.worldToView(at).x / this.view.width - .5, -.5, .5) * .7 }
  sfx(cue: Cue, at?: Point, rate = 1, volume = 1, delay = 0) { this.options.sfx.play(cue, rate, volume, undefined, delay, at ? this.pan(at) : 0) }
  shake(intensity: number) { if (this.settings.shake && this.motion && !reducedMotion()) this.cameras.main.shake(110, intensity) }
  private addBeam(from: Point, to: Point, color: number) { if (this.beam.length < 12) this.beam.push({ from: { x: from.x, y: from.y - 50 }, to: { x: to.x, y: to.y - 30 }, life: .35, color }) }
  private rewardFeedback(value: number, at: Point) {
    if (value <= 0) return
    const now = this.presentationTime
    if (now - this.rewardAt >= .25) { this.rewardValue = 0; this.rewardAt = now; this.rewardPoint = { x: at.x, y: at.y - 145 } }
    this.rewardValue += value
    this.rewardText.setText(`+${this.rewardValue}`).setPosition(this.rewardPoint.x, this.rewardPoint.y).setAlpha(1).setVisible(true)
    this.effect('fx/coin', at.x, at.y - 60, .65, .6, 'coin')
  }
  effect(name: string, x: number, y: number, duration: number, size = 1, mode: Effect['mode'] = 'burst', toX = x, toY = y) {
    // All reward coins (including rain and legends) fly in HUD coordinates.
    const reward = name === 'fx/coin' && (mode === 'coin' || mode === 'jar')
    if (reward) {
      this.candyFlights = this.candyFlights.filter(at => this.presentationTime - at < .25)
      if (this.candyFlights.length >= 3 || this.effects.filter(e => e.active && e.mode === 'coin').length >= 3) return
      this.candyFlights.push(this.presentationTime)
      if (reducedMotion()) { this.hud.candyArrived(); return }
      const from = this.worldToView({ x, y }), to = this.hud.candyTargetPosition()
      x = from.x; y = from.y; toX = to.x; toY = to.y; mode = 'coin'
    }
    const limit = this.settings.lite || this.quality.tier >= 2 ? LIMITS.effects / 2 : LIMITS.effects
    let effect: Effect | undefined
    for (let i = 0; i < limit; i++) if (!this.effects[i].active) { effect = this.effects[i]; break }
    if (!effect) return
    const layer = reward ? this.hudLayer : this.worldLayer
    if (effect.image.displayList !== layer) { layer.add(effect.image); effect.image.setDepth(reward ? 3100 : 2200) }
    Object.assign(effect, { active: true, life: 0, duration, x, y, toX, toY, size, name, mode, count: this.art.count(name), angle: 0, width: undefined, height: undefined, simulationStart: undefined, delay: 0, flip: false })
    this.art.set(effect.image, name); effect.image.setVisible(true).setAlpha(1).setScale(size).setPosition(x, y).setRotation(0).setFlipX(false).clearTint()
    return effect
  }
  number(value: number, x: number, y: number, color: number, critical = false) {
    let number: DamageNumber | undefined
    for (let i = 0; i < (this.settings.lite || this.quality.tier >= 2 ? LIMITS.numbers / 2 : LIMITS.numbers); i++) if (!this.numbers[i].active) { number = this.numbers[i]; break }
    if (!number) return
    Object.assign(number, { active: true, life: 0, x: x + this.visualRandom() * 20 - 10, y }); number.text.setText(critical ? `${value}!` : String(value)).setFontSize(critical ? 50 : 34).setVisible(true).setTint(color).setAlpha(1).setPosition(x, y)
  }
  private updateEffects(dt: number) {
    if (this.presentationFrozen) return
    const rewardAge = this.presentationTime - this.rewardAt
    this.rewardText.setVisible(rewardAge < .8).setAlpha(Math.max(0, 1 - rewardAge / .8)).setPosition(this.rewardPoint.x, this.rewardPoint.y - (reducedMotion() ? 0 : Math.min(1, rewardAge / .4) * 30))
    for (const e of this.effects) if (e.active) {
      // An effect drawn from a dropped boss atlas ends with it.
      const split = e.name.indexOf(':')
      if (split > 0 && !this.textures.exists(e.name.slice(0, split))) { e.active = false; e.image.setVisible(false); continue }
      if (e.delay > 0) { e.delay -= dt; if (e.delay > 0) continue; e.image.setVisible(true) }
      e.life = e.simulationStart === undefined ? e.life + dt : this.clock - e.simulationStart; const t = Math.min(1, e.life / e.duration)
      if (e.mode === 'coin' || e.mode === 'jar') { const ease = t * t; e.image.setPosition(Phaser.Math.Linear(e.x, e.toX, ease), Phaser.Math.Linear(e.y, e.toY, ease) - Math.sin(t * Math.PI) * 80).setRotation(t * 4).setAlpha(1 - Math.max(0, t - .8) * 5) }
      else if (e.mode === 'steal') {
        const run = Math.max(0, (t - .27) / .73), grab = run === 0
        const name = grab && e.name === 'enemy/goblin/walk/0' ? `enemy/goblin/grab/${Math.min(3, Math.floor(t / .27 * 4))}` : e.name.replace(/\/\d+$/, `/${Math.floor(run * 12) % e.count}`)
        this.art.set(e.image, name)
        e.image.setPosition(e.x + (e.toX - e.x) * run, e.y + (e.toY - e.y) * run - (this.motion ? Math.sin(run * Math.PI * 6) * 4 : 0)).setScale(e.size * (grab && this.motion ? 1.08 : 1), e.size * (grab && this.motion ? .87 : 1)).setAlpha(1 - Math.max(0, t - .65) / .35)
      } else {
        this.art.set(e.image, e.name.replace(/\/\d+$/, `/${Math.min(e.count - 1, Math.floor(t * e.count))}`))
        const bounce = this.motion ? e.mode === 'emote' ? Phaser.Math.Easing.Back.Out(Math.min(1, t * 5)) : 1 + Math.sin(t * Math.PI) * .35 : 1
        e.image.setScale(e.size * bounce).setRotation(e.angle).setAlpha(1 - Math.max(0, t - .65) / .35)
      }
      if (e.mode === 'travel') e.image.setPosition(Phaser.Math.Linear(e.x, e.toX, t), Phaser.Math.Linear(e.y, e.toY, t))
      if (e.mode === 'pop') {
        const motion = this.motion && !this.settings.lite && this.quality.tier < 2, punch = Math.min(1, e.life / .15)
        const scale = punch < .6 ? .5 + .75 * punch / .6 : 1.25 - .25 * (punch - .6) / .4
        e.image.setScale(e.size * (motion ? scale : 1)).setPosition(e.x, e.y - (motion ? 56 * Math.min(1, e.life / .3) : 0))
      }
      if (e.width && e.height) e.image.setDisplaySize(e.width, e.height)
      if (t >= 1) { e.active = false; e.image.setVisible(false); if (e.mode === 'coin') this.hud.candyArrived() }
    }
    for (const n of this.numbers) if (n.active) { n.life += dt; n.text.setPosition(n.x, n.y - n.life * 60).setAlpha(1 - n.life / .8); if (n.life >= .8) { n.active = false; n.text.setVisible(false) } }
    for (let i = this.beam.length - 1; i >= 0; i--) { this.beam[i].life -= dt; if (this.beam[i].life <= 0) this.beam.splice(i, 1) }
  }
  private advanceReaction(v: Reaction, dt: number) {
    const held = v.stop > 0 && this.motion
    v.stop = Math.max(0, v.stop - dt)
    if (!held) { v.life = Math.max(0, v.life - dt); v.flash = Math.max(0, v.flash - dt); v.dodge = Math.max(0, v.dodge - dt) }
    return held
  }
  private spring(v: Reaction) { return this.motion && v.life > 0 ? (v.life / .28) ** 2 * Math.cos((.28 - v.life) * 16) : 0 }
  private drawUnits(dt: number) {
    if (this.presentationFrozen) return
    for (const p of this.projectiles) {
      if (!p.active) { if (p.image.visible) p.image.setVisible(false); continue }
      const name = p.frame ?? `proj/${p.kind === 'hero' ? 'seed' : TOWERS[p.kind].projectile}`
      this.art.set(p.image, p.frame && p.frameCount! > 1 ? name.replace(/\/\d+$/, `/${Math.floor(p.life * 12) % p.frameCount!}`) : name)
      if (!p.drawn) { p.drawn = true; if (p.frame) p.image.setScale(1); else p.image.setDisplaySize(p.kind === 'tp' ? 42 : 30, p.kind === 'tp' ? 42 : 30) }
      p.image.setVisible(true).setPosition(p.x, p.y).setRotation(p.kind === 'hero' || p.kind === 'roost' ? Math.atan2(p.endY - p.fromY, p.endX - p.fromX) : Math.min(1, p.life / p.duration) * 5)
    }
    this.paint.begin()
    const idleMotion = this.motion && !this.settings.lite && this.quality.tier < 2
    let marcher: Enemy | undefined, marchers = 0, flyer: Enemy | undefined
    for (const e of this.enemies) if (e.active && !e.returning) {
      const v = e.art.reaction, held = this.advanceReaction(v, dt), spring = this.spring(v)
      const immobilized = e.status.stun > 0 || e.status.freeze > 0 || e.status.root > 0
      if (!held) { e.art.age += dt; if (!immobilized) e.art.walkAge += dt }
      if (!held && !immobilized && !e.boss && e.x > 0 && e.x < 1920 && e.y > 0 && e.y < 1080) { if (ENEMIES[e.kind].flying) flyer = e; else if (e.kind !== 'ghost') { marcher = e; marchers++ } }
      if (e.boss) { drawBoss(this, e); if (e.boss.child) this.bar(e.x, e.y - 190 * e.boss.scale, e.hp / e.maxHp, 0xffc17a, 80); continue }
      const frame = e.casting ? Math.min(3, Math.floor((.7 - e.casting) * 6)) : Math.floor(e.art.walkAge * 9) % 6, bob = idleMotion && (!immobilized || e.kind === 'ghost' || e.kind === 'bat' || e.kind === 'witch') ? Math.sin(e.art.age * (immobilized ? 3 : 14)) * 3 : 0
      const route = this.routeFor(e), point = route.points[Math.min(route.points.length - 1, Math.floor(e.distance / route.length * (route.points.length - 1)) + 1)]
      const flip = (point.x < e.x) !== !!e.status.fear, key = frame + (e.casting ? 10 : e.hit ? 20 : 0), art = e.art
      if (!held && (art.drawFrame !== key || art.faceLeft !== flip)) {
        art.drawFrame = key
        const anchor = this.art.anchor(e.kind, frame, !e.casting && e.hit > 0, e.casting ? 'cast' : 'walk')
        this.art.set(art.body, `enemy/${e.kind}/${e.casting ? `cast/${frame}` : e.hit ? 'hurt' : `walk/${frame}`}`)
        art.face.setPosition((anchor.x - 64) * (flip ? -1 : 1), anchor.y - 114).setDisplaySize(anchor.r * 2, anchor.r * 2)
        art.body.setFlipX(flip)
      }
      if (!held && (art.faceId !== e.id || art.faceLeft !== flip)) {
        const face = this.heads.window(e.id, flip)
        art.face.setTexture(face.key, face.frame); art.faceId = e.id; art.faceLeft = flip
      }
      const emoting = this.motion && e.sigCooldown > 3.2, hop = emoting ? Math.abs(Math.sin((5 - e.sigCooldown) * 9)) : 0
      const spawn = this.motion ? Math.min(1, e.age * 5) : 1, rise = art.risen && this.motion ? Math.min(1, e.age / .7) : 1, squash = this.motion && v.life ? 1 - Math.min(.2, .06 + Math.hypot(v.x, v.y) * .005) * Math.max(0, spring) : emoting ? 1 - .14 * Math.cos((5 - e.sigCooldown) * 18) : 1
      const blocked = this.motion && art.blockUntil > this.presentationTime && !e.status.stun && !e.status.freeze
      const press = blocked ? Math.sin(art.age * 10) * 4 : 0, gap = blocked ? Math.hypot(art.blockX - e.x, art.blockY - e.y) || 1 : 1
      const x = (held ? v.atX : e.x) + v.x * spring + (art.blockX - e.x) / gap * press
      const y = (held ? v.atY : e.y) + v.y * spring + (art.blockY - e.y) / gap * press
      if (e.art.root.depth !== e.y + 20) e.art.root.setDepth(e.y + 20)
      e.art.root.setPosition(x, y + bob - hop * 12).setScale(spawn * (2 - squash), spawn * squash * rise)
      // On a dark map an enemy outside every light vanishes, leaving only two glowing eyes.
      const dim = this.dark && !e.lit && e.status.reveal <= 0 && this.bonfire <= 0
      const alpha = dim ? 0 : e.visible ? v.dodge > 0 && this.motion ? .35 + .45 * Math.abs(Math.sin(v.dodge * 38)) : 1 : .22
      if (art.root.alpha !== alpha) art.root.setAlpha(alpha)
      if (dim) {
        const a = e.kind === 'ghost' ? .5 : .95
        this.paint.image('dot', e.x - 17, e.y - 74, 16, 16, 0xffd060, a * .3)
        this.paint.image('dot', e.x + 1, e.y - 74, 16, 16, 0xffd060, a * .3)
        this.paint.image('dot', e.x - 12.5, e.y - 69.5, 7, 7, 0xfff4b0, a)
        this.paint.image('dot', e.x + 5.5, e.y - 69.5, 7, 7, 0xfff4b0, a)
        continue
      }
      if (art.hitTint !== (v.flash > 0)) { art.hitTint = v.flash > 0; if (art.hitTint) { art.body.setTintFill(0xffffff); art.face.setTintFill(0xffffff) } else if (art.risen) { art.body.setTint(RISEN); art.face.setTint(RISEN) } else { art.body.clearTint(); art.face.clearTint() } }
      let statusName: Status | undefined
      for (const name of DRAW_STATUSES) if (e.status[name] > 0) { statusName = name; break }
      statusName ??= e.status.wrap ? 'root' : e.status.stun ? 'freeze' : undefined
      const statusFrame = Math.floor(art.age * 8) % 4
      if (art.statusName !== statusName || art.statusFrame !== statusFrame) {
        art.statusName = statusName; art.statusFrame = statusFrame; art.statusImage.setVisible(!!statusName)
        if (statusName) this.art.set(art.statusImage, `status/${statusName}/${statusFrame}`)
      }
      this.bar(x, y - 124, e.hp / e.maxHp, e.visible ? 0x92dcb0 : 0xb9a5e1, 64)
      if (e.armour) this.paint.image('armour', e.x - 46, e.y - 17, 92, 34, 0xfbe394, .6)
      if (art.risen) this.paint.image('glow', x - 95, y - 160, 190, 190, 0x6dff98, .5 + (idleMotion ? Math.sin(art.age * 5) * .12 : 0), 0, true)
      // Sanctuary's bubble ripples when it turns a hit aside and pops when it runs out.
      if (e.shield > 0) { const ripple = Math.max(0, art.deflectAt - this.presentationTime) / .3, size = 150 * (1 + (this.motion ? ripple * .22 : 0)); this.paint.image('bubble', x - size / 2, y - 64 - size / 2, size, size, 0xfff6c8, 1) }
      else if (art.shielded) { this.effect('combat/ring/0', x, y - 64, .35, 2.2); this.effect('combat/block/0', x, y - 64, .3, 1.2); this.sfx('bubble-pop', e) }
      art.shielded = e.shield > 0
    }
    // The crowd's feet and wings, sparingly: one quiet step and one flutter at most every third of a second, a little louder for a bigger crowd.
    if (dt > 0 && !this.ended && this.presentationTime >= this.stepAt && (marcher || flyer)) {
      this.stepAt = this.presentationTime + .34
      if (marcher) this.sfx('march', marcher, 1, Math.min(1, .5 + marchers * .05))
      if (flyer) this.sfx('flap', flyer)
    }
    for (const sig of this.signatures) if (sig.enemy) sig.player.root.setPosition(sig.enemy.art.face.x, sig.enemy.art.face.y)
    const dizzy = this.missTime > 0, spin = Math.floor(this.presentationTime * 8) % 4
    // A tower sold while gilded or frozen takes its coat with it.
    for (const [pad, coat] of this.coats.entries()) if (!this.towers[pad] && coat.kind) { coat.kind = ''; coat.image.setVisible(false); coat.shine.setVisible(false) }
    for (const [pad, tower] of this.towers.entries()) if (tower) {
      tower.pop = Math.max(0, tower.pop - dt)
      const [cadence, amplitude] = TOWER_IDLE[tower.kind]
      const bob = idleMotion && !tower.stun ? Math.sin(this.presentationTime * cadence + tower.x) * amplitude : 0, pop = this.motion ? 1 + Math.sin(tower.pop / .4 * Math.PI) * .1 : 1
      const since = this.presentationTime - (tower.shotAt ?? -99), windup = this.motion && !tower.stun && tower.cooldown > 0 && tower.cooldown < .16 ? 1 - tower.cooldown / .16 : 0
      const shot = this.motion && since < .27 ? since < .035 ? -.5 : Math.sin((since - .035) / .235 * Math.PI) : 0
      const squeeze = 1 + windup * .045 - shot * .1
      // The Scream: every tower reels for as long as its shots go wide.
      tower.image.setPosition(tower.x - (tower.aimX ?? 0) * shot * 10, tower.y - 90 + bob - (tower.aimY ?? 0) * shot * 10).setDisplaySize(144 * pop / squeeze, 180 / pop * squeeze).setRotation(dizzy && this.motion ? Math.sin(this.presentationTime * 11 + tower.x) * .07 : 0)
      if (!this.coated.has(tower.image.frame.name)) this.prepareCoats(tower.image.frame.name)
      this.drawCoat(pad, tower)
      if (dizzy) this.mark(CONFUSE[spin], tower.x, tower.y - 200, 2.3)
      for (const guard of tower.guards) if (guard.hp > 0) { this.drawGuard(guard, tower.spec === 'knights' ? 'jack' : 'knight'); this.bar(guard.x, guard.y - 80, guard.hp / guard.maxHp, 0xffc17a, 45) }
    }
    for (const ally of this.allies) this.drawGuard(ally, 'knight')
    for (const [player, hero] of this.heroes.entries()) {
    const held = this.advanceReaction(hero.reaction, dt), spring = this.spring(hero.reaction)
    if (hero.rig.root.depth !== hero.y + 25) hero.rig.root.setDepth(hero.y + 25)
    hero.rig.root.setPosition((held ? hero.reaction.atX : hero.x) + hero.reaction.x * spring, (held ? hero.reaction.atY : hero.y) + hero.reaction.y * spring).setAlpha(hero.hp > 0 ? hero.reaction.dodge > 0 && this.motion ? .35 + .65 * Math.abs(Math.sin(hero.reaction.dodge * 40)) : 1 : .4)
    this.heroRings[player].setPosition(hero.x, hero.y).setAlpha(hero.hp > 0 ? .8 : .2)
    this.heroTags[player]?.setPosition(hero.rig.root.x, hero.rig.root.y - 200).setVisible(!this.ended).setAlpha(hero.hp > 0 ? 1 : .5)
    if (!this.ended) this.bar(hero.x, hero.y - 172, hero.hp / hero.maxHp, 0xffdc7b, 82)
    }
    for (const beam of this.beam) {
      const dx = beam.to.x - beam.from.x, dy = beam.to.y - beam.from.y, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx)
      this.paint.image('white', beam.from.x + Math.sin(angle) * 3.5, beam.from.y - Math.cos(angle) * 3.5, length, 7, beam.color, beam.life / .35, angle)
      this.paint.image('white', beam.from.x + Math.sin(angle), beam.from.y - Math.cos(angle), length, 2, 0xffffff, 1, angle)
    }
    this.paint.end()
  }
  // Co-op: pending commands drawn where they will land, in their sender's colour. A build shows a tower ghost; a tower
  // change, a label; a move, spell, trap or supply, a pulsing ground ring. A partner's command on your open menu closes it.
  private marks: { x: number; y: number; player: Player; until: number }[] = []
  private placed(x: number, y: number, player: Player, seconds: number) { if (this.options.coop) this.marks.push({ x, y, player, until: this.presentationTime + seconds }) }
  private drawQueued() {
    this.ringCount = 0
    // What each player owns: towers, traps, standing supplies, and a spell or thrown supply while its effect plays.
    const colour = (player: number | undefined) => player === this.localPlayer ? YOU : PARTNER, alpha = (player: number | undefined) => player === this.localPlayer ? .75 : .4
    for (const tower of this.towers) if (tower?.owner !== undefined) this.groundRing(tower.x, tower.y + 6, 150, colour(tower.owner), alpha(tower.owner))
    for (const trap of this.traps) if (trap.owner !== undefined) this.groundRing(trap.x, trap.y + 8, 112, colour(trap.owner), alpha(trap.owner))
    for (const item of this.items) if (item.owner !== undefined) this.groundRing(item.x, item.y + 8, 112, colour(item.owner), alpha(item.owner) * Math.min(1, item.life))
    this.marks = this.marks.filter(mark => mark.until > this.presentationTime)
    for (const mark of this.marks) this.groundRing(mark.x, mark.y, 170, colour(mark.player), alpha(mark.player) * Math.min(1, (mark.until - this.presentationTime) * 3))
    this.ghosts.forEach(ghost => { ghost.image.setVisible(false); ghost.label.setVisible(false) }) // sparse: one per pad used
    const local = this.localPlayer, pulse = this.motion ? .7 + .25 * Math.sin(this.presentationTime * 7) : .85
    const labels: Partial<Record<Command['type'], string>> = { build: 'building…', upgrade: 'upgrading…', specialise: 'upgrading…', sell: 'selling…' }
    for (const { player, command } of this.queued) {
      const color = player === local ? YOU : PARTNER
      if ('pad' in command && command.type !== 'target') {
        const pad = this.pads[command.pad], tower = this.towers[command.pad]
        if (!pad || command.type === 'build' && tower) continue
        const ghost = this.ghost(command.pad)
        if (ghost.label.visible) continue
        if (command.type === 'build') {
          this.art.set(ghost.image, this.towerFrame(command.kind, 1))
          ghost.image.setPosition(pad.x, pad.y - 90).setDisplaySize(144, 180).setTint(color).setAlpha(.45 * pulse + .1).setVisible(true)
          this.groundRing(pad.x, pad.y + 4, 150, color, pulse)
        }
        const key = `${command.type}:${color}`
        if (ghost.key !== key) { ghost.key = key; ghost.label.setText(`${player === local ? '' : 'Partner '}${labels[command.type]}`).setColor(hex(color)) }
        ghost.label.setPosition(pad.x, pad.y - 100).setVisible(true) // over the tower or its ghost, clear of the top HUD
        if (player !== local && this.selected === command.pad) { this.cancel(); this.hud.toast(tower ? 'Your partner is changing this tower' : 'Your partner is building here', 2) }
      } else if ('x' in command && command.type !== 'move' || command.type === 'move' && player === local) this.groundRing(command.x, command.y, command.type === 'move' ? 96 : 140, color, pulse)
    }
    for (let i = this.ringCount; i < this.rings.length; i++) if (this.rings[i].visible) this.rings[i].setVisible(false)
  }
  private ghost(pad: number) {
    return this.ghosts[pad] ??= { image: this.art.image(0, 0, 'world/rune-pad').setDepth(this.pads[pad].y).setVisible(false), key: '',
      label: this.add.text(0, 0, '', { fontFamily: '"Luckiest Guy", sans-serif', fontSize: '28px', color: '#ffffff', stroke: '#241b30', strokeThickness: 6 }).setOrigin(.5).setDepth(2750).setVisible(false) }
  }
  private groundRing(x: number, y: number, width: number, tint: number, alpha: number) {
    const ring = this.rings[this.ringCount++] ??= this.art.image(0, 0, 'hero/ring').setDepth(6)
    ring.setPosition(x, y).setDisplaySize(width, width * .38).setTint(tint).setAlpha(alpha).setVisible(true)
  }
  // An atlas frame drawn with the pooled overlay quads, centred on (x, y).
  mark(name: string, x: number, y: number, size: number, alpha = 1, tint = 0xffffff, add = false, squash = 1) {
    const [key, frame] = this.art.frame(name), f = this.textures.getFrame(key, frame), w = f.realWidth * size, h = f.realHeight * size * squash
    this.paint.sprite(key, frame, x - w / 2, y - h / 2, w, h, tint, alpha, 0, add)
  }
  // A tower turned to gold (Golden Touch) or frozen (Final Panel, a laser stun) wears a recoloured copy of its own frame. The coat
  // climbs the tower in .3 s, a shine sweeps it, and in its last .3 s it recedes while flakes or shards fall; a bar counts it down.
  private drawCoat(pad: number, tower: Tower) {
    const coat = this.coats[pad], kind = tower.gold > 0 ? 'gold' : tower.stun > 0 ? 'ice' : '', left = kind === 'gold' ? tower.gold : tower.stun
    const now = this.presentationTime, fancy = this.motion && !this.settings.lite && this.quality.tier < 2
    if (kind !== coat.kind) { coat.kind = kind; coat.peak = 0; if (kind) this.sfx(kind === 'gold' ? 'gold-on' : 'ice-on', tower) }
    if (kind) {
      coat.peak = Math.max(coat.peak, left)
      const image = tower.image, key = this.coatFrame(image.frame.name, kind), p = this.motion ? Phaser.Math.Clamp(Math.min(coat.peak - left, left) / .3, 0, 1) : 1
      const w = image.frame.realWidth, h = image.frame.realHeight, top = h * (1 - p)
      if (coat.image.texture.key !== key) { coat.image.setTexture(key); coat.shine.setTexture(key) }
      coat.image.setVisible(p > 0).setPosition(image.x, image.y).setDisplaySize(image.displayWidth, image.displayHeight).setRotation(image.rotation).setCrop(0, top, w, h - top)
      // While it climbs or recedes the shine is the bright edge; while it holds, a band sweeps across every 1.4 s.
      const band = w * .24, sweep = ((now * .72 + pad * .37) % 1) * (w + band) - band
      if (p < 1) coat.shine.setCrop(0, top, w, h * .07).setAlpha(.9)
      else coat.shine.setCrop(Math.max(0, sweep), 0, Math.min(band, band + sweep, w - sweep), h).setAlpha(kind === 'gold' ? .6 : .4)
      coat.shine.setVisible(fancy && p > 0).setPosition(image.x, image.y).setDisplaySize(image.displayWidth, image.displayHeight).setRotation(image.rotation)
      if (left < .3 && coat.peak - left > .3 && now - coat.recede > 1) {
        coat.recede = now; coat.flake = kind === 'gold' ? 0xffd45e : 0xd8f3ff; this.sfx(kind === 'gold' ? 'gold-off' : 'ice-off', tower)
        if (fancy) this.effect(kind === 'gold' ? 'combat/crit/0' : 'combat/block/0', tower.x, tower.y - 110, .4, 1.3)
      }
      this.bar(tower.x, tower.y - 198, left / coat.peak, kind === 'gold' ? 0xffd45e : 0x9fdcff, 80)
    } else if (coat.image.visible) { coat.image.setVisible(false); coat.shine.setVisible(false) }
    // Flakes (gold) or shards (ice) fall from the receding edge.
    const age = now - coat.recede
    if (fancy && age < .9) for (let j = 0; j < 8; j++) {
      const a = age - j * .035, r = Math.sin(pad * 31 + j * 12.9898) * 43758.5453 % 1
      if (a < 0 || a > .55) continue
      this.paint.image('white', tower.x + r * 64, tower.y - 175 + j * 21 + a * 50 + a * a * 420, 16 + Math.abs(r) * 10, 11 + Math.abs(r) * 8, coat.flake, 1 - a / .55, a * 9 + j)
    }
  }
  // A tower frame's coats are made as soon as the frame is on the field, from a copy decoded off the main thread: the first
  // synchronous draw from a tower atlas decodes the whole sheet (7-14 ms, a dropped frame mid-fight). Gold only where Midas can come.
  private prepareCoats(name: string) {
    this.coated.add(name)
    const [atlas, frameName] = this.art.frame(name), f = this.textures.getFrame(atlas, frameName), midas = this.level.endless || this.level.waves.some(w => w.boss?.id === 1881)
    void createImageBitmap(f.source.image as ImageBitmapSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight).then(copy => {
      if (!this.gone) { this.coatFrame(name, 'ice', copy); if (midas) this.coatFrame(name, 'gold', copy) }
      copy.close()
    }).catch(() => { /* coatFrame draws from the sheet when the coat is needed */ })
  }
  // A coat is a small canvas with the frame's luminance mapped onto the ramp (WebGL and Canvas alike).
  coatFrame(name: string, kind: 'gold' | 'ice', copy?: ImageBitmap) {
    let key = this.coatKeys[kind].get(name)
    if (!key) { key = `coat-${kind}:${name}`; this.coatKeys[kind].set(name, key) }
    if (this.textures.exists(key)) return key
    const [atlas, frameName] = this.art.frame(name), f = this.textures.getFrame(atlas, frameName), ramp = COAT_RAMPS[kind]
    const canvas = document.createElement('canvas'), c = Object.assign(canvas, { width: f.realWidth, height: f.realHeight }).getContext('2d', { willReadFrequently: true })!
    if (copy) c.drawImage(copy, f.x, f.y); else c.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, f.x, f.y, f.cutWidth, f.cutHeight)
    const data = c.getImageData(0, 0, f.realWidth, f.realHeight), px = data.data, last = ramp.length - 1
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue
      const l = Math.min(1, Math.max(0, ((px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11) / 255 - .5) * 1.3 + .55)) * last, k = Math.min(last - 1, Math.floor(l)), t = l - k
      for (let ch = 0; ch < 3; ch++) px[i + ch] = ramp[k][ch] + (ramp[k + 1][ch] - ramp[k][ch]) * t
    }
    c.putImageData(data, 0, 0); this.textures.addCanvas(key, canvas)
    return key
  }
  spriteBeam(frame: string, from: Point, to: Point, duration: number, width: number, color = 0xffffff) {
    const fx = this.effect(frame, (from.x + to.x) / 2, (from.y + to.y) / 2 - 50, duration)
    if (fx) { fx.angle = Math.atan2(to.y - from.y, to.x - from.x); fx.width = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y)); fx.height = width; fx.image.setTint(color) }
  }
  private combo(name: string, at: Point) {
    if (this.combos.has(name)) return
    this.combos.add(name); this.sfx('combo', at); this.hud.toast(`COMBO! ${name === 'eggsplosion' ? 'Egg + TP = double splash' : name === 'caramel' ? 'Fire + candy bowl = caramel stun' : 'Charmed Chogs fight for you'}`)
    const text = this.add.text(at.x, at.y - 160, 'COMBO!', { fontFamily: '"Luckiest Guy", sans-serif', fontSize: '36px', color: '#ffe695', stroke: '#352342', strokeThickness: 5 }).setOrigin(.5).setDepth(2900)
    this.tweens.add({ targets: text, y: at.y - (this.motion ? 200 : 160), alpha: 0, duration: 1400, onComplete: () => text.destroy() })
  }
  signature(enemy?: Enemy, detached = false, hero = this.hero) {
    // A local bubble limit must not decide whether a relayed hero starts dancing.
    if (!enemy && this.options.coop) hero.rig.emote()
    if (enemy && (enemy.sigCooldown > 0 || this.signatures.filter(s => s.enemy || s.generation !== undefined).length >= 2)) return
    if (!enemy && this.signatures.some(s => s.bubble)) return
    const id = enemy?.id ?? hero.kit.id, assets = this.options.assets, row = assets.chogs.find(c => c.id === id)!
    const radius = enemy && !detached ? enemy.art.face.displayWidth * 61 / 128 : 48
    const player = new Signature(this, this.art, assets.signatures, assets.kits.emotes[String(id)], id, row.side.toLowerCase(), radius)
    if (enemy) {
      enemy.sigCooldown = 5
      if (!detached) { enemy.art.root.add(player.root); player.root.setPosition(enemy.art.face.x, enemy.art.face.y); enemy.art.face.setVisible(false) }
      else player.root.setPosition(Phaser.Math.Clamp(enemy.x - 40, 70, 1850), Math.max(100, enemy.y - 150)).setDepth(2800)
    } else {
      if (!this.options.coop) hero.rig.emote()
      const bubble = plate(this, -66, -64, 132, 140, 22, 0xffefd0, 1, 0x352342, 4)
      player.root.addAt(bubble, 0); player.root.setPosition(Phaser.Math.Clamp(hero.x, 70, 1850), Math.max(100, hero.y - 225)).setDepth(2800)
    }
    this.options.sfx.emote(assets.kits.emotes[String(id)], !!enemy, this.pan(enemy ?? hero))
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
    const selection = this.mode ? `mode:${this.mode}:${key}` : `pad:${this.selected}:${this.previewTower}:${key}`
    const motion = !reducedMotion() && !this.settings.lite && this.quality.tier < 2
    if (selection !== this.rangeSelection) {
      this.rangeSelection = selection; this.tweens.killTweensOf(this.range)
      this.range.setScale(motion ? .2 : 1)
      if (motion) this.tweens.add({ targets: this.range, scale: 1, duration: 160, ease: 'Back.Out' })
    } else if (!motion) { this.tweens.killTweensOf(this.range); this.range.setScale(1) }
    this.range.setPosition(x, y).setVisible(true)
    this.rangeFill.setTint(color).setAlpha(alpha); this.rangeStroke.setTint(color).setAlpha(strokeAlpha)
  }
  private drawSelection() {
    this.range.setVisible(false); this.preview.setVisible(false); this.focusRing?.setVisible(false)
    if (this.selected >= 0 && (this.towers[this.selected] || this.previewTower)) {
      const tower = this.towers[this.selected], pad = this.pads[this.selected], radius = tower ? towerStats(tower).range : TOWERS[this.previewTower!].levels[0].range
      this.showRange(pad.x, pad.y, radius, 0xffe3a3, .11, .8, 3)
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
    if (!this.range.visible && this.rangeSelection) { this.rangeSelection = ''; this.tweens.killTweensOf(this.range) }
    const target = this.focus.target
    if (target) {
      if (this.focusRadius !== target.radius) { this.focusRing?.destroy(); this.focusRadius = target.radius; this.focusRing = circle(this, target.radius, 0xffdc76, 0, 0xffdc76, 4).setDepth(3340).setAlpha(.8); this.hudLayer.add(this.focusRing) }
      const p = target.world ? this.worldToView(target) : target; this.focusRing!.setPosition(p.x, p.y).setVisible(true)
    }
    const moving = !reducedMotion() && !this.settings.lite && this.quality.tier < 2
    const pulse = moving ? .65 + .15 * Math.cos(this.presentationTime * Math.PI * 2 / 1.4) : .8
    this.padGlyphs.forEach((glyph, i) => {
      const empty = !this.towers[i], tutorial = i === 0 && this.tutorialStep === 0
      const dragging = this.input.activePointer.isDown && distanceSq(this.pointer, this.pads[i]) < 82 ** 2
      glyph.setVisible(empty).setAlpha(this.selected === i || dragging || tutorial ? pulse : .3)
    })
    this.drawWarning()
  }
  // Fixed atlas quads, below the HUD, only along the stretch of the screen edges inside the swarm's wedge as seen from the porch (wildRoute).
  private drawWarning() {
    this.warningRoot.setVisible(false)
    if (!this.warning) return
    if (this.presentationTime >= this.warning.until || this.ended) { this.warning = null; return }
    const v = this.view, moving = !reducedMotion() && !this.settings.lite && this.quality.tier < 2, span = this.span
    const porch = this.worldToView(this.options.assets.geometry.porch, this.warningPorch), away = this.warning.away
    const elapsed = this.presentationTime - this.warning.until + 3.5
    this.warningRoot.setVisible(true).setAlpha(moving ? .65 + Math.cos(elapsed * Math.PI * 4) * .3 : .85)
    this.warningEdges.forEach(({ stroke, arrows }, edge) => {
      wedgeSpan(v.left, v.top, v.right, v.bottom, edge, porch, away, span)
      // Inward is the edge's clockwise direction turned a quarter turn; the stroke sits 5px in, the arrows 30px, up to three by length.
      const size = Math.abs(span.dx) + Math.abs(span.dy), length = (span.u1 - span.u0) * size, mid = (span.u0 + span.u1) / 2
      const nx = -span.dy / size, ny = span.dx / size, count = Math.min(3, Math.floor(length / 150))
      stroke.setVisible(length > 0).setPosition(span.x + mid * span.dx + nx * 5, span.y + mid * span.dy + ny * 5).setDisplaySize(span.dx ? Math.max(1, length) : 8, span.dx ? 8 : Math.max(1, length))
      arrows.forEach((arrow, i) => {
        const u = span.u0 + (span.u1 - span.u0) * (i + 1) / (count + 1), ax = span.x + u * span.dx + nx * 30, ay = span.y + u * span.dy + ny * 30
        arrow.setPosition(ax, ay).setRotation(Math.atan2(ny, nx)).setVisible(i < count && moving && !this.hud.coversControl(ax, ay, 34))
      })
    })
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
  runStats() { return { killsByKind: { ...this.killsByKind }, bossesDefeated: [...this.bossesDefeated], wavesCleared: this.rewarded.size, jarsLost: this.jarsLost, durationS: this.clock } }
}
