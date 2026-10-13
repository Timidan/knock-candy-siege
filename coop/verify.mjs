import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

// Reuse the workstation's existing browser tool; no app dependency is installed.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || '/home/timidan/Desktop/murmur/node_modules/playwright-core')
const relay = process.env.COOP_RELAY || 'https://knock-coop.timidan-knock.workers.dev'
const cache = join(homedir(), '.cache/knock-coop'), evidence = join(cache, 'evidence')
const modes = process.argv.slice(2).length ? process.argv.slice(2) : ['replay', 'desync', 'disconnect']
await mkdir(evidence, { recursive: true })
const browsers = [], pages = [], errors = []
try {
  for (let player = 0; player < 2; player++) {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable', headless: true })
    browsers.push(browser)
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, reducedMotion: player ? 'reduce' : 'no-preference' })
    if (modes.includes('pace')) await page.routeWebSocket(/\/rooms\/.*\/ws/, socket => {
      const server = socket.connectToServer()
      socket.onMessage(message => setTimeout(() => server.send(message), 50))
      server.onMessage(message => setTimeout(() => socket.send(message), 50))
      socket.onClose((code, reason) => setTimeout(() => server.close({ code, reason }), 50))
      server.onClose((code, reason) => setTimeout(() => socket.close({ code, reason }), 50))
    })
    page.on('pageerror', error => errors.push({ player, error: String(error) }))
    pages.push(page)
    await page.goto('http://localhost:5200/harness.html'); await page.waitForFunction(() => window.coopHarness)
    assert.equal(await page.evaluate(() => navigator.webdriver), true)
  }
  for (const mode of modes) {
    if (mode === 'legacy') {
      const result = await pages[0].evaluate(() => window.coopHarness.legacy())
      const actual = JSON.stringify(result, null, 2)
      const reference = await readFile(join(dirname(fileURLToPath(import.meta.url)), '../.cache/polish3/after-simulation.json'), 'utf8')
      await writeFile(join(evidence, 'legacy-simulation.json'), actual)
      assert.equal(actual, reference, 'Existing seeded single-player replay must remain byte-identical')
      console.log(`legacy: byte-identical ${createHash('sha256').update(actual).digest('hex')}`)
      continue
    }
    const ticket = await pages[0].evaluate(relay => window.coopHarness.create(relay), relay)
    console.log(`${mode}: room created; joining two independent Chromium processes`)
    const joined = await Promise.all(pages.map((page, i) => page.evaluate(({ relay, code, hostToken, mode }) => window.coopHarness.join(relay, code, hostToken, mode), { relay, code: ticket.room.code, hostToken: i === 0 ? ticket.hostToken : undefined, mode })))
    assert.equal(joined[0].snapshot, joined[1].snapshot, 'Initial states differ')
    const progress = setInterval(async () => {
      try { console.log(mode, await Promise.all(pages.map(page => page.evaluate(() => { const r = window.coopHarness.result(); return { player: r.player, tick: r.tick, state: r.state, stop: r.stop, detail: r.detail } })))) } catch { /* Browser teardown. */ }
    }, 15000)
    try { await Promise.all(pages.map(page => page.waitForFunction(() => window.coopHarness.result().done, undefined, { timeout: 240000 }))) } finally { clearInterval(progress) }
    const results = await Promise.all(pages.map(page => page.evaluate(() => window.coopHarness.result())))
    await writeFile(join(evidence, `${mode}.json`), JSON.stringify({ relay, results, errors }, null, 2))
    if (mode === 'replay') {
      for (const result of results) {
        assert.equal(result.stop, ''); assert.equal(result.tick, 1800); assert.equal(result.verified, 1800)
        assert.equal(result.hashes.length, 20); assert.equal(result.webdriver, true)
        assert.ok(result.sent.some(packet => packet.count === 0)); assert.ok(result.kills > 0)
        assert.equal(result.targeting, 'strong', 'Player 1 must win the same-tick targeting conflict')
      }
      assert.deepEqual(results[0].hashes, results[1].hashes, 'All canonical checkpoint bytes and hashes must match')
      assert.deepEqual(results[0].applied, results[1].applied, 'Command application order must match')
      assert.ok(results[0].stalls.some(stall => stall.tick === 180 && stall.ms >= 200), 'Peer must wait for deliberately withheld tick 180')
      await Promise.all(pages.map(page => page.evaluate(() => window.coopHarness.dispose())))
      const offline = await pages[0].evaluate(({ seed, trace }) => window.coopHarness.offline(seed, trace), { seed: results[0].seed, trace: results[0].applied })
      await writeFile(join(evidence, 'offline.json'), JSON.stringify(offline, null, 2))
      assert.deepEqual(offline.hashes, results[0].hashes, 'Relay replay must equal direct offline simulation')
      assert.equal(offline.consumed, results[0].applied.length)
      console.log(`replay: 1800 ticks, 20 matching hashes and canonical states; offline replay identical; ${results[0].applied.length} commands; withheld heartbeat gated at tick 180`)
    } else if (mode === 'pace') {
      for (const r of results) { assert.equal(r.tick, 1800); assert.equal(r.stop, ''); assert.ok(r.elapsedMs < 42106, `Pacing too slow: ${r.elapsedMs} ms`); assert.ok(r.stallMs / r.elapsedMs < .05, `Stall fraction too high: ${r.stallMs / r.elapsedMs}`) }
      assert.deepEqual(results[0].hashes, results[1].hashes)
      console.log('pace:', results.map(r => ({ elapsedMs: r.elapsedMs, seconds: r.seconds, stalls: r.stalls })))
    } else if (mode === 'desync') {
      for (const result of results) { assert.equal(result.stop, 'Out of sync: restart together'); assert.ok(result.tick >= 180 && result.tick <= 180 + 2 * result.delay); assert.equal(result.verified, 90) }
      console.log('desync: both clients stopped at checkpoint 180 after one candy was changed at tick 135')
    } else if (mode === 'disconnect') {
      assert.equal(results[0].stop, 'Partner disconnected')
      console.log(`disconnect: peer stopped at tick ${results[0].tick}`)
    } else throw new Error(`Unknown mode: ${mode}`)
    await Promise.all(pages.map(page => page.evaluate(() => window.coopHarness.dispose())))
  }
  assert.deepEqual(errors, [], 'Browser runtime errors')
  await writeFile(join(evidence, `verify-${modes.join('-')}.json`), JSON.stringify({ passed: modes, relay, webdriver: true, browsers: 2, errors, at: new Date().toISOString() }, null, 2))
} finally { await Promise.all(browsers.map(browser => browser.close())) }
