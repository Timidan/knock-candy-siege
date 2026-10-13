import { hasAsset } from './assets'
import type { Settings } from './data/save'
import type { ConsumableKind, TowerKind } from './data/config'

// Menu cues: the React menus play them through ui.tsx (Sticker and setUiSound).
export type UiCue = 'ui-click' | 'ui-select' | 'ui-open' | 'ui-close' | 'ui-back' | 'ui-deny' | 'ui-confirm' | 'ui-toggle'
export type Cue = 'throw' | 'splat' | 'coin' | 'build' | 'upgrade' | 'wave-horn' | 'jar-stolen' | 'emote' | 'victory' | 'defeat' | 'hit' | 'armor' | 'laser' | 'boo' | 'hero-step' | 'guard-attack' | 'candy-cascade' | 'trap'
  | 'block' | 'miss' | 'crit' | 'callout' | 'talent-open' | 'talent-tick' | 'candy-arrive' | 'star' | UiCue
export type Track = 'menu' | 'level' | 'boss'
// Files are public/siege/audio/sfx/<group>-<n>.<ext>. Frequent groups rotate takes; guard-attack-3 is near-silent, so it is skipped.
const TAKES = { throw: 3, splat: 3, hit: 3, coin: 3, 'hero-step': 3, laser: 3, armor: 2, 'guard-attack': 2, build: 1, upgrade: 1, wave: 1, 'jar-stolen': 1, emote: 1, victory: 1, defeat: 1, boo: 1, 'candy-cascade': 1, trap: 1, 'ui-open': 1,
  'ui-click': 1, 'ui-close': 1, 'ui-confirm': 1, 'ui-error': 1, 'ui-toggle': 1 }
type Group = keyof typeof TAKES
// Menu cues: one take each (the other takes sound like different buttons), gently varied, and important so they play over a paused game.
// They share one 'ui' slot, so a tap never stacks two: whichever plays first in a tap wins.
const menu = (layers: [Group, number, number][]) => ({ layers, vary: true, important: true, gap: .1, slot: 'ui' })
// Layers are [group, pitch, base gain]; the base gain multiplies the caller's volume and keeps the 0 dBFS takes (splat, hit, coin, laser) down.
// vary: a different take than last time, ±4% pitch and ±8% volume. important: never squeezed out by routine combat, and still plays while paused.
const CUES: Record<Cue, { layers: [Group, number, number][]; vary?: boolean; important?: boolean; gap?: number; slot?: string }> = {
  throw: { layers: [['throw', 1, 1]], vary: true }, splat: { layers: [['splat', 1, .5]], vary: true }, hit: { layers: [['hit', 1, .55]], vary: true },
  coin: { layers: [['coin', 1, .6]], vary: true }, 'hero-step': { layers: [['hero-step', 1, .7]], vary: true }, laser: { layers: [['laser', 1, .5]], vary: true },
  armor: { layers: [['armor', 1, .8]], vary: true }, 'guard-attack': { layers: [['guard-attack', 1, .7]], vary: true },
  build: { layers: [['build', 1, .8]] }, upgrade: { layers: [['upgrade', 1, .8]] }, emote: { layers: [['emote', 1, .8]] }, boo: { layers: [['boo', 1, 1]] }, trap: { layers: [['trap', 1, .9]] },
  'wave-horn': { layers: [['wave', 1, .9]], important: true }, 'jar-stolen': { layers: [['jar-stolen', 1, 1]], important: true }, 'candy-cascade': { layers: [['candy-cascade', 1, 1]], important: true },
  victory: { layers: [['victory', 1, .8]], important: true }, defeat: { layers: [['defeat', 1, .8]], important: true },
  block: { layers: [['guard-attack', 1, .5]], vary: true }, miss: { layers: [['throw', 1.35, .35]], vary: true }, crit: { layers: [['hit', .85, .7], ['coin', 1.6, .4]], vary: true },
  'candy-arrive': { layers: [['coin', 1.25, .35]], vary: true, gap: .09 }, callout: { layers: [['ui-open', 1, .6]], important: true },
  'talent-open': { layers: [['upgrade', 1.15, .6]], important: true }, 'talent-tick': { layers: [['coin', 1.9, .2]], important: true },
  star: { layers: [['hit', .7, .6], ['coin', 1.25, .45]], important: true },
  'ui-click': menu([['ui-click', 1, .55]]), 'ui-select': menu([['ui-click', 1.3, .45], ['coin', 2, .1]]), 'ui-back': menu([['ui-click', .8, .5]]),
  'ui-open': menu([['ui-open', 1, .4]]), 'ui-close': menu([['ui-close', 1, .4]]), 'ui-deny': menu([['ui-error', 1, .35]]),
  'ui-confirm': menu([['ui-confirm', 1, .35]]), 'ui-toggle': menu([['ui-toggle', 1, .35]]),
}
const FORMATS = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? ['ogg', 'mp3'] : ['mp3', 'ogg']
const file = (stem: string) => FORMATS.map(ext => `/siege/audio/${stem}.${ext}`).find(hasAsset)
const SFX = Object.entries(TAKES).flatMap(([group, takes]) => Array.from({ length: takes }, (_, i) => `${group}-${i + 1}`)).flatMap(key => { const url = file(`sfx/${key}`); return url ? [[key, url] as const] : [] })
// A mouse press activates the page on pointerdown, a touch only on pointerup (HTML user activation), so both are watched.
const GESTURES = ['pointerdown', 'pointerup', 'keydown'] as const
const HEADROOM = .8

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
  // delay (seconds) schedules on the audio clock, which a busy main thread cannot make late.
  play(cue: Cue, rate = 1, volume = 1, important = !!CUES[cue].important, delay = 0) {
    const context = this.context, fx = this.fxGain, spec = CUES[cue], key = spec.slot ?? (important ? `!${cue}` : cue)
    // A menu cue in the very gesture that is still starting the context (Safari resumes asynchronously) is scheduled anyway: it sounds once the context runs.
    if (!context || !fx || (context.state !== 'running' && !(spec.slot && navigator.userActivation?.isActive)) || (this.paused && !important)) return
    if (spec.slot) { this.pendingUi = this.buffers.has(`${spec.layers[0][0]}-1`) ? undefined : cue as UiCue; if (this.pendingUi) return }
    const at = context.currentTime + delay
    if ((this.active.get(key) ?? 0) >= 3 || this.voices.size >= 18 || (!important && this.routine >= 12) || at - (this.last.get(key) ?? -1) < (spec.gap ?? .065)) return
    // Presentation randomness only: Math.random never touches the seeded game RNG.
    const pitch = spec.vary ? 1 + (Math.random() * 2 - 1) * .04 : 1, loud = spec.vary ? 1 + (Math.random() * 2 - 1) * .08 : 1
    let slot = true // One play holds one per-cue slot however many layers it has; every layer counts as a voice.
    for (const [group, layerRate, layerGain] of spec.layers) {
      const takes = Array.from({ length: TAKES[group] }, (_, i) => this.buffers.get(`${group}-${i + 1}`)).filter(buffer => !!buffer)
      const fresh = spec.vary && takes.length > 1 ? takes.filter(buffer => buffer !== this.lastTake.get(group)) : takes.slice(0, 1)
      const buffer = fresh[Math.floor(Math.random() * fresh.length)]
      if (!buffer) continue
      this.lastTake.set(group, buffer); this.last.set(key, at)
      const source = context.createBufferSource(), gain = context.createGain(), counted = slot
      slot = false
      source.buffer = buffer; source.playbackRate.value = rate * layerRate * pitch; gain.gain.value = volume * layerGain * loud
      source.connect(gain).connect(fx); this.voices.set(source, [cue, at]); if (counted) this.active.set(key, (this.active.get(key) ?? 0) + 1); if (!important) this.routine++
      source.onended = () => { this.voices.delete(source); if (counted) this.active.set(key, (this.active.get(key) ?? 1) - 1); if (!important) this.routine--; source.disconnect(); gain.disconnect() }
      source.start(at)
    }
  }
  // Cancels a cue's plays that are scheduled but not yet sounding, such as the result card's star cues when the card closes early. One already sounding rings out.
  stop(cue: Cue) {
    const now = this.context?.currentTime ?? 0
    for (const [source, [name, at]] of this.voices) if (name === cue && at > now) source.stop()
    for (const key of [cue, `!${cue}`]) if ((this.last.get(key) ?? 0) > now) this.last.delete(key) // a cancelled cue must not hold off the next one
  }
  tower(kind: TowerKind) {
    const sound: Partial<Record<TowerKind, [Cue, number]>> = { roost: ['throw', 1.7], cauldron: ['splat', .72], catapult: ['throw', .6], lighthouse: ['laser', .7], organ: ['wave-horn', .55] }
    const [cue, rate] = sound[kind] ?? ['throw', 1]; this.play(cue, rate, kind === 'organ' ? .35 : .55, false)
  }
  item(kind: ConsumableKind) {
    const sounds: Record<ConsumableKind, [Cue, number]> = { 'pumpkin-bomb': ['hit', .65], 'holy-water': ['splat', 1.55], garlic: ['boo', .7], 'candy-cane': ['trap', .85], scarecrow: ['boo', 1.2] }
    this.play(...sounds[kind], .7)
  }
  ability(family: string, ultimate = false, important = ultimate) {
    const sounds: Record<string, [Cue, number]> = {
      laser: ['laser', 1.1], 'target-lock': ['laser', 1.5], 'deal-with-it': ['hit', .8], 'tear-flood': ['splat', .7], charm: ['emote', 1.3], 'play-dead': ['boo', .7], 'stare-down': ['boo', 1.15], confetti: ['candy-cascade', 1.4], 'pep-talk': ['wave-horn', 1.2],
      meteor: ['hit', .55], tidal: ['splat', .55], twister: ['throw', .6], vanish: ['boo', 1.4], arcane: ['laser', .7], bloom: ['upgrade', 1.2], 'love-bomb': ['emote', .8], purify: ['upgrade', 1.5], thunder: ['laser', .5], 'candy-bomb': ['candy-cascade', .7],
      'legend-561': ['hit', .65], 'legend-900': ['armor', .65], 'legend-942': ['boo', .55], 'legend-1002': ['boo', .75], 'legend-1481': ['trap', .85], 'legend-1514': ['throw', 1.5], 'legend-1667': ['upgrade', 1.35], 'legend-1798': ['armor', 1.1], 'legend-1881': ['coin', .8], 'legend-1884': ['laser', .8],
    }
    const [cue, pitch] = sounds[family] ?? ['emote', 1]
    if (ultimate) this.duck(2.2)
    this.play(cue, pitch * (ultimate ? .85 : 1), ultimate ? 1 : .75, important)
  }
  boss(id: number | 'pumpkin', intro = false) {
    if (intro) this.duck(3)
    if (id === 'pumpkin') this.play('wave-horn', .55, .85, true)
    else this.ability(`legend-${id}`, false, true)
  }
  emote(name: string, quiet = false) {
    const cue: Cue = /coin|bling|hodl|moon|wagmi/.test(name) ? 'coin' : /boo|faint|grr|ngmi|rekt/.test(name) ? 'boo' : /robot|laser|scan/.test(name) ? 'laser' : 'emote'
    const pitch = /cry|sob|gn|drool/.test(name) ? .7 : .9 + [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 7 * .07
    this.play(cue, pitch, quiet ? .25 : .65)
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
