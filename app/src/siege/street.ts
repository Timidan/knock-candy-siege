import type { Address } from 'viem'
import { isAddress } from 'viem'
import { KNOCK, ownerOf, readHouse, readCrews } from '../chain'

export type StreetBonuses = { candy: number; trap: boolean; chog: boolean; crew: number }
export const NO_STREET: StreetBonuses = { candy: 0, trap: false, chog: false, crew: 0 }
export type StreetRead = { status: 'ready' | 'unavailable' | 'guest'; bonuses: StreetBonuses }
export const CREW_BONUSES: Record<number, { name: string; effect: string }> = {
  1: { name: 'Ghosts', effect: 'Your hero dodges 10% of hits' },
  2: { name: 'Witches', effect: 'Spell and special cooldowns −15%' },
  3: { name: 'Pumpkins', effect: 'Tower guards have +25% health' },
  4: { name: 'Bats', effect: '+25% damage against flyers' },
}
// Only called on Play / Restart. A failed or slow read grants nothing, never cached partial bonuses.
export async function readStreetBonuses(id: number, account: Address | null): Promise<StreetRead> {
  if (!account || !isAddress(KNOCK ?? '')) return { status: 'guest', bonuses: NO_STREET }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async (): Promise<StreetRead> => {
        if ((await ownerOf(id)).toLowerCase() !== account.toLowerCase()) return { status: 'guest', bonuses: NO_STREET }
        const [house, crews] = await Promise.all([readHouse(id), readCrews([id])])
        return { status: 'ready', bonuses: { candy: Number(house.bowlCandy > 60n ? 60n : house.bowlCandy), trap: house.trap, chog: house.bowlChog > 0n, crew: crews.get(id) ?? 0 } }
      })(),
      new Promise<StreetRead>(resolve => { timer = setTimeout(() => resolve({ status: 'unavailable', bonuses: NO_STREET }), 6000) }),
    ])
  } catch { return { status: 'unavailable', bonuses: NO_STREET } }
  finally { clearTimeout(timer) }
}
export function streetLines(b: StreetBonuses): { source: string; bonus: string }[] {
  return [
    ...(b.trap ? [{ source: 'Set trap', bonus: 'One free Pumpkin Trap · place it from the trap tray' }] : []),
    ...(b.candy ? [{ source: 'Stocked candy bowl', bonus: `+${b.candy} starting candy · 1 per candy, up to 60` }] : []),
    ...(b.chog ? [{ source: '$CHOG bowl', bonus: '+10% candy from kills this level' }] : []),
    ...(CREW_BONUSES[b.crew] ? [{ source: `${CREW_BONUSES[b.crew].name} crew`, bonus: CREW_BONUSES[b.crew].effect }] : []),
  ]
}
