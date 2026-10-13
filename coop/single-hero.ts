import Phaser from 'phaser'
import { SiegeScene } from '../app/src/siege/SiegeScene'
import { loadAssets, loadHeroAssets, loadLevelAssets } from '../app/src/siege/assets'
import { resolveKit } from '../app/src/siege/data/kits'
import { readSave } from '../app/src/siege/data/save'
import { Sfx } from '../app/src/siege/Sfx'

// This adapter is test-only. The production game does not import it.
const pick = (object: object, keys: string) => Object.fromEntries(keys.split(' ').filter(key => (object as Record<string, unknown>)[key] !== undefined).map(key => [key, (object as Record<string, unknown>)[key]]))
const rigState = (rig: object) => ({ ...pick(rig, 'clip time facing walkSpeed size pendingDance'), releasePending: !!(rig as { release?: unknown }).release })
const guardState = (guard: object) => pick(guard, 'x y hp maxHp respawn cooldown slow life damage')

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
  let draws = 0
  const random = scene.random
  scene.random = () => { draws++; return random() }
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
  function snapshot() {
    return {
      scene: pick(scene, 'seed clock candy jars kills killsByKind bossesDefeated jarsLost earlyCalls wave countdown spellCooldown itemCooldown freePumpkin schedule waveAlive bridgeUp sugarRush bonfire missTime speedScale candyScale shuffle ended'),
      rng: { seed, draws, state: (seed + Math.imul(draws, 0x6D2B79F5)) >>> 0 },
      rewarded: internal.rewarded, combos: internal.combos,
      hero: { ...pick(scene.hero, 'kit x y target level xp hp maxHp cooldown ability respawn hit fear slow charge dealt attackCount specials ultimates revives talents talentLevels offered frogUsed skullUsed shield untargetable devil scare pep smoke streak lastKill waveBuff zones trail oddity'), rig: rigState(scene.hero.rig) },
      // Pool order and inactive generations matter for reused projectile targets.
      enemies: scene.enemies.map(enemy => ({ ...pick(enemy, 'active generation wave kind id mods path distance speed hp maxHp candy jars status age hit attack skill lucky revived armour visible slowPower heroDot sigCooldown returning casting poisonStacks shield gold lit'), route: enemy.route ? { length: enemy.route.length, points: enemy.route.points.map(p => [p.x, p.y]) } : null, position: [enemy.x, enemy.y], boss: enemy.boss ? { ...pick(enemy.boss, 'id cast casting phase started intro dash dashSpeed blocks revived trail total stolen child state stateTime roll shared split immune scale'), rig: enemy.boss.rig ? rigState(enemy.boss.rig) : null } : null })),
      towers: scene.towers.map(tower => tower ? { ...pick(tower, 'x y kind level spec rank spent targeting cooldown stun boost gold'), guards: tower.guards.map(guardState) } : null),
      projectiles: scene.projectiles.map(projectile => ({ ...pick(projectile, 'active generation life duration x y fromX fromY endX endY damage kind splash arc frame frameCount'), targetSlot: projectile.target ? scene.enemies.indexOf(projectile.target) : -1, onHit: !!projectile.onHit, after: !!projectile.after })),
      traps: scene.traps.map(trap => pick(trap, 'kind x y life armed')),
      items: scene.items.map(item => pick(item, 'kind x y life pulse hp')),
      allies: scene.allies.map(guardState), blockers: scene.blockers.map(blocker => pick(blocker, 'x y life radius')),
      hazards: scene.hazards, fallen: scene.fallen,
      props: scene.props.map(prop => ({ data: prop.data, cooldown: prop.cooldown, used: prop.used })),
      sources: scene.sources.map(light => pick(light, 'x y radius')),
      deferred: internal.later.map(task => ({ at: task.at, callback: !!task.run })),
    }
  }
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
