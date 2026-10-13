import { hasAsset } from './assets'
import type { Settings } from './data/save'
import type { ConsumableKind, TowerKind } from './data/config'

export type Cue = 'throw' | 'splat' | 'coin' | 'build' | 'upgrade' | 'wave-horn' | 'jar-stolen' | 'emote' | 'victory' | 'defeat' | 'hit' | 'armor' | 'laser' | 'boo' | 'hero-step' | 'guard-attack' | 'candy-cascade' | 'trap'
export class Sfx {
  private context?: AudioContext
  private buffers = new Map<string, AudioBuffer>()
  private last = new Map<string, number>()
  private active = new Map<Cue, number>()
  private voices = new Set<AudioBufferSourceNode>()
  private duckUntil = 0
  private music?: AudioBufferSourceNode
  private musicGain?: GainNode
  private fxGain?: GainNode
  private settings: Settings
  private started = false
  private closed = false
  constructor(settings: Settings) { this.settings = settings }
  async unlock() {
    if (this.closed) return
    if (this.started) { if (this.context?.state === 'suspended') await this.context.resume().catch(() => {}); return }
    this.started = true
    const names = ['throw', 'splat', 'coin', 'build', 'upgrade', 'wave-horn', 'jar-stolen', 'emote', 'victory', 'defeat', 'music', 'hit', 'armor', 'laser', 'boo', 'hero-step', 'guard-attack', 'candy-cascade', 'trap']
    const formats = new Audio().canPlayType('audio/ogg') ? ['ogg', 'mp3'] : ['mp3', 'ogg']
    let manifest: { cues?: Record<string, string[]>; music?: Record<string, string> } = {}
    try { const response = await fetch('/siege/audio/manifest.json'); if (response.ok) manifest = await response.json() } catch { /* Flat cue fallback. */ }
    const files = names.map(name => {
      const stem = name === 'music' ? manifest.music?.level : manifest.cues?.[name === 'wave-horn' ? 'wave' : name]?.[0]
      return { name, url: [stem, name, name === 'music' ? 'music/level' : `sfx/${name === 'wave-horn' ? 'wave' : name}-1`].filter(Boolean).flatMap(stem => formats.map(ext => `/siege/audio/${stem}.${ext}`)).find(hasAsset) }
    }).filter(file => file.url)
    if (!files.length || this.closed) return
    try {
      this.context = new AudioContext()
      this.fxGain = this.context.createGain(); this.fxGain.connect(this.context.destination)
      this.musicGain = this.context.createGain(); this.musicGain.connect(this.context.destination)
      this.apply(this.settings)
      await this.context.resume()
      await Promise.all(files.map(async file => {
        try { const response = await fetch(file.url!); if (response.ok) this.buffers.set(file.name, await this.context!.decodeAudioData(await response.arrayBuffer())) } catch { /* Optional audio stays silent. */ }
      }))
      if (!this.closed && this.buffers.has('music')) {
        this.music = this.context.createBufferSource(); this.music.buffer = this.buffers.get('music')!; this.music.loop = true; this.music.connect(this.musicGain); this.music.start()
      }
    } catch { /* Audio is optional, including on browsers without Web Audio. */ }
  }
  apply(settings: Settings) { this.settings = settings; if (this.fxGain) this.fxGain.gain.value = settings.effects; this.mixMusic() }
  private mixMusic() {
    if (!this.context || !this.musicGain) return
    const now = this.context.currentTime, gain = this.musicGain.gain, ducked = this.duckUntil > now
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(this.settings.music * (ducked ? .22 : 1), now + .07)
    if (ducked) { gain.setValueAtTime(this.settings.music * .22, this.duckUntil); gain.linearRampToValueAtTime(this.settings.music, this.duckUntil + .45) }
  }
  duck(seconds = 2) { if (this.context) { this.duckUntil = Math.max(this.duckUntil, this.context.currentTime + seconds); this.mixMusic() } }
  play(cue: Cue, rate = 1, volume = 1) {
    const buffer = this.buffers.get(cue), context = this.context
    if (!context || !buffer || !this.fxGain || context.state !== 'running') return
    if ((this.active.get(cue) ?? 0) >= 3 || this.voices.size >= 18 || context.currentTime - (this.last.get(cue) ?? -1) < .065) return
    this.last.set(cue, context.currentTime)
    const source = context.createBufferSource(), gain = context.createGain()
    source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = volume
    source.connect(gain); gain.connect(this.fxGain); this.voices.add(source); this.active.set(cue, (this.active.get(cue) ?? 0) + 1)
    source.onended = () => { this.voices.delete(source); this.active.set(cue, Math.max(0, (this.active.get(cue) ?? 1) - 1)); source.disconnect(); gain.disconnect() }; source.start()
  }
  tower(kind: TowerKind) {
    const sound: Partial<Record<TowerKind, [Cue, number]>> = { roost: ['throw', 1.7], cauldron: ['splat', .72], catapult: ['throw', .6], lighthouse: ['laser', .7], organ: ['wave-horn', .55] }
    const [cue, rate] = sound[kind] ?? ['throw', 1]; this.play(cue, rate, kind === 'organ' ? .35 : .55)
  }
  item(kind: ConsumableKind) {
    const sounds: Record<ConsumableKind, [Cue, number]> = { 'pumpkin-bomb': ['hit', .65], 'holy-water': ['splat', 1.55], garlic: ['boo', .7], 'candy-cane': ['trap', .85], scarecrow: ['boo', 1.2] }
    this.play(...sounds[kind], .7)
  }
  ability(family: string, ultimate = false) {
    const sounds: Record<string, [Cue, number]> = {
      laser: ['laser', 1.1], 'target-lock': ['laser', 1.5], 'deal-with-it': ['hit', .8], 'tear-flood': ['splat', .7], charm: ['emote', 1.3], 'play-dead': ['boo', .7], 'stare-down': ['boo', 1.15], confetti: ['candy-cascade', 1.4], 'pep-talk': ['wave-horn', 1.2],
      meteor: ['hit', .55], tidal: ['splat', .55], twister: ['throw', .6], vanish: ['boo', 1.4], arcane: ['laser', .7], bloom: ['upgrade', 1.2], 'love-bomb': ['emote', .8], purify: ['upgrade', 1.5], thunder: ['laser', .5], 'candy-bomb': ['candy-cascade', .7],
      'legend-561': ['hit', .65], 'legend-900': ['armor', .65], 'legend-942': ['boo', .55], 'legend-1002': ['boo', .75], 'legend-1481': ['trap', .85], 'legend-1514': ['throw', 1.5], 'legend-1667': ['upgrade', 1.35], 'legend-1798': ['armor', 1.1], 'legend-1881': ['coin', .8], 'legend-1884': ['laser', .8],
    }
    const [cue, pitch] = sounds[family] ?? ['emote', 1]
    if (ultimate) this.duck(2.2)
    this.play(cue, pitch * (ultimate ? .85 : 1), ultimate ? 1 : .75)
  }
  boss(id: number | 'pumpkin', intro = false) {
    if (intro) this.duck(3)
    if (id === 'pumpkin') this.play('wave-horn', .55, .85)
    else this.ability(`legend-${id}`)
  }
  emote(name: string, quiet = false) {
    const cue: Cue = /coin|bling|hodl|moon|wagmi/.test(name) ? 'coin' : /boo|faint|grr|ngmi|rekt/.test(name) ? 'boo' : /robot|laser|scan/.test(name) ? 'laser' : 'emote'
    const pitch = /cry|sob|gn|drool/.test(name) ? .7 : .9 + [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 7 * .07
    this.play(cue, pitch, quiet ? .25 : .65)
  }
  pause(paused: boolean) { if (this.context) void (paused ? this.context.suspend() : this.context.resume()).catch(() => {}) }
  destroy() { this.closed = true; this.music?.stop(); for (const voice of this.voices) voice.stop(); this.voices.clear(); void this.context?.close().catch(() => {}); this.buffers.clear() }
}
