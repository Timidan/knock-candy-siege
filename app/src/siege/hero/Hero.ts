import type { SiegeScene } from '../SiegeScene'
import type { Enemy, Tower } from '../world'
import { distanceSq, reaction } from '../world'
import type { Point, Status, TrapKind } from '../data/config'
import { ENEMIES, TRAPS } from '../data/config'
import { resolveKit, WEAPONS, SPECIAL_COOLDOWNS } from '../data/kits'
import type { Kit } from '../data/kits'
import { talentChoices } from '../data/talents'
import { Rig } from './Rig'
import { reducedMotion } from '../data/save'
import { legendAttack, legendSpecial, legendUltimate } from './Legend'

type Zone = Point & { kind: 'rainbow' | 'fire' | 'peel' | 'poison' | 'blaze'; radius: number; life: number; pulse: number }
export class Hero {
  kit: Kit
  rig: Rig
  x: number
  y: number
  target: Point
  level: number
  xp = 0
  hp: number
  maxHp: number
  cooldown = 0
  ability = 0
  respawn = 0
  hit = 0
  reaction = reaction()
  private shieldPopAt = 0
  // Bone Shield already uses untargetable; this timestamp only identifies its artwork.
  boneShieldUntil = 0
  fear = 0
  slow = 0
  charge = 0
  dealt = 0
  attackCount = 0
  specials = 0
  ultimates = 0
  revives = 0
  talents = new Set<string>()
  talentLevels: number[] = []
  private offered = new Set<number>()
  private frogUsed = false
  private skullUsed = false
  private shield = 0
  untargetable = 0
  devil = 0
  private scare = 0
  private pep = 0
  private smoke = 0
  private streak = 0
  private lastKill = -99
  private waveBuff = ''
  private zones: Zone[] = []
  private trail = 0
  private oddity = 0
  scene: SiegeScene
  constructor(scene: SiegeScene, spawn: Point) {
    this.scene = scene
    const a = scene.options.assets
    this.kit = resolveKit(a.kits, a.traits, a.chogs, scene.options.hero, scene.options.home)
    this.level = this.kit.level
    this.maxHp = (180 + this.level * 30) * (this.kit.passive === 'tough' ? 1.2 : 1)
    this.hp = this.maxHp
    this.x = spawn.x; this.y = spawn.y + 65; this.target = { x: this.x, y: this.y }
    this.rig = new Rig(scene, scene.art, a, this.kit, event => {
      if (event === 'step') scene.options.sfx.play('hero-step')
      if (event === 'land') { scene.options.sfx.play('hit'); scene.effect('fx/poof/0', this.x, this.y, .35, .7) }
    }, scene.options.costume || this.kit.costume)
    if (this.kit.trinket === 'lucky-coin') scene.candy += 50
    this.offerTalents()
  }
  has(slot: 'weapon' | 'special' | 'ultimate' | 'passive' | 'headgear') { return this.talents.has(`${slot}:${this.kit[slot]}`) }
  get spellFactor() { return (this.kit.headgear === 'spellcraft' ? this.has('headgear') ? .7 : .8 : 1) * (this.scene.crew === 2 ? .85 : 1) }
  get abilityTotal() { return SPECIAL_COOLDOWNS[this.kit.special] * this.spellFactor * (this.talents.has('generic:cooldown') ? .8 : 1) }
  get alive() { return this.hp > 0 }
  get damageScale() { return (1 + (this.level - 1) * .12) * (this.talents.has('generic:power') ? 1.15 : 1) * (this.waveBuff === 'power' ? 1.2 : 1) * (this.devil > 0 ? 2 : 1) }
  get choices() { return this.talentLevels.length ? talentChoices(this.kit, this.talentLevels[0]) : null }
  get labels() {
    return [...(this.kit.undead ? ['Undead'] : []), ...(this.kit.toxic ? ['Toxic attacks'] : []), ...(this.kit.home ? ['Home +1'] : []), ...(this.shield ? [`Shield ×${this.shield}`] : []), ...(this.streak ? [`Pump ×${this.streak}`] : []), ...(this.waveBuff ? [`Wave: ${this.waveBuff}`] : [])].join(' · ')
  }
  trapCost(kind: TrapKind) { return Math.ceil(TRAPS[kind].cost * (this.kit.headgear === 'prankster' ? this.has('headgear') ? .65 : .8 : 1)) }
  private offerTalents() {
    for (let level = 2; level <= Math.min(5, this.level); level++) if (!this.offered.has(level)) { this.offered.add(level); this.talentLevels.push(level) }
  }
  chooseTalent(index: number) {
    const choices = this.choices
    if (!choices || !choices[index] || this.scene.paused || this.scene.ended) return
    const choice = choices[index]
    this.talents.add(choice.id); this.talentLevels.shift()
    if (choice.id === 'generic:health' || choice.id === 'passive:tough') { const extra = this.maxHp * (choice.id === 'generic:health' ? .25 : .2); this.maxHp += extra; if (this.alive) this.hp += extra }
    this.scene.effect('fx/talent/0', this.x, this.y - 50, .9, 1.3)
    this.scene.hud.toast(`${choice.name} · ${choice.effect}`); this.scene.options.sfx.play('upgrade')
  }
  onWave() {
    if (this.kit.headgear === 'bucket-shield') this.shield = this.has('headgear') ? 2 : 1
    if (this.kit.trinket === 'snack-bag') { this.scene.jars = Math.min(20, this.scene.jars + 1); this.scene.number(1, this.x, this.y - 140, 0xa4f6a4); this.scene.hud.toast('Snack Bag · +1 jar') }
    if (this.kit.skin === 'multi') { this.waveBuff = ['power', 'haste', 'guard'][Math.floor(this.scene.random() * 3)]; this.scene.hud.toast(`Multi Colored · ${this.waveBuff} this wave`) }
  }
  killIncome(amount: number) {
    let result = amount * (this.kit.passive === 'money-mouth' ? this.has('passive') ? 1.25 : 1.15 : 1)
    const lucky = (this.kit.headgear === 'degen-luck' ? this.has('headgear') ? .2 : .1 : 0) + (this.kit.skin === 'jade' ? .08 : 0)
    if (this.scene.random() < lucky) { result *= 2; this.scene.number(Math.round(result), this.x, this.y - 140, 0xffd36b) }
    return Math.round(result)
  }
  onKill(enemy: Enemy) {
    this.addCharge(2)
    this.xp++
    if (this.kit.passive === 'sweet-tooth' && distanceSq(this, enemy) < 360 ** 2) this.heal(this.has('passive') ? 16 : 8)
    if (this.kit.trinket === 'pump') { this.streak = this.scene.clock - this.lastKill < 5 ? Math.min(5, this.streak + 1) : 1; this.lastKill = this.scene.clock }
    if (this.xp >= 8 + this.level * 5 && this.level < 5) {
      this.xp = 0; this.level++; this.maxHp += 30; if (this.alive) this.hp = this.maxHp
      this.offerTalents(); this.scene.effect('fx/talent/0', this.x, this.y - 50, 1, 1.4); this.scene.hud.toast(`Hero level ${this.level} · choose a talent`)
    }
  }
  addCharge(amount: number) { if (this.alive) this.charge = Math.min(100, this.charge + amount * (this.talents.has('generic:charge') ? 1.25 : 1)) }
  towerBuff(tower: Tower) {
    // Deal With the Devil doubles every tower's damage too.
    const devil = this.devil > 0 ? 1 : 0
    if (!this.alive || distanceSq(this, tower) > 320 ** 2) return 1 + devil
    return 1 + devil + (this.kit.headgear === 'royal' ? this.has('headgear') ? .25 : .15 : 0) + (this.kit.passive === 'cheerful' ? this.has('passive') ? .1 : .05 : 0)
  }
  towerSpeed(tower: Tower) { return this.alive && this.pep > 0 && distanceSq(this, tower) < 440 ** 2 ? this.has('special') ? 1.5 : 1.3 : 1 }
  enemySpeed(enemy: Enemy) {
    if (!this.alive || distanceSq(this, enemy) > 190 ** 2) return 1
    return (this.kit.passive === 'pity' ? this.has('passive') ? .8 : .9 : 1) * (this.kit.trinket === 'dump' ? .85 : 1)
  }
  enemyDamage(enemy: Enemy) { return this.alive && this.kit.headgear === 'chill' && distanceSq(this, enemy) < 190 ** 2 ? this.has('headgear') ? .65 : .8 : 1 }
  heal(amount: number) { if (this.alive) { const value = Math.min(amount, this.maxHp - this.hp); this.hp += value; if (value >= 3) this.scene.number(Math.ceil(value), this.x, this.y - 130, 0x9afaad) } }
  hurt(amount: number, from?: Point) {
    if (!this.alive) return
    const s = this.scene
    if (this.untargetable > 0) {
      if (amount >= 1 && s.clock < this.boneShieldUntil && s.presentationTime >= this.shieldPopAt) { s.shieldFeedback(this); this.shieldPopAt = s.presentationTime + .35 }
      return
    }
    if (s.crew === 1 && amount >= 1 && s.random() < .1) { s.dodgeFeedback(this); this.reaction.dodge = .26; return }
    if (this.shield && amount >= 1) { this.shield--; s.shieldFeedback(this); s.options.sfx.play('armor'); return }
    const armor = (this.kit.headgear === 'armored' ? this.has('headgear') ? .45 : .3 : 0) + (this.kit.skin === 'metal' ? .2 : 0) + (this.waveBuff === 'guard' ? .15 : 0)
    this.hp -= amount * (1 - Math.min(.65, armor))
    if (amount > 1) {
      this.hit = .16
      this.rig.hurt()
      const dx = from ? this.x - from.x : -this.rig.facing, dy = from ? this.y - from.y : 0, length = Math.hypot(dx, dy) || 1
      const weight = 6 + Math.min(20, amount * .45)
      Object.assign(this.reaction, { x: dx / length * weight, y: dy / length * weight, atX: this.x, atY: this.y, life: .28, stop: reducedMotion() ? 0 : amount >= 35 ? .04 : 0, flash: .1 })
      if (this.kit.trinket === 'smoke-puff' && this.smoke <= 0) {
        this.smoke = 7
        s.effect('fx/poof/0', this.x, this.y - 50, 1.4, 2)
        for (const e of this.near(180)) s.status(e, 'confuse', 2)
      }
    }
    if (this.hp <= 0) {
      this.hp = 0; this.rig.play('faint')
      if (this.kit.trinket === 'lucky-frog' && !this.frogUsed) { this.frogUsed = true; this.revive(.6) }
      else if (this.kit.undead && !this.skullUsed) { this.skullUsed = true; this.respawn = 1.5; s.hud.toast('Undead · rising again') }
      else { this.respawn = 12; s.hud.toast('Hero resting · back in 12 seconds') }
    }
  }
  private revive(fraction = 1) { this.hp = this.maxHp * fraction; this.revives++; this.rig.play('revive'); this.scene.effect('fx/revive/0', this.x, this.y - 50, 1.1, 1.4); this.untargetable = 1.1 }
  update(dt: number) {
    const s = this.scene
    this.cooldown -= dt; this.ability = Math.max(0, this.ability - dt); this.hit = Math.max(0, this.hit - dt)
    this.devil = Math.max(0, this.devil - dt); this.untargetable = Math.max(0, this.untargetable - dt); this.pep = Math.max(0, this.pep - dt); this.smoke -= dt; this.oddity -= dt
    this.fear = this.kit.undead ? 0 : Math.max(0, this.fear - dt)
    this.slow = this.kit.headgear === 'chill' ? 0 : Math.max(0, this.slow - dt * (this.kit.skin === 'rare-tone' ? 1.25 : 1))
    if (s.clock - this.lastKill > 5) this.streak = 0
    this.updateZones(dt)
    if (this.scare > 0) { this.scare -= dt; if (this.scare <= 0) { this.fx('special', 'scare/0', this, 1, 1.6); for (const e of this.near(310)) s.status(e, 'stun', 2.5); if (this.has('special')) this.heal(this.maxHp * .3) } }
    if (!this.alive) { this.respawn -= dt; if (this.respawn <= 0) this.revive(); this.rig.update(dt, 1, !s.presentationFrozen); return }
    if (this.rig.dancing) { this.rig.update(dt, 1, !s.presentationFrozen); return }
    let rate = 1
    if (!this.rig.busy) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, distance = Math.hypot(dx, dy)
      if (distance > 2 && !this.fear) {
        const speed = 110 * (this.kit.headgear === 'bareheaded' ? this.has('headgear') ? 1.2 : 1.05 : 1) * (this.slow ? .65 : 1)
        const move = Math.min(speed * dt, distance)
        this.x += dx / distance * move; this.y += dy / distance * move
        this.rig.facing = dx < 0 ? -1 : dx > 0 ? 1 : this.rig.facing
        this.rig.play('walk'); rate = move / dt / this.rig.walkSpeed
        if (this.kit.passive === 'rainbow-trail') { this.trail -= dt; if (this.trail <= 0) { this.trail = .4; this.zone('rainbow', this, 75, 3) } }
      } else {
        this.rig.play('idle')
        const config = WEAPONS[this.kit.weapon], range = config.range * (this.has('weapon') && ['ball-chain', 'mascot'].includes(this.kit.weapon) ? 1.35 : 1)
        const target = s.target(this, range, 'first')
        if (target && this.cooldown <= 0 && !this.fear) {
          this.rig.facing = target.x < this.x ? -1 : 1
          const generation = target.generation
          if (this.kit.weapon === 'anime') s.effect(`hero-${this.kit.costume}:wpn/charge/0`, this.x + this.rig.facing * 28, this.y - 52, .8, 1.2)
          this.rig.play(`attack-${s.options.assets.rig.costumes[this.kit.costume].attack}`, () => this.attack(target.active && target.generation === generation ? target : s.target(this, range, 'first')))
          this.cooldown = config.interval / (1 + this.streak * .08) / (this.waveBuff === 'haste' ? 1.2 : 1) / (this.kit.weapon === 'slingshot' && this.has('weapon') ? 1.25 : 1)
        }
      }
    }
    if (this.kit.headgear === 'oddity' && this.oddity <= 0 && this.near(350).length) { this.oddity = this.has('headgear') ? 4 : 8; this.oddityEffect() }
    if (this.pep > 0 && Math.floor(s.clock * 2) !== Math.floor((s.clock - dt) * 2)) for (const t of s.towers) if (t && distanceSq(this, t) < 440 ** 2) this.fx('special', 'aura/0', { x: t.x, y: t.y - 95 }, .55, .8)
    if (this.kit.trinket === 'heart' || !this.near(150).length) this.hp = Math.min(this.maxHp, this.hp + dt * (this.kit.trinket === 'heart' ? 6 : 3))
    this.rig.update(dt, this.rig.clip === 'walk' ? rate : this.rig.clip.startsWith('attack-') ? this.attackRate() : 1, !s.presentationFrozen && this.reaction.stop <= 0)
  }
  private attackRate() {
    const duration = this.scene.options.assets.rig.clips[this.rig.clip].ms / 1000
    const interval = WEAPONS[this.kit.weapon].interval / (1 + this.streak * .08) / (this.waveBuff === 'haste' ? 1.2 : 1) / (this.kit.weapon === 'slingshot' && this.has('weapon') ? 1.25 : 1)
    return Math.max(1, duration / interval)
  }
  near(radius: number, point: Point = this) { return this.scene.enemies.filter(e => e.active && !e.returning && e.status.charm <= 0 && distanceSq(e, point) <= radius ** 2).sort((a, b) => b.distance - a.distance) }
  hitEnemy(e: Enemy, damage: number, magic = false, basic = false) {
    const s = this.scene
    let critical = false
    if (basic) {
      const chance = (this.kit.headgear === 'focus' ? this.has('headgear') ? .25 : .1 : 0) + (this.kit.trinket === 'shiv' ? .2 : 0)
      critical = this.scene.random() < chance
      if (critical) damage *= 2
    }
    const landed = s.damage(e, damage, magic ? 'magic' : this.kit.weapon === 'egg-lob' && basic ? 'egg' : 'physical', true, true, { from: this, crit: critical })
    if (basic && landed && s.textures.get(`hero-${this.kit.costume}`).has('wpn/hit/0')) s.effect(`hero-${this.kit.costume}:wpn/hit/0`, e.x, e.y - 45, .3, .7)
    if (!landed || !basic || !e.active) return
    if (this.kit.weaponMod === 'fire' || this.kit.headgear === 'hellfire') this.dot(e, 'burn', this.has('headgear') && this.kit.headgear === 'hellfire' ? 6 : 3)
    if (this.kit.toxic) this.dot(e, 'poison', 4)
    if (this.kit.passive === 'sticky') { s.status(e, 'slow', 2.2); e.slowPower = this.has('passive') ? .65 : .8 }
    if (this.kit.passive === 'honk' && this.attackCount % (this.has('passive') ? 5 : 10) === 0) { s.status(e, 'confuse', 3); s.options.sfx.play('emote') }
  }
  dot(e: Enemy, status: Status, duration: number) { this.scene.status(e, status, duration); e.heroDot = true }
  projectile(e: Enemy, damage: number, frame: string, magic = false, splash = 0, after?: () => void, duration = .26) {
    this.scene.fire(this.x, this.y - 55, e, damage, 'hero', splash, { frame: `hero-${this.kit.costume}:${frame}`, duration, arc: this.kit.weapon === 'egg-lob' || this.kit.weapon === 'junk' ? 115 : 12, onHit: target => this.hitEnemy(target, damage, magic, true), after })
  }
  private attack(target: Enemy | null) {
    if (!target || !this.alive) return
    const s = this.scene, k = this.kit, config = WEAPONS[k.weapon], damage = config.damage * this.damageScale
    this.attackCount++; s.options.sfx.play(['ray-gun', 'anime', 'scepter'].includes(k.weapon) ? 'laser' : 'throw')
    if (k.legend) { legendAttack(this, target); return }
    const weaponFx = (frame: string, point: Point, size = 1) => s.effect(`hero-${k.costume}:${frame}`, point.x, point.y - 40, .45, size)
    if (k.weapon === 'pitch-deck') {
      const targets = this.near(config.range).filter(e => e.visible).slice(0, this.has('weapon') ? 4 : 3)
      for (let i = 0; i < (this.has('weapon') ? 4 : 3); i++) this.projectile(targets[i] ?? target, damage, 'wpn/proj', false, 0, undefined, .22 + i * .07)
    } else if (k.weapon === 'scepter') {
      this.projectile(target, damage, 'wpn/proj/0', true, 0, this.has('weapon') ? () => { const next = this.near(170, target).find(e => e !== target); if (next) { this.hitEnemy(next, damage * .55, true, true); s.spriteBeam(`hero-${k.costume}:wpn/proj/1`, target, next, .25, 12) } } : undefined)
    } else if (k.weapon === 'fastball' || k.weapon === 'slingshot') {
      this.projectile(target, damage, 'wpn/proj', false, 0, () => {
        const count = k.weapon === 'fastball' ? this.has('weapon') ? 2 : 1 : k.weaponMod === 'electric' ? 1 : 0
        let from: Point = target
        for (const next of this.near(190, target).filter(e => e !== target).slice(0, count)) {
          s.spriteBeam(`hero-${k.costume}:${k.weapon === 'fastball' ? 'wpn/proj' : 'wpn/zap'}`, from, next, .2, 12)
          this.hitEnemy(next, damage * .65, k.weaponMod === 'electric', true); from = next
        }
      }, .14)
    } else if (k.weapon === 'egg-lob') this.projectile(target, damage, k.weaponMod === 'fire' ? 'wpn/proj-fire' : 'wpn/proj', false, config.splash! * (this.has('weapon') ? 1.4 : 1), undefined, .5)
    else if (k.weapon === 'junk') { const roll = Math.floor(this.scene.random() * 4); this.projectile(target, damage * (this.has('weapon') ? 1.5 : [.6, 1, 1.5, .9][roll]), `wpn/junk/${roll}`) }
    else if (k.weapon === 'blaster') {
      weaponFx('wpn/muzzle/0', { x: this.x + this.rig.facing * 28, y: this.y - 10 })
      const targets = this.lineTargets(target, config.range, this.has('weapon') ? 190 : 130)
      for (let i = 0; i < (this.has('weapon') ? 5 : 3); i++) this.projectile(targets[i % Math.max(1, targets.length)] ?? target, damage, `wpn/proj/${i % 3}`, false, 0, undefined, .16 + i * .025)
    } else if (['fan', 'ray-gun', 'anime'].includes(k.weapon)) {
      const targets = k.weapon === 'anime' ? s.enemies.filter(e => e.active && !e.returning && e.visible && e.path === target.path && e.status.charm <= 0) : this.lineTargets(target, config.range, k.weapon === 'fan' ? 100 : 55)
      if (k.weapon === 'fan') { const end = { x: this.x + (target.x - this.x) * 1.4, y: this.y + (target.y - this.y) * 1.4 }; s.effect(`hero-${k.costume}:wpn/gust/0`, this.x, this.y - 45, .55, 1.6, 'travel', end.x, end.y - 45) }
      else {
        let from: Point = this
        for (const e of targets) { s.spriteBeam(`hero-${k.costume}:wpn/beam`, from, e, .5, k.weapon === 'anime' ? 42 : 18); from = e }
        weaponFx(k.weapon === 'anime' ? 'wpn/beam-end/0' : 'wpn/muzzle/0', target)
      }
      // A full-path beam shares its energy across a dense crowd.
      for (const e of targets) { this.hitEnemy(e, damage * (k.weapon === 'anime' ? Math.min(1, 5 / targets.length) * (this.has('weapon') ? 1.4 : 1) : 1), k.weapon !== 'fan', true); if (k.weapon === 'fan') { this.push(e, 42); if (this.has('weapon')) s.status(e, 'slow', 2) }; if (k.weapon === 'ray-gun' && this.has('weapon')) s.status(e, 'mark', 2) }
    } else {
      const radius = config.range * (this.has('weapon') && k.weapon !== 'tickle' ? 1.35 : 1)
      if (k.weapon === 'mascot' && k.suit === 'toad') { const e = this.near(radius + 130)[0]; if (e) { e.distance = s.routeFor(e).nearest(this.x, this.y).distance; s.routeFor(e).at(e.distance, e) } }
      weaponFx(k.weapon === 'mascot' ? 'wpn/slam/0' : k.weapon === 'tickle' ? 'wpn/slap/0' : 'wpn/arc/0', this, k.weapon === 'mascot' ? 1.5 : 1)
      for (const e of (k.weapon === 'tickle' ? [target] : this.near(radius)).filter(e => e.visible)) {
        this.hitEnemy(e, damage, false, true)
        if (k.weapon === 'mascot') {
          weaponFx('wpn/twist/0', e, .8)
          if (k.suit === 'duck') s.status(e, 'stun', .7)
          if (k.suit === 'shark') this.dot(e, 'bleed', 3)
          if (k.suit === 'banana') this.push(e, 35)
          if (k.suit === 'dragon') this.dot(e, 'burn', 3)
          if (k.suit === 'mummy') s.status(e, 'root', 1.3)
        }
      }
      if (k.weapon === 'mascot' && k.suit === 'banana') this.zone('peel', target, 65, 5)
      if (k.weapon === 'tickle' && this.has('weapon')) this.heal(3)
    }
  }
  lineTargets(target: Point, range: number, width: number) {
    const dx = target.x - this.x, dy = target.y - this.y, length = Math.hypot(dx, dy) || 1
    return this.near(range).filter(e => { const x = e.x - this.x, y = e.y - this.y; return e.visible && (x * dx + y * dy) / length >= 0 && Math.abs(x * dy - y * dx) / length <= width })
  }
  push(e: Enemy, amount: number) { if (!e.mods.includes('slippery')) { e.distance = Math.max(0, e.distance - amount); this.scene.routeFor(e).at(e.distance, e) } }
  private fx(slot: 'special' | 'ult', frame: string, point: Point = this, duration = .8, size = 1) { return this.scene.effect(`${slot}-${slot === 'special' ? this.kit.special : this.kit.ultimate}:${frame}`, point.x, point.y - 50, duration, size) }
  abilityUse() {
    if (!this.alive || this.ability > 0 || ['spawn', 'revive', 'faint', 'special', 'ultimate'].includes(this.rig.clip) && this.rig.busy || this.scene.paused || this.scene.ended) return
    this.ability = this.abilityTotal
    this.rig.play('special', () => this.specialRelease())
  }
  private specialRelease() {
    const s = this.scene, family = this.kit.special, talent = this.has('special'), enemies = this.near(650), target = enemies[0]
    this.specials++
    s.options.sfx.ability(family)
    if (this.kit.legend) { legendSpecial(this, enemies, talent); return }
    if (family === 'laser') {
      const colors: Record<string, number> = { fire: 0xff853f, green: 0x82ef5a, cyan: 0x7deeff, purple: 0xcd8cff }
      this.fx('special', 'flare/0', { x: this.x, y: this.y - 28 })
      const hits = enemies.slice(0, this.kit.element === 'purple' ? 14 : talent ? 12 : 6)
      for (let i = 0; i < hits.length; i++) {
        const e = hits[i], from = i === 0 || talent && i === Math.ceil(hits.length / 2) ? this : hits[i - 1]
        s.spriteBeam('special-laser:beam', from, e, .65, 20, colors[this.kit.element]); this.hitEnemy(e, 75, true)
        this.fx('special', 'scorch/0', e, .55)
        if (this.kit.element === 'fire') this.dot(e, 'burn', 4)
        if (this.kit.element === 'green') this.dot(e, 'poison', 5)
        if (this.kit.element === 'cyan') s.status(e, 'freeze', 2)
      }
    } else if (family === 'target-lock') {
      for (const e of enemies.sort((a, b) => b.hp - a.hp).slice(0, talent ? 5 : 3)) { s.status(e, 'mark', 7); s.status(e, 'reveal', 7); e.visible = true; this.fx('special', 'reticle/0', e, .8); this.fx('special', 'mark', e, 7, .8) }
    } else if (family === 'deal-with-it') {
      this.fx('special', 'shades', { x: this.x, y: this.y - 30 }, 1); this.fx('special', 'shock/0', this, 1, 2.5)
      for (const e of this.near(330)) s.status(e, 'stun', talent ? 4.5 : 2.5)
    } else if (family === 'tear-flood') {
      const wave = this.fx('special', 'wave/0', this, 1.1, 2)
      if (wave && target) { wave.mode = 'travel'; wave.toX = target.x; wave.toY = target.y - 40 }
      for (const e of enemies) { this.hitEnemy(e, 32, true); s.status(e, 'slow', 5); this.push(e, talent ? 240 : 120); this.fx('special', 'splash/0', e, .5) }
    } else if (family === 'charm') {
      this.fx('special', 'hearts/0', this, 1.2, 2)
      for (const e of enemies.slice(0, talent ? 5 : 3)) { s.status(e, 'charm', 4); this.fx('special', 'mark/0', e, 4, .6) }
    } else if (family === 'play-dead') { this.untargetable = 2.5; this.scare = 2; this.fx('special', 'ghost/0', this, 2, 1.3) }
    else if (family === 'stare-down') {
      const direction = target ?? { x: this.x + this.rig.facing * 200, y: this.y }
      const fx = this.fx('special', 'cone/0', { x: this.x + this.rig.facing * 120, y: this.y }, 1, 2); if (fx) fx.angle = this.rig.facing < 0 ? Math.PI : 0
      this.fx('special', 'eyes/0', { x: this.x, y: this.y - 30 })
      for (const e of this.lineTargets(direction, 650, 280)) s.status(e, 'fear', talent ? 5 : 3)
    } else if (family === 'confetti') {
      const at = target ?? this; this.fx('special', 'bomb/0', at, .5, 1.4); this.fx('special', 'burst/0', at, 1.3, 2.4)
      for (const e of this.near(290, at)) { s.status(e, 'confuse', talent ? 7 : 4); this.hitEnemy(e, 28, true) }
    } else { this.pep = 7; this.fx('special', 'megaphone/0', this, 1.2, 1.2) }
  }
  ultimateUse() {
    if (!this.alive || this.charge < 100 || ['spawn', 'revive', 'faint', 'special', 'ultimate'].includes(this.rig.clip) && this.rig.busy || this.scene.paused || this.scene.ended) return
    this.charge = 0; this.rig.play('ultimate', () => this.ultimateRelease())
  }
  private ultimateRelease() {
    const s = this.scene, family = this.kit.ultimate, talent = this.has('ultimate'), enemies = this.near(2200), at = enemies[0] ?? this
    this.ultimates++; s.options.sfx.ability(family, true)
    s.hud.banner(s.options.assets.kits.slots.ultimate[family].name)
    s.shake(.009)
    if (this.kit.legend) { legendUltimate(this, enemies, talent); return }
    if (family === 'meteor') {
      this.fx('ult', 'meteor/0', { x: at.x, y: at.y - 220 }, .7, 2); this.fx('ult', 'impact/0', at, 1.2, 2.7)
      for (const e of this.near(390, at)) this.hitEnemy(e, 165, true)
      this.zone('fire', at, 300, talent ? 12 : 6)
    } else if (family === 'tidal') {
      const fx = this.fx('ult', 'wave/0', { x: 1750, y: 570 }, 1.8, 2.2); if (fx) { fx.mode = 'travel'; fx.toX = 100; fx.toY = 470 }
      for (const e of enemies) { this.hitEnemy(e, 90, true); this.push(e, 340); s.status(e, talent ? 'freeze' : 'slow', talent ? 2 : 4) }
    } else if (family === 'twister') {
      this.fx('ult', 'twister/0', at, 2, 2.7)
      for (const e of enemies) { if (distanceSq(e, at) < 650 ** 2) { e.distance = s.routeFor(e).nearest(at.x, at.y).distance; s.routeFor(e).at(e.distance, e); this.hitEnemy(e, 110, true); s.status(e, 'ground', 7); s.status(e, 'stun', talent ? 3 : 1.5) } }
    } else if (family === 'vanish') {
      this.fx('ult', 'smoke/0', this, 1.5, 3); this.untargetable = 3
      for (const e of enemies) { e.attack = 3; s.status(e, 'confuse', 2) }
      for (const e of enemies.slice(0, 6)) { this.fx('ult', 'slash/0', e, .8, 1.8); this.hitEnemy(e, talent ? 240 : 160, true) }
      if (enemies.length) { this.x = Math.max(60, Math.min(1850, at.x + 60)); this.y = Math.max(180, Math.min(885, at.y + 60)); this.target = { x: this.x, y: this.y } }
    } else if (family === 'arcane') {
      this.fx('ult', 'storm/0', { x: 960, y: 330 }, 2, 3)
      for (let i = 0; i < (talent ? 14 : 10) && enemies.length; i++) {
        const e = enemies[i % enemies.length]
        s.fire(960, 200, e, 75, 'hero', 0, { frame: 'ult-arcane:bolt/0', duration: .35 + i * .08, arc: 0, onHit: target => { this.hitEnemy(target, 75, true); this.fx('ult', 'hit/0', target) } })
      }
    } else if (family === 'bloom') {
      this.fx('ult', 'bloom/0', this, 2, 3); this.fx('ult', 'jar/0', s.options.assets.geometry.porch, 1.5, 1.5)
      s.jars = Math.min(20, s.jars + (talent ? 5 : 3)); s.number(talent ? 5 : 3, this.x, this.y - 160, 0x9fff9a)
      for (const e of enemies) { s.status(e, 'root', 5); this.fx('ult', 'roots/0', e, 1, .8) }
      if (talent) for (const t of s.towers) if (t) for (const g of t.guards) if (g.hp > 0) g.hp = g.maxHp
    } else if (family === 'love-bomb') {
      this.fx('ult', 'bomb/0', this, .8, 2); this.fx('ult', 'wave/0', { x: 960, y: 590 }, 1.8, 3)
      for (const e of enemies) s.status(e, 'charm', talent ? 8 : 5)
    } else if (family === 'purify') {
      this.fx('ult', 'light/0', this, 1.7, 2.3); this.fx('ult', 'ring/0', this, 1.7, 4)
      for (const e of enemies) { e.mods = []; e.armour = false; e.skill = 999; e.speed = ENEMIES[e.kind].speed; s.status(e, 'reveal', 30); e.visible = true; this.hitEnemy(e, 50, true); e.art.icons.forEach(i => i.setVisible(false)) }
      for (const tower of s.towers) if (tower) tower.stun = 0
      if (talent) this.heal(this.maxHp)
    } else if (family === 'thunder') {
      let from: Point = this
      this.fx('ult', 'bolt/0', at, 1, 2.5)
      for (const e of enemies.slice(0, talent ? 18 : 12)) { s.spriteBeam('ult-thunder:chain', from, e, .9, 22); this.fx('ult', 'hit/0', e, .7); this.hitEnemy(e, 105, true); from = e }
    } else {
      this.fx('ult', 'bomb/0', { x: at.x, y: at.y - 180 }, .65, 2); this.fx('ult', 'blast/0', at, 1.6, 3)
      for (const e of this.near(talent ? 650 : 480, at)) this.hitEnemy(e, 230, true)
    }
  }
  zone(kind: Zone['kind'], point: Point, radius: number, life: number) {
    if (this.zones.length >= 16) this.zones.shift()
    this.zones.push({ kind, x: point.x, y: point.y, radius, life, pulse: 0 })
  }
  private updateZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.life -= dt; z.pulse -= dt
      if (z.life <= 0) { this.zones.splice(i, 1); continue }
      if (z.pulse > 0) continue
      z.pulse = .5
      const name = z.kind === 'blaze' ? 'status/burn/0' : z.kind === 'fire' ? 'ult-meteor:fire/0' : z.kind === 'peel' ? `hero-${this.kit.costume}:wpn/twist/3` : z.kind === 'poison' ? 'fx/poison-cloud/0' : 'sig:sig/rainbow-barf/stream/0'
      this.scene.effect(name, z.x, z.y - 8, .6, z.kind === 'blaze' ? 1.8 : z.kind === 'fire' ? 2 : .8)
      for (const e of this.near(z.radius, z)) {
        if (z.kind === 'fire' || z.kind === 'blaze') { this.dot(e, 'burn', 1); this.hitEnemy(e, 9, true) }
        else if (z.kind === 'poison') this.dot(e, 'poison', 3)
        else if (z.kind === 'peel') { this.push(e, 20); this.scene.status(e, 'stun', .3); z.life = 0 }
        else { this.scene.status(e, 'slow', .7); this.hitEnemy(e, 5, true) }
      }
      if (z.kind === 'rainbow' && this.has('passive')) for (const t of this.scene.towers) if (t) for (const g of t.guards) if (g.hp > 0 && distanceSq(g, z) < 110 ** 2) { g.hp = Math.min(g.maxHp, g.hp + 6); this.scene.effect('fx/heal/0', g.x, g.y - 35, .5, .6) }
    }
  }
  private oddityEffect() {
    const s = this.scene, e = this.near(350)[0]
    if (!e) return
    if (this.kit.oddity === 'banana') { s.status(e, 'stun', 1.5); s.effect('trap/bowl/0', this.x, this.y, 1, .7) }
    else if (this.kit.oddity === 'mushroom') this.zone('poison', this, 160, 3)
    else if (this.kit.oddity === 'eight-ball') { const lucky = this.scene.random() < .5; if (lucky) this.heal(25); else this.hitEnemy(e, 45, true); s.number(8, this.x, this.y - 150, 0xd4a9ff) }
    else { s.spriteBeam('fx/moonbeam', this, e, .5, 12); this.hitEnemy(e, 35, true) }
  }
}
