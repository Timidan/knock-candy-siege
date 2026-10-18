import { createRoom, RoomClient } from './net/RoomClient'
import type { CoopSession } from './net/session'
import type { HeroSelection, Roster } from './net/protocol'
import { prepareParty } from './net/prepare'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import Phaser from 'phaser'
import { Sticker, PlaqueInput, setUiSound, playUi } from '../ui'
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
import { holderUrl, CANDY_TOKEN } from '../chain'
import { timeoutSignal } from '../abort'
import { thumb } from '../images'
import { reopenShop } from './shopChain'
import { SHOP_ITEMS, canDance } from './data/shop'
import { ShareCard, readChallenge } from './ShareCard'
import type { Challenge } from './ShareCard'
import { Feedback } from './Feedback'
import { haptic, setHaptics } from './haptics'
import { STATS_URL, setStatsEnabled, statsEnabled, track, trackRunEnd } from './telemetry'
import type { RunEnd } from './telemetry'
import './siege.css'

declare const __COOP_BUILD__: string
const COOP_RELAY = import.meta.env.VITE_COOP_RELAY || 'https://knock-coop.timidan-knock.workers.dev'

// rival: the friend's challenge this run answers (from the title's banner), for the result card's comparison.
type Run = { coop?: CoopSession; id: number; home: boolean; serial: number; level: number; mode: Mode; daily: Daily | null; seed: number; tutorial: boolean; costume: string; owned: number[]; victoryDance: string; assets: AssetPack; street: StreetBonuses; stars: Record<string, number>; rival?: Challenge }
type Menu = 'title' | 'levels' | 'hero' | 'pause' | 'settings' | 'book' | 'result' | 'intro' | 'shop' | 'street' | 'party' | 'party-error' | 'party-leave' | null
if (import.meta.env.DEV) selfCheck()
track('session') // once per page load: this module is evaluated once
// Random picks never land on a Chog with crude cap or shirt text; those stay playable by number.
const randomHero = (random: () => number) => { let id: number; do id = Math.floor(random() * 1969) + 1; while (CRUDE_TEXT_CHOGS.has(id)); return String(id) }
// Dialogs settle in (siege.css); `closing` plays the exit while the parent waits to remove it. One replacing another keeps its backdrop steady.
// A dialog opening fresh (pause, a new enemy, the in-level shop) plays the open cue; one replacing another came from a tap, which has its own cue.
// quiet: the result card, which has its fanfare. Buttons and links that aren't stickers click here, after any cue of their own (which wins).
// closable: a close button pinned to the top corner does what Escape does, so a card taller than a phone never needs scrolling to leave.
function Modal({ children, label, onEscape, className = '', closing = false, quiet = false, closable = true }: { children: ReactNode; label: string; onEscape: () => void; className?: string; closing?: boolean; quiet?: boolean; closable?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [swap] = useState(() => !!document.querySelector('dialog.siege-modal[open]'))
  // Opening focus (the first button, or [data-initial-focus]) must not scroll: a card taller than a landscape phone (the boss card, the Porch Party lobby) opens at its top.
  // The close button is skipped, so Enter on a fresh dialog never closes it.
  useEffect(() => {
    const dialog = ref.current; dialog?.showModal()
    const first = dialog?.querySelector<HTMLElement>('[data-initial-focus]') ?? dialog?.querySelector<HTMLElement>('button:not(.siege-modal-close):not([disabled]), a[href], input:not([disabled]), select, textarea')
    first?.focus({ preventScroll: true })
    if (dialog) dialog.scrollTop = 0; if (!swap && !quiet && !document.hidden) playUi('ui-open'); return () => dialog?.close()
  }, [])
  return <dialog ref={ref} inert={closing} className={`siege-modal board ${className}${swap ? ' siege-modal--swap' : ''}${closing ? ' siege-modal--closing' : ''}`} aria-label={label} onCancel={event => { event.preventDefault(); onEscape() }} onClick={event => { if ((event.target as Element).closest('button:not(.sticker), a')) playUi('ui-click') }}>
    {closable && <div className="siege-modal-close-anchor"><button type="button" className="siege-modal-close" aria-label="Close" tabIndex={-1} onClick={onEscape}>×</button></div>}
    {children}
  </dialog>
}
function EnemyPortrait({ assets, kind, id }: { assets: AssetPack; kind: EnemyKind; id: number }) {
  const atlas = assets.atlases.find(a => a.data.frames[`enemy/${kind}/walk/0`]), frame = atlas?.data.frames[`enemy/${kind}/walk/0`]?.frame
  const anchor = assets.faces[kind] ?? { x: 64, y: 52, r: 27 }
  if (!atlas || !frame) return <div className={`siege-enemy-token siege-enemy-token--${kind}`} aria-hidden="true">{kind === 'ghost' ? '☁' : kind === 'pumpkin' ? '◉' : kind === 'bat' ? '⌁' : '✦'}</div>
  return <div className="siege-intro-body" aria-hidden="true" style={{ width: frame.w, height: frame.h, backgroundImage: `url(${atlas.image.src})`, backgroundPosition: `-${frame.x}px -${frame.y}px` }}><img src={thumb(id, true)} alt="" style={{ left: anchor.x - anchor.r, top: anchor.y - anchor.r, width: anchor.r * 2, height: anchor.r * 2 }} onError={event => { event.currentTarget.hidden = true }} /></div>
}
// The first meeting with a legend (or the Great Pumpkin) gets a card of its own.
function BossCard({ assets, id, sheet }: { assets: AssetPack; id: string; sheet?: AssetPack['atlases'][number] }) {
  const legend = assets.legends.legends[id], pumpkin = id === 'pumpkin'
  return <>
    <span className="siege-eyebrow">{pumpkin ? 'THE FINAL BOSS' : 'A LEGEND AT THE DOOR'}</span><h2 tabIndex={-1} data-initial-focus>{pumpkin ? assets.legends.greatPumpkin.name : legend?.name}</h2>
    {pumpkin ? <div className="siege-boss-art">{sheet ? <AtlasSprite atlas={sheet} name="boss/pumpkin/walk/2" size={210} /> : <span>◉</span>}</div> : <div className="siege-boss-art siege-boss-art--legend"><img src={thumb(id, true)} alt="" /></div>}
    {pumpkin ? <ul className="siege-boss-moves">{assets.legends.greatPumpkin.phases.map(phase => <li key={phase}>{phase}</li>)}</ul> : legend && <p><b>{legend.boss.move}.</b> {legend.boss.effect[0].toUpperCase() + legend.boss.effect.slice(1)}.</p>}
    <p className="siege-hint">{pumpkin ? 'Magic and splash work best. Guards get flattened.' : 'It enters with a flourish, casts on a timer, and gets angrier at half health.'}</p>
  </>
}
// Launch stages in order: the base pack, the hero's art, the level's map and art, then the scene. Each has a loading label and a failure line.
type Stage = 'candy' | 'hero' | 'street' | 'lanterns'
const STAGES: Record<Stage, [string, string]> = {
  candy: ['Unpacking the candy…', 'The game art didn’t load.'],
  hero: ['Packing your hero…', 'Your hero’s art didn’t load.'],
  street: ['Opening the street…', 'This street’s map didn’t load.'],
  lanterns: ['Lighting the lanterns…', 'The level didn’t start.'],
}
const canVibrate = typeof navigator.vibrate === 'function'
const StageLabel = ({ stage }: { stage: Stage }) => <p className="siege-stage-label" role="status"><span className="boot-candy" aria-hidden="true" />{STAGES[stage][0]}</p>
// Every launch failure lands in this one panel, which retries only the stage that failed.
function RetryPanel({ stage, onRetry, children }: { stage: Stage; onRetry: () => void; children?: ReactNode }) {
  return <p className="siege-retry" role="alert">{STAGES[stage][1]} Check your connection and try again.<Sticker tone="orange" onClick={onRetry}>Retry</Sticker>{children}</p>
}
const stars = (count: number) => <span className="siege-stars" aria-label={`${count} of 3 stars`}>{[1, 2, 3].map(n => <span key={n} className={n <= count ? 'earned-star' : ''} aria-hidden="true">★</span>)}</span>
// A story win with at least UNLOCK_STARS opens only the next night; Night 01 also opens Daily and Endless.
// Keep previously played nights available, including saves from when every night was open.
const UNLOCK_STARS = 2
// The level select's id for a run's night: the Daily and Endless have their own.
const nightOf = (run: Run) => run.mode === 'endless' ? ENDLESS_LEVEL : run.mode === 'daily' ? DAILY_LEVEL : run.level
const isOpen = (save: Save, id: number) => id === ENDLESS_LEVEL ? save.stars[1] >= UNLOCK_STARS || save.endless.wave > 0 : id === DAILY_LEVEL ? save.stars[1] >= UNLOCK_STARS || Object.keys(save.daily).length > 0 : !!LEVELS[id - 1] && (id === 1 || save.stars[id - 1] >= UNLOCK_STARS || save.stars[id] > 0 || id in save.scores)
// The night to beat first: the one before, or Rosie Row for Endless and the Daily.
const unlockHint = (id: number) => `Win ${LEVELS[id === ENDLESS_LEVEL || id === DAILY_LEVEL ? 0 : id - 2].name} with ${UNLOCK_STARS}★ to unlock`
// A locked tablet's map shows at about 45% under this wash of the card's own colour, with the padlock on top at full strength.
const DIM = 'linear-gradient(#25183a8c, #25183a8c), '
const PADLOCK = <svg viewBox="0 0 24 28" width="30" height="35" aria-hidden="true"><path d="M6.5 13V9a5.5 5.5 0 0 1 11 0v4" fill="none" stroke="#141414" strokeWidth="6" /><path d="M6.5 13V9a5.5 5.5 0 0 1 11 0v4" fill="none" stroke="#f4eedd" strokeWidth="2.4" /><rect x="2.5" y="12" width="19" height="14" rx="3" fill="#ffc800" stroke="#141414" strokeWidth="2.2" /><circle cx="12" cy="18" r="2.2" fill="#141414" /><path d="M12 19v4" stroke="#141414" strokeWidth="2.2" strokeLinecap="round" /></svg>
// The title's Settings cog, inked like the /art/icons set: an ink rim under cream teeth (dashes on a ring), then the hub.
const GEAR = <svg viewBox="-12 -12 24 24" width="28" height="28" aria-hidden="true"><circle r="8.4" fill="none" stroke="#141414" strokeWidth="6.6" strokeDasharray="4.6 1.997" strokeDashoffset=".6" /><circle r="8.4" fill="none" stroke="#f4eedd" strokeWidth="4.6" strokeDasharray="3.4 3.197" /><circle r="6.6" fill="#f4eedd" stroke="#141414" strokeWidth="2" /><circle r="2.4" fill="#836ef9" stroke="#141414" strokeWidth="1.6" /></svg>
// The title's "Powered by" strip: [name, link, file in /art/partners, logo height px, light plate]. Each logo sits on its brand's own ground (siege.css).
const POWERED: [string, string, string, number, boolean][] = [
  ['Chog', 'https://www.chog.xyz', 'chog.png', 28, true],
  ['Monad', 'https://www.monad.xyz', 'monad.svg', 20, true],
  ['vibe/vibe', `https://testnet.vibevibe.fun/token/${CANDY_TOKEN}`, 'vibevibe.svg', 30, false],
  ['Robinhood Chain', 'https://docs.robinhood.com/chain/connecting/', 'robinhood-chain.svg', 20, false],
]
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
    return () => sfx.current?.stop('star')
  }, [count, sfx])
  // The final star's impact also buzzes when Vibration is on; haptics.ts checks the other gates.
  useEffect(() => { if (!count) return; const timer = setTimeout(() => haptic('star'), SLAMS[count - 1] + IMPACT); return () => clearTimeout(timer) }, [count])
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
// The title's Chog of the Day card: its portrait, its kit in a few words, and one tap to play it (Night 1 on a first visit, else the hero picker).
function ChogOfDay({ id, assets, onPlay }: { id: number; assets: AssetPack | null; onPlay: () => void }) {
  const kit = assets && resolveKit(assets.kits, assets.traits, assets.chogs, id)
  return <section className="siege-cotd" aria-label={`Chog of the Day: Chog #${id}`}>
    <img src={thumb(id, true)} alt="" /><strong>Chog of the Day #{id}</strong>
    {kit && <small>{(['weapon', 'special', 'ultimate'] as const).map(slot => assets.kits.slots[slot][kit[slot]]?.name).filter(Boolean).join(' · ')}</small>}
    <Sticker tone="gold" sound="ui-confirm" onClick={onPlay}>Play as #{id}</Sticker>
  </section>
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
  // The launch stage that failed (RetryPanel), and the stage the hero picker is still waiting on.
  const [failed, setFailed] = useState<Stage | null>(null)
  const [loading, setLoading] = useState<Stage>('hero')
  const [loadAttempt, setLoadAttempt] = useState(0), [prepAttempt, setPrepAttempt] = useState(0)
  const [save, setSave] = useState<Save>(readSave)
  const saveRef = useRef(save)
  const [saveWarning, setSaveWarning] = useState(false)
  const [shareStats, setShareStats] = useState(statsEnabled)
  const [inviteCode, setInviteCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '')
  const [menu, setMenu] = useState<Menu>(() => new URLSearchParams(location.search).has('room') ? 'hero' : reopenShop() ? 'shop' : 'title')
  const [party, setParty] = useState<{ code: string; players: Roster } | null>(null)
  const [partyStatus, setPartyStatus] = useState(''), [partyError, setPartyError] = useState('')
  const partyClient = useRef<RoomClient | null>(null), lobbyUnsubscribe = useRef<(() => void) | null>(null)
  const partyAbort = useRef<AbortController | null>(null)
  useEffect(() => () => { partyAbort.current?.abort(); lobbyUnsubscribe.current?.(); partyClient.current?.close() }, [])
  const menuNow = useRef(menu); menuNow.current = menu
  const [returnMenu, setReturnMenu] = useState<Menu>('title')
  const [level, setLevel] = useState(1)
  const [menuRandom] = useState(() => seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]))
  // A friend's challenge link (?vs=…), checked strictly; its Chog is the title's Chog.
  const [challenge] = useState(() => readChallenge(location.search))
  const [hero, setHero] = useState(() => challenge ? String(challenge.hero) : randomHero(menuRandom))
  const [run, setRun] = useState<Run | null>(null)
  const [streetRead, setStreetRead] = useState<StreetRead | null>(null)
  const pendingRun = useRef<Run | null>(null), startToken = useRef(0)
  const accountNow = useRef(activeWallet.account); accountNow.current = activeWallet.account
  const [starting, setStarting] = useState(false)
  // One-tap Play: the title is loading the hero and level art for a run that starts without level select or the hero picker.
  // From a challenge banner it carries the rival (none for an expired Daily), and the night may be one still locked here.
  const [quick, setQuick] = useState<{ rival?: Challenge } | null>(null)
  // The menu where a $CHOG perk read failed: it shows a Retry / Continue note until the menu changes.
  const [perksFailed, setPerksFailed] = useState<Menu>(null)
  useEffect(() => { setPerksFailed(null); setQuick(null) }, [menu])
  useEffect(() => { startToken.current++; pendingRun.current = null; setStarting(false); setStreetRead(null); setPerksFailed(null); setMenu(m => m === 'street' ? 'hero' : m) }, [activeWallet.account, activeWallet.sandbox])
  useEffect(() => () => { startToken.current++; clearTimeout(closeTimer.current) }, [])
  const [outcome, setOutcome] = useState<Outcome | null>(null), [defeatTip, setDefeatTip] = useState('')
  const [intro, setIntro] = useState('treater')
  // The toast a locked tablet raises, and the night a win has just unlocked (the result card's beat).
  const [lockNote, setLockNote] = useState<{ text: string; at: number } | null>(null)
  useEffect(() => { if (!lockNote) return; const timer = setTimeout(() => setLockNote(null), 2400); return () => clearTimeout(timer) }, [lockNote])
  const [opened, setOpened] = useState(0)
  // The result card's feedback dialog, open over the card, and whether this result's note was sent.
  const [feedback, setFeedback] = useState<'' | 'open' | 'sent'>('')
  const [icons, setIcons] = useState<AssetPack['atlases'][number]>()
  // The daily challenge: the UTC date picks the level and the night's modifier.
  const daily = dailyInfo(), mapLevel = level === DAILY_LEVEL ? daily.level : level, dailyOpen = isOpen(save, DAILY_LEVEL)
  // Chog of the Day: the same featured Chog for everyone on a UTC date, drawn from the Daily's date seed (salted, so it isn't the Daily run's first draw).
  const chogOfDay = Number(randomHero(seededRandom(daily.seed ^ 0xc06)))
  // A challenge on another day's Daily has ended; its banner offers today's Daily instead (with no rival to compare).
  const expired = challenge?.level === DAILY_LEVEL && challenge.day !== daily.number, challengeNight = expired ? DAILY_LEVEL : challenge?.level ?? 1
  const mode: Mode = level === ENDLESS_LEVEL ? 'endless' : level === DAILY_LEVEL ? 'daily' : 'level'
  const levelName = (id: number) => id === DAILY_LEVEL ? `Daily #${daily.number}` : LEVELS[id - 1].name
  const [ready, setReady] = useState(false)
  const valid = /^\d+$/.test(hero) && Number(hero) >= 1 && Number(hero) <= 1969
  // A first visit: nothing played or learned yet, so the title's main button goes straight into Night 1.
  const firstVisit = !save.tutorial && !Object.keys(save.stars).length && !Object.keys(save.scores).length
  // The highest open story night: where a returning player's hero picker opens from the title or the level map.
  const currentNight = LEVELS.filter(item => !item.endless && isOpen(save, item.id)).at(-1)?.id ?? 1
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
    setTryingHolder(true); setHolderError(''); setPartyError('')
    try {
      const response = await fetch(holderUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: guest.address }), signal: timeoutSignal(20_000) })
      const data = await response.json()
      const id = Number(data.chogId)
      if (!response.ok || !Number.isInteger(id) || id < 1 || id > 1969) throw new Error('Unavailable')
      const [owned, perks] = await Promise.all([readHomeAdvantage(id, guest.address, true), readHolderBonuses(id, guest.address, true)])
      if (!owned || !perks.bonuses.chog) throw new Error('Not ready')
      activeWallet.setSandboxId(id); setHero(String(id))
    } catch { setHolderError('The holder demo is taking a break. Try again later, or connect a wallet with a Chog for Porch Party. You can still borrow any hero for solo play.') }
    finally { setTryingHolder(false) }
  }
  const kit = assets && valid ? resolveKit(assets.kits, assets.traits, assets.chogs, Number(hero), home) : null
  const ownedKey = shop.owned.join(',')
  const costume = SHOP_ITEMS.some(i => i.kind === 'costume' && i.key === save.costume && shop.owned.includes(i.id)) ? save.costume : ''
  const victoryDance = kit && assets && canDance(save.victoryDance, kit.emote, shop.owned, assets.dances) ? save.victoryDance : 'gg'
  const [previewDance, setPreviewDance] = useState('idle')
  const pickingHero = menu === 'hero' || !!quick
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
    const signal = controller.signal
    setPrepared(null); setFailed(null); setLoading('hero')
    const kit = resolveKit(assets.kits, assets.traits, assets.chogs, Number(hero), home)
    // Hero and level art don't depend on each other, so both load at once. The merge keeps the old order (base, hero, level): Art.frame() takes the first match.
    const heroArt = loadHeroAssets(assets, kit, signal, costume, shop.owned).then(pack => { if (!signal.aborted) setLoading('street'); return pack }, () => { throw 'hero' })
    const levelArt = loadLevelAssets(assets, mapLevel, signal, level === DAILY_LEVEL).catch(() => { throw 'street' })
    const added = (pack: AssetPack) => pack.atlases.filter(atlas => !assets.atlases.includes(atlas))
    void Promise.all([heroArt, levelArt]).then(([heroPack, levelPack]) => {
      if (!signal.aborted) setPrepared({ id: Number(hero), home, costume, assets: { ...levelPack, atlases: [...assets.atlases, ...added(heroPack), ...added(levelPack)] } })
    }).catch(stage => { if (!signal.aborted) setFailed(stage === 'street' ? 'street' : 'hero') })
    return () => controller.abort()
  }, [assets, hero, home, valid, pickingHero, prepAttempt, costume, ownedKey, level, mapLevel])
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
    setFailed(null)
    void loadAssets(controller.signal).then(pack => { if (!controller.signal.aborted) setAssets(pack) }).catch(() => { if (!controller.signal.aborted) setFailed('candy') })
    return () => controller.abort()
  }, [loadAttempt])
  useEffect(() => {
    // Sfx unlocks itself inside the first gesture and retries anything that failed on later ones. The menus' stickers play their cues through it.
    const audio = new Sfx(saveRef.current.settings); sfx.current = audio; setUiSound(cue => audio.play(cue))
    return () => { setUiSound(null); audio.destroy(); sfx.current = null }
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
    const endRun = (end: RunEnd) => { if (run.coop) return; if (started && !finished) { finished = true; trackRunEnd(world, info, end) } }
    const quit = () => endRun({ won: false, quit: true, stars: 0, score: 0, wave: world.wave, seconds: world.clock })
    const world = new SiegeScene({ coop: run.coop, assets: run.assets, level: run.level, mode: run.mode, daily: run.daily, seed: run.seed, stars: run.stars, street: run.street, seen: saveRef.current.seen, onDiscover: keys => persist({ ...saveRef.current, seen: [...new Set([...saveRef.current.seen, ...keys])] }), hero: run.id, home: run.home, tutorial: run.tutorial, costume: run.costume, owned: run.owned, victoryDance: run.victoryDance, settings: saveRef.current.settings, sfx: sfx.current,
      onShop: () => { if (run.coop) { world.hud.toast('Visit the shop after this room.'); return }; setReturnMenu('pause'); setMenu('shop') },
      onFullscreen: canFullscreen ? () => { void fullscreen() } : undefined,
      onPause: () => setMenu(run.coop ? 'party-leave' : 'pause'),
      onIntro: kind => { setIntro(kind); setMenu('intro') },
      onTutorial: () => persist({ ...saveRef.current, tutorial: true }),
      onReady: () => { setReady(true); if (run.coop) { lobbyUnsubscribe.current?.(); lobbyUnsubscribe.current = null; return }; if (!started) { started = true; track('run_start', info) } },
      onEnd: result => {
        endRun({ ...result, quit: false })
        setOutcome(result); setDefeatTip(result.won ? '' : counterTip(result, world)); setMenu('result'); setOpened(0); setFeedback('')
        if (run.coop) return
        const now = saveRef.current
        // A challenge on a night still locked here plays unsaved: no stars, scores or unlocks.
        if (!isOpen(now, nightOf(run))) return
        // Each mode keeps its own best: stars and score per level, the best endless wave, and the best score of each daily.
        if (run.mode === 'endless') persist({ ...now, endless: { wave: Math.max(now.endless.wave, result.wave), score: Math.max(now.endless.score, result.score) } })
        else if (run.mode === 'daily' && run.daily) persist({ ...now, daily: { ...now.daily, [run.daily.day]: Math.max(now.daily[run.daily.day] ?? 0, result.score) } })
        else {
          const next = { ...now, stars: { ...now.stars, [run.level]: Math.max(now.stars[run.level] ?? 0, result.stars) }, scores: { ...now.scores, [run.level]: Math.max(now.scores[run.level] ?? 0, result.score) } }, after = run.level + 1
          if (LEVELS[run.level]?.waves.length && !isOpen(now, after) && isOpen(next, after)) setOpened(after)
          persist(next)
        }
      },
    })
    scene.current = world
    // create() is async and Phaser doesn't await it, so a failure there (the Chog head art, say) would leave the lanterns unlit for good.
    const create = world.create.bind(world)
    world.create = () => create().catch(reason => { console.error(reason); if (scene.current === world) setFailed('lanterns') })
    // A tablet can report WebGL yet fail to open a context (too many open, or a lost GPU), and Phaser then throws: test one first and use canvas if it fails.
    const webgl = (() => { try { const gl = document.createElement('canvas').getContext('webgl'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl } catch { return false } })()
    // Expand from the design buffer without multiplying it by devicePixelRatio.
    const game = (() => { try { return new Phaser.Game({ type: webgl ? Phaser.AUTO : Phaser.CANVAS, parent: host.current, width: 1920, height: 1080, transparent: true, banner: false,
      // No Pre/Post FX is used; leaving them on allocates ~180 MB of render targets at boot, which can crash a phone tab.
      disablePreFX: true, disablePostFX: true,
      scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1920, height: 1080 },
      render: { antialias: true, roundPixels: false, powerPreference: 'high-performance', maxTextures: 8 },
      fps: { target: 60 }, audio: { noAudio: true }, input: { activePointers: 2 }, scene: world,
      callbacks: { postBoot: game => { game.canvas.setAttribute('aria-label', 'Candy Siege. Tap pads to build; select the hero portrait then tap the ground to move. Space pauses. 1 and 2 select spells. Q uses your ability. R uses your ultimate. Z and X choose a talent. E opens emotes.'); game.canvas.setAttribute('role', 'application'); game.canvas.tabIndex = 0 } },
    }) } catch (reason) { console.error(reason); return null } })()
    // If the renderer still can't start, offer the level's own retry instead of the app's error screen.
    if (!game) { scene.current = null; setFailed('lanterns'); return }
    const hide = () => { if (run.coop) { world.cancel(); return }; if (document.hidden && world.ready && !world.paused && !world.ended) world.pauseGame() }
    const resize = () => game.scale.refresh()
    const observer = new ResizeObserver(resize); observer.observe(host.current)
    window.addEventListener('orientationchange', resize)
    window.addEventListener('pagehide', quit)
    document.addEventListener('visibilitychange', hide)
    return () => { quit(); window.removeEventListener('pagehide', quit); observer.disconnect(); window.removeEventListener('orientationchange', resize); document.removeEventListener('visibilitychange', hide); scene.current = null; game.destroy(true); setReady(false) }
  }, [run, assets])
  useEffect(() => {
    const world = scene.current
    if (!world || !assets || !ready || world.options.coop) return
    const controller = new AbortController()
    // Refresh cosmetic availability without replacing the running level or granting candy mid-run.
    world.options.owned = shop.owned
    void loadHeroAssets(world.options.assets, world.hero.kit, controller.signal, world.options.costume, shop.owned).then(pack => {
      if (controller.signal.aborted || scene.current !== world) return
      world.art.addAssets(pack); world.options.assets = pack; world.applySettings(saveRef.current.settings); world.hud.emotes()
    }).catch(() => { /* Retry when the shop refreshes; the current level stays playable. */ })
    return () => controller.abort()
  }, [ownedKey, ready, assets])
  useEffect(() => { scene.current?.applySettings(save.settings); sfx.current?.apply(save.settings); setHaptics(save.settings.vibration) }, [save.settings])
  const updateSettings = (settings: Settings) => persist({ ...saveRef.current, settings })
  // Closing the last dialog waits for its 120 ms exit; `after` runs once it is gone (the canvas is inert while a modal is open).
  const [closing, setClosing] = useState(false), closeTimer = useRef(0)
  const closeMenu = (after: () => void) => {
    setClosing(true); clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => { flushSync(() => { setClosing(false); setMenu(null) }); after() }, 120)
  }
  const resume = () => { playUi('ui-close'); closeMenu(() => { scene.current?.setPaused(false); host.current?.querySelector('canvas')?.focus() }) }
  const leaveLevel = (keepInvite = false) => { startToken.current++; setStarting(false); partyAbort.current?.abort(); partyAbort.current = null; lobbyUnsubscribe.current?.(); lobbyUnsubscribe.current = null; partyClient.current?.close(); partyClient.current = null; setParty(null); setPartyStatus(''); setPartyError(''); if (!keepInvite) { setInviteCode(''); const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url) } setRun(null); setPrepared(null); setOutcome(null); setMenu('levels'); sfx.current?.pause(false) }
  // Retry only the stage that failed: the base pack, the hero and level art, or the scene (a fresh run object rebuilds the game).
  const retry = () => { const stage = failed; setFailed(null); if (stage === 'candy') setLoadAttempt(n => n + 1); else if (stage === 'lanterns') setRun(r => r && { ...r }); else setPrepAttempt(n => n + 1) }
  // A story win with a playable level after it leads on to that night's hero picker, keeping the hero and costume.
  const nextLevel = outcome?.won && run?.mode === 'level' && LEVELS[run.level]?.waves.length && isOpen(save, run.level + 1) ? run.level + 1 : 0
  // The result card's optional feedback link, on the share button's line when there is one.
  const feedbackLink = STATS_URL ? (feedback === 'sent' ? <p className="siege-feedback-thanks" role="status">Thanks! The porch heard you.</p> : <button className="siege-text-button siege-feedback-open" onClick={() => { setFeedback('open'); playUi('ui-open') }}>Send feedback</button>) : null
  // A win short of UNLOCK_STARS names what the next night needs.
  // A challenge run on a night still locked here saved nothing; the result card says so.
  const unsaved = !!run && !run.coop && !isOpen(save, nightOf(run))
  const starsShort = outcome?.won && !outcome.party && !unsaved && run?.mode === 'level' && LEVELS[run.level]?.waves.length && !isOpen(save, run.level + 1) ? run.level + 1 : 0
  // From the result card to a night's hero picker, keeping the hero and costume.
  const toPicker = (night: number) => { if (!run) return; const id = run.id; leaveLevel(); setLevel(night); setHero(String(id)); setMenu('hero') }
  // A locked tablet shakes and says which night opens it; an open one leads to the hero picker.
  const pick = (id: number, card: HTMLElement) => {
    if (isOpen(save, id)) { setLevel(id); setMenu('hero'); return }
    if (!reducedMotion()) card.animate(SHAKE, { duration: 300 })
    setLockNote({ text: `${unlockHint(id)} ${id === DAILY_LEVEL ? 'the Daily' : id === ENDLESS_LEVEL ? 'Endless' : LEVELS[id - 1].name}.`, at: Date.now() })
  }
  const launchRun = (next: Run) => {
    closeMenu(() => { setRun(next); pendingRun.current = null; setStreetRead(null); setOutcome(null) })
    void sfx.current?.unlock(); sfx.current?.pause(false)
  }
  const plainInvite = (reason: string) => /^(Invalid room or build|Room unavailable or full|Room expired)$/.test(reason) ? 'This invite is no longer available. Ask your friend for a new one, or start your own Porch Party.' : reason === 'Could not connect to room' || reason === 'Room connection timed out' ? 'Couldn’t reach the Porch Party. Check your connection and try again.' : reason
  const startParty = async () => {
    if (starting || !assets || !valid || mode !== 'level' || (!inviteCode && !isOpen(saveRef.current, level))) return
    setStarting(true); setPartyError('')
    const token = ++startToken.current, controller = new AbortController()
    partyAbort.current?.abort(); partyAbort.current = controller
    try {
      const account = activeWallet.account, id = Number(hero)
      const [ownedHero, perks] = await Promise.all([readHomeAdvantage(id, account, activeWallet.sandbox), readHolderBonuses(id, account, activeWallet.sandbox)])
      if (token !== startToken.current || controller.signal.aborted) return
      // Checked before any room exists, so the note stays on the hero picker and an invite is kept.
      if (!ownedHero || perks.status === 'unavailable') { setPartyError(!ownedHero ? 'Porch Party needs a Chog you own. Pick one of yours, or tap Try as a holder.' : 'Could not check your holder perks. Please try again.'); return }
      const selection: HeroSelection = { id, home: ownedHero, costume, owned: [...shop.owned], victoryDance, stars: { ...saveRef.current.stars }, street: perks.bonuses }
      const ticket = inviteCode ? null : await createRoom(COOP_RELAY, __COOP_BUILD__, level, controller.signal)
      const client = await RoomClient.connect(COOP_RELAY, ticket?.room.code ?? inviteCode, __COOP_BUILD__, selection, ticket?.hostToken)
      if (token !== startToken.current || controller.signal.aborted) { client.close(); return }
      partyClient.current = client; setLevel(client.room.level); setParty({ code: client.room.code, players: client.roster }); setMenu('party'); setPartyStatus('Waiting for your partner…')
      let preparing = false
      const prepare = async () => {
        if (preparing || !client.roster.every(Boolean)) return
        preparing = true; setPartyStatus('Preparing both Chogs…')
        const players = client.roster as [HeroSelection, HeroSelection]
        try {
          const pack = await prepareParty(assets, players, client.room.level, controller.signal)
          if (controller.signal.aborted || token !== startToken.current) return
          const first = players[0], street = { candy: Math.max(...players.map(p => p.street.candy)), trap: players.some(p => p.street.trap), chog: players.some(p => p.street.chog), crew: 0 as const }
          launchRun({ id: first.id, home: first.home, costume: first.costume, victoryDance: first.victoryDance, stars: first.stars, owned: [...new Set(players.flatMap(p => p.owned))], street, assets: pack, level: client.room.level, mode: 'level', daily: null, seed: client.room.seed, serial: Date.now(), tutorial: false,
            coop: { client, players, onStatus: setPartyStatus, onError: message => { setPartyError(message); setMenu('party-error') } } })
        } catch (error) { if (!controller.signal.aborted) { setPartyError(error instanceof Error ? error.message : 'Could not prepare the room.'); setMenu('party-error'); client.close() } }
      }
      lobbyUnsubscribe.current = client.subscribe(message => {
        if (message.type === 'roster') { setParty({ code: client.room.code, players: message.players }); void prepare() }
        if (message.type === 'error' || message.type === 'disconnected' || message.type === 'desync') {
          controller.abort(); setPartyError(message.type === 'desync' ? 'Out of sync: restart together' : message.type === 'disconnected' ? 'Partner disconnected' : plainInvite(message.reason)); setMenu('party-error')
        }
      })
      void prepare()
    } catch (error) { if (!controller.signal.aborted) { setPartyError(plainInvite(error instanceof Error ? error.message : 'Could not open the room.')); setMenu('party-error') } }
    finally { if (token === startToken.current) setStarting(false) }
  }
  // from: a start from the title (one-tap Play or a challenge), which may play a night still locked here and may answer a rival.
  const start = async (tutorial = level === 1 && !save.tutorial, from?: { rival?: Challenge }) => {
    if (starting) return
    setPerksFailed(null)
    let next: Run
    if (run && menu !== 'hero') next = { ...run, serial: Date.now(), tutorial, owned: shop.owned, stars: saveRef.current.stars, street: NO_STREET, assets: scene.current?.options.assets ?? run.assets }
    else {
      if (!valid || !prepared || prepared.id !== Number(hero) || prepared.home !== home || prepared.costume !== costume || (!from && !isOpen(saveRef.current, level))) return
      next = { id: Number(hero), home, level: mapLevel, mode, daily: mode === 'daily' ? daily : null, seed: mode === 'daily' ? daily.seed : from?.rival?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0], serial: Date.now(), tutorial, costume, owned: shop.owned, victoryDance, assets: prepared.assets, street: NO_STREET, stars: saveRef.current.stars, rival: from?.rival }
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
  // One-tap Play starts once its hero and level art are ready; start() still reads the $CHOG perks.
  useEffect(() => { if (quick && prepared?.id === Number(hero)) { setQuick(null); void start(undefined, quick) } }, [quick, prepared, hero])
  const subMenu = (next: Menu) => { setReturnMenu(menu); setMenu(next) }
  const escape = () => {
    if (closing) return
    if (menu === 'settings' || menu === 'book' || menu === 'shop') { playUi('ui-close'); setMenu(returnMenu) }
    else if (menu === 'pause' || menu === 'intro') resume()
    // Backing out of a challenge on a night still locked here returns to the title's banner, not a hero picker that can't start it.
    else if (menu === 'street') { startToken.current++; pendingRun.current = null; setStreetRead(null); setMenu(run ? 'pause' : isOpen(saveRef.current, level) ? 'hero' : 'title') }
    else if (menu === 'hero') { if (inviteCode || partyAbort.current) leaveLevel(); else setMenu('levels') }
    else if (menu === 'levels') setMenu('title')
    else if (menu === 'result' || menu === 'party' || menu === 'party-error') leaveLevel()
    else if (menu === 'party-leave') setMenu(null)
  }
  return <div ref={shell} className={`siege-shell ${run ? 'siege-shell--playing' : ''}`}>
    <div className="siege-stage" ref={host} />
    {run?.coop && !menu && partyStatus && <p className="siege-party-status" role="status">{partyStatus}</p>}
    {run && !menu && activeWallet.sandbox && <aside style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', maxWidth: '36%', padding: '4px 10px', borderRadius: 6, background: '#241632e6', color: '#fff1b3', fontSize: 13, textAlign: 'center', pointerEvents: 'none' }}>Sandbox: a demo copy of Monad, nothing is real</aside>}
    <div className="siege-safe-area" aria-hidden="true" />
    {!run && <div className="siege-night" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(#24163233, #24163277), url(/siege/levels/level1.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}></div>}
    {onBack && <div className="siege-back"><Sticker onClick={onBack}>← Knock</Sticker></div>}
    <div className="siege-rotate bubble">Turn your phone sideways for the best view</div>
    {run && !ready && <div className="boot"><img className="boot-logo" src="/art/ui/logo.svg" alt="" width="240" height="80" />{failed === 'lanterns' ? <RetryPanel stage="lanterns" onRetry={retry}><Sticker sound="ui-back" onClick={() => { setFailed(null); leaveLevel() }}>Level select</Sticker></RetryPanel> : <><span className="boot-candy" aria-hidden="true" /><p role="status">{STAGES.lanterns[0]}</p></>}</div>}
    {menu && <Modal key={menu} closing={closing} quiet={menu === 'result'} closable={menu !== 'title'} label={menu === 'intro' ? 'New enemy' : menu === 'street' ? 'Your $CHOG perks' : `Candy Siege ${menu}`} onEscape={escape} className={['result', 'shop', 'hero', 'title', 'levels', 'party', 'settings'].includes(menu) ? `siege-modal--${menu}` : ''}>
      {installTip && <aside className="siege-install-tip" aria-label="Play full screen on iPhone">
        <strong>Add Knock to your Home Screen to play full screen</strong>
        <p>In Safari, tap Share (the square with an arrow). Scroll down and tap “Add to Home Screen”, then “Add”. Open Knock from its new icon.</p>
        <button className="siege-text-button" onClick={() => setInstallTip(false)}>Got it</button>
      </aside>}
      {displayNotice && <p role="status">{displayNotice}</p>}
      {perksFailed === menu && pendingRun.current && <p className="siege-perks-failed" role="alert">Couldn’t check your $CHOG perks.<Sticker disabled={starting} onClick={() => void start(pendingRun.current?.tutorial, pendingRun.current ? { rival: pendingRun.current.rival } : undefined)}>Retry</Sticker><Sticker tone="orange" sound="ui-confirm" onClick={() => { const next = pendingRun.current; setPerksFailed(null); if (next) launchRun(next) }}>Continue</Sticker></p>}
      {menu === 'title' && <div className={`siege-title${firstVisit ? ' siege-title--first' : ''}`}>
        <header className="siege-title-mark"><img className="siege-wordmark" src="/art/ui/logo.svg" alt="Knock" /><h1>Candy <span>Siege</span></h1><p>The whole neighbourhood wants your candy.</p></header>
        {/* Tonight's hero, the same Chog the hero picker opens on. */}
        <div className="siege-title-stage">
          <ChogOfDay id={chogOfDay} assets={assets} onPlay={() => { mobileFullscreen(); setHero(String(chogOfDay)); if (firstVisit) { setLevel(1); setQuick({}) } else { setLevel(currentNight); setMenu('hero') } }} />
          {valid && <figure className="siege-title-chog"><img src={thumb(Number(hero), true)} alt="" />{!challenge && <figcaption>Chog #{Number(hero)} · on porch duty</figcaption>}</figure>}
          {/* A friend's challenge: their (unverified) score to beat, and one tap into that night with that Chog. A Daily from another day offers today's. */}
          {challenge && <section className="siege-challenge" aria-label="A friend's challenge">
            <span className="siege-eyebrow">{expired ? 'DAILY CHALLENGE' : 'CHALLENGE · THEIR SCORE'}</span>
            <p>{expired ? `Daily #${challenge.day} has ended. Today’s is Daily #${daily.number}.` : `Chog #${challenge.hero} scored ${challenge.score.toLocaleString()}${challenge.stars ? ` ${'★'.repeat(challenge.stars)}${'☆'.repeat(3 - challenge.stars)}` : ''} ${challenge.level === ENDLESS_LEVEL ? 'in Endless' : `on ${challenge.level === DAILY_LEVEL ? `Daily #${challenge.day}` : LEVELS[challenge.level - 1].name}`}. Beat it?`}</p>
            <Sticker tone="orange" sound="ui-confirm" disabled={!!quick || starting} onClick={() => { mobileFullscreen(); setHero(String(challenge.hero)); setLevel(challengeNight); setQuick({ rival: expired ? undefined : challenge }) }}>{expired ? 'Play today’s Daily →' : 'Beat it →'}</Sticker>
            {!isOpen(save, challengeNight) && <small>Still locked for you, so this run won’t save stars or unlock nights.</small>}
          </section>}
        </div>
        {/* A first visit plays at once: Night 1 with tonight's hero, loading in the button's place. "Choose night & Chog" keeps the full flow. */}
        <div className="siege-title-go">{quick || starting ? (failed && failed !== 'lanterns' ? <RetryPanel stage={failed} onRetry={retry} /> : <StageLabel stage={!assets ? 'candy' : starting ? 'lanterns' : loading} />)
          : <Sticker tone="orange" className="siege-title-play" data-initial-focus="" onClick={() => { mobileFullscreen(); if (firstVisit) { setLevel(1); setQuick({}) } else setMenu('levels') }}>Hold the porch →</Sticker>}</div>
        <nav className="siege-title-more" aria-label="More"><Sticker tone="purple" icon="coin-pile" sound="ui-open" onClick={() => subMenu('shop')}>Shop</Sticker><Sticker tone="purple" icon="ghost-sheet" aria-label="Field guide" sound="ui-open" onClick={() => subMenu('book')}>Guide</Sticker><Sticker tone="purple" sound="ui-open" onClick={() => subMenu('settings')}>{GEAR}Settings</Sticker></nav>
        <div className="siege-title-links">
          {firstVisit && <button className="siege-text-button" onClick={() => { mobileFullscreen(); setMenu('levels') }}>Choose night & Chog</button>}
          {bank.enabled && (!activeWallet.account || bank.claim?.state === 'none') && <button className="siege-text-button" onClick={() => subMenu('shop')}>Starter grant · 300 $KNOCK</button>}
          {STATS_URL && <a className="siege-text-button" href="/stats">Live stats</a>}
        </div>
        <nav className={`siege-powered${save.settings.lite ? ' siege-powered--still' : ''}`} aria-label="Powered by"><span className="siege-eyebrow" aria-hidden="true">POWERED BY</span>{POWERED.map(([name, href, file, height, light], i) => <a key={name} className={light ? 'siege-powered-light' : undefined} style={{ '--i': i } as CSSProperties} href={href} target="_blank" rel="noopener noreferrer"><img src={`/art/partners/${file}`} alt={name} height={height} /></a>)}</nav>
      </div>}
      {menu === 'levels' && <>
        <span className="siege-eyebrow">CHOG TOWN · AFTER DARK</span><h2>Pick your porch</h2>
        {/* Night tablets: Night 01 is open, and each win with UNLOCK_STARS opens the next (isOpen). A locked tablet stays tappable (aria-disabled, not disabled) so it can shake and say which night opens it.
            The green PLAY is part of the card, so the whole tablet stays one big tap target. */}
        <div className="siege-levels">{LEVELS.map((item, index) => { const night = String(index + 1).padStart(2, '0'), open = isOpen(save, item.id), best = item.endless ? save.endless.wave : save.stars[item.id] ?? 0, fresh = item.id === 1 && !best, boss = item.waves.map(wave => wave.boss?.id).filter(id => typeof id === 'number').pop(); return <Sticker key={item.id} aria-label={`${item.endless ? `Endless mode, Town Square, ${open ? `best wave ${best}` : 'locked'}` : `${item.name}, night ${night}, ${open ? `${best} of 3 stars${fresh ? ', start here' : ''}` : 'locked'}`}${open ? '' : `. ${unlockHint(item.id)}`}`} aria-disabled={open ? undefined : true} className={`siege-level${open ? '' : ' siege-level--locked'}`} sound={open ? 'ui-select' : 'ui-deny'} data-initial-focus={index ? undefined : ''} onClick={event => pick(item.id, event.currentTarget)}>
          <span className="siege-level-night">{item.endless ? 'Endless' : `Night ${night}`}</span><span className="siege-level-map" style={{ backgroundImage: `${open ? '' : DIM}url(/siege/levels/${mapFile(item.id)}.webp)` }}>{boss && <img src={thumb(boss, true)} alt="" />}{!open && PADLOCK}</span><strong>{item.endless ? 'Town Square' : item.name}</strong>{item.endless ? <small>{best ? `Best: wave ${best}` : 'Waves never stop'}</small> : stars(best)}{open ? <span className="siege-level-play">{fresh ? 'Start here' : 'Play'}</span> : <span className="siege-level-lock">{unlockHint(item.id)}</span>}
        </Sticker> })}
          <Sticker aria-label={`Daily challenge number ${daily.number}: ${LEVELS[daily.level - 1].name}, ${NIGHTS[daily.theme].name}. ${dailyOpen ? NIGHTS[daily.theme].text : `Locked. ${unlockHint(DAILY_LEVEL)}`}`} aria-disabled={dailyOpen ? undefined : true} className={`siege-level siege-daily${dailyOpen ? '' : ' siege-level--locked'}`} sound={dailyOpen ? 'ui-select' : 'ui-deny'} onClick={event => pick(DAILY_LEVEL, event.currentTarget)}>
            <span className="siege-level-night">{icons ? <AtlasSprite atlas={icons} name={NIGHTS[daily.theme].icon} size={24} /> : '☾'} Daily #{daily.number}</span><span className="siege-level-map" style={{ backgroundImage: `${dailyOpen ? '' : DIM}url(/siege/levels/level${daily.level}.webp)` }}>{!dailyOpen && PADLOCK}</span><strong>{NIGHTS[daily.theme].name}</strong><small>{LEVELS[daily.level - 1].name} · {save.daily[daily.day] ? `best today ${save.daily[daily.day].toLocaleString()}` : NIGHTS[daily.theme].text}</small>{dailyOpen ? <span className="siege-level-play">Play</span> : <span className="siege-level-lock">{unlockHint(DAILY_LEVEL)}</span>}
          </Sticker>
        </div>
        <div className="siege-levels-foot"><Sticker sound="ui-back" onClick={() => setMenu('title')}>← Back</Sticker>{Object.keys(save.scores).length === 1 && <button className="siege-text-button" onClick={() => { setLevel(currentNight); setMenu('hero') }}>Every Chog plays differently: pick yours →</button>}<p className="siege-hint">3 stars: 18–20 jars · 2 stars: 10–17 · 1 star: 1–9</p></div>
        {/* The locked tablet's toast floats over the dialog's bottom edge, in view however far the tablets have scrolled. */}
        <div className="siege-lock-toast" role="status">{lockNote && <span key={lockNote.at}>{lockNote.text}</span>}</div>
      </>}
      {menu === 'hero' && <>
        <span className="siege-eyebrow">{level === DAILY_LEVEL ? `${levelName(level).toUpperCase()} · ${LEVELS[daily.level - 1].name.toUpperCase()} · ${NIGHTS[daily.theme].name.toUpperCase()}` : level === ENDLESS_LEVEL ? 'ENDLESS · TOWN SQUARE' : `${levelName(level).toUpperCase()} · LEVEL ${level}`}</span><h2>Who’s on porch duty?</h2>
        {inviteCode && <p className="siege-party-invite">Porch Party invite · join with a Chog you own, or tap Try as a holder for a demo Chog.</p>}
        <WalletChoice wallet={activeWallet} disabled={starting || tryingHolder || shop.busy} />
        <div className="siege-hero-pick">
          <div className={`siege-portrait ${home ? 'siege-portrait--home' : ''} ${kit?.legend ? 'siege-portrait--legend' : ''}`}>
            {!valid && <span>?</span>}
            {kit?.legend && <b className="siege-legendary">★ LEGENDARY ★</b>}
            <b>{home ? 'HOME ADVANTAGE' : 'GUEST HERO'}</b>
            {valid && <div className="siege-chog-comparison">
              <figure className="siege-nft"><figcaption>{home ? "Your Chog" : "Chog portrait"}</figcaption><img key={hero} src={thumb(Number(hero), true)} alt={`Original portrait of Chog #${Number(hero)}`} /><small>Chog #{Number(hero)}</small></figure>
              <figure className="siege-in-game"><figcaption>In Siege</figcaption>{prepared && kit && prepared.id === kit.id && prepared.costume === costume ? <HeroPreview lite={save.settings.lite} assets={prepared.assets} kit={kit} costume={costume || kit.costume} dance={previewDance === 'idle' || canDance(previewDance, kit.emote, shop.owned, prepared.assets.dances) ? previewDance : 'idle'} /> : <span className="siege-character-loading" role="status">Dressing your Chog…</span>}</figure>
            </div>}
            {/* One tap previews a dance; the row scrolls sideways. The ★ marks this Chog's signature. */}
            {kit && assets && <div className="siege-dance-pick"><span aria-hidden="true">Try a dance</span><div className="siege-dance-chips" role="group" aria-label="Try a dance">{[['idle', 'Idle'], ...Object.entries(assets.dances).filter(([name]) => canDance(name, kit.emote, shop.owned, assets.dances)).map(([name, dance]) => [name, dance.name])].map(([name, label]) => <button key={name} className="siege-chip" aria-pressed={(canDance(previewDance, kit.emote, shop.owned, assets.dances) ? previewDance : 'idle') === name} aria-label={name === kit.emote ? `${label}, signature` : undefined} onClick={() => { setPreviewDance(name); playUi('ui-select') }}>{label}{name === kit.emote && ' ★'}</button>)}</div></div>}
            <label className="siege-dance-select">Victory dance<select aria-label="Victory dance" value={victoryDance} onChange={event => { persist({ ...save, victoryDance: event.target.value }); playUi('ui-select') }}>{assets && kit && Object.entries(assets.dances).filter(([name]) => canDance(name, kit.emote, shop.owned, assets.dances)).map(([name, dance]) => <option value={name} key={name}>{dance.name}</option>)}</select></label>
          </div>
          {/* The start button sits right under the Chog choice so a landscape phone never scrolls to play. */}
          <div className="siege-hero-side">
            <div className="row"><PlaqueInput label="Chog #" value={hero} onChange={value => { setHero(value); playUi('ui-select') }} min={1} max={1969} /><Sticker sound="ui-select" onClick={() => setHero(randomHero(menuRandom))}>Random</Sticker>
              {activeWallet.account && <Sticker tone="gold" sound="ui-select" disabled={!myChogs.length} onClick={() => { const index = myChogs.indexOf(Number(hero)); setHero(String(myChogs[(index + 1) % myChogs.length])) }}>My Chog</Sticker>}
              <Sticker tone="gold" sound="ui-select" disabled={tryingHolder || starting || shop.busy} onClick={() => void tryHolder()}>{tryingHolder ? 'Preparing holder demo…' : 'Try as a holder'}</Sticker>{hasChog && <strong className="siege-shop-note">$CHOG holder</strong>}
            </div>
            {holderError && <p role="status">{holderError}</p>}
            {partyError && <p className="siege-perks-failed" role="alert">{partyError}</p>}
            {failed && failed !== 'lanterns' ? <RetryPanel stage={failed} onRetry={retry} /> : (!assets || (valid && !prepared)) && <StageLabel stage={assets ? loading : 'candy'} />}
            <div className="row"><Sticker tone="orange" sound="ui-confirm" disabled={starting || tryingHolder || !valid || !prepared || prepared.id !== Number(hero) || (!!inviteCode && !home)} onClick={() => inviteCode ? startParty() : start()}>{starting ? 'Checking your $CHOG perks…' : inviteCode ? 'Join Porch Party →' : 'Let’s make mischief →'}</Sticker><Sticker sound="ui-back" onClick={() => inviteCode || partyAbort.current ? leaveLevel(!!inviteCode) : setMenu('levels')}>← Back</Sticker></div>
            {mode === 'level' && !inviteCode && <Sticker tone="purple" sound="ui-confirm" disabled={starting || tryingHolder || !valid || !prepared || !home} onClick={() => void startParty()}>{holderCurrent && !home ? 'Porch Party · needs your own Chog' : 'Porch Party · play together'}</Sticker>}
            {mode === 'level' && !inviteCode && !home && <p className="siege-hint">Porch Party needs a Chog you own. Connect its wallet, or tap Try as a holder for a demo Chog.</p>}
            {save.tutorial && level === 1 && !inviteCode && <button className="siege-text-button" onClick={() => { playUi('ui-confirm'); void start(true) }} disabled={starting || tryingHolder || !valid || !prepared || prepared.id !== Number(hero)}>Play with the tutorial again</button>}
            <p>{home ? 'Home advantage: your own Chog starts one level higher and wears a gold frame.' : 'Borrow any Chog. Its real traits are your perks.'}</p>
            {activeWallet.choice === 'connected' && wallet.account && wallet.loading && <small>Checking your Chogs…</small>}
            {kit && assets && <div className="siege-kit">{(['weapon', 'special', 'ultimate', 'passive', 'headgear', 'trinket'] as const).map(slot => {
              const family = kit[slot], info = assets.kits.slots[slot][family], atlas = assets.atlases.find(a => a.key === 'kit')!, frame = atlas.data.frames[`kit/${slot}/${family}`]?.frame
              const legendArt = kit.legend && (slot === 'weapon' || slot === 'special' || slot === 'ultimate') ? { atlas: prepared?.assets.atlases.find(a => a.key === `hero-${kit.costume}`), name: slot === 'weapon' ? 'wpn/proj' : slot === 'special' ? 'special/2' : 'ultimate/3' } : null
              return <div className="siege-kit-row" key={slot}>{legendArt ? <span className="siege-kit-icon" aria-hidden="true"><AtlasSprite atlas={legendArt.atlas} name={legendArt.name} size={64} /></span> : frame ? <span aria-hidden="true" className="siege-kit-icon" style={{ width: frame.w, height: frame.h, backgroundImage: `url(${atlas.image.src})`, backgroundPosition: `-${frame.x}px -${frame.y}px` }} /> : <span className="siege-kit-empty" aria-hidden="true">—</span>}<span><small>{slot}</small><strong>{info.name}</strong><span>{info.effect || 'Travelling light.'}</span></span></div>
            })}<p className="siege-signature">Signature: <b>{assets.kits.slots.emote[kit.emote].name}</b></p></div>}

          </div>
        </div>
        <div className="siege-costumes" aria-label="Hero costume"><span>Wear</span><Sticker aria-pressed={!costume} sound="ui-select" onClick={() => persist({ ...save, costume: '' })}>Original outfit</Sticker>{SHOP_ITEMS.filter(i => i.kind === 'costume' && shop.owned.includes(i.id)).map(i => <Sticker key={i.id} aria-pressed={costume === i.key} tone={costume === i.key ? 'gold' : 'paper'} sound="ui-select" onClick={() => persist({ ...save, costume: i.key })}>{i.name}</Sticker>)}<Sticker tone="gold" sound="ui-open" onClick={() => subMenu('shop')}>Costume shop ↗</Sticker></div>
      </>}
      {menu === 'street' && streetRead && <section className="siege-street-card">
        <span className="siege-eyebrow">CHOG #{pendingRun.current?.id} · A SWEETER NIGHT</span>
        <h2>Your $CHOG perks</h2>
        {holderLines(streetRead.bonuses).length ? <ul>{holderLines(streetRead.bonuses).map(row => <li key={row.source}><strong>{row.source}</strong><span>{row.bonus}</span></li>)}</ul> : <p>No holder perks this time. Every Chog can still defend the porch.</p>}
        {pendingRun.current?.home && <p><strong>Home advantage</strong> · Your own Chog starts one level higher and wears a gold frame.</p>}
        {activeWallet.sandbox && <p><strong>Sandbox: a demo copy of Monad, nothing is real</strong></p>}
        <Sticker tone="orange" sound="ui-confirm" onClick={() => { if (pendingRun.current) launchRun(pendingRun.current) }}>Defend the porch →</Sticker>
        <button className="siege-text-button" onClick={() => { playUi('ui-back'); escape() }}>← Back</button>
      </section>}
      {menu === 'party' && party && <>
        <span className="siege-eyebrow">TWO CHOGS · ONE PORCH</span><h2 tabIndex={-1} data-initial-focus>Porch Party</h2>
        <p>{LEVELS[level - 1].name} · shared candy and jars</p>
        <div className="siege-party-heroes">{party.players.map((player, slot) => <figure key={slot}>{player ? <><img src={thumb(player.id, true)} alt={`Chog #${player.id}`} /><figcaption>Chog #{player.id}</figcaption></> : <><span className="siege-party-empty">?</span><figcaption>Waiting for a friend</figcaption></>}</figure>)}</div>
        <p role="status">{partyStatus}</p>
        <label className="siege-party-link">Invite a friend<input readOnly value={`https://knock.timidan.xyz/?room=${party.code}`} onFocus={event => event.target.select()} /></label>
        <div className="row"><Sticker tone="orange" sound="ui-confirm" onClick={() => { void navigator.clipboard.writeText(`https://knock.timidan.xyz/?room=${party.code}`).then(() => setPartyStatus('Invite copied!')).catch(() => setPartyStatus('Select and copy the invite link above.')) }}>Copy invite</Sticker><Sticker sound="ui-back" onClick={() => leaveLevel()}>Leave room</Sticker></div>
        <p className="siege-hint">Both players bring their own Chog. The game starts when both are ready.</p>
      </>}
      {menu === 'party-error' && <><h2>{partyError || 'Could not continue this room'}</h2><div className="row">{inviteCode && <Sticker tone="orange" sound="ui-back" onClick={() => { leaveLevel(true); setMenu('hero') }}>Back to invite</Sticker>}<Sticker sound="ui-back" onClick={() => leaveLevel()}>{inviteCode ? 'Start my own party' : 'Return to menu'}</Sticker></div></>}
      {menu === 'party-leave' && <><h2>Leave the porch?</h2><p>Your partner is still playing. Leaving ends this room.</p><div className="row"><Sticker tone="orange" sound="ui-close" onClick={() => setMenu(null)}>Keep playing</Sticker><Sticker sound="ui-back" onClick={() => leaveLevel()}>Leave room</Sticker></div></>}
      {menu === 'pause' && <>
        <span className="siege-eyebrow">EVERYONE, FREEZE.</span><h2>Candy break</h2><p>Your jars are safe while you’re here.</p>
        <div className="siege-menu-actions"><Sticker tone="orange" onClick={resume}>Keep playing →</Sticker><Sticker sound="ui-open" onClick={() => subMenu('settings')}>Settings</Sticker><Sticker sound="ui-open" onClick={() => subMenu('book')}>Field guide</Sticker><Sticker sound="ui-confirm" disabled={starting} onClick={() => void start(run?.tutorial ?? false)}>{starting ? 'Checking your $CHOG perks…' : 'Restart level'}</Sticker><Sticker sound="ui-back" onClick={() => leaveLevel()}>Level select</Sticker></div>
        <p className="siege-hint"><span className="siege-keys">Space: pause · 1 / 2: spells · Q: ability · R: ultimate · Z / X: talents · E: emotes · N: next wave<br /></span>Tap a pad to build. Select your hero, then tap ground to move. Drag traps onto the path.</p>
      </>}
      {menu === 'settings' && <>
        <h2>Set the mood</h2>
        <div className="siege-settings" onChange={event => { if ((event.target as HTMLInputElement).type === 'checkbox') playUi('ui-toggle') }}>
          {(['music', 'effects'] as const).map(key => <label key={key}><span>{key === 'music' ? 'Music' : 'Effects'} <b>{Math.round(save.settings[key] * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={save.settings[key]} onChange={event => updateSettings({ ...save.settings, [key]: Number(event.target.value) })} /></label>)}
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.lite} onChange={event => updateSettings({ ...save.settings, lite: event.target.checked })} /><span>Lite mode<small>No ambience, fewer effects and less idle animation, for slower phones.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.shake} onChange={event => updateSettings({ ...save.settings, shake: event.target.checked })} /><span>Screen shake<small>Reduced-motion preferences always take priority.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" disabled={!canVibrate} checked={save.settings.vibration && canVibrate} onChange={event => { updateSettings({ ...save.settings, vibration: event.target.checked }); if (event.target.checked) { setHaptics(true); haptic('jar') } }} /><span>Vibration<small>{canVibrate ? 'A short buzz when a jar is stolen, a boss falls or the last star lands. Reduced-motion preferences always take priority.' : 'This browser can’t vibrate.'}</small></span></label>
          <label className="siege-toggle"><input type="checkbox" checked={save.settings.autoFullscreen} onChange={event => updateSettings({ ...save.settings, autoFullscreen: event.target.checked })} /><span>Full screen on Play<small>On phones, enter full screen and request landscape. On iPhone, show Home Screen steps once.</small></span></label>
          <label className="siege-toggle"><input type="checkbox" disabled={!shop.owned.includes(21)} checked={save.settings.gold && shop.owned.includes(21)} onChange={event => updateSettings({ ...save.settings, gold: event.target.checked })} /><span>Golden towers<small>{shop.owned.includes(21) ? 'Dress all four classic towers in gold.' : 'Available in the $KNOCK shop.'}</small></span></label>
          {STATS_URL && <label className="siege-toggle"><input type="checkbox" checked={shareStats} onChange={event => { setStatsEnabled(event.target.checked); setShareStats(event.target.checked) }} /><span>Share anonymous play stats<small>Your runs count toward the public live stats. A random id per browser, plus the name of the site that linked you here (never the full address) and whether it’s a phone, tablet or desktop. No wallet or IP address is stored; a salted IP hash is kept for one day only to stop spam.</small></span></label>}
        </div>
        {/* Done stays in view at the dialog's bottom edge however far the list scrolls. */}
        <div className="siege-sticky-foot"><Sticker tone="orange" sound="ui-close" onClick={() => setMenu(returnMenu)}>Done</Sticker></div>
      </>}
      {menu === 'book' && <>
        <span className="siege-eyebrow">THE PORCH KEEPER’S</span><h2 tabIndex={-1} data-initial-focus>Field guide</h2>
        {assets && <FieldGuide assets={run?.assets ?? assets} seen={save.seen} heroId={run?.id ?? (valid ? Number(hero) : 1)} />}
        <h3>How your score adds up</h3><p>100 per Chog stopped + 250 per jar saved + 1,000 per star + 300 per early wave call. On victory, add 10 for each full second remaining from 300 seconds (up to 3,000). Time counts simulated play, excluding pauses and tutorial waiting. Defeats get no time bonus. Your best score is saved for each level.</p><p className="siege-hint">Scores live in this browser; they are not verified leaderboards and never earn $KNOCK.</p><Sticker sound="ui-back" onClick={() => setMenu(returnMenu)}>← Back</Sticker>
      </>}
      {menu === 'intro' && <>
        {intro.startsWith('boss:') ? assets && <BossCard assets={assets} id={intro.slice(5)} sheet={scene.current?.bossSheet} /> : <>
          <span className="siege-eyebrow">LOOK WHO’S AT THE DOOR</span><h2>{ENEMIES[intro as EnemyKind].name}</h2>{assets && <EnemyPortrait assets={run?.assets ?? assets} kind={intro as EnemyKind} id={scene.current?.enemies.find(enemy => enemy.active && enemy.kind === intro && !CRUDE_TEXT_CHOGS.has(enemy.id))?.id ?? Number(hero)} />}<p>{ENEMIES[intro as EnemyKind].description}</p>
        </>}
        <Sticker tone="orange" onClick={resume}>{intro.startsWith('boss:') ? 'Bring it on →' : 'Got it. Come on in →'}</Sticker>
      </>}
      {menu === 'result' && outcome && <div className={outcome.won ? 'siege-win' : ''}>
        {outcome.party && <div className="siege-party-heroes" aria-label="Porch Party result">{outcome.party.map((player, slot) => <figure key={slot}><img src={thumb(player.id, true)} alt={`Chog #${player.id}`} /><figcaption>Chog #{player.id} · Lv {player.level}</figcaption></figure>)}</div>}
        <span className="siege-eyebrow">{outcome.party ? 'PORCH PARTY' : unsaved ? 'CHALLENGE RUN · NOT SAVED' : outcome.mode === 'endless' ? 'ENDLESS · TOWN SQUARE' : outcome.mode === 'daily' ? `DAILY #${outcome.daily} · ${NIGHTS[outcome.theme].name.toUpperCase()}` : outcome.won ? 'THE SWEET TASTE OF' : 'THE NEIGHBOURHOOD SAYS THANKS'}</span>
        <h2>{outcome.mode === 'endless' ? `Wave ${outcome.wave}!` : outcome.won ? 'Sweet victory!' : 'They got the candy.'}</h2>
        {outcome.mode !== 'endless' && (outcome.won ? <ResultStars count={outcome.stars} fx={(run?.assets ?? assets)?.atlases.find(a => a.key === 'fx')} shake={save.settings.shake} sfx={sfx} /> : stars(0))}{/* A win that opens the next night says so in place of "The porch is yours.", popping in just after the last star lands; the card has no room for another line on a landscape phone. */}
        <p>{outcome.mode === 'endless' ? 'You held the porch as long as you could. The waves never stop.' : outcome.won ? <>{outcome.jars} jars saved. {opened ? <b className="siege-unlocked" style={{ animationDelay: `${SLAMS[Math.max(1, outcome.stars) - 1] + IMPACT + 150}ms` }}><img src="/art/icons/key.svg" alt="" />Night {String(opened).padStart(2, '0')} unlocked!</b> : starsShort ? `Win with ${UNLOCK_STARS}★ to unlock Night ${String(starsShort).padStart(2, '0')}.` : 'The porch is yours.'}</> : defeatTip}</p>
        <p className="siege-score"><CountUp value={outcome.score} ms={outcome.won && outcome.stars ? SLAMS[outcome.stars - 1] + IMPACT : 0} /> points<small>{outcome.party ? 'Team score' : run?.rival ? <>You {outcome.score.toLocaleString()} · Them {run.rival.score.toLocaleString()} · <b>{outcome.score > run.rival.score ? 'You beat them!' : 'So close!'}</b></> : outcome.mode === 'endless' ? `Best wave: ${save.endless.wave} · best score ${save.endless.score.toLocaleString()}` : outcome.mode === 'daily' && run?.daily ? `Best on Daily #${outcome.daily}: ${(save.daily[run.daily.day] ?? outcome.score).toLocaleString()}` : `Best on ${LEVELS[(run?.level ?? level) - 1].name}: ${(save.scores[run?.level ?? level] ?? outcome.score).toLocaleString()}`}</small></p>
        <div className="siege-result-stats"><span><b>{outcome.kills}</b> Chogs stopped</span><span><b>{outcome.mode === 'endless' ? outcome.wave : `${outcome.wave}/${LEVELS[(run?.level ?? level) - 1].waves.length}`}</b> {outcome.mode === 'endless' ? 'wave reached' : 'waves called'}</span><span><b>{outcome.heroLevel}</b> hero level</span></div>
        <div className="row">{outcome.party ? <Sticker tone="orange" onClick={() => leaveLevel()}>New Porch Party →</Sticker> : nextLevel ? <><Sticker tone="orange" sound="ui-confirm" disabled={starting} onClick={() => toPicker(nextLevel)}>Next night →</Sticker><Sticker sound="ui-confirm" disabled={starting} onClick={() => void start(false)}>Play again</Sticker></> : <Sticker tone="orange" sound="ui-confirm" disabled={starting} onClick={() => void start(false)}>{outcome.won ? 'Another night?' : 'Try again →'}</Sticker>}<Sticker sound="ui-back" onClick={() => leaveLevel()}>Level select</Sticker></div>
        {/* After the tutorial night (often a random guest Chog from one-tap Play), point at the hero picker. */}
        {run?.tutorial && !outcome.party && <button className="siege-text-button" onClick={() => toPicker(nextLevel || run.level)}>Every Chog plays differently: pick yours →</button>}
        {run && !run.coop ? <ShareCard assets={run.assets} kit={resolveKit(run.assets.kits, run.assets.traits, run.assets.chogs, run.id, run.home)} costume={run.costume} result={outcome} bosses={scene.current?.runStats?.().bossesDefeated} featured={run.id === chogOfDay} seed={run.seed} back={!!run.rival}>{feedbackLink}</ShareCard> : feedbackLink}
      </div>}
      {menu === 'shop' && assets && <Shop assets={assets} kit={kit ?? resolveKit(assets.kits, assets.traits, assets.chogs, 1)} shop={shop} wallet={activeWallet} bank={bank} inLevel={!!run} onBack={() => setMenu(returnMenu)} />}
      {menu === 'shop' && !assets && (failed === 'candy' ? <RetryPanel stage="candy" onRetry={retry}><Sticker sound="ui-back" onClick={() => setMenu(returnMenu)}>← Back</Sticker></RetryPanel> : <StageLabel stage="candy" />)}
      {saveWarning && <p className="siege-save-warning" role="status">This browser couldn’t save progress. Your current game is still safe.</p>}
      {onBack && <button className="siege-text-button" onClick={onBack}>← Back to Knock</button>}
    </Modal>}
    {/* A sibling of the result card's dialog, not a child: it opens on top without replaying the card's fanfare, and its Escape stays its own. */}
    {feedback === 'open' && run && outcome && <Modal label="Send feedback" className="siege-modal--feedback" onEscape={() => setFeedback('')}>
      <Feedback context={{ level: run.coop ? `party-${run.level}` : run.mode === 'level' ? String(run.level) : run.mode, won: outcome.won, stars: outcome.stars, hero: run.id }} onSent={() => setFeedback('sent')} />
    </Modal>}
  </div>
}
