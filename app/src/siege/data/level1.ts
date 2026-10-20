import type { EnemyKind, Point } from './config'
import { GAUNTLET_WAVES } from './gauntlet.ts'

// A boss is a legend's token id or the Great Pumpkin; it walks the road beside the wave's ordinary groups.
export type BossId = number | 'pumpkin'
export type BossSpawn = { id: BossId; delay?: number; hp?: number }
// edge: the group pours in from the edges of the view on the porch's far side instead of a road (Witching Hour swarms).
export type WaveGroup = { type: EnemyKind; count: number; interval: number; delay?: number; path?: number; edge?: boolean }
export type Wave = { name: string; groups: WaveGroup[]; bonus: number; countdown: number; witching?: boolean; boss?: BossSpawn }
export type LevelProp = Point & { kind?: 'lamp' | 'shop' | 'bridge' | 'bell' | 'grate' | 'bonfire' | 'cannon'; use?: boolean; reach?: [number, number][]; return?: [number, number]; frame?: string; scale?: number }
export type LevelPad = Point & { boost?: boolean }
export type Portal = { path: number; enter: [number, number]; exit: [number, number] }
export type Zone = Point & { kind: 'toxic'; r: number }
export type LevelGeometry = { size: [number, number]; background: string; paths: [number, number][][]; pads: LevelPad[]; porch: Point; props: LevelProp[]; fly?: [number, number][][]; switch?: { prop: string; path: number; points: [number, number][] }; portals?: Portal[]; zones?: Zone[]; dark?: boolean; lights?: (Point & { r: number })[]; ambient?: { fireflies?: number; leaves?: boolean; fog?: number[]; glows?: (Point & { r: number })[] } }
export type LevelConfig = { id: number; name: string; geometry: LevelGeometry; waves: Wave[]; endless?: boolean; gauntlet?: boolean }
export const ENDLESS_LEVEL = 7, GAUNTLET_LEVEL = 8
// Level maps live in levelN.json; the plaza of Endless and the Legend Gauntlet is its own file.
export const mapFile = (level: number) => level === ENDLESS_LEVEL || level === GAUNTLET_LEVEL ? 'townsquare' : `level${level}`
export const LEVEL1: LevelConfig = {
  id: 1, name: 'Rosie Row',
  geometry: {
    size: [1920, 1080], background: 'level1.webp',
    paths: [[[-100, 410], [200, 410], [430, 410], [560, 470], [570, 650], [720, 735], [970, 735], [1100, 660], [1100, 440], [1200, 330], [1430, 330], [1520, 430], [1520, 610], [1700, 650], [1880, 650]]],
    pads: [{ x: 380, y: 550 }, { x: 650, y: 380 }, { x: 790, y: 585 }, { x: 920, y: 875 }, { x: 980, y: 470 }, { x: 1240, y: 540 }, { x: 1340, y: 205 }, { x: 1430, y: 745 }, { x: 1640, y: 465 }, { x: 400, y: 770 }, { x: 1280, y: 845 }, { x: 770, y: 230 }],
    porch: { x: 1820, y: 650 }, props: [],
  },
  waves: [
    { name: 'The doorbell rings', bonus: 45, countdown: 0, groups: [{ type: 'treater', count: 7, interval: 2 }] },
    { name: 'Costume party', bonus: 55, countdown: 18, groups: [{ type: 'treater', count: 12, interval: 1.3 }, { type: 'pumpkin', count: 3, interval: 3, delay: 5 }] },
    { name: 'Things that go boo', bonus: 32, countdown: 22, groups: [{ type: 'treater', count: 8, interval: 1.2 }, { type: 'ghost', count: 6, interval: 2, delay: 3 }] },
    { name: 'Look up!', bonus: 38, countdown: 18, groups: [{ type: 'bat', count: 12, interval: 1 }, { type: 'pumpkin', count: 6, interval: 2.5, delay: 2 }] },
    { name: 'Moonlight march', bonus: 42, countdown: 18, groups: [{ type: 'ghost', count: 10, interval: .9 }, { type: 'pumpkin', count: 10, interval: 1.1 }, { type: 'bat', count: 14, interval: .6, delay: 5 }] },
    { name: 'One last treat', bonus: 50, countdown: 20, groups: [{ type: 'treater', count: 15, interval: .7 }, { type: 'ghost', count: 8, interval: 1.2, delay: 2 }, { type: 'pumpkin', count: 8, interval: 1.7, delay: 5 }, { type: 'bat', count: 36, interval: .3, delay: 5 }] },
  ],
}
export type TutorialAction = 'build' | 'wave'
// Only the first tower and the first wave wait for the player; the rest of the lessons arrive as TIPS while the night plays on.
export const TUTORIAL: { action: TutorialAction; title: string; text: string; target: string }[] = [
  { action: 'build', title: '', text: 'Tap the glowing pad', target: 'pad' },
  { action: 'wave', title: 'Here comes the neighbourhood', text: 'Tap the path entrance to preview. Tap it again to call the wave.', target: 'wave' },
]
// In a tutorial run (not skipped), each of the first waves cleared adds one tip to its toast. Nothing waits for them.
export const TIPS = ['Tap your Egg Stand, then the upgrade icon.', 'Drag the Pumpkin Trap from the bottom right onto the path.', 'Tap Candy Rain, then tap a crowd on the path.', 'Tap your hero portrait, then tap the ground to move.', 'Tap the LOL bubble beside your portrait to emote.']

// Reject a partial art export; the playable fallback remains intact until the map is valid.
export function readGeometry(value: unknown): LevelGeometry | null {
  const v = value as LevelGeometry
  const point = (p: unknown): p is Point => !!p && Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y)
  if (!v || !Array.isArray(v.size) || v.size[0] !== 1920 || v.size[1] !== 1080 || typeof v.background !== 'string' || !/^[\w.-]+$/.test(v.background)) return null
  if (!Array.isArray(v.paths) || !v.paths.length || !v.paths.every(path => Array.isArray(path) && path.length >= 2 && path.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) && path.some(p => p[0] !== path[0][0] || p[1] !== path[0][1]))) return null
  if (!Array.isArray(v.pads) || !v.pads.length || v.pads.length > 12 || !v.pads.every(point) || !point(v.porch)) return null
  const pathValid = (path: unknown) => Array.isArray(path) && path.length >= 2 && path.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
  if (v.fly && (!Array.isArray(v.fly) || !v.fly.length || !v.fly.every(pathValid))) return null
  if (v.switch && (!Number.isInteger(v.switch.path) || !v.paths[v.switch.path] || !pathValid(v.switch.points))) return null
  const pair = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  if (Array.isArray(v.props) && v.props.some(p => p.use && (!['lamp', 'shop', 'bridge', 'bell', 'grate', 'bonfire', 'cannon'].includes(p.kind ?? '') || !pathValid(p.reach) || (p.kind === 'grate' && !pair(p.return))))) return null
  if (v.portals && (!Array.isArray(v.portals) || !v.portals.every(p => Number.isInteger(p.path) && !!v.paths[p.path] && pair(p.enter) && pair(p.exit)))) return null
  if (v.zones && (!Array.isArray(v.zones) || !v.zones.every(z => z.kind === 'toxic' && point(z) && Number.isFinite(z.r) && z.r > 0))) return null
  if (v.lights && (!Array.isArray(v.lights) || !v.lights.every(l => point(l) && Number.isFinite(l.r) && l.r > 0))) return null
  if (v.switch) { const base = v.paths[v.switch.path], alt = v.switch.points; if ([0, 1].some(axis => base[0][axis] !== alt[0][axis] || base.at(-1)![axis] !== alt.at(-1)![axis])) return null }
  const a = v.ambient
  if (a && ((a.fog && (!Array.isArray(a.fog) || !a.fog.every(Number.isFinite))) || (a.glows && (!Array.isArray(a.glows) || !a.glows.every(g => point(g) && Number.isFinite(g.r) && g.r > 0))) || (a.fireflies !== undefined && (!Number.isInteger(a.fireflies) || a.fireflies < 0)))) return null
  return { ...v, props: Array.isArray(v.props) ? v.props.filter(point) : [] }
}

// Levels 4–7 draw their maps from levelN.json; their placeholder geometry is only used until the art file loads.
const wave = (name: string, bonus: number, countdown: number, groups: WaveGroup[], extra: Partial<Wave> = {}): Wave => ({ name, bonus, countdown, groups, ...extra })
const g = (type: EnemyKind, count: number, interval: number, delay?: number, path?: number): WaveGroup => ({ type, count, interval, ...(delay ? { delay } : {}), ...(path ? { path } : {}) })
const swarm = (type: 'ghost' | 'bat', count: number, interval: number): WaveGroup => ({ type, count, interval, edge: true })
export const LEVELS: LevelConfig[] = [LEVEL1, {
  id: 2, name: 'Lemon Lane', geometry: LEVEL1.geometry,
  waves: [
    { name: 'Two doorbells', bonus: 65, countdown: 0, groups: [{ type: 'treater', count: 10, interval: 1.5 }, { type: 'treater', count: 8, interval: 1.7, path: 1 }] },
    { name: 'Sticky fingers', bonus: 75, countdown: 22, groups: [{ type: 'goblin', count: 8, interval: 1.5, path: 1 }, { type: 'pumpkin', count: 7, interval: 2 }] },
    { name: 'Neighbourhood healers', bonus: 42, countdown: 22, groups: [{ type: 'witch', count: 4, interval: 4 }, { type: 'treater', count: 14, interval: .8 }, { type: 'ghost', count: 8, interval: 1.5, path: 1 }] },
    { name: 'Shoplifters', bonus: 48, countdown: 20, groups: [{ type: 'goblin', count: 14, interval: .7, path: 1 }, { type: 'bat', count: 16, interval: .8 }, { type: 'pumpkin', count: 10, interval: 1.5 }] },
    { name: 'A coven for company', bonus: 52, countdown: 20, groups: [{ type: 'witch', count: 7, interval: 2 }, { type: 'pumpkin', count: 14, interval: 1 }, { type: 'ghost', count: 15, interval: .8, path: 1 }] },
    { name: 'Sugar high', bonus: 58, countdown: 20, groups: [{ type: 'bat', count: 22, interval: .55, path: 1 }, { type: 'goblin', count: 18, interval: .6 }, { type: 'witch', count: 6, interval: 2.5, path: 1 }] },
    { name: 'Midnight closing time', bonus: 75, countdown: 24, boss: { id: 1481, delay: 8 }, groups: [{ type: 'witch', count: 9, interval: 1.6 }, { type: 'pumpkin', count: 20, interval: .7 }, { type: 'ghost', count: 18, interval: .7, path: 1 }, { type: 'goblin', count: 24, interval: .5, path: 1, delay: 10 }, { type: 'bat', count: 20, interval: .6, delay: 12 }] },
  ],
}, {
  id: 3, name: 'Mint Mews', geometry: LEVEL1.geometry,
  waves: [
    { name: 'Bones by the canal', bonus: 170, countdown: 0, groups: [{ type: 'skeleton', count: 4, interval: 3 }, { type: 'treater', count: 8, interval: 2 }] },
    { name: 'Unravelling', bonus: 185, countdown: 22, groups: [{ type: 'mummy', count: 7, interval: 2.5 }, { type: 'goblin', count: 8, interval: 1.2, delay: 5 }] },
    { name: 'Raise the bridge', bonus: 48, countdown: 22, groups: [{ type: 'skeleton', count: 8, interval: 2 }, { type: 'witch', count: 5, interval: 3 }, { type: 'pumpkin', count: 8, interval: 2 }] },
    { name: 'Over the water', bonus: 52, countdown: 20, groups: [{ type: 'bat', count: 24, interval: .7 }, { type: 'ghost', count: 14, interval: 1 }, { type: 'mummy', count: 9, interval: 2 }] },
    { name: 'Bandage brigade', bonus: 60, countdown: 20, groups: [{ type: 'mummy', count: 16, interval: 1.1 }, { type: 'skeleton', count: 10, interval: 1.8 }, { type: 'witch', count: 6, interval: 3 }] },
    { name: 'Canal carnival', bonus: 68, countdown: 22, groups: [{ type: 'goblin', count: 22, interval: .6 }, { type: 'bat', count: 26, interval: .55 }, { type: 'pumpkin', count: 18, interval: 1 }, { type: 'ghost', count: 16, interval: .9 }] },
    wave('The midnight crossing', 85, 24, [g('mummy', 16, 1), g('skeleton', 10, 1.6), g('witch', 8, 2.2), g('goblin', 16, .7, 10), swarm('ghost', 6, .65), swarm('bat', 12, .5)], { witching: true, boss: { id: 1881, delay: 6 } }),
  ],
}, {
  id: 4, name: 'Mon Manor', geometry: LEVEL1.geometry,
  waves: [
    wave('A knock at the gate', 80, 0, [g('treater', 10, 1.6), g('skeleton', 3, 3, 4)]),
    wave('Through the portal', 90, 22, [g('ghost', 10, 1.2), g('treater', 12, .9, 2)]),
    wave('Cobwebs and covens', 50, 22, [g('witch', 4, 3.5), g('pumpkin', 8, 1.8), g('goblin', 8, 1.1, 5)]),
    wave('Wings over the manor', 55, 20, [g('bat', 22, .7), g('mummy', 7, 2.2, 3), g('skeleton', 5, 2, 6)]),
    wave('Bell, book and candle', 60, 20, [g('witch', 6, 2.4), g('ghost', 14, .9), g('pumpkin', 12, 1.2, 4)]),
    wave('Bandage ball', 65, 22, [g('mummy', 14, 1.2), g('goblin', 18, .6, 4), g('bat', 18, .6, 8)]),
    wave('Everyone is invited', 72, 22, [g('skeleton', 12, 1.4), g('witch', 8, 2), g('pumpkin', 14, 1), g('ghost', 14, .8, 3)]),
    wave('The Scream', 95, 24, [g('pumpkin', 12, .9), g('mummy', 10, 1.4), g('witch', 6, 2.2, 6), swarm('ghost', 8, .6), swarm('bat', 12, .5)], { witching: true, boss: { id: 942, delay: 6 } }),
  ],
}, {
  id: 5, name: 'Radioactive Ridge', geometry: LEVEL1.geometry,
  waves: [
    wave('Glow in the dark', 85, 0, [g('treater', 10, 1.5), g('goblin', 4, 2.4, 5)]),
    wave('Spill on aisle five', 95, 22, [g('pumpkin', 8, 1.8), g('treater', 12, .9), g('skeleton', 3, 3, 4)]),
    wave('Green with envy', 52, 22, [g('ghost', 12, 1.1), g('bat', 12, .9, 2), g('witch', 3, 4, 4)]),
    wave('Hazmat party', 58, 20, [g('goblin', 14, .7), g('mummy', 7, 2.2, 3)]),
    wave('Meltdown march', 62, 20, [g('pumpkin', 14, 1.1), g('witch', 6, 2.4), g('skeleton', 6, 1.8, 5)]),
    wave('Fallout fiesta', 68, 22, [g('bat', 24, .6), g('goblin', 16, .65, 4), g('ghost', 12, .9, 6)]),
    wave('Core breach', 75, 22, [g('mummy', 14, 1.1), g('skeleton', 10, 1.4), g('witch', 8, 2), g('pumpkin', 12, 1.1, 4)]),
    wave('Brainz at the reactor', 98, 24, [g('pumpkin', 12, .9), g('goblin', 16, .6, 4), g('witch', 7, 2, 6), swarm('ghost', 6, .65), swarm('bat', 10, .55)], { witching: true, boss: { id: 1002, delay: 6 } }),
  ],
}, {
  id: 6, name: 'Rare Row', geometry: LEVEL1.geometry,
  waves: [
    wave('Red carpet rollout', 190, 0, [g('treater', 12, 1.4), g('bat', 6, 1, 5)]),
    wave('Paparazzi', 200, 22, [g('ghost', 10, 1.1), g('goblin', 8, 1.1, 3), g('treater', 8, 1, 6)]),
    wave('Ember on the carpet', 58, 22, [g('pumpkin', 8, 1.8), g('treater', 10, 1)], { boss: { id: 561, delay: 6 } }),
    wave('Velvet rope', 62, 20, [g('witch', 5, 3), g('mummy', 8, 2), g('skeleton', 5, 2.5, 4)]),
    wave('The devil in the details', 68, 20, [g('bat', 18, .7), g('ghost', 12, 1), g('goblin', 10, 1, 4)], { boss: { id: 1884, delay: 6 } }),
    wave('Gala night', 72, 22, [g('mummy', 12, 1.2), g('witch', 7, 2.2), g('pumpkin', 12, 1.1), g('skeleton', 8, 1.6, 5)]),
    wave('Gladius takes the stage', 78, 22, [g('goblin', 16, .65), g('ghost', 14, .9, 3), g('pumpkin', 12, 1.1, 5)], { boss: { id: 1798, delay: 6 } }),
    wave('Last call', 85, 24, [g('witch', 9, 2), g('mummy', 14, 1), g('skeleton', 12, 1.3), g('bat', 22, .5, 6), g('goblin', 18, .6, 8)]),
    wave('The Great Pumpkin', 115, 24, [g('pumpkin', 10, 1.1), g('mummy', 10, 1.3), g('witch', 8, 2, 5), swarm('ghost', 10, .6), swarm('bat', 16, .5)], { witching: true, boss: { id: 'pumpkin', delay: 6 } }),
  ],
}, { id: ENDLESS_LEVEL, name: 'Endless', geometry: LEVEL1.geometry, waves: [], endless: true }, { id: GAUNTLET_LEVEL, name: 'Legend Gauntlet', geometry: LEVEL1.geometry, waves: GAUNTLET_WAVES, gauntlet: true }]
