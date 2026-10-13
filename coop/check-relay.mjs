import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { get } from 'node:https'

const relay = process.env.COOP_RELAY || 'https://knock-coop.timidan-knock.workers.dev'
const outcomes = []
const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(300)); controller.enqueue(new Uint8Array(300)); controller.close() } })
const oversized = await fetch(`${relay}/rooms`, { method: 'POST', headers: { Origin: 'http://localhost:5200' }, body: stream, duplex: 'half' })
assert.equal(oversized.status, 413, 'Missing-length oversized stream must be rejected'); await oversized.arrayBuffer()
for (const [origin, expected] of [['https://knock.timidan.xyz', 204], ['https://abc123.knock-ej6.pages.dev', 204], ['http://localhost:5200', 204], ['https://knock.timidan.xyz.attacker.example', 403], ['https://abc.knock-ej6.pages.dev.attacker.example', 403], ['null', 403]]) {
  const response = await fetch(`${relay}/rooms`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } })
  assert.equal(response.status, expected, origin)
  if (expected === 204) assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin)
  outcomes.push({ origin, status: response.status })
  await response.arrayBuffer()
}
const forbiddenSocket = await new Promise((resolve, reject) => {
  const request = get(`${relay}/rooms/AAAAAAAAAA/ws`, { headers: { Origin: 'https://attacker.example', Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' } }, response => { response.resume(); resolve(response.statusCode) })
  request.on('error', reject)
  request.on('upgrade', (_response, socket) => { socket.destroy(); reject(new Error('Forbidden Origin was upgraded')) })
  request.setTimeout(15000, () => request.destroy(new Error('Origin check timed out')))
})
assert.equal(forbiddenSocket, 403)
const statuses = [], requests = []
// This host's route alternates LOS/MAD; each Cloudflare location has a counter.
for (let i = 0; i < 16 && !statuses.includes(429); i++) {
  const response = await fetch(`${relay}/rooms`, { method: 'POST', headers: { Origin: 'http://localhost:5200', 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 3, build: 'phase2-http-check', level: 1 }) })
  statuses.push(response.status)
  requests.push({ status: response.status, at: new Date().toISOString(), colo: response.headers.get('cf-ray')?.split('-').at(-1) })
  assert.ok(response.status === 201 || response.status === 429)
  if (response.status === 429) assert.equal(response.headers.get('Retry-After'), '60')
  await response.arrayBuffer() // Drain for connection reuse; never print/store capabilities.
}
await writeFile(join(homedir(), '.cache/knock-coop/evidence/relay-boundaries.json'), JSON.stringify({ relay, oversizedStream: oversized.status, origins: outcomes, forbiddenSocket, creationBurst: statuses, requests }, null, 2))
console.log('Creation statuses:', statuses)
assert.ok(statuses.includes(429), 'Creation burst must be rate limited')
console.log('PASS: allowed/forbidden origins, WebSocket Origin rejection, live 429 creation limit')
