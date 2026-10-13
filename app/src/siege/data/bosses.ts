import type { BossId } from './level1'

// hp: base health; speed: design px/s on the road; cast: seconds between boss moves (phase 2 casts 40% more often); jars: stolen if it reaches the porch.
export type BossConfig = { hp: number; speed: number; cast: number; jars: number; candy: number }
export const BOSSES: Record<string, BossConfig> = {
  '561': { hp: 3200, speed: 54, cast: 9, jars: 6, candy: 240 },
  '900': { hp: 3400, speed: 56, cast: 10, jars: 6, candy: 250 },
  '942': { hp: 3300, speed: 52, cast: 11, jars: 6, candy: 250 },
  '1002': { hp: 3600, speed: 50, cast: 11, jars: 6, candy: 260 },
  '1481': { hp: 3000, speed: 56, cast: 9, jars: 6, candy: 220 },
  '1514': { hp: 3300, speed: 52, cast: 12, jars: 6, candy: 260 },
  '1667': { hp: 3500, speed: 52, cast: 11, jars: 6, candy: 260 },
  '1798': { hp: 3700, speed: 50, cast: 10, jars: 6, candy: 260 },
  '1881': { hp: 3300, speed: 52, cast: 10, jars: 6, candy: 280 },
  '1884': { hp: 3400, speed: 56, cast: 12, jars: 8, candy: 280 },
  pumpkin: { hp: 7500, speed: 50, cast: 0, jars: 10, candy: 500 },
}
export const bossConfig = (id: BossId) => BOSSES[String(id)]
