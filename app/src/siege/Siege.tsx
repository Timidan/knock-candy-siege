import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Phaser from 'phaser'
import { Sticker, PlaqueInput } from '../ui'
import type { WalletState } from '../wallet'
import { loadAssets, loadAtlas, loadHeroAssets, loadLevelAssets } from './assets'
import type { AssetPack } from './assets'
import { SiegeScene } from './SiegeScene'
import type { Outcome, Mode } from './SiegeScene'
import { Sfx } from './Sfx'
import { readSave, writeSave } from './data/save'
import type { Save, Settings } from './data/save'
import { NO_STREET, readStreetBonuses, streetLines } from './street'
import type { StreetRead, StreetBonuses } from './street'
import { ENEMIES, seededRandom } from './data/config'
import type { EnemyKind } from './data/config'
import { LEVELS, ENDLESS_LEVEL, mapFile } from './data/level1'
import { dailyInfo, DAILY_LEVEL, NIGHTS } from './data/endless'
import type { Daily } from './data/endless'
import { FieldGuide } from './FieldGuide'
import { resolveKit } from './data/kits'
import { HeroPreview } from './hero/HeroPreview'
import { selfCheck } from './data/selfCheck'
import { Shop, AtlasSprite } from './Shop'
import { useShop } from './useShop'
import { reopenShop } from './shopChain'
import { SHOP_ITEMS, canDance } from './data/shop'
import { ShareCard } from './ShareCard'
import './siege.css'

type Run = { id: number; home: boolean; serial: number; level: number; mode: Mode; daily: Daily | null; seed: number; tutorial: boolean; costume: string; owned: number[]; victoryDance: string; assets: AssetPack; street: StreetBonuses; streetUnavailable?: boolean; stars: Record<string, number> }
type Menu = 'title' | 'levels' | 'hero' | 'pause' | 'settings' | 'book' | 'result' | 'intro' | 'shop' | 'street' | null
if (import.meta.env.DEV) selfCheck()
function Modal({ children, label, onEscape, className = '' }: { children: ReactNode; label: string; onEscape: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className={`siege-modal board ${className}`} aria-label={label} onCancel={event => { event.preventDefault(); onEscape() }}>{children}</dialog>
}
function EnemyPortrait({ assets, kind, id }: { assets: AssetPack; kind: EnemyKind; id: number }) {
  const atlas = assets.atlases.find(a => a.data.frames[`enemy/${kind}/walk/0`]), frame = atlas?.data.frames[`enemy/${kind}/walk/0`]?.frame
  const anchor = assets.faces[kind] ?? { x: 64, y: 52, r: 27 }
  if (!atlas || !frame) return <div className={`siege-enemy-token siege-enemy-token--${kind}`} aria-hidden="true">{kind === 'ghost' ? '☁' : kind === 'pumpkin' ? '◉' : kind === 'bat' ? '⌁' : '✦'}</div>
  return <div className="siege-intro-body" aria-hidden="true" style={{ width: frame.w, height: frame.h, backgroundImage: `url(${atlas.image.src})`, backgroundPosition: `-${frame.x}px -${frame.y}px` }}><img src={`/chogs-256/${id}.webp`} alt="" style={{ left: anchor.x - anchor.r, top: anchor.y - anchor.r, width: anchor.r * 2, height: anchor.r * 2 }} onError={event => { event.currentTarget.hidden = true }} /></div>
}
// The first meeting with a legend (or the Great Pumpkin) gets a card of its own.
function BossCard({ assets, id, sheet }: { assets: AssetPack; id: string; sheet?: AssetPack['atlases'][number] }) {
  const legend = assets.legends.legends[id], pumpkin = id === 'pumpkin'
  return <>
    <span className="siege-eyebrow">{pumpkin ? 'THE FINAL BOSS' : 'A LEGEND AT THE DOOR'}</span><h2>{pumpkin ? assets.legends.greatPumpkin.name : legend?.name}</h2>
    {pumpkin ? <div className="siege-boss-art">{sheet ? <AtlasSprite atlas={sheet} name="boss/pumpkin/walk/2" size={210} /> : <span>◉</span>}</div> : <div className="siege-boss-art siege-boss-art--legend"><img src={`/chogs-256/${id}.webp`} alt="" /></div>}
    {pumpkin ? <ul className="siege-boss-moves">{assets.legends.greatPumpkin.phases.map(phase => <li key={phase}>{phase}</li>)}</ul> : legend && <p><b>{legend.boss.move}.</b> {legend.boss.effect[0].toUpperCase() + legend.boss.effect.slice(1)}.</p>}
    <p className="siege-hint">{pumpkin ? 'Magic and splash work best. Guards get flattened.' : 'It enters with a flourish, casts on a timer, and gets angrier at half health.'}</p>
  </>
}
export default function Siege({ wallet, onBack }: { wallet: WalletState; onBack?: () => void }) {
  const shell = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const autoFullscreenTried = useRef(false)
  const [installTip, setInstallTip] = useState(false)
  const [displayNotice, setDisplayNotice] = useState('')
  const scene = useRef<SiegeScene | null>(null)
  const sfx = useRef<Sfx | null>(null)
  const [assets, setAssets] = useState<AssetPack | null>(null)
  const [prepared, setPrepared] = useState<{ id: number; home: boolean; costume: string; assets: AssetPack } | null>(null)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [save, setSave] = useState<Save>(readSave)
  const saveRef = useRef(save)
  const [saveWarning, setSaveWarning] = useState(false)
  const [menu, setMenu] = useState<Menu>(() => reopenShop() ? 'shop' : 'title')
  const menuNow = useRef(menu); menuNow.current = menu
  const [returnMenu, setReturnMenu] = useState<Menu>('title')
  const [level, setLevel] = useState(1)
  const [menuRandom] = useState(() => seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]))
  const [hero, setHero] = useState(() => String(Math.floor(menuRandom() * 1969) + 1))
  const [run, setRun] = useState<Run | null>(null)
  const [streetRead, setStreetRead] = useState<StreetRead | null>(null)
  const pendingRun = useRef<Run | null>(null), startToken = useRef(0)
  const accountNow = useRef(wallet.account); accountNow.current = wallet.account
  const [starting, setStarting] = useState(false)
  useEffect(() => { startToken.current++; pendingRun.current = null; setStarting(false); setStreetRead(null); setMenu(m => m === 'street' ? 'hero' : m) }, [wallet.account])
  useEffect(() => () => { startToken.current++ }, [])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [intro, setIntro] = useState('treater')
  const [icons, setIcons] = useState<AssetPack['atlases'][number]>()
  // The daily challenge: the UTC date picks the level and the night's modifier (the same theme as the live street).
  const daily = dailyInfo(), mapLevel = level === DAILY_LEVEL ? daily.level : level
  const mode: Mode = level === ENDLESS_LEVEL ? 'endless' : level === DAILY_LEVEL ? 'daily' : 'level'
  const levelName = (id: number) => id === DAILY_LEVEL ? `Daily #${daily.number}` : LEVELS[id - 1].name
  const [ready, setReady] = useState(false)
  const valid = /^\d+$/.test(hero) && Number(hero) >= 1 && Number(hero) <= 1969
  const home = !!wallet.account && valid && wallet.ids.includes(Number(hero))
  const kit = assets && valid ? resolveKit(assets.kits, assets.traits, assets.chogs, Number(hero), home) : null
  const shop = useShop(wallet)
  const ownedKey = shop.owned.join(',')
  const costume = SHOP_ITEMS.some(i => i.kind === 'costume' && i.key === save.costume && shop.owned.includes(i.id)) ? save.costume : ''
  const victoryDance = kit && assets && canDance(save.victoryDance, kit.emote, shop.owned, assets.dances) ? save.victoryDance : 'gg'
  const [previewDance, setPreviewDance] = useState('idle')
  const pickingHero = menu === 'hero'
  const canFullscreen = document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function'
  const fullscreen = async () => {
    if (!shell.current) return
    try {
      if (document.fullscreenElement === shell.current) { screen.orientation?.unlock?.(); await document.exitFullscreen(); return }
      await shell.current.requestFullscreen()
      const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> }
      try { await orientation?.lock?.('landscape') } catch { /* Fullscreen still works when orientation lock is unavailable. */ }
    } catch {
      const message = 'Full screen is unavailable here. You can keep playing in this view.'
      if (scene.current) scene.current.hud.toast(message); else setDisplayNotice(message)
    }
  }
  const mobileFullscreen = () => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
    const phone = /iPhone|iPod/.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600)
    if (autoFullscreenTried.current || !saveRef.current.settings.autoFullscreen || !phone || standalone) return
    autoFullscreenTried.current = true
    if (canFullscreen) { void fullscreen(); return }
    if (/iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) {
      try { if (localStorage.getItem('knock-siege-install-tip')) return; localStorage.setItem('knock-siege-install-tip', '1') } catch { /* Show once this visit when storage is unavailable. */ }
      setInstallTip(true)
    }
  }
  useEffect(() => {
    // Keep index.html edits to meta tags; installation links load with the Siege entry.
    for (const [rel, href] of [['manifest', '/manifest.webmanifest'], ['apple-touch-icon', '/icons/knock-192.png']]) {
      if (document.head.querySelector(`link[rel="${rel}"]`)) continue
      const link = document.createElement('link'); link.rel = rel; link.href = href; document.head.append(link)
    }
  }, [])
  useEffect(() => {
    if (!assets || !valid || !pickingHero) { setPrepared(null); return }
    const controller = new AbortController()
    setPrepared(null); setError('')
    const kit = resolveKit(assets.kits, assets.traits, assets.chogs, Number(hero), home)
    void loadHeroAssets(assets, kit, controller.signal, costume, shop.owned).then(pack => loadLevelAssets(pack, mapLevel, controller.signal, level === DAILY_LEVEL)).then(pack => { if (!controller.signal.aborted) setPrepared({ id: Number(hero), home, costume, assets: pack }) }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load this hero.') })
    return () => controller.abort()
  }, [assets, hero, home, valid, pickingHero, loadAttempt, costume, ownedKey, level, mapLevel])
  // The daily card shows the night's icon from the props sheet.
  useEffect(() => {
    if (menu !== 'levels' || icons) return
    const controller = new AbortController()
    void loadAtlas('props3', controller.signal).then(setIcons).catch(() => { /* The card falls back to the theme name. */ })
    return () => controller.abort()
  }, [menu, icons])
  const persist = (next: Save) => { saveRef.current = next; setSave(next); setSaveWarning(!writeSave(next)) }
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    void loadAssets(controller.signal).then(pack => { if (!controller.signal.aborted) setAssets(pack) }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The level could not be loaded.') })
    return () => controller.abort()
  }, [loadAttempt])
  useEffect(() => {
    const audio = new Sfx(saveRef.current.settings); sfx.current = audio
    const unlock = () => void audio.unlock()
    document.addEventListener('pointerdown', unlock, { once: true })
    return () => { document.removeEventListener('pointerdown', unlock); audio.destroy(); sfx.current = null }
  }, [])
  useEffect(() => {
    if (!run || !assets || !host.current || !sfx.current) return
    setReady(false)
    const world = new SiegeScene({ assets: run.assets, level: run.level, mode: run.mode, daily: run.daily, seed: run.seed, stars: run.stars, street: run.street, seen: saveRef.current.seen, onDiscover: keys => persist({ ...saveRef.current, seen: [...new Set([...saveRef.current.seen, ...keys])] }), hero: run.id, home: run.home, tutorial: run.tutorial, costume: run.costume, owned: run.owned, victoryDance: run.victoryDance, settings: saveRef.current.settings, sfx: sfx.current,
      onShop: () => { setReturnMenu('pause'); setMenu('shop') },
      onFullscreen: canFullscreen ? () => { void fullscreen() } : undefined,
      onPause: () => setMenu('pause'),
      onIntro: kind => { setIntro(kind); setMenu('intro') },
      onTutorial: () => persist({ ...saveRef.current, tutorial: true }),
      onReady: () => { setReady(true); if (run.streetUnavailable) world.hud.toast('The street could not be reached. Playing this level without house bonuses.') },
      onEnd: result => {
        setOutcome(result); setMenu('result')
        const now = saveRef.current
        // Each mode keeps its own best: stars and score per level, the best endless wave, and the best score of each daily.
        if (run.mode === 'endless') persist({ ...now, endless: { wave: Math.max(now.endless.wave, result.wave), score: Math.max(now.endless.score, result.score) } })
        else if (run.mode === 'daily' && run.daily) persist({ ...now, daily: { ...now.daily, [run.daily.day]: Math.max(now.daily[run.daily.day] ?? 0, result.score) } })
        else persist({ ...now, stars: { ...now.stars, [run.level]: Math.max(now.stars[run.level] ?? 0, result.stars) }, scores: { ...now.scores, [run.level]: Math.max(now.scores[run.level] ?? 0, result.score) } })
      },
    })
    scene.current = world
    // Expand from the design buffer without multiplying it by devicePixelRatio.
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 1920, height: 1080, transparent: true, banner: false,
      // No Pre/Post FX is used; leaving them on allocates ~180 MB of render targets at boot, which can crash a phone tab.
      disablePreFX: true, disablePostFX: true,
      scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1920, height: 1080 },
      render: { antialias: true, roundPixels: false, powerPreference: 'high-performance', maxTextures: 8 },
      fps: { target: 60 }, audio: { noAudio: true }, input: { activePointers: 2 }, scene: world,
      callbacks: { postBoot: game => { game.canvas.setAttribute('aria-label', 'Candy Siege. Tap pads to build; select the hero portrait then tap the ground to move. Space pauses. 1 and 2 select spells. Q uses your ability. R uses your ultimate. Z and X choose a talent. E opens emotes.'); game.canvas.setAttribute('role', 'application'); game.canvas.tabIndex = 0 } },
    })
    const hide = () => { if (document.hidden && world.ready && !world.paused && !world.ended) world.pauseGame() }
    const resize = () => game.scale.refresh()
    const observer = new ResizeObserver(resize); observer.observe(host.current)
    window.addEventListener('orientationchange', resize)
    document.addEventListener('visibilitychange', hide)
    return () => { observer.disconnect(); window.removeEventListener('orientationchange', resize); document.removeEventListener('visibilitychange', hide); scene.current = null; game.destroy(true); setReady(false) }
  }, [run, assets])
  useEffect(() => {
    const world = scene.current
    if (!world || !assets || !ready) return
    const controller = new AbortController()
    // Refresh cosmetic availability without replacing the running level or granting candy mid-run.
    world.options.owned = shop.owned
    void loadHeroAssets(world.options.assets, world.hero.kit, controller.signal, world.options.costume, shop.owned).then(pack => {
      if (controller.signal.aborted || scene.current !== world) return
      world.art.addAssets(pack); world.options.assets = pack; world.applySettings(saveRef.current.settings); world.hud.emotes()
    }).catch(() => { /* Retry when the shop refreshes; the current level stays playable. */ })
    return () => controller.abort()
  }, [ownedKey, ready, assets])
  useEffect(() => { scene.current?.applySettings(save.settings); sfx.current?.apply(save.settings) }, [save.settings])
  const updateSettings = (settings: Settings) => persist({ ...saveRef.current, settings })
  const resume = () => { setMenu(null); scene.current?.setPaused(false); host.current?.querySelector('canvas')?.focus() }
  const leaveLevel = () => { setRun(null); setPrepared(null); setOutcome(null); setMenu('levels'); sfx.current?.pause(false) }
  const launchRun = (next: Run) => {
    setRun(next); pendingRun.current = null; setStreetRead(null); setOutcome(null); setMenu(null)
    void sfx.current?.unlock(); sfx.current?.pause(false)
  }
  const start = async (tutorial = level === 1 && !save.tutorial) => {
    if (starting) return
    let next: Run
    if (run && menu !== 'hero') next = { ...run, serial: Date.now(), tutorial, owned: shop.owned, stars: saveRef.current.stars, street: NO_STREET, streetUnavailable: false, assets: scene.current?.options.assets ?? run.assets }
    else {
      if (!valid || !prepared || prepared.id !== Number(hero) || prepared.home !== home || prepared.costume !== costume) return
      next = { id: Number(hero), home, level: mapLevel, mode, daily: mode === 'daily' ? daily : null, seed: mode === 'daily' ? daily.seed : crypto.getRandomValues(new Uint32Array(1))[0], serial: Date.now(), tutorial, costume, owned: shop.owned, victoryDance, assets: prepared.assets, street: NO_STREET, stars: saveRef.current.stars }
    }
    mobileFullscreen(); setStarting(true)
    const token = ++startToken.current, account = wallet.account, fromMenu = menu
    const result = await readStreetBonuses(next.id, account)
    if (token !== startToken.current || accountNow.current !== account) return
    setStarting(false)
    if (menuNow.current !== fromMenu) return
    if (result.status === 'guest') { launchRun({ ...next, home: !!account && wallet.ids.includes(next.id) }); return }
    if (result.status === 'unavailable') { launchRun({ ...next, streetUnavailable: true }); return }
    pendingRun.current = { ...next, home: result.status === 'ready' || next.home, street: result.bonuses }
    setStreetRead(result); setMenu('street')
  }
  const subMenu = (next: Menu) => { setReturnMenu(menu); setMenu(next) }
  const escape = () => {
    if (menu === 'settings' || menu === 'book' || menu === 'shop') setMenu(returnMenu)
    else if (menu === 'pause' || menu === 'intro') resume()
    else if (menu === 'street') { startToken.current++; pendingRun.current = null; setStreetRead(null); setMenu(run ? 'pause' : 'hero') }
    else if (menu === 'hero') setMenu('levels')
    else if (menu === 'levels') setMenu('title')
    else if (menu === 'result') leaveLevel()
  }
  const stars = (count: number) => <span className="siege-stars" aria-label={`${count} of 3 stars`}>{[1, 2, 3].map(n => <span key={n} className={n <= count ? 'earned-star' : ''} aria-hidden="true">★</span>)}</span>
  return <div ref={shell} className={`siege-shell ${run ? 'siege-shell--playing' : ''}`}>
    <div className="siege-stage" ref={host} />
    <div className="siege-safe-area" aria-hidden="true" />
    {!run && <div className="siege-night" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(#24163266, #241632aa), url(/siege/levels/level1.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>}
    {onBack && <div className="siege-back"><Sticker onClick={onBack}>← Knock</Sticker></div>}
    <div className="siege-rotate bubble">Turn your phone sideways for the best view</div>
    {run && !ready && <div className="siege-loading" role="status">Lighting the lanterns…</div>}
    {menu && <Modal key={menu} label={menu === 'intro' ? 'New enemy' : `Candy Siege ${menu}`} onEscape={escape} className={menu === 'result' ? 'siege-modal--result' : menu === 'shop' ? 'siege-modal--shop' : menu === 'hero' ? 'siege-modal--hero' : ''}>
      {installTip && <aside className="siege-install-tip" aria-label="Play full screen on iPhone">
        <strong>Add Knock to your Home Screen to play full screen</strong>
        <p>In Safari, tap Share (the square with an arrow). Scroll down and tap “Add to Home Screen”, then “Add”. Open Knock from its new icon.</p>
        <button className="siege-text-button" onClick={() => setInstallTip(false)}>Got it</button>
      </aside>}
      {displayNotice && <p role="status">{displayNotice}</p>}
      {menu === 'title' && <div className="siege-title">
        <span className="siege-eyebrow">A LITTLE MISCHIEF. A LOT OF CANDY.</span>
        <h1>Candy<br /><span>Siege</span><i aria-hidden="true">✦</i></h1>
        <p>The whole neighbourhood wants your candy.<br />Give them a Halloween to remember.</p>
        <Sticker tone="orange" onClick={() => { mobileFullscreen(); setMenu('levels') }}>Hold the porch →</Sticker>
        <div className="row"><Sticker tone="gold" onClick={() => subMenu('shop')}>Shop · $KNOCK</Sticker><Sticker onClick={() => subMenu('book')}>Field guide</Sticker><Sticker onClick={() => subMenu('settings')}>Settings</Sticker></div>
        <small>20 jars. Your Chog. One very long night.</small>
      </div>}
      {menu === 'levels' && <>
        <span className="siege-eyebrow">CHOG TOWN · AFTER DARK</span><h2>Pick your porch</h2>
        <div className="siege-levels">{LEVELS.map((item, index) => { const playable = item.waves.length > 0 || !!item.endless, best = item.endless ? save.endless.wave : save.stars[item.id] ?? 0; return <Sticker key={item.id} aria-label={`${item.endless ? 'Endless mode' : item.name}, ${playable ? item.endless ? `best wave ${best}` : `${best} stars${item.id === 1 ? ', Start here' : ''}` : 'Coming soon'}`} tone={item.endless ? 'orange' : playable ? 'gold' : 'paper'} className="siege-level" disabled={!playable} onClick={() => { setLevel(item.id); setMenu('hero') }}>
          <img className="siege-map-thumb" src={`/siege/levels/${mapFile(item.id)}.webp`} alt="" /><strong>{item.endless ? '∞' : String(index + 1).padStart(2, '0')}</strong><span>{item.endless ? 'Endless · Town Square' : item.name}</span>{item.endless ? <small>{save.endless.wave ? `Best: wave ${save.endless.wave}` : 'Waves never stop'}</small> : stars(best)}{item.id === 1 && <small className="siege-start-here">Start here</small>}{!playable && <small>Coming soon</small>}
        </Sticker> })}
          <Sticker aria-label={`Daily challenge number ${daily.number}: ${LEVELS[daily.level - 1].name}, ${NIGHTS[daily.theme].name}`} tone="gold" className="siege-level siege-daily" onClick={() => { setLevel(DAILY_LEVEL); setMenu('hero') }}>
            <img className="siege-map-thumb" src={`/siege/levels/level${daily.level}.webp`} alt="" /><strong>{icons ? <AtlasSprite atlas={icons} name={NIGHTS[daily.theme].icon} size={46} /> : '☾'}</strong><span>Daily #{daily.number}</span><small>{LEVELS[daily.level - 1].name} · {NIGHTS[daily.theme].name}</small><small>{save.daily[daily.day] ? `Best today: ${save.daily[daily.day].toLocaleString()}` : NIGHTS[daily.theme].text}</small>
          </Sticker>
        </div>
        <p className="siege-hint">3 stars: 18–20 jars · 2 stars: 10–17 · 1 star: 1–9</p>
        <Sticker onClick={() => setMenu('title')}>← Back</Sticker>
      </>}
      {menu === 'hero' && <>
        <span className="siege-eyebrow">{level === DAILY_LEVEL ? `${levelName(level).toUpperCase()} · ${LEVELS[daily.level - 1].name.toUpperCase()} · ${NIGHTS[daily.theme].name.toUpperCase()}` : level === ENDLESS_LEVEL ? 'ENDLESS · TOWN SQUARE' : `${levelName(level).toUpperCase()} · LEVEL ${level}`}</span><h2>Who’s on porch duty?</h2>
        <div className="siege-hero-pick">
          <div className={`siege-portrait ${home ? 'siege-portrait--home' : ''} ${kit?.legend ? 'siege-portrait--legend' : ''}`}>
            {!valid && <span>?</span>}
            {kit?.legend && <b className="siege-legendary">★ LEGENDARY ★</b>}
            <b>{home ? 'HOME ADVANTAGE' : 'GUEST HERO'}</b>
            {valid && <div className="siege-chog-comparison">
              <figure className="siege-nft"><figcaption>Your NFT</figcaption><img key={hero} src={`/chogs-256/${Number(hero)}.webp`} alt={`Original portrait of Chog #${Number(hero)}`} /><small>Chog #{Number(hero)}</small></figure>
              <figure className="siege-in-game"><figcaption>In Siege</figcaption>{prepared && kit && prepared.id === kit.id && prepared.costume === costume ? <HeroPreview lite={save.settings.lite} assets={prepared.assets} kit={kit} costume={costume || kit.costume} dance={previewDance === 'idle' || canDance(previewDance, kit.emote, shop.owned, prepared.assets.dances) ? previewDance : 'idle'} /> : <span className="siege-character-loading" role="status">Dressing your Chog…</span>}</figure>
            </div>}
            {kit && assets && <label className="siege-dance-select">Try a dance<select aria-label="Preview dance" value={previewDance === 'idle' || canDance(previewDance, kit.emote, shop.owned, assets.dances) ? previewDance : 'idle'} onChange={event => setPreviewDance(event.target.value)}><option value="idle">Idle · On porch duty</option>{Object.entries(assets.dances).filter(([name]) => canDance(name, kit.emote, shop.owned, assets.dances)).map(([name, dance]) => <option value={name} key={name}>{dance.name}{name === kit.emote ? ' · Signature' : ''}</option>)}</select></label>}
            <label className="siege-dance-select">Victory dance<select aria-label="Victory dance" value={victoryDance} onChange={event => persist({ ...save, victoryDance: event.target.value })}>{assets && kit && Object.entries(assets.dances).filter(([name]) => canDance(name, kit.emote, shop.owned, assets.dances)).map(([name, dance]) => <option value={name} key={name}>{dance.name}</option>)}</select></label>
          </div>
          <div><PlaqueInput label="Chog #" value={hero} onChange={setHero} min={1} max={1969} />
            <div className="row"><Sticker onClick={() => setHero(String(Math.floor(menuRandom() * 1969) + 1))}>Random</Sticker>
              {wallet.account && <Sticker tone="gold" disabled={!wallet.ids.length} onClick={() => { const index = wallet.ids.indexOf(Number(hero)); setHero(String(wallet.ids[(index + 1) % wallet.ids.length])) }}>My Chog</Sticker>}
            </div>
            <p>{home ? 'Your own Chog starts one level higher and wears a gold frame.' : 'Borrow any Chog. Its real traits are your perks.'}</p>
            {wallet.account && wallet.loading && <small>Checking your Chogs…</small>}
            {wallet.error && <small>{wallet.error}</small>}
            {kit && assets && <div className="siege-kit">{(['weapon', 'special', 'ultimate', 'passive', 'headgear', 'trinket'] as const).map(slot => {
              const family = kit[slot], info = assets.kits.slots[slot][family], atlas = assets.atlases.find(a => a.key === 'kit')!, frame = atlas.data.frames[`kit/${slot}/${family}`]?.frame
              const legendArt = kit.legend && (slot === 'weapon' || slot === 'special' || slot === 'ultimate') ? { atlas: prepared?.assets.atlases.find(a => a.key === `hero-${kit.costume}`), name: slot === 'weapon' ? 'wpn/proj' : slot === 'special' ? 'special/2' : 'ultimate/3' } : null
              return <div className="siege-kit-row" key={slot}>{legendArt ? <span className="siege-kit-icon" aria-hidden="true"><AtlasSprite atlas={legendArt.atlas} name={legendArt.name} size={64} /></span> : frame ? <span aria-hidden="true" className="siege-kit-icon" style={{ width: frame.w, height: frame.h, backgroundImage: `url(${atlas.image.src})`, backgroundPosition: `-${frame.x}px -${frame.y}px` }} /> : <span className="siege-kit-empty" aria-hidden="true">—</span>}<span><small>{slot}</small><strong>{info.name}</strong><span>{info.effect || 'Travelling light.'}</span></span></div>
            })}<p className="siege-signature">Signature: <b>{assets.kits.slots.emote[kit.emote].name}</b></p></div>}

          </div>
        </div>
        <div className="siege-costumes" aria-label="Hero costume"><span>Wear</span><Sticker aria-pressed={!costume} onClick={() => persist({ ...save, costume: '' })}>Original outfit</Sticker>{SHOP_ITEMS.filter(i => i.kind === 'costume' && shop.owned.includes(i.id)).map(i => <Sticker key={i.id} aria-pressed={costume === i.key} tone={costume === i.key ? 'gold' : 'paper'} onClick={() => persist({ ...save, costume: i.key })}>{i.name}</Sticker>)}<Sticker tone="gold" onClick={() => subMenu('shop')}>Costume shop ↗</Sticker></div>
        {error ? <p role="alert">{error} <Sticker onClick={() => setLoadAttempt(n => n + 1)}>Retry</Sticker></p> : (!assets || !prepared) && <p role="status">Unpacking your hero…</p>}
        <div className="row"><Sticker tone="orange" disabled={starting || !valid || !prepared || prepared.id !== Number(hero)} onClick={() => start()}>{starting ? 'Checking your street…' : 'Let’s make mischief →'}</Sticker><Sticker onClick={() => setMenu('levels')}>← Back</Sticker></div>
        {save.tutorial && level === 1 && <button className="siege-text-button" onClick={() => start(true)} disabled={starting || !valid || !prepared || prepared.id !== Number(hero)}>Play with the tutorial again</button>}
      </>}
      {menu === 'street' && streetRead && <section className="siege-street-card">
        <span className="siege-eyebrow">CHOG #{pendingRun.current?.id} · HOME ON THE STREET</span>
        <h2>Your house on the street gives you:</h2>
        {streetLines(streetRead.bonuses).length ? <ul>{streetLines(streetRead.bonuses).map(row => <li key={row.source}><strong>{row.source}</strong><span>{row.bonus}</span></li>)}</ul> : <p>No house bonuses this time. Stock your bowl, set a trap or join a crew on the street for your next night.</p>}
        <Sticker tone="orange" onClick={() => { if (pendingRun.current) launchRun(pendingRun.current) }}>Defend the porch →</Sticker>
        <button className="siege-text-button" onClick={escape}>← Back</button>
      </section>}
      {menu === 'pause' && <>
        <span className="siege-eyebrow">EVERYONE, FREEZE.</span><h2>Candy break</h2><p>Your jars are safe while you’re here.</p>
        <div className="siege-menu-actions"><Sticker tone="orange" onClick={resume}>Keep playing →</Sticker><Sticker onClick={() => subMenu('settings')}>Settings</Sticker><Sticker onClick={() => subMenu('book')}>Field guide</Sticker><Sticker disabled={starting} onClick={() => void start(run?.tutorial ?? false)}>{starting ? 'Checking your street…' : 'Restart level'}</Sticker><Sticker onClick={leaveLevel}>Level select</Sticker></div>
        <p className="siege-hint">Space: pause · 1 / 2: spells · Q: ability · R: ultimate · Z / X: talents · E: emotes · N: next wave<br />Tap a pad to build. Select your hero, then tap ground to move. Drag traps onto the path.</p>
      </>}
      {menu === 'settings' && <>
        <h2>Set the mood</h2>
        <div className="siege-settings">
          {(['music', 'effects'] as const).map(key => <label key={key}><span>{key === 'music' ? 'Music' : 'Effects'} <b>{Math.round(save.settings[key] * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={save.settings[key]} onChange={event => updateSettings({ ...save.settings, [key]: Number(event.target.value) })} /></label>)}
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.lite} onChange={event => updateSettings({ ...save.settings, lite: event.target.checked })} /><span>Lite mode<small>No ambience, half-size portraits and fewer effects. Restart to resize portraits.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.shake} onChange={event => updateSettings({ ...save.settings, shake: event.target.checked })} /><span>Screen shake<small>Reduced-motion preferences always take priority.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.autoFullscreen} onChange={event => updateSettings({ ...save.settings, autoFullscreen: event.target.checked })} /><span>Full screen on Play<small>On phones, enter full screen and request landscape. On iPhone, show Home Screen steps once.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" disabled={!shop.owned.includes(21)} checked={save.settings.gold && shop.owned.includes(21)} onChange={event => updateSettings({ ...save.settings, gold: event.target.checked })} /><span>Golden towers<small>{shop.owned.includes(21) ? 'Dress all four classic towers in gold.' : 'Available in the $KNOCK shop.'}</small></span></label>
        </div>
        <Sticker tone="orange" onClick={() => setMenu(returnMenu)}>Done</Sticker>
      </>}
      {menu === 'book' && <>
        <span className="siege-eyebrow">THE PORCH KEEPER’S</span><h2 tabIndex={-1} data-initial-focus>Field guide</h2>
        {assets && <FieldGuide assets={run?.assets ?? assets} seen={save.seen} heroId={run?.id ?? (valid ? Number(hero) : 1)} />}
        <h3>How your score adds up</h3><p>100 per Chog stopped + 250 per jar saved + 1,000 per star + 300 per early wave call. On victory, add 10 for each full second remaining from 300 seconds (up to 3,000). Time counts simulated play, excluding pauses and tutorial waiting. Defeats get no time bonus. Your best score is saved for each level.</p><p className="siege-hint">Scores live in this browser; they are not verified leaderboards and never earn $KNOCK.</p><Sticker onClick={() => setMenu(returnMenu)}>← Back</Sticker>
      </>}
      {menu === 'intro' && <>
        {intro.startsWith('boss:') ? assets && <BossCard assets={assets} id={intro.slice(5)} sheet={scene.current?.bossSheet} /> : <>
          <span className="siege-eyebrow">LOOK WHO’S AT THE DOOR</span><h2>{ENEMIES[intro as EnemyKind].name}</h2>{assets && <EnemyPortrait assets={run?.assets ?? assets} kind={intro as EnemyKind} id={scene.current?.enemies.find(enemy => enemy.active && enemy.kind === intro)?.id ?? Number(hero)} />}<p>{ENEMIES[intro as EnemyKind].description}</p>
        </>}
        <Sticker tone="orange" onClick={resume}>{intro.startsWith('boss:') ? 'Bring it on →' : 'Got it. Come on in →'}</Sticker>
      </>}
      {menu === 'result' && outcome && <div className={outcome.won ? 'siege-win' : ''}>
        <span className="siege-eyebrow">{outcome.mode === 'endless' ? 'ENDLESS · TOWN SQUARE' : outcome.mode === 'daily' ? `DAILY #${outcome.daily} · ${NIGHTS[outcome.theme].name.toUpperCase()}` : outcome.won ? 'THE SWEET TASTE OF' : 'THE NEIGHBOURHOOD SAYS THANKS'}</span>
        <h2>{outcome.mode === 'endless' ? `Wave ${outcome.wave}!` : outcome.won ? 'Sweet victory!' : 'They got the candy.'}</h2>
        {outcome.mode !== 'endless' && stars(outcome.stars)}<p>{outcome.mode === 'endless' ? 'You held the porch as long as you could. The waves never stop.' : outcome.won ? `${outcome.jars} jars saved. The porch is yours.` : 'A lantern for ghosts. TP for pumpkins. One more try?'}</p>
        <p className="siege-score"><strong>{outcome.score.toLocaleString()}</strong> points<small>{outcome.mode === 'endless' ? `Best wave: ${save.endless.wave} · best score ${save.endless.score.toLocaleString()}` : outcome.mode === 'daily' && run?.daily ? `Best on Daily #${outcome.daily}: ${(save.daily[run.daily.day] ?? outcome.score).toLocaleString()}` : `Best on ${LEVELS[(run?.level ?? level) - 1].name}: ${(save.scores[run?.level ?? level] ?? outcome.score).toLocaleString()}`}</small></p>
        <div className="siege-result-stats"><span><b>{outcome.kills}</b> Chogs stopped</span><span><b>{outcome.mode === 'endless' ? outcome.wave : `${outcome.wave}/${LEVELS[(run?.level ?? level) - 1].waves.length}`}</b> {outcome.mode === 'endless' ? 'wave reached' : 'waves called'}</span><span><b>{outcome.heroLevel}</b> hero level</span></div>
        <div className="row"><Sticker tone="orange" disabled={starting} onClick={() => void start(false)}>{outcome.won ? 'Another night?' : 'Try again →'}</Sticker><Sticker onClick={leaveLevel}>Level select</Sticker></div>
        {run && <ShareCard assets={run.assets} kit={resolveKit(run.assets.kits, run.assets.traits, run.assets.chogs, run.id, run.home)} costume={run.costume} dance={run.victoryDance} result={outcome} />}
      </div>}
      {menu === 'shop' && assets && <Shop assets={assets} kit={kit ?? resolveKit(assets.kits, assets.traits, assets.chogs, 1)} shop={shop} wallet={wallet} inLevel={!!run} onBack={() => setMenu(returnMenu)} />}
      {menu === 'shop' && !assets && <p role="status">{error || 'Opening the shop…'}{error && <Sticker onClick={() => setLoadAttempt(n => n + 1)}>Retry</Sticker>}</p>}
      {saveWarning && <p className="siege-save-warning" role="status">This browser couldn’t save progress. Your current game is still safe.</p>}
      {onBack && <button className="siege-text-button" onClick={onBack}>← Back to Knock</button>}
    </Modal>}
  </div>
}
