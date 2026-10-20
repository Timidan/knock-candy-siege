import Phaser from 'phaser'
import type { EnemyKind, Modifier, Point, Status, Targeting, TowerKind, TrapKind, Specialisation } from './data/config'
import { hypot, sine } from './data/config'
import type { BossState } from './Boss'

export type Statuses = Record<Status, number>
export const clearStatuses = (): Statuses => ({ slow: 0, stun: 0, burn: 0, poison: 0, reveal: 0, fear: 0, freeze: 0, charm: 0, confuse: 0, root: 0, mark: 0, bleed: 0, wrap: 0, ground: 0 })
// These clocks and offsets belong only to drawing. Never read them from combat rules.
export type Reaction = { x: number; y: number; life: number; stop: number; flash: number; dodge: number; atX: number; atY: number }
export const reaction = (): Reaction => ({ x: 0, y: 0, life: 0, stop: 0, flash: 0, dodge: 0, atX: 0, atY: 0 })
export type UnitArt = { root: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; face: Phaser.GameObjects.Image; icons: Phaser.GameObjects.Image[]; statusImage: Phaser.GameObjects.Image; drawFrame: number; faceId: number; faceLeft: boolean; hitTint: boolean; statusName?: Status; statusFrame: number; reaction: Reaction; age: number; walkAge: number; blockUntil: number; blockX: number; blockY: number; popAt: number; deflectAt: number; missAt: number; statusSlot: number; shown: boolean; risen?: boolean; shielded?: boolean }
export type Enemy = Point & {
  returning: number; casting: number; poisonStacks: number; active: boolean; generation: number; wave: number; kind: EnemyKind; id: number; mods: Modifier[]; path: number; distance: number; speed: number;
  hp: number; maxHp: number; candy: number; jars: number; status: Statuses; age: number; hit: number; attack: number; skill: number; lucky: boolean; revived: boolean; armour: boolean; visible: boolean; art: UnitArt; slowPower: number; heroDot: boolean; heroOwner?: number; sigCooldown: number
  // route: edge swarms walk their own line to the porch; boss: legends and the Great Pumpkin; shield/gold: seconds left of Sanctuary or a golden touch; lit: standing in light on a dark map
  route?: Route; boss?: BossState; shield: number; gold: number; lit: boolean
}
export type Guard = Point & { hp: number; maxHp: number; respawn: number; cooldown: number; slow: number; image: Phaser.GameObjects.Image; poseUntil?: number; blockUntil?: number; recoilX?: number; recoilY?: number }
export type Tower = Point & { kind: TowerKind; level: number; spec: Specialisation | null; rank: number; spent: number; targeting: Targeting; cooldown: number; stun: number; image: Phaser.GameObjects.Image; guards: Guard[]; pop: number; boost: boolean; gold: number; owner?: number; shotAt?: number; aimX?: number; aimY?: number }
// Temporary fighters (zombie Chogs, risen enemies) block and fight like guards; a blocker is a wall that only stops the march.
export type Ally = Guard & { life: number; damage: number }
export type Blocker = Point & { life: number; radius: number; image: Phaser.GameObjects.Image }
export type Projectile = Point & { active: boolean; target: Enemy | null; generation: number; life: number; duration: number; fromX: number; fromY: number; endX: number; endY: number; damage: number; kind: TowerKind | 'hero'; splash: number; image: Phaser.GameObjects.Image; drawn?: boolean; owner?: number; arc?: number; frame?: string; frameCount?: number; onHit?: (enemy: Enemy) => void; after?: () => void }
export type Effect = { active: boolean; image: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text | null; life: number; duration: number; x: number; y: number; toX: number; toY: number; size: number; name: string; mode: 'burst' | 'coin' | 'emote' | 'jar' | 'travel' | 'steal' | 'pop'; count: number; angle: number; width?: number; height?: number; simulationStart?: number; delay: number; flip: boolean }
export type DamageNumber = { active: boolean; text: Phaser.GameObjects.BitmapText; life: number; x: number; y: number }
export type Trap = Point & { kind: TrapKind; life: number; armed: boolean; owner?: number; image: Phaser.GameObjects.Image }

// Equal-distance samples make the speed independent of how densely the artist placed spline knots.
export class Route {
  points: Phaser.Math.Vector2[]
  length: number
  constructor(knots: [number, number][], entrance = false) {
    if (entrance) {
      const [x, y] = knots[0], next = knots.find(p => p[0] !== x || p[1] !== y)
      if (next) { const length = hypot(next[0] - x, next[1] - y); knots = [[x - (next[0] - x) / length * 450, y - (next[1] - y) / length * 450], ...knots] }
    }
    const curve = new Phaser.Curves.Spline(knots.map(([x, y]) => new Phaser.Math.Vector2(x, y)))
    this.length = curve.getLength()
    this.points = curve.getSpacedPoints(Math.max(200, Math.ceil(this.length / 6)))
  }
  // Edge swarms need no road: a straight line to the porch, optionally weaving sideways, resampled to equal distances like the spline routes.
  static wild(from: Point, to: Point, drift = 0, phase = 0): Route {
    const dx = to.x - from.x, dy = to.y - from.y, span = hypot(dx, dy) || 1, raw: Phaser.Math.Vector2[] = []
    for (let i = 0; i <= 48; i++) { const t = i / 48, side = sine(t * Math.PI * 3 + phase) * sine(t * Math.PI) * drift; raw.push(new Phaser.Math.Vector2(from.x + dx * t - dy / span * side, from.y + dy * t + dx / span * side)) }
    let length = 0; const lengths = raw.map((p, i) => length += i ? hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y) : 0)
    const route = Object.create(Route.prototype) as Route, count = Math.max(2, Math.ceil(length / 10)); route.length = length; route.points = []
    for (let k = 0, i = 1; k <= count; k++) {
      const at = length * k / count; while (i < raw.length - 1 && lengths[i] < at) i++
      const t = (at - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1)
      route.points.push(new Phaser.Math.Vector2(Phaser.Math.Linear(raw[i - 1].x, raw[i].x, t), Phaser.Math.Linear(raw[i - 1].y, raw[i].y, t)))
    }
    return route
  }
  at(distance: number, out: Point): Point {
    const pos = Phaser.Math.Clamp(distance / this.length, 0, 1) * (this.points.length - 1), i = Math.min(this.points.length - 2, Math.floor(pos)), t = pos - i
    out.x = Phaser.Math.Linear(this.points[i].x, this.points[i + 1].x, t); out.y = Phaser.Math.Linear(this.points[i].y, this.points[i + 1].y, t)
    return out
  }
  nearest(x: number, y: number): { x: number; y: number; distance: number; gap: number } {
    let best = 0, gap = Infinity
    for (let i = 0; i < this.points.length; i++) { const p = this.points[i], d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < gap) { gap = d; best = i } }
    return { x: this.points[best].x, y: this.points[best].y, distance: best / (this.points.length - 1) * this.length, gap: Math.sqrt(gap) }
  }
}
export const distanceSq = (a: Point, b: Point) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)

// Witching Hour swarms enter only inside the 90° wedge facing `away` from the porch p: directions d with d·away >= |d·away⊥| (any length of away).
// Writes the part of edge k of the box [x0, x1] × [y0, y1] inside it (0 top, 1 right, 2 bottom, 3 left, each walked clockwise):
// the edge's start (x, y) and step (dx, dy), and the fractions u0..u1 inside the wedge (none when u0 >= u1). Plain arithmetic, so co-op peers agree.
export type Span = { x: number; y: number; dx: number; dy: number; u0: number; u1: number }
export function wedgeSpan(x0: number, y0: number, x1: number, y1: number, k: number, p: Point, away: Point, out: Span): Span {
  out.x = k === 1 || k === 2 ? x1 : x0; out.y = k < 2 ? y0 : y1
  out.dx = k === 0 ? x1 - x0 : k === 2 ? x0 - x1 : 0; out.dy = k === 1 ? y1 - y0 : k === 3 ? y0 - y1 : 0
  out.u0 = 0; out.u1 = 1
  // One half-plane per side of the wedge: d·(away ± away⊥) >= 0, with away⊥ = (-away.y, away.x).
  for (let side = -1; side <= 1; side += 2) {
    const nx = away.x - side * away.y, ny = away.y + side * away.x
    const f = (out.x - p.x) * nx + (out.y - p.y) * ny, g = out.dx * nx + out.dy * ny
    if (g > 0) out.u0 = Math.max(out.u0, -f / g); else if (g < 0) out.u1 = Math.min(out.u1, -f / g); else if (f < 0) out.u1 = -1
  }
  return out
}
// The point a fraction s (0..1) of the way along the box's edges inside the wedge, measured by length, so spawns spread evenly along them.
export function wedgePoint(x0: number, y0: number, x1: number, y1: number, p: Point, away: Point, s: number, span: Span): Point {
  let total = 0
  for (let k = 0; k < 4; k++) { wedgeSpan(x0, y0, x1, y1, k, p, away, span); total += Math.max(0, span.u1 - span.u0) * (Math.abs(span.dx) + Math.abs(span.dy)) }
  let rest = s * total
  const at = { x: p.x, y: p.y }
  for (let k = 0; k < 4; k++) {
    wedgeSpan(x0, y0, x1, y1, k, p, away, span)
    const size = Math.abs(span.dx) + Math.abs(span.dy), length = (span.u1 - span.u0) * size
    if (length <= 0) continue
    const u = span.u0 + Math.min(rest, length) / size
    at.x = span.x + u * span.dx; at.y = span.y + u * span.dy
    if ((rest -= length) <= 0) break
  }
  return at
}
