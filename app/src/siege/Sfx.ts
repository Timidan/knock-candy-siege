import { hasAsset } from './assets'
import type { Settings } from './data/save'
import type { EnemyKind } from './data/config'

// Menu cues: the React menus play them through ui.tsx (Sticker and setUiSound).
export type UiCue = 'ui-click' | 'ui-select' | 'ui-open' | 'ui-close' | 'ui-back' | 'ui-deny' | 'ui-confirm' | 'ui-toggle'
export type Track = 'menu' | 'level' | 'boss'
// Files are public/siege/audio/sfx/<group>-<n>.<ext>. Frequent groups rotate takes; guard-attack-3 is near-silent, so it is skipped.
const TAKES = { throw: 3, splat: 3, hit: 3, coin: 3, 'hero-step': 3, laser: 3, boo: 3, sell: 3, 'guard-hit': 3, armor: 2, 'guard-attack': 2, build: 1, upgrade: 1, wave: 1, 'jar-stolen': 1, emote: 1, victory: 1, defeat: 1, 'candy-cascade': 1, trap: 1, 'ui-open': 1,
  'ui-click': 1, 'ui-close': 1, 'ui-confirm': 1, 'ui-error': 1, 'ui-toggle': 1 }
type Group = keyof typeof TAKES
type Layers = [Group, number, number][]
// Layers are [group, pitch, base gain]; the base gain multiplies the caller's volume and keeps the 0 dBFS takes (splat, hit, coin, laser) down.
// Phone speakers lose almost everything below 300 Hz, where all of splat, build, wave and trap and most of hit and guard-hit sit,
// so every game cue also carries a layer with energy above 500 Hz (boo, emote, armor, coin, cascade, sell, ui-*).
// vary: a different take than last time, ±4% pitch and ±8% volume. important: never squeezed out by routine combat, and still plays while paused.
// share: cues that throttle as one family (one gap, one live cap), so a crowded frame plays one impact, not twenty. max: live plays (default 3).
type Spec = { layers: Layers; vary?: boolean; important?: boolean; gap?: number; slot?: string; share?: string; max?: number }
// Menu cues: one take each (the other takes sound like different buttons), gently varied, and important so they play over a paused game.
// They share one 'ui' slot, so a tap never stacks two: whichever plays first in a tap wins.
const menu = (layers: Layers): Spec => ({ layers, vary: true, important: true, gap: .1, slot: 'ui' })
// Player actions and story beats: never dropped for combat.
const beat = (layers: Layers): Spec => ({ layers, important: true })
// Routine combat, quiet and varied, each family under one throttle.
const impact = (layers: Layers): Spec => ({ layers, vary: true, share: 'impact', gap: .05, max: 4 })
const fire = (layers: Layers): Spec => ({ layers, vary: true, share: 'fire', gap: .06, max: 4 })
const death = (layers: Layers): Spec => ({ layers, vary: true, share: 'death', gap: .07 })
const act = (layers: Layers, gap = .2): Spec => ({ layers, vary: true, gap, max: 2 })
const blink: Layers = [['laser', .5, .3], ['boo', 1.8, .3]]
const CUE_TABLE = {
  // Building blocks; the ability, boss and emote tables below pitch them.
  throw: { layers: [['throw', 1, 1]], vary: true }, splat: { layers: [['splat', 1, .5]], vary: true }, hit: { layers: [['hit', 1, .55]], vary: true },
  coin: { layers: [['coin', 1, .6]], vary: true }, 'hero-step': { layers: [['hero-step', 1, .7]], vary: true }, laser: { layers: [['laser', 1, .5]], vary: true },
  armor: { layers: [['armor', 1, .8]], vary: true }, emote: { layers: [['emote', 1, .8]] }, boo: { layers: [['boo', 1, 1]] }, trap: { layers: [['trap', 1, .9]] },
  'candy-cascade': beat([['candy-cascade', 1, 1]]),
  // Combat: impacts by type (the same five kinds as the impact sprites), splash, deflections, heavy hits.
  'impact-egg': impact([['splat', 1.15, .22], ['hit', 1.7, .45]]), 'impact-tp': impact([['throw', .8, .6], ['boo', 1.9, .26]]),
  'impact-magic': impact([['laser', .6, .2], ['candy-cascade', .85, .55]]), 'impact-seed': impact([['hit', 1.4, .38], ['armor', 1.9, .3]]),
  'impact-hero': impact([['hit', 1.15, .4], ['emote', 1.1, .45]]), 'impact-splash': impact([['splat', .8, .35], ['boo', 1.3, .4]]),
  block: { layers: [['guard-attack', 1, .5]], vary: true }, miss: { layers: [['throw', 1.35, .35]], vary: true }, crit: { layers: [['hit', .85, .7], ['coin', 1.6, .4]], vary: true },
  hurt: { layers: [['guard-hit', 1.6, .35], ['armor', 1.25, .15]], vary: true, gap: .25, max: 1 },
  // Tower fire by family; the Pumpkin Patch fires through its guards.
  'fire-egg': fire([['throw', 1.2, .6]]), 'fire-tp': fire([['throw', .8, .6], ['boo', 1.5, .14]]), 'fire-lantern': fire([['boo', 1.7, .4]]),
  'fire-patch': fire([['guard-attack', 1.15, .22]]), 'fire-roost': fire([['throw', 1.7, .7]]), 'fire-cauldron': fire([['throw', .95, .5], ['emote', 1.3, .14]]),
  'fire-catapult': fire([['trap', .8, .4], ['throw', .6, .5], ['armor', .7, .18]]), 'fire-lighthouse': fire([['boo', 1.15, .35], ['laser', .45, .16]]), 'fire-organ': fire([['wave', .55, .35], ['boo', .6, .35]]),
  // Enemies: entering the road (pitched by kind), the march and flutter of a crowd, deaths by kind, trait moves.
  arrive: act([['boo', 1, .24], ['hero-step', .8, .2]], .45), march: { layers: [['hero-step', 1.15, .3]], vary: true, gap: .25, max: 1 }, flap: { layers: [['throw', 1.9, .3]], vary: true, gap: .25, max: 1 },
  'die-treater': death([['throw', 1.3, .8], ['candy-cascade', 1.1, .55]]), 'die-ghost': death([['boo', 1.25, .5]]), 'die-pumpkin': death([['splat', .75, .32], ['armor', .7, .45]]),
  'die-bat': death([['throw', 1.8, .6], ['emote', 1.6, .25]]), 'die-witch': death([['boo', .8, .4], ['candy-cascade', .8, .45]]), 'die-mummy': death([['splat', 1, .3], ['boo', .7, .35]]),
  'die-mini': death([['emote', 1.7, .4]]), 'die-goblin': death([['coin', .85, .7], ['hit', 1.1, .2]]), 'die-skeleton': death([['armor', 1.6, .6]]),
  'witch-heal': act([['candy-cascade', .7, .5], ['upgrade', 1.7, .2]], .3), 'witch-blink': act(blink), 'wizard-blink': act(blink),
  'laser-stun': act([['laser', .5, .35], ['armor', 1.5, .3]], .3), gum: act([['splat', 1.8, .2], ['emote', .8, .3]], .4), 'candle-pump': act([['coin', 1.5, .5], ['boo', 2, .2]], .4),
  'ghost-reveal': act([['boo', 1.5, .4], ['candy-cascade', 1.3, .2]], .25), portal: act([['laser', .4, .2], ['boo', 1.8, .3]], .25),
  flee: act([['throw', 1.4, .5], ['coin', 1.2, .4]], .3), 'enemy-lucky': act([['coin', 1.4, .6], ['upgrade', 1.8, .15]], .3), 'enemy-revive': act([['boo', .7, .45], ['armor', 1.2, .2]], .3),
  'decoy-hit': act([['hit', 1.3, .25], ['armor', 1.6, .3]], .3), 'decoy-break': act([['hit', 1.2, .35], ['boo', 1.4, .3]], .3),
  // Guards and allies.
  'guard-down': act([['guard-hit', .9, .35], ['armor', .75, .45]], .25), 'guard-up': act([['armor', 1.3, .45]], .25), summon: act([['build', 1.2, .4], ['boo', .8, .3]], .3),
  // Bosses. Each legend's own move sound comes from the ability table.
  'boss-enter': beat([['wave', .55, .9], ['hit', .6, .5], ['boo', .7, .55]]), 'boss-enrage': beat([['hit', .55, .6], ['boo', .55, .6], ['armor', .6, .3]]),
  'boss-step': { layers: [['hero-step', .6, .4], ['build', .9, .12]], vary: true, gap: .2, max: 2 }, 'boss-roll': beat([['build', .7, .5], ['throw', .55, .6], ['armor', .6, .35]]),
  'boss-split': beat([['splat', .6, .7], ['boo', .9, .45]]), 'boss-revive': beat([['boo', .5, .7], ['wave', .6, .6]]),
  // Boss powers as they land on the field: each legend's move, then what follows from it.
  'power-561': beat([['hit', .5, .6], ['throw', .45, .55], ['boo', 1.7, .3]]), 'power-900': beat([['armor', .55, .6], ['throw', .5, .55], ['boo', .6, .35]]),
  'power-942': beat([['boo', .42, .85], ['emote', .55, .45], ['laser', .35, .3]]), 'power-1002': beat([['boo', .6, .6], ['splat', .45, .45], ['candy-cascade', .55, .3]]),
  'power-1481': beat([['trap', 1.25, .5], ['emote', 1.6, .4], ['throw', .8, .4]]), 'power-1514': beat([['throw', 1.5, .5], ['laser', .4, .35], ['armor', 1.8, .4]]),
  'power-1667': beat([['upgrade', 1.4, .55], ['candy-cascade', 1.6, .3], ['boo', 1.9, .2]]), 'power-1798': beat([['armor', .8, .7], ['guard-attack', .7, .5], ['armor', 1.25, .35]]),
  'power-1881': beat([['coin', .6, .6], ['upgrade', 1.25, .45], ['candy-cascade', 1.8, .25]]), 'power-1884': beat([['laser', .42, .55], ['boo', .48, .5], ['coin', .7, .35]]),
  'power-land': act([['build', .6, .6], ['hit', .7, .45], ['armor', 1.3, .3]], .3), 'shield-crack': act([['armor', 1.5, .5], ['hit', 1.4, .3]], .06), 'bubble-pop': act([['splat', 2, .25], ['coin', 2, .2]], .05),
  'gold-on': act([['coin', .75, .55], ['candy-cascade', 1.5, .3], ['upgrade', 1.7, .2]], .08), 'gold-off': act([['coin', 1.7, .35], ['armor', 1.9, .25]], .08),
  'ice-on': act([['armor', 1.85, .4], ['laser', .45, .2], ['coin', 2, .2]], .08), 'ice-off': act([['armor', 2, .35], ['splat', 1.7, .2]], .08),
  'boss-defeat': beat([['candy-cascade', 1, 1], ['hit', .6, .6], ['coin', 1, .5]]), 'jars-back': beat([['candy-cascade', 1.2, .9], ['coin', 1.1, .6]]),
  'jar-stolen': beat([['jar-stolen', 1, 1]]),
  // Player actions.
  build: beat([['build', 1, .8], ['armor', .85, .7]]), upgrade: beat([['upgrade', 1, .8], ['candy-cascade', 1.2, .3]]), sell: beat([['sell', 1, .5], ['coin', 1.1, .3]]),
  spec: beat([['upgrade', 1.25, .7], ['candy-cascade', 1, .5]]), target: { layers: [['ui-toggle', 1, .3]], gap: .1 }, speed: { layers: [['ui-toggle', 1.2, .3]], gap: .1 },
  move: { layers: [['ui-click', .8, .5]], gap: .15 }, 'trap-set': beat([['trap', 1.3, .5], ['ui-toggle', .8, .35]]),
  'trap-pumpkin': beat([['splat', .8, .45], ['hit', .9, .3], ['boo', 1.4, .4]]), 'trap-bowl': beat([['candy-cascade', .9, .55], ['coin', .9, .3]]), 'trap-gum': beat([['splat', 1.7, .35], ['emote', .75, .35]]),
  'item-throw': beat([['throw', .8, .7]]), 'item-pumpkin-bomb': beat([['splat', .6, .45], ['hit', .55, .4], ['boo', 1.2, .45]]), 'item-holy-water': beat([['splat', 1.55, .35], ['candy-cascade', 1.3, .7]]),
  'item-garlic': beat([['boo', .7, .55]]), 'item-candy-cane': beat([['trap', .85, .55], ['armor', 1.1, .5]]), 'item-scarecrow': beat([['build', .9, .5], ['boo', 1.2, .3]]),
  'spell-rain': beat([['candy-cascade', .85, .9], ['coin', .9, .45], ['hit', .8, .25]]), 'spell-boo': beat([['boo', .9, 1]]),
  'hero-hurt': { layers: [['guard-hit', 1.1, .35], ['emote', .7, .3]], vary: true, gap: .3, max: 2 }, 'hero-down': beat([['hit', .6, .6], ['boo', .5, .6]]),
  'hero-revive': beat([['upgrade', 1.4, .55], ['candy-cascade', 1.2, .4]]), 'level-up': beat([['upgrade', 1.3, .7], ['coin', 1.25, .35], ['candy-cascade', 1.4, .35]]),
  'talent-pick': beat([['upgrade', 1.5, .55], ['coin', 1.6, .3]]), oddity: act([['emote', 1.2, .3], ['laser', .7, .12]], .5), combo: beat([['candy-cascade', 1.3, .9], ['hit', .9, .35]]),
  // The wave and the night.
  'wave-horn': beat([['wave', 1, .9], ['ui-confirm', .7, .5]]), 'early-call': beat([['coin', 1, .45], ['sell', 1.2, .25]]), 'wave-clear': beat([['candy-cascade', 1.1, .9], ['coin', 1.3, .55]]),
  witching: beat([['wave', .6, 1], ['boo', .55, .8], ['hit', .5, .4]]), victory: beat([['victory', 1, .8]]), defeat: beat([['defeat', 1, .8]]),
  // Props: the bridge's raise, lower and ready, and each map's own.
  'prop-lamp': beat([['jar-stolen', .8, .5], ['hit', .7, .45], ['armor', 1.2, .5]]), 'prop-shop': beat([['coin', 1.2, .65], ['candy-cascade', 1.1, .65], ['upgrade', 1.6, .25]]),
  'prop-bell': beat([['armor', .5, .8], ['armor', .53, .5]]), 'prop-grate': beat([['trap', .7, .55], ['armor', .8, .55], ['splat', .7, .3]]), 'prop-bonfire': beat([['boo', .55, .8], ['hit', .6, .3]]), 'prop-cannon': beat([['hit', .55, .75], ['build', .8, .4], ['splat', .9, .35]]),
  'prop-bridge': beat([['trap', .6, .55], ['build', .7, .45], ['armor', .6, .6]]), 'bridge-down': beat([['build', .55, .55], ['armor', .55, .6]]),
  'prop-ready': { layers: [['ui-confirm', 1.3, .25], ['coin', 1.5, .2]], important: true, gap: .3 },
  // HUD cues (Hud.ts and the result card).
  'candy-arrive': { layers: [['coin', 1.25, .35]], vary: true, gap: .09 }, callout: beat([['ui-open', 1, .6]]),
  'talent-open': beat([['upgrade', 1.15, .6]]), 'talent-tick': beat([['coin', 1.9, .2]]), star: beat([['hit', .7, .6], ['coin', 1.25, .45]]),
  'ui-click': menu([['ui-click', 1, .55]]), 'ui-select': menu([['ui-click', 1.3, .45], ['coin', 2, .1]]), 'ui-back': menu([['ui-click', .8, .5]]),
  'ui-open': menu([['ui-open', 1, .4]]), 'ui-close': menu([['ui-close', 1, .4]]), 'ui-deny': menu([['ui-error', 1, .35]]),
  'ui-confirm': menu([['ui-confirm', 1, .35]]), 'ui-toggle': menu([['ui-toggle', 1, .35]]),
} satisfies Record<string, Spec>
export type Cue = keyof typeof CUE_TABLE
const CUES: Record<Cue, Spec> = CUE_TABLE
// Entrances, pitched by kind: small and quick ones higher.
export const KIND_PITCH: Record<EnemyKind, number> = { treater: 1, ghost: 1.3, pumpkin: .75, bat: 1.6, witch: 1.1, mummy: .8, mini: 1.45, goblin: 1.25, skeleton: 1.15 }
const FORMATS = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? ['ogg', 'mp3'] : ['mp3', 'ogg']
const file = (stem: string) => FORMATS.map(ext => `/siege/audio/${stem}.${ext}`).find(hasAsset)
const SFX = Object.entries(TAKES).flatMap(([group, takes]) => Array.from({ length: takes }, (_, i) => `${group}-${i + 1}`)).flatMap(key => { const url = file(`sfx/${key}`); return url ? [[key, url] as const] : [] })
// A mouse press activates the page on pointerdown, a touch only on pointerup (HTML user activation), so both are watched.
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const
const HEADROOM = .8, VOICES = 18, ROUTINE = 12

export class Sfx {
  private context?: AudioContext
  private fxGain?: GainNode
  private musicGain?: GainNode
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Set<string>()
  private pendingUi?: UiCue
  private lastTake = new Map<Group, AudioBuffer>()
  private last = new Map<string, number>()
  private active = new Map<string, number>()
  private voices = new Map<AudioBufferSourceNode, [Cue, number]>() // each live or scheduled source, with its cue and start time
  private routine = 0
  private tracks = new Map<Track, { element: HTMLAudioElement; gain: GainNode }>()
  private track: Track = 'menu'
  private duckUntil = 0
  private paused = false
  private closed = false
  private settings: Settings
  constructor(settings: Settings) {
    this.settings = settings
    for (const type of GESTURES) document.addEventListener(type, this.unlock, true)
    document.addEventListener('visibilitychange', this.visibility)
    // Menu cues decode before any gesture (an offline context needs none): a touch unlocks on pointerup, just before its click, so even the first tap is heard.
    try { this.load(new OfflineAudioContext(1, 1, 44100), SFX.filter(([key]) => key.startsWith('ui-'))) } catch { /* They load with the rest on the first gesture. */ }
  }
  // Called inside a gesture: the context is created or resumed synchronously, then anything missing (or failed earlier) is fetched once.
  unlock = () => {
    if (this.closed || navigator.userActivation?.isActive === false) return
    const context = this.context ?? this.create()
    if (!context) return
    if (context.state !== 'running') void context.resume().catch(() => {})
    const music = this.tracks.get(this.track)
    if (!music || music.element.paused) this.crossfade()
    this.load(context, SFX)
  }
  private load(context: BaseAudioContext, files: typeof SFX) {
    for (const [key, url] of files) {
      if (this.buffers.has(key) || this.loading.has(key)) continue
      this.loading.add(key)
      void fetch(url).then(response => { if (!response.ok) throw new Error(url); return response.arrayBuffer() }).then(data => context.decodeAudioData(data))
        .then(buffer => {
          if (this.closed) return
          this.buffers.set(key, buffer)
          // A tap before its small audio file finished loading still gets one cue when ready.
          if (this.pendingUi && key === `${CUES[this.pendingUi].layers[0][0]}-1`) { const cue = this.pendingUi; this.pendingUi = undefined; this.play(cue) }
        }, () => { /* The next gesture retries it. */ }).finally(() => this.loading.delete(key))
    }
  }
  private create() {
    try {
      const context = new AudioContext(), limiter = new DynamicsCompressorNode(context, { threshold: -1, knee: 0, ratio: 20, attack: .003, release: .25 })
      this.fxGain = context.createGain(); this.musicGain = context.createGain()
      this.fxGain.connect(limiter); this.musicGain.connect(limiter); limiter.connect(context.destination)
      this.context = context; this.apply(this.settings)
      return context
    } catch { this.closed = true } // No Web Audio: the game stays silent.
  }
  apply(settings: Settings) { this.settings = settings; if (this.fxGain) this.fxGain.gain.value = settings.effects * HEADROOM; this.mixMusic() }
  private mixMusic() {
    if (!this.context || !this.musicGain) return
    const now = this.context.currentTime, gain = this.musicGain.gain, ducked = this.duckUntil > now, full = this.settings.music * (this.paused ? .35 : 1)
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(full * (ducked ? .22 : 1), now + .07)
    if (ducked) { gain.setValueAtTime(full * .22, this.duckUntil); gain.linearRampToValueAtTime(full, this.duckUntil + .45) }
  }
  duck(seconds = 2) { if (this.context) { this.duckUntil = Math.max(this.duckUntil, this.context.currentTime + seconds); this.mixMusic() } }
  // Music streams through a media element (a decoded track would be ~24 MiB) and crossfades in about 600 ms.
  music(track: Track) { if (track !== this.track) { this.track = track; this.crossfade() } }
  private crossfade() {
    const context = this.context, musicGain = this.musicGain
    if (!context || !musicGain || this.closed) return
    let music = this.tracks.get(this.track)
    if (!music) {
      // Not in the assets inventory: globbing would copy each track into the build again. All three ship in both formats.
      const element = new Audio(`/siege/audio/music/${this.track}.${FORMATS[0]}`), gain = context.createGain(), name = this.track
      element.loop = true; gain.gain.value = 0
      // The fade-in starts when sound actually comes out: started at play(), a track still buffering would finish its fade in silence and enter abruptly.
      element.addEventListener('playing', () => { if (this.track === name && !this.closed) gain.gain.setTargetAtTime(1, context.currentTime, .15) })
      context.createMediaElementSource(element).connect(gain).connect(musicGain)
      music = { element, gain }; this.tracks.set(this.track, music)
    }
    for (const [name, { element, gain }] of this.tracks) {
      if (name !== this.track) { gain.gain.setTargetAtTime(0, context.currentTime, .15); setTimeout(() => { if (this.track !== name) element.pause() }, 700) }
      else if (!element.paused) gain.gain.setTargetAtTime(1, context.currentTime, .15) // still sounding (switched back mid-fade): fade straight back in
    }
    if (music.element.paused) {
      const gain = music.gain.gain; gain.cancelScheduledValues(context.currentTime); gain.setValueAtTime(0, context.currentTime) // its playing event fades it in
      music.element.currentTime = 0; void music.element.play().catch(() => { /* Blocked until a gesture; unlock() retries. */ })
    }
  }
  // delay (seconds) schedules on the audio clock, which a busy main thread cannot make late. pan (-1…1) places it left or right.
  play(cue: Cue, rate = 1, volume = 1, important = !!CUES[cue].important, delay = 0, pan = 0) {
    const context = this.context, fx = this.fxGain, spec = CUES[cue], key = spec.slot ?? `${important ? '!' : ''}${spec.share ?? cue}`, layers = spec.layers.length
    // A menu cue in the very gesture that is still starting the context (Safari resumes asynchronously) is scheduled anyway: it sounds once the context runs.
    if (!context || !fx || (context.state !== 'running' && !(spec.slot && navigator.userActivation?.isActive)) || (this.paused && !important)) return
    if (spec.slot) { this.pendingUi = this.buffers.has(`${spec.layers[0][0]}-1`) ? undefined : cue as UiCue; if (this.pendingUi) return }
    const at = context.currentTime + delay
    // Every layer is a voice, so a layered cue only starts if all of its layers fit under the caps.
    if ((this.active.get(key) ?? 0) >= (spec.max ?? 3) || this.voices.size + layers > VOICES || (!important && this.routine + layers > ROUTINE) || at - (this.last.get(key) ?? -1) < (spec.gap ?? .065)) return
    // Presentation randomness only: Math.random never touches the seeded game RNG.
    const pitch = spec.vary ? 1 + (Math.random() * 2 - 1) * .04 : 1, loud = spec.vary ? 1 + (Math.random() * 2 - 1) * .08 : 1
    let slot = true // One play holds one per-cue slot however many layers it has; every layer counts as a voice.
    for (const [group, layerRate, layerGain] of spec.layers) {
      const takes = Array.from({ length: TAKES[group] }, (_, i) => this.buffers.get(`${group}-${i + 1}`)).filter(buffer => !!buffer)
      const fresh = spec.vary && takes.length > 1 ? takes.filter(buffer => buffer !== this.lastTake.get(group)) : takes.slice(0, 1)
      const buffer = fresh[Math.floor(Math.random() * fresh.length)]
      if (!buffer) continue
      this.lastTake.set(group, buffer); this.last.set(key, at)
      const source = context.createBufferSource(), gain = context.createGain(), panner = pan && context.createStereoPanner ? context.createStereoPanner() : null, counted = slot
      slot = false
      source.buffer = buffer; source.playbackRate.value = rate * layerRate * pitch; gain.gain.value = volume * layerGain * loud
      if (panner) { panner.pan.value = pan; source.connect(gain).connect(panner).connect(fx) } else source.connect(gain).connect(fx)
      this.voices.set(source, [cue, at]); if (counted) this.active.set(key, (this.active.get(key) ?? 0) + 1); if (!important) this.routine++
      source.onended = () => { this.voices.delete(source); if (counted) this.active.set(key, (this.active.get(key) ?? 1) - 1); if (!important) this.routine--; source.disconnect(); gain.disconnect(); panner?.disconnect() }
      source.start(at)
    }
  }
  // Cancels a cue's plays that are scheduled but not yet sounding, such as the result card's star cues when the card closes early. One already sounding rings out.
  stop(cue: Cue) {
    const now = this.context?.currentTime ?? 0
    for (const [source, [name, at]] of this.voices) if (name === cue && at > now) source.stop()
    for (const key of [cue, `!${cue}`]) if ((this.last.get(key) ?? 0) > now) this.last.delete(key) // a cancelled cue must not hold off the next one
  }
  // Hero specials and ultimates, and each legend boss's move. Player and boss moves are never squeezed out by combat.
  ability(family: string, ultimate = false, pan = 0) {
    const sounds: Record<string, [Cue, number]> = {
      laser: ['laser', 1.1], 'target-lock': ['laser', 1.5], 'deal-with-it': ['hit', .8], 'tear-flood': ['splat', .7], charm: ['emote', 1.3], 'play-dead': ['boo', .7], 'stare-down': ['boo', 1.15], confetti: ['candy-cascade', 1.4], 'pep-talk': ['wave-horn', 1.2],
      meteor: ['hit', .55], tidal: ['splat', .55], twister: ['throw', .6], vanish: ['boo', 1.4], arcane: ['laser', .7], bloom: ['upgrade', 1.2], 'love-bomb': ['emote', .8], purify: ['upgrade', 1.5], thunder: ['laser', .5], 'candy-bomb': ['candy-cascade', .7],
      'legend-561': ['hit', .65], 'legend-900': ['armor', .65], 'legend-942': ['boo', .55], 'legend-1002': ['boo', .75], 'legend-1481': ['trap', .85], 'legend-1514': ['throw', 1.5], 'legend-1667': ['upgrade', 1.35], 'legend-1798': ['armor', 1.1], 'legend-1881': ['coin', .8], 'legend-1884': ['laser', .8],
    }
    const [cue, pitch] = sounds[family] ?? ['emote', 1]
    if (ultimate) this.duck(2.2)
    this.play(cue, pitch * (ultimate ? .85 : 1), ultimate ? 1 : .75, true, 0, pan)
  }
  // A boss's move: the Great Pumpkin's call or the legend's own sound. Its entrance is the shared 'boss-enter'.
  boss(id: number | 'pumpkin', pan = 0) {
    if (id === 'pumpkin') this.play('wave-horn', .55, .85, true, 0, pan)
    else this.play(`power-${id}` as Cue, 1, 1, true, 0, pan)
  }
  // A dance or an enemy's signature (quiet, and routine so it never crowds out a player's move).
  emote(name: string, quiet = false, pan = 0) {
    const cue: Cue = /coin|bling|hodl|moon|wagmi/.test(name) ? 'coin' : /boo|faint|grr|ngmi|rekt/.test(name) ? 'boo' : /robot|laser|scan/.test(name) ? 'laser' : 'emote'
    const pitch = /cry|sob|gn|drool/.test(name) ? .7 : .9 + [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 7 * .07
    this.play(cue, pitch, quiet ? .25 : .65, !quiet, 0, pan)
  }
  // Pausing keeps the context alive for menu and talent cues: routine world sounds stop and the music ducks.
  pause(paused: boolean) { this.paused = paused; this.mixMusic() }
  // A hidden tab still suspends everything.
  private visibility = () => {
    const context = this.context, music = this.tracks.get(this.track)
    if (!context || this.closed) return
    if (document.hidden) { void context.suspend().catch(() => {}); music?.element.pause() }
    else { void context.resume().catch(() => {}); void music?.element.play().catch(() => {}) }
  }
  destroy() {
    this.closed = true
    for (const type of GESTURES) document.removeEventListener(type, this.unlock, true)
    document.removeEventListener('visibilitychange', this.visibility)
    for (const { element } of this.tracks.values()) { element.pause(); element.removeAttribute('src'); element.load() }
    for (const voice of this.voices.keys()) voice.stop()
    this.voices.clear(); this.tracks.clear(); this.buffers.clear()
    void this.context?.close().catch(() => {})
  }
}
