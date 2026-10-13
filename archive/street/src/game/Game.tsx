import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { zeroAddress, type Address } from 'viem'
import {
  abi,
  KNOCK,
  client,
  connectWallet,
  inventory,
  isFork,
  isSandbox,
  knockEvents,
  nextDay,
  onTransactionConfirmed,
  ownerOf,
  readHouses,
  readCrews,
  readNight,
  readStreet,
  send,
  txUrl,
  walletAccount,
  type House,
  type Visit,
  type Night,
} from '../chain'
import { MyHouse } from '../hud/MyHouse'
import { Session } from '../hud/Session'
import { HouseBadges, PlaqueInput, Share, Sticker } from '../ui'
import { CandyChip, Earned, SandboxBanner } from '../hud/Candy'
import { Tonight } from '../hud/Tonight'
import { TownMap } from '../hud/TownMap'
import { getTown } from '../town'
import { liteMode, type Aim, type Shot } from './aim'
import { visitText } from '../words'
import { icon, World, type Chog, type Flight } from './Scene'
import './game.css'

const TRICKS = [
  { item: 2, name: 'Egg', key: '1' },
  { item: 3, name: 'Toilet paper', key: '2' },
  { item: 4, name: 'Mustache', key: '3' },
]
const CALLOUT = ['treat', 'boing', 'splat', 'swept', 'looted', 'caught'] // pinned contract outcomes 0..5
export default function Game({ initialPlayer, initialHouse }: { initialPlayer: number | null; initialHouse: number | null }) {
  const [all, setAll] = useState<Chog[]>([])
  const [streetIndex, setStreetIndex] = useState(0)
  const [mapOpen, setMapOpen] = useState(false)
  const [arrival, setArrival] = useState(0)
  const [houses, setHouses] = useState<Map<number, House>>(new Map())
  const [crews, setCrews] = useState<Map<number, number>>(new Map())
  const [night, setNight] = useState<Night | null>(null)
  const lastBoss = useRef<Night | null>(null)
  const [bossHit, setBossHit] = useState(0)
  const [doorMode, setDoorMode] = useState<'house' | 'boss'>('house')
  const [feed, setFeed] = useState<readonly Visit[]>([])
  const [now, setNow] = useState(0n)
  const [playerInput, setPlayerInput] = useState('')
  const [player, setPlayer] = useState<number | null>(null)
  const [owner, setOwner] = useState<Address | null>(null)
  const [findInput, setFindInput] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const [near, setNear] = useState<number | null>(null)
  const [balances, setBalances] = useState<readonly bigint[]>(Array(7).fill(0n))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [txLink, setTxLink] = useState<string | null>(null)
  useEffect(() => onTransactionConfirmed(hash => setTxLink(txUrl(hash))), [])
  const [flight, setFlight] = useState<Flight | null>(null)
  const [callouts, setCallouts] = useState<{ art: string; at: number; caption?: string }[]>([])
  const callout = callouts[0]
  const showCallout = useCallback((art: string, caption?: string) => setCallouts(queue => [...queue, { art, caption, at: performance.now() }]), [])
  const [drawer, setDrawer] = useState(false)
  const keys = useRef(new Set<string>())
  const touch = useRef({ x: 0, y: 0 })
  const [lite] = useState(liteMode)
  const [aim, setAim] = useState<Aim | null>(null)
  const aimRef = useRef<Aim | null>(null)
  const aimPointer = useRef<{ x: number; y: number } | null>(null)
  const sampleShot = useRef<(() => Shot) | null>(null)
  const touchAim = useRef<{ x: number; y: number; moved: boolean; pointerId: number } | null>(null)
  const [streak, setStreak] = useState(0)
  const [grade, setGrade] = useState<{ text: string; id: number } | null>(null)
  const gradeId = useRef(0)
  const showGrade = (text: string) => setGrade({ text, id: ++gradeId.current })
  const [earned, setEarned] = useState<{ amount: number; candy?: string }[]>([])
  const [shared, setShared] = useState<{ to: number; item: number; outcome: number } | null>(null)
  const [gossip, setGossip] = useState(false)
  const [controls, setControls] = useState(false)
  const [stick, setStick] = useState({ x: 0, y: 0 })
  const initialized = useRef(false)
  const acting = useRef(false)
  const refreshVersion = useRef(0)
  const [metrics, setMetrics] = useState('')
  const town = useMemo(() => getTown(all), [all])
  const street = town.streets[streetIndex]
  const chogs = useMemo(() => street?.chogs ?? [], [street])

  useEffect(() => {
    fetch('/chogs.json')
      .then(r => {
        if (!r.ok) throw Error(`Snapshot HTTP ${r.status}`)
        return r.json()
      })
      .then(data => setAll(data.chogs))
      .catch(e => setMessage(String(e)))
  }, [])

  const refresh = useCallback(async () => {
    if (!chogs.length) return
    const version = ++refreshVersion.current
    const ids = chogs.map(c => c.id)
    if (player !== null && !ids.includes(player)) ids.push(player)
    const blockTime = await client.getBlock()
    const [states, street, stock, crewStates, tonight] = await Promise.all([
      readHouses(ids),
      readStreet(),
      player ? inventory(player) : Promise.resolve(null),
      readCrews(ids),
      readNight(blockTime.timestamp / 86400n, player),
    ])
    if (version !== refreshVersion.current) return
    setNow(blockTime.timestamp)
    setHouses(states)
    setFeed(street)
    setCrews(crewStates)
    setNight(tonight)
    if (lastBoss.current?.day === tonight.day && !lastBoss.current.boss.defeated && tonight.boss.defeated) showCallout('boss-down')
    lastBoss.current = tonight
    if (stock) setBalances(stock)
  }, [chogs, player, showCallout])

  useEffect(() => {
    const run = () => refresh().catch(e => setMessage(`Chain read failed: ${String(e)}`))
    run()
    const timer = setInterval(run, 15_000) // other players knock too
    return () => { clearInterval(timer); refreshVersion.current++ }
  }, [refresh])
  useEffect(() => client.watchContractEvent({
    address: KNOCK, abi, eventName: 'BossHit', pollingInterval: 4_000,
    onLogs: logs => {
      if (logs.some(log => log.args.day === lastBoss.current?.day)) setBossHit(performance.now())
      void refresh().catch(e => setMessage(`Chain read failed: ${String(e)}`))
    },
    onError: () => { /* The regular refresh still updates boss health if the event filter fails. */ },
  }), [refresh])
  useEffect(() => {
    setDoorMode(near !== null && near === night?.boss.house && !night.boss.defeated ? 'boss' : 'house')
  }, [near, night?.boss.house, night?.day])
  useEffect(() => {
    if (!flight || flight.phase === 'knock') return
    const timer = setTimeout(() => setFlight(null), 1500)
    return () => clearTimeout(timer)
  }, [flight])
  useEffect(() => {
    if (!callout) return
    const timer = setTimeout(() => setCallouts(queue => queue.slice(1)), 1800)
    return () => clearTimeout(timer)
  }, [callout])
  useEffect(() => {
    if (!grade) return
    const timer = setTimeout(() => setGrade(null), 1500)
    return () => clearTimeout(timer)
  }, [grade])

  const chooseId = useCallback(async (id: number) => {
    if (acting.current || aimRef.current) return
    if (!all.some(c => c.id === id)) return setMessage('There is no Chog with that number.')
    try {
      const address = await ownerOf(id)
      if (!isFork && (walletAccount() ?? await connectWallet()).toLowerCase() !== address.toLowerCase())
        return setMessage(`Connect the wallet that owns Chog #${id} to play as it.`)
      const stock = await inventory(id)
      setOwner(address)
      refreshVersion.current++
      setPlayer(id)
      setNight(current => current?.player === id ? current : null)
      setEarned([]); setShared(null); setCallouts([])
      setPlayerInput(String(id))
      setBalances(stock)
      setControls(false)
      setMessage(`You are Chog #${id}. Walk to a door and knock!`)
    } catch (error) {
      setMessage(`Couldn't play as #${id}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    }
  }, [all])
  const travel = (index: number, to: number | null = null) => {
    if (acting.current || aimRef.current || !town.streets[index]) return
    setControls(false); setDrawer(false); setMapOpen(false)
    keys.current.clear(); touch.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 })
    if (index !== streetIndex) refreshVersion.current++
    setTarget(to); setFlight(null)
    setStreetIndex(index)
    if (index !== streetIndex || to === null) { setNear(null); setArrival(value => value + 1) }
  }
  const goToHouse = (id: number) => {
    if (acting.current || aimRef.current) return
    const destination = town.streetOf(id)
    if (!destination) return setMessage('There is no house with that number.')
    travel(destination.index, id)
    setMessage(`Walking to #${id}…`)
  }

  useEffect(() => {
    if (!all.length || initialized.current) return
    initialized.current = true
    // A play URL selects a street without bypassing App's wallet checks.
    const start = town.streetOf(initialPlayer ?? Number(new URLSearchParams(window.location.search).get('play')))
    travel(start?.index ?? town.neighbourhoods.find(n => n.name === 'Rare Row')!.streets[0].index)
    if (initialPlayer !== null) void chooseId(initialPlayer)
    if (initialHouse !== null) goToHouse(initialHouse)
  }, [all, initialPlayer, initialHouse, chooseId, town])

  const act = async (to: number | null, work: () => Promise<void>) => {
    if (!owner || player === null || acting.current) return
    acting.current = true
    setBusy(true)
    if (to !== null) setTarget(to)
    try {
      if ((await ownerOf(player)).toLowerCase() !== owner.toLowerCase()) throw Error('This Chog has a new owner; choose it again')
      await work()
      await refresh()
    } catch (error) {
      setFlight(null)
      setMessage(`That didn't work: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    } finally {
      acting.current = false
      setBusy(false)
    }
  }
  const confirm = async (action: Parameters<typeof send>[1], args: bigint[]) => {
    const events = await knockEvents(await send(owner!, action, args))
    for (const event of events) {
      if (event.eventName === 'Knocked') {
        const outcome = Number(event.args.outcome)
        showCallout(CALLOUT[outcome])
        if (outcome === 0 || outcome === 4) setEarned(queue => [...queue, { amount: outcome === 0 ? 100 : 50 }])
        setShared(outcome === 0 || outcome === 2 || outcome === 4 ? { to: Number(event.args.to), item: Number(event.args.item), outcome } : null)
      }
      if (event.eventName === 'BossHit') {
        setBossHit(performance.now())
        showGrade(`−${event.args.damage} HP`)
        setMessage(`Great Pumpkin hit for ${event.args.damage} damage!`)
      }
      if (event.eventName === 'BossLooted') {
        setMessage(`Boss loot: +${event.args.candy} candy!`)
        setEarned(queue => [...queue, { amount: 300, candy: event.args.candy.toString() }])
      }
    }
    // A visit can pay its own reward and complete a route in the same receipt.
    if (events.some(event => event.eventName === 'RouteCompleted')) {
      showCallout('route-done', '+10 candy')
      setEarned(queue => [...queue, { amount: 500, candy: '10' }])
    }
    return events
  }
  const cancelAim = () => {
    aimRef.current = null; sampleShot.current = null; touchAim.current = null
    setAim(null)
  }
  useEffect(() => { cancelAim(); setBossHit(0) }, [night?.day, player])
  const beginAim = (item: number) => {
    const boss = doorMode === 'boss' && near === night?.boss.house
    if (mapOpen || near === null || player === null || (!boss && near === player) || !owner || busy || drawer || !mine || !tonight || (left <= 0 && (boss || !revenge)) || (boss && night?.boss.defeated)) return
    if (balances[item - 1] === 0n && !(item === 2 && fresh)) return
    const next = { item, target: near, boss }
    aimRef.current = next; aimPointer.current = null
    keys.current.clear(); touch.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 })
    setAim(next); setTarget(null); setGrade(null)
    setMessage(`Aim at ${boss ? 'the Great Pumpkin' : 'the house'}. Release to throw. Escape cancels.`)
  }
  const release = () => {
    const current = aimRef.current
    const shot = sampleShot.current?.()
    if (!current || !shot || (touchAim.current && !touchAim.current.moved)) return cancelAim()
    cancelAim()
    if (shot.grade === 'miss') {
      setStreak(0); showGrade('MISS — try again!')
      setMessage('Miss! No transaction, no knock used.')
      setFlight({ item: current.item, target: current.target, outcome: -1, start: performance.now(), phase: 'miss', shot })
      return
    }
    navigator.vibrate?.(25)
    setStreak(value => value + 1)
    showGrade(shot.grade === 'bullseye' ? 'BULLSEYE!' : 'HIT!')
    const { item, target: to } = current
    if (player === null || !owner) return
    void act(to, async () => {
      setFlight({ item, target: to, outcome: -1, start: performance.now(), phase: 'knock', shot })
      const events = await confirm(current.boss ? 'hitBoss' : 'knock', current.boss ? [BigInt(player), BigInt(item)] : [BigInt(player), BigInt(to), BigInt(item)])
      const event = events.find(event => event.eventName === 'Knocked')
      if (!current.boss && !event) throw Error('Knocked event missing')
      const outcome = event ? Number(event.args.outcome) : 2
      setFlight({ item, target: to, outcome, start: performance.now(), phase: 'result', shot })
      if (!current.boss) setMessage(events.some(event => event.eventName === 'Haunted') ? [
        "Nobody's home, but the door creaks open: +1 candy!",
        "Nobody's home… and the house throws it back at you!",
        "Direct hit! Nobody's home to see it.",
      ][outcome] : ['You got a treat!', 'It bounced back at you!', 'Direct hit!'][outcome])
    })
  }
  const releaseRef = useRef(release)
  releaseRef.current = release
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!aimRef.current || (touchAim.current && e.pointerId !== touchAim.current.pointerId)) return
      aimPointer.current = { x: e.clientX, y: e.clientY }
      if (touchAim.current && Math.hypot(e.clientX - touchAim.current.x, e.clientY - touchAim.current.y) > 8) touchAim.current.moved = true
    }
    const up = (e: PointerEvent) => {
      if (!aimRef.current || (touchAim.current && e.pointerId !== touchAim.current.pointerId)) return
      aimPointer.current = { x: e.clientX, y: e.clientY }
      releaseRef.current()
    }
    const cancel = () => { cancelAim(); keys.current.clear(); touch.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 }) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel)
    }
  }, [])
  const cleanUp = () => {
    if (near === null || player === null || !owner) return
    const to = near
    return act(to, async () => {
      await confirm('clean', [BigInt(player), BigInt(to)])
      showCallout('swept')
      setMessage(`You cleaned up #${to}. Good neighbour!`)
    })
  }
  const raid = () => {
    if (near === null || player === null || !owner || left <= 0) return
    const to = near
    return act(to, async () => {
      const events = await confirm('raid', [BigInt(player), BigInt(to)])
      const event = events.find(event => event.eventName === 'Knocked')
      if (!event) throw Error('Knocked event missing')
      const outcome = Number(event.args.outcome)
      setFlight({ item: 0, target: to, outcome, start: performance.now(), phase: 'result' })
      const burn = events.find(event => event.eventName === 'TransferSingle' && event.args.id === 1n && event.args.to === zeroAddress)
      const lost = burn?.eventName === 'TransferSingle' ? burn.args.value : 0n
      setMessage(outcome === 4 ? 'LOOTED! You grabbed candy and any $CHOG paid by the bowl.' : `CAUGHT! −${lost} candy (up to 2).`)
      if (outcome === 5) showGrade(`−${lost} candy`)
    })
  }

  // Keys: WASD / arrows walk (read by the scene), 1-3 select a trick at the door you're at.
  const knockKey = useRef(beginAim)
  knockKey.current = beginAim
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || document.querySelector('dialog[open]')) return
      const key = e.key.toLowerCase()
      if (key === 'escape') cancelAim()
      if ('wasd'.includes(key) || key.startsWith('arrow')) {
        e.preventDefault()
        setTarget(null)
        keys.current.add(key)
      }
      const trick = TRICKS.find(t => t.key === key)
      if (trick && !e.repeat) knockKey.current(trick.item)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const isChog = (value: string) => all.some(c => c.id === Number(value))
  const validPlayer = isChog(playerInput)
  const validFind = isChog(findInput)
  const mine = player === null ? undefined : houses.get(player)
  const tonight = night?.player === player ? night : null
  const fresh = mine?.day !== now / 86400n // the first action mints tonight's ration before it resolves
  const eggRation = mine && fresh && tonight ? (tonight.theme === 2 ? 6n : 3n) : 0n
  const costumed = (mine?.costume === 6n && balances[5] > 0n) || (mine?.costume === 7n && balances[6] > 0n)
  const limit = (mine?.costume === 7n && balances[6] > 0n ? 4 : 3) + (tonight?.theme === 3 && costumed ? 1 : 0)
  const left = Math.max(0, limit - (mine && !fresh ? Number(mine.knocksUsed) : 0))
  const revenge = near !== null && !!mine?.revengeReady && mine.revengeOn === BigInt(near)
  const door = near === null ? undefined : houses.get(near)
  const atBoss = near !== null && near === tonight?.boss.house
  const bossMode = atBoss && doorMode === 'boss'
  const treatItem = TRICKS.find(t => balances[t.item - 1] > 0n || (t.item === 2 && fresh))?.item

  useEffect(() => {
    if (target === null || near !== target) return
    setMessage(current => current === `Walking to #${target}…`
      ? near === night?.boss.house && !night.boss.defeated ? 'The Great Pumpkin! Pick a trick to hit it.'
        : near === player ? 'Your house. Open My house to fill your bowl.'
          : `You're at #${near}. Pick a trick.`
      : current)
  }, [near, target, player, night?.boss.house, night?.boss.defeated, message])

  return (
    <main className={`game ${lite ? 'game-lite' : 'game-full'} ${aim ? 'is-aiming' : ''}`}>
      <div className="game-canvas">
        <Canvas
          dpr={[1, lite ? 1.25 : 2]}
          gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: import.meta.env.DEV }}
          camera={{ position: [-31, 9, 5.5], fov: 55 }}
        >
          <World chogs={chogs} houses={houses} now={now} neighbourhood={street?.neighbourhood ?? 'Rare Row'} colour={street?.colour ?? '#ffc93c'} arrival={arrival} playerId={player} targetId={target}
            onNear={setNear} keys={keys} touch={touch} flight={flight} lite={lite} all={all} feed={feed}
            night={tonight} crews={crews} bossHit={bossHit}
            aim={aim} aimPointer={aimPointer} sampleShot={sampleShot} onMetrics={new URLSearchParams(window.location.search).has('stats') ? setMetrics : undefined}
            paused={mapOpen} />
        </Canvas>
      </div>

      <header className="hud-top">
        <div className="row top-compact">
          <CandyChip owner={owner} />
          <Sticker disabled={busy || !!aim || !street} aria-haspopup="dialog" onClick={() => {
            keys.current.clear(); touch.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 }); setMapOpen(true)
          }}>Map</Sticker>
          <Sticker className="controls-toggle" onClick={() => setControls(!controls)} aria-expanded={controls}>Play / Find</Sticker>
        </div>
        {isSandbox && <SandboxBanner />}
        <img className="hud-logo" src="/art/ui/logo.svg" alt="Knock" />
        <form className={`row player-controls ${controls ? 'open' : ''}`} onSubmit={e => { e.preventDefault(); void chooseId(Number(playerInput)) }}>
          <PlaqueInput label="Play as Chog #" value={playerInput} onChange={setPlayerInput} min={1} max={1969} />
          <Sticker icon="key" tone="orange" type="submit" disabled={!validPlayer || busy || !!aim}
            title={validPlayer ? undefined : 'Enter a Chog number from 1 to 1969'}>
            Play
          </Sticker>
        </form>
        <form className={`row player-controls ${controls ? 'open' : ''}`} onSubmit={e => { e.preventDefault(); goToHouse(Number(findInput)) }}>
          <PlaqueInput label="Find house #" value={findInput} onChange={setFindInput} min={1} max={1969} />
          <Sticker icon="lantern" type="submit" disabled={!validFind || busy || !!aim}
            title={validFind ? undefined : 'Enter a house number from 1 to 1969'}>
            Go
          </Sticker>
        </form>
        <div className="row hud-line">
          <span>{street?.name ?? 'Lighting Chog Town…'}</span>
          {player !== null && (
            <span className="knocks" aria-label={`${left} knocks left today`}>
              {Array.from({ length: limit }, (_, i) => (
                <img key={i} className={i < left ? '' : 'used'} src="/art/icons/door-knocker.svg" alt="" />
              ))}
            </span>
          )}
          {player !== null && (
            <Sticker icon="candy-bucket" tone="purple" disabled={busy || !!aim} onClick={() => setDrawer(!drawer)} aria-expanded={drawer}>
              {drawer ? 'Back to the street' : 'My house'}
            </Sticker>
          )}
          {player !== null && owner && <Session key={`${owner}:${player}`} owner={owner} id={player} disabled={busy || !!aim} />}
          {isFork && player !== null && (
            <Sticker className="next-night" icon="moon-phase" disabled={busy || !!aim} title="Test only: skip to the next night"
              onClick={() => nextDay().then(refresh).then(() => setMessage('A new night falls…'))}>
              Next night
            </Sticker>
          )}
        </div>
        {mine?.revengeReady && <Sticker tone="orange" disabled={busy || !!aim} onClick={() => goToHouse(Number(mine.revengeOn))}>Knock back #{mine.revengeOn.toString()}</Sticker>}
        {message && <p className="bubble" role="status">{message}</p>}
        <div className="row">{shared && <Share {...shared} />}{txLink && <a className="sticker" href={txLink} target="_blank" rel="noreferrer">View on Monadscan</a>}{streak > 0 && <span className="style-streak">Style streak ×{streak} · cosmetic</span>}</div>
      </header>

      {tonight && !drawer && <Tonight night={tonight} crew={player === null ? 0 : crews.get(player) ?? 0} fresh={fresh} disabled={busy || !!aim}
        go={goToHouse}
        claim={async day => {
          if (player === null) return
          await act(null, async () => { await confirm('claimBoss', [BigInt(player), day]) })
        }}
        join={async crew => {
          if (player === null) return
          await act(null, async () => {
            await confirm('joinCrew', [BigInt(player), BigInt(crew)])
            setMessage('Crew joined! Your future actions score for your crew.')
          })
        }} />}

      {near !== null && !drawer && (
        <section className="board hud-door" aria-hidden={!!aim} aria-label={`House #${near}'s door`}>
          <h2>
            <img src="/art/icons/door-knocker.svg" alt="" /> {bossMode ? 'The Great Pumpkin' : `House #${near}`}
            {revenge && !bossMode && <span className="revenge">Revenge treat / trick: free!</span>}
          </h2>
          {atBoss && <div className="row"><Sticker disabled={busy} aria-pressed={bossMode} onClick={() => setDoorMode('boss')}>Pumpkin</Sticker><Sticker disabled={busy} aria-pressed={!bossMode} onClick={() => setDoorMode('house')}>House #{near}</Sticker></div>}
          {bossMode && <p>{tonight?.boss.defeated ? 'The Great Pumpkin is down. Claim earned loot in Tonight.' : 'Aim a trick: egg 1, toilet paper 2, mustache 3 damage. Uses one regular knock; no free revenge.'}</p>}
          <HouseBadges house={door} />
          {!bossMode && door?.day === 0n && door.bowlCandy === 0n && !door.trap && <p>Nobody's home. The house may answer for itself.</p>}
          {player === null && <p>Choose a Chog to play, then knock.</p>}
          {player === near && !bossMode && (
            <Sticker icon="candy-bucket" tone="purple" onClick={() => setDrawer(true)}>This is your house</Sticker>
          )}
          {player !== null && (player !== near || bossMode) && <>
            {!bossMode && !!door && door.bowlCandy > 0n && <>
              <div className="row">
                <Sticker icon="candy" tone="gold" disabled={busy || !tonight || !mine || !treatItem || (left <= 0 && !revenge)}
                  title={!treatItem ? 'Needs a held trick, or fresh daily eggs' : left <= 0 && !revenge ? 'No knocks left tonight' : 'Aim at the house to take a treat'}
                  onClick={e => { if (treatItem && !['touch', 'pen'].includes((e.nativeEvent as PointerEvent).pointerType)) beginAim(treatItem) }}
                  onPointerDown={e => {
                    if (e.pointerType === 'mouse' || !treatItem) return
                    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
                    beginAim(treatItem)
                    touchAim.current = { x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId }
                  }}>Treat</Sticker>
                <Sticker icon="raid" tone="orange" disabled={busy || !tonight || !mine || left <= 0} onClick={() => void raid()}>Raid</Sticker>
              </div>
              <p>Treat: take 1 candy, plus any $CHOG the bowl pays. Aim with a held trick; you keep it on a treat.</p>
              <p>Raid: grab up to 3 candy and their $CHOG. A trap catches you for up to −2 candy unless you wear a held ghost sheet. Always costs a regular knock, never the free revenge knock.</p>
            </>}
            <div className="row">
              {(bossMode || !door?.bowlCandy) && TRICKS.map(t => {
                const held = balances[t.item - 1]
                const count = held + (t.item === 2 ? eggRation : 0n)
                const usable = held > 0n || (t.item === 2 && fresh)
                const reason = !tonight || !mine ? 'Loading your Chog' : bossMode && tonight.boss.defeated ? 'Boss defeated' : !usable ? `You have no ${t.name.toLowerCase()}` : left <= 0 && (bossMode || !revenge) ? 'No knocks left tonight' : ''
                return (
                  <Sticker key={t.item} icon={icon[t.item]} tone="orange" badge={count.toString()} aria-label={`${t.name}, ${count} left${t.item === 2 && eggRation > 0n ? ", including tonight's ration" : ''}`}
                    disabled={busy || !!reason} title={reason || `Press ${t.key}, aim, then release`} onClick={e => { if (!['touch', 'pen'].includes((e.nativeEvent as PointerEvent).pointerType)) beginAim(t.item) }}
                    onPointerDown={e => {
                      if (e.pointerType === 'mouse') return
                      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
                      beginAim(t.item)
                      touchAim.current = { x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId }
                    }}>
                    <span className="trick-name">{t.name}</span>
                  </Sticker>
                )
              })}
              {!bossMode && door && door.markUntil > now && (
                <Sticker icon="broom" disabled={busy || left <= 0} title="Use a knock to clean this house for free"
                  onClick={cleanUp}>
                  Clean it up
                </Sticker>
              )}
            </div>
            {(bossMode || !door?.bowlCandy) && eggRation > 0n && <p>Includes {eggRation.toString()} eggs from tonight's ration, received with your first action.</p>}
          </>}
        </section>
      )}

      {callout && (
        <div className="hud-callout" key={callout.at}>
          <img src={`/art/ui/${callout.art}.svg`} alt={callout.art.replace('-', ' ')} />
          {callout.caption && <p>{callout.caption}</p>}
        </div>
      )}

      {drawer && player !== null && owner && (
        <aside className="hud-drawer">
          <Sticker icon="bones" round aria-label="Close" className="drawer-close" onClick={() => setDrawer(false)} />
          <MyHouse id={player} owner={owner} house={mine} balances={balances} now={now} onDone={refresh} say={setMessage} showSession={false} />
        </aside>
      )}

      {mapOpen && <TownMap town={town} current={streetIndex} player={player} night={tonight} close={() => setMapOpen(false)}
        travel={index => { travel(index); setMessage(town.streets[index].name) }} go={goToHouse} />}
      {aim && <div className="aim-help bubble">Drag / move to aim · release to throw <Sticker onPointerUp={e => e.stopPropagation()} onClick={cancelAim}>Cancel</Sticker></div>}
      {grade && <div key={grade.id} className="aim-grade" role="status">{grade.text}</div>}
      {earned[0] && <Earned {...earned[0]} onClose={() => setEarned(queue => queue.slice(1))} />}
      <nav className="hud-joystick" aria-label="Walk">
        <Sticker className="joystick" aria-label="Drag to walk" disabled={!!aim || busy || drawer || mapOpen}
          onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setTarget(null) }}
          onPointerMove={e => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
            const box = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - box.left - box.width / 2, y = e.clientY - box.top - box.height / 2
            const scale = Math.max(40, Math.hypot(x, y))
            touch.current = { x: x / scale, y: -y / scale }
            setStick({ x: x / scale * 36, y: y / scale * 36 })
          }}
          onPointerUp={() => { touch.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 }) }}
          onPointerCancel={() => { touch.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 }) }}>
          <span className="joystick-knob" style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
        </Sticker>
      </nav>
      <Sticker className="gossip-toggle" icon="mailbox" round aria-label="Street gossip" aria-expanded={gossip} onClick={() => setGossip(!gossip)} />
      {new URLSearchParams(window.location.search).has('stats') && <output className="render-stats">{lite ? 'Lite' : 'Full'} · {metrics}</output>}

      {feed.length > 0 && !drawer && (
        <section className={`board hud-feed ${gossip ? 'open' : ''}`} aria-label="Street gossip">
          <h3>Street gossip</h3>
          {feed.slice(0, 4).map((v, i) => <p key={i}>{visitText(v, now)}</p>)}
        </section>
      )}
    </main>
  )
}
