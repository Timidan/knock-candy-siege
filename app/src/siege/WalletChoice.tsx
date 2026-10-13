import { useState } from 'react'
import { Sticker } from '../ui'
import { guestBackup, type SiegeWallet } from './guestWallet'

export function WalletChoice({ wallet, disabled = false }: { wallet: SiegeWallet; disabled?: boolean }) {
  const [warning, setWarning] = useState(false), [key, setKey] = useState('')
  return <section aria-label="Choose your wallet" className="siege-shop-note" style={{ padding: 12, margin: '12px 0' }}>
    <div className="row">
      <Sticker disabled={disabled || wallet.connecting} aria-pressed={wallet.choice === 'guest' && !!wallet.account} onClick={() => { setKey(''); setWarning(false); wallet.useGuest() }}>Use guest wallet</Sticker>
      <Sticker disabled={disabled || wallet.connecting} aria-pressed={wallet.choice === 'connected' && !!wallet.account} onClick={() => { setKey(''); setWarning(false); void wallet.useConnected() }}>{wallet.connecting ? 'Connecting…' : 'Use connected wallet'}</Sticker>
    </div>
    {wallet.account && <p style={{ margin: '8px auto' }}><strong>{wallet.guest ? 'Guest wallet: testnet only' : 'Connected wallet'}</strong><br /><span style={{ overflowWrap: 'anywhere' }}>{wallet.account}</span></p>}
    {wallet.guest && <>
      <small>Saved on this device. Back up before clearing browser data. Never send real funds here.</small><br />
      <button className="siege-text-button" style={{ color: 'inherit', marginTop: 4 }} onClick={() => { setWarning(!warning); setKey('') }}>{warning ? 'Hide backup' : 'Show/backup key'}</button>
      {warning && <div role="alert"><p>Anyone with this key can use your guest wallet. Only reveal it in private and keep your backup somewhere safe. This wallet is for testnet only.</p>{!key ? <Sticker onClick={() => setKey(guestBackup())}>I understand — reveal key</Sticker> : <textarea aria-label="Guest wallet backup key" readOnly value={key} style={{ width: '100%', overflowWrap: 'anywhere' }} />}</div>}
    </>}
    {(wallet.error || wallet.connectedError) && <p role="status">{wallet.error || wallet.connectedError}</p>}
    {wallet.sandbox && <p><strong>Sandbox: a demo copy of Monad, nothing is real</strong><br />The shop and starter grant still use Robinhood testnet.</p>}
  </section>
}
