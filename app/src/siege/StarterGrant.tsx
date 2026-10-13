import { Sticker } from '../ui'
import type { CandyBank } from './candyBank'

const grantTx = (tx: string) => <a href={`https://explorer.testnet.chain.robinhood.com/tx/${tx}`} target="_blank" rel="noreferrer">View grant transaction ↗</a>
export function StarterGrant({ bank, hasWallet }: { bank: CandyBank; hasWallet: boolean }) {
  if (!bank.enabled) return null
  const state = bank.claim?.state
  // The first Candy Bank check is the slim pill too, so a wallet that already claimed never flashes the full panel on its way to the pill.
  if (hasWallet && !bank.claim && bank.busy && !bank.error) return <p aria-label="Starter grant" role="status" className="siege-shop-note siege-grant siege-grant--pill"><span>Checking the Candy Bank…</span></p>
  // Once this wallet has claimed, the grant shrinks to one line so the catalog leads. Unclaimed and failed keep the full panel first.
  if (hasWallet && !bank.error && (state === 'queued' || state === 'paid')) return <p aria-label="Starter grant" role="status" className="siege-shop-note siege-grant siege-grant--pill">
    <span>{state === 'paid' ? '✓ Starter grant paid' : 'Starter grant queued · usually paid within a minute. Checking every 5 seconds…'}</span>
    {bank.claim?.tx && grantTx(bank.claim.tx)}
  </p>
  return <section aria-label="Starter grant" className="siege-shop-note siege-grant">
    <strong>A little candy to get started</strong>
    <p>300 $KNOCK and 0.0005 test ETH for gas, once per wallet. Testnet only; no real value.</p>
    {!hasWallet && <p>Choose a guest wallet or connected wallet above to claim.</p>}
    {state === 'queued' ? <p role="status">Grant queued — usually paid within about a minute. Checking every 5 seconds…</p> : state === 'paid' ? <p role="status">Grant paid — your one-time starter grant has been claimed.</p> : <Sticker className="siege-vault-claim" disabled={!hasWallet || bank.busy || state !== 'none'} onClick={() => void bank.claimGrant()}>{bank.busy ? 'Claiming…' : 'Claim 300 $KNOCK'}</Sticker>}
    {bank.error && <p role="status">{bank.error} <button className="siege-text-button" style={{ color: 'inherit' }} disabled={bank.busy} onClick={bank.check}>Check grant status</button></p>}
    {bank.claim?.tx && <p>{grantTx(bank.claim.tx)}</p>}
  </section>
}
