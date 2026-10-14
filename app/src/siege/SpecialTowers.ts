import type { SiegeScene } from './SiegeScene'
import type { Enemy, Tower } from './world'
import { distanceSq } from './world'
import { ENEMIES, towerStats } from './data/config'

// Return undefined for classic towers so their branches keep their existing attack path.
export function specialTowerAttack(s: SiegeScene, t: Tower, target: Enemy, damage: number): boolean | undefined {
  const c = towerStats(t)
  if (t.kind === 'roost') {
    if (s.projectiles.filter(p => !p.active).length < 3) return false
    const flyers = [target, ...s.enemies.filter(e => e !== target && e.active && e.visible && !e.returning && !e.status.charm && ENEMIES[e.kind].flying && distanceSq(t, e) <= c.range ** 2)]
    for (let i = 0; i < 3; i++) s.fire(t.x + (i - 1) * 18, t.y - 130, flyers[i % flyers.length], damage / 3, t.kind, 0, {
      frame: 'unit/bat/0', duration: .35 + i * .12, arc: 35 + i * 16,
      onHit: e => { if (ENEMIES[e.kind].flying) s.damage(e, damage / 3, 'physical') },
    })
    return true
  }
  if (t.kind === 'cauldron' || t.kind === 'catapult') {
    const potion = t.kind === 'cauldron', name = potion ? 'potion' : 'candycorn'
    return s.fire(t.x, t.y - 130, target, damage, t.kind, c.splash, {
      frame: `proj/${name}`, duration: potion ? .55 : .95, arc: potion ? 130 : 260,
      onHit: e => {
        if (ENEMIES[e.kind].flying) return
        if (s.damage(e, damage, potion ? 'magic' : 'physical') && potion) {
          s.status(e, 'slow', 2.5); e.slowPower = .6; s.status(e, 'poison', 3 + t.level * .5)
        }
      },
      // Its splash sounds once when it lands, as 'impact-splash' (SiegeScene.updateProjectiles).
      after: () => { s.effect(`fx/${name}/0`, target.x, target.y - 35, .7, c.splash / 65) },
    })
  }
  if (t.kind === 'lighthouse') {
    const heading = Math.atan2(target.y - t.y, target.x - t.x), struck = new Map<Enemy, number>()
    // Nine short beam slices sweep a 75-degree arc. Each marcher is hit once per sweep.
    for (let i = 0; i < 9; i++) s.after(i * .09, () => {
      if (!t.image.active || t.stun) return
      const angle = heading - .65 + i * .1625, end = { x: t.x + Math.cos(angle) * c.range, y: t.y + Math.sin(angle) * c.range }
      s.spriteBeam('fx/lighthouse-beam', t, end, .16, c.range * .32)
      for (const e of s.enemies) if (e.active && !e.returning && !e.status.charm && distanceSq(t, e) <= c.range ** 2) {
        const delta = Math.atan2(Math.sin(Math.atan2(e.y - t.y, e.x - t.x) - angle), Math.cos(Math.atan2(e.y - t.y, e.x - t.x) - angle))
        if (Math.abs(delta) > .19 || struck.get(e) === e.generation) continue
        struck.set(e, e.generation); s.status(e, 'reveal', 4); e.visible = true
        s.status(e, 'fear', .55 + t.level * .2); s.damage(e, damage, 'magic')
      }
    })
    return true
  }
  if (t.kind === 'organ') {
    s.effect('fx/soundwave/0', t.x, t.y - 45, .8, c.range / 75)
    for (const e of s.enemies) if (e.active && e.visible && !e.returning && !e.status.charm && distanceSq(t, e) <= c.range ** 2) {
      if (!s.damage(e, damage, 'magic') || !e.active || e.mods.includes('slippery')) continue
      e.distance = Math.max(0, e.distance - (50 + t.level * 20) * (e.boss ? .2 : 1)); s.routeFor(e).at(e.distance, e)
    }
    return true
  }
}
