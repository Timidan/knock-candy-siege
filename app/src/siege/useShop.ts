import { useEffect, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'
import type { SiegeWallet } from './guestWallet'
import { injectedWallet, isSandbox } from '../chain'
import { buyCrate as payCrate, cachedOwned, confirmCrate, confirmPurchase, onShopNetwork, pendingPurchase, purchase, readShop, shopError, switchShopNetwork, type PurchasePhase } from './shopChain'
import { track } from './telemetry'

// onCrate: a Candy Crate payment confirmed and verified; the caller credits it to the save once per hash and says whether it was new.
export function useShop(wallet: SiegeWallet, onCrate: (hash: Hash) => boolean) {
  const account = wallet.account
  const [data, setData] = useState<{ account: Address | null; owned: number[]; balance: bigint | null; gas: bigint | null; prices: Record<number, bigint> | null }>({ account: wallet.account, owned: cachedOwned(wallet.account), balance: null, gas: null, prices: null })
  const [network, setNetwork] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [hash, setHash] = useState<Hash | null>(null)
  const current = useRef(account), locked = useRef(false), crate = useRef(onCrate)
  current.current = account; crate.current = onCrate
  const refresh = async (address = current.current) => {
    try {
      const next = await readShop(address)
      if (current.current === address) { setData({ account: address, ...next }); setError('') }
    } catch (reason) { if (current.current === address) setError(`Could not refresh the shop. ${shopError(reason)}`) }
  }
  useEffect(() => {
    const provider = injectedWallet()
    if (wallet.guest) { setNetwork(true); return }
    setNetwork(false)
    if (!provider || isSandbox) return
    let active = true
    const chain = () => { void onShopNetwork().then(value => { if (active) setNetwork(value) }) }
    chain(); provider.on('chainChanged', chain)
    return () => { active = false; provider.removeListener('chainChanged', chain) }
  }, [wallet.account, wallet.guest])
  useEffect(() => {
    setData(previous => ({ account, owned: cachedOwned(account), balance: null, gas: null, prices: previous.prices })); setStatus(''); setHash(account ? pendingPurchase(account) ?? pendingPurchase(account, true) : null)
    void refresh(account)
    const timer = window.setInterval(() => { if (!locked.current) void refresh(account) }, 30_000)
    return () => clearInterval(timer)
  }, [account])
  const connect = async () => {
    if (isSandbox || locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      if (!account) { await wallet.useConnected(); return }
      await switchShopNetwork(); setNetwork(true); setStatus('Wallet ready on Robinhood Chain Testnet.')
    } catch (reason) { setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  const buy = async (item: number) => {
    if (!account || !data.prices || locked.current) return
    locked.current = true; setBusy(true); setError(''); setHash(null)
    const owner = account
    const messages: Record<PurchasePhase, string> = { checking: 'Checking price, balance and ownership…', signature: wallet.guest ? 'Signing the exact-price permit in your guest wallet…' : 'Waiting for your permit signature · exactly this item’s price.', transaction: wallet.guest ? 'Sending from your guest wallet…' : 'Confirm the purchase transaction in your wallet.', confirming: 'Confirming on Robinhood Chain Testnet…', owned: 'Owned! Your item is ready to use.' }
    try {
      await purchase(owner, item, data.prices[item], (phase, tx) => { if (phase === 'owned' && tx) track('purchase', { item: String(item) }); if (current.current === owner) { setStatus(messages[phase]); if (tx) setHash(tx) } }, wallet.guest)
      await refresh(owner)
    } catch (reason) { if (current.current === owner) setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  // A crate payment is credited from its own receipt even if the wallet changed while it confirmed: the crate lives in this browser's save.
  const buyCrate = async () => {
    if (!account || locked.current) return
    locked.current = true; setBusy(true); setError(''); setHash(null)
    const owner = account
    const messages: Partial<Record<PurchasePhase, string>> = { checking: 'Checking your $KNOCK balance…', transaction: wallet.guest ? 'Sending 50 $KNOCK from your guest wallet…' : 'Confirm the 50 $KNOCK transfer in your wallet.', confirming: 'Confirming on Robinhood Chain Testnet…' }
    try {
      const added = crate.current(await payCrate(owner, (phase, tx) => { if (current.current === owner) { setStatus(messages[phase] ?? ''); if (tx) setHash(tx) } }, wallet.guest))
      if (current.current === owner) setStatus(added ? 'Candy Crate added. Switch it on in the hero picker before a night.' : 'This payment already added its crate.')
      await refresh(owner)
    } catch (reason) { if (current.current === owner) setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  const checkPending = async () => {
    if (!account || !hash || locked.current) return
    locked.current = true; setBusy(true); setError(''); setStatus('Checking your purchase…')
    try {
      if (pendingPurchase(account, true) === hash) { const added = crate.current(await confirmCrate(account, hash)); setHash(null); await refresh(); setStatus(added ? 'Payment confirmed. Candy Crate added.' : 'This payment already added its crate.'); return }
      await confirmPurchase(account, hash); setHash(null); await refresh(); setStatus('Transaction confirmed. Ownership refreshed.')
    }
    catch (reason) { setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  return { account, owned: data.account === account ? data.owned : cachedOwned(account), prices: data.prices, balance: data.account === account ? data.balance : null, gas: data.account === account ? data.gas : null, network, busy, status, error, hash, pending: !!account && !!(pendingPurchase(account) || pendingPurchase(account, true)), connect, buy, buyCrate, refresh, checkPending }
}
export type ShopState = ReturnType<typeof useShop>
