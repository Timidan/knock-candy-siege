import { useEffect, useState } from 'react'
import { Sticker } from '../ui'
import { ENEMIES } from '../siege/data/config'
import { LEVELS } from '../siege/data/level1'
import { SHOP_ITEMS } from '../siege/data/shop'
import { STATS_URL } from '../siege/telemetry'
import './stats.css'

// The shape of GET /stats from the siege-stats Worker (knock/stats).
type Stats = {
  generatedAt: string
  players: { allTime: number; today: number; last7Days: number; daily: { day: string; players: number }[] }
  runs: { started: number; finished: number; wins: number; quits: number; playSeconds: number }
  kills: { total: number; byKind: { kind: string; n: number }[] }
  bosses: { total: number; byName: { name: string; n: number }[] }
  heroes: { id: number; runs: number }[]
  levels: { level: string; runs: number }[]
  stars: number
  grants: number
  purchases: { total: number; byItem: { item: string; n: number }[] }
}
type Legends = { legends: Record<string, { name: string }>; greatPumpkin: { name: string } }
type Row = { key: string; label: string; n: number; color?: string }

const fmt = (n: number) => n.toLocaleString('en-US')
const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`
const day = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
function playTime(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60)
  return hours ? `${fmt(hours)}h ${minutes}m` : `${minutes}m`
}
function ago(seconds: number) {
  return seconds < 5 ? 'just now' : seconds < 120 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`
}
const skeletons = (stats: Stats) => stats.kills.byKind.find(row => row.kind === 'skeleton')?.n ?? 0
function shareText(stats: Stats) {
  const bones = skeletons(stats)
  return `${plural(stats.players.allTime, 'player has', 'players have')} stopped ${plural(stats.kills.total, 'monster')}${bones ? `, ${fmt(bones)} of them skeletons,` : ''} in Knock: Candy Siege 🎃 ${location.host}/stats`
}
// Names come from the game's own data; anything the game does not know is never printed.
function killRows(stats: Stats): Row[] {
  const known = stats.kills.byKind.filter(row => Object.hasOwn(ENEMIES, row.kind))
  const rows: Row[] = known.map(row => { const enemy = ENEMIES[row.kind as keyof typeof ENEMIES]; return { key: row.kind, label: enemy.name, n: row.n, color: hex(enemy.color) } })
  const others = stats.kills.total - known.reduce((sum, row) => sum + row.n, 0)
  return others > 0 ? [...rows, { key: 'others', label: 'Others', n: others }] : rows
}
function levelRows(stats: Stats): Row[] {
  return stats.levels.flatMap(row => {
    const label = row.level === 'endless' ? 'Endless · Town Square' : row.level === 'daily' ? 'Daily challenge' : LEVELS.find(level => String(level.id) === row.level && !level.endless)?.name
    return label ? [{ key: row.level, label, n: row.runs }] : []
  })
}
function bossRows(stats: Stats, legends: Legends | null): Row[] {
  if (!legends) return []
  return stats.bosses.byName.flatMap(row => {
    const label = row.name === 'pumpkin' ? legends.greatPumpkin.name : Object.hasOwn(legends.legends, row.name) ? legends.legends[row.name].name : ''
    return label ? [{ key: row.name, label, n: row.n }] : []
  })
}
function itemRows(stats: Stats): Row[] {
  return stats.purchases.byItem.flatMap(row => {
    const item = SHOP_ITEMS.find(shopItem => String(shopItem.id) === row.item)
    return item ? [{ key: row.item, label: item.name, n: row.n }] : []
  })
}

function Bars({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="stats-empty">{empty}</p>
  const max = Math.max(...rows.map(row => row.n))
  return <ul className="stats-bars">{rows.map(row => <li key={row.key}>
    <span>{row.label}</span><b>{fmt(row.n)}</b>
    <i aria-hidden="true" style={{ width: `${Math.max(2, row.n / max * 100)}%`, background: row.color }} />
  </li>)}</ul>
}
function Tile({ n, label, sub }: { n: number; label: string; sub: string }) {
  return <div className="board stats-tile"><strong>{fmt(n)}</strong><span>{label}</span><small>{sub}</small></div>
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(!STATS_URL)
  const [legends, setLegends] = useState<Legends | null>(null)
  const [now, setNow] = useState(Date.now)
  const [copied, setCopied] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { document.title = 'Live stats · Knock: Candy Siege' }, [])
  useEffect(() => { void fetch('/siege/legends.json').then(response => response.json()).then(setLegends).catch(() => { /* Bosses stay unnamed. */ }) }, [])
  useEffect(() => {
    if (!STATS_URL) return
    let active = true
    const load = async () => {
      if (document.hidden) return
      try {
        const response = await fetch(`${STATS_URL}/stats`, { signal: AbortSignal.timeout(10_000) })
        if (!response.ok) throw new Error(`Stats returned ${response.status}`)
        const next: Stats = await response.json()
        if (active) { setStats(next); setFailed(false) }
      } catch { if (active) setFailed(true) }
    }
    void load()
    const refresh = setInterval(load, 30_000), tick = setInterval(() => setNow(Date.now()), 1000)
    document.addEventListener('visibilitychange', load)
    return () => { active = false; clearInterval(refresh); clearInterval(tick); document.removeEventListener('visibilitychange', load) }
  }, [attempt])
  const copy = async () => {
    if (!stats) return
    const text = shareText(stats)
    try { await navigator.clipboard.writeText(text); setCopied('Copied. Paste it into a post on X.') }
    catch { setCopied(`Copy this: ${text}`) }
  }
  const age = stats ? Math.max(0, Math.round((now - Date.parse(stats.generatedAt)) / 1000)) : 0
  const daily = stats?.players.daily ?? [], best = Math.max(1, ...daily.map(row => row.players))
  return <main className="stats-page">
    <div className="stats-head">
      <span className="stats-eyebrow">KNOCK: CANDY SIEGE</span>
      <h1>Live <span>stats</span></h1>
      <p className="stats-updated">{stats ? `${failed ? 'Could not refresh. Showing numbers from' : 'Updated'} ${ago(age)} · refreshes every 30 seconds` : ' '}</p>
      <div className="row stats-actions">
        <a className="sticker sticker--orange" href="/">Play Candy Siege →</a>
        <Sticker tone="gold" disabled={!stats} onClick={() => void copy()}>Copy for X</Sticker>
      </div>
      {copied && <p className="stats-copied" role="status">{copied}</p>}
    </div>
    {!stats ? <section className="board stats-status" role="status">
      {failed ? <>
        <h2>The stats are taking a break</h2>
        <p>{STATS_URL ? 'The candy counter did not answer. Trying again every 30 seconds.' : 'Live stats are not switched on for this build.'}</p>
        {STATS_URL && <Sticker onClick={() => { setFailed(false); setAttempt(n => n + 1) }}>Try again</Sticker>}
      </> : <h2>Counting candy wrappers…</h2>}
    </section> : <>
      <section className="stats-headline" aria-label="Headline numbers">
        <Tile n={stats.players.allTime} label="Players" sub={`${fmt(stats.players.today)} today · ${fmt(stats.players.last7Days)} this week`} />
        <Tile n={stats.kills.total} label="Monsters stopped" sub={`${fmt(skeletons(stats))} of them skeletons`} />
        <Tile n={stats.runs.started} label="Runs" sub={`${fmt(stats.runs.finished)} finished · ${fmt(stats.runs.wins)} won`} />
        <Tile n={stats.bosses.total} label="Bosses defeated" sub={`${plural(stats.bosses.byName.find(row => row.name === 'pumpkin')?.n ?? 0, 'Great Pumpkin')} among them`} />
      </section>
      <ul className="stats-chips" aria-label="More numbers">
        <li><b>{playTime(stats.runs.playSeconds)}</b> played</li>
        <li><b>{fmt(stats.stars)}</b> {stats.stars === 1 ? 'star' : 'stars'} earned</li>
        <li><b>{fmt(stats.runs.quits)}</b> {stats.runs.quits === 1 ? 'run' : 'runs'} left early</li>
        <li><b>{fmt(stats.grants)}</b> starter {stats.grants === 1 ? 'grant' : 'grants'} paid</li>
        <li><b>{fmt(stats.purchases.total)}</b> shop {stats.purchases.total === 1 ? 'purchase' : 'purchases'}</li>
      </ul>
      <div className="stats-grid">
        <section className="board" aria-labelledby="stats-kills"><h2 id="stats-kills">Who got stopped</h2><Bars rows={killRows(stats)} empty="Nobody has been stopped yet. The porch awaits." /></section>
        <section className="board" aria-labelledby="stats-days">
          <h2 id="stats-days">Players per day</h2>
          <ol className="stats-days">{daily.map(row => <li key={row.day} title={`${day(row.day, { day: 'numeric', month: 'short' })}: ${plural(row.players, 'player')}`} aria-label={`${day(row.day, { day: 'numeric', month: 'long' })}: ${plural(row.players, 'player')}`}>
            <span style={{ height: `${row.players / best * 100}%` }} /><small aria-hidden="true">{Number(row.day.slice(8))}</small>
          </li>)}</ol>
          <p className="stats-note">Last 14 days, UTC. Today: {plural(stats.players.today, 'player')}.</p>
        </section>
        <section className="board" aria-labelledby="stats-heroes">
          <h2 id="stats-heroes">Favourite heroes</h2>
          {stats.heroes.length ? <ol className="stats-heroes">{stats.heroes.map(hero => <li key={hero.id}>
            <img src={`/chogs-256/${hero.id}.webp`} alt="" width="88" height="88" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
            <span>Chog #{hero.id}</span><b>{plural(hero.runs, 'run')}</b>
          </li>)}</ol> : <p className="stats-empty">No heroes on porch duty yet.</p>}
        </section>
        <section className="board" aria-labelledby="stats-levels"><h2 id="stats-levels">Most-played porches</h2><Bars rows={levelRows(stats)} empty="No runs yet. Be the first." /></section>
        <section className="board" aria-labelledby="stats-bosses"><h2 id="stats-bosses">Bosses defeated</h2><Bars rows={bossRows(stats, legends)} empty="No boss has fallen yet." /></section>
        {stats.purchases.total > 0 && <section className="board" aria-labelledby="stats-shop"><h2 id="stats-shop">Shop favourites</h2><Bars rows={itemRows(stats)} empty="" /></section>}
      </div>
    </>}
    <p className="stats-privacy">Anonymous by design: each browser gets a random id. No wallet or IP address is stored; a salted IP hash is kept for one day only to stop spam. Opt out any time in the game’s Settings.</p>
  </main>
}
