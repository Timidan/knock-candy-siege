import type { Address } from 'viem'
import { chogBalance, ownerOf } from '../chain'

// Keep the scene's existing bonus shape; only the holder candy perks are used.
export type StreetBonuses = { candy: number; trap: boolean; chog: boolean; crew: number }
export const NO_STREET: StreetBonuses = { candy: 0, trap: false, chog: false, crew: 0 }
export type StreetRead = { status: 'ready' | 'unavailable' | 'guest'; bonuses: StreetBonuses }
export async function readHomeAdvantage(id: number, account: Address | null, sandbox = false): Promise<boolean> {
  if (!account) return false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      ownerOf(id, sandbox).then(owner => owner.toLowerCase() === account.toLowerCase()),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 6000) }),
    ])
  } catch { return false }
  finally { clearTimeout(timer) }
}
export async function readHolderBonuses(_id: number, account: Address | null, sandbox = false): Promise<StreetRead> {
  if (!account) return { status: 'guest', bonuses: NO_STREET }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      chogBalance(account, sandbox).then(balance => ({ status: 'ready' as const, bonuses: balance > 0n ? { candy: 25, trap: false, chog: true, crew: 0 } : NO_STREET })),
      new Promise<StreetRead>(resolve => { timer = setTimeout(() => resolve({ status: 'unavailable', bonuses: NO_STREET }), 6000) }),
    ])
  } catch { return { status: 'unavailable', bonuses: NO_STREET } }
  finally { clearTimeout(timer) }
}
export function holderLines(b: StreetBonuses): { source: string; bonus: string }[] {
  return b.chog ? [
    { source: '$CHOG holder', bonus: '+25 starting candy' },
    { source: 'A sweeter night', bonus: '+10% candy from kills this level' },
  ] : []
}
