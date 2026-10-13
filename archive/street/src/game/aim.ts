export type Grade = 'bullseye' | 'hit' | 'miss'
export type Aim = { item: number; target: number; boss?: boolean }
export type Shot = { from: [number, number, number]; to: [number, number, number]; grade: Grade }

// House-local coordinates, matching the portrait opening, walls and triangular roof in Scene.
export function gradeFront(x: number, y: number): Grade {
  if (x >= -.075 && x <= .875 && y >= -.55 && y <= .4) return 'bullseye'
  if (x >= -.925 && x <= 1 && y >= -1.21 && y <= .46) return 'hit'
  const roofWidth = (1.325 - y) / .865
  if (y >= .46 && y <= 1.325 && x >= -.2 - .82 * roofWidth && x <= -.2 + 1.28 * roofWidth) return 'hit'
  return 'miss'
}

// The boss billboard is 3.2 units square, centered on its aiming plane.
export function gradeBoss(x: number, y: number): Grade {
  if (Math.abs(x) < .45 && Math.abs(y) < .45) return 'bullseye'
  return Math.abs(x) <= 1.6 && Math.abs(y) <= 1.6 ? 'hit' : 'miss'
}

if (import.meta.env.DEV) {
  console.assert(gradeFront(.4, 0) === 'bullseye' && gradeFront(-.5, -.7) === 'hit', 'House front grades')
  console.assert(gradeFront(2, 0) === 'miss', 'Off-house throws must miss')
  console.assert(gradeBoss(0, 0) === 'bullseye' && gradeBoss(1, 1) === 'hit' && gradeBoss(2, 0) === 'miss', 'Boss billboard grades')
}

export const liteMode = () => {
  const query = new URLSearchParams(window.location.search)
  return !query.has('full') && (query.has('lite') || window.matchMedia('(pointer: coarse)').matches ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? Infinity) <= 4)
}
