import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SiegeWallet } from './guestWallet'
import { WalletChoice } from './WalletChoice'
import { StarterGrant } from './StarterGrant'
import type { CandyBank } from './candyBank'
import { Sticker, playUi } from '../ui'
import { CANDY_TOKEN, isSandbox } from '../chain'
import { hasAsset, loadAtlas, loadHeroAssets, type AssetPack } from './assets'
import type { Kit } from './data/kits'
import { SHOP_ITEMS, CRYPTO_EMOTES } from './data/shop'
import { HeroPreview } from './hero/HeroPreview'
import { reducedMotion, CRATE_CANDY } from './data/save'
import { CRATE_PRICE, SHOP_ADDRESS, knockAmount } from './shopChain'
import type { ShopState } from './useShop'
import './shop-vault.css'

export function AtlasSprite({ atlas, name, size = 128 }: { atlas?: AssetPack['atlases'][number]; name: string; size?: number }) {
  const f = atlas?.data.frames[name]?.frame
  if (!f || !atlas) return null
  const scale = size / Math.max(f.w, f.h)
  return <span aria-hidden="true" className="siege-atlas-sprite" style={{ width: f.w * scale, height: f.h * scale, backgroundImage: `url(${atlas.image.src})`, backgroundSize: `${atlas.image.width * scale}px ${atlas.image.height * scale}px`, backgroundPosition: `-${f.x * scale}px -${f.y * scale}px` }} />
}
// The claim ceremony: candies fountain up out of the balance and drop back into it. [apex x px, apex y px, delay ms, spin deg]; the class picks the candy.
const BURST = [[-64, -92, 0, 260], [-38, -124, 40, -320], [-12, -100, 90, 200], [14, -132, 20, -240], [40, -110, 70, 300], [66, -88, 120, -200], [-52, -66, 160, 340], [28, -74, 180, -280], [-26, -136, 210, 220], [52, -120, 240, -300], [2, -84, 260, 180], [-4, -116, 300, -220]]
const CANDY = ['mint', 'corn', 'gum', 'slime']
export function Shop({ assets, kit, shop, wallet, bank, crates, onBack, inLevel }: { assets: AssetPack; kit: Kit; shop: ShopState; wallet: SiegeWallet; bank: CandyBank; crates: number; onBack: () => void; inLevel: boolean }) {
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
  // Only a claim seen going from unclaimed or queued to paid gets the ceremony; a wallet that was already paid when the shop opened (null to paid) does not.
  const claim = bank.claim?.state, lastClaim = useRef(claim), [burst, setBurst] = useState(false)
  useEffect(() => { const before = lastClaim.current; lastClaim.current = claim; if (claim === 'paid' && (before === 'none' || before === 'queued') && !reducedMotion()) setBurst(true) }, [claim])
  useEffect(() => { if (!burst) return; const timer = setTimeout(() => setBurst(false), 1700); return () => clearTimeout(timer) }, [burst])
  const short = shop.account ? `${shop.account.slice(0, 6)}…${shop.account.slice(-4)}` : ''
  const insufficient = price !== null && shop.balance !== null && shop.balance < price, crateShort = shop.balance !== null && shop.balance < CRATE_PRICE
  return <div className="siege-shop siege-vault">
    <h2><span>Candy Vault</span> · dress your Chog</h2>
    <WalletChoice wallet={wallet} disabled={shop.busy || inLevel} />
    <StarterGrant bank={bank} hasWallet={!!shop.account} />
    <div className="siege-shop-wallet">
      <span>{short || 'Guest browsing'}<strong className={burst ? 'is-filling' : undefined}>{shop.balance === null ? '—' : knockAmount(shop.balance)} $KNOCK{burst && <span className="siege-vault-burst" aria-hidden="true">{BURST.map(([x, y, delay, spin], i) => <i key={i} className={`siege-candy--${CANDY[i % 4]}`} style={{ '--x': `${x}px`, '--y': `${y}px`, '--spin': `${spin}deg`, animationDelay: `${delay}ms` } as CSSProperties} />)}</span>}</strong></span>
      {!isSandbox && !wallet.guest && <Sticker disabled={shop.busy || wallet.connecting || shop.network || inLevel} onClick={() => void shop.connect()}>{!shop.account ? 'Connect wallet' : !shop.network ? 'Switch to Robinhood' : 'Wallet connected'}</Sticker>}
    </div>
    {!SHOP_ADDRESS && <p className="siege-shop-note" role="status">Shop opens soon · preview everything below. Prices shown are launch defaults.</p>}
    {isSandbox && <p className="siege-shop-note">Sandbox · browse and preview only. Buying is disabled.</p>}
    {inLevel && !shop.network && !isSandbox && <p className="siege-shop-note">Connect or change wallets from the title-screen shop between levels.</p>}
    <div className="siege-shop-layout">
      <div className="siege-shop-catalog" aria-label="Shop items">{SHOP_ITEMS.map(row => <button key={row.id} className={`siege-shop-item ${row.id === selected ? 'is-selected' : ''}`} aria-pressed={row.id === selected} onClick={() => { setSelected(row.id); playUi('ui-select') }}>
        <AtlasSprite atlas={dances?.data.frames[`card/${row.card}`] ? dances : cards} name={dances?.data.frames[`card/${row.card}`] ? `card/${row.card}` : `card/${row.kind === 'dance' ? 'emote-pack' : row.card}`} size={112} /><strong>{row.name}</strong><span>{shop.owned.includes(row.id) ? '✓ Owned' : shop.prices?.[row.id] === 0n ? 'Not for sale' : `${shop.prices?.[row.id] !== undefined ? knockAmount(shop.prices[row.id]) : SHOP_ADDRESS ? '…' : row.price} $KNOCK`}</span>
      </button>)}</div>
      <section className="siege-shop-preview" aria-label={`${item.name} live preview`}>
        <span className="siege-eyebrow">TRY IT ON · CHOG #{kit.id}</span>
        <h3>{item.name}</h3>
        {pack ? item.kind === 'tower' ? <div className="siege-gold-preview">{[1, 2, 3].map(level => <AtlasSprite key={level} atlas={pack.atlases.find(a => a.key === 'towers3')} name={`tower/roost/${level}`} size={160} />)}</div> : item.kind === 'towers' ? <div className="siege-gold-preview">{['egg', 'tp', 'lantern', 'patch'].map((kind, index) => <AtlasSprite key={kind} atlas={pack.atlases.find(a => a.key === 'skins3')} name={`skin/gold/tower/${kind}/${1 + (Math.floor(frame / 8) + index) % 3}`} size={160} />)}</div> : <div className="siege-shop-hero"><HeroPreview assets={pack} kit={kit} costume={item.kind === 'costume' ? item.key : kit.costume} dance={item.kind === 'dance' ? item.key : 'gg'} />{item.kind === 'emotes' && <div className="siege-crypto-preview"><AtlasSprite atlas={pack.atlases.find(a => a.key === 'emotes2')} name={`emote/${CRYPTO_EMOTES[Math.floor(frame / 8) % 8]}/${frame % 4}`} size={118} /></div>}</div> : <p role="status">Getting the preview ready…</p>}
        <p>{item.kind === 'dance' ? 'A new move for your emote wheel and victory celebration.' : item.kind === 'costume' ? 'A new outfit for any Chog. Your own weapon and kit stay with you.' : item.kind === 'towers' ? 'Gold for all four classic towers, at every level. Equip in Settings.' : item.kind === 'tower' ? 'Unlock all three Bat Roost levels. Its bat swarms hunt flyers; pair it with ground defences.' : item.kind === 'emotes' ? 'GM, LFG, WAGMI, REKT, HODL, MOON, GN and NGMI.' : '+50 starting candy on every level, for good. Bought once, yours forever.'}</p>
        <strong className="siege-shop-price">{price === null ? 'Reading price…' : `${knockAmount(price)} $KNOCK`}</strong>
        <Sticker tone="gold" sound="ui-confirm" disabled={owned || !SHOP_ADDRESS || isSandbox || shop.busy || shop.pending || !shop.account || !shop.network || price === null || price === 0n || shop.balance === null || insufficient || shop.gas === null || shop.gas === 0n} onClick={() => void shop.buy(item.id)}>{owned ? '✓ Owned' : !SHOP_ADDRESS ? 'Shop opens soon' : price === 0n ? 'Not for sale' : insufficient ? 'Not enough $KNOCK' : shop.gas === 0n ? 'Get test ETH for gas' : 'Buy for ' + (price === null ? '…' : knockAmount(price)) + ' $KNOCK'}</Sticker>
        {shop.account && !shop.network && <small>Switch your wallet to Robinhood before buying.</small>}
      </section>
    </div>
    <section className="siege-crate" aria-label="Candy Crate">
      <p><strong>Candy Crate</strong> +{CRATE_CANDY} candy at the start of one night. Switch it on in the hero picker; not for the Daily or challenges.{crates > 0 && <b> You have {crates}.</b>}</p>
      <Sticker tone="gold" sound="ui-confirm" disabled={!SHOP_ADDRESS || isSandbox || shop.busy || shop.pending || !shop.account || !shop.network || shop.balance === null || crateShort || shop.gas === null || shop.gas === 0n} onClick={() => void shop.buyCrate()}>{!SHOP_ADDRESS ? 'Shop opens soon' : crateShort ? 'Not enough $KNOCK' : shop.gas === 0n ? 'Get test ETH for gas' : `Buy for ${knockAmount(CRATE_PRICE)} $KNOCK`}</Sticker>
    </section>
    {(shop.status || shop.error || error) && <div className="siege-shop-status" role="status">{shop.status && <p>{shop.status}</p>}{(shop.error || error) && <p>{shop.error || error}</p>}</div>}
    {shop.hash && <p><a href={`https://explorer.testnet.chain.robinhood.com/tx/${shop.hash}`} target="_blank" rel="noreferrer">View purchase transaction ↗</a>{shop.pending && <Sticker disabled={shop.busy} onClick={() => void shop.checkPending()}>Check pending purchase</Sticker>}</p>}
    <section className="siege-knock" aria-label="About $KNOCK">
      <p><strong>$KNOCK</strong> is Knock’s candy token, launched on vibe/vibe on Robinhood Chain testnet. You spend it here on costumes, dances and Candy Crates.</p>
      <div className="row siege-shop-links"><a href={`https://testnet.vibevibe.fun/token/${CANDY_TOKEN}`} target="_blank" rel="noreferrer">$KNOCK on vibe/vibe ↗</a><a href={`https://explorer.testnet.chain.robinhood.com/token/${CANDY_TOKEN}`} target="_blank" rel="noreferrer">Token on the explorer ↗</a><a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer">Get test ETH for gas ↗</a></div>
    </section>
    <p className="siege-hint">One permit for the exact price, then one purchase transaction from your wallet. Guest wallets sign and send locally in this browser. If you already approved enough, only the transaction is needed. Test ETH pays gas.</p>
    <div className="row"><Sticker sound="ui-back" onClick={onBack}>← Back</Sticker><Sticker disabled={shop.busy} onClick={() => { void shop.refresh(); setAttempt(n => n + 1) }}>Refresh shop</Sticker></div>
    <p className="siege-shop-disclosure">$KNOCK is a testnet token with no real value. Siege only spends it. Playing Siege never pays out $KNOCK.</p>
  </div>
}
