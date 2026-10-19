export type Point = { x: number; y: number }
export type TowerKind = 'egg' | 'tp' | 'lantern' | 'patch' | 'roost' | 'cauldron' | 'catapult' | 'lighthouse' | 'organ'
export type EnemyKind = 'treater' | 'ghost' | 'pumpkin' | 'bat' | 'witch' | 'mummy' | 'mini' | 'goblin' | 'skeleton'
export type Targeting = 'first' | 'last' | 'strong' | 'close'
export type Status = 'slow' | 'stun' | 'burn' | 'poison' | 'reveal' | 'fear' | 'freeze' | 'charm' | 'confuse' | 'root' | 'mark' | 'bleed' | 'wrap' | 'ground'
export type TrapKind = 'pumpkin' | 'bowl' | 'gum'
export type SpellKind = 'rain' | 'boo'
export type Modifier = 'burning' | 'slippery' | 'smoke' | 'wind' | 'laser' | 'visor' | 'crown' | 'wizard' | 'rich' | 'gum' | 'hungry' | 'knife' | 'lucky' | 'candle' | 'skull' | 'toxic' | 'metal' | 'elite'

export type TowerLevel = { cost: number; damage: number; range: number; interval: number; splash: number; guards: number }
export type TowerConfig = { name: string; description: string; color: number; projectile: string; levels: [TowerLevel, TowerLevel, TowerLevel]; specialisations: [string, string] | []; unlock?: { level: number; stars: number; hint: string } }
export const TOWERS: Record<TowerKind, TowerConfig> = {
  egg: { name: 'Egg Stand', description: 'Quick single shots. Pumpkins resist eggs.', color: 0xffd781, projectile: 'egg', specialisations: ['Rotten Egg', 'Golden Yolk'], levels: [
    { cost: 65, damage: 23, range: 270, interval: .65, splash: 0, guards: 0 },
    { cost: 75, damage: 39, range: 305, interval: .55, splash: 0, guards: 0 },
    { cost: 120, damage: 64, range: 335, interval: .46, splash: 0, guards: 0 },
  ] },
  tp: { name: 'TP Launcher', description: 'Splash damage. Wraps a crowd in a slow.', color: 0xb8e2e2, projectile: 'tp', specialisations: ['Mummy Wrap', 'TP Tornado'], levels: [
    { cost: 100, damage: 26, range: 300, interval: 1.7, splash: 105, guards: 0 },
    { cost: 105, damage: 43, range: 325, interval: 1.5, splash: 125, guards: 0 },
    { cost: 155, damage: 67, range: 350, interval: 1.3, splash: 145, guards: 0 },
  ] },
  lantern: { name: 'Haunted Lantern', description: 'Magic ignores armour. Reveals nearby ghosts.', color: 0xbca0ff, projectile: 'wisp', specialisations: ["Will-o’-Wisp", 'Moon Beam'], levels: [
    { cost: 200, damage: 23, range: 285, interval: 1.7, splash: 0, guards: 0 },
    { cost: 110, damage: 38, range: 320, interval: 1.5, splash: 0, guards: 0 },
    { cost: 160, damage: 59, range: 355, interval: 1.3, splash: 0, guards: 0 },
  ] },
  patch: { name: 'Pumpkin Patch', description: 'Guards hold the path. Bats fly past them.', color: 0xff996b, projectile: 'seed', specialisations: ['Jack Knights', 'Vine Snare'], levels: [
    { cost: 90, damage: 17, range: 230, interval: 1, splash: 0, guards: 2 },
    { cost: 100, damage: 29, range: 250, interval: .85, splash: 0, guards: 3 },
    { cost: 145, damage: 44, range: 275, interval: .75, splash: 0, guards: 3 },
  ] },
  roost: { name: 'Bat Roost', description: 'Three bats hunt flyers. Cannot attack ground enemies.', color: 0xc9a2ff, projectile: 'bat', specialisations: [], levels: [
    { cost: 135, damage: 60, range: 340, interval: 1.15, splash: 0, guards: 0 },
    { cost: 115, damage: 96, range: 375, interval: 1, splash: 0, guards: 0 },
    { cost: 165, damage: 144, range: 410, interval: .9, splash: 0, guards: 0 },
  ] },
  cauldron: { name: "Witch's Cauldron", description: 'Potions splash, slow and poison ground crowds. Pair with anti-air.', color: 0xa5e487, projectile: 'potion', specialisations: [], unlock: { level: 2, stars: 3, hint: 'Earn 3 stars on Lemon Lane' }, levels: [
    { cost: 145, damage: 15, range: 280, interval: 2.6, splash: 100, guards: 0 },
    { cost: 120, damage: 25, range: 305, interval: 2.4, splash: 115, guards: 0 },
    { cost: 175, damage: 38, range: 330, interval: 2.2, splash: 130, guards: 0 },
  ] },
  catapult: { name: 'Candy Corn Catapult', description: 'Very long range and huge ground splash. A slow reload leaves gaps.', color: 0xffbd62, projectile: 'candycorn', specialisations: [], unlock: { level: 3, stars: 1, hint: 'Win Mint Mews' }, levels: [
    { cost: 190, damage: 100, range: 500, interval: 5.2, splash: 170, guards: 0 },
    { cost: 160, damage: 170, range: 540, interval: 4.8, splash: 195, guards: 0 },
    { cost: 220, damage: 260, range: 580, interval: 4.4, splash: 220, guards: 0 },
  ] },
  lighthouse: { name: 'Ghost Lighthouse', description: 'A sweeping beam reveals and frightens. Low damage; bring a partner.', color: 0xb7e5ff, projectile: '', specialisations: [], unlock: { level: 4, stars: 1, hint: 'Win Mon Manor' }, levels: [
    { cost: 160, damage: 16, range: 360, interval: 3.5, splash: 0, guards: 0 },
    { cost: 120, damage: 25, range: 400, interval: 3.3, splash: 0, guards: 0 },
    { cost: 175, damage: 37, range: 440, interval: 3.1, splash: 0, guards: 0 },
  ] },
  organ: { name: 'Haunted Organ', description: 'Sound waves shove nearby enemies back. Slippery enemies resist the push.', color: 0xe3afd6, projectile: '', specialisations: [], unlock: { level: 5, stars: 1, hint: 'Win Radioactive Ridge' }, levels: [
    { cost: 175, damage: 22, range: 245, interval: 2.6, splash: 0, guards: 0 },
    { cost: 135, damage: 36, range: 265, interval: 2.4, splash: 0, guards: 0 },
    { cost: 190, damage: 54, range: 285, interval: 2.2, splash: 0, guards: 0 },
  ] },
}
export function towerLock(kind: TowerKind, stars: Record<string, number>, owned: number[]): string {
  if (kind === 'roost') return owned.includes(31) ? '' : 'Own the Bat Roost · 1,000 $KNOCK in the shop'
  const unlock = TOWERS[kind].unlock
  return unlock && (stars[unlock.level] ?? 0) < unlock.stars ? unlock.hint : ''
}
export const ENEMIES: Record<EnemyKind, { name: string; description: string; hp: number; speed: number; candy: number; color: number; flying: boolean; jars: number }> = {
  treater: { name: 'Trick-or-Treater', description: 'Here for your candy. Their real Chog traits add surprises.', hp: 92, speed: 88, candy: 10, color: 0xffb75d, flying: false, jars: 1 },
  ghost: { name: 'Ghost Sheet', description: 'Hidden until a Haunted Lantern or Target Lock reveals it.', hp: 95, speed: 105, candy: 13, color: 0xc9ddff, flying: false, jars: 1 },
  pumpkin: { name: 'Pumpkin Head', description: 'Armoured! Eggs deal only 20% damage. Use magic or TP.', hp: 245, speed: 66, candy: 17, color: 0xff8754, flying: false, jars: 1 },
  bat: { name: 'Bat Wings', description: 'Fast and airborne. Guards and ground traps cannot stop it.', hp: 78, speed: 135, candy: 12, color: 0xb5a0ef, flying: true, jars: 1 },
  witch: { name: 'Witch', description: 'Heals nearby marchers, then blinks ahead. Focus her down or stun the cast.', hp: 310, speed: 76, candy: 21, color: 0xb997ed, flying: false, jars: 2 },
  mummy: { name: 'Mummy', description: 'Unravels into two minis. Save splash damage for the split.', hp: 360, speed: 64, candy: 18, color: 0xe0d6a8, flying: false, jars: 2 },
  mini: { name: 'Mini Mummy', description: 'Two quick little bandits left behind by a mummy.', hp: 72, speed: 125, candy: 4, color: 0xe0d6a8, flying: false, jars: 1 },
  goblin: { name: 'Candy Goblin', description: 'A very fast thief who grabs three jars. Slow, root or block him.', hp: 135, speed: 195, candy: 15, color: 0x9ad780, flying: false, jars: 3 },
  skeleton: { name: 'Skeleton Crew', description: 'Arrives five at a time. Splash and chains scatter the whole crew.', hp: 88, speed: 108, candy: 5, color: 0xeae3cf, flying: false, jars: 1 },
}
// Traps and supplies are a stock: each use takes one; nothing costs candy. Refilled every level (co-op shares one stock).
export const TRAPS: Record<TrapKind, { name: string; stock: number; radius: number; duration: number; status: Status; color: number; description: string }> = {
  pumpkin: { name: 'Pumpkin Trap', stock: 5, radius: 125, duration: 2.5, status: 'stun', color: 0xffa34e, description: 'One burst stuns a crowd.' },
  bowl: { name: 'Candy Bowl', stock: 5, radius: 95, duration: 7, status: 'stun', color: 0xffdc75, description: 'Stops enemies to eat. Visors ignore it.' },
  gum: { name: 'Bubblegum', stock: 5, radius: 115, duration: 10, status: 'slow', color: 0xf29cda, description: 'A sticky patch that slows feet.' },
}
export const CONSUMABLES = {
  'pumpkin-bomb': { name: 'Pumpkin Bomb', stock: 5, cooldown: 18, radius: 155, duration: 0, color: 0xffaa61, description: 'Throw a bomb for 160 splash damage.' },
  'holy-water': { name: 'Holy Water', stock: 5, cooldown: 16, radius: 145, duration: 0, color: 0xb7e5ff, description: 'Reveals ghosts for 5 seconds; 180 damage to ghosts, 20 to others.' },
  garlic: { name: 'Garlic Cloud', stock: 5, cooldown: 20, radius: 140, duration: 6, color: 0xb4df8e, description: 'A lingering cloud poisons and slows ground enemies for 6 seconds.' },
  'candy-cane': { name: 'Giant Candy Cane', stock: 5, cooldown: 24, radius: 90, duration: 8, color: 0xffd0dc, description: 'Blocks the road for 8 seconds. Flyers pass over.' },
  scarecrow: { name: 'Scarecrow', stock: 5, cooldown: 22, radius: 185, duration: 12, color: 0xf3c784, description: 'A 240-health decoy lures ground enemies for up to 12 seconds. Bosses and visors ignore it.' },
}
export type ConsumableKind = keyof typeof CONSUMABLES
export type SupplyKind = TrapKind | ConsumableKind
export const SPELLS = {
  rain: { name: 'Candy Rain', cooldown: 70, radius: 175, damage: 95, color: 0xffcc63 },
  boo: { name: 'Boo!', cooldown: 80, radius: 210, damage: 0, color: 0xc1a1ff },
} satisfies Record<SpellKind, { name: string; cooldown: number; radius: number; damage: number; color: number }>
export const EMOTES = ['boo', 'trick', 'treat', 'lol', 'taunt', 'heart', 'cry', 'gg'] as const
export type Emote = typeof EMOTES[number]
export const EMOTE_LABELS: Record<Emote, string> = { boo: 'Boo!', trick: 'Trick!', treat: 'Treat?', lol: 'LOL', taunt: 'Try me!', heart: '♥', cry: 'Waa!', gg: 'GG' }
export const TARGETING: Targeting[] = ['first', 'last', 'strong', 'close']
export const LIMITS = { enemies: 96, towers: 12, projectiles: 128, effects: 96, numbers: 40, traps: 12 }
export const starsFor = (jars: number) => jars >= 18 ? 3 : jars >= 10 ? 2 : jars > 0 ? 1 : 0
export const STARTING_CANDY = 250
// Difficulty, in one place. Story nights (and the Daily, which plays them) multiply enemy health by the night,
// plus a share per wave; bosses take BOSS_HEALTH on top. Endless starts from ENDLESS_HEALTH and keeps its per-wave climb.
// The nights' maps differ a lot (Ridge's boosted pads, Manor's portals), so each night has its own measured value.
export const NIGHT_HEALTH = [1.25, 1.95, 1.1, 1.05, 2.9, 1.1]
export const WAVE_HEALTH = .04
export const BOSS_HEALTH = 1.5
export const ENDLESS_HEALTH = 1.25
// Kill candy follows that health: an enemy pays its candy times 1 + KILL_CANDY_HEALTH × (health multiplier − 1),
// so tougher nights, waves and Endless rounds pay more per kill (1 = in full proportion).
export const KILL_CANDY_HEALTH = 1
export const EARLY_CALL_CANDY_PER_SECOND = .5

export const SPECIALISATIONS = {
  rotten: { kind: 'egg', name: 'Rotten Egg', description: 'Poison stacks up to five times on each target.' },
  golden: { kind: 'egg', name: 'Golden Yolk', description: '35% chance to strike for triple damage.' },
  mummy: { kind: 'tp', name: 'Mummy Wrap', description: 'Splash wraps and stuns the crowd.' },
  tornado: { kind: 'tp', name: 'TP Tornado', description: 'A vortex pulls nearby marchers back toward its centre.' },
  wisp: { kind: 'lantern', name: "Will-o’-Wisp", description: 'Magic jumps to three nearby enemies.' },
  moon: { kind: 'lantern', name: 'Moon Beam', description: 'A piercing line hits every enemy in its path.' },
  knights: { kind: 'patch', name: 'Jack Knights', description: 'Pumpkin knights have double health and stronger attacks.' },
  vines: { kind: 'patch', name: 'Vine Snare', description: 'Guards root their targets with grasping vines.' },
} satisfies Record<string, { kind: TowerKind; name: string; description: string }>
export type Specialisation = keyof typeof SPECIALISATIONS
export const SPEC_COST = 180
export const rankCost = (rank: number) => 150 + rank * 60
// Radioactive Ridge's glowing pads: +20% range and damage for the tower standing on one.
export const BOOST = 1.2
export function towerStats(t: { kind: TowerKind; level: number; rank: number; boost?: boolean }): TowerLevel {
  const base = TOWERS[t.kind].levels[t.level - 1], boost = t.boost ? BOOST : 1
  return { ...base, damage: base.damage * (1 + t.rank * .3) * boost, range: (base.range + t.rank * 15) * boost }
}
// One gameplay stream per run; visual variation must never consume it.
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => { state = (state + 0x6D2B79F5) >>> 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
