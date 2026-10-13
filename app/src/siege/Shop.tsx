import { useEffect, useState } from 'react'
import type { SiegeWallet } from './guestWallet'
import { WalletChoice } from './WalletChoice'
import { StarterGrant } from './StarterGrant'
import type { CandyBank } from './candyBank'
import { Sticker } from '../ui'
import { CANDY_TOKEN, isSandbox } from '../chain'
import { hasAsset, loadAtlas, loadHeroAssets, type AssetPack } from './assets'
import type { Kit } from './data/kits'
import { SHOP_ITEMS, CRYPTO_EMOTES } from './data/shop'
import { HeroPreview } from './hero/HeroPreview'
import { reducedMotion } from './data/save'
import { SHOP_ADDRESS, knockAmount } from './shopChain'
import type { ShopState } from './useShop'

export function AtlasSprite({ atlas, name, size = 128 }: { atlas?: AssetPack['atlases'][number]; name: string; size?: number }) {
  const f = atlas?.data.frames[name]?.frame
  if (!f || !atlas) return null
  const scale = size / Math.max(f.w, f.h)
  return <span aria-hidden="true" className="siege-atlas-sprite" style={{ width: f.w * scale, height: f.h * scale, backgroundImage: `url(${atlas.image.src})`, backgroundSize: `${atlas.image.width * scale}px ${atlas.image.height * scale}px`, backgroundPosition: `-${f.x * scale}px -${f.y * scale}px` }} />
}
export function Shop({ assets, kit, shop, wallet, bank, onBack, inLevel }: { assets: AssetPack; kit: Kit; shop: ShopState; wallet: SiegeWallet; bank: CandyBank; onBack: () => void; inLevel: boolean }) {
  const [selected, setSelected] = useState(1), [pack, setPack] = useState<AssetPack | null>(null), [cards, setCards] = useState<AssetPack['atlases'][number]>(), [dances, setDances] = useState<AssetPack['atlases'][number]>(), [error, setError] = useState(''), [attempt, setAttempt] = useState(0), [frame, setFrame] = useState(0)
  const item = SHOP_ITEMS.find(i => i.id === selected)!, owned = shop.owned.includes(selected), price = shop.prices?.[selected] ?? (!SHOP_ADDRESS ? BigInt(item.price) * 10n ** 18n : null)
  useEffect(() => {
    const controller = new AbortController()
    void loadAtlas('cards', controller.signal).then(setCards).catch(() => { if (!controller.signal.aborted) setError('Shop cards could not be loaded.') })
    // Each dance has its own card (art job 3E) when the sheet is shipped; until then they share the emote pack's.
    if (hasAsset('/siege/atlas/cards2.json')) void loadAtlas('cards2', controller.signal).then(setDances).catch(() => { /* The shared card stays. */ })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const controller = new AbortController(); setPack(null); setError('')
    void loadHeroAssets(assets, kit, controller.signal, item.kind === 'costume' ? item.key : '', [21, 22].includes(item.id) ? [item.id] : []).then(async next => item.kind === 'tower' ? { ...next, atlases: [...next.atlases, await loadAtlas('towers3', controller.signal)] } : next).then(next => { if (!controller.signal.aborted) setPack(next) }).catch(() => { if (!controller.signal.aborted) setError('The preview could not be loaded. Please try again.') })
    return () => controller.abort()
  }, [assets, kit.id, item.id, attempt])
  useEffect(() => { if (reducedMotion()) return; const timer = setInterval(() => setFrame(n => n + 1), 180); return () => clearInterval(timer) }, [])
  const short = shop.account ? `${shop.account.slice(0, 6)}…${shop.account.slice(-4)}` : ''
  const insufficient = price !== null && shop.balance !== null && shop.balance < price
  return <div className="siege-shop">
    <span className="siege-eyebrow">THE AFTER-DARK OUTFITTER</span><h2>A little extra mischief</h2>
    <p className="siege-shop-disclosure">$KNOCK is a testnet token with no real value.<br />Siege only spends it. Playing Siege never pays out $KNOCK.</p>
    <WalletChoice wallet={wallet} disabled={shop.busy || inLevel} />
    <StarterGrant bank={bank} hasWallet={!!shop.account} />
    <div className="siege-shop-wallet">
      <span>{short || 'Guest browsing'}<strong>{shop.balance === null ? '—' : knockAmount(shop.balance)} $KNOCK</strong></span>
      {!isSandbox && !wallet.guest && <Sticker disabled={shop.busy || wallet.connecting || shop.network || inLevel} onClick={() => void shop.connect()}>{!shop.account ? 'Connect wallet' : !shop.network ? 'Switch to Robinhood' : 'Wallet connected'}</Sticker>}
    </div>
    {!SHOP_ADDRESS && <p className="siege-shop-note" role="status">Shop opens soon · preview everything below. Prices shown are launch defaults.</p>}
    {isSandbox && <p className="siege-shop-note">Sandbox · browse and preview only. Buying is disabled.</p>}
    {inLevel && !shop.network && !isSandbox && <p className="siege-shop-note">Connect or change wallets from the title-screen shop between levels.</p>}
    <div className="siege-shop-layout">
      <div className="siege-shop-catalog" aria-label="Shop items">{SHOP_ITEMS.map(row => <button key={row.id} className={`siege-shop-item ${row.id === selected ? 'is-selected' : ''}`} aria-pressed={row.id === selected} onClick={() => setSelected(row.id)}>
        <AtlasSprite atlas={dances?.data.frames[`card/${row.card}`] ? dances : cards} name={dances?.data.frames[`card/${row.card}`] ? `card/${row.card}` : `card/${row.kind === 'dance' ? 'emote-pack' : row.card}`} size={112} /><strong>{row.name}</strong><span>{shop.owned.includes(row.id) ? '✓ Owned' : shop.prices?.[row.id] === 0n ? 'Not for sale' : `${shop.prices?.[row.id] !== undefined ? knockAmount(shop.prices[row.id]) : SHOP_ADDRESS ? '…' : row.price} $KNOCK`}</span>
      </button>)}</div>
      <section className="siege-shop-preview" aria-label={`${item.name} live preview`}>
        <span className="siege-eyebrow">TRY IT ON · CHOG #{kit.id}</span>
        <h3>{item.name}</h3>
        {pack ? item.kind === 'tower' ? <div className="siege-gold-preview">{[1, 2, 3].map(level => <AtlasSprite key={level} atlas={pack.atlases.find(a => a.key === 'towers3')} name={`tower/roost/${level}`} size={160} />)}</div> : item.kind === 'towers' ? <div className="siege-gold-preview">{['egg', 'tp', 'lantern', 'patch'].map((kind, index) => <AtlasSprite key={kind} atlas={pack.atlases.find(a => a.key === 'skins3')} name={`skin/gold/tower/${kind}/${1 + (Math.floor(frame / 8) + index) % 3}`} size={160} />)}</div> : <div className="siege-shop-hero"><HeroPreview assets={pack} kit={kit} costume={item.kind === 'costume' ? item.key : kit.costume} dance={item.kind === 'dance' ? item.key : 'gg'} />{item.kind === 'emotes' && <div className="siege-crypto-preview"><AtlasSprite atlas={pack.atlases.find(a => a.key === 'emotes2')} name={`emote/${CRYPTO_EMOTES[Math.floor(frame / 8) % 8]}/${frame % 4}`} size={118} /></div>}</div> : <p role="status">Getting the preview ready…</p>}
        <p>{item.kind === 'dance' ? 'A new move for your emote wheel and victory celebration.' : item.kind === 'costume' ? 'A new outfit for any Chog. Your own weapon and kit stay with you.' : item.kind === 'towers' ? 'Gold for all four classic towers, at every level. Equip in Settings.' : item.kind === 'tower' ? 'Unlock all three Bat Roost levels. Its bat swarms hunt flyers; pair it with ground defences. Launch price: 1,000 $KNOCK. Sales open when the shop sets its on-chain price.' : item.kind === 'emotes' ? 'GM, LFG, WAGMI, REKT, HODL, MOON, GN and NGMI.' : '+50 starting candy on every level, for good. Bought once, yours forever.'}</p>
        <strong className="siege-shop-price">{price === null ? 'Reading price…' : `${knockAmount(price)} $KNOCK`}</strong>
        <Sticker tone="gold" disabled={owned || !SHOP_ADDRESS || isSandbox || shop.busy || shop.pending || !shop.account || !shop.network || price === null || price === 0n || shop.balance === null || insufficient || shop.gas === null || shop.gas === 0n} onClick={() => void shop.buy(item.id)}>{owned ? '✓ Owned' : !SHOP_ADDRESS ? 'Shop opens soon' : price === 0n ? 'Not for sale' : insufficient ? 'Not enough $KNOCK' : shop.gas === 0n ? 'Get test ETH for gas' : 'Buy for ' + (price === null ? '…' : knockAmount(price)) + ' $KNOCK'}</Sticker>
        {shop.account && !shop.network && <small>Switch your wallet to Robinhood before buying.</small>}
      </section>
    </div>
    {(shop.status || shop.error || error) && <div className="siege-shop-status" role="status">{shop.status && <p>{shop.status}</p>}{(shop.error || error) && <p>{shop.error || error}</p>}</div>}
    {shop.hash && <p><a href={`https://explorer.testnet.chain.robinhood.com/tx/${shop.hash}`} target="_blank" rel="noreferrer">View purchase transaction ↗</a>{shop.pending && <Sticker disabled={shop.busy} onClick={() => void shop.checkPending()}>Check pending purchase</Sticker>}</p>}
    <div className="row siege-shop-links"><a href={`https://testnet.vibevibe.fun/token/${CANDY_TOKEN}`} target="_blank" rel="noreferrer">Get it on vibe/vibe ↗</a><a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer">Get test ETH for gas ↗</a></div>
    <p className="siege-hint">One permit for the exact price, then one purchase transaction from your wallet. Guest wallets sign and send locally in this browser. If you already approved enough, only the transaction is needed. Test ETH pays gas.</p>
    <div className="row"><Sticker onClick={onBack}>← Back</Sticker><Sticker disabled={shop.busy} onClick={() => { void shop.refresh(); setAttempt(n => n + 1) }}>Refresh shop</Sticker></div>
  </div>
}
