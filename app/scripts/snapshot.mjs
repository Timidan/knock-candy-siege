// Snapshot of every Chog Genesis token: `node scripts/snapshot.mjs` writes public/chogs.json (token id -> art index,
// name, Side, Background, Tier). `node scripts/snapshot.mjs images` then caches a 512px thumbnail of each Chog in
// public/chogs/<id>.webp. Both steps are resumable: finished files are skipped on the next run.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createPublicClient, defineChain, http, parseAbi } from 'viem'

const CHOG = '0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763'
const SUPPLY = 1969
// ipfs.io, dweb.link, w3s.link and nftstorage.link answer 429; these two serve the Chog files.
const GATEWAYS = ['https://ipfs.filebase.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/']
const ROOT = new URL('..', import.meta.url).pathname
const CACHE = `${ROOT}../.cache/`
const monad = defineChain({
  id: 143, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
})
const client = createPublicClient({ chain: monad, transport: http() })
const sleep = ms => new Promise(r => setTimeout(r, ms))

// GET an IPFS path with retries, alternating gateways: they time out and rate-limit, and an error page must
// never be saved as data.
let turn = 0
async function get(path, valid) {
  for (let attempt = 0; ; attempt++) {
    const url = GATEWAYS[turn++ % GATEWAYS.length] + path
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      const body = Buffer.from(await res.arrayBuffer())
      if (res.ok && valid(body)) return body
      if (res.ok) throw new Error(`invalid body (${body.length} bytes)`)
      throw new Error(`HTTP ${res.status}`)
    } catch (error) {
      if (attempt === 6) throw new Error(`${url}: ${error.message}`)
      await sleep(Math.min(60_000, 2_000 * 2 ** attempt))
    }
  }
}

async function pool(items, size, work) {
  let next = 0, done = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await work(item)
      if (++done % 100 === 0) console.log(`${done}/${items.length}`)
    }
  }))
}

const isJson = body => { try { return Array.isArray(JSON.parse(body).attributes) } catch { return false } }
const isWebp = body => body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP'

async function metadata() {
  const ids = Array.from({ length: SUPPLY }, (_, i) => i + 1)
  const uris = await client.multicall({
    contracts: ids.map(id => ({ address: CHOG, abi: parseAbi(['function tokenURI(uint256) view returns (string)']), functionName: 'tokenURI', args: [BigInt(id)] })),
    allowFailure: false, batchSize: 16_384,
  })
  mkdirSync(`${CACHE}meta`, { recursive: true })
  const rows = ids.map((id, i) => {
    const match = uris[i].match(/^ipfs:\/\/([^/]+)\/(\d+)\.json$/)
    if (!match) throw new Error(`token ${id}: unexpected tokenURI ${uris[i]}`)
    return { id, cid: match[1], art: Number(match[2]) }
  })
  const failed = []
  await pool(rows, 6, async row => {
    const file = `${CACHE}meta/${row.art}.json`
    try {
      if (!existsSync(file)) writeFileSync(file, await get(`${row.cid}/${row.art}.json`, isJson))
    } catch (error) {
      failed.push(row.id)
      console.error(error.message)
    }
  })
  if (failed.length) throw new Error(`${failed.length} metadata files failed; run again to retry them`)
  let image = ''
  const chogs = rows.map(({ id, art }) => {
    const meta = JSON.parse(readFileSync(`${CACHE}meta/${art}.json`, 'utf8'))
    const trait = type => meta.attributes.find(a => a.trait_type === type)?.value ?? ''
    image ||= meta.image.replace(/\d+\.webp$/, '')
    return { id, art, name: meta.name, side: trait('Side'), background: trait('Background'), tier: trait('Tier') }
  })
  // The 10 legendary 1:1s have no Side (custom art), so the app puts no overlays on their portraits.
  if (chogs.some(c => c.side && c.side !== 'Left' && c.side !== 'Right')) throw new Error('an unexpected Side value')
  writeFileSync(`${ROOT}public/chogs.json`, JSON.stringify({ image, chogs }))
  const left = chogs.filter(c => c.side === 'Left').length, custom = chogs.filter(c => !c.side).length
  console.log(`wrote public/chogs.json: ${chogs.length} Chogs, ${left} facing left, ${custom} without a Side`)
}

async function images() {
  const { image, chogs } = JSON.parse(readFileSync(`${ROOT}public/chogs.json`, 'utf8'))
  const base = image.replace('ipfs://', '')
  mkdirSync(`${ROOT}public/chogs`, { recursive: true })
  mkdirSync(`${CACHE}img`, { recursive: true })
  const failed = []
  await pool(chogs, 6, async ({ id, art }) => {
    const out = `${ROOT}public/chogs/${id}.webp`
    if (existsSync(out)) return
    try {
      const raw = `${CACHE}img/${art}.webp`
      if (!existsSync(raw)) writeFileSync(raw, await get(`${base}${art}.webp`, isWebp))
      execFileSync('magick', [raw, '-resize', '512x512', '-quality', '80', out])
    } catch (error) {
      failed.push(id)
      console.error(error.message)
    }
  })
  console.log(failed.length ? `done; ${failed.length} failed, run again to retry: ${failed.join(' ')}` : 'all thumbnails cached')
}

await (process.argv[2] === 'images' ? images() : metadata())
