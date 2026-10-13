import { useEffect, useId, useRef, useState } from 'react'
import { formatEther, type Address } from 'viem'
import { CANDY_TOKEN, isSandbox, knockCandy } from '../chain'
import { Sticker } from '../ui'

export function SandboxBanner() {
  return <aside className="sticker sticker--gold sandbox-banner" style={{ maxWidth: 'min(30rem, 100%)', fontFamily: 'var(--font-hand)', lineHeight: 1.3, whiteSpace: 'normal', cursor: 'default', transform: 'none', animation: 'none' }}>
    Sandbox: play as any Chog on a copy of Monad. Nothing here is real, and it resets every night.
  </aside>
}

export function CandyChip({ owner }: { owner: Address | null }) {
  const titleId = useId()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [failed, setFailed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    let live = true
    setBalance(null); setFailed(false)
    if (isSandbox || !owner) return
    const read = () => knockCandy(owner).then(value => {
      if (live) { setBalance(value); setFailed(false) }
    }).catch(() => { if (live) { setBalance(null); setFailed(true) } })
    read()
    const timer = setInterval(read, 15_000)
    return () => { live = false; clearInterval(timer) }
  }, [owner])
  if (isSandbox) return <span className="sticker sticker--gold candy-chip">Sandbox: no $KNOCK</span>
  return <>
    <Sticker tone="gold" className="candy-chip" onClick={() => dialog.current?.showModal()} aria-label="What is $KNOCK? View testnet balance and token information">
      <img src="/art/token/knock-coin-small.svg" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/art/icons/candy.svg' }} />
      <span>{balance === null ? (failed ? 'Unavailable' : owner ? '…' : '—') : Number(formatEther(balance)).toLocaleString(undefined, { maximumFractionDigits: 2 })} $KNOCK</span>
      <small>testnet</small>
    </Sticker>
    <dialog ref={dialog} className="board candy-info" aria-labelledby={titleId}>
      <h2 id={titleId}>What is $KNOCK?</h2>
      <p>Knock Candy ($KNOCK) is Knock's token on vibe/vibe (Robinhood Chain testnet). The vibe/vibe relay pays it out, so it can take a minute to arrive. It's a testnet token with no real value.</p>
      <ul><li>Treat: 100 $KNOCK</li><li>Successful raid: 50 $KNOCK</li><li>Completed route: 500 $KNOCK</li><li>Boss loot claimed: 300 $KNOCK</li></ul>
      <p>Earned rewards are pending until the relay pays them. Only the balance read from the chain appears in your chip.</p>
      {!owner && <p>Choose a Chog to see its owner's balance.</p>}
      <div className="row">
        <a className="sticker sticker--gold" href={`https://testnet.vibevibe.fun/token/${CANDY_TOKEN}`} target="_blank" rel="noreferrer">See $KNOCK on vibe/vibe</a>
        <a className="sticker" href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer">Get test ETH</a>
        <Sticker onClick={() => dialog.current?.close()}>Back</Sticker>
      </div>
    </dialog>
  </>
}

export function Earned({ amount = 100, candy, onClose }: { amount?: number; candy?: string; onClose: () => void }) {
  return <aside className="board earned" role="status">
    {!isSandbox && <img src="/art/ui/knock-earned.svg" alt="" onError={e => { e.currentTarget.hidden = true }} />}
    {candy && <p>+{candy} candy</p>}
    {isSandbox ? <p>In the live game this pays +{amount} $KNOCK on vibe/vibe's testnet. The sandbox pays nothing.</p> : <>
      <strong>+{amount} $KNOCK earned — paid out by the vibe/vibe relay</strong>
      <p>Pending · not received. Testnet only; no real value.</p>
    </>}
    <Sticker onClick={onClose}>Got it</Sticker>
  </aside>
}
