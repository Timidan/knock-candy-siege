const addressPattern = /^0x[0-9a-fA-F]{40}$/
const validAddress = value => typeof value === 'string' && addressPattern.test(value) && !/^0x0{40}$/i.test(value)
const allowedOrigin = origin => /^https:\/\/([a-z0-9-]+\.)?knock-ej6\.pages\.dev$/.test(origin) ||
  origin === 'https://knock.timidan.xyz' || /^http:\/\/localhost(?::\d+)?$/.test(origin)
const publicState = row => row ? { state: row.state, ...(row.tx ? { tx: row.tx } : {}) } : { state: 'none' }

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin && allowedOrigin(origin)) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers })
    if (origin && !allowedOrigin(origin)) return reply({ error: 'Origin not allowed' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const path = new URL(request.url).pathname
    if (path === '/queue' || path === '/done') {
      if (!env.BANK_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.BANK_TOKEN}`)
        return reply({ error: 'Unauthorized' }, 401)
    }
    const getClaim = address => env.DB.prepare('SELECT state, tx FROM claims WHERE address = ?').bind(address).first()
    try {
      if (request.method === 'GET' && path.startsWith('/claim/')) {
        const address = path.slice(7)
        if (!validAddress(address)) return reply({ error: 'Invalid address' }, 400)
        return reply(publicState(await getClaim(address.toLowerCase())))
      }
      if (request.method === 'GET' && path === '/queue') {
        const { results } = await env.DB.prepare("SELECT address FROM claims WHERE state = 'queued' ORDER BY created_at, address LIMIT 20").all()
        return reply({ claims: results })
      }
      if (request.method !== 'POST' || !['/claim', '/done'].includes(path)) return reply({ error: 'Not found' }, 404)
      if (Number(request.headers.get('Content-Length') || 0) > 2048) return reply({ error: 'Body too large' }, 413)
      // Bound actual bytes as well; Content-Length can be absent on streamed requests.
      const reader = request.body?.getReader()
      if (!reader) return reply({ error: 'JSON body required' }, 400)
      let size = 0, chunks = []
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.length
        if (size > 2048) { await reader.cancel(); return reply({ error: 'Body too large' }, 413) }
        chunks.push(value)
      }
      let body
      try { body = JSON.parse(await new Blob(chunks).text()) } catch { return reply({ error: 'Invalid JSON' }, 400) }
      if (!validAddress(body?.address)) return reply({ error: 'Invalid address' }, 400)
      const address = body.address.toLowerCase()
      if (path === '/done') {
        const hasTx = typeof body.tx === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.tx)
        const hasError = typeof body.error === 'string' && body.error.trim().length > 0 && body.error.length <= 500
        if (!(hasTx && body.error === undefined || hasError && body.tx === undefined))
          return reply({ error: 'Supply either a transaction hash or an error (1-500 characters)' }, 400)
        await env.DB.prepare("UPDATE claims SET state = ?, tx = ?, error = ? WHERE address = ? AND state = 'queued'")
          .bind(hasTx ? 'paid' : 'failed', hasTx ? body.tx : null, hasError ? body.error : null, address).run()
        const row = await getClaim(address)
        return reply(publicState(row), row ? 200 : 404)
      }
      const existing = await getClaim(address)
      if (existing) return reply(publicState(existing))
      const ip = request.headers.get('CF-Connecting-IP')
      if (!ip) return reply({ error: 'Client IP unavailable' }, 503)
      const day = new Date().toISOString().slice(0, 10)
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${ip}`))
      const ipHash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
      // One statement serializes the IP check and unique-address insert in SQLite.
      await env.DB.prepare(`INSERT OR IGNORE INTO claims (address, state, ip_hash, day, created_at)
        SELECT ?, 'queued', ?, ?, ? WHERE (SELECT count(*) FROM claims WHERE ip_hash = ? AND day = ?) < 3`)
        .bind(address, ipHash, day, Date.now(), ipHash, day).run()
      const row = await getClaim(address)
      return row ? reply(publicState(row)) : reply({ state: 'none', error: 'Daily limit reached (3 claims per IP, UTC)' }, 429)
    } catch {
      return reply({ error: 'Candy Bank temporarily unavailable' }, 503)
    }
  },
}
