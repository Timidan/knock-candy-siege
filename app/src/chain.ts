import {
  BaseError,
  InsufficientFundsError,
  createPublicClient,
  createTestClient,
  createWalletClient,
  custom,
  decodeEventLog,
  defineChain,
  http,
  parseAbi,
  parseEther,
  type Abi,
  type Address,
  type EIP1193Provider,
  type Hash,
} from 'viem'
import { playSigner, sessionFor } from './session'

export const CHOG = '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763' as Address
export const CHOG_TOKEN = '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777' as Address // $CHOG
export const KNOCK = import.meta.env.VITE_KNOCK as Address
export const rpc = import.meta.env.VITE_RPC_URL || 'https://rpc.monad.xyz' // set VITE_RPC_URL to an anvil fork for local testing
export const isSandbox = import.meta.env.VITE_SANDBOX === '1'
export const isFork = isSandbox || /\/\/(localhost|127\.0\.0\.1)[:/]/.test(rpc) // an anvil copy, not mainnet
const monad = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
})
export const client = createPublicClient({ chain: monad, transport: http(rpc) })
// Fork only: anvil signs for any owner (--auto-impersonate).
const wallet = isFork ? createWalletClient({ chain: monad, transport: http(rpc) }) : null
const fork = isFork ? createTestClient({ chain: monad, mode: 'anvil', transport: http(rpc) }) : null
export const injectedWallet = () => (window as Window & { ethereum?: EIP1193Provider }).ethereum
let connectedAccount: Address | null = null
let listeningTo: EIP1193Provider | undefined
const walletListeners = new Set<() => void>()
export const walletAccount = (): Address | null => connectedAccount
export function subscribeWallet(listener: () => void) {
  walletListeners.add(listener)
  return () => { walletListeners.delete(listener) }
}
function accountsChanged(accounts: Address[]) {
  connectedAccount = accounts[0] ?? null
  walletListeners.forEach(listener => listener())
}
const chainChanged = () => window.location.reload()
export async function connectWallet(): Promise<Address> {
  const provider = injectedWallet()
  if (!provider) throw new Error("Open this page in your wallet's browser, or install a wallet")
  await provider.request({ method: 'eth_requestAccounts' })
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x8f' }] })
  } catch (error) {
    if ((error as { code?: number })?.code !== 4902) throw error
    await provider.request({ method: 'wallet_addEthereumChain', params: [{
      chainId: '0x8f', chainName: 'Monad',
      nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
      rpcUrls: ['https://rpc.monad.xyz'], blockExplorerUrls: ['https://monadscan.com'],
    }] })
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x8f' }] })
  }
  if (Number(await provider.request({ method: 'eth_chainId' })) !== monad.id)
    throw new Error('Switch your wallet to Monad.')
  if (listeningTo !== provider) {
    listeningTo?.removeListener('accountsChanged', accountsChanged)
    listeningTo?.removeListener('chainChanged', chainChanged)
    provider.on('accountsChanged', accountsChanged)
    provider.on('chainChanged', chainChanged)
    listeningTo = provider
  }
  accountsChanged(await provider.request({ method: 'eth_accounts' }))
  if (!connectedAccount) throw new Error('Connect an account in your wallet.')
  return connectedAccount
}
export const txUrl = (hash: Hash): string | null => isFork ? null : `https://monadscan.com/tx/${hash}`
export const addressUrl = (address: string): string | null => isFork ? null : `https://monadscan.com/address/${address}`
const transactionListeners = new Set<(hash: Hash) => void>()
export function onTransactionConfirmed(listener: (hash: Hash) => void) {
  transactionListeners.add(listener)
  return () => { transactionListeners.delete(listener) }
}
export const chogAbi = parseAbi([
  'function ownerOf(uint256) view returns (address)',
  'function balanceOf(address) view returns (uint256)',
])
export const abi = parseAbi([
  'function houses(uint256) view returns ((uint256 day, uint256 knocksUsed, uint256 bowlCandy, uint256 bowlChog, uint256 chogPerTreat, bool trap, uint256 costume, uint256 markItem, uint256 markBy, uint256 markUntil, uint256 revengeOn, bool revengeReady, uint256 treatsGiven, uint256 tricksLanded, uint256 timesTricked, uint256 routeDay, uint8 routeMask, uint256 raidsLanded, uint256 timesRaided))',
  'function street() view returns ((uint256 from, uint256 to, uint256 item, uint8 outcome, uint256 timestamp)[])',
  'function visits(uint256) view returns ((uint256 from, uint256 to, uint256 item, uint8 outcome, uint256 timestamp)[])',
  'function tba(uint256) view returns (address)',
  'function balanceOfBatch(address[], uint256[]) view returns (uint256[])',
  'function knock(uint256,uint256,uint256)',
  'function raid(uint256,uint256)',
  'function hitBoss(uint256,uint256)',
  'function claimBoss(uint256,uint256)',
  'function joinCrew(uint256,uint8)',
  'function setDelegate(uint256,address,uint64)',
  'function delegates(uint256) view returns (address key, uint64 expiry, address ownerAtGrant)',
  'function routeOf(uint256,uint256) view returns (uint256[3])',
  'function routeProgress(uint256) view returns (uint8 mask, uint256 day)',
  'function bossState(uint256) view returns (uint256 house, uint256 hp, uint256 damage, bool defeated)',
  'function bossHp(uint256) view returns (uint256)',
  'function bossHouse(uint256) pure returns (uint256)',
  'function nightTheme(uint256) pure returns (uint256)',
  'function crewOf(uint256) view returns (uint8)',
  'function crewSince(uint256) view returns (uint256)',
  'function crewPoints(uint256,uint8) view returns (uint256)',
  'function damageBy(uint256,uint256) view returns (uint256)',
  'function claimed(uint256,uint256) view returns (bool)',
  'function activeChogs(uint256) view returns (uint256)',
  'function craft(uint256,uint256,uint256)',
  'function setTrap(uint256)',
  'function stockBowl(uint256,uint256,uint256,uint256)',
  'function emptyBowl(uint256)',
  'function wear(uint256,uint256)',
  'function clean(uint256,uint256)',
  'function cleanFee() view returns (uint256)',
  'event Knocked(uint256 indexed from, uint256 indexed to, uint256 item, uint8 outcome)',
  'event Haunted(uint256 indexed from, uint256 indexed to)',
  'event RouteCompleted(uint256 indexed id, uint256 indexed day)',
  'event BossHit(uint256 indexed id, uint256 indexed day, uint256 damage)',
  'event BossDefeated(uint256 indexed day)',
  'event BossLooted(uint256 indexed id, uint256 indexed day, uint256 candy)',
  'event CrewJoined(uint256 indexed id, uint8 crew)',
  'event CrewBonus(uint256 indexed id, uint256 indexed day)',
  'event DelegateSet(uint256 indexed id, address indexed key, uint64 expiry)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
])
const erc20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
])
// Knock Candy (KNOCK): rewards paid by the vibe/vibe relay, on Robinhood Chain Testnet.
export const CANDY_TOKEN = '0x2Ae41145A6acB58d4457c49df27ab6BFEF618492' as Address
const robinhood = createPublicClient({
  chain: defineChain({
    id: 46630,
    name: 'Robinhood Chain Testnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  }),
  transport: http(),
})
export const knockCandy = (who: Address) =>
  robinhood.readContract({ address: CANDY_TOKEN, abi: erc20, functionName: 'balanceOf', args: [who] })
export type House = Awaited<ReturnType<typeof readHouse>>
export type Visit = Awaited<ReturnType<typeof readStreet>>[number]
export async function readHouse(id: number) {
  return client.readContract({ address: KNOCK, abi, functionName: 'houses', args: [BigInt(id)] })
}
// One multicall; viem splits it into ~16 KB requests and sends them in parallel.
export async function readHouses(ids: number[]) {
  const rows = await client.multicall({
    contracts: ids.map(id => ({ address: KNOCK, abi, functionName: 'houses' as const, args: [BigInt(id)] as const })),
    allowFailure: false,
    batchSize: 16_384,
  })
  return new Map(ids.map((id, i) => [id, rows[i]]))
}
export async function readCrews(ids: number[]) {
  const crews = await client.multicall({
    contracts: ids.map(id => ({ address: KNOCK, abi, functionName: 'crewOf' as const, args: [BigInt(id)] as const })),
    allowFailure: false,
    batchSize: 16_384,
  })
  return new Map(ids.map((id, i) => [id, crews[i]]))
}
export type Boss = { house: number; hp: number; damage: number; defeated: boolean }
export type Night = Awaited<ReturnType<typeof readNight>>
export async function readNight(day: bigint, player: number | null) {
  const contract = { address: KNOCK, abi }
  const [boss, yesterday, theme, points, previousPoints, personal] = await Promise.all([
    client.readContract({ ...contract, functionName: 'bossState', args: [day] }),
    client.readContract({ ...contract, functionName: 'bossState', args: [day > 0n ? day - 1n : 0n] }),
    client.readContract({ ...contract, functionName: 'nightTheme', args: [day] }),
    client.multicall({ contracts: [1, 2, 3, 4].map(crew => ({ ...contract, functionName: 'crewPoints' as const, args: [day, crew] as const })), allowFailure: false }),
    client.multicall({ contracts: [1, 2, 3, 4].map(crew => ({ ...contract, functionName: 'crewPoints' as const, args: [day > 0n ? day - 1n : 0n, crew] as const })), allowFailure: false }),
    player === null ? null : client.multicall({ contracts: [
      { ...contract, functionName: 'routeOf', args: [BigInt(player), day] },
      { ...contract, functionName: 'routeProgress', args: [BigInt(player)] },
      { ...contract, functionName: 'crewSince', args: [BigInt(player)] },
      { ...contract, functionName: 'damageBy', args: [day, BigInt(player)] },
      { ...contract, functionName: 'claimed', args: [day, BigInt(player)] },
      { ...contract, functionName: 'damageBy', args: [day > 0n ? day - 1n : 0n, BigInt(player)] },
      { ...contract, functionName: 'claimed', args: [day > 0n ? day - 1n : 0n, BigInt(player)] },
    ], allowFailure: false }),
  ])
  return {
    day, player, theme: Number(theme),
    boss: { house: Number(boss[0]), hp: Number(boss[1]), damage: Number(boss[2]), defeated: boss[3] } satisfies Boss,
    points, previousPoints,
    route: personal ? personal[0].map(Number) : [],
    mask: personal && personal[1][1] === day ? personal[1][0] : 0,
    crewSince: personal?.[2] ?? day,
    claims: personal ? [
      { day, damage: personal[3], claimed: personal[4], defeated: boss[3] },
      { day: day - 1n, damage: personal[5], claimed: personal[6], defeated: yesterday[3] },
    ].filter(claim => claim.day >= 0n && claim.defeated && claim.damage > 0n && !claim.claimed) : [],
  }
}
export const readStreet = () => client.readContract({ address: KNOCK, abi, functionName: 'street' })
export const readVisits = (id: number) =>
  client.readContract({ address: KNOCK, abi, functionName: 'visits', args: [BigInt(id)] })
export const ownerOf = (id: number) =>
  client.readContract({ address: CHOG, abi: chogAbi, functionName: 'ownerOf', args: [BigInt(id)] })
export async function ownedChogs(owner: Address): Promise<number[]> {
  const balance = Number(await client.readContract({ address: CHOG, abi: chogAbi, functionName: 'balanceOf', args: [owner] }))
  const found: number[] = []
  let pending = Array.from({ length: 1969 }, (_, i) => i + 1)
  // A timed-out or rate-limited batch comes back as failures; retry those ids rather than treat them as not owned.
  for (let attempt = 0; attempt < 3 && pending.length && found.length < balance; attempt++) {
    const owners = await client.multicall({
      contracts: pending.map(id => ({ address: CHOG, abi: chogAbi, functionName: 'ownerOf' as const, args: [BigInt(id)] as const })),
      allowFailure: true,
      batchSize: 16_384,
    })
    const failed: number[] = []
    pending.forEach((id, i) => {
      const row = owners[i]
      if (row.status !== 'success') failed.push(id)
      else if (row.result.toLowerCase() === owner.toLowerCase()) found.push(id)
    })
    pending = failed
  }
  if (found.length < balance) throw new Error(`Found ${found.length} of this wallet's ${balance} Chogs. Try again.`)
  return found.sort((a, b) => a - b)
}
export const tbaOf = (id: number) => client.readContract({ address: KNOCK, abi, functionName: 'tba', args: [BigInt(id)] })
export async function inventory(id: number) {
  const account = await tbaOf(id)
  return client.readContract({
    address: KNOCK,
    abi,
    functionName: 'balanceOfBatch',
    args: [Array(7).fill(account), [1n, 2n, 3n, 4n, 5n, 6n, 7n]],
  })
}
export const chogBalance = (who: Address) =>
  client.readContract({ address: CHOG_TOKEN, abi: erc20, functionName: 'balanceOf', args: [who] })
export const cleanFee = () => client.readContract({ address: KNOCK, abi, functionName: 'cleanFee' })

// Only owner writes on the fork can impersonate an account or fund its gas.
async function ownerSigner(account: Address) {
  if (isFork) {
    await fork!.setBalance({ address: account, value: parseEther('1000') }) // gas money for the impersonated account
    return wallet!
  } else {
    const provider = injectedWallet()
    if (!provider) throw new Error('Connect your wallet to play.')
    accountsChanged(await provider.request({ method: 'eth_accounts' }))
    if (connectedAccount?.toLowerCase() !== account.toLowerCase())
      throw new Error(`Switch your wallet to ${account.slice(0, 6)}…${account.slice(-4)}, the owner of this Chog.`)
    if (Number(await provider.request({ method: 'eth_chainId' })) !== monad.id)
      throw new Error('Switch your wallet to Monad.')
    return createWalletClient({ chain: monad, transport: custom(provider) })
  }
}
export async function confirmTransaction(hash: Hash) {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Transaction reverted')
  if (!isFork) transactionListeners.forEach(listener => listener(hash))
  return hash
}
async function write(account: Address, address: Address, contractAbi: Abi, functionName: string, args: unknown[]) {
  const signer = await ownerSigner(account)
  return confirmTransaction(await signer.writeContract({ address, abi: contractAbi, functionName, args, account }))
}
export async function sendMon(owner: Address, to: Address, value: bigint) {
  const signer = await ownerSigner(owner)
  return confirmTransaction(await signer.sendTransaction({ account: owner, to, value }))
}
export const setDelegate = (owner: Address, id: number, key: Address, expiry: bigint) =>
  write(owner, KNOCK, abi, 'setDelegate', [BigInt(id), key, expiry])

type Action = 'knock' | 'raid' | 'hitBoss' | 'claimBoss' | 'joinCrew' | 'craft' | 'setTrap' | 'stockBowl' | 'emptyBowl' | 'wear' | 'clean'
const isPlayerAction = (functionName: Action, args: bigint[]) =>
  ['knock', 'raid', 'hitBoss', 'claimBoss', 'craft', 'setTrap', 'wear'].includes(functionName)
    || (functionName === 'clean' && args[0] !== args[1])
if (import.meta.env.DEV) {
  console.assert(isPlayerAction('knock', [1n, 2n, 2n]) && isPlayerAction('clean', [1n, 2n]), 'Player actions can use a play key')
  console.assert(!isPlayerAction('clean', [1n, 1n]) && !isPlayerAction('stockBowl', [1n]) && !isPlayerAction('joinCrew', [1n]), 'Owner actions must use the owner wallet')
}
export async function send(owner: Address, functionName: Action, args: bigint[]): Promise<Hash> {
  const session = isPlayerAction(functionName, args) ? await sessionFor(owner, Number(args[0])) : null
  if (session) {
    const signer = playSigner(owner)
    const request = { address: KNOCK, abi: abi as Abi, functionName, args, account: signer.account }
    const noGas = 'Your play key is out of MON. Top up, or end the session.'
    try {
      const [balance, gasPrice] = await Promise.all([client.getBalance({ address: session.address }), client.getGasPrice()])
      if (balance <= 21_000n * gasPrice) throw new Error(noGas)
      const gas = await client.estimateContractGas({ ...request, gasPrice })
      if (balance < gas * gasPrice) throw new Error(noGas)
      // Monad charges the full limit: use the estimate without a gas buffer.
      return await confirmTransaction(await signer.writeContract({ ...request, gas, gasPrice }))
    } catch (error) {
      if ((error instanceof BaseError && error.walk(cause => cause instanceof InsufficientFundsError))
        || (error instanceof Error && /insufficient funds|insufficient balance|gas required exceeds allowance/i.test(error.message)))
        throw new Error(noGas)
      throw error
    }
  }
  return write(owner, KNOCK, abi, functionName, args)
}

// Paying $CHOG into Knock (stocking a bowl, cleaning your own mark) needs an allowance first.
export async function approveChog(owner: Address, amount: bigint) {
  const allowed = await client.readContract({
    address: CHOG_TOKEN,
    abi: erc20,
    functionName: 'allowance',
    args: [owner, KNOCK],
  })
  if (allowed < amount) await write(owner, CHOG_TOKEN, erc20, 'approve', [KNOCK, amount])
}

// Fork only: test $CHOG taken from the main CHOG/MON pool on nad.fun, which holds about 30M.
const CHOG_POOL = '0x116e7D070f1888B81E1E0324F56d6746B2D7d8f1' as Address
export async function testChog(to: Address, amount = parseEther('1000')) {
  if (!isFork) throw new Error('Test CHOG is only available on the local fork.')
  return write(CHOG_POOL, CHOG_TOKEN, erc20, 'transfer', [to, amount])
}
export async function knockEvents(hash: Hash) {
  const receipt = await client.getTransactionReceipt({ hash })
  return receipt.logs.flatMap(log => {
    if (log.address.toLowerCase() !== KNOCK.toLowerCase()) return []
    try {
      return [decodeEventLog({ abi, data: log.data, topics: log.topics })]
    } catch {
      return [] // ERC-1155 transfers and other events outside the game ABI.
    }
  })
}
export async function knockedOutcome(hash: Hash) {
  const event = (await knockEvents(hash)).find(event => event.eventName === 'Knocked')
  if (!event) throw new Error('Knocked event missing')
  return Number(event.args.outcome)
}
export async function nextDay() {
  if (!isFork) throw new Error('Next night is only available on the local fork.')
  await fork!.increaseTime({ seconds: 86400 })
  await fork!.mine({ blocks: 1 })
}
