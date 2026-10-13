import { simulationSnapshot } from '../app/src/siege/net/snapshot'
import Phaser from 'phaser'
import { SiegeScene } from '../app/src/siege/SiegeScene'
import { loadAssets, loadHeroAssets, loadLevelAssets } from '../app/src/siege/assets'
import { resolveKit } from '../app/src/siege/data/kits'
import { readSave } from '../app/src/siege/data/save'
import { Sfx } from '../app/src/siege/Sfx'

// This adapter is test-only. The production game does not import it.
const pick = (object: object, keys: string) => Object.fromEntries(keys.split(' ').filter(key => (object as Record<string, unknown>)[key] !== undefined).map(key => [key, (object as Record<string, unknown>)[key]]))

export async function singleHero(seed: number, lite = false) {
  const signal = new AbortController().signal
  let assets = await loadAssets(signal)
  const kit = resolveKit(assets.kits, assets.traits, assets.chogs, 1, false)
  assets = await loadHeroAssets(assets, kit, signal)
  assets = await loadLevelAssets(assets, 1, signal)
  const settings = { ...readSave().settings, music: 0, effects: 0, lite, shake: !lite, autoFullscreen: false, vibration: false }
  const sfx = new Sfx(settings)
  let resolveReady!: () => void, rejectReady!: (reason: unknown) => void
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  const scene = new SiegeScene({
    assets, level: 1, mode: 'level', daily: null, seed, stars: {}, street: { candy: 0, trap: false, chog: false, crew: 0 },
    seen: ['treater', 'ghost', 'pumpkin', 'bat', 'witch', 'mummy', 'mini', 'goblin', 'skeleton'].map(kind => `enemy/${kind}`),
    hero: 1, home: false, tutorial: false, costume: '', owned: [], victoryDance: 'gg', settings, sfx,
    onDiscover() {}, onShop() {}, onPause() {}, onEnd() {}, onIntro() {}, onTutorial() {},
    onReady() { scene.game.loop.sleep(); resolveReady() },
  })
  const originalCreate = scene.create.bind(scene)
  scene.create = () => originalCreate().catch(rejectReady)
  const game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'game', width: 1920, height: 1080, banner: false, audio: { noAudio: true }, scale: { mode: Phaser.Scale.FIT }, scene, disablePreFX: true, disablePostFX: true })
  await ready
  scene.skipTutorial(); scene.quality.enabled = false
  scene.clock = 0; scene.candy = 99999
  scene.hero.cooldown = 0; scene.hero.ability = 0
  Object.assign(scene.hero, { oddity: 0, smoke: 0 })
  scene.hero.rig.play('idle'); scene.hero.rig.time = 0; scene.hero.rig.update(0)
  // TypeScript private members are inspected only in this isolated replay adapter.
  const internal = scene as unknown as { later: { at: number; run: () => void }[]; rewarded: Set<number>; combos: Set<string>; drawUnits: (dt: number) => void }
  function step() {
    if (scene.paused || scene.ended) throw new Error(`Unexpected local pause/end at ${scene.clock}`)
    scene.tick(1 / 45)
    scene.hitPause = Math.max(0, scene.hitPause - 1 / 45)
    scene.presentationTime += 1 / 45
    internal.drawUnits(lite ? 1 / 30 : 1 / 60)
  }
  const snapshot = () => simulationSnapshot(scene)

  return { scene, step, snapshot, destroy() { sfx.destroy(); game.destroy(true) } }
}

// Exact projection and draw cadence from .cache/polish3/sim-check.mjs.
export async function legacyReplay() {
  const adapter = await singleHero(20261012)
  const s = adapter.scene
  for (let i = 0; i < 8; i++) {
    s.command({ type: 'build', pad: i, kind: (['egg', 'tp', 'lantern', 'patch'] as const)[i % 4] })
    s.command({ type: 'upgrade', pad: i }); s.command({ type: 'upgrade', pad: i })
  }
  s.command({ type: 'specialise', pad: 0, spec: 'golden' }); s.command({ type: 'wave' })
  const snapshots = []
  for (let i = 0; i < 1800; i++) {
    s.tick(1 / 45); s.hitPause = Math.max(0, s.hitPause - 1 / 45); s.presentationTime += 1 / 45
    ;(s as unknown as { drawUnits: (dt: number) => void }).drawUnits(1 / 45)
    if (i % 300 === 299) snapshots.push({ scene: pick(s, 'clock jars kills candy wave countdown spellCooldown schedule waveAlive'), hero: pick(s.hero, 'hp x y level xp cooldown ability charge dealt attackCount hit revives talents'), rig: pick(s.hero.rig, 'time clip facing'), enemies: s.enemies.filter(e => e.active).map(e => pick(e, 'kind id generation path distance speed hp maxHp x y status age hit attack skill lucky revived armour visible poisonStacks heroDot sigCooldown')), towers: s.towers.map(t => t ? { ...pick(t, 'kind cooldown stun gold level spec rank'), guards: t.guards.map(g => pick(g, 'x y hp respawn cooldown slow')) } : null) })
  }
  const result = { snapshots, nextRandom: Array.from({ length: 12 }, () => s.random()) }
  adapter.destroy(); return JSON.parse(JSON.stringify(result))
}
