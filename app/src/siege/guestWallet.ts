import { useState } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { PrivateKeyAccount, Hex } from 'viem'
import type { WalletState } from '../wallet'

const KEY = 'knock-siege-guest-key-v1'
const CHOICE = 'knock-siege-wallet-choice'
export function guestAccount(create = false): PrivateKeyAccount | null {
  const saved = localStorage.getItem(KEY)
  if (saved) {
    if (!/^0x[0-9a-f]{64}$/i.test(saved)) throw new Error('Your saved guest key could not be opened. Restore your backup before using this wallet.')
    try { return privateKeyToAccount(saved as Hex) }
    catch { throw new Error('Your saved guest key could not be opened. Restore your backup before using this wallet.') }
  }
  if (!create) return null
  const key = generatePrivateKey()
  // Require persistence before returning an account that could receive a grant.
  localStorage.setItem(KEY, key)
  return privateKeyToAccount(key)
}
export function guestBackup() { return localStorage.getItem(KEY) ?? '' }
export function useSiegeWallet(connected: WalletState) {
  const [guest, setGuest] = useState(() => { try { return guestAccount() } catch { return null } })
  const [choice, setChoice] = useState<'guest' | 'connected'>(() => { try { return localStorage.getItem(CHOICE) === 'guest' ? 'guest' : 'connected' } catch { return 'connected' } })
  const [error, setError] = useState('')
  const [sandboxId, setSandboxId] = useState<number | null>(null)
  const choose = (value: 'guest' | 'connected') => { setChoice(value); setSandboxId(null); try { localStorage.setItem(CHOICE, value) } catch { /* The choice still works this visit. */ } }
  const useGuest = () => {
    setError('')
    try {
      const account = guestAccount(true)!
      setGuest(account); choose('guest'); return account
    } catch { setError('The guest wallet could not be saved. Allow browser storage, or use a connected wallet.'); return null }
  }
  const useConnected = async () => { choose('connected'); setError(''); if (!connected.account) await connected.connect(false) }
  const account = choice === 'guest' ? guest?.address ?? null : connected.account
  return { account, guest: choice === 'guest' ? guest : null, choice, error, useGuest, useConnected, sandboxId, setSandboxId, sandbox: choice === 'guest' && sandboxId !== null, connecting: connected.connecting, connectedError: choice === 'connected' ? connected.error : '' }
}
export type SiegeWallet = ReturnType<typeof useSiegeWallet>
