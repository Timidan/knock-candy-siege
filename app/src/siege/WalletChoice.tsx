import { useState } from 'react'
import { Sticker } from '../ui'
import { guestBackup, type SiegeWallet } from './guestWallet'

export function WalletChoice({ wallet, disabled = false }: { wallet: SiegeWallet; disabled?: boolean }) {
  const [warning, setWarning] = useState(false), [key, setKey] = useState('')
  return <section aria-label="Choose your wallet" className="siege-shop-note siege-wallet">
    <div className="row">
      <Sticker disabled={disabled || wallet.connecting} aria-pressed={wallet.choice === 'guest' && !!wallet.account} onClick={() => { setKey(''); setWarning(false); wallet.useGuest() }}>Use guest wallet</Sticker>
      <Sticker disabled={disabled || wallet.connecting} aria-pressed={wallet.choice === 'connected' && !!wallet.account} onClick={() => { setKey(''); setWarning(false); void wallet.useConnected() }}>{wallet.connecting ? 'Connecting…' : 'Use connected wallet'}</Sticker>
    </div>
    {wallet.account && <p className="siege-wallet-account"><strong>{wallet.guest ? 'Guest wallet: testnet only' : 'Connected wallet'}</strong> <span>{wallet.account}</span></p>}
    {wallet.guest && <>
      <small>Saved on this device. Back up before clearing browser data. Never send real funds here.</small>
      <button className="siege-text-button" onClick={() => { setWarning(!warning); setKey('') }}>{warning ? 'Hide backup' : 'Show/backup key'}</button>
      {warning && <div role="alert"><p>Anyone with this key can use your guest wallet. Only reveal it in private and keep your backup somewhere safe. This wallet is for testnet only.</p>{!key ? <Sticker onClick={() => setKey(guestBackup())}>I understand — reveal key</Sticker> : <textarea aria-label="Guest wallet backup key" readOnly value={key} style={{ width: '100%', overflowWrap: 'anywhere' }} />}</div>}
    </>}
    {(wallet.error || wallet.connectedError) && <p role="status">{wallet.error || wallet.connectedError}</p>}
    {wallet.sandbox && <p className="siege-wallet-sandbox"><strong>Sandbox: a demo copy of Monad, nothing is real</strong><br /><span>The shop and starter grant still use Robinhood testnet.</span></p>}
  </section>
}
