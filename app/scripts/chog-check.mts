// Compare the production browser compositor with the Pillow reference in both facings.
// Start e1's vite preview on port 5181, then: node --experimental-strip-types scripts/chog-check.mts
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
const require = createRequire('/home/timidan/Desktop/murmur/node_modules/')
const { chromium } = require('playwright-core')
const base = process.env.CHOG_CHECK_URL || 'http://localhost:5181'
const reference = resolve(homedir(), 'Desktop/chogathon/art/siege/chogs/compose.py')
const examples = [['Pink', 1], ['Origin', 2], ['Black', 4], ['Skull', 61], ['Metal', 262], ['Radioactive', 70], ['Multi', 648], ['Legend', 1881]] as const
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
page.on('pageerror', (e: Error) => errors.push(e.message))
page.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error') errors.push(m.text()) })
try {
  await page.addInitScript(() => localStorage.setItem('knock-siege-v1', JSON.stringify({ seen: ['enemy/treater', 'enemy/ghost', 'enemy/pumpkin', 'enemy/bat', 'enemy/witch', 'enemy/mummy', 'enemy/mini', 'enemy/goblin', 'enemy/skeleton'], stars: {}, scores: {}, tutorial: true, settings: { music: 0, effects: 0, lite: false, shake: false, gold: false, autoFullscreen: false } })))
  await page.goto(`${base}/?siege&siegeStats`)
  await page.getByRole('button', { name: /Hold the porch/ }).click()
  await page.getByRole('button', { name: /^Rosie Row/ }).click()
  await page.locator('.siege-hero-pick input').first().fill('1')
  await page.getByRole('button', { name: /make mischief/ }).click()
  await page.waitForFunction(() => (window as any).__siege?.ready, null, { timeout: 90000 })
  await page.evaluate(async () => { const s = (window as any).__siege; await s.heads.ready; s.game.loop.sleep() })
  const results: { label: string; id: number; left: boolean; meanRGBA: number; meanVisibleRGB: number }[] = []
  for (const [label, id] of examples) for (const left of [false, true]) {
    const suffix = `${id}${left ? '-left' : ''}`, refPath = `/tmp/ref-${suffix}.png`, path = `/tmp/chog-browser-${suffix}.png`
    execFileSync('python', [reference, String(id), ...(left ? ['--left'] : []), '-o', refPath])
    const png = await page.evaluate(([id, left]: [number, boolean]) => (window as any).__siege.heads.canvas(id, left).toDataURL('image/png'), [id, left])
    writeFileSync(path, Buffer.from(png.split(',')[1], 'base64'))
    const metrics = JSON.parse(execFileSync('python', ['-c', `from PIL import Image,ImageChops,ImageStat
import json,sys
x=Image.open(sys.argv[1]).convert('RGBA');y=Image.open(sys.argv[2]).convert('RGBA')
diff=ImageChops.difference(x,y); mean=sum(ImageStat.Stat(diff).mean)/4
bg=Image.new('RGBA',x.size,'#24192f')
a=Image.alpha_composite(bg,x).convert('RGB');b=Image.alpha_composite(bg,y).convert('RGB')
print(json.dumps(dict(meanRGBA=mean,meanVisibleRGB=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3)))`, refPath, path], { encoding: 'utf8' }))
    results.push({ label, id, left, ...metrics })
  }
  const evidence = await page.evaluate(() => {
    const s = (window as any).__siege
    s.command({ type: 'wave' })
    const scheduledIds = s.schedule.map((entry: any) => entry.chogId)
    const ids = Array.from({length: 60}, (_, i) => i + 1)
    s.heads.prepare(ids)
    return { stats: s.stats(), scheduledIds, sourceAtlasGpuKeys: Object.keys(s.textures.list).filter(key => key.startsWith('chog-')) }
  })
  // A held, crowded rendering fixture, not a balance simulation.
  await page.waitForFunction(() => (window as any).__siege.heads.queue.size === 0, null, { timeout: 30000 })
  const crowded = await page.evaluate(() => {
    const s = (window as any).__siege; s.wave = 1; s.waveAlive[0] = 0; s.countdown = 9999; s.schedule = []
    const f = s.hero.rig.face.frame, atlas = f.texture.source[0].image.getContext('2d')
    const actual = atlas.getImageData(f.cutX, f.cutY, 128, 160).data
    const expected = document.createElement('canvas'); expected.width = 128; expected.height = 160
    expected.getContext('2d')!.drawImage(s.heads.canvas(1), 0, 0, 128, 160)
    const pixels = expected.getContext('2d')!.getImageData(0, 0, 128, 160).data
    if (actual.some((v: number, i: number) => v !== pixels[i])) throw new Error('Preparing enemy heads overwrote the displayed hero')
    for (let i = 0; i < 60; i++) { s.spawn({ time: 0, kind: ['treater', 'ghost', 'pumpkin', 'bat', 'witch', 'goblin'][i % 6], chogId: i + 1, path: 0, wave: 0, distance: 100 + i * 22 }); const e = s.enemies.find((e: any) => e.active && e.id === i + 1); if (e) { e.hp = e.maxHp = 100000; e.age = 2; e.visible = true } }
    const enemy = s.enemies.find((e: any) => e.active); s.drawUnits(0)
    const originalFacing = enemy.art.body.flipX; enemy.status.fear = 1; s.drawUnits(0)
    const turned = s.heads.window(enemy.id, !originalFacing)
    if (enemy.art.body.flipX === originalFacing || enemy.art.face.frame.name !== turned.frame) throw new Error('Enemy face did not turn with its body')
    enemy.status.fear = 0
    s.paused = false; s.drawUnits(0); s.hud.refresh(); s.game.step(performance.now(), 0); s.game.step(performance.now() + 16, 0)
    return s.stats()
  })
  await page.screenshot({ path: '/tmp/conv-e1-crowded.png' })
  const report = { results, ...evidence, crowded, errors }
  writeFileSync('/tmp/conv-e1-check.json', JSON.stringify(report, null, 2))
  console.table(results); console.log(JSON.stringify({ ...evidence, crowded, errors }))
  const baselinePath = '/tmp/conv-e1-baseline.json'
  try {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
    console.log(`Texture MB: ${baseline.stats.textureMB} before; ${crowded.textureMB} crowded after`)
    if (crowded.textureMB > baseline.stats.textureMB) process.exitCode = 1
  } catch { /* Baseline capture is optional for standalone comparison. */ }
  if (errors.length || results.some(r => r.meanVisibleRGB > 1) || evidence.sourceAtlasGpuKeys.length || !evidence.scheduledIds.length || evidence.scheduledIds.some((id: unknown) => typeof id !== 'number')) process.exitCode = 1
} finally { await browser.close() }
