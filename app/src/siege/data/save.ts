export type Settings = { music: number; effects: number; lite: boolean; shake: boolean; gold: boolean; autoFullscreen: boolean; vibration: boolean }
// endless: the best wave and score of Town Square; daily: the best score for each UTC day number (the last 30 days are kept).
export type Save = { seen: string[]; stars: Record<string, number>; scores: Record<string, number>; endless: { wave: number; score: number }; daily: Record<string, number>; tutorial: boolean; costume: string; victoryDance: string; settings: Settings; crates: { count: number; hashes: string[] } }
let motionQuery: MediaQueryList | undefined
export const reducedMotion = () => (motionQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)')).matches
export function readSave(): Save {
  const defaults: Save = { seen: [], stars: {}, scores: {}, endless: { wave: 0, score: 0 }, daily: {}, tutorial: false, costume: '', victoryDance: 'gg', settings: { music: .45, effects: .7, lite: false, shake: !reducedMotion(), gold: false, autoFullscreen: true, vibration: false }, crates: { count: 0, hashes: [] } }
  try {
    const value = JSON.parse(localStorage.getItem('knock-siege-v1') ?? 'null')
    if (!value || typeof value !== 'object') return defaults
    const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback
    const stars: Record<string, number> = {}
    for (const [key, star] of Object.entries(value.stars ?? {})) if (/^[1-6]$/.test(key) && typeof star === 'number' && Number.isInteger(star) && star >= 0 && star <= 3) stars[key] = star
    const scores: Record<string, number> = {}
    for (const [key, score] of Object.entries(value.scores ?? {})) if (/^[1-6]$/.test(key) && typeof score === 'number' && Number.isSafeInteger(score) && score >= 0) scores[key] = score
    const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0
    const daily: Record<string, number> = {}
    for (const [key, score] of Object.entries(value.daily ?? {}).filter(([key]) => /^\d{1,6}$/.test(key)).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 30)) if (count(score)) daily[key] = count(score)
    return { seen: Array.isArray(value.seen) ? value.seen.filter((s: unknown) => typeof s === 'string').slice(0, 500) : [], stars, scores, endless: { wave: count(value.endless?.wave), score: count(value.endless?.score) }, daily, tutorial: value.tutorial === true, costume: /^crew-(ghosts|witches|pumpkins|bats)$/.test(value.costume) ? value.costume : '', victoryDance: typeof value.victoryDance === 'string' ? value.victoryDance : 'gg',
      settings: { music: volume(value.settings?.music, .45), effects: volume(value.settings?.effects, .7), lite: value.settings?.lite === true, shake: value.settings?.shake !== false && !reducedMotion(), gold: value.settings?.gold === true, autoFullscreen: value.settings?.autoFullscreen !== false, vibration: value.settings?.vibration === true },
      crates: { count: count(value.crates?.count), hashes: Array.isArray(value.crates?.hashes) ? [...new Set<string>(value.crates.hashes.filter((h: unknown) => typeof h === 'string' && /^0x[0-9a-f]{64}$/.test(h)))].slice(-500) : [] } }
  } catch { return defaults }
}
export function writeSave(save: Save): boolean {
  try { localStorage.setItem('knock-siege-v1', JSON.stringify(save)); return true } catch { return false }
}
// Candy Crates bought with $KNOCK: each purchase's transaction hash is credited once; count is how many are left to use.
export const CRATE_CANDY = 80
export function creditCrate(save: Save, hash: string): Save | null {
  const key = hash.toLowerCase()
  return save.crates.hashes.includes(key) ? null : { ...save, crates: { count: save.crates.count + 1, hashes: [...save.crates.hashes, key] } }
}
export const consumeCrate = (save: Save): Save | null => save.crates.count ? { ...save, crates: { ...save.crates, count: save.crates.count - 1 } } : null
