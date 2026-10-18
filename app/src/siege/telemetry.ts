// Anonymous play stats for the public /stats page: a random id per browser, plus on opening the game the referring
// site's host name and the device type. No wallet, no IP, no full URL.
// Off when VITE_STATS_URL is unset or the player turns it off in Settings. Fire-and-forget: it never throws or waits.
import { timeoutSignal } from '../abort'
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
// The referring site's host name only (no path or query), or direct. t.co and Discord's app variants are folded into one name.
function referrer() {
  let host = ''
  try { host = new URL(document.referrer).hostname.toLowerCase().replace(/^www\./, '') } catch { /* No referrer. */ }
  if (!host || host === location.hostname || host === 'knock.timidan.xyz') return 'direct'
  if (host === 't.co') return 'x.com'
  return host === 'com.discord' || /(^|\.)discord(app)?\.com$/.test(host) ? 'discord.com' : host
}
// A coarse main pointer decides phone or tablet, not the user agent: iPadOS reports a Mac. A touch-screen laptop's
// main pointer is its mouse or trackpad, so it stays a desktop; an iPad with a trackpad attached counts as one too.
function device() {
  const touch = !!window.matchMedia?.('(pointer: coarse)').matches
  return !touch ? 'desktop' : Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet'
}
// A text/plain body keeps this a simple CORS request (no preflight); keepalive lets it finish while the page closes.
export function track(type: 'session' | 'run_start' | 'run_end' | 'grant' | 'purchase', data: Record<string, unknown> = {}) {
  if (!statsEnabled()) return
  try {
    const visit = type === 'session' ? { ref: referrer(), device: device() } : {}
    void fetch(`${STATS_URL}/event`, { method: 'POST', keepalive: true, body: JSON.stringify({ ...data, ...visit, pid: pid(), type }) }).catch(() => {})
  } catch { /* Stats never interrupt play. */ }
}
// A note from the result card. Sending it is the player's own choice, so it goes even with stats off, but then without the browser id.
// Rejects with a message to show: the Worker's own for bad input or a rate limit, otherwise a plain one.
export type FeedbackNote = { level: string; won: boolean; stars: number; hero: number; rating: number | null; text: string }
export async function sendFeedback(note: FeedbackNote) {
  const failed = 'Your feedback didn’t send. Check your connection and try again.'
  const response = await fetch(`${STATS_URL}/feedback`, { method: 'POST', signal: timeoutSignal(15_000),
    body: JSON.stringify({ ...note, device: device(), pid: statsEnabled() ? pid() : undefined }) }).catch(() => { throw new Error(failed) })
  if (!response.ok) throw new Error(response.status < 500 && (await response.json().catch(() => null))?.error || failed)
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
