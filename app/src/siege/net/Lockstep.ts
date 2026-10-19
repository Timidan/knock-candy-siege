import { HASH_EVERY, INPUT_DELAY, MAX_DELAY, MAX_COMMANDS, TICK_RATE, isCommand } from './protocol'
import type { ClientMessage, CoopCommand, Player, ServerMessage } from './protocol'
import { hashState } from './hash'

export type StopReason = 'desync' | 'disconnected' | 'error'
export const STOP_TEXT: Record<StopReason, string> = {
  desync: 'Out of sync: restart together', disconnected: 'Partner disconnected', error: 'Could not continue this room',
}
export type Simulation = {
  command: (player: Player, command: CoopCommand) => void
  step: (dt: number, tick: number) => void
  snapshot: () => unknown
}
type Options = {
  send: (packet: ClientMessage) => void
  onStop: (reason: StopReason, message: string) => void
  onHash?: (tick: number, hash: string) => void
}

/** Clocked by the scene, never by packet arrival. No prediction or rollback. */
export class Lockstep {
  tick = 0 // Next tick; hash T describes state after inputs [0, T).
  state: 'waiting' | 'running' | StopReason = 'waiting'
  verifiedTick = 0
  detail = ''
  delay = INPUT_DELAY
  private packets: [Map<number, CoopCommand[]>, Map<number, CoopCommand[]>] = [new Map(), new Map()]
  private nextReceived = [0, 0]
  private pending: CoopCommand[] = []
  private sent = new Map<number, CoopCommand[]>() // own commands in flight, by the tick they run
  private hashes = new Map<number, string>()
  private simulation: Simulation
  private options: Options
  constructor(simulation: Simulation, options: Options) { this.simulation = simulation; this.options = options }

  enqueue(command: CoopCommand): boolean {
    if (this.state !== 'running' || this.pending.length >= MAX_COMMANDS || !isCommand(command)) return false
    this.pending.push(structuredClone(command)); return true
  }
  receive(message: ServerMessage) {
    if (this.state !== 'waiting' && this.state !== 'running') return
    if (message.type === 'start') {
      if (this.state !== 'waiting' || !Number.isInteger(message.delay) || message.delay < INPUT_DELAY || message.delay > MAX_DELAY) { this.stop('error'); return }
      this.delay = message.delay
      this.state = 'running'
      for (let tick = 0; tick < this.delay; tick++) this.options.send({ type: 'input', tick, commands: [] })
    } else if (message.type === 'input') {
      const { player, tick, commands } = message
      // A peer may consume our primed window before our next render frame.
      if (this.state !== 'running' || (player !== 0 && player !== 1) || tick !== this.nextReceived[player] || tick > this.tick + 2 * this.delay || !Array.isArray(commands) || commands.length > MAX_COMMANDS || !commands.every(isCommand)) { this.stop('error'); return }
      this.nextReceived[player]++; this.packets[player].set(tick, commands)
    } else if (message.type === 'verified') {
      if (message.tick !== this.verifiedTick + HASH_EVERY || message.hash !== this.hashes.get(message.tick)) { this.stop('desync'); return }
      this.verifiedTick = message.tick; this.hashes.delete(message.tick)
    } else if (message.type === 'desync') this.stop('desync')
    else if (message.type === 'disconnected') { this.detail = message.reason; this.stop('disconnected') }
    else if (message.type === 'error') { this.detail = message.reason; this.stop('error') }
  }

  /** Call at 45 Hz. false means keep rendering, but do not advance simulation. */
  advance(): boolean {
    if (this.state !== 'running' || this.tick - this.verifiedTick >= HASH_EVERY * 2) return false
    const a = this.packets[0].get(this.tick), b = this.packets[1].get(this.tick)
    if (!a || !b) return false
    try {
      for (const command of a) this.simulation.command(0, command)
      for (const command of b) this.simulation.command(1, command)
      this.simulation.step(1 / TICK_RATE, this.tick)
      this.packets[0].delete(this.tick); this.packets[1].delete(this.tick); this.sent.delete(this.tick)
      const future = this.tick + this.delay
      this.tick++
      const commands = this.pending; this.pending = []
      if (commands.length) this.sent.set(future, commands)
      this.options.send({ type: 'input', tick: future, commands })
      if (this.tick % HASH_EVERY === 0) {
        const hash = hashState(this.simulation.snapshot())
        this.hashes.set(this.tick, hash)
        this.options.onHash?.(this.tick, hash)
        this.options.send({ type: 'hash', tick: this.tick, hash })
      }
      return true
    } catch (error) { this.detail = error instanceof Error ? error.message : String(error); this.stop('error'); return false }
  }
  /** Read-only, for presentation: own commands not yet run, from the tap until their tick (queued, then in flight). */
  own(): readonly CoopCommand[] { return this.sent.size ? [...[...this.sent.values()].flat(), ...this.pending] : this.pending }
  /** Read-only, for presentation: a player's relayed commands for ticks not yet run. */
  relayed(player: Player): ReadonlyMap<number, readonly CoopCommand[]> { return this.packets[player] }
  stop(reason: StopReason) {
    if (this.state !== 'waiting' && this.state !== 'running') return
    this.state = reason; this.pending = []; this.sent.clear(); this.packets.forEach(packets => packets.clear())
    this.options.onStop(reason, STOP_TEXT[reason])
  }
}
