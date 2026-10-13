export const SHOP_ITEMS = [
  ...['floss', 'dab', 'moonwalk', 'robot', 'chicken', 'breakdance', 'disco', 'worm'].map((key, i) => ({ id: i + 1, key, name: key[0].toUpperCase() + key.slice(1), price: 150, kind: 'dance' as const, card: `dance-${key}` })),
  ...['ghosts', 'witches', 'pumpkins', 'bats'].map((crew, i) => ({ id: i + 11, key: `crew-${crew}`, name: `${crew[0].toUpperCase() + crew.slice(1)} costume`, price: 400, kind: 'costume' as const, card: `crew-${crew}` })),
  { id: 21, key: 'gold-towers', name: 'Golden towers', price: 600, kind: 'towers' as const, card: 'gold-towers' },
  { id: 22, key: 'emote-pack', name: 'Crypto emote pack', price: 300, kind: 'emotes' as const, card: 'emote-pack' },
  { id: 23, key: 'starter-candy', name: 'A sweeter start', price: 200, kind: 'candy' as const, card: 'starter-candy' },
  { id: 31, key: 'roost', name: 'Bat Roost', price: 400, kind: 'tower' as const, card: 'bat-roost' },
]
export const CRYPTO_EMOTES = ['gm', 'lfg', 'wagmi', 'rekt', 'hodl', 'moon', 'gn', 'ngmi']
export type ShopItem = typeof SHOP_ITEMS[number]
export function canDance(name: string, signature: string, owned: number[], dances: Record<string, { group: string }>) {
  return name === signature || dances[name]?.group === 'universal' || SHOP_ITEMS.some(item => item.kind === 'dance' && item.key === name && owned.includes(item.id))
}
