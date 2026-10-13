import { PROTOCOL, INPUT_DELAY, MAX_DELAY, TICK_RATE, HASH_EVERY, ROOM_CODE, BUILD, MAX_PACKET_BYTES } from './protocol'
import type { ClientMessage, HeroSelection, Player, RoomInfo, Roster, ServerMessage } from './protocol'

export type RoomTicket = { room: RoomInfo; hostToken: string; invite: string }
export async function createRoom(relay: string, build: string, level: number, signal?: AbortSignal): Promise<RoomTicket> {
  const response = await fetch(`${relay.replace(/\/$/, '')}/rooms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: PROTOCOL, build, level }), signal: signal ?? AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(response.status === 429 ? 'Too many rooms. Try again in a minute.' : `Room creation failed (${response.status})`)
  return response.json()
}

/** Owns one socket. A lost room is terminal: create a new room to restart. */
export class RoomClient {
  player!: Player
  room!: RoomInfo
  roster: Roster = [null, null]
  private socket: WebSocket
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
  private constructor(socket: WebSocket) { this.socket = socket }

  static connect(relay: string, code: string, build: string, hero: HeroSelection, hostToken?: string): Promise<RoomClient> {
    if (!ROOM_CODE.test(code) || !BUILD.test(build)) return Promise.reject(new Error('Invalid room or build'))
    const url = new URL(`/rooms/${code}/ws`, relay)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    // Host capability is sent in the first frame, never in the URL or invite.
    const socket = new WebSocket(url)
    const client = new RoomClient(socket)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(new Error('Room connection timed out')); client.close() }, 15000)
      let welcomed = false
      socket.onopen = () => socket.send(JSON.stringify({ type: 'claim', hostToken: hostToken ?? null }))
      socket.onmessage = event => {
        if (typeof event.data !== 'string' || event.data.length > MAX_PACKET_BYTES) { client.fail('Invalid relay packet'); return }
        let message: ServerMessage
        try { message = JSON.parse(event.data) } catch { client.fail('Invalid relay packet'); return }
        client.lastSeen = Date.now()
        if (message.type === 'welcome') {
          if (welcomed || message.version !== PROTOCOL || message.delay !== INPUT_DELAY || message.hashEvery !== HASH_EVERY || message.room.build !== build || message.room.code !== code) { reject(new Error('Room version differs. Reload both players.')); clearTimeout(timeout); client.close(); return }
          welcomed = true; clearTimeout(timeout)
          client.player = message.player; client.room = message.room
          client.send({ type: 'hello', version: PROTOCOL, build, hero })
          client.heartbeat = new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' })
          client.heartbeat.onmessage = () => {
            const now = performance.now()
            if (now - client.pingAt < (client.samples.length < 8 ? 350 : 3000)) return
            client.pingAt = now
            if (Date.now() - client.lastSeen > 15000) client.disconnect('No relay messages for 15 seconds')
            else client.send({ type: 'ping', at: now })
          }
          resolve(client)
        } else if (message.type === 'roster') client.roster = message.players
        else if (message.type === 'pong' && Number.isFinite(message.at)) {
          if (message.at >= client.sampleAfter && client.samples.length < 8) client.samples.push(performance.now() - message.at)
          client.tryReady()
        } else if (message.type === 'start') client.delay = message.delay
        if (message.type === 'error' && !welcomed) { clearTimeout(timeout); reject(new Error(message.reason)) }
        if (message.type === 'error' || message.type === 'desync' || message.type === 'disconnected') client.terminal = message
        client.emit(message)
        if (client.terminal) client.close()
      }
      socket.onerror = () => { if (!welcomed) reject(new Error('Could not connect to room')); client.disconnect('Connection error'); clearTimeout(timeout) }
      socket.onclose = event => { if (!welcomed) reject(new Error('Room unavailable or full')); client.disconnect(`Connection closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`); clearTimeout(timeout) }
    })
  }
  subscribe(listener: (message: ServerMessage) => void): () => void {
    this.listeners.add(listener)
    if (this.terminal) listener(this.terminal)
    return () => { this.listeners.delete(listener) }
  }
  send(message: ClientMessage) {
    if (!this.closed && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }
  ready(hash: string) {
    // Measure after asset preparation; loading stalls are not network latency.
    this.readyHash = hash; this.samples = []; this.sampleAfter = performance.now(); this.pingAt = 0
  }
  private tryReady() {
    if (!this.readyHash || this.samples.length < 8 || this.closed) return
    // Fixed for the entire match, agreed by the room from the slower peer's lobby samples.
    // Leave one sampled RTT of headroom for relay/peer scheduling jitter.
    const delay = Math.min(MAX_DELAY, Math.max(INPUT_DELAY, Math.ceil((this.rtt * 2 + 30) * TICK_RATE / 1000)))
    this.send({ type: 'ready', hash: this.readyHash, delay }); this.readyHash = ''
  }
  close() {
    this.closed = true; this.heartbeat?.terminate()
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) this.socket.close(1000, 'Left room')
  }
  private emit(message: ServerMessage) { for (const listener of this.listeners) listener(message) }
  private fail(reason: string) { this.terminal = { type: 'error', reason }; this.emit(this.terminal); this.close() }
  private disconnect(reason: string) {
    if (this.closed || this.terminal) return
    this.terminal = { type: 'disconnected', player: this.player === 0 ? 1 : 0, reason }
    this.emit(this.terminal); this.close()
  }
}
