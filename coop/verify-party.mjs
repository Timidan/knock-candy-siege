import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/timidan/Desktop/murmur/node_modules/playwright-core')
const { parseAbi, decodeFunctionData, encodeFunctionResult } = require('../app/node_modules/viem')
const aggregate = parseAbi(['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)'])
const evidence = process.env.EVIDENCE || `${homedir()}/.cache/knock-coop/evidence/phase2`
const SITE = process.env.SITE || 'http://localhost:5200', PLAY_MS = Number(process.env.PLAY_MS ?? 60000), TAG = process.env.TAG || 'run'
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
    // PARTY_RTT_MS ± PARTY_JITTER_MS, split evenly each way. Each direction keeps its order, as TCP does: a late frame holds back the ones behind it.
    const latency = Number(process.env.PARTY_RTT_MS ?? 0) / 2, jitter = Number(process.env.PARTY_JITTER_MS ?? 0) / 2
    const lane = () => {
      // One timer drains a FIFO queue: separate timers with equal deadlines may fire out of order.
      const queue = []; let last = 0, timer = null
      const pump = () => { timer = null; while (queue.length && queue[0].due <= Date.now()) queue.shift().send(); if (queue.length) timer = setTimeout(pump, queue[0].due - Date.now()) }
      return send => { last = Math.max(last, Date.now() + latency + (Math.random() * 2 - 1) * jitter); queue.push({ due: last, send }); timer ??= setTimeout(pump, last - Date.now()) }
    }
    if (latency || jitter) await page.routeWebSocket(/\/rooms\/.*\/ws/, socket => {
      const server = socket.connectToServer(), up = lane(), down = lane()
      socket.onMessage(message => up(() => server.send(message)))
      server.onMessage(message => down(() => socket.send(message)))
      socket.onClose((code, reason) => up(() => server.close({ code, reason })))
      server.onClose((code, reason) => down(() => socket.close({ code, reason })))
    })
    page.on('pageerror', error => errors.push({ player, message: error.message }))
    // Read-only NFT/holder fixtures; no signing, transactions, grants or chain mutations.
    // locked: the host has Rosie Row and opens Lemon Lane, which is still locked for the friend.
    const stars = benchmark ? { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 } : !player && modes.includes('locked') ? { 1: 3 } : {}
    await page.addInitScript(({ account, player, benchmark, stars }) => {
      localStorage.setItem('knock-stats-off', '1')
      localStorage.setItem('knock-siege-v1', JSON.stringify({ tutorial: true, stars, settings: { music: 0, effects: 0, lite: !benchmark && !!player, shake: !benchmark && !player, autoFullscreen: false } }))
      window.ethereum = { on() {}, removeListener() {}, request: async ({ method }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account]
        if (method === 'eth_chainId') return '0x8f'
        throw new Error(`Fixture refuses wallet method: ${method}`)
      } }
    }, { account, player, benchmark, stars })
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
    const [host, friend] = pages
    await pages[0].goto(`${SITE}/?siegeStats`)
    await pages[0].getByRole('button', { name: /Hold the porch/ }).click({ force: true })
    await pages[0].getByRole('button', { name: mode === 'crowd60' ? /^Rare Row/ : mode === 'locked' ? /^Lemon Lane/ : /^Rosie Row/ }).click()
    await choose(pages[0], 1)
    await pages[0].getByRole('button', { name: 'Porch Party · play together' }).click()
    await pages[0].getByRole('heading', { name: 'Porch Party', exact: true }).waitFor({ timeout: 45000 })
    const invite = await pages[0].locator('.siege-party-link input').inputValue(), code = new URL(invite).searchParams.get('room')
    assert.match(invite, /^https:\/\/knock\.timidan\.xyz\/\?room=[A-Z2-9]+$/)
    await pages[0].screenshot({ path: `${evidence}/${mode}-lobby.png` })
    // The invite seats the friend before any Chog: the lobby names the host's party, and the picker opens over it.
    const seat = async () => {
      await friend.goto(`${SITE}/?room=${code}&siegeStats`)
      await friend.getByRole('heading', { name: 'Pick your Chog' }).waitFor({ timeout: 45000 })
      await friend.getByRole('heading', { name: 'Chog #1’s Porch Party' }).waitFor()
      await friend.getByText('You · choosing…').waitFor()
      await host.getByText('Your friend is here, picking a Chog').waitFor({ timeout: 15000 })
    }
    await seat()
    if (mode === modes[0]) {
      // Closing the picker keeps the seat. Leaving frees it for the same invite, and the host keeps the room.
      for (const size of [{ width: 844, height: 390 }, { width: 1280, height: 720 }]) {
        await friend.setViewportSize(size); await friend.waitForTimeout(500)
        await friend.screenshot({ path: `${evidence}/friend-picker-${size.width}.png` })
        await friend.keyboard.press('Escape'); await friend.getByRole('button', { name: 'Pick your Chog' }).waitFor(); await friend.waitForTimeout(300)
        await friend.screenshot({ path: `${evidence}/friend-lobby-${size.width}.png` })
        await friend.getByRole('button', { name: 'Pick your Chog' }).click(); await friend.getByRole('heading', { name: 'Pick your Chog' }).waitFor()
      }
      await friend.setViewportSize({ width: 844, height: 390 })
      await host.screenshot({ path: `${evidence}/host-friend-here.png` })
      await friend.keyboard.press('Escape'); await friend.getByRole('button', { name: 'Leave room' }).click()
      await host.getByText('Your friend left. The invite link still works.').waitFor({ timeout: 15000 })
      await host.getByText('Waiting for a friend').waitFor()
      await seat()
      console.log(mode, 'friend backed out and rejoined through the same invite')
    }
    await friend.getByRole('button', { name: 'Use connected wallet' }).click()
    await friend.getByText('Your Chog #2').waitFor({ timeout: 45000 })
    await friend.getByRole('button', { name: 'Join the party →' }).click()
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__siege?.net?.state === 'running', null, { timeout: 90000 })))
    const initial = await Promise.all(pages.map(page => page.evaluate(() => {
      const s = window.__siege, gl = s.game.renderer.gl, ext = gl?.getExtension('WEBGL_debug_renderer_info')
      window.partyHashes = []; window.partyStart = performance.now(); window.partyLast = 0
      window.partyRtt = []; window.partyEvents = []; const pending = new Map(), send = s.options.coop.client.send.bind(s.options.coop.client)
      s.options.coop.client.send = message => { if (message.type === 'input') pending.set(message.tick, performance.now()); send(message) }
      s.options.coop.client.subscribe(message => { if (['disconnected', 'error', 'desync'].includes(message.type)) window.partyEvents.push(message); if (message.type === 'input' && message.player === s.options.coop.client.player && pending.has(message.tick)) { window.partyRtt.push(performance.now() - pending.get(message.tick)); pending.delete(message.tick) } })
      s.net.options.onHash = (tick, hash) => window.partyHashes.push({ tick, hash })
      // Tap to action: an accepted command until the simulation applies it for this player. A stall: a due turn that cannot run.
      const net = s.net, local = s.options.coop.client.player, queued = [], enqueue = net.enqueue.bind(net), apply = net.simulation.command, advance = net.advance.bind(net)
      window.partyTaps = []; window.partyStall = { ms: 0, count: 0, since: 0 }; window.partyTick0 = net.tick
      net.enqueue = command => { const ok = enqueue(command); if (ok) queued.push(performance.now()); return ok }
      net.simulation.command = (player, command) => { if (player === local && queued.length) window.partyTaps.push(performance.now() - queued.shift()); apply(player, command) }
      net.advance = () => {
        const ok = advance(), now = performance.now(), stall = window.partyStall
        if (ok && stall.since) { stall.ms += now - stall.since; if (now - stall.since > 50) { stall.count++; (stall.at ??= []).push([Math.round((stall.since - window.partyStart) / 100) / 10, Math.round(now - stall.since)]) } stall.since = 0 } else if (!ok && net.state === 'running' && !stall.since) stall.since = now
        return ok
      }
      return { relay: new URL(s.options.coop.client.socket.url).origin, ids: s.heroes.map(hero => hero.kit.id), local: s.localHero.kit.id, delay: s.net.delay, rtt: s.options.coop.client.rtt, probes: s.options.coop.client.samples?.map(Math.round), talents: s.heroes.map(hero => hero.talentLevels), gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), webdriver: navigator.webdriver }
    })))
    assert.deepEqual(initial.map(r => r.ids), [[1, 2], [1, 2]]); assert.deepEqual(initial.map(r => r.local), [1, 2])
    assert.ok(initial.every(r => r.webdriver)); console.log(mode, 'joined', initial)
    return initial
  }
  const state = page => page.evaluate(() => {
    const s = window.__siege
    return { tick: s.net.tick, verified: s.net.verifiedTick, status: s.net.state, detail: s.net.detail, seconds: s.clock, wave: s.wave, jars: s.jars, candy: s.candy, kills: s.kills, talents: s.heroes.map(h => h.talentLevels), ended: s.ended, result: s.coopResult, hashes: window.partyHashes, rtt: window.partyRtt, elapsedMs: performance.now() - window.partyStart, snapshot: JSON.stringify(s.net.simulation.snapshot(), (_key, value) => value instanceof Set ? [...value] : value) }
  })
  // Ends the current night on both peers at the same turn, so the shortcut is part of the agreed simulation: jars decide the stars.
  const endAt = (page, jars) => page.evaluate(jars => {
    const s = window.__siege, step = s.networkStep.bind(s)
    window.partyHashes = []; s.net.options.onHash = (tick, hash) => window.partyHashes.push({ tick, hash })
    s.networkStep = (dt, turn) => { step(dt, turn); if (turn === 450) { s.jars = jars; s.finish(jars > 0) } }
    return { tick: s.net.tick, level: s.options.level, seed: s.options.coop.client.room.seed, stars: s.heroes.map(hero => hero.selection.stars) }
  }, jars)
  const saved = page => page.evaluate(() => { const save = JSON.parse(localStorage.getItem('knock-siege-v1')); return { stars: save.stars, scores: save.scores } })
  const card = page => page.locator('dialog.siege-modal--result').innerText()
  // Both pages leave the result card for a new scene that is running.
  const nextScene = () => Promise.all(pages.map(page => page.waitForFunction(() => window.__siege && !window.__siege.old && window.__siege.net?.state === 'running', null, { timeout: 90000 })))
  const finished = () => Promise.all(pages.map(async page => { await page.getByLabel('Porch Party result').waitFor({ timeout: 60000 }); await page.evaluate(() => { window.__siege.old = true }) }))
  // The relay ends the room on any checkpoint mismatch; this also compares the hashes both pages saw, by turn.
  const sameCheckpoints = async () => {
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__siege.net.verifiedTick >= 540, null, { timeout: 60000 })))
    const lists = await Promise.all(pages.map(page => page.evaluate(() => window.partyHashes)))
    const peer = new Map(lists[1].map(({ tick, hash }) => [tick, hash])), common = lists[0].filter(({ tick }) => peer.has(tick))
    assert.ok(common.length >= 5 && common.every(({ tick, hash }) => peer.get(tick) === hash), JSON.stringify(lists))
    return common.map(({ tick }) => tick)
  }
  for (const mode of modes) {
    if (mode === 'next') {
      const [host, friend] = pages, rounds = []
      await room(mode)
      // 1. Rosie Row, won with 12 jars (2 stars).
      rounds.push(await Promise.all(pages.map(page => endAt(page, 12))))
      await finished()
      const first = await Promise.all(pages.map(saved)), texts = await Promise.all(pages.map(card))
      console.log('round 1 saves', first)
      // 2. Both saves hold the stars and score, and Lemon Lane opened for both.
      for (const save of first) { assert.equal(save.stars[1], 2); assert.ok(save.scores[1] > 0) }
      assert.ok(texts.every(text => /Night 02 unlocked!/i.test(text)), texts.join('\n---\n'))
      await Promise.all(pages.map((page, i) => page.screenshot({ path: `${evidence}/next-result-${i}.png` })))
      // 3. Next night: the host waits for the friend, then Lemon Lane starts for both.
      await host.getByRole('button', { name: 'Next night →' }).click()
      await host.getByText('Waiting for your partner…').waitFor()
      await friend.getByRole('button', { name: 'Next night →' }).waitFor()
      await host.screenshot({ path: `${evidence}/next-waiting-host.png` })
      await friend.getByRole('button', { name: 'Next night →' }).click()
      await nextScene()
      rounds.push(await Promise.all(pages.map(page => endAt(page, 0))))
      assert.ok(rounds[1].every(r => r.level === 2), JSON.stringify(rounds[1]))
      assert.deepEqual(rounds[1][0].stars, [{ 1: 2 }, { 1: 2 }]); assert.deepEqual(rounds[1][0], { ...rounds[1][1], tick: rounds[1][0].tick })
      console.log('round 2 started on Lemon Lane', rounds[1], 'checkpoints', await sameCheckpoints())
      // 4a. A loss, then Play again on the same night; this time the friend waits.
      await finished()
      const lost = await Promise.all(pages.map(saved))
      // A loss keeps its score as in solo (often 0 this early), with no stars.
      for (const save of lost) { assert.equal(save.stars[2], 0); assert.equal(typeof save.scores[2], 'number') }
      assert.ok((await Promise.all(pages.map(card))).every(text => /They got the candy\./i.test(text)))
      await friend.getByRole('button', { name: 'Play again →' }).click()
      await friend.getByText('Waiting for your partner…').waitFor()
      await friend.screenshot({ path: `${evidence}/next-again-friend.png` })
      await host.getByRole('button', { name: 'Play again →' }).click()
      await nextScene()
      rounds.push(await Promise.all(pages.map(page => endAt(page, 5))))
      assert.ok(rounds[2].every(r => r.level === 2) && rounds[2][0].seed === rounds[2][1].seed && rounds[2][0].seed !== rounds[1][0].seed, JSON.stringify(rounds[2]))
      console.log('round 3 replays Lemon Lane', rounds[2], 'checkpoints', await sameCheckpoints())
      // 4b. A 1-star win: Mint Mews stays locked for the host, so only Play again is offered. Then the friend leaves at the result card while the host waits.
      await finished()
      const third = await Promise.all(pages.map(saved))
      for (const save of third) assert.equal(save.stars[2], 1)
      assert.ok((await Promise.all(pages.map(card))).every(text => /Win with 2★ to unlock Night 03\./i.test(text)))
      for (const page of pages) assert.equal(await page.getByRole('button', { name: 'Next night →' }).count(), 0)
      await host.getByRole('button', { name: 'Play again →' }).click()
      await host.getByText('Waiting for your partner…').waitFor()
      await friend.getByRole('button', { name: 'Leave room' }).click()
      await friend.getByRole('heading', { name: 'Pick your porch' }).waitFor()
      await host.getByText('Your partner left the Porch Party.').waitFor({ timeout: 15000 })
      assert.equal(await host.getByRole('button', { name: /Next night|Play again/ }).count(), 0)
      await host.screenshot({ path: `${evidence}/next-partner-left.png` })
      await host.getByRole('button', { name: 'Leave room' }).click()
      await host.getByRole('heading', { name: 'Pick your porch' }).waitFor()
      await writeFile(`${evidence}/next.json`, JSON.stringify({ rounds, saves: { first, lost, third }, errors }, null, 2))
      console.log('PASS: co-op saves for both, Next night, Play again after a loss, partner leaving at the result card')
      continue
    }
    if (mode === 'locked') {
      // The friend's save has nothing, so Lemon Lane is locked for them; a 2-star win there still saves and opens Mint Mews for both.
      await room(mode)
      const before = await saved(pages[1])
      assert.deepEqual(before.stars, {})
      await Promise.all(pages.map(page => endAt(page, 12)))
      await finished()
      const after = await Promise.all(pages.map(saved)), texts = await Promise.all(pages.map(card))
      for (const save of after) { assert.equal(save.stars[2], 2); assert.ok(save.scores[2] > 0) }
      assert.ok(texts.every(text => /Night 03 unlocked!/i.test(text)), texts.join('\n---\n'))
      assert.ok(await Promise.all(pages.map(page => page.getByRole('button', { name: 'Next night →' }).isVisible())).then(all => all.every(Boolean)))
      await pages[1].screenshot({ path: `${evidence}/locked-result-friend.png` })
      await writeFile(`${evidence}/locked.json`, JSON.stringify({ before, after, errors }, null, 2))
      console.log('PASS: a friend on a night still locked for them keeps the stars and unlocks the next night', after)
      continue
    }
    if (mode === 'errors') {
      // A dead invite, then the host leaving while the friend picks: both end on a plain note, not a broken lobby.
      await pages[1].goto(`${SITE}/?room=AAAAAAAAAA&siegeStats`)
      await pages[1].getByRole('heading', { name: /This invite is no longer available/ }).waitFor({ timeout: 45000 })
      await pages[1].screenshot({ path: `${evidence}/error-dead-invite.png` })
      await pages[0].goto(`${SITE}/?siegeStats`)
      await pages[0].getByRole('button', { name: /Hold the porch/ }).click({ force: true })
      await pages[0].getByRole('button', { name: /^Rosie Row/ }).click()
      await choose(pages[0], 1)
      await pages[0].getByRole('button', { name: 'Porch Party · play together' }).click()
      const invite = await pages[0].locator('.siege-party-link input').inputValue({ timeout: 45000 })
      await pages[1].goto(`${new URL(invite).search.replace('?', `${SITE}/?`)}&siegeStats`)
      await pages[1].getByRole('heading', { name: 'Pick your Chog' }).waitFor({ timeout: 45000 })
      await pages[0].getByRole('button', { name: 'Leave room' }).click()
      await pages[1].getByRole('heading', { name: /Your friend closed this Porch Party/ }).waitFor({ timeout: 15000 })
      await pages[1].screenshot({ path: `${evidence}/error-host-left.png` })
      console.log('PASS: dead invite and host-left notes')
      continue
    }
    const initial = await room(mode)
    if (mode === 'finish') {
      // Host picks manually while the partner lets the first card auto-pick after 450 turns.
      const before = await state(pages[0])
      let auto = null
      // Since 14 Oct a co-op Chog's starting talents resolve at once, so a fresh room usually opens no card.
      if (before.talents[1].length) {
        for (let i = 0; i < before.talents[0].length; i++) { await pages[0].keyboard.press('z'); await pages[0].waitForTimeout(1100) }
        await pages[0].waitForFunction(() => window.__siege.hud.talentCard.list.some(item => item.text === 'Partner is choosing…'), null, { timeout: 10000 })
        await pages[0].screenshot({ path: `${evidence}/partner-choosing.png` })
        await pages[1].waitForFunction(level => window.__siege.heroes[1].talentLevels[0] !== level, before.talents[1][0], { timeout: 20000 })
        auto = await state(pages[1]); assert.ok(auto.tick >= 450); console.log('shared talent auto-pick', { tick: auto.tick, combatSeconds: auto.seconds })
      } else console.log('no starting talent card: resolved at once')
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
      await writeFile(`${evidence}/finish.json`, JSON.stringify({ initial, routing, auto: auto && { tick: auto.tick, seconds: auto.seconds }, results, errors, wallet: 'Read-only NFT and holder fixtures; no chain writes' }, null, 2))
      assert.ok(results.every(r => r.result?.won), 'Both clients must win the story level')
      // The rig is presentation: the victory dance keeps animating on wall-clock time after the last tick.
      const sim = text => JSON.stringify(JSON.parse(text, (key, value) => key === 'rig' ? undefined : value))
      assert.deepEqual(results[0].hashes, results[1].hashes); assert.equal(sim(results[0].snapshot), sim(results[1].snapshot))
      assert.ok(results.every(r => r.elapsedMs < r.tick / 45 * 1000 * 1.05 + 1000), 'Lockstep must progress near real time')
      await pages[0].waitForTimeout(2000)
      await Promise.all(pages.map((page, i) => page.screenshot({ path: `${evidence}/result-${i}.png` })))
      console.log('PASS: two Chogs finish Rosie Row, every checkpoint and final state match')
    } else if (mode === 'play') {
      // About a minute of both players building, upgrading, moving and sending waves through the scene's command path.
      const started = Date.now()
      for (let round = 0; Date.now() - started < PLAY_MS; round++) {
        const step = await Promise.all(pages.map((page, player) => page.evaluate(({ player, round }) => {
          const s = window.__siege
          if (s.net.state !== 'running' || s.ended) return { state: s.net.state, ended: s.ended, detail: s.net.detail }
          if (s.localHero.choices) s.command({ type: 'talent', index: player })
          else if (!s.talentWaiting) {
            const mine = s.pads.map((_, pad) => pad).filter(pad => pad % 2 === player), empty = mine.find(pad => !s.towers[pad])
            if (empty !== undefined) s.command({ type: 'build', pad: empty, kind: ['egg', 'lantern', 'tp', 'lantern'][empty % 4] })
            else s.command({ type: 'upgrade', pad: mine[round % mine.length] })
            s.command({ type: 'move', x: player ? 1150 : 900, y: round % 2 ? 600 : 700 })
            if (!s.wave && player === 0 && s.towers.filter(Boolean).length >= 2) s.command({ type: 'wave' })
          }
          return { state: s.net.state, tick: s.net.tick, wave: s.wave, jars: s.jars }
        }, { player, round })))
        assert.ok(step.every(r => r.state === 'running'), JSON.stringify(step))
        if (round % 15 === 0) console.log('play', Math.round((Date.now() - started) / 1000), 's', JSON.stringify(step))
        await pages[0].waitForTimeout(1000)
      }
      await pages[0].waitForTimeout(1500)
      const final = await Promise.all(pages.map(page => page.evaluate(() => { const s = window.__siege, stall = { ...window.partyStall }; if (stall.since) stall.ms += performance.now() - stall.since; return { state: s.net.state, tick: s.net.tick, ticks: s.net.tick - window.partyTick0, verified: s.net.verifiedTick, delay: s.net.delay, rttMax: s.options.coop.client.rtt, hashes: window.partyHashes, taps: window.partyTaps, rtt: window.partyRtt, stall, events: window.partyEvents, elapsedMs: performance.now() - window.partyStart } })))
      const common = Math.min(...final.map(f => f.hashes.length)), at = (xs, q) => Math.round([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))])
      const summary = { tag: TAG, injected: { rttMs: Number(process.env.PARTY_RTT_MS ?? 0), jitterMs: Number(process.env.PARTY_JITTER_MS ?? 0) }, delayTicks: final.map(f => f.delay), delayMs: final.map(f => Math.round(f.delay * 1000 / 45)), rttMax: final.map(f => Math.round(f.rttMax)),
        tapToActionMs: final.map(f => ({ n: f.taps.length, median: at(f.taps, .5), p90: at(f.taps, .9), max: at(f.taps, 1) })), inputEchoRttMs: final.map(f => ({ median: at(f.rtt, .5), p99: at(f.rtt, .99), max: at(f.rtt, 1) })), stalls: final.map(f => ({ over50ms: f.stall.count, ms: Math.round(f.stall.ms), fraction: +(f.stall.ms / f.elapsedMs).toFixed(4), atSecondsMs: f.stall.at ?? [] })),
        turnsPerSecond: final.map(f => +(f.ticks / (f.elapsedMs / 1000)).toFixed(2)), checkpointsCompared: common, checkpointsMatch: JSON.stringify(final[0].hashes.slice(0, common)) === JSON.stringify(final[1].hashes.slice(0, common)) }
      await writeFile(`${evidence}/play-${TAG}.json`, JSON.stringify({ summary, initial, final }, null, 2))
      console.log('summary', JSON.stringify(summary))
      assert.ok(final.every(f => f.state === 'running' && !f.events.length), 'both clients still running, no relay stop events')
      assert.ok(common >= 5 && summary.checkpointsMatch, 'checkpoints match')
      console.log('PASS: a minute of Porch Party in sync')
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
