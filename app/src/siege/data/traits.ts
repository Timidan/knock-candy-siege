import type { Modifier } from './config'

export type TraitData = { keys: string[]; values: Record<string, string[]>; chogs: Record<string, number[]> }
export type ModifierRule = { key: string; matches: RegExp; name: Modifier; enemy: string }
export const MODIFIERS: ModifierRule[] = [
  { key: 'Aura', matches: /Burning|Fiery|^Fire$/, name: 'burning', enemy: 'Immune to slows' },
  { key: 'Aura', matches: /Aqua/, name: 'slippery', enemy: 'Cannot be knocked back' },
  { key: 'Aura', matches: /Smoke/, name: 'smoke', enemy: 'Dodges 20% of attacks' },
  { key: 'Aura', matches: /Wind/, name: 'wind', enemy: '20% faster' },
  { key: 'Eyes', matches: /laser/i, name: 'laser', enemy: 'Zaps a tower for a 1s stun' },
  { key: 'Eyes', matches: /Gradient visor|Anime Glass/, name: 'visor', enemy: 'Ignores candy lures' },
  { key: 'Head', matches: /^Crown$/, name: 'crown', enemy: 'Armours nearby friends' },
  { key: 'Head', matches: /^Wizard Hat$/, name: 'wizard', enemy: 'Blinks forward' },
  { key: 'Mouth', matches: /Gold Tooth|BTC Coin|Mon coin/, name: 'rich', enemy: 'Drops double candy' },
  { key: 'Mouth', matches: /Bubblegum/, name: 'gum', enemy: 'Gum slows guards' },
  { key: 'Mouth', matches: /Drooling/, name: 'hungry', enemy: 'Steals two jars' },
  { key: 'Accessory', matches: /^Knife$/, name: 'knife', enemy: 'Shreds guards' },
  { key: 'Accessory', matches: /Fwog|PEPE/, name: 'lucky', enemy: 'Survives one lethal hit' },
  { key: 'Accessory', matches: /Green Candle|Red Candle/, name: 'candle', enemy: 'Pumps and dumps its speed' },
  { key: 'Form', matches: /Skull/, name: 'skull', enemy: 'Revives once' },
  { key: 'Base', matches: /Radioactive/, name: 'toxic', enemy: 'Poison aura hurts guards and hero' },
  { key: 'Skin', matches: /Metal/, name: 'metal', enemy: 'Physical armour' },
  { key: 'Tier', matches: /Rare|Epic/, name: 'elite', enemy: 'Rare: +50%; Epic: +100% health and candy' },
]
export function traitsFor(data: TraitData, id: number): Record<string, string> {
  const indices = data.chogs[String(id)] ?? []
  return Object.fromEntries(data.keys.map((key, i) => [key, data.values[key]?.[indices[i] ?? 0] ?? '']))
}
export function modifiersFor(traits: Record<string, string>): Modifier[] {
  return MODIFIERS.filter(rule => rule.matches.test(traits[rule.key] ?? '')).map(rule => rule.name)
}
export const eliteBonus = (traits: Record<string, string>) => traits.Tier === 'Epic' ? 2 : traits.Tier === 'Rare' ? 1 : 0
