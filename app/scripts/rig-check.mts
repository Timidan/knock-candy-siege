import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pose, ease, trackPose } from '../src/siege/hero/pose.ts'
import type { RigData, Transform } from '../src/siege/hero/pose.ts'
import { talentChoices } from '../src/siege/data/talents.ts'
import { resolveKit, WEAPONS, SPECIAL_COOLDOWNS, withLegends } from '../src/siege/data/kits.ts'
import { scoreFor } from '../src/siege/data/score.ts'
import { canDance } from '../src/siege/data/shop.ts'
const json = (path: string) => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'))
const rig: RigData = json('siege/atlas/rig.json'), samples = json('siege/atlas/rig-samples.json')
let checked = 0, max = 0
for (const costume of Object.keys(rig.costumes)) for (const clip of Object.keys(rig.clips)) {
  assert.equal(samples[costume][clip].length, 8)
  for (const sample of samples[costume][clip]) {
    const actual = pose(rig, costume, clip, sample.t)
    for (const [part, values] of Object.entries(sample.parts)) for (const [key, expected] of Object.entries(values as Transform)) {
      const error = Math.abs(actual[part][key as keyof Transform] - expected); max = Math.max(max, error)
      assert.ok(error <= (['x', 'y', 'r'].includes(key) ? .5 : .00001), `${costume}/${clip}@${sample.t} ${part}.${key}: ${error}`)
    }
    checked++
  }
}
const require = createRequire(import.meta.url)
const eases = { linear: 'linear/Linear', sineIn: 'sine/In', sineOut: 'sine/Out', sineInOut: 'sine/InOut', quadIn: 'quadratic/In', quadOut: 'quadratic/Out', quadInOut: 'quadratic/InOut', cubicOut: 'cubic/Out', backIn: 'back/In', backOut: 'back/Out', bounceOut: 'bounce/Out', elasticOut: 'elastic/Out' }
for (const [name, path] of Object.entries(eases)) for (const t of [0, .125, .5, .875, 1]) assert.ok(Math.abs(ease(name, t) - require(`phaser/src/math/easing/${path}.js`)(t)) < 1e-12)
assert.equal(trackPose([[0, { x: 10 }], [100, {}, 'quadIn']], 50).x, 7.5)
const legends = json('siege/legends.json'), kits = withLegends(json('siege/kits.json'), legends), traits = json('siege/traits.json'), chogs = json('chogs.json').chogs
const atlasSizes = new Map<string, number>()
let largestHero = { id: 0, bytes: 0 }
for (const row of chogs) {
  const kit = resolveKit(kits, traits, chogs, row.id)
  // A legend's special and ultimate art live in its own hero atlas.
  const bytes = (kit.legend ? [`hero-${kit.costume}`] : [`hero-${kit.costume}`, `special-${kit.special}`, `ult-${kit.ultimate}`]).reduce((total, name) => {
    if (!atlasSizes.has(name)) { const size = json(`siege/atlas/${name}.json`).meta.size; atlasSizes.set(name, size.w * size.h * 4) }
    return total + atlasSizes.get(name)!
  }, 0)
  if (bytes > largestHero.bytes) largestHero = { id: row.id, bytes }
  assert.ok(rig.costumes[kit.costume] && WEAPONS[kit.weapon])
  for (const slot of ['weapon', 'special', 'ultimate', 'passive', 'headgear', 'trinket', 'skin', 'emote'] as const) assert.ok(kits.slots[slot][kit[slot]], `${row.id}/${slot}`)
  for (const level of [2, 3, 4, 5]) assert.equal(talentChoices(kit, level)?.length, 2)
  if (!row.background && !kit.legend) assert.equal(kit.ultimate, 'candy-bomb')
  assert.equal(resolveKit(kits, traits, chogs, row.id, true).level, kit.level + 1)
}
const dances = json('siege/atlas/dances.json')
const dancingRig = { ...rig, clips: { ...rig.clips, ...dances.clips } }
for (const [name, dance] of Object.entries(dances.dances) as [string, { clip: string; loop: boolean }][]) {
  const clip = dancingRig.clips[dance.clip]
  assert.ok(clip, name)
  for (const part of ['root', 'head', 'arm-front', 'arm-back', 'leg-front', 'leg-back']) assert.ok(clip.tracks[part]?.length > 1, `${name}/${part}`)
  const sample = pose(dancingRig, 'pitch-deck', dance.clip, clip.ms * .4)
  assert.ok(Object.values(sample).every(p => Object.values(p).every(Number.isFinite)))
  if (clip.loop) for (const track of Object.values(clip.tracks)) for (const key of Object.keys(trackPose(track, 0)) as (keyof Transform)[]) assert.ok(Math.abs(trackPose(track, 0)[key] - trackPose(track, clip.ms)[key]) < 1e-6, `${name} loop seam`)
}
assert.equal(scoreFor({ kills: 45, jars: 20, stars: 3, earlyCalls: 2, seconds: 180, won: true }), 14300)
assert.equal(scoreFor({ kills: 4, jars: 0, stars: 0, earlyCalls: 0, seconds: 20, won: false }), 400)
assert.ok(canDance('floss', 'giggle', [1], dances.dances))
assert.ok(!canDance('floss', 'giggle', [], dances.dances))
console.log(`PASS: ${checked} sampled poses, maximum error ${max.toFixed(8)}; 12 Phaser eases; ${chogs.length} kits and Home bonuses; ${Object.keys(dances.dances).length} dance clips; scoring and owned-dance gate.`)
console.log(`Largest hero atlas set: Chog #${largestHero.id}, ${(largestHero.bytes / 1048576).toFixed(2)} MB RGBA (before shared textures and HUD).`)

// The world shares one reproducible gameplay stream, independent of visual effects.
const { seededRandom, ENDLESS_HEALTH } = await import('../src/siege/data/config.ts')
const first = seededRandom(20261012), replay = seededRandom(20261012), other = seededRandom(20261013)
const rolls = Array.from({ length: 16 }, () => first())
assert.deepEqual(rolls, Array.from({ length: 16 }, () => replay()))
assert.notDeepEqual(rolls, Array.from({ length: 16 }, () => other()))
console.log('PASS: seeded world stream replays exactly; a different seed changes it.')

// Batch 3a: the ten legend kits, the new maps and waves, bosses, endless scaling and the daily rules.
const { readGeometry, LEVELS, ENDLESS_LEVEL, mapFile } = await import('../src/siege/data/level1.ts')
const { endlessWave, endlessRoads, endlessBoss, endlessHealth, BOSS_ROTATION, dailyInfo, shuffledKinds, NIGHTS, DAILY_FIRST_DAY, DAY_MS } = await import('../src/siege/data/endless.ts')
const { bossConfig } = await import('../src/siege/data/bosses.ts')
for (const [id, legend] of Object.entries(legends.legends) as [string, { costume: string; attack: string }][]) {
  const kit = resolveKit(kits, traits, chogs, Number(id)), family = `legend-${id}`
  assert.ok(kit.legend && kit.costume === legend.costume && kit.weapon === family && kit.special === family && kit.ultimate === family, id)
  assert.equal(rig.costumes[legend.costume].attack, legend.attack, `${id} attack style`)
  assert.ok(WEAPONS[family] && SPECIAL_COOLDOWNS[family] && kits.slots.weapon[family] && kits.slots.special[family] && kits.slots.ultimate[family] && bossConfig(Number(id)), `${id} kit data`)
  for (const level of [2, 3, 5]) assert.ok(talentChoices(kit, level)![0].name.endsWith('Mastery'))
  assert.ok(json(`siege/atlas/hero-${legend.costume}.json`).frames[`boss/${id}/aura/0`], `${id} aura`)
}
for (const level of [1, 2, 3, 4, 5, 6, ENDLESS_LEVEL]) assert.ok(readGeometry(json(`siege/levels/${mapFile(level)}.json`)), `map ${level}`)
assert.deepEqual(LEVELS.slice(3, 6).map(level => level.waves.length), [8, 8, 9])
// The last wave of levels 3–6 is a Witching Hour; the last wave of levels 2–5 brings one legend; Rare Row brings three legends, then the Pumpkin.
for (const level of LEVELS.slice(2, 6)) assert.ok(level.waves.at(-1)!.witching && level.waves.at(-1)!.groups.some(g => g.edge), level.name)
assert.deepEqual([2, 3, 4, 5].map(level => LEVELS[level - 1].waves.at(-1)!.boss?.id), [1481, 1881, 942, 1002])
assert.deepEqual(LEVELS[5].waves.flatMap(w => w.boss ? [w.boss.id] : []), [561, 1884, 1798, 'pumpkin'])
// Endless: starts at ENDLESS_HEALTH, +8% health per wave, a road opens every ten waves, every tenth wave is a Witching Hour with the next boss.
assert.deepEqual([1, 9, 10, 19, 20, 29, 30, 99].map(endlessRoads), [1, 1, 2, 2, 3, 3, 4, 4])
assert.ok(Math.abs(endlessHealth(10) - ENDLESS_HEALTH * 1.08 ** 10) < 1e-12)
assert.deepEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map(endlessBoss), [...BOSS_ROTATION, BOSS_ROTATION[0]])
assert.deepEqual(new Set(BOSS_ROTATION).size, 11)
for (let n = 1; n <= 40; n++) { const wave = endlessWave(n); assert.equal(!!wave.witching, n % 10 === 0); assert.ok(wave.groups.every(g => g.edge || (g.path ?? 0) < endlessRoads(n))); assert.deepEqual(wave, endlessWave(n)); assert.deepEqual(endlessWave(n, 7), endlessWave(n, 7)) }
assert.notDeepEqual(endlessWave(13, 1), endlessWave(13, 2))
// Daily: the UTC date seeds the run, the night follows Knock.sol's day % 4, and the level of the day is one of 1–6.
const launch = dailyInfo(DAILY_FIRST_DAY * DAY_MS + 5000), next = dailyInfo((DAILY_FIRST_DAY + 1) * DAY_MS)
assert.equal(launch.number, 1); assert.equal(launch.seed, 20261012); assert.equal(launch.date, "2026-10-12"); assert.equal(next.number, 2); assert.equal(next.seed, 20261013)
for (let d = 0; d < 40; d++) { const day = dailyInfo((DAILY_FIRST_DAY + d) * DAY_MS); assert.equal(day.theme, (DAILY_FIRST_DAY + d) % 4); assert.ok(day.level >= 1 && day.level <= 6); assert.equal(NIGHTS.length, 4) }
const shuffle = shuffledKinds(20261012)
assert.deepEqual(Object.keys(shuffle).sort(), Object.values(shuffle).sort())
console.log(`PASS: ${Object.keys(legends.legends).length} legend kits and bosses; maps 1–6 and Town Square load; waves, Witching Hours and boss assignments; endless scaling, roads and boss rotation; daily seed, theme and shuffle.`)
