import type { Command } from '../SiegeScene'
import { CONSUMABLES, SPECIALISATIONS, SPELLS, TARGETING, TOWERS, TRAPS } from '../data/config'

export const PROTOCOL = 3
export const TICK_RATE = 45
export const INPUT_DELAY = 6
export const MAX_DELAY = 45
export const HASH_EVERY = 90
export const MAX_COMMANDS = 16
export const MAX_PACKET_BYTES = 4096
export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{10}$/
export const HASH = /^[a-f0-9]{16}$/
export const BUILD = /^[a-zA-Z0-9._-]{1,96}$/
export type Player = 0 | 1
export type CoopCommand = Exclude<Command, { type: 'speed' }>
export type HeroSelection = {
  id: number; home: boolean; costume: string; owned: number[]; victoryDance: string
  stars: Record<string, number>; street: { candy: number; trap: boolean; chog: boolean; crew: number }
}
export type RoomInfo = { code: string; seed: number; level: number; build: string }
export type Roster = [HeroSelection | null, HeroSelection | null]
export type ClientMessage =
  | { type: 'hello'; version: number; build: string; hero: HeroSelection }
  | { type: 'ready'; hash: string; delay: number }
  | { type: 'input'; tick: number; commands: CoopCommand[] }
  | { type: 'hash'; tick: number; hash: string }
  | { type: 'ping'; at: number }
export type ServerMessage =
  | { type: 'welcome'; version: number; player: Player; room: RoomInfo; delay: number; hashEvery: number }
  | { type: 'roster'; players: Roster }
  | { type: 'start'; delay: number }
  | { type: 'input'; player: Player; tick: number; commands: CoopCommand[] }
  | { type: 'verified'; tick: number; hash: string }
  | { type: 'desync'; tick: number }
  | { type: 'disconnected'; player: Player; reason: string }
  | { type: 'error'; reason: string }
  | { type: 'pong'; at: number }

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
export const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
const member = (values: object, value: unknown) => typeof value === 'string' && Object.hasOwn(values, value)
export function isHero(value: unknown): value is HeroSelection {
  if (!record(value) || !integer(value.id, 1, 1969) || typeof value.home !== 'boolean' || typeof value.costume !== 'string' || !/^(|crew-(ghosts|witches|pumpkins|bats))$/.test(value.costume)) return false
  if (!Array.isArray(value.owned) || value.owned.length > 64 || !value.owned.every(id => integer(id, 0, 10000))) return false
  if (typeof value.victoryDance !== 'string' || !/^[a-z0-9-]{1,40}$/.test(value.victoryDance)) return false
  if (!record(value.stars) || Object.keys(value.stars).length > 6 || !Object.entries(value.stars).every(([key, stars]) => /^[1-6]$/.test(key) && integer(stars, 0, 3))) return false
  const s = value.street
  return record(s) && integer(s.candy, 0, 1000) && typeof s.trap === 'boolean' && typeof s.chog === 'boolean' && integer(s.crew, 0, 4)
}
export function isCommand(value: unknown): value is CoopCommand {
  if (!record(value)) return false
  const pad = () => integer(value.pad, 0, 11)
  const point = () => typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1920 && typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1080
  switch (value.type) {
    case 'build': return pad() && member(TOWERS, value.kind)
    case 'upgrade': case 'sell': return pad()
    case 'specialise': return pad() && member(SPECIALISATIONS, value.spec)
    case 'target': return pad() && (TARGETING as readonly unknown[]).includes(value.targeting)
    case 'consumable': return point() && member(CONSUMABLES, value.kind)
    case 'trap': return point() && member(TRAPS, value.kind)
    case 'spell': return point() && member(SPELLS, value.kind)
    case 'move': return point()
    case 'ability': case 'ultimate': case 'wave': return true
    case 'emote': return typeof value.name === 'string' && /^[a-z0-9-]{1,40}$/.test(value.name)
    case 'talent': return integer(value.index, 0, 1) && (value.level === undefined || integer(value.level, 2, 5))
    case 'prop': return integer(value.index, 0, 63)
    default: return false // No local pause or speed command in co-op.
  }
}
export function isClientMessage(value: unknown): value is ClientMessage {
  if (!record(value)) return false
  switch (value.type) {
    case 'hello': return value.version === PROTOCOL && typeof value.build === 'string' && BUILD.test(value.build) && isHero(value.hero)
    case 'ready': return typeof value.hash === 'string' && HASH.test(value.hash) && integer(value.delay, INPUT_DELAY, MAX_DELAY)
    case 'input': return integer(value.tick, 0, 1_000_000) && Array.isArray(value.commands) && value.commands.length <= MAX_COMMANDS && value.commands.every(isCommand)
    case 'hash': return integer(value.tick, HASH_EVERY, 1_000_000) && value.tick % HASH_EVERY === 0 && typeof value.hash === 'string' && HASH.test(value.hash)
    case 'ping': return typeof value.at === 'number' && Number.isFinite(value.at) && value.at >= 0
    default: return false
  }
}
