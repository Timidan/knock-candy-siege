import Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'
import type { Enemy } from './world'
import { distanceSq } from './world'
import type { BossId, BossSpawn } from './data/level1'
import { bossConfig } from './data/bosses'
import { resolveKit } from './data/kits'
import { Rig } from './hero/Rig'
import { reducedMotion } from './data/save'
import { haptic } from './haptics'
import { loadAtlas } from './assets'
import type { AssetPack } from './assets'

// A boss is an ordinary pooled Enemy (so towers, traps, spells and the hero treat it like any enemy) that carries this state:
// a legend wears its hero rig at 1.8×, the Great Pumpkin is a sprite that splits into three smaller ones at half health.
export type BossState = {
  id: BossId; name: string; holder: Phaser.GameObjects.Container | null; rig?: Rig; aura?: Phaser.GameObjects.Image; sprite?: Phaser.GameObjects.Image
  atlas: string; cast: number; casting: number; phase: 1 | 2; started: boolean; intro: number
  dash: number; dashSpeed: number; blocks: number; revived: boolean; trail: number; total: number; stolen: number
  child: boolean; state: 'walk' | 'roll' | 'summon' | 'split'; stateTime: number; roll: number; shared: { summoned: boolean }; split: boolean; immune: number; scale: number
}
export type ArtState = 'loading' | 'ready' | 'failed'
export const bossAtlasKey = (id: BossId) => id === 'pumpkin' ? 'boss' : `hero-legend-${id}`
const START = 760 // route distance where a boss walks on: clear of the edge controls, past the 450px off-screen run-up

// Boss art arrives when its wave is called. The UI frames sit inside the Great Pumpkin sheet, so they are copied into a small
// texture; the 15.7 MB sheet itself is uploaded only for the Pumpkin fight and dropped afterwards.
function load(s: SiegeScene, state: string, atlas: string, done: (atlas: AssetPack['atlases'][number]) => void) {
  if (s.bossArt.has(state)) return
  const prepared = s.options.coop && s.options.assets.atlases.find(a => a.key === atlas)
  if (prepared) { done(prepared); s.bossArt.set(state, 'ready'); return }
  s.bossArt.set(state, 'loading')
  void loadAtlas(atlas).then(loaded => { if (s.gone) return; done(loaded); s.bossArt.set(state, 'ready') }).catch(() => { s.bossArt.set(state, 'failed') })
}
export function preloadBoss(s: SiegeScene, id: BossId) {
  load(s, 'boss-sheet', 'boss', atlas => { s.bossSheet = atlas; makeUi(s, atlas) })
  if (id === 'pumpkin') return
  s.heads.prepare([id])
  const key = bossAtlasKey(id)
  if (s.textures.exists(key)) { if (!s.bossArt.has(key)) s.bossArt.set(key, 'ready'); return } // the hero already wears this legend
  load(s, key, key, atlas => { s.art.addAtlas(atlas); s.bossOwned.add(key) })
}
export function bossReady(s: SiegeScene, id: BossId): ArtState {
  preloadBoss(s, id)
  const states = [s.bossArt.get('boss-sheet'), id === 'pumpkin' ? 'ready' : s.bossArt.get(bossAtlasKey(id))]
  return states.includes('failed') ? 'failed' : states.every(v => v === 'ready') ? 'ready' : 'loading'
}
function makeUi(s: SiegeScene, atlas: AssetPack['atlases'][number]) {
  if (s.textures.exists('boss-ui')) return
  const names = ['boss/ui/bar', 'boss/ui/fill', 'boss/ui/banner'], texture = s.textures.createCanvas('boss-ui', 900, 80 + 22 + 136 + 6)!
  let y = 0
  for (const name of names) { const f = atlas.data.frames[name].frame; texture.context.drawImage(atlas.image, f.x, f.y, f.w, f.h, 0, y, f.w, f.h); texture.add(name, 0, 0, y, f.w, f.h); y += f.h + 2 }
  texture.refresh(); s.art.useTexture('boss-ui')
}

export const bossName = (s: SiegeScene, id: BossId) => id === 'pumpkin' ? s.options.assets.legends.greatPumpkin.name : s.options.assets.legends.legends[String(id)].name
export const bossLead = (s: SiegeScene) => s.enemies.find(e => e.active && e.boss) ?? null
// Share of the whole boss still standing; the Pumpkin's three halves count together.
export function bossFraction(s: SiegeScene, e: Enemy) {
  const family = s.enemies.filter(o => o.active && o.boss && o.boss.id === e.boss!.id)
  return Phaser.Math.Clamp(family.reduce((sum, o) => sum + Math.max(0, o.hp), 0) / e.boss!.total, 0, 1)
}

function setup(s: SiegeScene, e: Enemy, spec: BossSpawn, wave: number, hp: number, distance: number, half?: BossState) {
  const cfg = bossConfig(spec.id), legend = spec.id !== 'pumpkin', a = s.options.assets
  Object.assign(e, { active: true, generation: e.generation + 1, wave, kind: legend ? 'treater' : 'pumpkin', id: legend ? spec.id : 1, mods: [], path: s.roadFor('treater', 0), route: undefined, distance, returning: 0, casting: 0, poisonStacks: 0, speed: cfg.speed, hp, maxHp: hp, candy: cfg.candy, jars: half ? Math.ceil(cfg.jars / 2) : cfg.jars, age: 0, hit: 0, attack: .5, skill: 99, lucky: false, revived: false, armour: false, visible: true, slowPower: .5, heroDot: false, sigCooldown: 0, shield: 0, gold: 0, lit: true })
  for (const key of Object.keys(e.status) as (keyof typeof e.status)[]) e.status[key] = 0
  e.art.root.setVisible(false)
  s.resetReaction(e)
  s.routeFor(e).at(distance, e)
  s.waveAlive[wave] = (s.waveAlive[wave] ?? 0) + 1
  let holder: Phaser.GameObjects.Container, rig: Rig | undefined, aura: Phaser.GameObjects.Image | undefined, sprite: Phaser.GameObjects.Image | undefined
  if (legend) {
    const kit = resolveKit(a.kits, a.traits, a.chogs, spec.id as number, false)
    const costume = s.textures.exists(`hero-${kit.costume}`) ? kit.costume : s.hero.kit.costume
    rig = new Rig(s, s.art, a, { ...kit, costume }, event => { if (event === 'step') s.options.sfx.play('hero-step') }, costume)
    rig.size = 1.8
    aura = s.art.image(0, 0, s.textures.exists(bossAtlasKey(spec.id)) ? `boss/${spec.id}/aura/0` : 'fx/levelup/0').setOrigin(.5, .9)
    holder = s.add.container(0, 0, [aura, rig.root])
  } else {
    sprite = s.art.image(0, 0, s.textures.exists('boss') ? 'boss/pumpkin/walk/0' : 'enemy/pumpkin/walk/0').setOrigin(.5, .84).setScale((half ? .6 : 1) * (s.textures.exists('boss') ? 1 : 3))
    holder = s.add.container(0, 0, [sprite])
  }
  e.boss = half ? { ...half, holder, sprite, child: true, state: 'walk', stateTime: 0, roll: s.clock + 5 + s.random() * 3, started: true, intro: 0, immune: 0, casting: 0 }
    : { id: spec.id, name: bossName(s, spec.id), holder, rig, aura, sprite, atlas: bossAtlasKey(spec.id), cast: cfg.cast * .6, casting: 0, phase: 1, started: false, intro: 1.9, dash: 0, dashSpeed: 0, blocks: 0, revived: false, trail: 0, total: hp, stolen: 0, child: false, state: 'walk', stateTime: 0, roll: s.clock + 6, shared: { summoned: false }, split: false, immune: 0, scale: 1 }
}

export function spawnBoss(s: SiegeScene, spec: BossSpawn, wave: number): boolean {
  const ready = bossReady(s, spec.id)
  if (ready === 'loading') return false // the rest of the wave waits for the art
  const e = s.enemies.find(o => !o.active)
  if (!e) return false
  if (spec.id === 'pumpkin' && s.bossSheet && !s.textures.exists('boss')) { s.art.addAtlas(s.bossSheet!); s.bossOwned.add('boss') }
  setup(s, e, spec, wave, (spec.hp ?? bossConfig(spec.id).hp) * s.healthScale(wave), START)
  s.hud.bossBar(e)
  // The first meeting of each boss gets a card; the cinematic starts when play resumes.
  const fresh = !s.discovered.has(`boss/${spec.id}`)
  s.discover([`boss/${spec.id}`])
  if (fresh && !s.focus.active && !s.options.coop) { s.setPaused(true); s.options.onIntro(`boss:${spec.id}`) }
  return true
}

function guardsNear(s: SiegeScene, x: number, y: number, r: number, each: (guard: { x: number; y: number; hp: number }) => void) {
  const at = { x, y }
  for (const t of s.towers) if (t) for (const g of t.guards) if (g.hp > 0 && distanceSq(g, at) < r * r) each(g)
  for (const g of s.allies) if (g.hp > 0 && distanceSq(g, at) < r * r) each(g)
}
const art = (b: BossState, name: string) => `hero-legend-${b.id}:${name}`

function startIntro(s: SiegeScene, e: Enemy, b: BossState) {
  s.hud.bossBanner(b)
  if (b.rig) b.rig.emote(); else s.emote('taunt', e.x, e.y - 250)
  s.options.sfx.boss(b.id, true); s.options.sfx.music('boss'); s.shake(.006)
}

function enrage(s: SiegeScene, e: Enemy, b: BossState) {
  b.phase = 2; b.cast = Math.min(b.cast, 2)
  s.cameras.main.flash(reducedMotion() ? 1 : 260, 255, 190, 110); s.shake(.01)
  s.effect('fx/levelup/0', e.x, e.y - 90, .9, 3); s.options.sfx.boss(b.id)
  s.hud.toast(`${b.name} is furious!`)
}

// Called each simulation tick for a living boss, before the shared movement and combat code.
export function updateBoss(s: SiegeScene, e: Enemy, dt: number) {
  const b = e.boss!, config = bossConfig(b.id)
  if (!b.started) { b.started = true; startIntro(s, e, b) }
  b.intro = Math.max(0, b.intro - dt); b.immune = Math.max(0, b.immune - dt); b.casting = Math.max(0, b.casting - dt); b.stateTime = Math.max(0, b.stateTime - dt)
  if (b.rig && b.phase === 1 && e.hp <= e.maxHp * .5) enrage(s, e, b)
  e.speed = config.speed * s.speedScale * (b.phase === 2 ? 1.35 : 1) * (b.state === 'roll' ? 2.4 : 1) * (b.child ? 1.25 : 1)
  if (b.dash > 0) {
    b.dash -= dt; e.distance = Math.min(s.routeFor(e).length, e.distance + b.dashSpeed * dt)
    if (b.id === 900) guardsNear(s, e.x, e.y, 110, g => { g.hp = 0; s.effect('fx/splat/0', g.x, g.y - 30, .3, .8) })
  }
  if (b.rig) legendTick(s, e, b, dt); else pumpkinTick(s, e, b)
}

function legendTick(s: SiegeScene, e: Enemy, b: BossState, dt: number) {
  const rig = b.rig!, id = b.id as number
  if (b.intro <= 0 && rig.dancing) rig.cancelDance()
  const moving = b.casting <= 0 && b.intro <= 0 && !e.status.stun && !e.status.freeze && !e.status.root
  // Moves fire on a timer from legends.json; the special clip carries the release.
  b.cast -= dt
  if (b.cast <= 0 && b.intro <= 0 && b.casting <= 0 && !rig.busy && !e.status.stun && !e.status.freeze) {
    b.cast = bossConfig(id).cast * (b.phase === 2 ? .6 : 1); b.casting = s.options.assets.rig.clips.special.ms / 1000
    rig.play('special', () => legendMove(s, e, b))
  }
  if (id === 561) { e.status.burn = 0; b.trail -= dt; if (moving && b.trail <= 0) { b.trail = 1.1; s.hazards.push({ x: e.x, y: e.y, r: 62, life: 6, pulse: 0 }) } } // burning footprints
  if (!rig.busy) rig.play(moving || b.dash > 0 ? 'walk' : 'idle')
  rig.update(dt, rig.clip === 'walk' ? Math.max(.4, (b.dash > 0 ? b.dashSpeed : e.speed) / (rig.walkSpeed * 1.8)) : 1, !s.presentationFrozen && e.art.reaction.stop <= 0)
  if (!s.presentationFrozen && e.art.reaction.stop <= 0) { b.aura!.setAlpha(b.phase === 2 ? .95 : .7); s.art.set(b.aura!, s.textures.exists(b.atlas) ? `boss/${id}/aura/${Math.floor(e.art.age * 6) % 4}` : 'fx/levelup/0') }
}

// The ten boss moves, named in legends.json.
function legendMove(s: SiegeScene, e: Enemy, b: BossState) {
  if (!e.active || !e.boss) return
  const id = b.id as number, fx = (name: string, x = e.x, y = e.y - 70, seconds = 1, size = 2.2) => s.effect(s.textures.exists(b.atlas) ? art(b, name) : 'fx/levelup/0', x, y, seconds, size)
  s.options.sfx.boss(b.id)
  if (id === 561) { // Wildfire: a ring of flame scorches guards and the hero
    fx('special/0', e.x, e.y - 20, 1.2, 3)
    guardsNear(s, e.x, e.y, 290, g => { g.hp -= 70; s.effect('status/burn/0', g.x, g.y - 40, .8, 1.4) })
    for (const hero of s.heroes) if (hero.alive && distanceSq(e, hero) < 290 ** 2) hero.hurt(22, e)
  } else if (id === 900) { b.dash = .8; b.dashSpeed = 480; fx('ultimate/0', e.x, e.y - 40, .9, 1.6) } // Hell Ride
  else if (id === 942) { s.missTime = 4; fx('ultimate/0', e.x, e.y - 100, 1.4, 3); s.warp(); s.hud.toast('The Scream! Your towers will miss half their shots.') }
  else if (id === 1002) { // Rise Again
    const back = s.fallen.splice(-3)
    back.forEach((f, i) => s.schedule.push({ time: s.clock + .15 + i * .3, kind: f.kind, path: 0, route: f.path, wave: e.wave, distance: Math.max(0, e.distance - 30 - i * 24), risen: true }))
    s.schedule.sort((p, q) => p.time - q.time); fx('ultimate/0', e.x, e.y - 20, 1.2, 2.4)
    if (back.length) s.hud.toast('Brainz raises the fallen!')
  } else if (id === 1481) { // Frog Leap
    b.dash = .7; b.dashSpeed = 520; for (const key of ['slow', 'freeze', 'root', 'stun', 'wrap', 'confuse'] as const) e.status[key] = 0
    fx('ultimate/0', e.x, e.y - 10, .9, 1.7)
  } else if (id === 1514) { // Final Panel
    for (const t of s.towers) if (t) t.stun = Math.max(t.stun, 3)
    s.effect(s.textures.exists(b.atlas) ? art(b, 'ultimate/0') : 'fx/levelup/0', 960, 540, 1.1, 4.6); s.shake(.008); s.hud.toast('Final Panel! Time stops for your towers.')
  } else if (id === 1667) { // Sanctuary
    let shielded = 0
    for (const o of s.enemies) if (o.active && !o.returning && o !== e && distanceSq(o, e) < 300 ** 2) { o.shield = 5; if (shielded++ < 8) s.effect('fx/levelup/0', o.x, o.y - 70, .8, 1.2) }
    fx('special/0', e.x, e.y - 130, 1.2, 3.2)
  } else if (id === 1798) { b.blocks = 5; fx('special/0', e.x, e.y - 90, 1.4, 2.2); s.hud.toast('Testudo! The next five hits are blocked.') } // Testudo
  else if (id === 1881) { // Golden Touch
    const free = s.towers.filter(t => t && !t.gold)
    for (let i = 0; i < 2 && free.length; i++) { const t = free.splice(Math.floor(s.random() * free.length), 1)[0]!; t.stun = 5; t.gold = 5; s.effect(s.textures.exists(b.atlas) ? art(b, 'special/0') : 'fx/levelup/0', t.x, t.y - 100, 1.2, 1.4) }
    s.hud.toast('Golden Touch! Two towers are silenced.')
  } else if (id === 1884) { // Pact
    // The first Pact takes three jars; beating Lil' Devil breaks the bargain and returns them.
    if (!b.stolen) { b.stolen = Math.max(0, Math.min(3, s.jars - 1)); s.jarsLost += b.stolen; s.jars -= b.stolen; if (b.stolen) haptic('jar'); s.effect('ui/jar', e.x, e.y - 90, 1.2, .7, 'jar', e.x + 150, e.y - 170) }
    for (let i = 0; i < 5; i++) s.schedule.push({ time: s.clock + .1 + i * .15, kind: 'bat', path: 0, route: e.path, wave: e.wave, distance: Math.max(0, e.distance + 20 + i * 30), risen: true })
    s.schedule.sort((p, q) => p.time - q.time); fx('ultimate/0', e.x, e.y - 60, 1.6, 1.8); s.hud.toast(b.stolen ? 'The Pact! Imps pour out. Beat Lil’ Devil to win your jars back.' : 'The Pact! Imps pour out.')
  }
}

function pumpkinTick(s: SiegeScene, e: Enemy, b: BossState) {
  const route = s.routeFor(e)
  if (b.state === 'walk' && s.clock >= b.roll && b.intro <= 0 && !b.split) { b.state = 'roll'; b.stateTime = 2.4; b.roll = s.clock + 9; s.options.sfx.play('hit') }
  if (b.state === 'roll' && b.stateTime <= 0) b.state = 'walk'
  if (b.state === 'roll') guardsNear(s, e.x, e.y, 95, g => { g.hp = 0; s.effect('fx/splat/0', g.x, g.y - 30, .3, .9); s.shake(.004) }) // flattens guards
  if (!b.child && !b.split && e.hp <= e.maxHp * .5 && b.intro <= 0) { b.split = true; b.state = 'split'; b.stateTime = 1.3; b.immune = 1.3; b.casting = 1.3; s.hud.toast('The Great Pumpkin splits in three!') }
  if (b.state === 'split' && b.stateTime <= 0) splitPumpkin(s, e, b)
  // Whichever half of the Pumpkin reaches the last stretch first calls the final wave, once for the whole family.
  if (!b.shared.summoned && b.state === 'walk' && e.distance > route.length * .68) { b.shared.summoned = true; b.state = 'summon'; b.stateTime = 1.4; b.casting = 1.4; s.options.sfx.boss(b.id); s.hud.toast('The Great Pumpkin calls a last wave!') }
  if (b.state === 'summon' && b.stateTime <= 0) {
    b.state = 'walk'
    for (let i = 0; i < 8; i++) s.schedule.push({ time: s.clock + .1 + i * .25, kind: i % 4 === 3 ? 'ghost' : 'treater', path: 0, route: e.path, wave: e.wave, distance: Math.min(route.length - 160, e.distance + 120 + i * 45), risen: true })
    s.schedule.sort((p, q) => p.time - q.time); s.effect('fx/levelup/0', e.x, e.y - 100, 1, 3)
  }
  const frame = b.state === 'roll' ? `roll/${Math.floor(s.clock * 14) % 6}` : b.state === 'summon' ? `summon/${Math.min(3, Math.floor((1.4 - b.stateTime) / 1.4 * 4))}` : b.state === 'split' ? `split/${Math.min(5, Math.floor((1.3 - b.stateTime) / 1.3 * 6))}` : e.hit > 0 ? 'hurt' : `walk/${Math.floor(e.art.walkAge * 7) % 6}`
  if (!s.presentationFrozen && e.art.reaction.stop <= 0) s.art.set(b.sprite!, s.textures.exists('boss') ? `boss/pumpkin/${frame}` : `enemy/pumpkin/walk/${Math.floor(e.art.walkAge * 7) % 6}`)
}

function splitPumpkin(s: SiegeScene, e: Enemy, b: BossState) {
  b.state = 'walk'; b.child = true; b.casting = 0
  const hp = Math.max(1, e.hp / 3), at = e.distance
  e.hp = hp; e.maxHp = hp; e.jars = Math.ceil(e.jars / 2); b.scale = .6; b.sprite!.setScale(s.textures.exists('boss') ? .6 : 1.8)
  let made = 0
  for (const other of s.enemies) if (made < 2 && !other.active) { setup(s, other, { id: 'pumpkin' }, e.wave, hp, Math.max(0, at + (made ? 55 : -55)), { ...b, holder: null }); made++ }
  s.effect('fx/poof/0', e.x, e.y - 60, .6, 3); s.shake(.008)
}

// Damage the boss absorbs before it reaches the shared damage code: Testudo blocks and the split's grace period.
export function bossAbsorbs(_s: SiegeScene, e: Enemy, hit: boolean): boolean {
  const b = e.boss!
  if (b.immune > 0) return true
  // Only a real hit spends one of Testudo's five blocks; burning and poison ticks pass the shield.
  if (hit && b.blocks > 0) { b.blocks--; return true }
  return false
}
// Hellfire Skull rises once.
export function bossRevives(s: SiegeScene, e: Enemy): boolean {
  const b = e.boss!
  if (b.id !== 900 || b.revived) return false
  b.revived = true; e.hp = e.maxHp * .45; b.cast = 1.2; b.dash = 0
  s.effect('status/burn/0', e.x, e.y - 90, 1.2, 4); s.shake(.01); s.hud.toast('Hellfire Skull rises again!')
  return true
}

export function drawBoss(s: SiegeScene, e: Enemy) {
  const b = e.boss!, holder = b.holder
  if (!holder) return
  const route = s.routeFor(e), point = route.points[Math.min(route.points.length - 1, Math.floor(e.distance / route.length * (route.points.length - 1)) + 1)]
  const left = point.x < e.x - .5 ? true : point.x > e.x + .5 ? false : null
  const v = e.art.reaction, motion = !reducedMotion(), spring = motion ? (v.life / .28) ** 2 * Math.cos((.28 - v.life) * 16) : 0
  if (b.rig) { if (left !== null) b.rig.facing = left ? -1 : 1 }
  else if (b.sprite) { if (left !== null) b.sprite.setFlipX(left); if (v.flash > 0) b.sprite.setTintFill(0xffffff); else if (e.gold > 0) b.sprite.setTint(0xffd45e); else b.sprite.clearTint() }
  const bounce = b.sprite && b.state !== 'roll' && !e.status.stun && !e.status.freeze && !reducedMotion() && !s.settings.lite && s.quality.tier < 2 ? Math.abs(Math.sin(e.art.walkAge * 7)) * 6 : 0
  const squash = 1 - .06 * Math.max(0, spring)
  holder.setPosition((v.stop > 0 ? v.atX : e.x) + v.x * spring, (v.stop > 0 ? v.atY : e.y) + v.y * spring - bounce).setScale(2 - squash, squash).setDepth(e.y + 30).setVisible(true).setAlpha(e.shield > 0 ? .8 : 1)
}

// The big finish: the boss falls, candy pours out and the screen shakes.
export function bossDeath(s: SiegeScene, e: Enemy) {
  const b = e.boss!, last = !s.enemies.some(o => o !== e && o.active && o.boss && o.boss.id === b.id), holder = b.holder
  const drop = last && s.bossOwned.has(b.atlas) ? b.atlas : ''
  if (holder) {
    if (b.rig) { b.rig.cancelDance(); b.rig.play('faint'); s.corpses.push({ holder, rig: b.rig, life: 1.8, atlas: drop }) }
    else { s.effect(s.textures.exists('boss') ? 'boss:boss/pumpkin/die/0' : 'enemy/pumpkin/die/0', e.x, e.y - 70 * b.scale, 1.2, b.scale * 1.1); holder.destroy(); s.corpses.push({ holder: null, life: 1.6, atlas: drop }) }
    b.holder = null
  }
  const count = last ? (s.settings.lite ? 14 : 30) : (s.settings.lite ? 4 : 8)
  for (let i = 0; i < count; i++) { const coin = i % 3 === 0; s.effect(coin ? 'fx/coin' : 'fx/candy-burst/0', e.x + (s.visualRandom() - .5) * 220, e.y - 120 - s.visualRandom() * 90, .7 + i * .035, coin ? .3 : .9, coin ? 'coin' : 'burst', 261, 82) }
  s.shake(last ? .014 : .007)
  if (last) {
    haptic('boss')
    s.options.sfx.music('level')
    s.bossesDefeated.push(String(b.id))
    s.hud.banner(`${b.name.toUpperCase()}  ·  DEFEATED`); s.options.sfx.play('candy-cascade')
  }
  if (b.stolen) { s.jars = Math.min(20, s.jars + b.stolen); s.hud.toast('The Pact is broken! Your jars come home.') }
  e.boss = undefined
}
// Boss art is dropped once its corpse is gone; a texture cannot be freed while anything still draws it.
export function updateCorpses(s: SiegeScene, dt: number) {
  for (let i = s.corpses.length - 1; i >= 0; i--) {
    const c = s.corpses[i]; c.life -= dt
    if (c.rig) { c.rig.update(dt); c.holder?.setAlpha(Math.min(1, c.life / .6)) }
    if (c.flee && c.holder) {
      const t = 1 - c.life / .75, run = Math.max(0, (t - .27) / .73)
      c.holder.setPosition(c.flee.x + c.flee.dx * run, c.flee.y + c.flee.dy * run).setAlpha(Math.min(1, c.life / .2))
    }
    if (c.life > 0) continue
    c.holder?.destroy(); s.corpses.splice(i, 1)
    if (c.atlas && !s.enemies.some(e => e.active && e.boss?.atlas === c.atlas) && !s.corpses.some(other => other.atlas === c.atlas)) { s.art.removeAtlas(c.atlas); s.bossArt.delete(c.atlas); s.bossOwned.delete(c.atlas) }
  }
}
// A boss leaves play without dying (it reached the porch): free its visuals.
export function releaseBoss(s: SiegeScene, e: Enemy) {
  const b = e.boss
  if (!b) return
  b.holder?.destroy(); b.holder = null
  if (s.bossOwned.has(b.atlas) && !s.enemies.some(o => o !== e && o.active && o.boss && o.boss.id === b.id) && !s.corpses.some(c => c.atlas === b.atlas)) { s.art.removeAtlas(b.atlas); s.bossArt.delete(b.atlas); s.bossOwned.delete(b.atlas) }
  e.boss = undefined
}
