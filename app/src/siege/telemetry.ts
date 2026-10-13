// Anonymous play stats for the public /stats page: a random id per browser, no wallet, nothing else.
// Off when VITE_STATS_URL is unset or the player turns it off in Settings. Fire-and-forget: it never throws or waits.
export const STATS_URL = (import.meta.env.VITE_STATS_URL || '').replace(/\/$/, '')
const PID_KEY = 'knock-stats-pid', OFF_KEY = 'knock-stats-off'
let optedOut = false, memoryPid = ''
const stored = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }

// Automated browsers (headless playtests, crawlers) never count.
export const statsEnabled = () => !!STATS_URL && !navigator.webdriver && !optedOut && stored(OFF_KEY) !== '1'
export function setStatsEnabled(on: boolean) {
  optedOut = !on
  try { if (on) localStorage.removeItem(OFF_KEY); else localStorage.setItem(OFF_KEY, '1') } catch { /* This page load still respects it. */ }
}
function pid() {
  let id = stored(PID_KEY)
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = memoryPid ||= crypto.randomUUID()
    try { localStorage.setItem(PID_KEY, id) } catch { /* Keep the in-memory id for this visit. */ }
  }
  return id
}
// A text/plain body keeps this a simple CORS request (no preflight); keepalive lets it finish while the page closes.
export function track(type: 'session' | 'run_start' | 'run_end' | 'grant' | 'purchase', data: Record<string, unknown> = {}) {
  if (!statsEnabled()) return
  try { void fetch(`${STATS_URL}/event`, { method: 'POST', keepalive: true, body: JSON.stringify({ ...data, pid: pid(), type }) }).catch(() => {}) } catch { /* Stats never interrupt play. */ }
}

const slug = (value: unknown) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
type RunStats = { killsByKind: Record<string, number>; bossesDefeated: string[]; wavesCleared: number; durationS: number }
export type RunEnd = { won: boolean; quit: boolean; stars: number; score: number; wave: number; seconds: number }
// The scene's runStats() supplies kills by kind and bosses; without it, the outcome's own numbers are sent.
export function trackRunEnd(scene: object, run: { level: string; hero: number }, end: RunEnd) {
  if (!statsEnabled()) return
  try {
    const stats = (scene as { runStats?: () => RunStats }).runStats?.()
    track('run_end', { ...run, won: end.won, quit: end.quit, stars: end.stars, score: end.score,
      durationS: Math.round(stats?.durationS ?? end.seconds), wavesCleared: stats?.wavesCleared ?? end.wave,
      killsByKind: Object.fromEntries(Object.entries(stats?.killsByKind ?? {}).map(([kind, n]) => [slug(kind), n])),
      bossesDefeated: (stats?.bossesDefeated ?? []).map(slug) })
  } catch { /* Stats never interrupt play. */ }
}
