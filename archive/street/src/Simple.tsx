import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { MyHouse } from './hud/MyHouse'
import { HouseBadges, PlaqueInput, Share, Sticker } from './ui'
import { CandyChip, Earned, SandboxBanner } from './hud/Candy'
import {
  client,
  inventory,
  isFork,
  isSandbox,
  knockEvents,
  nextDay,
  onTransactionConfirmed,
  ownerOf,
  readHouses,
  readStreet,
  readVisits,
  send,
  txUrl,
  walletAccount,
  type House,
  type Visit,
} from './chain'
import { visitText } from './words'
import { original, thumb } from './images'
import { WalletPicker, walletPlayHint, type WalletState } from './wallet'

type Chog = { id: number; art: number; name: string; side: string; background: string; tier: string }
const items = ['', 'Candy', 'Egg', 'Toilet paper', 'Mustache', 'Pumpkin trap', 'Ghost sheet', 'Witch hat']
const icons = ['', 'candy', 'egg', 'toilet-paper', 'paint-brush', 'pumpkin-trap', 'ghost-sheet', 'witch-hat']
const marks = ['', '', 'egg-splat', 'toilet-paper', 'painted-mustache']
const outcomes = ['treat', 'bounce', 'trick', 'clean', 'raid', 'caught']

function Portrait({
  chog,
  house,
  now,
  large = false,
}: {
  chog: Chog
  house?: House
  now: bigint
  large?: boolean
}) {
  const side = chog.side.toLowerCase()
  const mark = house && house.markUntil > now ? marks[Number(house.markItem)] : ''
  const costume = house?.costume === 6n ? 'ghost-sheet' : house?.costume === 7n ? 'witch-hat' : ''
  return (
    <span className={large ? 'portrait-frame large' : 'portrait-frame'}>
      <img src={thumb(chog.id)} alt={large ? chog.name : ''} loading="lazy"
        onError={e => { if (e.currentTarget.src !== original(chog.art)) e.currentTarget.src = original(chog.art) }} />
      {side && mark && <img className="portrait-overlay" src={`/art/overlays/${mark}-${side}.svg`} alt="" />}
      {side && costume && (
        <img className="portrait-overlay" src={`/art/overlays/${costume}-${side}.svg`} alt="" />
      )}
    </span>
  )
}

function HouseTile({
  chog,
  house,
  now,
  onOpen,
}: {
  chog: Chog
  house?: House
  now: bigint
  onOpen: () => void
}) {
  const states = [
    !house?.day && 'dark',
    house && house.markUntil > now && house.markItem === 2n && 'egged',
    house && house.markUntil > now && house.markItem === 3n && 'tp',
    house?.trap && 'pumpkin',
    house && house.bowlCandy > 0n && 'bowl',
  ].filter((state): state is string => typeof state === 'string')
  return (
    <li className="house" id={`house-${chog.id}`}>
      <button className="house-button" onClick={onOpen} aria-label={`Open Chog #${chog.id}'s house`}>
        <Portrait chog={chog} house={house} now={now} />
        <img className="layer" src={`/art/scenery/house-${(chog.id % 6) + 1}.svg`} alt="" />
        {states.map(state => (
          <img key={state} className="layer" src={`/art/scenery/state-${state}.svg`} alt="" />
        ))}
        <span className="plaque" aria-hidden="true">
          {chog.id}
        </span>
      </button>
    </li>
  )
}

export default function SimpleApp({ wallet }: { wallet: WalletState }) {
  const [chogs, setChogs] = useState<Chog[]>([])
  const [houses, setHouses] = useState<Map<number, House>>(new Map())
  const [feed, setFeed] = useState<readonly Visit[]>([])
  const [visits, setVisits] = useState<readonly Visit[]>([])
  const [now, setNow] = useState(0n)
  const [selected, setSelected] = useState<number | null>(null)
  const [playerInput, setPlayerInput] = useState('')
  const [player, setPlayer] = useState<number | null>(null)
  const [owner, setOwner] = useState<Address | null>(null)
  const [balances, setBalances] = useState<readonly bigint[]>(Array(7).fill(0n))
  const [goTo, setGoTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [transactionUrl, setTransactionUrl] = useState<string | null>(null)
  const [earned, setEarned] = useState(false)
  const [shared, setShared] = useState<{ to: number; item: number; outcome: number } | null>(null)
  useEffect(() => onTransactionConfirmed(hash => setTransactionUrl(txUrl(hash))), [])
  useEffect(() => {
    if (!isFork && owner && wallet.account?.toLowerCase() !== owner.toLowerCase()) {
      setPlayer(null)
      setOwner(null)
      setBalances(Array(7).fill(0n))
      setShared(null)
      setEarned(false)
      setMessage('Wallet changed. Choose a Chog from this wallet to play.')
    }
  }, [wallet.account, owner])
  useEffect(() => {
    fetch('/chogs.json')
      .then(r => {
        if (!r.ok) throw new Error(`Snapshot HTTP ${r.status}`)
        return r.json()
      })
      .then(data => setChogs(data.chogs))
      .catch(e => setMessage(`Could not load chogs.json: ${e.message}`))
  }, [])
  const refresh = useCallback(async () => {
    if (!chogs.length) return
    const block = await client.getBlock()
    const [states, street] = await Promise.all([readHouses(chogs.map(c => c.id)), readStreet()])
    setNow(block.timestamp)
    setHouses(states)
    setFeed(street)
    if (player !== null) setBalances(await inventory(player))
  }, [chogs, player])
  useEffect(() => {
    const run = () => refresh().catch(e => setMessage(`Chain read failed: ${e.message}`))
    run()
    const timer = setInterval(run, 15_000) // other players knock too: keep the street live
    return () => clearInterval(timer)
  }, [refresh])
  useEffect(() => {
    if (selected !== null) readVisits(selected).then(setVisits).catch(e => setMessage(`Visit read failed: ${String(e)}`)) // reloads with each refresh of the feed
  }, [selected, feed])
  const chooseId = async (id: number) => {
    if (!chogs.some(c => c.id === id)) {
      setMessage('Choose a Chog in this street.')
      return
    }
    if (!isFork && walletPlayHint(wallet, id)) {
      setMessage(walletPlayHint(wallet, id))
      return
    }
    try {
      const address = await ownerOf(id)
      if (!isFork && walletAccount()?.toLowerCase() !== address.toLowerCase())
        throw new Error('Connect the wallet that owns this Chog to play.')
      setOwner(address)
      setPlayer(id)
      setBalances(await inventory(id))
      setMessage(`Playing as #${id} from ${address}`)
    } catch (e) {
      setMessage(`Owner lookup failed: ${String(e)}`)
    }
  }
  const choosePlayer = (event: React.FormEvent) => {
    event.preventDefault()
    void chooseId(Number(playerInput))
  }
  const act = async (functionName: Parameters<typeof send>[1], args: bigint[], knock = false) => {
    if (player === null || !owner) return
    setBusy(true)
    if (!isFork) setTransactionUrl(null)
    setMessage('Waiting for transaction…')
    try {
      const currentOwner = await ownerOf(player)
      if (currentOwner.toLowerCase() !== owner.toLowerCase())
        throw new Error('Chog owner changed; choose it again')
      const hash = await send(owner, functionName, args)
      if (knock) {
        const events = await knockEvents(hash)
        const event = events.find(event => event.eventName === 'Knocked')
        if (!event) throw new Error('Knocked event missing')
        const outcome = Number(event.args.outcome)
        setMessage(events.some(event => event.eventName === 'Haunted') ? [
          "Nobody's home, but the door creaks open: +1 candy!",
          "Nobody's home… and the house throws it back at you!",
          "Direct hit! Nobody's home to see it.",
        ][outcome] : `#${player} knocked: ${outcomes[outcome]} · ${hash}`)
        setEarned(outcome === 0)
        setShared(outcome === 0 || outcome === 2 ? { to: Number(args[1]), item: Number(args[2]), outcome } : null)
      } else setMessage(`${functionName} confirmed · ${hash}`)
      await refresh()
    } catch (e) {
      setMessage(`Transaction failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const current = selected === null ? undefined : chogs.find(c => c.id === selected)
  const house = selected === null ? undefined : houses.get(selected)
  const mine = player === selected
  const playerHouse = player === null ? undefined : houses.get(player)
  const freshDay = playerHouse?.day !== now / 86400n
  const costumeBonus = now / 86400n % 4n === 3n && playerHouse &&
    ((playerHouse.costume === 6n && balances[5] > 0n) || (playerHouse.costume === 7n && balances[6] > 0n)) ? 1n : 0n
  const left = playerHouse
    ? (playerHouse.costume === 7n && balances[6] > 0n ? 4n : 3n) + costumeBonus - (freshDay ? 0n : playerHouse.knocksUsed)
    : 3n
  const revenge = selected !== null && playerHouse?.revengeReady && playerHouse.revengeOn === BigInt(selected)
  const isChog = (value: string) => chogs.some(c => c.id === Number(value))
  const playHint = isFork ? '' : walletPlayHint(wallet, isChog(playerInput) ? Number(playerInput) : null)
  const canAct = isFork || (!!owner && wallet.account?.toLowerCase() === owner.toLowerCase())
  const goToHouse = (e: React.FormEvent) => {
    e.preventDefault()
    const id = Number(goTo)
    if (!chogs.some(c => c.id === id)) return setMessage('There is no house with that number.')
    document.getElementById(`house-${id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    setSelected(id)
  }
  return (
    <main className="simple">
      <header>
        <img className="simple-logo" src="/art/ui/logo.svg" alt="Knock" />
        <CandyChip owner={owner} />
        {isSandbox && <SandboxBanner />}
        <p>One haunted street. Every house is a Chog Genesis NFT, all {chogs.length.toLocaleString()} of them.</p>
        {!isFork && <WalletPicker wallet={wallet} disabled={busy || !chogs.length} onChoose={id => { setPlayerInput(String(id)); void chooseId(id) }} />}
        <div className="row">
          <form className="row" onSubmit={choosePlayer}>
            <PlaqueInput label="Play as Chog #" value={playerInput} onChange={setPlayerInput} min={1} max={1969} />
            <Sticker icon="key" tone="orange" type="submit" disabled={!isChog(playerInput) || !!playHint} title={playHint}>Play</Sticker>
          </form>
          <form className="row" onSubmit={goToHouse}>
            <PlaqueInput label="Go to Chog #" value={goTo} onChange={setGoTo} min={1} max={1969} />
            <Sticker icon="lantern" type="submit" disabled={!isChog(goTo)}>Go</Sticker>
          </form>
        </div>
        {!isFork && playHint && <p>{playHint}</p>}
        {player !== null && (
          <div className="row player-line">
            <strong>Playing as #{player}</strong>
            <span>{left.toString()} knocks left tonight</span>
            {isFork && (
              <Sticker icon="moon-phase" disabled={busy}
                onClick={() => nextDay().then(refresh).then(() => setMessage('A new night falls…'))}>
                Next night
              </Sticker>
            )}
          </div>
        )}
        {message && <p className="bubble" role="status">{message}</p>}
        {transactionUrl && <p><a className="sticker" href={transactionUrl} target="_blank" rel="noreferrer">View on Monadscan</a></p>}
        {shared && <Share {...shared} />}
        {earned && <Earned onClose={() => setEarned(false)} />}
        {playerHouse?.revengeReady && <Sticker tone="orange" onClick={() => {
          const id = Number(playerHouse.revengeOn)
          setSelected(id)
          document.getElementById(`house-${id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        }}>Knock back #{playerHouse.revengeOn.toString()}</Sticker>}
      </header>
      <ul className="street" aria-label="The street">
        {chogs.map(chog => (
          <HouseTile key={chog.id} chog={chog} house={houses.get(chog.id)} now={now} onOpen={() => setSelected(chog.id)} />
        ))}
      </ul>
      {current && house && (
        <section className="board panel" aria-label={`Chog #${current.id}'s house`}>
          <Sticker icon="bones" round aria-label="Close the house" className="close" onClick={() => setSelected(null)} />
          <h2>Chog #{current.id}</h2>
          <HouseBadges house={house} />
          <div className="panel-grid">
            <div>
              <Portrait chog={current} house={house} now={now} large />
              <p>{current.background || 'Custom'} · {current.tier} · {current.side || 'one of one'}</p>
            </div>
            <div>
              <h3>Porch</h3>
              <p>
                {house.day === 0n ? 'Lights out: nobody has played here yet.' : house.trap ? 'A pumpkin guards the door.'
                  : house.bowlCandy > 0n ? 'There is candy in the bowl.' : 'The porch is clear.'}
              </p>
              {house.day === 0n && house.bowlCandy === 0n && !house.trap && <p>Nobody's home. The house may answer for itself.</p>}
              <p>
                Treats given {house.treatsGiven.toString()} · Tricks landed {house.tricksLanded.toString()} · Times
                tricked {house.timesTricked.toString()}
              </p>
              {house.markUntil > now && (
                <p>Pranked by #{house.markBy.toString()} until {new Date(Number(house.markUntil) * 1000).toLocaleString()}</p>
              )}
              {player !== null && !mine && canAct && (
                <div className="row">
                  {[2, 3, 4].map(item => {
                    const missing = balances[item - 1] === 0n && !(item === 2 && freshDay)
                    const reason = missing ? `You have no ${items[item].toLowerCase()}` : left <= 0n && !revenge ? 'No knocks left tonight' : ''
                    return (
                      <Sticker key={item} icon={icons[item]} tone="orange" badge={balances[item - 1].toString()}
                        disabled={busy || !!reason} title={reason}
                        onClick={() => act('knock', [BigInt(player!), BigInt(current.id), BigInt(item)], true)}>
                        {items[item]}{revenge ? ' · free!' : ''}
                      </Sticker>
                    )
                  })}
                  {house.markUntil > now && (
                    <Sticker icon="broom" disabled={busy || left <= 0n} title="Use a knock to clean this house for free"
                      onClick={() => act('clean', [BigInt(player!), BigInt(current.id)])}>
                      Clean it up
                    </Sticker>
                  )}
                </div>
              )}
            </div>
          </div>
          <h3><img className="inline-icon" src="/art/icons/mailbox.svg" alt="" /> Last 10 visits</h3>
          <ol className="visits">
            {visits.length ? visits.map((v, i) => <li key={i}>{visitText(v, now)}</li>) : <li>No visits yet.</li>}
          </ol>
        </section>
      )}
      {mine && player !== null && owner && canAct && (
        <MyHouse id={player} owner={owner} house={playerHouse} balances={balances} now={now} onDone={refresh} say={setMessage} />
      )}
      <section className="board feed">
        <h2>Street gossip</h2>
        <ol>{feed.length ? feed.map((v, i) => <li key={i}>{visitText(v, now)}</li>) : <li>No knocks yet.</li>}</ol>
      </section>
    </main>
  )
}
