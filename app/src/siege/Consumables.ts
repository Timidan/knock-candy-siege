import type Phaser from 'phaser'
import type { SiegeScene } from './SiegeScene'
import { CONSUMABLES, ENEMIES } from './data/config'
import type { ConsumableKind, Point } from './data/config'
import { distanceSq } from './world'

export type PlacedItem = Point & { kind: ConsumableKind; life: number; pulse: number; hp: number; image: Phaser.GameObjects.Image }
export function useConsumable(s: SiegeScene, kind: ConsumableKind, x: number, y: number, hero = s.hero) {
  const c = CONSUMABLES[kind], spot = s.nearestPath(x, y), mine = hero === s.localHero // co-op: only the sender sees their refusals
  if (s.itemCooldown[kind] > 0 || s.stock[kind] <= 0) return
  if (spot.gap > 90 || x < 50 || x > 1820 || y < 150 || y > 915) { if (mine) s.hud.toast('Aim beside the road. One is used only on a valid target.'); return }
  if (s.items.length >= 8) { if (mine) s.hud.toast('Let a few supplies finish first.'); return }
  s.stock[kind]--; s.itemCooldown[kind] = c.cooldown; s.discover([`item/${kind}`])
  // Road blockers snap onto it; the decoy stands just beside it, drawing marchers off to one side.
  const at = kind === 'candy-cane' ? spot : kind === 'scarecrow' ? { x: spot.x, y: spot.y + (spot.y > 820 ? -52 : 52) } : { x, y }
  if (!c.duration) {
    const flight = s.effect(`item/${kind}/world`, hero.x, hero.y - 90, .5, 1, 'travel', at.x, at.y - 35)
    if (flight) flight.simulationStart = s.clock
    s.sfx('item-throw', hero, kind === 'holy-water' ? 1.9 : 1)
    s.after(.5, () => {
      s.effect(`item/${kind}/fx/0`, at.x, at.y - 35, .85, c.radius / 65)
      for (const e of s.enemies) if (e.active && !e.returning && distanceSq(at, e) <= c.radius ** 2) {
        if (kind === 'holy-water') { s.status(e, 'reveal', 5); e.visible = true }
        s.damage(e, kind === 'pumpkin-bomb' ? 160 : e.kind === 'ghost' ? 180 : 20, 'magic')
      }
      s.sfx(`item-${kind}`, at)
      if (kind === 'pumpkin-bomb') s.shake(.005)
    }, { kind, at })
  } else {
    s.items.push({ x: at.x, y: at.y, kind, life: c.duration, pulse: 0, hp: 240, image: s.art.image(at.x, at.y, `item/${kind}/world`).setOrigin(.5, kind === 'scarecrow' ? 1 : .5).setDepth(kind === 'scarecrow' ? at.y : 7) })
    s.effect(`item/${kind}/fx/0`, at.x, at.y - 20, .7, 1.5); s.sfx(`item-${kind}`, at)
  }
  if (!s.options.coop) s.cancel() // co-op closes the menu at the tap
  s.hud.refresh()
}
export function updateConsumables(s: SiegeScene, dt: number) {
  for (const kind of Object.keys(CONSUMABLES) as ConsumableKind[]) s.itemCooldown[kind] = Math.max(0, s.itemCooldown[kind] - dt)
  for (let i = s.items.length - 1; i >= 0; i--) {
    const item = s.items[i], c = CONSUMABLES[item.kind]
    item.life -= dt; item.pulse -= dt
    item.image.setAlpha(Math.min(1, item.life))
    if (item.life <= 0 || item.hp <= 0) { s.effect(`item/${item.kind}/fx/0`, item.x, item.y - 20, .5); if (item.hp <= 0) s.sfx('decoy-break', item); item.image.destroy(); s.items.splice(i, 1); continue }
    if (item.kind === 'garlic' && item.pulse <= 0) {
      item.pulse = .5; s.effect('item/garlic/fx/0', item.x, item.y - 25, .65, c.radius / 65)
      for (const e of s.enemies) if (e.active && !e.returning && !ENEMIES[e.kind].flying && distanceSq(e, item) <= c.radius ** 2) {
        s.status(e, 'poison', 1); s.status(e, 'slow', .6); e.slowPower = .65
      }
    }
  }
}
