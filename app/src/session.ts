import { createWalletClient, http, zeroAddress, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { abi, client, confirmTransaction, KNOCK, ownerOf, rpc, sendMon, setDelegate } from './chain'

export type PlaySession = { address: Address; expiry: number; remaining: number }
const sessions = new Map<string, { readAt: number; session: PlaySession | null }>()
const cacheKey = (owner: Address, id: number) => `${owner.toLowerCase()}:${id}`

function playAccount(owner: Address, create = false) {
  try {
    const name = `knock:play-key:${owner.toLowerCase()}`
    let key = localStorage.getItem(name)
    if (!key && create) {
      key = generatePrivateKey()
      localStorage.setItem(name, key)
    }
    if (!key) return null
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Invalid key')
    return privateKeyToAccount(key as Hex)
  } catch {
    // Never include storage contents or the underlying key error in a message.
    throw new Error('Cannot read or save your play key. Allow browser storage, then try again.')
  }
}

export function playSigner(owner: Address) {
  const account = playAccount(owner)
  if (!account) throw new Error('No play key saved in this browser.')
  return createWalletClient({ account, chain: client.chain, transport: http(rpc) })
}

export async function playBalance(owner: Address) {
  const account = playAccount(owner)
  return account ? client.getBalance({ address: account.address }) : 0n
}

export async function actionCost() {
  return await client.getGasPrice() * 200_000n
}

export async function sessionFor(owner: Address, id: number): Promise<PlaySession | null> {
  let account
  try { account = playAccount(owner) } catch { return null }
  if (!account) return null
  // Check chain time even on a cache hit, including the fork's Next night jump.
  const block = await client.getBlock()
  const name = cacheKey(owner, id)
  const cached = sessions.get(name)
  if (cached && Date.now() - cached.readAt < 3000 && (!cached.session || cached.session.address === account.address)) {
    const remaining = (cached.session?.expiry ?? 0) - Number(block.timestamp)
    return cached.session && remaining > 0 ? { ...cached.session, remaining } : null
  }
  const [delegate, holder] = await Promise.all([
    client.readContract({ address: KNOCK, abi, functionName: 'delegates', args: [BigInt(id)] }),
    ownerOf(id),
  ])
  const [key, expiry, ownerAtGrant] = delegate
  const session = key.toLowerCase() === account.address.toLowerCase()
    && ownerAtGrant.toLowerCase() === holder.toLowerCase()
    && holder.toLowerCase() === owner.toLowerCase()
    && expiry > block.timestamp
    ? { address: account.address, expiry: Number(expiry), remaining: Number(expiry - block.timestamp) } : null
  sessions.set(name, { readAt: Date.now(), session })
  return session
}

export async function startSession(owner: Address, id: number, { hours = 24, fund, onStep }: {
  hours?: number
  fund: bigint
  onStep?: (message: string) => void
}) {
  if (!Number.isFinite(hours) || hours <= 0 || fund <= 0n) throw new Error('Choose a positive duration and MON amount.')
  const account = playAccount(owner, true)!
  const block = await client.getBlock()
  onStep?.('Step 1 of 2: approve the key')
  await setDelegate(owner, id, account.address, block.timestamp + BigInt(Math.ceil(hours * 3600)))
  sessions.delete(cacheKey(owner, id))
  onStep?.('Step 2 of 2: send gas money')
  const balance = await client.getBalance({ address: account.address })
  if (balance < fund) await sendMon(owner, account.address, fund - balance)
}

export async function topUp(owner: Address, amount: bigint) {
  if (amount <= 0n) throw new Error('Choose a positive MON amount.')
  return sendMon(owner, playSigner(owner).account.address, amount)
}

export async function endSession(owner: Address, id: number) {
  const signer = playSigner(owner)
  // A sale already invalidated this owner's grant; they can still recover their gas.
  if ((await ownerOf(id)).toLowerCase() === owner.toLowerCase())
    await setDelegate(owner, id, zeroAddress, 0n)
  sessions.delete(cacheKey(owner, id))
  try {
    const [balance, gasPrice] = await Promise.all([
      client.getBalance({ address: signer.account.address }), client.getGasPrice(),
    ])
    if (balance <= 21_000n * gasPrice) return { returned: 0n, left: balance }
    const gas = await client.estimateGas({ account: signer.account, to: owner, value: 1n, gasPrice })
    const value = balance - gas * gasPrice
    if (value <= 0n) return { returned: 0n, left: balance }
    await confirmTransaction(await signer.sendTransaction({ to: owner, value, gas, gasPrice }))
    return { returned: value, left: await client.getBalance({ address: signer.account.address }) }
  } catch {
    throw new Error('Play key is off for this Chog, but the MON return failed. Use Take MON back to try again.')
  }
}
