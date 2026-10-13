// Siege Stats: anonymous play counters for Knock: Candy Siege. Browsers POST /event; the public page reads GET /stats.
const PID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const NAME = /^[a-z0-9-]{1,32}$/
const TYPES = ['session', 'run_start', 'run_end', 'grant', 'purchase']
// Per UTC hour: events per IP and per browser id. Per UTC day: new browser ids per IP, so fake ids cannot add many "players".
const LIMIT = { ip: 120, pid: 60, newPids: 30 }
// No level holds more than ~520 enemies, so a run is scaled down to 5,000 kills in total.
const MAX_BODY = 4096, MAX_NAMES = 60, MAX_KILLS = 3000, MAX_RUN_KILLS = 5000, MAX_SECONDS = 7200
const allowedOrigin = origin => /^https:\/\/([a-z0-9-]+\.)?knock-ej6\.pages\.dev$/.test(origin) ||
  origin === 'https://knock.timidan.xyz' || /^http:\/\/localhost(?::\d+)?$/.test(origin)
const count = (value, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')
const utcDay = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

// Returns an error message, or the event with every field checked and clamped.
function clean(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'JSON object required'
  if (typeof body.pid !== 'string' || !PID.test(body.pid)) return 'Invalid pid'
  if (!TYPES.includes(body.type)) return 'Unknown type'
  const event = { pid: body.pid, type: body.type }
  if (body.type === 'purchase') {
    if (typeof body.item !== 'string' || !NAME.test(body.item)) return 'Invalid item'
    event.item = body.item
  }
  if (body.type === 'run_start' || body.type === 'run_end') {
    if (typeof body.level !== 'string' || !NAME.test(body.level)) return 'Invalid level'
    if (!Number.isInteger(body.hero) || body.hero < 1 || body.hero > 1969) return 'Invalid hero'
    Object.assign(event, { level: body.level, hero: body.hero })
  }
  if (body.type === 'run_end') {
    // Bad names are dropped rather than failing the whole run.
    const named = body.killsByKind && typeof body.killsByKind === 'object' && !Array.isArray(body.killsByKind) ? Object.entries(body.killsByKind) : []
    let kills = named.filter(([kind]) => NAME.test(kind)).slice(0, MAX_NAMES).map(([kind, n]) => [kind, count(n, MAX_KILLS)])
    const total = kills.reduce((sum, [, n]) => sum + n, 0)
    if (total > MAX_RUN_KILLS) kills = kills.map(([kind, n]) => [kind, Math.floor(n * MAX_RUN_KILLS / total)])
    const bosses = {}
    for (const name of (Array.isArray(body.bossesDefeated) ? body.bossesDefeated : []).slice(0, MAX_NAMES))
      if (typeof name === 'string' && NAME.test(name)) bosses[name] = (bosses[name] ?? 0) + 1
    const quit = body.quit === true, won = !quit && body.won === true
    Object.assign(event, { quit, won, stars: won ? count(body.stars, 3) : 0, durationS: count(body.durationS, MAX_SECONDS), kills: Object.fromEntries(kills), bosses })
  }
  return event
}

// One statement adds every {name: n} pair to a tally kind, so an event is a handful of statements however many kinds it carries.
const add = (db, kind, counts) => db.prepare(`INSERT INTO tallies (kind, key, n) SELECT ?, key, value FROM json_each(?) WHERE value > 0
  ON CONFLICT (kind, key) DO UPDATE SET n = n + excluded.n`).bind(kind, JSON.stringify(counts))
const sum = counts => Object.values(counts).reduce((total, n) => total + n, 0)
function writes(db, event, day) {
  const plusOne = 'ON CONFLICT (kind, key) DO UPDATE SET n = n + 1'
  // The player and today's unique count are decided inside this batch's transaction, before the upsert,
  // so simultaneous events from one new id count it once.
  const totals = {}, statements = [
    db.prepare(`INSERT INTO tallies (kind, key, n) SELECT 'total', 'players', 1 WHERE NOT EXISTS (SELECT 1 FROM players WHERE pid = ?) ${plusOne}`).bind(event.pid),
    db.prepare(`INSERT INTO tallies (kind, key, n) SELECT 'day', ?, 1 WHERE NOT EXISTS (SELECT 1 FROM players WHERE pid = ? AND last_day >= ?) ${plusOne}`).bind(day, event.pid, day),
    // The WHERE skips the write (and its index write) for every event after a player's first one of the day.
    db.prepare('INSERT INTO players (pid, last_day) VALUES (?, ?) ON CONFLICT (pid) DO UPDATE SET last_day = excluded.last_day WHERE players.last_day < excluded.last_day').bind(event.pid, day),
  ]
  if (event.type === 'run_start') {
    totals.runs_started = 1
    statements.push(add(db, 'level', { [event.level]: 1 }), add(db, 'hero', { [event.hero]: 1 }))
  }
  if (event.type === 'run_end') {
    Object.assign(totals, { [event.quit ? 'quits' : 'runs_finished']: 1, wins: +event.won, stars: event.stars, play_seconds: event.durationS, kills: sum(event.kills), bosses: sum(event.bosses) })
    statements.push(add(db, 'kill', event.kills), add(db, 'boss', event.bosses))
  }
  if (event.type === 'grant') totals.grants = 1
  if (event.type === 'purchase') {
    totals.purchases = 1
    statements.push(add(db, 'purchase', { [event.item]: 1 }))
  }
  return [...statements, add(db, 'total', totals)]
}

// A random salt per UTC day, shared through D1. Rotating it also deletes the old salt and earlier rate-limit rows.
let salt = { day: '', value: '' }
async function saltFor(db, day) {
  if (salt.day === day) return salt.value
  const results = await db.batch([
    db.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)').bind(day, hex(crypto.getRandomValues(new Uint8Array(16)))),
    db.prepare('DELETE FROM salts WHERE day < ?').bind(day),
    db.prepare('DELETE FROM hits WHERE bucket < ?').bind(day),
    db.prepare('SELECT salt FROM salts WHERE day = ?').bind(day),
  ])
  salt = { day, value: results[3].results[0].salt }
  return salt.value
}

async function readStats(db) {
  const top = (kind, limit) => db.prepare('SELECT key, n FROM tallies WHERE kind = ? ORDER BY n DESC LIMIT ?').bind(kind, limit)
  const [totals, kills, bosses, heroes, levels, purchases, days, week] = (await db.batch([
    db.prepare("SELECT key, n FROM tallies WHERE kind = 'total'"),
    top('kill', MAX_NAMES), top('boss', 30), top('hero', 10), top('level', 20), top('purchase', 30),
    db.prepare("SELECT key, n FROM tallies WHERE kind = 'day' AND key >= ?").bind(utcDay(13)),
    db.prepare('SELECT count(*) AS n FROM players WHERE last_day >= ?').bind(utcDay(6)),
  ])).map(result => result.results)
  const total = Object.fromEntries(totals.map(row => [row.key, row.n])), daily = Object.fromEntries(days.map(row => [row.key, row.n]))
  const value = key => total[key] ?? 0
  return {
    generatedAt: new Date().toISOString(),
    players: { allTime: value('players'), today: daily[utcDay()] ?? 0, last7Days: week[0].n,
      daily: Array.from({ length: 14 }, (_, i) => utcDay(13 - i)).map(day => ({ day, players: daily[day] ?? 0 })) },
    runs: { started: value('runs_started'), finished: value('runs_finished'), wins: value('wins'), quits: value('quits'), playSeconds: value('play_seconds') },
    kills: { total: value('kills'), byKind: kills.map(row => ({ kind: row.key, n: row.n })) },
    bosses: { total: value('bosses'), byName: bosses.map(row => ({ name: row.key, n: row.n })) },
    heroes: heroes.map(row => ({ id: Number(row.key), runs: row.n })),
    levels: levels.map(row => ({ level: row.key, runs: row.n })),
    stars: value('stars'),
    grants: value('grants'),
    purchases: { total: value('purchases'), byItem: purchases.map(row => ({ item: row.key, n: row.n })) },
  }
}

// Each isolate recomputes /stats at most every 30 seconds, however many viewers refresh.
let snapshot = { at: 0, body: '' }
async function readBody(request) {
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return null
  // Bound actual bytes as well; Content-Length can be absent on streamed requests.
  const reader = request.body?.getReader()
  if (!reader) return ''
  let size = 0
  const chunks = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_BODY) { await reader.cancel(); return null }
    chunks.push(value)
  }
  return new Blob(chunks).text()
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin && allowedOrigin(origin)) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers })
    if (origin && !allowedOrigin(origin)) return reply({ error: 'Origin not allowed' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const path = new URL(request.url).pathname
    try {
      if (request.method === 'GET' && path === '/stats') {
        if (Date.now() - snapshot.at > 30_000) {
          try { snapshot = { at: Date.now(), body: JSON.stringify(await readStats(env.DB)) } }
          catch (error) { if (!snapshot.body) throw error } // keep serving the last good numbers through a D1 hiccup
        }
        headers['Cache-Control'] = 'public, max-age=30'
        return new Response(snapshot.body, { headers })
      }
      if (request.method !== 'POST' || path !== '/event') return reply({ error: 'Not found' }, 404)
      const text = await readBody(request)
      if (text === null) return reply({ error: 'Body too large' }, 413)
      let body
      try { body = JSON.parse(text) } catch { return reply({ error: 'Invalid JSON' }, 400) }
      const event = clean(body)
      if (typeof event === 'string') return reply({ error: event }, 400)
      const ip = request.headers.get('CF-Connecting-IP')
      if (!ip) return reply({ error: 'Client IP unavailable' }, 503)
      const day = utcDay(), hour = new Date().toISOString().slice(0, 13)
      const ipHash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${await saltFor(env.DB, day)}:${ip}`)))
      const bump = (bucket, key) => env.DB.prepare('INSERT INTO hits (bucket, key, n) VALUES (?, ?, 1) ON CONFLICT (bucket, key) DO UPDATE SET n = n + 1 RETURNING n').bind(bucket, key)
      const [byIp, byPid, seen] = await env.DB.batch([bump(hour, `ip:${ipHash}`), bump(hour, `pid:${event.pid}`), env.DB.prepare('SELECT 1 FROM players WHERE pid = ?').bind(event.pid)])
      if (byIp.results[0].n > LIMIT.ip) return reply({ error: 'Too many events from this network' }, 429)
      if (byPid.results[0].n > LIMIT.pid) return reply({ error: 'Too many events from this browser' }, 429)
      // This read only gates the new-id limit; a rare race here just counts one extra id toward that limit.
      if (!seen.results[0] && (await bump(day, `new:${ipHash}`).first()).n > LIMIT.newPids) return reply({ error: 'Too many new players from this network today' }, 429)
      await env.DB.batch(writes(env.DB, event, day))
      return new Response(null, { status: 204, headers })
    } catch {
      return reply({ error: 'Stats temporarily unavailable' }, 503)
    }
  },
}
