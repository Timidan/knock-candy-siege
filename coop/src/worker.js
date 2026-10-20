import { PROTOCOL, INPUT_DELAY, HASH_EVERY, MAX_PACKET_BYTES, BUILD, ROOM_CODE, GRACE_MS, isClientMessage, isResume, integer, record } from '../../app/src/siege/net/protocol.ts'

const LIFETIME = 60 * 60 * 1000
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
export function allowedOrigin(origin) {
  return origin === 'https://knock.timidan.xyz' || /^https:\/\/[a-z0-9-]+\.knock-ej6\.pages\.dev$/.test(origin ?? '') || /^http:\/\/localhost(?::[0-9]{1,5})?$/.test(origin ?? '')
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin')
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, protocol: PROTOCOL, service: 'knock-coop' })
    if (!allowedOrigin(origin)) return json({ error: 'Origin not allowed' }, 403)
    const headers = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (url.pathname === '/rooms' && request.method === 'POST') {
      const { success } = await env.CREATE_LIMIT.limit({ key: `create:${request.headers.get('CF-Connecting-IP') ?? 'local'}` })
      if (!success) return json({ error: 'Too many rooms' }, 429, { ...headers, 'Retry-After': '60' })
      if (Number(request.headers.get('Content-Length')) > 512) return json({ error: 'Request too large' }, 413, headers)
      const reader = request.body?.getReader(), chunks = []
      let size = 0
      if (reader) {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 512) { await reader.cancel(); return json({ error: 'Request too large' }, 413, headers) }
            chunks.push(value)
          }
        } catch { return json({ error: 'Invalid body' }, 400, headers) }
        finally { reader.releaseLock() }
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const body = new TextDecoder().decode(bytes)
      let data
      try { data = JSON.parse(body) } catch { return json({ error: 'Invalid JSON' }, 400, headers) }
      if (!record(data) || data.version !== PROTOCOL || typeof data.build !== 'string' || !BUILD.test(data.build) || !integer(data.level, 1, 6)) return json({ error: 'Invalid room options' }, 400, headers)
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const code = Array.from(crypto.getRandomValues(new Uint8Array(10)), byte => alphabet[byte % alphabet.length]).join('')
      const room = { code, build: data.build, level: data.level, seed: crypto.getRandomValues(new Uint32Array(1))[0] }
      const hostToken = crypto.randomUUID()
      const result = await env.ROOMS.getByName(code).fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ room, hostToken, created: Date.now(), started: false, closed: false, seats: [null, null], away: [null, null] }) }))
      if (!result.ok) return json({ error: 'Try creating the room again' }, 409, headers)
      return json({ room, hostToken, invite: `https://knock.timidan.xyz/?room=${code}` }, 201, headers)
    }
    const match = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname)
    if (match && ROOM_CODE.test(match[1]) && request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const { success } = await env.JOIN_LIMIT.limit({ key: `join:${request.headers.get('CF-Connecting-IP') ?? 'local'}` })
      if (!success) return json({ error: 'Too many join attempts' }, 429, { ...headers, 'Retry-After': '60' })
      return env.ROOMS.getByName(match[1]).fetch(request)
    }
    return json({ error: 'Not found' }, 404, headers)
  },
}

/**
 * Hibernating sockets retain their slot, sequence and checkpoint in attachments. A seat whose socket drops is held in
 * meta.away for GRACE_MS: its token resumes it on a new socket, and the relay sends the inputs and checkpoints it missed.
 */
export class PorchRoom {
  constructor(ctx) {
    this.ctx = ctx
    this.meta = null
    // This round's relayed inputs and checkpoints, trimmed to what a returning seat can still need. Written to storage
    // only while a seat is away. ponytail: if the object is evicted while both sockets are silently dead, a resume that
    // needs the lost tail ends the room instead.
    this.log = []
    ctx.blockConcurrencyWhile(async () => {
      const [meta, log] = await Promise.all([ctx.storage.get('room'), ctx.storage.get('log')])
      this.meta = meta ?? null
      if (this.meta) { this.meta.seats ??= [null, null]; this.meta.away ??= [null, null] }
      this.log = log && log.seed === this.meta?.room.seed ? log.entries : []
    })
  }
  async fetch(request) {
    if (new URL(request.url).pathname === '/init') {
      if (this.meta) return json({ error: 'Already exists' }, 409)
      this.meta = await request.json()
      await this.ctx.storage.put('room', this.meta)
      await this.ctx.storage.setAlarm(Date.now() + 15000)
      return json({ ok: true })
    }
    const pair = new WebSocketPair(), [client, server] = Object.values(pair)
    // Two claimed slots plus a few short-lived sockets waiting to claim or resume (a resume may race the dropped socket's
    // close). A dead or full room still answers on the socket (not hibernatable, never seated): browsers hide a failed
    // upgrade's status, and the friend should read why. A started room takes only resumes, checked on the first frame.
    if (!this.meta || this.meta.closed || Date.now() - this.meta.created > LIFETIME || this.ctx.getWebSockets().length >= 8) {
      server.accept(); server.send(JSON.stringify({ type: 'error', reason: 'Room unavailable or full' })); server.close(1008, 'Room unavailable')
      return new Response(null, { status: 101, webSocket: client })
    }
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ player: null, lastSeen: Date.now(), nextTick: 0, hashTick: 0, hash: null, hello: false, hero: null, ready: null, rateAt: Date.now(), rateCount: 0, seq: 0 })
    return new Response(null, { status: 101, webSocket: client })
  }
  slots(except) {
    const slots = [null, null]
    for (const ws of this.ctx.getWebSockets()) { const state = ws !== except && ws.deserializeAttachment(); if (state?.player === 0 || state?.player === 1) slots[state.player] = { ws, state } }
    this.meta.away.forEach((away, player) => { if (away && !slots[player]) slots[player] = { ws: null, state: away.state } })
    return slots
  }
  save(slot, state) { if (slot.ws) slot.ws.serializeAttachment(state); else this.meta.away[state.player].state = state }
  // A taken seat without a Chog is still choosing.
  roster(except) {
    const slots = this.slots(except), message = { type: 'roster', players: slots.map(slot => slot?.state.hero ?? null), joined: slots.map(Boolean) }
    for (const slot of slots) if (slot) this.send(slot.ws, message)
  }
  // A friend who leaves or times out before picking a Chog frees the seat; the room and its invite stay open for the host.
  free(ws) {
    try { ws.serializeAttachment({ ...ws.deserializeAttachment(), player: null }); ws.close(1000, 'Seat freed') } catch { /* Already closed. */ }
    this.roster(ws)
  }
  send(ws, data) { try { ws?.send(JSON.stringify(data)) } catch { /* close/error event holds the seat */ } }
  broadcast(data) { for (const slot of this.slots()) if (slot) this.send(slot.ws, data) }
  // A rejected seat is not held: its close ends the room.
  reject(ws, reason) {
    try { ws.serializeAttachment({ ...ws.deserializeAttachment(), done: true }) } catch { /* Already closed. */ }
    this.send(ws, { type: 'error', reason }); ws.close(1008, 'Room request rejected')
  }
  record(entry) {
    this.log.push(entry)
    if (this.meta.away.some(Boolean)) this.ctx.storage.put('log', { seed: this.meta.room.seed, entries: this.log })
    this.broadcast(entry)
  }
  // The partner's simulation stalls on the missing inputs meanwhile, as it does for any late packet.
  async hold(state, reason, since) {
    this.meta.away[state.player] = { state, since, reason }
    this.send(this.slots()[1 - state.player]?.ws, { type: 'away', player: state.player })
    await this.ctx.storage.put({ room: this.meta, log: { seed: this.meta.room.seed, entries: this.log } })
  }
  async resume(ws, message) {
    const player = isResume(message) ? this.meta.seats.indexOf(message.seat) : -1, slots = this.slots(), seat = slots[player]
    if (!seat) { this.reject(ws, 'Room unavailable or full'); return }
    // Counts from an earlier round (another seed) start this round from zero; the round and start follow if missed.
    const same = message.seed === this.meta.room.seed, from = same ? message.inputs : [0, 0], verified = same ? message.verified : 0
    const missed = [], counts = [0, 0, 0]
    if (!same) missed.push({ type: 'round', room: this.meta.room })
    if (this.meta.started && !(same && message.started)) missed.push({ type: 'start', delay: this.meta.delay })
    for (const entry of this.log) {
      if (entry.type === 'input' ? entry.tick < from[entry.player] : entry.tick <= verified) continue
      missed.push(entry); counts[entry.type === 'input' ? entry.player : 2]++
    }
    // Lockstep needs every input in order: a gap (or counts the relay never sent) cannot be resumed.
    const checked = Math.min(slots[0]?.state.hashTick ?? 0, slots[1]?.state.hashTick ?? 0)
    if (![0, 1].every(p => counts[p] === (slots[p]?.state.nextTick ?? 0) - from[p]) || counts[2] * HASH_EVERY !== checked - verified) {
      this.reject(ws, 'Could not resume'); await this.end({ type: 'disconnected', player, reason: 'Partner could not rejoin' }); return
    }
    // The old socket may still look open (a silent drop): it no longer holds the seat.
    if (seat.ws) try { seat.ws.serializeAttachment({ ...seat.state, player: null }); seat.ws.close(4000, 'Seat resumed') } catch { /* Already closing. */ }
    const now = Date.now(), partner = slots[1 - player]
    ws.serializeAttachment({ ...seat.state, lastSeen: now, rateAt: now, rateCount: 0 })
    this.meta.away[player] = null
    this.send(ws, { type: 'resumed', seq: seat.state.seq })
    this.roster()
    for (const entry of missed) this.send(ws, entry)
    if (partner && !partner.ws) this.send(ws, { type: 'away', player: 1 - player })
    else this.send(partner?.ws, { type: 'back', player })
    await this.ctx.storage.put('room', this.meta)
  }
  async end(message) {
    if (!this.meta || this.meta.closed) return
    this.meta.closed = true
    this.broadcast(message)
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Room ended')
    await this.ctx.storage.put('room', this.meta)
    await this.ctx.storage.setAlarm(Date.now() + 60000)
  }
  async webSocketMessage(ws, raw) {
    if (!this.meta || this.meta.closed) { ws.close(1000, 'Room ended'); return }
    const state = ws.deserializeAttachment()
    if (typeof raw !== 'string' || raw.length > MAX_PACKET_BYTES) { this.reject(ws, 'Packet too large'); return }
    let message
    try { message = JSON.parse(raw) } catch { this.reject(ws, 'Invalid JSON'); return }
    const now = Date.now()
    if (now - state.rateAt >= 1000) { state.rateAt = now; state.rateCount = 0 }
    if (++state.rateCount > 150) { this.reject(ws, 'Too many packets'); return }
    state.lastSeen = now
    if (state.player === null) {
      if (record(message) && message.type === 'resume') { await this.resume(ws, message); return }
      if (!record(message) || message.type !== 'claim') { this.reject(ws, 'Claim a slot first'); return }
      const player = message.hostToken === this.meta.hostToken ? 0 : message.hostToken === null ? 1 : null
      if (player === null || this.slots()[player] || this.meta.started) { this.reject(ws, 'Room unavailable or full'); return }
      state.player = player; ws.serializeAttachment(state)
      this.meta.seats[player] = crypto.randomUUID()
      this.send(ws, { type: 'welcome', version: PROTOCOL, player, room: this.meta.room, delay: INPUT_DELAY, hashEvery: HASH_EVERY, seat: this.meta.seats[player] })
      this.roster(); await this.ctx.storage.put('room', this.meta); return
    }
    if (!isClientMessage(message)) { this.reject(ws, 'Invalid packet'); return }
    if (message.type === 'ping') { ws.serializeAttachment(state); this.send(ws, { type: 'pong', at: message.at }); return }
    // Every other accepted message counts, so a resumed seat re-sends only what the relay has not seen.
    state.seq++
    if (message.type === 'hello') {
      if (state.hello || this.meta.started || message.build !== this.meta.room.build) { this.reject(ws, 'Build differs or already joined'); return }
      state.hello = true; ws.serializeAttachment(state); return
    }
    const slots = this.slots(), peer = slots[1 - state.player]
    if (message.type === 'hero') {
      if (!state.hello) { this.reject(ws, 'Say hello first'); return }
      // Choices lock once both Chogs are picked: both peers are already loading them. A late change is ignored, not fatal.
      if (state.hero && peer?.state.hero) { ws.serializeAttachment(state); return }
      state.hero = message.hero; ws.serializeAttachment(state); this.roster(); return
    }
    if (!state.hero || !peer?.state.hero) { this.reject(ws, 'Wait for both players'); return }
    if (message.type === 'ready') {
      if (this.meta.started || state.ready) { this.reject(ws, 'Already ready'); return }
      state.ready = message.hash; state.delay = message.delay; ws.serializeAttachment(state)
      if (peer.state.ready) {
        if (peer.state.ready !== state.ready) { await this.end({ type: 'desync', tick: 0 }); return }
        this.meta.delay = Math.max(state.delay, peer.state.delay); this.meta.started = true; this.log = []; await this.ctx.storage.put('room', this.meta)
        this.broadcast({ type: 'start', delay: this.meta.delay })
      }
      return
    }
    if (!this.meta.started) { this.reject(ws, 'Not started'); return }
    if (message.type === 'input') {
      if (message.tick !== state.nextTick || message.tick > peer.state.nextTick + this.meta.delay || message.tick >= state.hashTick + HASH_EVERY + this.meta.delay) { this.reject(ws, 'Invalid input sequence'); return }
      state.nextTick++; ws.serializeAttachment(state)
      this.record({ type: 'input', player: state.player, tick: message.tick, commands: message.commands })
    } else if (message.type === 'hash') {
      if (message.tick !== state.hashTick + HASH_EVERY || message.tick > Math.min(state.nextTick, peer.state.nextTick) || state.hashTick > peer.state.hashTick) { this.reject(ws, 'Invalid hash sequence'); return }
      state.hashTick = message.tick; state.hash = message.hash; ws.serializeAttachment(state)
      if (peer.state.hashTick === state.hashTick) {
        if (peer.state.hash !== state.hash) await this.end({ type: 'desync', tick: state.hashTick })
        else {
          // A seat's simulation is at least its relay input count less the delay; it may still lack the two checkpoints before that.
          const floor = Math.min(state.nextTick, peer.state.nextTick) - this.meta.delay - 2 * HASH_EVERY
          this.log = this.log.filter(entry => entry.tick >= floor)
          this.record({ type: 'verified', tick: state.hashTick, hash: state.hash })
        }
      }
    } else if (message.type === 'next') {
      // The result card's vote: the first one per round stands, and a repeat (a double tap) is ignored, not fatal.
      // Both must name the same night. Each keeps their Chog, with the stars their vote carries.
      if (state.next) { ws.serializeAttachment(state); return }
      state.next = { level: message.level, stars: message.stars }; ws.serializeAttachment(state)
      if (!peer.state.next) return
      if (peer.state.next.level !== message.level) { await this.end({ type: 'error', reason: 'Players chose different nights' }); return }
      // A new round: a new seed and the lifetime of a new room. Each player's inputs for the last round came before their vote.
      this.meta.room = { ...this.meta.room, level: message.level, seed: crypto.getRandomValues(new Uint32Array(1))[0] }
      this.meta.started = false; this.meta.created = Date.now(); this.log = []
      for (const seat of [{ ws, state }, peer]) this.save(seat, { ...seat.state, hero: { ...seat.state.hero, stars: seat.state.next.stars }, next: null, ready: null, nextTick: 0, hashTick: 0, hash: null })
      await this.ctx.storage.put('room', this.meta)
      this.roster(); this.broadcast({ type: 'round', room: this.meta.room })
    }
  }
  // Leaving or a rejected packet ends the room; any other drop holds the seat.
  async webSocketClose(ws, code, reason) {
    const state = ws.deserializeAttachment()
    if (!this.meta || this.meta.closed || (state?.player !== 0 && state?.player !== 1)) return
    if (state.player === 1 && !state.hero) { this.free(ws); return }
    const left = code === 1000 && reason === 'Left room', detail = left ? 'Partner left' : `Partner connection closed (${code ?? 'unknown'}${reason ? `: ${reason.slice(0, 100)}` : ''})`
    if (left || state.done) { await this.end({ type: 'disconnected', player: state.player, reason: detail }); return }
    try { ws.serializeAttachment({ ...state, player: null }) } catch { /* Closed. */ }
    await this.hold(state, detail, Date.now())
  }
  async webSocketError(ws) { await this.webSocketClose(ws, 1011, 'Relay socket error') }
  async alarm() {
    const now = Date.now()
    if (!this.meta || this.meta.closed) { await this.ctx.storage.deleteAll(); return }
    if (now - this.meta.created > LIFETIME || !this.meta.started && now - this.meta.created > 10 * 60 * 1000) { await this.end({ type: 'error', reason: 'Room expired' }); return }
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment()
      if (now - state.lastSeen > (state.player === null ? 10000 : 20000)) {
        if (state.player === null) { try { ws.close(1008, 'Claim timed out') } catch { /* A freed seat may still be closing. */ } }
        else if (state.player === 1 && !state.hero) this.free(ws)
        else {
          // A silent socket (a backgrounded phone, a dead network) is held like a closed one, from when it was last heard.
          try { ws.serializeAttachment({ ...state, player: null }); ws.close(4000, 'Timed out') } catch { /* Already closing. */ }
          await this.hold(state, 'Partner timed out', state.lastSeen)
        }
      }
    }
    const expired = this.meta.away.findIndex(away => away && now - away.since >= GRACE_MS)
    if (expired >= 0) { await this.end({ type: 'disconnected', player: expired, reason: this.meta.away[expired].reason }); return }
    await this.ctx.storage.setAlarm(Math.min(now + 15000, ...this.meta.away.filter(Boolean).map(away => away.since + GRACE_MS)))
  }
}
