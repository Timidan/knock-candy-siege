import { startClock } from '../app/src/siege/net/clock'
import { createRoom, RoomClient } from '../app/src/siege/net/RoomClient'
import { Lockstep } from '../app/src/siege/net/Lockstep'
import { canonicalState, hashState } from '../app/src/siege/net/hash'
import { HASH_EVERY } from '../app/src/siege/net/protocol'
import type { ClientMessage, CoopCommand, HeroSelection, Player } from '../app/src/siege/net/protocol'
import { singleHero, legacyReplay } from './single-hero'

declare const __COOP_BUILD__: string
const hero: HeroSelection = { id: 1, home: false, costume: '', owned: [], victoryDance: 'gg', stars: {}, street: { candy: 0, trap: false, chog: false, crew: 0 } }
type Mode = 'replay' | 'desync' | 'disconnect' | 'pace'
const status = (value: string) => { document.querySelector('#status')!.textContent = value }
function commands(tick: number, player: Player): CoopCommand[] {
  const result: CoopCommand[] = []
  if (tick === 0) for (let pad = player; pad < 8; pad += 2) result.push({ type: 'build', pad, kind: (['egg', 'tp', 'lantern', 'patch'] as const)[pad % 4] }, { type: 'upgrade', pad }, { type: 'upgrade', pad })
  if (tick === 6 && player === 0) result.push({ type: 'specialise', pad: 0, spec: 'golden' })
  if (tick === 10 && player === 0) result.push({ type: 'wave' })
  if (tick === 100 && player === 0) result.push({ type: 'move', x: 1060, y: 650 })
  if (tick === 220 && player === 1) result.push({ type: 'ability' })
  if (tick === 400 && player === 0) result.push({ type: 'spell', kind: 'rain', x: 900, y: 600 })
  if (tick === 600) result.push({ type: 'target', pad: 0, targeting: player ? 'strong' : 'last' })
  if (tick === 650 && player === 1) result.push({ type: 'emote', name: 'gg' })
  if (tick === 900 && player === 0) result.push({ type: 'move', x: 1140, y: 750 })
  if (tick === 1000 && player === 1) result.push({ type: 'spell', kind: 'boo', x: 1180, y: 720 })
  if (tick > 0 && tick % 45 === 0 && player === 0) result.push({ type: 'talent', index: 0 })
  return result
}

let active: { client: RoomClient; driver: Lockstep; dispose: () => void } | null = null
const api = {
  build: __COOP_BUILD__,
  create: (relay: string) => createRoom(relay, __COOP_BUILD__, 1),
  legacy: legacyReplay,
  async join(relay: string, code: string, hostToken: string | undefined, mode: Mode = 'replay') {
    const client = await RoomClient.connect(relay, code, __COOP_BUILD__, hostToken)
    client.pick(hero)
    const adapter = await singleHero(client.room.seed, client.player === 1)
    const hashes: { tick: number; hash: string; state: string }[] = []
    const applied: { tick: number; player: Player; command: CoopCommand }[] = []
    const sent: { tick: number; count: number }[] = []
    const stalls: { tick: number; ms: number }[] = []
    const events: unknown[] = []
    const sentAt = new Map<number, number>(), rtt: number[] = []
    let blockedAt = 0, blockedTick = -1, stallMs = 0, planned = -1, stop = '', done = false, delayed = false
    let held: ClientMessage[] | null = null, releaseTimer: ReturnType<typeof setTimeout> | undefined
    let start = performance.now(), finishedAt = 0
    const target = mode === 'replay' || mode === 'pace' ? 1800 : 270
    const send = (packet: ClientMessage) => {
      if (packet.type === 'input') { sent.push({ tick: packet.tick, count: packet.commands.length }); sentAt.set(packet.tick, performance.now()) }
      // Hold a real outbound packet and its successors; the peer must gate at 180.
      if (mode === 'replay' && client.player === 1 && packet.type === 'input' && packet.tick === 180 && !delayed) {
        delayed = true; held = []
        releaseTimer = setTimeout(() => { const packets = held!; held = null; packets.forEach(packet => client.send(packet)) }, 600)
      }
      if (held) held.push(packet); else client.send(packet)
    }
    const driver = new Lockstep({
      command(player, command) { applied.push({ tick: driver.tick, player, command }); adapter.scene.command(command) },
      step(_dt, tick) {
        adapter.step()
        if (mode === 'desync' && client.player === 1 && tick === 134) adapter.scene.candy++
      },
      snapshot: adapter.snapshot,
    }, {
      send,
      onStop(_reason, message) { stop = message; done = true; status(message) },
      onHash(tick, hash) { hashes.push({ tick, hash, state: canonicalState(adapter.snapshot()) }) },
    })
    const unsubscribe = client.subscribe(message => {
      if (message.type !== 'input' && message.type !== 'pong') events.push(message)
      const receive = () => { if (message.type === 'start') start = performance.now(); if (message.type === 'input' && message.player === client.player) { rtt.push(performance.now() - sentAt.get(message.tick)!); sentAt.delete(message.tick) }; driver.receive(message) }
      receive()
    })
    const stopClock = startClock(() => {
      if (done) return false
      if (mode === 'disconnect' && client.player === 1 && driver.tick >= 135) { client.close(); done = true; stop = 'Left room'; return false }
      if (driver.tick === target && driver.verifiedTick === target) { done = true; finishedAt = performance.now(); status(`Verified ${driver.tick} ticks`); return false }
      if (driver.state !== 'running' || driver.tick >= target) return false
      if (planned !== driver.tick) { planned = driver.tick; for (const command of commands(driver.tick, client.player)) if (!driver.enqueue(command)) throw new Error('Command queue rejected script') }
      const advanced = driver.advance()
      if (advanced) {
        if (blockedAt) { const ms = performance.now() - blockedAt; stallMs += ms; if (ms > 100) stalls.push({ tick: blockedTick, ms }); blockedAt = 0 }
      } else if (!blockedAt) { blockedAt = performance.now(); blockedTick = driver.tick }
      status(`${client.player}: tick ${driver.tick}, verified ${driver.verifiedTick}`)
      return advanced
    })
    // Roster arrives before ready; both simulations use hero 1 in this phase only.
    const waitRoster = setInterval(() => {
      if (done) clearInterval(waitRoster)
      else if (client.roster.every(Boolean)) { clearInterval(waitRoster); client.ready(hashState(adapter.snapshot())) }
    }, 20)
    const dispose = () => { stopClock(); clearInterval(waitRoster); clearTimeout(releaseTimer); unsubscribe(); client.close(); adapter.destroy(); active = null }
    active = { client, driver, dispose }
    api.result = () => ({ done, stop, detail: driver.detail, events, tick: driver.tick, verified: driver.verifiedTick, state: driver.state, seed: client.room.seed, build: __COOP_BUILD__, player: client.player, hashes, applied, sent, stalls, stallMs, rtt, seconds: adapter.scene.clock, elapsedMs: (finishedAt || performance.now()) - start, webdriver: navigator.webdriver, delay: driver.delay, hashEvery: HASH_EVERY, candy: adapter.scene.candy, kills: adapter.scene.kills, targeting: adapter.scene.towers[0]?.targeting })
    return { player: client.player, seed: client.room.seed, snapshot: hashState(adapter.snapshot()) }
  },
  result: () => ({}),
  dispose() { active?.dispose() },
  async offline(seed: number, trace: { tick: number; player: Player; command: CoopCommand }[], ticks = 1800) {
    const adapter = await singleHero(seed), hashes = []
    let cursor = 0
    for (let tick = 0; tick < ticks; tick++) {
      while (trace[cursor]?.tick === tick) adapter.scene.command(trace[cursor++].command)
      adapter.step()
      if ((tick + 1) % HASH_EVERY === 0) hashes.push({ tick: tick + 1, hash: hashState(adapter.snapshot()), state: canonicalState(adapter.snapshot()) })
    }
    const result = { hashes, consumed: cursor, seconds: adapter.scene.clock }
    adapter.destroy(); return result
  },
}
Object.assign(window, { coopHarness: api })
status(`Ready · ${__COOP_BUILD__}`)
