import { useEffect, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'
import type { WalletState } from '../wallet'
import { injectedWallet, isSandbox } from '../chain'
import { cachedOwned, confirmPurchase, onShopNetwork, pendingPurchase, purchase, readAccount, readShop, shopError, switchShopNetwork, type PurchasePhase } from './shopChain'

export function useShop(wallet: WalletState) {
  const [account, setAccount] = useState<Address | null>(wallet.account)
  const [data, setData] = useState<{ account: Address | null; owned: number[]; balance: bigint | null; gas: bigint | null; prices: Record<number, bigint> | null }>({ account: wallet.account, owned: cachedOwned(wallet.account), balance: null, gas: null, prices: null })
  const [network, setNetwork] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState(''), [hash, setHash] = useState<Hash | null>(null)
  const current = useRef(account), locked = useRef(false)
  current.current = account
  const refresh = async (address = current.current) => {
    try {
      const next = await readShop(address)
      if (current.current === address) { setData({ account: address, ...next }); setError('') }
    } catch (reason) { if (current.current === address) setError(`Could not refresh the shop. ${shopError(reason)}`) }
  }
  useEffect(() => {
    const provider = injectedWallet()
    if (!provider || isSandbox) return
    let active = true
    const accounts = (values: Address[]) => { if (active) setAccount(values[0] ?? null) }
    const chain = () => { void onShopNetwork().then(value => { if (active) setNetwork(value) }) }
    void readAccount().then(address => { if (active) setAccount(address) }).catch(() => {})
    chain(); provider.on('accountsChanged', accounts); provider.on('chainChanged', chain)
    return () => { active = false; provider.removeListener('accountsChanged', accounts); provider.removeListener('chainChanged', chain) }
  }, [wallet.account])
  useEffect(() => {
    setData({ account, owned: cachedOwned(account), balance: null, gas: null, prices: null }); setStatus(''); setHash(account ? pendingPurchase(account) : null)
    void refresh(account)
    const timer = window.setInterval(() => { if (!locked.current) void refresh(account) }, 30_000)
    return () => clearInterval(timer)
  }, [account])
  const connect = async () => {
    if (isSandbox || locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      if (!await readAccount()) await wallet.connect()
      const address = await readAccount()
      if (!address) throw new Error('Connect an account in your wallet to continue.')
      setAccount(address)
      await switchShopNetwork(); setNetwork(true); setStatus('Wallet ready on Robinhood Chain Testnet.')
    } catch (reason) { setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  const buy = async (item: number) => {
    if (!account || !data.prices || locked.current) return
    locked.current = true; setBusy(true); setError(''); setHash(null)
    const owner = account
    const messages: Record<PurchasePhase, string> = { checking: 'Checking price, balance and ownership…', signature: 'Waiting for your permit signature · exactly this item’s price.', transaction: 'Confirm the purchase transaction in your wallet.', confirming: 'Confirming on Robinhood Chain Testnet…', owned: 'Owned! Your item is ready to use.' }
    try {
      await purchase(owner, item, data.prices[item], (phase, tx) => { if (current.current === owner) { setStatus(messages[phase]); if (tx) setHash(tx) } })
      await refresh(owner)
    } catch (reason) { if (current.current === owner) setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  const checkPending = async () => {
    if (!account || !hash || locked.current) return
    locked.current = true; setBusy(true); setError(''); setStatus('Checking your purchase…')
    try { await confirmPurchase(account, hash); setHash(null); await refresh(); setStatus('Transaction confirmed. Ownership refreshed.') }
    catch (reason) { setError(shopError(reason)) }
    finally { locked.current = false; setBusy(false) }
  }
  return { account, owned: data.account === account ? data.owned : cachedOwned(account), prices: data.prices, balance: data.account === account ? data.balance : null, gas: data.account === account ? data.gas : null, network, busy, status, error, hash, pending: !!account && !!pendingPurchase(account), connect, buy, refresh, checkPending }
}
export type ShopState = ReturnType<typeof useShop>
