import { useId, useState } from 'react'
import { Sticker } from '../ui'
import { guestBackup, type SiegeWallet } from './guestWallet'

// The wallet shows as a short status pill. The full address and the key backup are one tap away, behind Details.
const pill = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '2px solid #1b0f2b', borderRadius: 999, background: '#2e1a47', color: '#f4eedd', font: '400 15px/1.1 var(--font-display)', letterSpacing: '.03em', whiteSpace: 'nowrap', boxShadow: '2px 2px 0 #1b0f2b' } as const

export function WalletChoice({ wallet, disabled = false }: { wallet: SiegeWallet; disabled?: boolean }) {
  const [warning, setWarning] = useState(false), [key, setKey] = useState(''), [details, setDetails] = useState(false), id = useId()
  return <section aria-label="Choose your wallet" className="siege-shop-note siege-wallet">
    <div className="row">
      <Sticker disabled={disabled || wallet.connecting} aria-pressed={wallet.choice === 'guest' && !!wallet.account} sound="ui-select" onClick={() => { setKey(''); setWarning(false); wallet.useGuest() }}>Use guest wallet</Sticker>
      <Sticker disabled={disabled || wallet.connecting} aria-pressed={wallet.choice === 'connected' && !!wallet.account} sound="ui-select" onClick={() => { setKey(''); setWarning(false); void wallet.useConnected() }}>{wallet.connecting ? 'Connecting…' : 'Use connected wallet'}</Sticker>
    </div>
    {wallet.account && <>
      <span style={pill}>{wallet.guest ? '🎮 Guest pass · testnet' : '🟣 Connected'}</span>
      <button className="siege-text-button" aria-expanded={details} aria-controls={id} onClick={() => { setDetails(!details); setWarning(false); setKey('') }}>{details ? 'Hide details' : 'Details'}</button>
      {/* Plain spans, not the old account line or a small: the hero picker's landscape CSS truncates and hides those. */}
      {details && <div id={id} style={{ flexBasis: '100%', display: 'grid', justifyItems: 'center', gap: 4 }}>
        <p style={{ overflowWrap: 'anywhere' }}><strong>{wallet.guest ? 'Guest wallet: testnet only' : 'Connected wallet'}</strong> <span>{wallet.account}</span></p>
        {wallet.guest && <>
          <span style={{ fontSize: 15 }}>Saved on this device. Back up before clearing browser data. Never send real funds here.</span>
          <button className="siege-text-button" onClick={() => { setWarning(!warning); setKey('') }}>{warning ? 'Hide backup' : 'Show/backup key'}</button>
          {warning && <div role="alert"><p>Anyone with this key can use your guest wallet. Only reveal it in private and keep your backup somewhere safe. This wallet is for testnet only.</p>{!key ? <Sticker onClick={() => setKey(guestBackup())}>I understand — reveal key</Sticker> : <textarea aria-label="Guest wallet backup key" readOnly value={key} style={{ width: '100%', overflowWrap: 'anywhere' }} />}</div>}
        </>}
      </div>}
    </>}
    {(wallet.error || wallet.connectedError) && <p role="status">{wallet.error || wallet.connectedError}</p>}
    {wallet.sandbox && <p className="siege-wallet-sandbox"><strong>Sandbox: a demo copy of Monad, nothing is real</strong><br /><span>The shop and starter grant still use Robinhood testnet.</span></p>}
  </section>
}
