import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'

const { default: worker } = await import(pathToFileURL(process.env.WORKER_BUNDLE || `${homedir()}/.cache/knock-coop/worker/worker.js`))
let lookups = 0, cancelled = false
const env = {
  CREATE_LIMIT: { limit: async () => ({ success: true }) },
  JOIN_LIMIT: { limit: async () => ({ success: false }) },
  ROOMS: { getByName() { lookups++; return { fetch: async () => Response.json({ ok: true }) } } },
}
const headers = { Origin: 'http://localhost:5200', 'Content-Type': 'application/json' }
const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(300)) }, cancel() { cancelled = true } })
const oversized = await worker.fetch(new Request('https://relay/rooms', { method: 'POST', headers, body: stream, duplex: 'half' }), env)
assert.equal(oversized.status, 413); assert.equal(cancelled, true); assert.equal(lookups, 0)
const denied = await worker.fetch(new Request('https://relay/rooms/ABCDEFGHJK/ws', { headers: { ...headers, Upgrade: 'websocket' } }), env)
assert.equal(denied.status, 429); assert.equal(denied.headers.get('Retry-After'), '60'); assert.equal(lookups, 0)
const valid = await worker.fetch(new Request('https://relay/rooms', { method: 'POST', headers, body: JSON.stringify({ version: 4, build: 'ingress-check', level: 1 }) }), env)
assert.equal(valid.status, 201); assert.equal(lookups, 1)
console.log('PASS: missing-length stream cancelled at 600 bytes, denied upgrade never looks up a room, valid creation succeeds')
