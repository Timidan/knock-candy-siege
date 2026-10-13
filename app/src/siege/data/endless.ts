import { seededRandom } from './config.ts'
import type { EnemyKind } from './config.ts'
import type { BossId, Wave, WaveGroup } from './level1.ts'

// Endless mode (Town Square): waves never stop, health climbs about 8% per wave, a road opens every ten waves,
// and every tenth wave is a Witching Hour with a boss.
export const HEALTH_PER_WAVE = 1.08
export const endlessHealth = (wave: number) => HEALTH_PER_WAVE ** wave
export const BOSS_ROTATION: BossId[] = [1481, 1881, 942, 1002, 561, 1884, 1798, 900, 1514, 1667, 'pumpkin']
export const endlessRoads = (wave: number) => Math.min(4, Math.floor(wave / 10) + 1)
export const endlessBoss = (wave: number): BossId => BOSS_ROTATION[(wave / 10 - 1) % BOSS_ROTATION.length]
// The mix grows: [kind, first wave it can appear, weight, crowd size relative to a treater (skeletons come as crews of five)].
const MIX: [EnemyKind, number, number, number][] = [['treater', 1, 6, 1], ['ghost', 3, 3, .85], ['pumpkin', 4, 3, .6], ['bat', 5, 3, 1], ['goblin', 6, 2, .8], ['skeleton', 7, 2, .2], ['witch', 8, 1.5, .3], ['mummy', 9, 2, .45]]
const TITLES = ['Still hungry', 'More candy, please', 'Second helpings', 'Door to door', 'The line grows', 'Sugar rush hour', 'No end in sight', 'Knock knock again', 'Midnight snack', 'Trick or retreat', 'Hold the porch', 'Candy or bust']
// `number` is the 1-based wave and `seed` the run's seed: the same seed replays the same crowds, a new seed reshuffles the mix.
// Every open road carries a share of every kind, so a road that opens is used from then on.
export function endlessWave(number: number, seed = 0): Wave {
  const rand = seededRandom((seed ^ number * 7919) >>> 0), roads = endlessRoads(number)
  const open = MIX.filter(([, first]) => first <= number), picks: typeof MIX = open.filter(m => number - m[1] < 2).slice(0, 2)
  // A kind that has just unlocked always joins, so new threats are met; the rest are drawn by weight.
  while (picks.length < Math.min(3, open.length)) { const pool = open.filter(m => !picks.includes(m)), total = pool.reduce((sum, m) => sum + m[2], 0); let roll = rand() * total; picks.push(pool.find(m => (roll -= m[2]) < 0) ?? pool[0]) }
  const budget = 10 + number * 3, weights = picks.length === 1 ? [1] : picks.length === 2 ? [.6, .4] : [.45, .35, .2], interval = Math.max(.4, 1.5 - number * .025)
  const groups: WaveGroup[] = picks.flatMap(([type, , , size], i) => Array.from({ length: roads }, (_, road) => ({ type, count: Math.max(1, Math.round(budget * weights[i] * size / roads)), interval: interval * (type === 'treater' ? 1 : 1.2) * roads, delay: i * 2 + road * .7, path: road })))
  const witching = number % 10 === 0
  if (witching) groups.push({ type: 'ghost', count: 8 + Math.floor(number / 2), interval: .55, edge: true }, { type: 'bat', count: 12 + Math.floor(number * .8), interval: .4, edge: true })
  return { name: witching ? `Witching Hour ${number / 10}` : TITLES[(number - 1) % TITLES.length], bonus: 60 + number * 6, countdown: 16, groups, ...(witching ? { witching, boss: { id: endlessBoss(number), delay: 6 } } : {}) }
}
export const endlessScore = (waves: number, kills: number) => waves * 400 + kills * 100

// The daily challenge: the UTC date seeds the run, picks the level and sets the night's theme, exactly as Knock.sol's nightTheme.
export const DAILY_LEVEL = 8 // a pseudo level id: the level select's daily card
export const DAY_MS = 86400000
export const DAILY_FIRST_DAY = Math.floor(Date.UTC(2026, 9, 12) / DAY_MS)
export const NIGHTS = [
  { name: 'Quiet night', icon: 'daily/quiet', text: 'No tricks tonight. A plain night on the street.' },
  { name: 'Blood Moon', icon: 'daily/blood-moon', text: 'Enemies are 25% faster.' },
  { name: 'Candy Rain', icon: 'daily/candy-rain', text: 'All candy is doubled.' },
  { name: 'Costume Night', icon: 'daily/costume-night', text: 'The enemy types are shuffled.' },
] as const
export type Daily = { day: number; number: number; theme: number; level: number; seed: number; date: string }
export function dailyInfo(now = Date.now()): Daily {
  const day = Math.floor(now / DAY_MS), at = new Date(day * DAY_MS)
  return { day, number: day - DAILY_FIRST_DAY + 1, theme: day % 4, level: 1 + Math.floor(seededRandom(day)() * 6), seed: at.getUTCFullYear() * 10000 + (at.getUTCMonth() + 1) * 100 + at.getUTCDate(), date: at.toISOString().slice(0, 10) }
}
// Costume Night: ground kinds swap places (bats stay bats so flight routes keep working).
export function shuffledKinds(seed: number): Partial<Record<EnemyKind, EnemyKind>> {
  const kinds: EnemyKind[] = ['treater', 'ghost', 'pumpkin', 'witch', 'mummy', 'goblin', 'skeleton'], rand = seededRandom(seed), order = [...kinds]
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  return Object.fromEntries(kinds.map((kind, i) => [kind, order[i]]))
}
