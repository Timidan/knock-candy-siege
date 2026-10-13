import type { Hero } from './Hero'
import type { Enemy } from '../world'
import { distanceSq } from '../world'
import type { Point } from '../data/config'
import { WEAPONS } from '../data/kits'

// The ten hand-made kits from legends.json. Each legend's art lives in its own hero atlas (`hero-legend-<id>`), so effects are named from there.
const frame = (h: Hero, name: string) => `hero-${h.kit.costume}:${name}`
const fx = (h: Hero, name: string, at: Point = h, seconds = .8, size = 1) => h.scene.effect(frame(h, name), at.x, at.y - 50, seconds, size)
const clamp = (p: Point): Point => ({ x: Math.max(60, Math.min(1850, p.x)), y: Math.max(180, Math.min(885, p.y)) })

export function legendAttack(h: Hero, target: Enemy) {
  const s = h.scene, k = h.kit, id = k.id, talent = h.has('weapon'), range = WEAPONS[k.weapon].range, damage = WEAPONS[k.weapon].damage * h.damageScale * (talent ? 1.25 : 1)
  const shoot = (e: Enemy, name: string, magic: boolean, rider: (t: Enemy) => void, duration = .26, arc = 12, splash = 0) =>
    s.fire(h.x, h.y - 55, e, damage, 'hero', splash, { frame: frame(h, name), duration, arc, onHit: t => { h.hitEnemy(t, damage, magic, true); if (t.active) rider(t) } })
  if (id === 561) shoot(target, 'wpn/proj', true, t => h.dot(t, 'burn', talent ? 6 : 3), .5, 110, 80) // Fireball
  else if (id === 900 || id === 1514) { // Chain of Flames and Ink Slash sweep everything around the hero
    fx(h, 'wpn/hit/0', h, .45, id === 900 ? 3.2 : 4)
    for (const e of h.near(range * (talent ? 1.25 : 1)).filter(e => e.visible)) { h.hitEnemy(e, damage, false, true); fx(h, 'wpn/hit/0', e, .3, .8); if (id === 900) h.dot(e, 'burn', 2) }
  } else if (id === 942 || id === 1798) { // Echo and Spear pierce a whole line
    const end = { x: h.x + (target.x - h.x) * 1.5, y: h.y + (target.y - h.y) * 1.5 }, flight = s.effect(frame(h, 'wpn/proj'), h.x, h.y - 45, .55, id === 942 ? 1.8 : 1.4, 'travel', end.x, end.y - 45)
    if (flight) flight.angle = Math.atan2(target.y - h.y, target.x - h.x)
    for (const e of h.lineTargets(target, range, id === 942 ? 80 : 55)) h.hitEnemy(e, damage, id === 942, true)
  } else if (id === 1002) shoot(target, 'wpn/proj', false, t => { s.status(t, 'slow', talent ? 4 : 2.5); t.slowPower = .45 }, .45, 110) // Brain Toss
  else if (id === 1481) { s.spriteBeam(frame(h, 'wpn/proj'), h, target, .25, 22); h.hitEnemy(target, damage, false, true); if (target.active) h.push(target, talent ? 140 : 90) } // Tongue Lash
  else if (id === 1667) shoot(target, 'wpn/proj', true, () => {}, .2) // Holy Bolt: magic, so armour is ignored
  else if (id === 1881) shoot(target, 'wpn/proj', false, t => { // Gold Flick bounces on
    for (const next of h.near(200, t).filter(e => e !== t && e.visible).slice(0, talent ? 3 : 2)) { fx(h, 'wpn/hit/0', next, .3, .7); h.hitEnemy(next, damage * .7, false, true) }
  }, .18)
  else { const targets = h.near(range).filter(e => e.visible); for (let i = 0; i < 3; i++) shoot(targets[i] ?? target, 'wpn/proj', true, () => {}, .2 + i * .06) } // Trident: three bolts
}

export function legendSpecial(h: Hero, enemies: Enemy[], talent: boolean) {
  const s = h.scene, id = h.kit.id, target = enemies[0]
  if (id === 561) { fx(h, 'special/0', h, 1.1, 1.8); for (const e of h.near(300)) { h.hitEnemy(e, 70, true); h.dot(e, 'burn', talent ? 7 : 4) } } // Flare Up
  else if (id === 900) { h.untargetable = talent ? 6 : 4; fx(h, 'special/0', h, h.untargetable, 1.4) } // Bone Shield blocks every hit
  else if (id === 942) { // Existential Dread: a wide cone of fear
    fx(h, 'special/0', { x: h.x + h.rig.facing * 120, y: h.y }, 1, 2.2)
    for (const e of h.lineTargets(target ?? { x: h.x + h.rig.facing * 200, y: h.y }, 650, 280)) s.status(e, 'fear', talent ? 5 : 3)
  } else if (id === 1002) { // Shamble: two zombie Chogs rise and fight
    for (let i = 0; i < 2; i++) { const at = s.nearestPath(h.x + (i ? 60 : -60), h.y); s.summon(at.x, at.y, 0x9be28a, talent ? 22 : 15, 150, 20) }
    fx(h, 'special/0', h, .9, 1.4)
  } else if (id === 1481) { fx(h, 'special/0', h, 1.4, 2); for (const e of h.near(330)) { s.status(e, 'slow', talent ? 7 : 5); e.slowPower = .2 } } // Feels Bad: a crawl
  else if (id === 1514) { // Speed Lines: blink to a spot, slashing everything on the way
    const to = clamp(target ? { x: target.x + (h.x < target.x ? -70 : 70), y: target.y + 40 } : { x: h.x + h.rig.facing * 260, y: h.y })
    const length = Math.hypot(to.x - h.x, to.y - h.y)
    fx(h, 'special/0', { x: (h.x + to.x) / 2, y: (h.y + to.y) / 2 }, .8, 1.8)
    for (const e of h.lineTargets(to, length + 40, 90)) h.hitEnemy(e, 90, true)
    h.x = to.x; h.y = to.y; h.target = { x: h.x, y: h.y }
  } else if (id === 1667) { // Halo: heal the hero and every guard nearby
    fx(h, 'special/0', h, 1.2, 2); h.heal(h.maxHp * (talent ? .6 : .4))
    for (const tower of s.towers) if (tower) for (const g of tower.guards) if (distanceSq(g, h) < 360 ** 2) { g.hp = Math.min(g.maxHp, g.hp + 70); s.effect('fx/heal/0', g.x, g.y - 35, .6, .7) }
    for (const a of s.allies) if (distanceSq(a, h) < 360 ** 2) a.hp = Math.min(a.maxHp, a.hp + 70)
  } else if (id === 1798) { const spot = s.nearestPath(target?.x ?? h.x, target?.y ?? h.y); s.wall(spot.x, spot.y, talent ? 6 : 4, frame(h, 'special/3')) } // Shield Wall
  else if (id === 1881) { // Golden Touch: frozen for 3 seconds, then triple candy
    const victim = enemies.slice().sort((a, b) => b.hp - a.hp)[0]
    if (victim) { if (!victim.gold) victim.candy *= 3; s.status(victim, 'freeze', talent ? 4 : 3); victim.gold = talent ? 4 : 3; fx(h, 'special/0', victim, 1, 1.4) }
  } else for (const e of enemies.slice().sort((a, b) => b.hp - a.hp).slice(0, talent ? 5 : 3)) { fx(h, 'special/0', e, .8, 1.3); h.hitEnemy(e, 110, true) } // Imp Swarm
}

export function legendUltimate(h: Hero, enemies: Enemy[], talent: boolean) {
  const s = h.scene, id = h.kit.id, power = talent ? 1.35 : 1, lead = enemies[0], nobody = { x: 0, y: 0 }
  if (id === 561) { // Wildfire: a long stretch of road ablaze
    const route = lead ? s.routeFor(lead) : s.routes[0], from = lead ? lead.distance : route.nearest(h.x, h.y).distance
    for (let i = 0; i < 6; i++) h.zone('blaze', route.at(Math.min(route.length, Math.max(0, from + i * 130 - 130)), { ...nobody }), 115, talent ? 9 : 6)
    fx(h, 'ultimate/0', route.at(Math.min(route.length, from + 250), { ...nobody }), 1.6, 2.4)
  } else if (id === 900) { // Hell Ride: charge down the road in a blaze
    const route = lead ? s.routeFor(lead) : s.routes[0], from = route.nearest(h.x, h.y).distance, to = Math.min(route.length - 120, from + 950)
    const start = route.at(from, { ...nobody }), end = route.at(to, { ...nobody })
    s.effect(frame(h, 'ultimate/0'), start.x, start.y - 40, 1.1, 1.8, 'travel', end.x, end.y - 40)
    for (const e of s.enemies) if (e.active && !e.returning && !e.route && s.routeFor(e) === route && e.distance >= from - 60 && e.distance <= to + 60) { h.hitEnemy(e, 150 * power, true); h.dot(e, 'burn', 4) }
    h.x = end.x; h.y = end.y + 40; h.target = { x: h.x, y: h.y }
  } else if (id === 942) { s.warp(); fx(h, 'ultimate/0', { x: 960, y: 590 }, 1.8, 3); for (const e of enemies) s.status(e, 'fear', talent ? 5 : 3) } // The Scream: everyone flees
  else if (id === 1002) { // Rise Again: the last five fallen enemies fight on your side
    const back = s.fallen.splice(-5)
    for (let i = 0; i < Math.max(3, back.length); i++) { const at = s.nearestPath(h.x + (i - 2) * 50, h.y); s.summon(at.x, at.y, 0xb59cff, talent ? 20 : 14, 130, 24) }
    fx(h, 'ultimate/0', h, 1.6, 2.2)
  } else if (id === 1481) { // Rare Pepe: golden frogs rain down, each stunning where it lands
    fx(h, 'ultimate/0', { x: 960, y: 300 }, 1.4, 3)
    enemies.slice(0, 10).forEach((e, i) => s.after(i * .09, () => { if (!e.active) return; fx(h, 'ultimate/1', e, .8, 1.2); h.hitEnemy(e, 70 * power, true); s.status(e, 'stun', 2.5) }))
  } else if (id === 1514) { // Final Panel: time stops, then one huge slash
    for (const e of enemies) s.status(e, 'stun', 2.4)
    fx(h, 'ultimate/0', { x: 960, y: 540 }, 1.6, 4.4)
    s.after(1.1, () => { for (const e of s.enemies) if (e.active && !e.returning) h.hitEnemy(e, 260 * power, true); s.shake(.012) })
  } else if (id === 1667) enemies.slice(0, 12).forEach((e, i) => s.after(i * .08, () => { if (!e.active) return; fx(h, 'ultimate/0', e, .9, 1.6); h.hitEnemy(e, 120 * power, true) })) // Judgement
  else if (id === 1798) { // Phalanx: a volley of spears on the busiest stretch of road
    const crowd = enemies.reduce((best, e) => { const n = enemies.filter(o => distanceSq(o, e) < 220 ** 2).length; return n > best.n ? { e, n } : best }, { e: lead, n: -1 }).e
    const near = crowd ? enemies.filter(o => distanceSq(o, crowd) < 260 ** 2) : []
    for (let i = 0; i < 12 && near.length; i++) s.fire(near[i % near.length].x + (s.random() - .5) * 200, -60, near[i % near.length], 70 * power, 'hero', 90, { frame: frame(h, 'wpn/proj'), duration: .5 + i * .05, arc: 0, onHit: t => h.hitEnemy(t, 70 * power, false, true) })
  } else if (id === 1881) { // Midas Rain: gold everywhere, and candy for every hit
    fx(h, 'ultimate/0', { x: 960, y: 480 }, 1.8, 3.6)
    for (const e of enemies) { h.hitEnemy(e, 85 * power, true); s.income(3); s.effect('fx/coin', e.x, e.y - 60, .7, .25, 'coin', 261, 82) }
  } else { h.devil = talent ? 12 : 8; s.jars = Math.max(1, s.jars - 1); fx(h, 'ultimate/0', h, 1.4, 2.2); s.hud.toast('Deal with the Devil! Double damage, for one jar.') } // Deal With the Devil
}
