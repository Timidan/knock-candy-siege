import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { formatEther, parseEther, type Address } from 'viem'
import { actionCost, endSession, playBalance, sessionFor, startSession, topUp, type PlaySession } from '../session'
import { Sticker } from '../ui'
import '../game/game.css'

const mon = (value: bigint) => Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 })
const money = (value: bigint) => value > 0n && value < parseEther('0.0001') ? '<0.0001' : mon(value)

export function Session({ owner, id, disabled = false }: { owner: Address; id: number; disabled?: boolean }) {
  const sheet = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [info, setInfo] = useState<{ active: PlaySession | null; balance: bigint; cost: bigint } | null>(null)
  const [amount, setAmount] = useState('0.25')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [readError, setReadError] = useState('')
  const refresh = useCallback(async () => {
    const [active, balance, cost] = await Promise.all([sessionFor(owner, id), playBalance(owner), actionCost()])
    setInfo({ active, balance, cost })
    setReadError('')
  }, [owner, id])

  useEffect(() => {
    const read = () => refresh().catch(error =>
      setReadError(error instanceof Error ? error.message.split('\n')[0] : 'Could not read your play key. Try again.'))
    void read()
    const timer = setInterval(read, 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  const run = async (work: () => Promise<string>) => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try { setMessage(await work()) }
    catch (error) { setMessage(error instanceof Error ? error.message.split('\n')[0] : 'That did not work. Try again.') }
    finally {
      await refresh().catch(() => setReadError('Could not refresh your play key. Try again.'))
      setBusy(false)
    }
  }
  const end = () => run(async () => {
    setMessage('Ending this Chog’s session, then taking the MON back…')
    const result = await endSession(owner, id)
    return `Play key off. ${money(result.returned)} MON returned.${result.left > 0n ? ` ${money(result.left)} MON stays on the key because it cannot cover the return gas.` : ''}`
  })
  const open = () => {
    setMessage('')
    sheet.current?.showModal()
    void refresh().catch(() => setReadError('Could not refresh your play key. Try again.'))
  }
  const active = info?.active
  const hours = active ? Math.floor(active.remaining / 3600) : 0
  const left = hours > 0 ? `${hours} h left` : `${Math.max(1, Math.ceil((active?.remaining ?? 0) / 60))} min left`
  const actions = info && info.cost > 0n ? (parseEther(amount) / info.cost).toLocaleString() : null

  return <div className="play-session">
    {active ? <>
      <Sticker icon="key" tone="gold" className="play-session-chip" disabled={disabled || busy} onClick={open}>
        Play key on · {left} · {money(info.balance)} MON
      </Sticker>
      <Sticker disabled={disabled || busy} onClick={open}>Top up</Sticker>
      <Sticker disabled={disabled || busy} onClick={() => { open(); void end() }}>End</Sticker>
    </> : <Sticker icon="key" disabled={disabled || busy} onClick={open}>Play without pop-ups</Sticker>}

    <dialog ref={sheet} className="board play-session-sheet" aria-labelledby={title}
      onCancel={event => { if (busy) event.preventDefault() }}>
      <h2 id={title}>{active ? `Play key · Chog #${id}` : 'Play without pop-ups'}</h2>
      {active ? <p>Play key on · {left} · {money(info.balance)} MON. Add a little MON, or end this Chog’s session and take the rest back.</p> : <p>
        Approve a play key for Chog #{id} for 24 hours. It can knock, raid, hit the Great Pumpkin, claim loot,
        craft, set traps, wear costumes and clean other players’ houses for this Chog. It can't move your Chog,
        your $CHOG or your bowl, and selling the Chog cancels it. Take the rest back any time.
      </p>}
      <p>Send it a little MON for gas: {amount} MON {actions !== null ? `covers about ${actions} actions at today's gas price` : '— reading today’s gas price…'}.</p>
      <div className="row play-session-amounts" role="group" aria-label="MON for gas">
        {['0.1', '0.25', '0.5'].map(value => <Sticker key={value} tone={amount === value ? 'gold' : 'paper'}
          aria-pressed={amount === value} disabled={busy} onClick={() => setAmount(value)}>{value} MON</Sticker>)}
      </div>
      <p className="play-session-note">Gas money is shared by your Chogs in this browser. Ending takes that money back; your other Chogs’ play keys may need a top-up. Keep this browser’s data until you’ve taken it back.</p>
      {!active && !!info?.balance && <p>{money(info.balance)} MON is already on this browser’s key. Start only adds enough to reach the amount above.</p>}
      {readError && <p role="alert">{readError}</p>}
      <p role="status" aria-live="polite">{message}</p>
      <div className="row play-session-buttons">
        {active ? <>
          <Sticker icon="coin" tone="gold" disabled={busy || !!readError} onClick={() => run(async () => {
            setMessage('Send gas money to your play key…')
            await topUp(owner, parseEther(amount))
            return `Added ${amount} MON. Ready to play!`
          })}>Top up {amount} MON</Sticker>
          <Sticker disabled={busy} onClick={() => void end()}>End &amp; take MON back</Sticker>
        </> : <>
          <Sticker icon="key" tone="orange" disabled={busy || !info || !!readError} onClick={() => run(async () => {
            await startSession(owner, id, { fund: parseEther(amount), onStep: setMessage })
            return 'Play key on. Ready to play!'
          })}>Start (2 wallet steps)</Sticker>
          {!!info?.balance && <Sticker disabled={busy} onClick={() => void end()}>Take MON back</Sticker>}
        </>}
        <Sticker disabled={busy} onClick={() => sheet.current?.close()}>{active || message ? 'Back to play' : 'Not now'}</Sticker>
      </div>
    </dialog>
  </div>
}
