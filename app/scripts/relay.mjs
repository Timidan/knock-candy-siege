// Pays Knock Candy (KNOCK, a vibe/vibe token on Robinhood Chain Testnet) for achievements in Knock on Monad: a treat,
// a raid, a completed route or boss loot pays the Chog's owner KNOCK on the testnet. Knock.sol knows nothing about this.
//   node --env-file=../.env.relay scripts/relay.mjs          (add --dry-run to log payments without sending)
// Progress is saved after every payment, so a restart never pays the same treat twice.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi, parseAbiItem, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const { KNOCK_RPC, KNOCK_CONTRACT, RELAY_KEY } = process.env
// KNOCK paid per achievement; override with REWARD_TREAT etc. in .env.relay.
const REWARDS = { treat: 100, raid: 50, route: 500, boss: 300 }
for (const k of Object.keys(REWARDS)) REWARDS[k] = Number(process.env[`REWARD_${k.toUpperCase()}`] ?? REWARDS[k])
if (!KNOCK_RPC || !RELAY_KEY) throw new Error('Set KNOCK_RPC and RELAY_KEY (see .env.relay)')
if (!KNOCK_CONTRACT) { // deployed before the game contract exists: wait, don't crash-loop
  console.log('KNOCK_CONTRACT is not set yet; waiting. Set it (and RELAY_FROM_BLOCK) and redeploy after the mainnet deploy.')
  for (;;) await new Promise(r => setTimeout(r, 3600_000))
}
const DRY = process.argv.includes('--dry-run')
const CHOG = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763'
const CANDY = '0x2Ae41145A6acB58d4457c49df27ab6BFEF618492' // Knock Candy (KNOCK) on Robinhood Chain Testnet
const STATE = process.env.RELAY_STATE ?? new URL('../../.cache/relay-state.json', import.meta.url).pathname

const monad = defineChain({ id: 143, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [KNOCK_RPC] } } })
const robinhood = defineChain({
  id: 46630, name: 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
})
const game = createPublicClient({ chain: monad, transport: http() })
const testnet = createPublicClient({ chain: robinhood, transport: http() })
const payer = createWalletClient({ account: privateKeyToAccount(RELAY_KEY), chain: robinhood, transport: http() })
const events = [
  parseAbiItem('event Knocked(uint256 indexed from, uint256 indexed to, uint256 item, uint8 outcome)'),
  parseAbiItem('event RouteCompleted(uint256 indexed id, uint256 day)'),
  parseAbiItem('event BossLooted(uint256 indexed id, uint256 day, uint256 candy)'),
  parseAbiItem('event Haunted(uint256 indexed from, uint256 indexed to)'), // a never-played house answered by itself: no reward
]
const TREAT = 0, RAID = 4 // Knocked outcome numbers, pinned in contracts/SPEC-v2.md
const erc20 = parseAbi(['function transfer(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'])
const chogAbi = parseAbi(['function ownerOf(uint256) view returns (address)'])
const sleep = ms => new Promise(r => setTimeout(r, ms))

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { block: null, paid: [] }
const paid = new Set(state.paid)
const save = () => writeFileSync(STATE, JSON.stringify({ block: state.block, paid: [...paid] }))

// What a log earns, and for which Chog; null when it earns nothing.
function rewardFor(log) {
  if (log.eventName === 'Knocked' && log.args.outcome === TREAT) return { chog: log.args.from, kind: 'treat', why: `treat at #${log.args.to}` }
  if (log.eventName === 'Knocked' && log.args.outcome === RAID) return { chog: log.args.from, kind: 'raid', why: `raid on #${log.args.to}` }
  if (log.eventName === 'RouteCompleted') return { chog: log.args.id, kind: 'route', why: 'route completed' }
  if (log.eventName === 'BossLooted') return { chog: log.args.id, kind: 'boss', why: 'Great Pumpkin loot' }
  return null
}

async function pay(log) {
  const key = `${log.transactionHash}:${log.logIndex}`
  const reward = rewardFor(log)
  if (!reward || paid.has(key)) return
  const amount = REWARDS[reward.kind]
  const owner = await game.readContract({ address: CHOG, abi: chogAbi, functionName: 'ownerOf', args: [reward.chog] })
  if (DRY) {
    console.log(`would pay ${amount} KNOCK to ${owner} for Chog #${reward.chog}'s ${reward.why}`)
  } else {
    const hash = await payer.writeContract({ address: CANDY, abi: erc20, functionName: 'transfer', args: [owner, parseEther(String(amount))] })
    await testnet.waitForTransactionReceipt({ hash })
    console.log(`paid ${amount} KNOCK to ${owner} (Chog #${reward.chog}, ${reward.why}): https://explorer.testnet.chain.robinhood.com/tx/${hash}`)
  }
  paid.add(key)
  save()
}

const funds = await testnet.readContract({ address: CANDY, abi: erc20, functionName: 'balanceOf', args: [payer.account.address] })
console.log(`relay ${payer.account.address} holds ${formatEther(funds)} KNOCK; paying ${JSON.stringify(REWARDS)}${DRY ? ' (dry run)' : ''}`)
for (;;) {
  try {
    const latest = await game.getBlockNumber()
    // A fresh relay starts at RELAY_FROM_BLOCK (set it to the deploy block) or, without it, from now.
    let from = state.block !== null ? BigInt(state.block) + 1n : process.env.RELAY_FROM_BLOCK ? BigInt(process.env.RELAY_FROM_BLOCK) : latest
    while (from <= latest) {
      const to = from + 99n < latest ? from + 99n : latest // public RPCs cap the block range of a log query
      const logs = await game.getLogs({ address: KNOCK_CONTRACT, events, fromBlock: from, toBlock: to })
      // A haunted treat is candy from nobody, so it earns no KNOCK: skip a Knocked log whose transaction also emitted Haunted for the same pair.
      const haunted = new Set(logs.filter(log => log.eventName === 'Haunted').map(log => `${log.transactionHash}:${log.args.from}:${log.args.to}`))
      for (const log of logs) {
        if (log.eventName === 'Knocked' && haunted.has(`${log.transactionHash}:${log.args.from}:${log.args.to}`)) continue
        await pay(log)
      }
      state.block = to.toString()
      save()
      from = to + 1n
    }
  } catch (error) {
    console.error(`relay error (retrying): ${error.shortMessage ?? error.message}`)
  }
  await sleep(4000)
}
