import { createPublicClient, createWalletClient, custom, decodeEventLog, encodeFunctionData, defineChain, http, isAddress, parseAbi, parseSignature, formatEther, type Address, type Hash, type Hex, type PrivateKeyAccount, type TypedDataDomain } from 'viem'
import { CANDY_TOKEN, injectedWallet, isSandbox } from '../chain'
import { SHOP_ITEMS } from './data/shop'

export const SHOP_ADDRESS = isAddress(import.meta.env.VITE_KNOCK_SHOP ?? '') ? import.meta.env.VITE_KNOCK_SHOP as Address : null
// Items bought on the first shop (replaced by a buyer-only version) still belong to their buyers.
const LEGACY_SHOP: Address = '0xc52dfedAf158031fd7b5fAe0A2F1CFB6c1aC89b6'
const legacy = () => SHOP_ADDRESS && SHOP_ADDRESS.toLowerCase() !== LEGACY_SHOP.toLowerCase() && !isSandbox
export const shopRpc = import.meta.env.VITE_SHOP_RPC_URL || 'https://rpc.testnet.chain.robinhood.com'
export const robinhood = defineChain({ id: 46630, name: 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [shopRpc] } }, contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } } })
// All shop reads share one transport so prices, balances and ownership travel together.
const client = createPublicClient({ chain: robinhood, batch: { multicall: { batchSize: 16_384 } }, transport: http(shopRpc, { batch: true }) })
const shopAbi = parseAbi(['function knock() view returns (address)', 'function price(uint256) view returns (uint256)', 'function owned(address,uint256) view returns (bool)', 'function ownedItems(address,uint256[]) view returns (bool[])', 'function buyFor(address,uint256,uint256,uint8,bytes32,bytes32)', 'function buy(uint256)', 'function treasury() view returns (address)'])
const tokenAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function nonces(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function name() view returns (string)', 'function eip712Domain() view returns (bytes1,string,string,uint256,address,bytes32,uint256[])', 'function transfer(address,uint256) returns (bool)', 'event Transfer(address indexed from, address indexed to, uint256 value)'])
export const knockAmount = (value: bigint) => Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 })
const storageKey = (address: Address) => `knock-siege-shop:${robinhood.id}:${SHOP_ADDRESS?.toLowerCase() ?? 'unopened'}:${address.toLowerCase()}`
export function cachedOwned(address: Address | null): number[] {
  if (!address || !SHOP_ADDRESS || isSandbox) return []
  try { const ids = JSON.parse(localStorage.getItem(storageKey(address)) ?? '[]'); return Array.isArray(ids) ? SHOP_ITEMS.filter(i => ids.includes(i.id)).map(i => i.id) : [] } catch { return [] }
}
export function cacheOwned(address: Address, ids: number[]) { try { localStorage.setItem(storageKey(address), JSON.stringify(ids)) } catch { /* Chain ownership still works without storage. */ } }
// crate: a Candy Crate payment, kept apart from item purchases because it is confirmed differently.
const pendingKey = (address: Address, crate: boolean) => storageKey(address) + (crate ? ':crate' : ':pending')
export function pendingPurchase(address: Address, crate = false): Hash | null {
  try { const value = localStorage.getItem(pendingKey(address, crate)); return value && /^0x[0-9a-f]{64}$/i.test(value) ? value as Hash : null } catch { return null }
}
function savePending(address: Address, hash: Hash | null, crate = false) { try { if (hash) localStorage.setItem(pendingKey(address, crate), hash); else localStorage.removeItem(pendingKey(address, crate)) } catch { /* Keep the hash in the visible purchase state too. */ } }
export async function readShop(address: Address | null) {
  const [balance, gas, prices, owned, legacyOwned] = await Promise.all([
    address && !isSandbox ? client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'balanceOf', args: [address] }) : null,
    address && !isSandbox ? client.getBalance({ address }) : null,
    SHOP_ADDRESS ? Promise.all(SHOP_ITEMS.map(item => client.readContract({ address: SHOP_ADDRESS!, abi: shopAbi, functionName: 'price', args: [BigInt(item.id)] }))) : SHOP_ITEMS.map(item => BigInt(item.price) * 10n ** 18n),
    address && SHOP_ADDRESS && !isSandbox ? client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'ownedItems', args: [address, SHOP_ITEMS.map(i => BigInt(i.id))] }) : [],
    address && legacy() ? client.readContract({ address: LEGACY_SHOP, abi: shopAbi, functionName: 'ownedItems', args: [address, SHOP_ITEMS.map(i => BigInt(i.id))] }).catch(() => []) : [],
  ])
  const ids = SHOP_ITEMS.filter((_, index) => owned[index] || legacyOwned[index]).map(i => i.id)
  if (address && SHOP_ADDRESS && !isSandbox) cacheOwned(address, ids)
  return { balance, gas, prices: Object.fromEntries(SHOP_ITEMS.map((item, index) => [item.id, prices[index]])), owned: ids }
}
export const readAccount = async () => (await injectedWallet()?.request({ method: 'eth_accounts' }))?.[0] ?? null
export async function onShopNetwork() { return Number(await injectedWallet()?.request({ method: 'eth_chainId' })) === robinhood.id }
export async function switchShopNetwork() {
  const provider = injectedWallet()
  if (!provider) throw new Error('Open Knock in your wallet browser or install an Ethereum wallet.')
  if (await onShopNetwork()) return
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xb626' }] }) }
  catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0xb626', chainName: robinhood.name, nativeCurrency: robinhood.nativeCurrency, rpcUrls: robinhood.rpcUrls.default.http, blockExplorerUrls: ['https://explorer.testnet.chain.robinhood.com'] }] })
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xb626' }] })
  }
  if (!await onShopNetwork()) throw new Error('Switch your wallet to Robinhood Chain Testnet, then try again.')
}
export function reopenShop() {
  try { const value = sessionStorage.getItem('knock-siege-reopen-shop') === '1'; sessionStorage.removeItem('knock-siege-reopen-shop'); return value } catch { return false }
}
async function permitDomain(): Promise<TypedDataDomain> {
  const raw = await client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'eip712Domain' }).catch(() => null)
  if (!raw) return { name: await client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'name' }), version: '1', chainId: robinhood.id, verifyingContract: CANDY_TOKEN }
  const [fields, name, version, chainId, verifyingContract, salt, extensions] = raw, bits = Number(fields)
  if (extensions.length || bits & ~31 || !(bits & 4) || !(bits & 8) || chainId !== BigInt(robinhood.id) || verifyingContract.toLowerCase() !== CANDY_TOKEN.toLowerCase()) throw new Error('The token signing domain does not match this shop network.')
  return { ...(bits & 1 ? { name } : {}), ...(bits & 2 ? { version } : {}), chainId: Number(chainId), verifyingContract, ...(bits & 16 ? { salt } : {}) }
}
export type PurchasePhase = 'checking' | 'signature' | 'transaction' | 'confirming' | 'owned'
export async function confirmPurchase(address: Address, hash: Hash) {
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  savePending(address, null)
  if (receipt.status !== 'success') throw new Error('The purchase reverted. No item was bought; the network may still charge gas.')
}
async function verifyAccount(address: Address, guest?: PrivateKeyAccount | null) {
  if (guest) {
    if (guest.address.toLowerCase() !== address.toLowerCase()) throw new Error('Choose your guest wallet again.')
    if (await client.getChainId() !== robinhood.id) throw new Error('The shop RPC is on the wrong network.')
    return
  }
  if ((await readAccount())?.toLowerCase() !== address.toLowerCase()) throw new Error('Your wallet account changed. Choose the item again with the current wallet.')
  if (!await onShopNetwork()) throw new Error('Switch to Robinhood Chain Testnet before buying.')
}
export async function purchase(address: Address, item: number, displayedPrice: bigint, state: (phase: PurchasePhase, hash?: Hash) => void, guest?: PrivateKeyAccount | null) {
  if (isSandbox || !SHOP_ADDRESS) throw new Error('Buying is not available in this shop yet.')
  const provider = injectedWallet()
  if (!provider && !guest) throw new Error('Choose a guest wallet or connect your wallet first.')
  if (pendingPurchase(address) || pendingPurchase(address, true)) throw new Error('A purchase is still pending. Check that transaction before buying again.')
  const verifyWallet = () => verifyAccount(address, guest)
  state('checking'); await verifyWallet()
  const [price, owned, token, balance, gasBalance, allowance] = await Promise.all([
    client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'price', args: [BigInt(item)] }),
    Promise.all([client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'owned', args: [address, BigInt(item)] }),
      legacy() ? client.readContract({ address: LEGACY_SHOP, abi: shopAbi, functionName: 'owned', args: [address, BigInt(item)] }).catch(() => false) : false]).then(([now, before]) => now || before),
    client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'knock' }),
    client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'balanceOf', args: [address] }), client.getBalance({ address }),
    client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'allowance', args: [address, SHOP_ADDRESS] }),
  ])
  if (token.toLowerCase() !== CANDY_TOKEN.toLowerCase()) throw new Error('This shop uses a different token. Buying is disabled.')
  if (owned) { state('owned'); return }
  if (price === 0n) throw new Error('This item is not for sale right now.')
  if (price !== displayedPrice) throw new Error('The price changed. Refresh the shop and review the new price.')
  if (balance < price) throw new Error('Not enough $KNOCK. Claim the starter grant if eligible, or get it on vibe/vibe.')
  if (gasBalance === 0n) throw new Error('No test ETH for gas. Use the Robinhood faucet, then try again.')
  const signer = guest ?? address
  const wallet = createWalletClient({ chain: robinhood, transport: guest ? http(shopRpc) : custom(provider!), account: signer })
  let data: Hex
  if (allowance >= price) {
    const call = { abi: shopAbi, functionName: 'buy', args: [BigInt(item)] } as const
    await client.simulateContract({ ...call, address: SHOP_ADDRESS, account: address }); data = encodeFunctionData(call)
  } else {
    const [domain, nonce, block] = await Promise.all([permitDomain(), client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'nonces', args: [address] }), client.getBlock()])
    const deadline = block.timestamp + 600n
    state('signature')
    const signed = await wallet.signTypedData({ domain, primaryType: 'Permit', types: { Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] }, message: { owner: address, spender: SHOP_ADDRESS, value: price, nonce, deadline } })
    await verifyWallet()
    const { r, s, v, yParity } = parseSignature(signed)
    const call = { abi: shopAbi, functionName: 'buyFor', args: [address, BigInt(item), deadline, Number(v ?? BigInt(27 + (yParity ?? 0))), r, s] } as const
    await client.simulateContract({ ...call, address: SHOP_ADDRESS, account: address }); data = encodeFunctionData(call)
  }
  await verifyWallet()
  const request = { to: SHOP_ADDRESS, data, account: signer }
  const [gas, gasPrice] = await Promise.all([client.estimateGas(request), client.getGasPrice()])
  if (gasBalance < gas * gasPrice * 12n / 10n) throw new Error('Not enough test ETH for gas. Top up at the Robinhood faucet.')
  state('transaction')
  const hash = await wallet.sendTransaction(request)
  savePending(address, hash); state('confirming', hash)
  await confirmPurchase(address, hash)
  if (!await client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'owned', args: [address, BigInt(item)] })) throw new Error('The transaction confirmed, but ownership could not be verified. Refresh the shop.')
  state('owned', hash)
}
// Candy Crate: a plain transfer of CRATE_PRICE $KNOCK to the shop's treasury, no contract of its own. The local save credits it once per transaction hash.
export const CRATE_PRICE = 50n * 10n ** 18n
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
export async function buyCrate(address: Address, state: (phase: PurchasePhase, hash?: Hash) => void, guest?: PrivateKeyAccount | null) {
  if (isSandbox || !SHOP_ADDRESS) throw new Error('Buying is not available in this shop yet.')
  const provider = injectedWallet()
  if (!provider && !guest) throw new Error('Choose a guest wallet or connect your wallet first.')
  if (pendingPurchase(address) || pendingPurchase(address, true)) throw new Error('A purchase is still pending. Check that transaction before buying again.')
  state('checking'); await verifyAccount(address, guest)
  const [treasury, token, balance, gasBalance] = await Promise.all([
    client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'treasury' }), client.readContract({ address: SHOP_ADDRESS, abi: shopAbi, functionName: 'knock' }),
    client.readContract({ address: CANDY_TOKEN, abi: tokenAbi, functionName: 'balanceOf', args: [address] }), client.getBalance({ address }),
  ])
  if (!same(token, CANDY_TOKEN)) throw new Error('This shop uses a different token. Buying is disabled.')
  if (balance < CRATE_PRICE) throw new Error('Not enough $KNOCK. Claim the starter grant if eligible, or get it on vibe/vibe.')
  if (gasBalance === 0n) throw new Error('No test ETH for gas. Use the Robinhood faucet, then try again.')
  const signer = guest ?? address, request = { to: CANDY_TOKEN, data: encodeFunctionData({ abi: tokenAbi, functionName: 'transfer', args: [treasury, CRATE_PRICE] }), account: signer }
  const [gas, gasPrice] = await Promise.all([client.estimateGas(request), client.getGasPrice()])
  if (gasBalance < gas * gasPrice * 12n / 10n) throw new Error('Not enough test ETH for gas. Top up at the Robinhood faucet.')
  await verifyAccount(address, guest)
  state('transaction')
  const hash = await createWalletClient({ chain: robinhood, transport: guest ? http(shopRpc) : custom(provider!), account: signer }).sendTransaction(request)
  savePending(address, hash, true); state('confirming', hash)
  return confirmCrate(address, hash)
}
// A crate only for a successful direct call to the token whose Transfer moved at least CRATE_PRICE from the buyer to the treasury.
// Shop item purchases also emit buyer-to-treasury Transfers, but their transaction goes to the shop, so they never count.
export async function confirmCrate(address: Address, hash: Hash): Promise<Hash> {
  const [receipt, treasury] = await Promise.all([client.waitForTransactionReceipt({ hash, timeout: 120_000 }), client.readContract({ address: SHOP_ADDRESS!, abi: shopAbi, functionName: 'treasury' })])
  savePending(address, null, true)
  if (receipt.status !== 'success') throw new Error('The crate payment reverted. No crate was added; the network may still charge gas.')
  const paid = !!receipt.to && same(receipt.to, CANDY_TOKEN) && receipt.logs.some(log => {
    if (!same(log.address, CANDY_TOKEN)) return false
    try { const { args } = decodeEventLog({ abi: tokenAbi, eventName: 'Transfer', data: log.data, topics: log.topics }); return same(args.from, address) && same(args.to, treasury) && args.value >= CRATE_PRICE } catch { return false }
  })
  if (!paid) throw new Error('That transaction did not pay 50 $KNOCK to the shop. No crate was added.')
  return hash
}
export function shopError(error: unknown) {
  const e = error as { code?: number; shortMessage?: string; message?: string }, text = e.shortMessage ?? e.message ?? 'The network did not respond. Please try again.'
  if (e.code === 4001 || /rejected|denied/i.test(text)) return 'Cancelled in your wallet. No new purchase was sent.'
  if (/insufficient funds/i.test(text)) return 'Not enough test ETH for gas. Top up at the Robinhood faucet.'
  if (/timeout|timed out/i.test(text)) return 'The network is taking longer than expected. Check any pending transaction before trying again.'
  return text.split('\n')[0]
}
