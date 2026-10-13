// Candy Bank: a single outbound-only payer for Robinhood Chain Testnet.
// DRY=1 requires DRY_ADDRESS; it never reads RELAY_KEY or broadcasts transactions.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createPublicClient, createWalletClient, defineChain, encodeFunctionData, http, keccak256, parseAbi, parseAbiItem, parseEther, parseGwei } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const { BANK_URL, BANK_TOKEN, RELAY_STATE } = process.env
const DRY = process.env.DRY === '1' || process.argv.includes('--dry-run')
const dryAddress = process.env.DRY_ADDRESS?.toLowerCase()
if (!BANK_URL || !BANK_TOKEN) throw new Error('Set BANK_URL and BANK_TOKEN')
if (!/^https:\/\//.test(BANK_URL)) throw new Error('BANK_URL must use HTTPS')
if (DRY && !/^0x[0-9a-f]{40}$/.test(dryAddress ?? '')) throw new Error('DRY=1 requires DRY_ADDRESS (only that test claim will be closed)')
if (!DRY && (!process.env.RELAY_KEY || !RELAY_STATE)) throw new Error('Set RELAY_KEY and RELAY_STATE')
const RELAY = '0xF86700Fe4ea98658558893f468A1BcdCDa6b76f7'
const CANDY = '0x2Ae41145A6acB58d4457c49df27ab6BFEF618492'
const CANDY_DEPLOY_BLOCK = 133099671n // verified factory creation receipt on chain 46630
const AMOUNT = parseEther('300'), GAS_GIFT = parseEther('0.0005')
// The gift is a plain transfer with an explicit gas limit and fee ceiling: at most 0.000021 ETH in fees.
const GIFT_GAS = 21_000n, MAX_FEE = parseGwei('1')
const HOURLY_CAP = 60, DAILY_CAP = 200 // new grants per rolling hour and per rolling 24 hours, kept in the state file
const chain = defineChain({ id: 46630, name: 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } } })
const rpc = createPublicClient({ chain, transport: http() })
let payer = null
if (!DRY) {
  try { payer = createWalletClient({ account: privateKeyToAccount(process.env.RELAY_KEY), chain, transport: http() }) }
  catch { throw new Error('Invalid RELAY_KEY (value omitted)') }
}
if (payer && payer.account.address.toLowerCase() !== RELAY.toLowerCase()) throw new Error('RELAY_KEY does not match the approved bank wallet')
const erc20 = parseAbi(['function transfer(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'])
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const state = !DRY && existsSync(RELAY_STATE) ? JSON.parse(readFileSync(RELAY_STATE, 'utf8')) : { version: 1, grants: {}, starts: [] }
if (state.version !== 1 || !state.grants || !Array.isArray(state.starts)) throw new Error('Use a Candy Bank state file, not the retired event-watcher state')
function save() {
  mkdirSync(dirname(RELAY_STATE), { recursive: true })
  writeFileSync(`${RELAY_STATE}.tmp`, JSON.stringify(state), { mode: 0o600, flush: true })
  renameSync(`${RELAY_STATE}.tmp`, RELAY_STATE)
}
async function bank(path, body) {
  const response = await fetch(`${BANK_URL.replace(/\/$/, '')}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${BANK_TOKEN}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw new Error(`Bank HTTP ${response.status}`)
  return response.json()
}
const balance = address => rpc.readContract({ address: CANDY, abi: erc20, functionName: 'balanceOf', args: [address] })

async function alreadyReceived(address) {
  // Always read this relay's payment history, whatever the address holds now: lost local state
  // must never allow a second grant. If history cannot be read, fail closed (this throws).
  // 1M-block ranges: the public RPC allows 10M per request, and the chain adds ~600k blocks a day.
  const latest = await rpc.getBlockNumber()
  let received = 0n
  for (let fromBlock = CANDY_DEPLOY_BLOCK; fromBlock <= latest; fromBlock += 1_000_000n) {
    const toBlock = fromBlock + 999_999n < latest ? fromBlock + 999_999n : latest
    const logs = await rpc.getLogs({ address: CANDY, event: transferEvent, args: { from: RELAY, to: address }, fromBlock, toBlock, strict: true })
    for (const log of logs) {
      received += log.args.value
      if (received >= AMOUNT) return log.transactionHash
    }
  }
  return null
}
async function transact(record, part, request) {
  if (!record[part]) {
    const prepared = await payer.prepareTransactionRequest({ ...request, account: payer.account })
    const raw = await payer.signTransaction({ ...prepared, ...request }) // explicit fields (the gift's gas and fees) always win
    // Persist the exact signed transaction before any broadcast. Restart can only
    // rebroadcast the same hash/nonce, never create a second payment for this part.
    record[part] = { hash: keccak256(raw), raw }
    save()
  }
  const tx = record[part]
  if (tx.confirmed) return
  let receipt = await rpc.getTransactionReceipt({ hash: tx.hash }).catch(error => {
    if (error.name === 'TransactionReceiptNotFoundError') return null
    throw error
  })
  if (!receipt) {
    // A resend after an uncertain submission is the identical signed transaction.
    try { await rpc.sendRawTransaction({ serializedTransaction: tx.raw }) } catch {
      // Already-known and network errors are reconciled by receipt, never by a new nonce.
    }
    receipt = await rpc.waitForTransactionReceipt({ hash: tx.hash, timeout: 120_000 })
  }
  tx.settled = true
  if (receipt.status !== 'success') throw new Error('Transaction reverted')
  if (part === 'candy') {
    const toTopic = `0x${record.address.slice(2).padStart(64, '0')}`
    const fromTopic = `0x${RELAY.slice(2).toLowerCase().padStart(64, '0')}`
    const sent = receipt.logs.some(log => log.address.toLowerCase() === CANDY.toLowerCase() &&
      log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
      log.topics[1]?.toLowerCase() === fromTopic && log.topics[2]?.toLowerCase() === toTopic && BigInt(log.data) === AMOUNT)
    if (!sent) throw new Error('Token transfer event missing')
  }
  tx.confirmed = true
  delete tx.raw
  save()
}

const paused = reason => { console.warn(`Candy Bank paused (${reason}); claims remain queued`); return null }
// Read-only checks before anything is signed, so a grant is either affordable in full or not started:
// no partial payouts. Returns { gift, data } to go ahead, or null to leave the claims queued.
async function preflight(address, record) {
  // Addresses with code (contracts, delegated EOAs) get the KNOCK but no ETH gift, so their code never runs on our gas.
  // A gift already signed must still complete.
  const gift = Boolean(record?.gas) || !(await rpc.getCode({ address }))
  const data = encodeFunctionData({ abi: erc20, functionName: 'transfer', args: [address, AMOUNT] })
  const candyDone = record?.candy?.confirmed
  if (!candyDone && await balance(RELAY) < AMOUNT) return paused('need 300 KNOCK')
  const gasPrice = await rpc.getGasPrice()
  if (gasPrice > MAX_FEE) return paused('gas price is above the 1 gwei fee ceiling')
  const tokenGas = candyDone ? 0n : await rpc.estimateGas({ account: RELAY, to: CANDY, data })
  const minimumEth = (gift && !record?.gas?.confirmed ? GAS_GIFT + GIFT_GAS * MAX_FEE : 0n) + tokenGas * gasPrice * 2n
  if (await rpc.getBalance({ address: RELAY }) < minimumEth) return paused('need 0.0005 ETH plus gas')
  return { gift, data }
}

async function pay(address) {
  let record = state.grants[address]
  if (!record) {
    const now = Date.now()
    state.starts = state.starts.filter(time => time > now - 86_400_000)
    if (state.starts.filter(time => time > now - 3_600_000).length >= HOURLY_CAP || state.starts.length >= DAILY_CAP) {
      console.warn('Candy Bank hourly or daily grant cap reached; leaving claims queued')
      return false
    }
    const existingTx = await alreadyReceived(address)
    if (existingTx) {
      state.grants[address] = record = { address, paid: true, tx: existingTx }
      save()
    }
  }
  if (record?.paid || record?.error) {
    await bank('/done', { address, ...(record.paid ? { tx: record.tx } : { error: record.error }) })
    return true
  }
  const plan = await preflight(address, record)
  if (!plan) return false
  if (!record) {
    // Persisted before signing, so the caps count this grant even if the process stops mid-payment.
    state.starts.push(Date.now())
    state.grants[address] = record = { address }
    save()
  }
  await transact(record, 'candy', { to: CANDY, data: plan.data })
  if (plan.gift) await transact(record, 'gas', { to: address, value: GAS_GIFT, gas: GIFT_GAS, maxFeePerGas: MAX_FEE, maxPriorityFeePerGas: 0n })
  record.paid = true
  record.tx = record.candy.hash
  save()
  await bank('/done', { address, tx: record.tx })
  console.log(`paid 300 KNOCK${plan.gift ? ' + 0.0005 ETH' : ' (address has code: no ETH gift)'} to ${address}: ${record.tx}`)
  return true
}

if (!DRY && await rpc.getChainId() !== 46630) throw new Error('Unexpected payout chain')
console.log(`Candy Bank ${DRY ? 'DRY RUN (no signing or chain writes)' : `payer ready; maximum ${HOURLY_CAP} grants/hour and ${DAILY_CAP}/day`}`)
do {
  // Check before reading the next queue, including after a process restart.
  const uncertain = Object.values(state.grants).filter(r => r.error && (r.candy && !r.candy.settled || r.gas && !r.gas.settled))
  if (!DRY && uncertain.length) {
    console.error('Payment uncertainty requires operator reconciliation; polling paused')
    for (;;) {
      // A lost acknowledgement should not leave a failed claim queued forever.
      for (const record of uncertain) await bank('/done', { address: record.address, error: record.error }).catch(() => {})
      await sleep(10_000)
    }
  }
  try {
    const { claims } = await bank('/queue')
    if (!Array.isArray(claims)) throw new Error('Invalid queue')
    if (DRY) {
      const claim = claims.find(claim => claim.address.toLowerCase() === dryAddress)
      if (!claim) throw new Error('Test claim is not in the first 20 queued claims')
      // The same read-only checks as a payment: history, recipient code, balances and the fee ceiling (the caps live in the state file).
      const paidTx = await alreadyReceived(dryAddress)
      const plan = !paidTx && await preflight(dryAddress)
      console.log(paidTx ? `${dryAddress} was already paid in ${paidTx}; would close the claim as paid`
        : plan ? `would send 300 KNOCK${plan.gift ? ' then 0.0005 ETH (21,000 gas, 1 gwei fee ceiling)' : ' and no ETH gift (the address has code)'} to ${dryAddress}`
        : 'would leave the claim queued')
      const result = await bank('/done', { address: dryAddress, error: 'DRY_RUN: no funds sent; test claim permanently closed' })
      if (result.state !== 'failed') throw new Error('Test claim did not close')
      console.log('dry-run test claim marked failed; no funds sent')
    } else {
      for (const claim of claims) {
        const address = String(claim.address).toLowerCase()
        if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('Invalid queue address')
        try { if (!await pay(address)) break } catch {
          const record = state.grants[address]
          if (!record?.paid && !record?.candy && !record?.gas) {
            // Nothing was signed, so nothing was paid: keep the claim queued and retry on the next poll.
            console.warn(`claim ${address}: a check failed before any payment; claim left queued`)
            break
          }
          // A completed payout whose acknowledgement failed remains paid locally.
          // Uncertain/partial payouts are never automatically granted a second time.
          if (!record.paid) {
            record.error = `Grant failed; reconcile local state before any manual retry (KNOCK: ${record.candy?.hash ?? 'not sent'}, ETH: ${record.gas?.hash ?? 'not sent'})`
            save()
            await bank('/done', { address, error: record.error }).catch(() => {})
          }
          console.warn(`claim ${address}: acknowledgement or payment failed; preserved local state`)
          // Do not reuse a possibly pending nonce for the next recipient.
          if (record.candy && !record.candy.settled || record.gas && !record.gas.settled) {
            console.error('Uncertain transaction; stopping for reconciliation. Do not delete state.')
            process.exitCode = 1
            // Stay stopped across container restarts via the persisted uncertainty check above.
            break
          }
        }
      }
    }
  } catch {
    console.error('Candy Bank poll failed; check connectivity and bank configuration (credentials omitted)')
    if (DRY) process.exitCode = 1
  }
  if (DRY) break
  await sleep(10_000)
} while (true)
