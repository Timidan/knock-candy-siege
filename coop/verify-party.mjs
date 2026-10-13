import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require('/home/timidan/Desktop/murmur/node_modules/playwright-core')
const { parseAbi, decodeFunctionData, encodeFunctionResult } = require('../app/node_modules/viem')
const aggregate = parseAbi(['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)'])
const evidence = `${homedir()}/.cache/knock-coop/evidence/phase2`
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] })
const pages = [], errors = [], modes = process.argv.slice(2).length ? process.argv.slice(2) : ['finish', 'desync', 'disconnect']
const benchmark = modes.includes('crowd60')
const word = value => `0x${BigInt(value).toString(16).padStart(64, '0')}`
try {
  for (let player = 0; player < 2; player++) {
    const account = `0x${String(player + 1).repeat(40)}`, id = player + 1
    const context = await browser.newContext({ viewport: benchmark || player ? { width: 844, height: 390 } : { width: 1280, height: 720 }, deviceScaleFactor: benchmark ? 3 : 1, reducedMotion: !benchmark && player ? 'reduce' : 'no-preference' })
    const page = await context.newPage(); pages.push(page)
    const latency = Number(process.env.PARTY_RTT_MS ?? 0) / 2
    if (latency) await page.routeWebSocket(/\/rooms\/.*\/ws/, socket => {
      const server = socket.connectToServer()
      socket.onMessage(message => setTimeout(() => server.send(message), latency))
      server.onMessage(message => setTimeout(() => socket.send(message), latency))
      socket.onClose((code, reason) => setTimeout(() => server.close({ code, reason }), latency))
      server.onClose((code, reason) => setTimeout(() => socket.close({ code, reason }), latency))
    })
    page.on('pageerror', error => errors.push({ player, message: error.message }))
    // Read-only NFT/holder fixtures; no signing, transactions, grants or chain mutations.
    await page.addInitScript(({ account, player, benchmark }) => {
      localStorage.setItem('knock-stats-off', '1')
      localStorage.setItem('knock-siege-v1', JSON.stringify({ tutorial: true, stars: benchmark ? { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 } : {}, settings: { music: 0, effects: 0, lite: !benchmark && !!player, shake: !benchmark && !player, autoFullscreen: false } }))
      window.ethereum = { on() {}, removeListener() {}, request: async ({ method }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account]
        if (method === 'eth_chainId') return '0x8f'
        throw new Error(`Fixture refuses wallet method: ${method}`)
      } }
    }, { account, player, benchmark })
    const call = data => {
      if (data.startsWith('0x82ad56cb')) {
        const { args } = decodeFunctionData({ abi: aggregate, data })
        return encodeFunctionResult({ abi: aggregate, functionName: 'aggregate3', result: args[0].map(item => ({ success: true, returnData: call(item.callData) })) })
      }
      if (data.startsWith('0x6352211e')) return `0x${(Number(BigInt(`0x${data.slice(10)}`)) === id ? account.slice(2) : 'f'.repeat(40)).padStart(64, '0')}`
      return word(data.startsWith('0x70a08231') ? 1 : 0)
    }
    await page.route(/https?:\/\/[^/]*(?:rpc|robinhood)[^/]*\//, async route => {
      const requests = route.request().postDataJSON()
      const answer = request => {
        assert.ok(['eth_call', 'eth_chainId', 'eth_getBalance', 'eth_blockNumber'].includes(request.method), `Unexpected RPC write: ${request.method}`)
        return { jsonrpc: '2.0', id: request.id, result: request.method === 'eth_call' ? call(request.params[0].data) : request.method === 'eth_chainId' ? '0x8f' : '0x0' }
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(Array.isArray(requests) ? requests.map(answer) : answer(requests)) })
    })
  }
  async function choose(page, id) {
    await page.getByRole('button', { name: 'Use connected wallet' }).click()
    await page.locator('.siege-hero-pick input').first().fill(String(id))
    await page.waitForFunction(() => document.querySelector('.siege-portrait--home'), null, { timeout: 45000 })
  }
  async function room(mode) {
    await pages[0].goto('http://localhost:5200/?siegeStats')
    await pages[0].getByRole('button', { name: /Hold the porch/ }).click({ force: true })
    await pages[0].getByRole('button', { name: mode === 'crowd60' ? /^Rare Row/ : /^Rosie Row/ }).click()
    await choose(pages[0], 1)
    await pages[0].getByRole('button', { name: 'Porch Party · play together' }).click()
    await pages[0].getByRole('heading', { name: 'Porch Party', exact: true }).waitFor({ timeout: 45000 })
    const invite = await pages[0].locator('.siege-party-link input').inputValue(), code = new URL(invite).searchParams.get('room')
    assert.match(invite, /^https:\/\/knock\.timidan\.xyz\/\?room=[A-Z2-9]+$/)
    await pages[0].screenshot({ path: `${evidence}/${mode}-lobby.png` })
    await pages[1].goto(`http://localhost:5200/?room=${code}&siegeStats`)
    await choose(pages[1], 2)
    await pages[1].getByRole('button', { name: 'Join Porch Party →' }).click()
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__siege?.net?.state === 'running', null, { timeout: 90000 })))
    const initial = await Promise.all(pages.map(page => page.evaluate(() => {
      const s = window.__siege, gl = s.game.renderer.gl, ext = gl?.getExtension('WEBGL_debug_renderer_info')
      window.partyHashes = []; window.partyStart = performance.now(); window.partyLast = 0
      window.partyRtt = []; window.partyEvents = []; const pending = new Map(), send = s.options.coop.client.send.bind(s.options.coop.client)
      s.options.coop.client.send = message => { if (message.type === 'input') pending.set(message.tick, performance.now()); send(message) }
      s.options.coop.client.subscribe(message => { if (['disconnected', 'error', 'desync'].includes(message.type)) window.partyEvents.push(message); if (message.type === 'input' && message.player === s.options.coop.client.player && pending.has(message.tick)) { window.partyRtt.push(performance.now() - pending.get(message.tick)); pending.delete(message.tick) } })
      s.net.options.onHash = (tick, hash) => window.partyHashes.push({ tick, hash })
      return { relay: new URL(s.options.coop.client.socket.url).origin, ids: s.heroes.map(hero => hero.kit.id), local: s.localHero.kit.id, delay: s.net.delay, rtt: s.options.coop.client.rtt, talents: s.heroes.map(hero => hero.talentLevels), gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), webdriver: navigator.webdriver }
    })))
    assert.deepEqual(initial.map(r => r.ids), [[1, 2], [1, 2]]); assert.deepEqual(initial.map(r => r.local), [1, 2])
    assert.ok(initial.every(r => r.webdriver)); console.log(mode, 'joined', initial)
    return initial
  }
  const state = page => page.evaluate(() => {
    const s = window.__siege
    return { tick: s.net.tick, verified: s.net.verifiedTick, status: s.net.state, detail: s.net.detail, seconds: s.clock, wave: s.wave, jars: s.jars, candy: s.candy, kills: s.kills, talents: s.heroes.map(h => h.talentLevels), ended: s.ended, result: s.coopResult, hashes: window.partyHashes, rtt: window.partyRtt, elapsedMs: performance.now() - window.partyStart, snapshot: JSON.stringify(s.net.simulation.snapshot(), (_key, value) => value instanceof Set ? [...value] : value) }
  })
  for (const mode of modes) {
    const initial = await room(mode)
    if (mode === 'finish') {
      // Host picks manually while the partner lets the first card auto-pick after 450 turns.
      const before = await state(pages[0])
      assert.ok(before.talents[1].length, 'Guest fixture must open a talent card')
      for (let i = 0; i < before.talents[0].length; i++) { await pages[0].keyboard.press('z'); await pages[0].waitForTimeout(1100) }
      await pages[0].waitForFunction(() => window.__siege.hud.talentCard.list.some(item => item.text === 'Partner is choosing…'), null, { timeout: 10000 })
      await pages[0].screenshot({ path: `${evidence}/partner-choosing.png` })
      await pages[1].waitForFunction(level => window.__siege.heroes[1].talentLevels[0] !== level, before.talents[1][0], { timeout: 20000 })
      const auto = await state(pages[1]); assert.ok(auto.tick >= 450); console.log('shared talent auto-pick', { tick: auto.tick, combatSeconds: auto.seconds })
      // Each client can move only its own hero; the other hero keeps its target.
      const targets = [{ x: 900, y: 600 }, { x: 1150, y: 700 }]
      await Promise.all(pages.map((page, player) => page.evaluate(target => window.__siege.command({ type: 'move', ...target }), targets[player])))
      await Promise.all(pages.map(page => page.waitForFunction(targets => window.__siege.heroes.every((hero, player) => hero.target.x === targets[player].x && hero.target.y === targets[player].y), targets)))
      const routing = await Promise.all(pages.map(page => page.evaluate(() => window.__siege.heroes.map(hero => ({ id: hero.kit.id, target: hero.target })))))
      assert.deepEqual(routing[0], routing[1]); console.log('per-player movement', routing[0])
      const deadline = Date.now() + 420000
      let reported = 0
      while (Date.now() < deadline) {
        const latest = await Promise.all(pages.map((page, player) => page.evaluate(player => {
          const s = window.__siege
          if (s.net.state !== 'running' || s.ended) return { tick: s.net.tick, state: s.net.state, detail: s.net.detail, events: window.partyEvents, ended: s.ended }
          if (s.localHero.choices) s.command({ type: 'talent', index: player })
          else if (!s.talentWaiting) {
            for (let pad = player; pad < s.pads.length; pad += 2) {
              if (!s.towers[pad]) s.command({ type: 'build', pad, kind: ['egg', 'lantern', 'tp', 'lantern'][pad % 4] })
              else s.command({ type: 'upgrade', pad })
            }
            if (!s.wave && player === 0 && s.towers.filter(Boolean).length >= 2) s.command({ type: 'wave' })
            s.command({ type: 'ability' }); s.command({ type: 'ultimate' })
            const target = s.enemies.find(e => e.active && e.distance > 650)
            if (target && player === 0) s.command({ type: 'spell', kind: 'rain', x: target.x, y: target.y })
          }
          return { tick: s.net.tick, state: s.net.state, ended: s.ended, wave: s.wave, jars: s.jars, kills: s.kills }
        }, player)))
        assert.ok(latest.every(r => r.state === 'running'), JSON.stringify(latest))
        if (latest.every(r => r.ended)) break
        if (Date.now() - reported > 15000) { console.log('finish', latest); reported = Date.now() }
        await pages[0].waitForTimeout(650)
      }
      await Promise.all(pages.map(page => page.getByLabel('Porch Party result').waitFor({ timeout: 15000 })))
      const results = await Promise.all(pages.map(state))
      await writeFile(`${evidence}/finish.json`, JSON.stringify({ initial, routing, auto: { tick: auto.tick, seconds: auto.seconds }, results, errors, wallet: 'Read-only NFT and holder fixtures; no chain writes' }, null, 2))
      assert.ok(results.every(r => r.result?.won), 'Both clients must win the story level')
      assert.deepEqual(results[0].hashes, results[1].hashes); assert.equal(results[0].snapshot, results[1].snapshot)
      assert.ok(results.every(r => r.elapsedMs < r.tick / 45 * 1000 * 1.05 + 1000), 'Lockstep must progress near real time')
      await pages[0].waitForTimeout(2000)
      await Promise.all(pages.map((page, i) => page.screenshot({ path: `${evidence}/result-${i}.png` })))
      console.log('PASS: two Chogs finish Rosie Row, every checkpoint and final state match')
    } else if (mode === 'crowd60') {
      // Performance fixture only: the same durable crowd is installed at turn 600 on both peers.
      await Promise.all(pages.map(page => page.evaluate(() => {
        const s = window.__siege, original = s.networkStep.bind(s)
        s.quality.enabled = false; s.quality.tier = 0; s.applyQuality()
        s.heads.prepare(Array.from({ length: 60 }, (_, i) => i + 1))
        window.perfFired = new Set()
        const attack = s.towerAttack.bind(s)
        s.towerAttack = (tower, enemy) => { const fired = attack(tower, enemy); if (fired) window.perfFired.add(s.towers.indexOf(tower)); return fired }
        s.networkStep = (dt, turn) => {
          if (turn === 600) {
            s.candy = 99999; s.wave = 1; s.countdown = 99999; s.schedule = []; s.waveAlive = [60]
            for (let pad = 0; pad < s.pads.length; pad++) {
              s.applyCommand(0, { type: 'build', pad, kind: pad === 8 || pad === 9 ? 'catapult' : ['egg', 'tp', 'lantern'][pad % 3] })
              s.applyCommand(0, { type: 'upgrade', pad }); s.applyCommand(0, { type: 'upgrade', pad })
            }
            for (let i = 0; i < 60; i++) {
              s.spawn({ time: 0, wave: 0, chogId: i + 1, kind: ['treater', 'pumpkin', 'goblin', 'witch', 'skeleton', 'mummy'][i % 6], path: i % s.routes.length, distance: 0 })
              const enemy = s.enemies.find(e => e.active && e.id === i + 1), pad = s.pads[i % s.pads.length]
              enemy.hp = enemy.maxHp = 100000; enemy.speed = 0; enemy.age = 2
              let best = Infinity
              for (let path = 0; path < s.routes.length; path++) { const at = s.routes[path].nearest(pad.x + (i % 5 - 2) * 14, pad.y); if (at.gap < best) { best = at.gap; enemy.path = path; enemy.distance = at.distance } }
              enemy.distance = Math.min(enemy.distance, s.routeFor(enemy).length - 220); s.routeFor(enemy).at(enemy.distance, enemy)
            }
          }
          if (turn >= 600) { for (const e of s.enemies) if (e.active) e.hp = Math.max(e.hp, 90000); for (const hero of s.heroes) hero.hp = hero.maxHp }
          original(dt, turn)
        }
      })))
      await Promise.all(pages.map(page => page.waitForFunction(() => window.__siege.net.tick >= 780, null, { timeout: 45000 })))
      // Measure one display's GPU budget. The background partner keeps simulation and hashing active.
      await pages[1].evaluate(() => window.__siege.game.loop.sleep())
      await pages[0].waitForTimeout(2000)
      const metrics = await Promise.all([pages[0]].map(page => page.evaluate(() => new Promise(resolve => {
        const frames = []; let start = 0, previous = 0, minEnemies = 999, maxEnemies = 0
        function frame(now) {
          if (!start) start = now
          if (previous) frames.push(now - previous)
          previous = now
          const s = window.__siege, count = s.enemies.filter(e => e.active).length
          minEnemies = Math.min(minEnemies, count); maxEnemies = Math.max(maxEnemies, count)
          if (now - start < 6500) requestAnimationFrame(frame)
          else { frames.sort((a, b) => a - b); resolve({ fps: 1000 * frames.length / frames.reduce((a, b) => a + b, 0), p95ms: frames[Math.floor(frames.length * .95)], maxMs: frames.at(-1), minEnemies, maxEnemies, towers: s.towers.filter(Boolean).length, firingTowers: window.perfFired.size, quality: s.quality.tier, renderScale: s.renderScale, buffer: [s.game.canvas.width, s.game.canvas.height], status: s.net.state, hashes: window.partyHashes }) }
        }
        requestAnimationFrame(frame)
      }))))
      const peer = await state(pages[1])
      await writeFile(`${evidence}/crowd60.json`, JSON.stringify({ fixture: 'Rare Row, two heroes, 60 durable enemies, all 11 pads, DPR 3, full quality, active relay (see initial.relay); partner rendering asleep while its simulation and hashing continue', initial, metrics, peer: { tick: peer.tick, status: peer.status, hashes: peer.hashes }, errors }, null, 2))
      await pages[0].screenshot({ path: `${evidence}/crowd60-0.png` })
      for (const metric of metrics) { assert.equal(metric.status, 'running'); assert.equal(metric.minEnemies, 60); assert.ok(metric.firingTowers >= 8); assert.ok(metric.fps >= 55, `Crowd performance: ${metric.fps} fps`) }
      assert.equal(peer.status, 'running')
      const count = Math.min(metrics[0].hashes.length, peer.hashes.length); assert.deepEqual(metrics[0].hashes.slice(0, count), peer.hashes.slice(0, count))
      console.log('PASS: two-hero crowd60', metrics.map(({ hashes, ...metric }) => metric))
    } else if (mode === 'desync') {
      await pages[1].evaluate(() => { window.__siege.candy++ })
      await Promise.all(pages.map(page => page.getByRole('heading', { name: 'Out of sync: restart together' }).waitFor({ timeout: 10000 })))
      await pages[0].screenshot({ path: `${evidence}/desync.png` })
      await writeFile(`${evidence}/desync.json`, JSON.stringify({ initial, results: await Promise.all(pages.map(state)), errors }, null, 2))
      console.log('PASS: both production overlays detect forced desync')
    } else if (mode === 'disconnect') {
      await pages[1].evaluate(() => window.__siege.options.coop.client.close())
      await pages[0].getByRole('heading', { name: 'Partner disconnected' }).waitFor({ timeout: 10000 })
      const stopped = await state(pages[0]); await pages[0].waitForTimeout(500)
      assert.equal((await state(pages[0])).tick, stopped.tick)
      await pages[0].screenshot({ path: `${evidence}/disconnect.png` })
      await pages[0].getByRole('button', { name: 'Return to menu' }).click()
      await pages[0].getByRole('heading', { name: 'Pick your porch' }).waitFor()
      assert.equal(await pages[0].evaluate(() => !!window.__siege), false)
      await writeFile(`${evidence}/disconnect.json`, JSON.stringify({ initial, stopped, returnedToMenu: true, errors }, null, 2))
      console.log('PASS: disconnect freezes the peer and Return to menu destroys the scene')
    }
  }
  assert.deepEqual(errors, [])
} catch (error) {
  await writeFile(`${evidence}/failure-state.json`, JSON.stringify(await Promise.all(pages.map(page => page.evaluate(() => { const s = window.__siege; return { tick: s?.net?.tick, state: s?.net?.state, detail: s?.net?.detail, events: window.partyEvents, rtt: window.partyRtt, hashes: window.partyHashes } }).catch(() => null))), null, 2))
  await Promise.all(pages.map(async (page, i) => { await page.screenshot({ path: `${evidence}/failure-${i}.png` }).catch(() => {}); await writeFile(`${evidence}/failure-${i}.txt`, await page.locator('body').innerText().catch(() => '') ) }))
  console.error('Browser errors', errors); throw error
} finally { await browser.close() }
