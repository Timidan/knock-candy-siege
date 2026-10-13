import type { Chog } from './game/Scene'

const colours: Record<string, string> = {
  'Light Purple': '#c9a8f0', Lemon: '#f3ee9a', Aqua: '#8fe6ee', Mon: '#8d7bff',
  Sunlight: '#f6cf8a', 'Lemon Yellow': '#f2e27a', Rosie: '#f2a3c4', 'Coral Pink': '#f2958f',
  Mint: '#9ff0b7', 'Peach Pink': '#f6b9a6', 'Light Magenta': '#f08ff0', 'Soft Lavender': '#b6a3f2',
  'Sky Blue': '#8fcff2', 'Fresh Green': '#a3ef8f', 'Aqua Mint': '#8ff0d2', 'Rosy Pink': '#ef72a8',
  'Deep Aqua': '#2f9aa6', 'Lime Green': '#b7e85a', 'Deep Blue': '#3d5bd6', Radioactive: '#5df23a',
  'Rare Row': '#ffc93c',
}

export type Street = { index: number; neighbourhood: string; colour: string; number: number; total: number; name: string; chogs: Chog[] }
export type Neighbourhood = { name: string; colour: string; streets: Street[] }
export type Town = { neighbourhoods: Neighbourhood[]; streets: Street[]; streetOf: (id: number) => Street | undefined }
const cache = new WeakMap<readonly Chog[], Town>()

export function getTown(chogs: readonly Chog[]): Town {
  const cached = cache.get(chogs)
  if (cached) return cached
  const backgrounds = new Map<string, Chog[]>()
  for (const chog of chogs) {
    const group = backgrounds.get(chog.background) ?? []
    group.push(chog)
    backgrounds.set(chog.background, group)
  }
  const rare: Chog[] = []
  for (const [name, group] of backgrounds) if (!name || group.length < 30) {
    rare.push(...group)
    backgrounds.delete(name)
  }
  if (rare.length) backgrounds.set('Rare Row', rare)
  const streets: Street[] = []
  const byId = new Map<number, Street>()
  const neighbourhoods = [...backgrounds].sort(([a], [b]) => Object.keys(colours).indexOf(a) - Object.keys(colours).indexOf(b)).map(([name, group]) => {
    const sorted = [...group].sort((a, b) => a.id - b.id)
    const total = Math.ceil(sorted.length / 40), size = Math.floor(sorted.length / total), extra = sorted.length % total
    const colour = colours[name] ?? colours['Rare Row']
    let offset = 0
    const local = Array.from({ length: total }, (_, i) => {
      const count = size + Number(i < extra)
      const street: Street = { index: streets.length, neighbourhood: name, colour, number: i + 1, total,
        name: total === 1 ? name : `${name} · Street ${i + 1} of ${total}`, chogs: sorted.slice(offset, offset + count) }
      offset += count
      streets.push(street)
      for (const chog of street.chogs) byId.set(chog.id, street)
      return street
    })
    return { name, colour, streets: local }
  })
  const town = { neighbourhoods, streets, streetOf: (id: number) => byId.get(id) }
  if (import.meta.env.DEV) {
    console.assert(byId.size === chogs.length && streets.every(street => street.chogs.length <= 40), 'Every Chog has one street of at most 40 houses')
    console.assert(neighbourhoods.every(n => Math.max(...n.streets.map(s => s.chogs.length)) - Math.min(...n.streets.map(s => s.chogs.length)) <= 1), 'Neighbourhood streets are balanced')
  }
  cache.set(chogs, town)
  return town
}
