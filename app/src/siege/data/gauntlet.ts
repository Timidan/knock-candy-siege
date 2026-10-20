import type { EnemyKind } from './config.ts'
import type { BossSpawn, Wave, WaveGroup } from './level1.ts'

// Legend Gauntlet (Town Square, road 0): the ten legends, one per round, each with its own boss move. The slow walkers come first,
// and Hellfire Skull, who revives once and charges, is the finale.
// A short escort wave walks ahead of each legend, and each legend brings a small crowd. The run ends when the jars run out;
// getting through the tenth legend is a victory. Health climbs per wave (GAUNTLET_HEALTH in config.ts).
export const GAUNTLET_LEGENDS = [1002, 561, 1481, 1798, 942, 1881, 1667, 1514, 1884, 900]
const ESCORTS: EnemyKind[] = ['treater', 'ghost', 'pumpkin', 'bat', 'goblin', 'skeleton', 'witch', 'mummy', 'pumpkin', 'goblin']
const NAMES = ['The procession forms', 'Heralds at the gate', 'The fan club', 'Roadies', 'Bodyguards', 'The entourage', 'Paparazzi', 'Backup dancers', 'The honour guard', 'The final parade']
// Gauntlet-only boss tuning: the first legend comes before there is much of a defence, and the finale's revive and charge
// cross Town Square's short road too fast to answer at its usual health, so it rises with less of its health.
const TUNING: Record<number, Partial<BossSpawn>> = { 1002: { hp: 1100 }, 900: { hp: 1000, revive: .15 } }
// Skeletons come in crews of five, so their count is crews.
const crowd = (type: EnemyKind, count: number, interval: number, delay = 0): WaveGroup => ({ type, count: type === 'skeleton' ? Math.max(1, Math.round(count / 5)) : count, interval, ...(delay ? { delay } : {}) })
export const GAUNTLET_WAVES: Wave[] = GAUNTLET_LEGENDS.flatMap((id, round): Wave[] => [
  { name: NAMES[round], bonus: 40 + round * 8, countdown: round ? 20 : 0, groups: [crowd('treater', 6 + round, 1), crowd(ESCORTS[round], 3 + Math.floor(round / 2), 1.4, 3)] },
  { name: `Legend ${round + 1} of 10`, bonus: 70 + round * 12, countdown: round ? 12 : 18, boss: { id, delay: 4, ...TUNING[id] }, groups: [crowd(ESCORTS[round], 3 + round, 1.2, 8)] },
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
