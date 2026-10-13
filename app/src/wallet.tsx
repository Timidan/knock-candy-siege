import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Address } from 'viem'
import { connectWallet, injectedWallet, isFork, ownedChogs, subscribeWallet, walletAccount } from './chain'
import { thumb } from './images'
import { Sticker } from './ui'

export function useWallet() {
  const account = useSyncExternalStore(subscribeWallet, walletAccount)
  const [chogs, setChogs] = useState<{ owner: Address | null; ids: number[]; error: string }>({ owner: null, ids: [], error: '' })
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (isFork || !account) return
    let active = true
    setChogs({ owner: null, ids: [], error: '' })
    setConnectError('')
    ownedChogs(account).then(ids => {
      if (active) setChogs({ owner: account, ids, error: '' })
    }).catch(error => {
      if (active) setChogs({ owner: account, ids: [], error: `Could not load your Chogs: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}` })
    })
    return () => { active = false }
  }, [account, attempt])
  const connect = async (switchToMonad = true) => {
    setConnecting(true)
    setConnectError('')
    try {
      const previous = walletAccount()
      if (await connectWallet(switchToMonad) === previous) setAttempt(value => value + 1)
    } catch (error) {
      setConnectError(error instanceof Error ? error.message.split('\n')[0] : String(error))
    } finally {
      setConnecting(false)
    }
  }
  return {
    account, connecting, connect,
    ids: account && chogs.owner === account ? chogs.ids : [],
    loading: !!account && chogs.owner !== account,
    error: connectError || (chogs.owner === account ? chogs.error : ''),
  }
}

export type WalletState = ReturnType<typeof useWallet>
export function walletPlayHint(wallet: WalletState, id: number | null): string {
  if (!wallet.account) return 'Connect your wallet to play as a Chog you own.'
  if (!id) return 'Choose a Chog you own to play.'
  // The owned-Chog list is only a shortcut; starting play checks ownerOf itself, so a slow or failed list never blocks it.
  if (wallet.loading || wallet.error) return ''
  return wallet.ids.includes(id) ? '' : `This wallet doesn't own Chog #${id}.`
}

export function WalletPicker({ wallet, onChoose, disabled = false }: {
  wallet: WalletState
  onChoose: (id: number) => void
  disabled?: boolean
}) {
  return <section className="wallet-picker" aria-label="Your wallet">
    {wallet.account ? <p title={wallet.account}>Wallet {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}</p> :
      <Sticker icon="key" tone="orange" disabled={wallet.connecting || !injectedWallet()} onClick={() => void wallet.connect()}>
        {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
      </Sticker>}
    {!injectedWallet() && <p>Open this page in your wallet's browser, or install a wallet</p>}
    {wallet.loading && <p role="status">Loading your Chogs…</p>}
    {wallet.error && <div role="status"><p>{wallet.error}</p><Sticker disabled={wallet.connecting} onClick={() => void wallet.connect()}>Try again</Sticker></div>}
    {wallet.account && !wallet.loading && !wallet.error && !wallet.ids.length &&
      <p>No Chog Genesis in this wallet. You can borrow any Chog in Candy Siege.</p>}
    {!!wallet.ids.length && <div className="row wallet-chogs" aria-label="Choose a Chog to play">
      {wallet.ids.map(id => <Sticker key={id} className="wallet-chog" disabled={disabled || wallet.connecting} onClick={() => onChoose(id)} aria-label={`Play as Chog #${id}`}>
        <img src={thumb(id, true)} alt="" loading="lazy" />#{id}
      </Sticker>)}
    </div>}
  </section>
}
