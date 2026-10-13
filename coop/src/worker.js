import { PROTOCOL, INPUT_DELAY, HASH_EVERY, MAX_PACKET_BYTES, BUILD, ROOM_CODE, isClientMessage, integer, record } from '../../app/src/siege/net/protocol.ts'

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
      const body = await request.text()
      if (body.length > 512) return json({ error: 'Request too large' }, 413, headers)
      let data
      try { data = JSON.parse(body) } catch { return json({ error: 'Invalid JSON' }, 400, headers) }
      if (!record(data) || data.version !== PROTOCOL || typeof data.build !== 'string' || !BUILD.test(data.build) || !integer(data.level, 1, 6)) return json({ error: 'Invalid room options' }, 400, headers)
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const code = Array.from(crypto.getRandomValues(new Uint8Array(10)), byte => alphabet[byte % alphabet.length]).join('')
      const room = { code, build: data.build, level: data.level, seed: crypto.getRandomValues(new Uint32Array(1))[0] }
      const hostToken = crypto.randomUUID()
      const result = await env.ROOMS.getByName(code).fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ room, hostToken, created: Date.now(), started: false, closed: false }) }))
      if (!result.ok) return json({ error: 'Try creating the room again' }, 409, headers)
      return json({ room, hostToken, invite: `https://knock.timidan.xyz/?room=${code}` }, 201, headers)
    }
    const match = /^\/rooms\/([^/]+)\/ws$/.exec(url.pathname)
    if (match && ROOM_CODE.test(match[1]) && request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return env.ROOMS.getByName(match[1]).fetch(request)
    }
    return json({ error: 'Not found' }, 404, headers)
  },
}

/** Hibernating sockets retain their slot, sequence and checkpoint in attachments. */
export class PorchRoom {
  constructor(ctx) {
    this.ctx = ctx
    this.meta = null
    ctx.blockConcurrencyWhile(async () => { this.meta = await ctx.storage.get('room') ?? null })
  }
  async fetch(request) {
    if (new URL(request.url).pathname === '/init') {
      if (this.meta) return json({ error: 'Already exists' }, 409)
      this.meta = await request.json()
      await this.ctx.storage.put('room', this.meta)
      await this.ctx.storage.setAlarm(Date.now() + 15000)
      return json({ ok: true })
    }
    if (!this.meta || this.meta.closed || this.meta.started || Date.now() - this.meta.created > LIFETIME) return json({ error: 'Room unavailable' }, 410)
    // Two claimed slots plus at most two short-lived sockets waiting to claim.
    if (this.ctx.getWebSockets().length >= 4) return json({ error: 'Room full' }, 409)
    const pair = new WebSocketPair(), [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ player: null, lastSeen: Date.now(), nextTick: 0, hashTick: 0, hash: null, hero: null, ready: null, rateAt: Date.now(), rateCount: 0 })
    return new Response(null, { status: 101, webSocket: client })
  }
  slots() {
    const slots = [null, null]
    for (const ws of this.ctx.getWebSockets()) { const state = ws.deserializeAttachment(); if (state?.player === 0 || state?.player === 1) slots[state.player] = { ws, state } }
    return slots
  }
  send(ws, data) { try { ws.send(JSON.stringify(data)) } catch { /* close/error event ends the room */ } }
  broadcast(data) { for (const slot of this.slots()) if (slot) this.send(slot.ws, data) }
  reject(ws, reason) { this.send(ws, { type: 'error', reason }); ws.close(1008, 'Room request rejected') }
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
      if (!record(message) || message.type !== 'claim') { this.reject(ws, 'Claim a slot first'); return }
      const player = message.hostToken === this.meta.hostToken ? 0 : message.hostToken === null ? 1 : null
      if (player === null || this.slots()[player] || this.meta.started) { this.reject(ws, 'Room unavailable or full'); return }
      state.player = player; ws.serializeAttachment(state)
      this.send(ws, { type: 'welcome', version: PROTOCOL, player, room: this.meta.room, delay: INPUT_DELAY, hashEvery: HASH_EVERY })
      return
    }
    if (!isClientMessage(message)) { this.reject(ws, 'Invalid packet'); return }
    if (message.type === 'ping') { ws.serializeAttachment(state); this.send(ws, { type: 'pong' }); return }
    if (message.type === 'hello') {
      if (state.hero || this.meta.started || message.build !== this.meta.room.build) { this.reject(ws, 'Build differs or already joined'); return }
      state.hero = message.hero; ws.serializeAttachment(state)
      this.broadcast({ type: 'roster', players: this.slots().map(slot => slot?.state.hero ?? null) }); return
    }
    const slots = this.slots(), peer = slots[1 - state.player]
    if (!state.hero || !peer?.state.hero) { this.reject(ws, 'Wait for both players'); return }
    if (message.type === 'ready') {
      if (this.meta.started || state.ready) { this.reject(ws, 'Already ready'); return }
      state.ready = message.hash; ws.serializeAttachment(state)
      if (peer.state.ready) {
        if (peer.state.ready !== state.ready) { await this.end({ type: 'desync', tick: 0 }); return }
        this.meta.started = true; await this.ctx.storage.put('room', this.meta)
        this.broadcast({ type: 'start' })
      }
      return
    }
    if (!this.meta.started) { this.reject(ws, 'Not started'); return }
    if (message.type === 'input') {
      if (message.tick !== state.nextTick || message.tick > peer.state.nextTick + INPUT_DELAY || message.tick >= state.hashTick + HASH_EVERY + INPUT_DELAY) { this.reject(ws, 'Invalid input sequence'); return }
      state.nextTick++; ws.serializeAttachment(state)
      this.broadcast({ type: 'input', player: state.player, tick: message.tick, commands: message.commands })
    } else if (message.type === 'hash') {
      if (message.tick !== state.hashTick + HASH_EVERY || message.tick > Math.min(state.nextTick, peer.state.nextTick) || state.hashTick > peer.state.hashTick) { this.reject(ws, 'Invalid hash sequence'); return }
      state.hashTick = message.tick; state.hash = message.hash; ws.serializeAttachment(state)
      if (peer.state.hashTick === state.hashTick) {
        if (peer.state.hash !== state.hash) await this.end({ type: 'desync', tick: state.hashTick })
        else this.broadcast({ type: 'verified', tick: state.hashTick, hash: state.hash })
      }
    }
  }
  async webSocketClose(ws) {
    const state = ws.deserializeAttachment()
    if (state?.player === 0 || state?.player === 1) await this.end({ type: 'disconnected', player: state.player, reason: 'Partner left' })
  }
  async webSocketError(ws) { await this.webSocketClose(ws) }
  async alarm() {
    const now = Date.now()
    if (!this.meta || this.meta.closed) { await this.ctx.storage.deleteAll(); return }
    if (now - this.meta.created > LIFETIME || !this.meta.started && now - this.meta.created > 10 * 60 * 1000) { await this.end({ type: 'error', reason: 'Room expired' }); return }
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment()
      if (now - state.lastSeen > (state.player === null ? 10000 : 20000)) {
        if (state.player === null) ws.close(1008, 'Claim timed out')
        else { await this.end({ type: 'disconnected', player: state.player, reason: 'Partner timed out' }); return }
      }
    }
    await this.ctx.storage.setAlarm(now + 15000)
  }
}
