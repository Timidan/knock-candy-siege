import { Sticker } from '../ui'
import type { CandyBank } from './candyBank'

export function StarterGrant({ bank, hasWallet }: { bank: CandyBank; hasWallet: boolean }) {
  if (!bank.enabled) return null
  return <section aria-label="Starter grant" className="siege-shop-note" style={{ padding: 12 }}>
    <strong>A little candy to get started</strong>
    <p style={{ margin: '8px auto' }}>300 $KNOCK and 0.0005 test ETH for gas, once per wallet. Testnet only; no real value.</p>
    {!hasWallet && <p>Choose a guest wallet or connected wallet above to claim.</p>}
    {bank.claim?.state === 'queued' ? <p role="status" style={{ margin: '8px auto' }}>Grant queued — usually paid within about a minute. Checking every 5 seconds…</p> : bank.claim?.state === 'paid' ? <p role="status" style={{ margin: '8px auto' }}>Grant paid — your one-time starter grant has been claimed.</p> : <Sticker tone="gold" disabled={!hasWallet || bank.busy || bank.claim?.state !== 'none'} onClick={() => void bank.claimGrant()}>{bank.busy ? 'Checking the Candy Bank…' : 'Claim 300 $KNOCK (one time)'}</Sticker>}
    {bank.error && <p role="status">{bank.error} <button className="siege-text-button" style={{ color: 'inherit' }} disabled={bank.busy} onClick={bank.check}>Check grant status</button></p>}
    {bank.claim?.tx && <p style={{ margin: '8px auto' }}><a style={{ color: 'inherit' }} href={`https://explorer.testnet.chain.robinhood.com/tx/${bank.claim.tx}`} target="_blank" rel="noreferrer">View grant transaction ↗</a></p>}
  </section>
}
