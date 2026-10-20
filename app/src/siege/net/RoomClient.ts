import { PROTOCOL, INPUT_DELAY, MAX_DELAY, TICK_RATE, HASH_EVERY, ROOM_CODE, BUILD, MAX_PACKET_BYTES, GRACE_MS, SEAT } from './protocol'
import type { ClientMessage, HeroSelection, Player, RoomInfo, Roster, ServerMessage } from './protocol'
import { timeoutSignal } from '../../abort'

export type RoomTicket = { room: RoomInfo; hostToken: string; invite: string }
export async function createRoom(relay: string, build: string, level: number, signal?: AbortSignal): Promise<RoomTicket> {
  const response = await fetch(`${relay.replace(/\/$/, '')}/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: PROTOCOL, build, level }), signal: signal ?? timeoutSignal(15000),
  })
  if (!response.ok) throw new Error(response.status === 429 ? 'Too many rooms. Try again in a minute.' : `Room creation failed (${response.status})`)
  return response.json()
}

const STALE_MS = 8000 // Pongs come every 3 s: two missed means the link is gone, even without a close event.

/**
 * Owns one seat. A dropped socket resumes the seat on a new one, within the relay's grace, with its token: the relay
 * sends what this seat missed and this client re-sends what the relay did not get. A lost room is terminal.
 */
export class RoomClient {
  player!: Player
  room!: RoomInfo
  roster: Roster = [null, null]
  joined: [boolean, boolean] = [false, false]
  private socket: WebSocket | null = null
  private listeners = new Set<(message: ServerMessage) => void>()
  private heartbeat?: Worker
  private pingAt = 0
  private samples: number[] = []
  private sampleAfter = 0
  private readyHash = ''
  delay = INPUT_DELAY
  get rtt() { return this.samples.length ? Math.max(...this.samples) : 0 }
  private lastSeen = Date.now()
  private closed = false
  private terminal: ServerMessage | null = null
  private seat = ''
  // Seats whose socket is down (this one's own link included) while the relay holds them.
  private away: [boolean, boolean] = [false, false]
  get awayNote() { return this.away[this.player] ? 'Reconnecting…' : this.away[1 - this.player] ? 'Partner reconnecting…' : '' }
  // Sent messages the relay may not have, numbered as it counts them (pings aside); an input's echo confirms it and all before it.
  private outbox: { n: number; message: ClientMessage }[] = []
  private sent = 0
  // What this seat has received this round, for the relay to send the rest on resume.
  private seen = { started: false, inputs: [0, 0] as [number, number], verified: 0 }
  private droppedAt = 0
  private attempts = 0
  private retry?: ReturnType<typeof setTimeout>
  private reopen = () => {}
  private constructor() {}

  /** Takes a seat without a Chog; pick() sends it, so a friend can wait in the lobby while choosing. */
  static connect(relay: string, code: string, build: string, hostToken?: string): Promise<RoomClient> {
    if (!ROOM_CODE.test(code) || !BUILD.test(build)) return Promise.reject(new Error('Invalid room or build'))
    const url = new URL(`/rooms/${code}/ws`, relay)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const client = new RoomClient()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('Room connection timed out')); client.close() }, 15000)
      let welcomed = false
      // Host capability and the seat token are sent in the first frame, never in the URL or invite.
      const open = (first: object) => {
        const socket = new WebSocket(url)
        client.socket = socket
        socket.onopen = () => socket.send(JSON.stringify(first))
        socket.onmessage = event => {
          if (socket !== client.socket) return
          if (typeof event.data !== 'string' || event.data.length > MAX_PACKET_BYTES) { client.fail('Invalid relay packet'); return }
          let message: ServerMessage
          try { message = JSON.parse(event.data) } catch { client.fail('Invalid relay packet'); return }
          client.lastSeen = Date.now()
          if (message.type === 'welcome') {
            if (welcomed || message.version !== PROTOCOL || message.delay !== INPUT_DELAY || message.hashEvery !== HASH_EVERY || message.room.build !== build || message.room.code !== code || typeof message.seat !== 'string' || !SEAT.test(message.seat)) { reject(new Error('Room version differs. Reload both players.')); clearTimeout(timeout); client.close(); return }
            welcomed = true; clearTimeout(timeout)
            client.player = message.player; client.room = message.room; client.seat = message.seat
            client.send({ type: 'hello', version: PROTOCOL, build })
            client.heartbeat = new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' })
            client.heartbeat.onmessage = () => {
              const now = performance.now()
              if (client.droppedAt || now - client.pingAt < (client.samples.length < 8 ? 350 : 3000)) return
              client.pingAt = now
              if (Date.now() - client.lastSeen > STALE_MS) client.lost(() => true)
              else client.send({ type: 'ping', at: now })
            }
            document.addEventListener('visibilitychange', client.wake); window.addEventListener('online', client.wake)
            resolve(client)
          } else if (message.type === 'resumed') {
            const seq = message.seq
            if (!client.droppedAt || !Number.isInteger(seq) || seq < client.sent - client.outbox.length || seq > client.sent) { client.fail('Invalid relay packet'); return }
            client.droppedAt = 0; client.attempts = 0; client.away = [false, false] // The relay says next if the partner is still away.
            client.outbox = client.outbox.filter(entry => entry.n >= seq)
            for (const { message } of client.outbox) socket.send(JSON.stringify(message))
            message = { type: 'back', player: client.player }
          } else if (message.type === 'roster') { client.roster = message.players; client.joined = message.joined }
          else if (message.type === 'round') {
            if (message.room?.code !== code || message.room.build !== build) { client.fail('Invalid relay packet'); return }
            client.room = message.room; client.seen = { started: false, inputs: [0, 0], verified: 0 }
          } else if (message.type === 'pong' && Number.isFinite(message.at)) {
            if (message.at >= client.sampleAfter && client.samples.length < 8) client.samples.push(performance.now() - message.at)
            client.tryReady()
          } else if (message.type === 'start') { client.delay = message.delay; client.seen.started = true }
          else if (message.type === 'input') {
            if (message.tick === client.seen.inputs[message.player]) client.seen.inputs[message.player]++
            if (message.player === client.player) {
              const tick = message.tick, echoed = client.outbox.findIndex(entry => entry.message.type === 'input' && entry.message.tick === tick)
              if (echoed >= 0) client.outbox.splice(0, echoed + 1)
            }
          } else if (message.type === 'verified') client.seen.verified = message.tick
          if (message.type === 'error' && !welcomed) { clearTimeout(timeout); reject(new Error(message.reason)) }
          // The room ended or no longer holds this seat: as today, the seat's own connection is what was lost.
          if (message.type === 'error' && client.droppedAt) { client.disconnect('Could not rejoin the room'); return }
          if (message.type === 'error' || message.type === 'desync' || message.type === 'disconnected') client.terminal = message
          client.emit(message)
          if (client.terminal) client.close()
        }
        socket.onerror = () => { if (socket !== client.socket) return; if (!welcomed) { reject(new Error('Could not connect to room')); client.disconnect('Connection error'); clearTimeout(timeout) } else client.lost(current => current === socket) }
        socket.onclose = event => { if (socket !== client.socket) return; if (!welcomed) { reject(new Error('Room unavailable or full')); client.disconnect(`Connection closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`); clearTimeout(timeout) } else client.lost(current => current === socket) }
      }
      client.reopen = () => {
        open({ type: 'resume', seat: client.seat, seed: client.room.seed, ...client.seen })
        const socket = client.socket
        setTimeout(() => { if (client.droppedAt) client.lost(current => current === socket) }, 5000) // An attempt not resumed by now is abandoned.
      }
      open({ type: 'claim', hostToken: hostToken ?? null })
    })
  }
  subscribe(listener: (message: ServerMessage) => void): () => void {
    this.listeners.add(listener)
    if (this.terminal) listener(this.terminal)
    return () => { this.listeners.delete(listener) }
  }
  pick(hero: HeroSelection) { this.send({ type: 'hero', hero }) }
  send(message: ClientMessage) {
    if (this.closed) return
    if (message.type !== 'ping') this.outbox.push({ n: this.sent++, message })
    if (!this.droppedAt && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }
  ready(hash: string) {
    // Measure after asset preparation; loading stalls are not network latency.
    this.readyHash = hash; this.samples = []; this.sampleAfter = performance.now(); this.pingAt = 0
  }
  private tryReady() {
    if (!this.readyHash || this.samples.length < 8 || this.closed) return
    // Tick T's input leaves at T - delay and both peers wait for the relay's copy, so the window is one sender RTT:
    // a later start on the receiving side cancels its own downlink. The window also carries that downlink's change
    // since start, so it varies by about sqrt(2) RTT deviations; three of those cover jitter, and one more tick covers
    // inputs leaving on tick boundaries. The room keeps the larger peer value for the whole match.
    const mean = this.samples.reduce((sum, rtt) => sum + rtt, 0) / this.samples.length
    const sd = Math.sqrt(this.samples.reduce((sum, rtt) => sum + (rtt - mean) ** 2, 0) / this.samples.length)
    const delay = Math.min(MAX_DELAY, Math.max(INPUT_DELAY, Math.ceil((mean + 3 * Math.SQRT2 * sd) * TICK_RATE / 1000) + 1))
    this.send({ type: 'ready', hash: this.readyHash, delay }); this.readyHash = ''
  }
  close() {
    this.closed = true; this.heartbeat?.terminate(); clearTimeout(this.retry)
    document.removeEventListener('visibilitychange', this.wake); window.removeEventListener('online', this.wake)
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) this.socket.close(1000, 'Left room')
  }
  private emit(message: ServerMessage) {
    if (message.type === 'away' || message.type === 'back') this.away[message.player] = message.type === 'away'
    for (const listener of this.listeners) listener(message)
  }
  private fail(reason: string) { this.terminal = { type: 'error', reason }; this.emit(this.terminal); this.close() }
  private disconnect(reason: string) {
    if (this.closed || this.terminal) return
    this.terminal = { type: 'disconnected', player: this.player === 0 ? 1 : 0, reason }
    this.emit(this.terminal); this.close()
  }
  /** Drops the current socket if it is the one meant, and tries again after a backoff: 0, 0.5, 1, 2, then every 3 s (about a dozen upgrades in the grace, under the relay's 30 a minute per address). */
  private lost(meant: (socket: WebSocket) => boolean) {
    const socket = this.socket
    if (!socket || !meant(socket) || this.closed || this.terminal) return
    this.socket = null
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
    // Not 'Left room': the relay holds the seat for a close it does see.
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(4000, 'Reconnecting')
    if (!this.droppedAt) { this.droppedAt = Date.now(); this.attempts = 0; this.emit({ type: 'away', player: this.player }) }
    // The last attempt is at the end of the relay's grace.
    const left = this.droppedAt + GRACE_MS - Date.now()
    if (left <= 0) { this.disconnect('Could not rejoin the room'); return }
    this.retry = setTimeout(this.reopen, Math.min(left, 3000, this.attempts && 250 * 2 ** this.attempts))
    this.attempts++
  }
  // A phone that hid the page may have lost its socket without a close event: check at once rather than after the stale timer.
  private wake = () => {
    if (document.hidden || this.closed || this.terminal) return
    if (this.droppedAt) { if (!this.socket) { clearTimeout(this.retry); this.reopen() } }
    else if (this.socket?.readyState !== WebSocket.OPEN || Date.now() - this.lastSeen > 4000) this.lost(() => true)
  }
}
