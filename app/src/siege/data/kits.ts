import { traitsFor } from './traits.ts'
import type { TraitData } from './traits.ts'
export type LegendMove = { name: string; effect: string }
export type LegendInfo = { name: string; costume: string; attack: string; weapon: LegendMove; special: LegendMove; ultimate: LegendMove; boss: { move: string; effect: string } }
export type KitData = { slots: Record<string, Record<string, { name: string; effect: string }>>; assign: Record<string, Record<string, string>>; emotes: Record<string, string>; legends?: Record<string, LegendInfo> }
export type ChogRow = { id: number; side: string; background: string; tier: string }
export type Skin = { tint: string; cycle?: string[]; shine?: boolean }
export type Kit = { legend: LegendInfo | null; id: number; weapon: string; costume: string; suit: string; weaponMod: string; special: string; element: string; ultimate: string; passive: string; headgear: string; trinket: string; skin: string; skinValue: string; emote: string; side: string; undead: boolean; toxic: boolean; level: number; home: boolean; oddity: string }
export function resolveKit(data: KitData, traits: TraitData, chogs: ChogRow[], id: number, home = false): Kit {
  const t = traitsFor(traits, id), row = chogs.find(c => c.id === id)
  if (!row || !traits.chogs[String(id)]) throw new Error('Unknown Chog token ID')
  const pick = (key: string, value = t[key]) => data.assign[key]?.[value] ?? ''
  const weapon = pick('Body'), suit = pick('Suit', t.Body)
  const auraIndex = traits.chogs[String(id)][traits.keys.indexOf('Aura')]
  const kit: Kit = { legend: null, id, weapon, costume: weapon === 'mascot' ? `mascot-${suit}` : weapon, suit, weaponMod: pick('WeaponMod', t.Body), special: pick('Eyes'), element: /fire/i.test(t.Eyes) ? 'fire' : /green/i.test(t.Eyes) ? 'green' : /cyan/i.test(t.Eyes) ? 'cyan' : 'purple', ultimate: t.Base === '1:1' ? 'candy-bomb' : auraIndex === 0 ? pick('Background', row.background) : pick('Aura'), passive: pick('Mouth'), headgear: pick('Head'), trinket: pick('Accessory'), skin: pick('Skin'), skinValue: t.Skin, emote: data.emotes[String(id)], side: row.side.toLowerCase(), undead: t.Form === 'Skull', toxic: t.Base === 'Radioactive', level: 1 + (t.Tier === 'Legendary' ? 3 : t.Tier === 'Epic' ? 2 : t.Tier === 'Rare' ? 1 : 0) + Number(home), home, oddity: t.Head === 'Taped Banana' ? 'banana' : t.Head === 'Poison Shroom' ? 'mushroom' : t.Head === '8 Ball Beanie' ? 'eight-ball' : 'laser' }
  const legend = data.legends?.[String(id)]
  // The ten 1:1s keep their traits' perks but swap in a hand-made costume, weapon, special and ultimate.
  return legend ? { ...kit, legend, weapon: `legend-${id}`, costume: legend.costume, suit: '', weaponMod: '', special: `legend-${id}`, ultimate: `legend-${id}` } : kit
}
// The legend kits live in legends.json; the slot tables get their names and effects from it so every lookup by family works.
export function withLegends(kits: KitData, file: { legends: Record<string, LegendInfo> }): KitData {
  const slots = { ...kits.slots, weapon: { ...kits.slots.weapon }, special: { ...kits.slots.special }, ultimate: { ...kits.slots.ultimate } }
  for (const [id, legend] of Object.entries(file.legends)) { slots.weapon[`legend-${id}`] = legend.weapon; slots.special[`legend-${id}`] = legend.special; slots.ultimate[`legend-${id}`] = legend.ultimate }
  return { ...kits, slots, legends: file.legends }
}
export const LEGEND_WEAPONS: Record<string, { damage: number; range: number; interval: number; splash?: number }> = {
  'legend-561': { damage: 28, range: 320, interval: 1.1 }, 'legend-900': { damage: 36, range: 170, interval: 1.1 }, 'legend-942': { damage: 26, range: 340, interval: .95 },
  'legend-1002': { damage: 26, range: 300, interval: 1.15 }, 'legend-1481': { damage: 20, range: 280, interval: 1 }, 'legend-1514': { damage: 34, range: 215, interval: 1.3 },
  'legend-1667': { damage: 30, range: 330, interval: 1.15 }, 'legend-1798': { damage: 26, range: 360, interval: 1.2 }, 'legend-1881': { damage: 18, range: 300, interval: .8 },
  'legend-1884': { damage: 14, range: 310, interval: .95 },
}
export const WEAPONS: Record<string, { damage: number; range: number; interval: number; splash?: number }> = {
  'pitch-deck': { damage: 12, range: 290, interval: .9 }, scepter: { damage: 32, range: 305, interval: 1.2 },
  'ball-chain': { damage: 30, range: 155, interval: 1.25 }, fastball: { damage: 22, range: 330, interval: .85 },
  slingshot: { damage: 15, range: 290, interval: .62 }, mascot: { damage: 36, range: 175, interval: 1.65 },
  'egg-lob': { damage: 24, range: 310, interval: 1.1, splash: 82 }, junk: { damage: 28, range: 280, interval: 1.05 },
  blaster: { damage: 13, range: 230, interval: .8 }, fan: { damage: 19, range: 340, interval: 1.2 },
  'ray-gun': { damage: 24, range: 390, interval: 1.15 }, anime: { damage: 38, range: 1500, interval: 3.2 },
  tickle: { damage: 18, range: 120, interval: .44 }, ...LEGEND_WEAPONS,
}
export const SPECIAL_COOLDOWNS: Record<string, number> = { laser: 20, 'target-lock': 18, 'deal-with-it': 18, 'tear-flood': 20, charm: 23, 'play-dead': 18, 'stare-down': 17, confetti: 18, 'pep-talk': 22, 'legend-561': 20, 'legend-900': 22, 'legend-942': 20, 'legend-1002': 24, 'legend-1481': 22, 'legend-1514': 19, 'legend-1667': 24, 'legend-1798': 24, 'legend-1881': 20, 'legend-1884': 22 }
