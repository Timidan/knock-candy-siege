import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import Phaser from 'phaser'
import { Sticker, PlaqueInput } from '../ui'
import type { WalletState } from '../wallet'
import { loadAssets, loadAtlas, loadHeroAssets, loadLevelAssets } from './assets'
import type { AssetPack } from './assets'
import { SiegeScene } from './SiegeScene'
import type { Outcome, Mode } from './SiegeScene'
import { Sfx } from './Sfx'
import { readSave, writeSave, reducedMotion } from './data/save'
import type { Save, Settings } from './data/save'
import { NO_STREET, readHolderBonuses, readHomeAdvantage, holderLines } from './street'
import type { StreetRead, StreetBonuses } from './street'
import { ENEMIES, seededRandom } from './data/config'
import { CRUDE_TEXT_CHOGS } from './data/crudeChogs'
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
import { useSiegeWallet } from './guestWallet'
import { WalletChoice } from './WalletChoice'
import { useCandyBank } from './candyBank'
import { holderUrl } from '../chain'
import { reopenShop } from './shopChain'
import { SHOP_ITEMS, canDance } from './data/shop'
import { ShareCard } from './ShareCard'
import { STATS_URL, setStatsEnabled, statsEnabled, track, trackRunEnd } from './telemetry'
import type { RunEnd } from './telemetry'
import './siege.css'

type Run = { id: number; home: boolean; serial: number; level: number; mode: Mode; daily: Daily | null; seed: number; tutorial: boolean; costume: string; owned: number[]; victoryDance: string; assets: AssetPack; street: StreetBonuses; stars: Record<string, number> }
type Menu = 'title' | 'levels' | 'hero' | 'pause' | 'settings' | 'book' | 'result' | 'intro' | 'shop' | 'street' | null
if (import.meta.env.DEV) selfCheck()
track('session') // once per page load: this module is evaluated once
// Random picks never land on a Chog with crude cap or shirt text; those stay playable by number.
const randomHero = (random: () => number) => { let id: number; do id = Math.floor(random() * 1969) + 1; while (CRUDE_TEXT_CHOGS.has(id)); return String(id) }
// Dialogs settle in (siege.css); `closing` plays the exit while the parent waits to remove it. One replacing another keeps its backdrop steady.
function Modal({ children, label, onEscape, className = '', closing = false }: { children: ReactNode; label: string; onEscape: () => void; className?: string; closing?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [swap] = useState(() => !!document.querySelector('dialog.siege-modal[open]'))
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus(); return () => dialog?.close() }, [])
  return <dialog ref={ref} inert={closing} className={`siege-modal board ${className}${swap ? ' siege-modal--swap' : ''}${closing ? ' siege-modal--closing' : ''}`} aria-label={label} onCancel={event => { event.preventDefault(); onEscape() }}>{children}</dialog>
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
const stars = (count: number) => <span className="siege-stars" aria-label={`${count} of 3 stars`}>{[1, 2, 3].map(n => <span key={n} className={n <= count ? 'earned-star' : ''} aria-hidden="true">★</span>)}</span>
// The win fanfare: earned stars start slamming in at these times (ms; siege.css uses the same delays) and land IMPACT ms later.
const SLAMS = [300, 650, 1000], IMPACT = 200
const SHAKE: Keyframe[] = [{ translate: '0 0' }, { translate: '-5px 2px' }, { translate: '4px -2px' }, { translate: '-2px 1px' }, { translate: '0 0' }]
// Three stars rain candy over the card once the last star lands: [left %, extra delay ms, fall seconds, spin degrees].
const CONFETTI = [[6, 0, 1.6, 320], [19, 260, 1.9, -400], [31, 90, 1.5, 260], [44, 380, 2, -300], [56, 30, 1.7, 380], [69, 300, 1.8, -260], [81, 150, 1.55, 340], [94, 420, 1.85, -360], [25, 620, 1.7, 300], [75, 700, 1.9, -340]]
function ResultStars({ count, fx, shake, sfx }: { count: number; fx?: AssetPack['atlases'][number]; shake: boolean; sfx: { current: Sfx | null } }) {
  const ref = useRef<HTMLDivElement>(null)
  // Each star lands with a cue, a little higher each time, scheduled on the audio clock so a busy main thread can't make it late.
  // With reduced motion the stars appear at once, so no cue.
  useEffect(() => {
    if (!reducedMotion()) SLAMS.slice(0, count).forEach((at, i) => sfx.current?.play('star', 1 + i * .12, 1, true, (at + IMPACT) / 1000))
  }, [count, sfx])
  useEffect(() => {
    // `translate` leaves the card's slide-in transform alone.
    const card = ref.current?.closest('dialog')
    if (!card || !shake || reducedMotion()) return
    const moves = SLAMS.slice(0, count).map(at => card.animate(SHAKE, { duration: 240, delay: at + IMPACT }))
    return () => moves.forEach(move => move.cancel())
  }, [count, shake])
  return <div ref={ref}>{stars(count)}{count === 3 && fx && <div className="siege-confetti" aria-hidden="true">{CONFETTI.map(([x, delay, seconds, spin], i) => <i key={i} style={{ left: `${x}%`, animationDelay: `${SLAMS[2] + IMPACT + delay}ms`, animationDuration: `${seconds}s`, '--spin': `${spin}deg` } as CSSProperties}><AtlasSprite atlas={fx} name={`fx/candy-burst/${4 + i % 2}`} size={i % 3 ? 84 : 112} /></i>)}</div>}</div>
}
// The score counts up from 0 and lands with the last star; with ms 0 or reduced motion it shows at once.
function CountUp({ value, ms }: { value: number; ms: number }) {
  const [shown, setShown] = useState(() => ms && !reducedMotion() ? 0 : value)
  useEffect(() => {
    if (!ms || reducedMotion()) return
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ms)
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [value, ms])
  return <strong>{shown.toLocaleString()}</strong>
}
// A defeat names one counter from the existing copy: of the threats called so far, the one stopped least (kills against spawns).
const COUNTERS: [EnemyKind, string][] = [['ghost', 'A lantern for ghosts.'], ['pumpkin', 'TP for pumpkins.']]
function counterTip(result: Outcome, world: SiegeScene) {
  try {
    // Without runStats every share is 0, so the first counter faced wins.
    const kills: Record<string, number> = world.runStats?.().killsByKind ?? {}, spawned: Record<string, number> = {}
    for (let i = 0; i < result.wave; i++) for (const group of world.waveAt(i)?.groups ?? []) spawned[group.type] = (spawned[group.type] ?? 0) + group.count
    let tip = '', least = Infinity
    for (const [kind, line] of COUNTERS) { const share = (kills[kind] ?? 0) / spawned[kind]; if (share < least) { least = share; tip = `${line} ` } }
    return `${tip}One more try?`
  } catch { return 'One more try?' }
}
export default function Siege({ wallet, onBack }: { wallet: WalletState; onBack?: () => void }) {
  const activeWallet = useSiegeWallet(wallet)
  const shop = useShop(activeWallet)
  const bank = useCandyBank(activeWallet.account, shop.refresh)
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
  const [shareStats, setShareStats] = useState(statsEnabled)
  const [menu, setMenu] = useState<Menu>(() => reopenShop() ? 'shop' : 'title')
  const menuNow = useRef(menu); menuNow.current = menu
  const [returnMenu, setReturnMenu] = useState<Menu>('title')
  const [level, setLevel] = useState(1)
  const [menuRandom] = useState(() => seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]))
  const [hero, setHero] = useState(() => randomHero(menuRandom))
  const [run, setRun] = useState<Run | null>(null)
  const [streetRead, setStreetRead] = useState<StreetRead | null>(null)
  const pendingRun = useRef<Run | null>(null), startToken = useRef(0)
  const accountNow = useRef(activeWallet.account); accountNow.current = activeWallet.account
  const [starting, setStarting] = useState(false)
  // The menu where a $CHOG perk read failed: it shows a Retry / Continue note until the menu changes.
  const [perksFailed, setPerksFailed] = useState<Menu>(null)
  useEffect(() => setPerksFailed(null), [menu])
  useEffect(() => { startToken.current++; pendingRun.current = null; setStarting(false); setStreetRead(null); setPerksFailed(null); setMenu(m => m === 'street' ? 'hero' : m) }, [activeWallet.account, activeWallet.sandbox])
  useEffect(() => () => { startToken.current++; clearTimeout(closeTimer.current) }, [])
  const [outcome, setOutcome] = useState<Outcome | null>(null), [defeatTip, setDefeatTip] = useState('')
  const [intro, setIntro] = useState('treater')
  const [icons, setIcons] = useState<AssetPack['atlases'][number]>()
  // The daily challenge: the UTC date picks the level and the night's modifier.
  const daily = dailyInfo(), mapLevel = level === DAILY_LEVEL ? daily.level : level
  const mode: Mode = level === ENDLESS_LEVEL ? 'endless' : level === DAILY_LEVEL ? 'daily' : 'level'
  const levelName = (id: number) => id === DAILY_LEVEL ? `Daily #${daily.number}` : LEVELS[id - 1].name
  const [ready, setReady] = useState(false)
  const valid = /^\d+$/.test(hero) && Number(hero) >= 1 && Number(hero) <= 1969
  const [holder, setHolder] = useState<{ account: string | null; id: number; sandbox: boolean; home: boolean; chog: boolean } | null>(null)
  const [tryingHolder, setTryingHolder] = useState(false), [holderError, setHolderError] = useState('')
  const holderCurrent = holder?.account === activeWallet.account && holder?.id === Number(hero) && holder?.sandbox === activeWallet.sandbox
  const home = valid && holderCurrent && !!holder?.home
  const hasChog = holderCurrent && !!holder?.chog
  const myChogs = activeWallet.sandboxId !== null && activeWallet.sandbox ? [activeWallet.sandboxId] : activeWallet.choice === 'connected' ? wallet.ids : []
  useEffect(() => {
    if (!valid || menu !== 'hero') return
    let active = true
    const account = activeWallet.account, sandbox = activeWallet.sandbox, id = Number(hero)
    void Promise.all([readHomeAdvantage(id, account, sandbox), readHolderBonuses(id, account, sandbox)]).then(([home, perks]) => {
      if (active) setHolder({ account, id, sandbox, home, chog: perks.bonuses.chog })
    })
    return () => { active = false }
  }, [activeWallet.account, activeWallet.sandbox, hero, valid, menu])
  const tryHolder = async () => {
    if (tryingHolder) return
    const guest = activeWallet.useGuest()
    if (!guest) return
    setTryingHolder(true); setHolderError('')
    try {
      const response = await fetch(holderUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: guest.address }), signal: AbortSignal.timeout(20_000) })
      const data = await response.json()
      const id = Number(data.chogId)
      if (!response.ok || !Number.isInteger(id) || id < 1 || id > 1969) throw new Error('Unavailable')
      const [owned, perks] = await Promise.all([readHomeAdvantage(id, guest.address, true), readHolderBonuses(id, guest.address, true)])
      if (!owned || !perks.bonuses.chog) throw new Error('Not ready')
      activeWallet.setSandboxId(id); setHero(String(id))
    } catch { setHolderError('The holder demo is taking a break. You can still choose any hero and play with your guest wallet. Try again later.') }
    finally { setTryingHolder(false) }
  }
  const kit = assets && valid ? resolveKit(assets.kits, assets.traits, assets.chogs, Number(hero), home) : null
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
    // Sfx unlocks itself inside the first gesture and retries anything that failed on later ones.
    const audio = new Sfx(saveRef.current.settings); sfx.current = audio
    return () => { audio.destroy(); sfx.current = null }
  }, [])
  // Music follows the screen: the level theme in a run, the menu theme on menus and the result card. Boss.ts switches to the boss theme.
  const musicTrack = run && menu !== 'result' ? 'level' : 'menu'
  useEffect(() => { sfx.current?.music(musicTrack) }, [musicTrack, run])
  useEffect(() => {
    if (!run || !assets || !host.current || !sfx.current) return
    setReady(false)
    // Stats: run_start once the level is playable; one run_end per run, as a win, a loss or a quit (leaving a loaded run before it ends).
    const info = { level: run.mode === 'level' ? String(run.level) : run.mode, hero: run.id }
    let started = false, finished = false
    const endRun = (end: RunEnd) => { if (started && !finished) { finished = true; trackRunEnd(world, info, end) } }
    const quit = () => endRun({ won: false, quit: true, stars: 0, score: 0, wave: world.wave, seconds: world.clock })
    const world = new SiegeScene({ assets: run.assets, level: run.level, mode: run.mode, daily: run.daily, seed: run.seed, stars: run.stars, street: run.street, seen: saveRef.current.seen, onDiscover: keys => persist({ ...saveRef.current, seen: [...new Set([...saveRef.current.seen, ...keys])] }), hero: run.id, home: run.home, tutorial: run.tutorial, costume: run.costume, owned: run.owned, victoryDance: run.victoryDance, settings: saveRef.current.settings, sfx: sfx.current,
      onShop: () => { setReturnMenu('pause'); setMenu('shop') },
      onFullscreen: canFullscreen ? () => { void fullscreen() } : undefined,
      onPause: () => setMenu('pause'),
      onIntro: kind => { setIntro(kind); setMenu('intro') },
      onTutorial: () => persist({ ...saveRef.current, tutorial: true }),
      onReady: () => { setReady(true); if (!started) { started = true; track('run_start', info) } },
      onEnd: result => {
        endRun({ ...result, quit: false })
        setOutcome(result); setDefeatTip(result.won ? '' : counterTip(result, world)); setMenu('result')
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
    window.addEventListener('pagehide', quit)
    document.addEventListener('visibilitychange', hide)
    return () => { quit(); window.removeEventListener('pagehide', quit); observer.disconnect(); window.removeEventListener('orientationchange', resize); document.removeEventListener('visibilitychange', hide); scene.current = null; game.destroy(true); setReady(false) }
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
  // Closing the last dialog waits for its 120 ms exit; `after` runs once it is gone (the canvas is inert while a modal is open).
  const [closing, setClosing] = useState(false), closeTimer = useRef(0)
  const closeMenu = (after: () => void) => {
    setClosing(true); clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => { flushSync(() => { setClosing(false); setMenu(null) }); after() }, 120)
  }
  const resume = () => closeMenu(() => { scene.current?.setPaused(false); host.current?.querySelector('canvas')?.focus() })
  const leaveLevel = () => { setRun(null); setPrepared(null); setOutcome(null); setMenu('levels'); sfx.current?.pause(false) }
  // A story win with a playable level after it leads on to that night's hero picker, keeping the hero and costume.
  const nextLevel = outcome?.won && run?.mode === 'level' && LEVELS[run.level]?.waves.length ? run.level + 1 : 0
  const nextNight = () => { if (!run) return; const id = run.id; leaveLevel(); setLevel(nextLevel); setHero(String(id)); setMenu('hero') }
  const launchRun = (next: Run) => {
    closeMenu(() => { setRun(next); pendingRun.current = null; setStreetRead(null); setOutcome(null) })
    void sfx.current?.unlock(); sfx.current?.pause(false)
  }
  const start = async (tutorial = level === 1 && !save.tutorial) => {
    if (starting) return
    setPerksFailed(null)
    let next: Run
    if (run && menu !== 'hero') next = { ...run, serial: Date.now(), tutorial, owned: shop.owned, stars: saveRef.current.stars, street: NO_STREET, assets: scene.current?.options.assets ?? run.assets }
    else {
      if (!valid || !prepared || prepared.id !== Number(hero) || prepared.home !== home || prepared.costume !== costume) return
      next = { id: Number(hero), home, level: mapLevel, mode, daily: mode === 'daily' ? daily : null, seed: mode === 'daily' ? daily.seed : crypto.getRandomValues(new Uint32Array(1))[0], serial: Date.now(), tutorial, costume, owned: shop.owned, victoryDance, assets: prepared.assets, street: NO_STREET, stars: saveRef.current.stars }
    }
    mobileFullscreen(); setStarting(true)
    const token = ++startToken.current, account = activeWallet.account, fromMenu = menu
    const [result, ownedHero] = await Promise.all([readHolderBonuses(next.id, account, activeWallet.sandbox), readHomeAdvantage(next.id, account, activeWallet.sandbox)])
    if (token !== startToken.current || accountNow.current !== account) return
    setStarting(false)
    if (menuNow.current !== fromMenu) return
    // "Could not check" is not "no perks": ask before starting without them.
    if (result.status === 'unavailable') { pendingRun.current = { ...next, home: ownedHero }; setPerksFailed(fromMenu); return }
    if (!result.bonuses.chog) { launchRun({ ...next, home: ownedHero }); return }
    pendingRun.current = { ...next, home: ownedHero, street: result.bonuses }
    setStreetRead(result); setMenu('street')
  }
  const subMenu = (next: Menu) => { setReturnMenu(menu); setMenu(next) }
  const escape = () => {
    if (closing) return
    if (menu === 'settings' || menu === 'book' || menu === 'shop') setMenu(returnMenu)
    else if (menu === 'pause' || menu === 'intro') resume()
    else if (menu === 'street') { startToken.current++; pendingRun.current = null; setStreetRead(null); setMenu(run ? 'pause' : 'hero') }
    else if (menu === 'hero') setMenu('levels')
    else if (menu === 'levels') setMenu('title')
    else if (menu === 'result') leaveLevel()
  }
  return <div ref={shell} className={`siege-shell ${run ? 'siege-shell--playing' : ''}`}>
    <div className="siege-stage" ref={host} />
    {run && !menu && activeWallet.sandbox && <aside style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', maxWidth: '36%', padding: '4px 10px', borderRadius: 6, background: '#241632e6', color: '#fff1b3', fontSize: 13, textAlign: 'center', pointerEvents: 'none' }}>Sandbox: a demo copy of Monad, nothing is real</aside>}
    <div className="siege-safe-area" aria-hidden="true" />
    {!run && <div className="siege-night" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(#24163233, #24163277), url(/siege/levels/level1.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>}
    {onBack && <div className="siege-back"><Sticker onClick={onBack}>← Knock</Sticker></div>}
    <div className="siege-rotate bubble">Turn your phone sideways for the best view</div>
    {run && !ready && <div className="siege-loading" role="status">Lighting the lanterns…</div>}
    {menu && <Modal key={menu} closing={closing} label={menu === 'intro' ? 'New enemy' : menu === 'street' ? 'Your $CHOG perks' : `Candy Siege ${menu}`} onEscape={escape} className={menu === 'result' ? 'siege-modal--result' : menu === 'shop' ? 'siege-modal--shop' : menu === 'hero' ? 'siege-modal--hero' : menu === 'title' ? 'siege-modal--title' : ''}>
      {installTip && <aside className="siege-install-tip" aria-label="Play full screen on iPhone">
        <strong>Add Knock to your Home Screen to play full screen</strong>
        <p>In Safari, tap Share (the square with an arrow). Scroll down and tap “Add to Home Screen”, then “Add”. Open Knock from its new icon.</p>
        <button className="siege-text-button" onClick={() => setInstallTip(false)}>Got it</button>
      </aside>}
      {displayNotice && <p role="status">{displayNotice}</p>}
      {perksFailed === menu && pendingRun.current && <p className="siege-perks-failed" role="alert">Couldn’t check your $CHOG perks.<Sticker disabled={starting} onClick={() => void start(pendingRun.current?.tutorial)}>Retry</Sticker><Sticker tone="orange" onClick={() => { const next = pendingRun.current; setPerksFailed(null); if (next) launchRun(next) }}>Continue</Sticker></p>}
      {menu === 'title' && <div className="siege-title">
        {/* Tonight's hero, the same Chog the hero picker opens on. */}
        {valid && <figure className="siege-title-chog"><img src={`/chogs-256/${Number(hero)}.webp`} alt="" /><figcaption>Chog #{Number(hero)} · on porch duty</figcaption></figure>}
        <div className="siege-title-card board">
          <img className="siege-wordmark" src="/art/ui/logo.svg" alt="Knock" />
          <span className="siege-eyebrow">A LITTLE MISCHIEF. A LOT OF CANDY.</span>
          <h1>Candy<br /><span>Siege</span><i aria-hidden="true">✦</i></h1>
          <p>The whole neighbourhood wants your candy.<br />Give them a Halloween to remember.</p>
          <Sticker tone="orange" className="siege-title-play" onClick={() => { mobileFullscreen(); setMenu('levels') }}>Hold the porch →</Sticker>
          <div className="row"><Sticker tone="gold" onClick={() => subMenu('shop')}>Shop · $KNOCK</Sticker><Sticker onClick={() => subMenu('book')}>Field guide</Sticker><Sticker onClick={() => subMenu('settings')}>Settings</Sticker></div>
          <small>20 jars. Your Chog. One very long night.</small>
          <div className="siege-title-links">
            {bank.enabled && (!activeWallet.account || bank.claim?.state === 'none') && <button className="siege-text-button" onClick={() => subMenu('shop')}>Starter grant · 300 $KNOCK available</button>}
            {STATS_URL && <a className="siege-text-button" href="/stats" style={{ width: 'fit-content', lineHeight: '44px' }}>Live stats</a>}
          </div>
        </div>
      </div>}
      {menu === 'levels' && <>
        <span className="siege-eyebrow">CHOG TOWN · AFTER DARK</span><h2>Pick your porch</h2>
        <div className="siege-levels">{LEVELS.map((item, index) => { const playable = item.waves.length > 0 || !!item.endless, best = item.endless ? save.endless.wave : save.stars[item.id] ?? 0, boss = item.waves.map(wave => wave.boss?.id).filter(id => typeof id === 'number').pop(); return <Sticker key={item.id} aria-label={`${item.endless ? 'Endless mode' : item.name}, ${playable ? item.endless ? `best wave ${best}` : `${best} stars${item.id === 1 ? ', Start here' : ''}` : 'Coming soon'}`} tone={item.endless ? 'orange' : playable ? 'gold' : 'paper'} className="siege-level" disabled={!playable} onClick={() => { setLevel(item.id); setMenu('hero') }}>
          <span className="siege-level-map" style={{ backgroundImage: `url(/siege/levels/${mapFile(item.id)}.webp)` }}>{boss && <img src={`/chogs-256/${boss}.webp`} alt="" />}</span><strong>{item.endless ? '∞' : String(index + 1).padStart(2, '0')}</strong><span>{item.endless ? 'Endless · Town Square' : item.name}</span>{item.endless ? <small>{save.endless.wave ? `Best: wave ${save.endless.wave}` : 'Waves never stop'}</small> : stars(best)}{item.id === 1 && <small className="siege-start-here">Start here</small>}{!playable && <small>Coming soon</small>}
        </Sticker> })}
          <Sticker aria-label={`Daily challenge number ${daily.number}: ${LEVELS[daily.level - 1].name}, ${NIGHTS[daily.theme].name}`} tone="gold" className="siege-level siege-daily" onClick={() => { setLevel(DAILY_LEVEL); setMenu('hero') }}>
            <span className="siege-level-map" style={{ backgroundImage: `url(/siege/levels/level${daily.level}.webp)` }} /><strong>{icons ? <AtlasSprite atlas={icons} name={NIGHTS[daily.theme].icon} size={46} /> : '☾'}</strong><span>Daily #{daily.number}</span><small>{LEVELS[daily.level - 1].name} · {NIGHTS[daily.theme].name}</small><small>{save.daily[daily.day] ? `Best today: ${save.daily[daily.day].toLocaleString()}` : NIGHTS[daily.theme].text}</small>
          </Sticker>
        </div>
        <p className="siege-hint">3 stars: 18–20 jars · 2 stars: 10–17 · 1 star: 1–9</p>
        <Sticker onClick={() => setMenu('title')}>← Back</Sticker>
      </>}
      {menu === 'hero' && <>
        <span className="siege-eyebrow">{level === DAILY_LEVEL ? `${levelName(level).toUpperCase()} · ${LEVELS[daily.level - 1].name.toUpperCase()} · ${NIGHTS[daily.theme].name.toUpperCase()}` : level === ENDLESS_LEVEL ? 'ENDLESS · TOWN SQUARE' : `${levelName(level).toUpperCase()} · LEVEL ${level}`}</span><h2>Who’s on porch duty?</h2>
        <WalletChoice wallet={activeWallet} disabled={starting || tryingHolder || shop.busy} />
        <div className="siege-hero-pick">
          <div className={`siege-portrait ${home ? 'siege-portrait--home' : ''} ${kit?.legend ? 'siege-portrait--legend' : ''}`}>
            {!valid && <span>?</span>}
            {kit?.legend && <b className="siege-legendary">★ LEGENDARY ★</b>}
            <b>{home ? 'HOME ADVANTAGE' : 'GUEST HERO'}</b>
            {valid && <div className="siege-chog-comparison">
              <figure className="siege-nft"><figcaption>{home ? "Your Chog" : "Chog portrait"}</figcaption><img key={hero} src={`/chogs-256/${Number(hero)}.webp`} alt={`Original portrait of Chog #${Number(hero)}`} /><small>Chog #{Number(hero)}</small></figure>
              <figure className="siege-in-game"><figcaption>In Siege</figcaption>{prepared && kit && prepared.id === kit.id && prepared.costume === costume ? <HeroPreview lite={save.settings.lite} assets={prepared.assets} kit={kit} costume={costume || kit.costume} dance={previewDance === 'idle' || canDance(previewDance, kit.emote, shop.owned, prepared.assets.dances) ? previewDance : 'idle'} /> : <span className="siege-character-loading" role="status">Dressing your Chog…</span>}</figure>
            </div>}
            {kit && assets && <label className="siege-dance-select">Try a dance<select aria-label="Preview dance" value={previewDance === 'idle' || canDance(previewDance, kit.emote, shop.owned, assets.dances) ? previewDance : 'idle'} onChange={event => setPreviewDance(event.target.value)}><option value="idle">Idle · On porch duty</option>{Object.entries(assets.dances).filter(([name]) => canDance(name, kit.emote, shop.owned, assets.dances)).map(([name, dance]) => <option value={name} key={name}>{dance.name}{name === kit.emote ? ' · Signature' : ''}</option>)}</select></label>}
            <label className="siege-dance-select">Victory dance<select aria-label="Victory dance" value={victoryDance} onChange={event => persist({ ...save, victoryDance: event.target.value })}>{assets && kit && Object.entries(assets.dances).filter(([name]) => canDance(name, kit.emote, shop.owned, assets.dances)).map(([name, dance]) => <option value={name} key={name}>{dance.name}</option>)}</select></label>
          </div>
          {/* The start button sits right under the Chog choice so a landscape phone never scrolls to play. */}
          <div className="siege-hero-side">
            <div className="row"><PlaqueInput label="Chog #" value={hero} onChange={setHero} min={1} max={1969} /><Sticker onClick={() => setHero(randomHero(menuRandom))}>Random</Sticker>
              {activeWallet.account && <Sticker tone="gold" disabled={!myChogs.length} onClick={() => { const index = myChogs.indexOf(Number(hero)); setHero(String(myChogs[(index + 1) % myChogs.length])) }}>My Chog</Sticker>}
              <Sticker tone="gold" disabled={tryingHolder || starting || shop.busy} onClick={() => void tryHolder()}>{tryingHolder ? 'Preparing holder demo…' : 'Try as a holder'}</Sticker>{hasChog && <strong className="siege-shop-note">$CHOG holder</strong>}
            </div>
            {holderError && <p role="status">{holderError}</p>}
            {error ? <p role="alert">{error} <Sticker onClick={() => setLoadAttempt(n => n + 1)}>Retry</Sticker></p> : (!assets || !prepared) && <p role="status">Unpacking your hero…</p>}
            <div className="row"><Sticker tone="orange" disabled={starting || tryingHolder || !valid || !prepared || prepared.id !== Number(hero)} onClick={() => start()}>{starting ? 'Checking your $CHOG perks…' : 'Let’s make mischief →'}</Sticker><Sticker onClick={() => setMenu('levels')}>← Back</Sticker></div>
            {save.tutorial && level === 1 && <button className="siege-text-button" onClick={() => start(true)} disabled={starting || tryingHolder || !valid || !prepared || prepared.id !== Number(hero)}>Play with the tutorial again</button>}
            <p>{home ? 'Home advantage: your own Chog starts one level higher and wears a gold frame.' : 'Borrow any Chog. Its real traits are your perks.'}</p>
            {activeWallet.choice === 'connected' && wallet.account && wallet.loading && <small>Checking your Chogs…</small>}
            {kit && assets && <div className="siege-kit">{(['weapon', 'special', 'ultimate', 'passive', 'headgear', 'trinket'] as const).map(slot => {
              const family = kit[slot], info = assets.kits.slots[slot][family], atlas = assets.atlases.find(a => a.key === 'kit')!, frame = atlas.data.frames[`kit/${slot}/${family}`]?.frame
              const legendArt = kit.legend && (slot === 'weapon' || slot === 'special' || slot === 'ultimate') ? { atlas: prepared?.assets.atlases.find(a => a.key === `hero-${kit.costume}`), name: slot === 'weapon' ? 'wpn/proj' : slot === 'special' ? 'special/2' : 'ultimate/3' } : null
              return <div className="siege-kit-row" key={slot}>{legendArt ? <span className="siege-kit-icon" aria-hidden="true"><AtlasSprite atlas={legendArt.atlas} name={legendArt.name} size={64} /></span> : frame ? <span aria-hidden="true" className="siege-kit-icon" style={{ width: frame.w, height: frame.h, backgroundImage: `url(${atlas.image.src})`, backgroundPosition: `-${frame.x}px -${frame.y}px` }} /> : <span className="siege-kit-empty" aria-hidden="true">—</span>}<span><small>{slot}</small><strong>{info.name}</strong><span>{info.effect || 'Travelling light.'}</span></span></div>
            })}<p className="siege-signature">Signature: <b>{assets.kits.slots.emote[kit.emote].name}</b></p></div>}

          </div>
        </div>
        <div className="siege-costumes" aria-label="Hero costume"><span>Wear</span><Sticker aria-pressed={!costume} onClick={() => persist({ ...save, costume: '' })}>Original outfit</Sticker>{SHOP_ITEMS.filter(i => i.kind === 'costume' && shop.owned.includes(i.id)).map(i => <Sticker key={i.id} aria-pressed={costume === i.key} tone={costume === i.key ? 'gold' : 'paper'} onClick={() => persist({ ...save, costume: i.key })}>{i.name}</Sticker>)}<Sticker tone="gold" onClick={() => subMenu('shop')}>Costume shop ↗</Sticker></div>
      </>}
      {menu === 'street' && streetRead && <section className="siege-street-card">
        <span className="siege-eyebrow">CHOG #{pendingRun.current?.id} · A SWEETER NIGHT</span>
        <h2>Your $CHOG perks</h2>
        {holderLines(streetRead.bonuses).length ? <ul>{holderLines(streetRead.bonuses).map(row => <li key={row.source}><strong>{row.source}</strong><span>{row.bonus}</span></li>)}</ul> : <p>No holder perks this time. Every Chog can still defend the porch.</p>}
        {pendingRun.current?.home && <p><strong>Home advantage</strong> · Your own Chog starts one level higher and wears a gold frame.</p>}
        {activeWallet.sandbox && <p><strong>Sandbox: a demo copy of Monad, nothing is real</strong></p>}
        <Sticker tone="orange" onClick={() => { if (pendingRun.current) launchRun(pendingRun.current) }}>Defend the porch →</Sticker>
        <button className="siege-text-button" onClick={escape}>← Back</button>
      </section>}
      {menu === 'pause' && <>
        <span className="siege-eyebrow">EVERYONE, FREEZE.</span><h2>Candy break</h2><p>Your jars are safe while you’re here.</p>
        <div className="siege-menu-actions"><Sticker tone="orange" onClick={resume}>Keep playing →</Sticker><Sticker onClick={() => subMenu('settings')}>Settings</Sticker><Sticker onClick={() => subMenu('book')}>Field guide</Sticker><Sticker disabled={starting} onClick={() => void start(run?.tutorial ?? false)}>{starting ? 'Checking your $CHOG perks…' : 'Restart level'}</Sticker><Sticker onClick={leaveLevel}>Level select</Sticker></div>
        <p className="siege-hint"><span className="siege-keys">Space: pause · 1 / 2: spells · Q: ability · R: ultimate · Z / X: talents · E: emotes · N: next wave<br /></span>Tap a pad to build. Select your hero, then tap ground to move. Drag traps onto the path.</p>
      </>}
      {menu === 'settings' && <>
        <h2>Set the mood</h2>
        <div className="siege-settings">
          {(['music', 'effects'] as const).map(key => <label key={key}><span>{key === 'music' ? 'Music' : 'Effects'} <b>{Math.round(save.settings[key] * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={save.settings[key]} onChange={event => updateSettings({ ...save.settings, [key]: Number(event.target.value) })} /></label>)}
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.lite} onChange={event => updateSettings({ ...save.settings, lite: event.target.checked })} /><span>Lite mode<small>No ambience, half-size portraits and fewer effects. Restart to resize portraits.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.shake} onChange={event => updateSettings({ ...save.settings, shake: event.target.checked })} /><span>Screen shake<small>Reduced-motion preferences always take priority.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.autoFullscreen} onChange={event => updateSettings({ ...save.settings, autoFullscreen: event.target.checked })} /><span>Full screen on Play<small>On phones, enter full screen and request landscape. On iPhone, show Home Screen steps once.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" disabled={!shop.owned.includes(21)} checked={save.settings.gold && shop.owned.includes(21)} onChange={event => updateSettings({ ...save.settings, gold: event.target.checked })} /><span>Golden towers<small>{shop.owned.includes(21) ? 'Dress all four classic towers in gold.' : 'Available in the $KNOCK shop.'}</small></span></label>
          {STATS_URL && <label className="siege-toggle"><input type="checkbox" checked={shareStats} onChange={event => { setStatsEnabled(event.target.checked); setShareStats(event.target.checked) }} /><span>Share anonymous play stats<small>Your runs count toward the public live stats. A random id per browser. No wallet or IP address is stored; a salted IP hash is kept for one day only to stop spam.</small></span></label>}
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
        {outcome.mode !== 'endless' && (outcome.won ? <ResultStars count={outcome.stars} fx={(run?.assets ?? assets)?.atlases.find(a => a.key === 'fx')} shake={save.settings.shake} sfx={sfx} /> : stars(0))}<p>{outcome.mode === 'endless' ? 'You held the porch as long as you could. The waves never stop.' : outcome.won ? `${outcome.jars} jars saved. The porch is yours.` : defeatTip}</p>
        <p className="siege-score"><CountUp value={outcome.score} ms={outcome.won && outcome.stars ? SLAMS[outcome.stars - 1] + IMPACT : 0} /> points<small>{outcome.mode === 'endless' ? `Best wave: ${save.endless.wave} · best score ${save.endless.score.toLocaleString()}` : outcome.mode === 'daily' && run?.daily ? `Best on Daily #${outcome.daily}: ${(save.daily[run.daily.day] ?? outcome.score).toLocaleString()}` : `Best on ${LEVELS[(run?.level ?? level) - 1].name}: ${(save.scores[run?.level ?? level] ?? outcome.score).toLocaleString()}`}</small></p>
        <div className="siege-result-stats"><span><b>{outcome.kills}</b> Chogs stopped</span><span><b>{outcome.mode === 'endless' ? outcome.wave : `${outcome.wave}/${LEVELS[(run?.level ?? level) - 1].waves.length}`}</b> {outcome.mode === 'endless' ? 'wave reached' : 'waves called'}</span><span><b>{outcome.heroLevel}</b> hero level</span></div>
        <div className="row">{nextLevel ? <><Sticker tone="orange" disabled={starting} onClick={nextNight}>Next night →</Sticker><Sticker disabled={starting} onClick={() => void start(false)}>Play again</Sticker></> : <Sticker tone="orange" disabled={starting} onClick={() => void start(false)}>{outcome.won ? 'Another night?' : 'Try again →'}</Sticker>}<Sticker onClick={leaveLevel}>Level select</Sticker></div>
        {run && <ShareCard assets={run.assets} kit={resolveKit(run.assets.kits, run.assets.traits, run.assets.chogs, run.id, run.home)} costume={run.costume} dance={run.victoryDance} result={outcome} />}
      </div>}
      {menu === 'shop' && assets && <Shop assets={assets} kit={kit ?? resolveKit(assets.kits, assets.traits, assets.chogs, 1)} shop={shop} wallet={activeWallet} bank={bank} inLevel={!!run} onBack={() => setMenu(returnMenu)} />}
      {menu === 'shop' && !assets && <p role="status">{error || 'Opening the shop…'}{error && <Sticker onClick={() => setLoadAttempt(n => n + 1)}>Retry</Sticker>}</p>}
      {saveWarning && <p className="siege-save-warning" role="status">This browser couldn’t save progress. Your current game is still safe.</p>}
      {onBack && <button className="siege-text-button" onClick={onBack}>← Back to Knock</button>}
    </Modal>}
  </div>
}
