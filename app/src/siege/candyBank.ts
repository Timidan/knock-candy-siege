import { useEffect, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'

export const BANK_URL = (import.meta.env.VITE_CANDY_BANK_URL || '').replace(/\/$/, '')
type Claim = { state: 'none' | 'queued' | 'paid' | 'failed'; tx?: Hash }
const bankError = (text: string) => /already|claimed/i.test(text) ? 'This wallet has already claimed its one-time grant.' : /limit|rate|too many/i.test(text) ? 'The Candy Bank has reached its limit. Please try again later.' : 'The Candy Bank could not be reached. Please check again in a moment.'
async function requestClaim(address: Address, post: boolean, signal: AbortSignal): Promise<Claim> {
  const response = await fetch(`${BANK_URL}/claim${post ? '' : `/${address}`}`, {
    method: post ? 'POST' : 'GET', signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    ...(post ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) } : {}),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(bankError(`${body?.error ?? ''} ${body?.message ?? ''} ${response.status === 429 ? 'limit' : ''}`))
  if (!body || !['none', 'queued', 'paid', 'failed'].includes(body.state)) throw new Error('The Candy Bank returned an unreadable status. Please check again.')
  return { state: body.state, ...(/^0x[0-9a-f]{64}$/i.test(body.tx ?? '') ? { tx: body.tx } : {}) }
}
export function useCandyBank(address: Address | null, refreshBalance: () => Promise<void>) {
  const [data, setData] = useState<{ address: Address | null; claim: Claim | null; busy: boolean; error: string }>({ address: null, claim: null, busy: false, error: '' })
  const [attempt, setAttempt] = useState(0)
  const current = useRef(address), refresh = useRef(refreshBalance), locked = useRef(false)
  current.current = address; refresh.current = refreshBalance
  const controller = useRef<AbortController | null>(null)
  const status = useRef<Claim | null>(null)
  const accept = (owner: Address, claim: Claim) => {
    if (current.current !== owner) return
    if (claim.state === 'paid' && status.current?.state !== 'paid') void refresh.current()
    status.current = claim
    setData({ address: owner, claim, busy: false, error: claim.state === 'failed' ? 'The grant could not be paid. Please check again later.' : '' })
  }
  useEffect(() => {
    status.current = null; locked.current = false
    if (!BANK_URL || !address) return
    const abort = new AbortController(); controller.current = abort
    let polling = false
    setData({ address, claim: null, busy: true, error: '' })
    const check = async () => {
      if (locked.current || polling) return
      polling = true
      try { const claim = await requestClaim(address, false, abort.signal); if (!abort.signal.aborted) accept(address, claim) }
      catch (error) { if (!abort.signal.aborted) setData(previous => ({ ...previous, busy: false, error: error instanceof Error ? error.message : bankError('') })) }
      finally { polling = false }
    }
    void check()
    const timer = setInterval(() => { if (status.current?.state === 'queued') void check() }, 5000)
    return () => { abort.abort(); clearInterval(timer) }
  }, [address, attempt])
  const claim = async () => {
    if (!address || !BANK_URL || locked.current || !controller.current || !status.current || status.current.state !== 'none') return
    const abort = controller.current
    locked.current = true; setData(previous => ({ ...previous, busy: true, error: '' }))
    try { const result = await requestClaim(address, true, abort.signal); if (!abort.signal.aborted) accept(address, result) }
    catch (error) { if (!abort.signal.aborted) setData(previous => ({ ...previous, busy: false, error: error instanceof Error ? error.message : bankError('') })) }
    finally { if (!abort.signal.aborted) locked.current = false }
  }
  const visible = data.address === address ? data : { claim: null, busy: !!address, error: '' }
  return { enabled: !!BANK_URL, ...visible, claimGrant: claim, check: () => setAttempt(value => value + 1) }
}
export type CandyBank = ReturnType<typeof useCandyBank>
