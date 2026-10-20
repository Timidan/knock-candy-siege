import type { EnemyKind } from './config.ts'
import type { BossSpawn, Wave, WaveGroup } from './level1.ts'

// Legend Gauntlet (Town Square): the ten legends, one per round, each with its own boss move. The slow walkers come first,
// and Hellfire Skull, who revives once and charges, is the finale. A short escort wave walks ahead of each legend, and each
// legend brings a small crowd. Roads open by round: the left road (0) first, the right bridge road (2) from round 4, the top
// road (1) from round 7 and the short bottom road (3) from round 9. Escorts are split across the open roads; legends take turns
// on the left, right and top roads (never the bottom one, which is too short for a boss), and the round-4 legend crosses the
// bridge. The run ends when the jars run out; getting through the tenth legend is a victory. Health climbs per wave
// (GAUNTLET_HEALTH in config.ts).
export const GAUNTLET_LEGENDS = [1002, 1798, 1481, 561, 942, 1667, 1881, 1514, 1884, 900]
const ESCORTS: EnemyKind[] = ['treater', 'ghost', 'pumpkin', 'bat', 'goblin', 'skeleton', 'witch', 'mummy', 'pumpkin', 'goblin']
const NAMES = ['The procession forms', 'Heralds at the gate', 'The fan club', 'Roadies', 'Bodyguards', 'The entourage', 'Paparazzi', 'Backup dancers', 'The honour guard', 'The final parade']
// Gauntlet-only boss tuning: the first legends come before there is much of a defence; the first two on the right road meet
// only the few towers that cover it; and the finale's revive and charge cross Town Square's short roads too fast to answer at
// its usual health, so it rises with less of its health.
const TUNING: Record<number, Partial<BossSpawn>> = { 1002: { hp: 1100 }, 1481: { hp: 2000 }, 561: { hp: 700 }, 1667: { hp: 1600 }, 900: { hp: 800, revive: .15 } }
// Open roads by round, and each round's legend road.
const ROADS = [[0], [0], [0], [0, 2], [0, 2], [0, 2], [0, 2, 1], [0, 2, 1], [0, 2, 1, 3], [0, 2, 1, 3]]
const LEGEND_ROAD = [0, 0, 0, 2, 0, 2, 1, 0, 2, 1]
// One group's count shared out across the round's open roads (never duplicated), each road's stream spaced so the total pace
// stays the same. Skeletons come in crews of five, so their count is crews.
const crowd = (round: number, type: EnemyKind, count: number, interval: number, delay = 0): WaveGroup[] => {
  const roads = ROADS[round], total = type === 'skeleton' ? Math.max(1, Math.round(count / 5)) : count
  return roads.map((path, i) => ({ type, count: Math.floor(total / roads.length) + (i < total % roads.length ? 1 : 0), interval: interval * roads.length, ...(delay + i ? { delay: delay + i * .7 } : {}), ...(path ? { path } : {}) })).filter(group => group.count > 0)
}
export const GAUNTLET_WAVES: Wave[] = GAUNTLET_LEGENDS.flatMap((id, round): Wave[] => [
  { name: NAMES[round], bonus: 40 + round * 8, countdown: round ? 20 : 0, groups: [...crowd(round, 'treater', 6 + round, 1), ...crowd(round, ESCORTS[round], 3 + Math.floor(round / 2), 1.4, 3)] },
  { name: `Legend ${round + 1} of 10`, bonus: 70 + round * 12, countdown: round ? 12 : 18, boss: { id, delay: 4, ...(LEGEND_ROAD[round] ? { path: LEGEND_ROAD[round] } : {}), ...TUNING[id] }, groups: crowd(round, ESCORTS[round], 3 + round, 1.2, 8) },
])
// Legends defeated first, then jars kept (at most 20 × 25 = 500, under one legend's 1,000).
export const gauntletScore = (legends: number, jars: number) => legends * 1000 + jars * 25

// The best run, in this browser only, beside the main save (data/save.ts).
export type GauntletBest = { legends: number; jars: number }
const KEY = 'knock-gauntlet-v1'
export function readGauntletBest(): GauntletBest {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null'), count = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? v as number : 0
    return { legends: count(value?.legends, 10), jars: count(value?.jars, 20) }
  } catch { return { legends: 0, jars: 0 } }
}
export function saveGauntletBest(legends: number, jars: number): GauntletBest {
  const best = readGauntletBest()
  if (gauntletScore(legends, jars) <= gauntletScore(best.legends, best.jars)) return best
  try { localStorage.setItem(KEY, JSON.stringify({ legends, jars })) } catch { /* The result card still shows this run. */ }
  return { legends, jars }
}
