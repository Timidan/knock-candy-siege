import { useEffect, useState } from 'react'
import { formatEther, parseEther, type Address } from 'viem'
import { addressUrl, approveChog, chogBalance, cleanFee, isFork, send, tbaOf, testChog, type House } from '../chain'
import { HouseBadges, PlaqueInput, Sticker } from '../ui'
import { CandyChip } from './Candy'
import { Session } from './Session'

const CRAFTS = [
  { item: 3, icon: 'toilet-paper', name: 'Toilet paper', cost: 2n },
  { item: 4, icon: 'paint-brush', name: 'Mustache paint', cost: 3n },
  { item: 5, icon: 'pumpkin-trap', name: 'Pumpkin trap', cost: 5n },
  { item: 6, icon: 'ghost-sheet', name: 'Ghost sheet', cost: 15n },
  { item: 7, icon: 'witch-hat', name: 'Witch hat', cost: 15n },
]
const BAG = [
  { icon: 'candy', name: 'Candy' }, { icon: 'egg', name: 'Eggs' }, { icon: 'toilet-paper', name: 'Toilet paper' },
  { icon: 'paint-brush', name: 'Mustache paint' }, { icon: 'pumpkin-trap', name: 'Pumpkin traps' },
  { icon: 'ghost-sheet', name: 'Ghost sheets' }, { icon: 'witch-hat', name: 'Witch hats' },
]
const chog = (wei: bigint) => Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 2 })

// The player's own house: brew items, set the porch, fill the bowl with candy and $CHOG, dress up, scrub off a prank.
export function MyHouse({ id, owner, house, balances, now, onDone, say, showSession = true }: {
  id: number
  owner: Address
  house?: House
  balances: readonly bigint[] // items 1..7 in the Chog's own wallet
  now: bigint
  onDone: () => Promise<void>
  say: (message: string) => void
  showSession?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [wallet, setWallet] = useState({ owner: 0n, chog: 0n, account: '' })
  const [fee, setFee] = useState(0n)
  const [candy, setCandy] = useState('1')
  const [coins, setCoins] = useState('0')
  const [perTreat, setPerTreat] = useState('0')

  const readWallets = async () => {
    const account = await tbaOf(id)
    const [ownerChog, chogWallet] = await Promise.all([chogBalance(owner), chogBalance(account)])
    setWallet({ owner: ownerChog, chog: chogWallet, account })
  }
  useEffect(() => {
    readWallets().catch(() => {})
    cleanFee().then(setFee).catch(() => {})
  }, [id, owner, house])

  const run = async (label: string, steps: () => Promise<unknown>) => {
    setBusy(true)
    say(`${label}…`)
    try {
      await steps()
      await onDone()
      await readWallets()
      say(`${label}: done!`)
    } catch (e) {
      say(`${label} failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const big = (value: string) => BigInt(Math.max(0, Math.floor(Number(value) || 0)))
  const ether = (value: string) => parseEther(String(Math.max(0, Number(value) || 0)))

  const marked = !!house && house.markUntil > now
  // nightTheme cycles every four days; theme 2 is Candy Rain.
  const eggRation = house && house.day !== now / 86400n ? (now / 86400n % 4n === 2n ? 6n : 3n) : 0n
  const bowlCandy = big(candy), bowlCoins = ether(coins), coinsPerTreat = ether(perTreat)
  const canFill = (bowlCandy > 0n || bowlCoins > 0n) && bowlCandy <= balances[0] && bowlCoins <= wallet.owner

  return (
    <section className="board my-house" aria-label={`Your house, Chog #${id}`}>
      <h2>Your house · #{id}</h2>
      {showSession && <Session key={`${owner}:${id}`} owner={owner} id={id} disabled={busy} />}
      <HouseBadges house={house} />
      <p>
        $CHOG in your wallet <b>{chog(wallet.owner)}</b> · in Chog #{id}'s own wallet <b>{chog(wallet.chog)}</b>
      </p>
      {wallet.account && <p>
        Chog #{id}'s own wallet: {addressUrl(wallet.account)
          ? <a href={addressUrl(wallet.account)!} target="_blank" rel="noreferrer">{wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}</a>
          : <code>{wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}</code>}. Its candy, items and winnings go with the Chog if it's sold.
      </p>}
      <CandyChip owner={owner} />

      <h3>Candy bag</h3>
      <div className="row bag">
        {BAG.map((b, i) => (
          <span key={b.icon} className="bag-item" title={b.name}>
            <img src={`/art/icons/${b.icon}.svg`} alt={b.name} />
            <b>{((balances[i] ?? 0n) + (i === 1 ? eggRation : 0n)).toString()}</b>
          </span>
        ))}
      </div>
      {eggRation > 0n && <p>Includes {eggRation.toString()} eggs from tonight's ration, received with your first action.</p>}

      <h3>The cauldron</h3>
      <div className="row">
        {CRAFTS.map(c => (
          <Sticker key={c.item} icon={c.icon} badge={<>{c.cost.toString()} <img src="/art/icons/candy.svg" alt="candy" /></>} disabled={busy || balances[0] < c.cost}
            title={`Brew ${c.name.toLowerCase()} for ${c.cost} candy`}
            onClick={() => run(`Brewing ${c.name.toLowerCase()}`, () => send(owner, 'craft', [BigInt(id), BigInt(c.item), 1n]))}>
            {c.name}
          </Sticker>
        ))}
      </div>

      <h3>The porch</h3>
      <p>Candy in your bowl: knockers get a treat, and your trap only catches raiders. Empty bowl: your trap bounces tricks back at the knocker.</p>
      <p>
        {house?.trap ? 'A pumpkin guards your door.' : 'No trap set.'} The bowl holds {house?.bowlCandy.toString() ?? 0} candy
        {house && house.bowlChog > 0n && <> and {chog(house.bowlChog)} $CHOG ({chog(house.chogPerTreat)} per treat)</>}.
      </p>
      <div className="row">
        <Sticker icon="pumpkin-trap" tone="orange" disabled={busy || !!house?.trap || balances[4] === 0n}
          onClick={() => run('Setting the trap', () => send(owner, 'setTrap', [BigInt(id)]))}>
          Set the trap
        </Sticker>
        <Sticker icon="candy-bucket" disabled={busy || !house || (house.bowlCandy === 0n && house.bowlChog === 0n)}
          onClick={() => run('Emptying the bowl', () => send(owner, 'emptyBowl', [BigInt(id)]))}>
          Empty the bowl
        </Sticker>
      </div>
      <div className="row">
        <PlaqueInput label="Candy" value={candy} onChange={setCandy} max={Number(balances[0])} />
        <PlaqueInput label="$CHOG" value={coins} onChange={setCoins} />
        <PlaqueInput label="per treat" value={perTreat} onChange={setPerTreat} />
        <Sticker icon="coin-pile" tone="gold" disabled={busy || !canFill}
          title="Visitors take 1 candy, and this much $CHOG, per treat"
          onClick={() => run('Filling the bowl', async () => {
            if (bowlCoins > 0n) await approveChog(owner, bowlCoins)
            await send(owner, 'stockBowl', [BigInt(id), bowlCandy, bowlCoins, coinsPerTreat])
          })}>
          Fill the bowl
        </Sticker>
      </div>

      <h3>The wardrobe</h3>
      <div className="row">
        {[{ item: 6, icon: 'ghost-sheet', name: 'Ghost sheet' }, { item: 7, icon: 'witch-hat', name: 'Witch hat' }].map(c => (
          <Sticker key={c.item} icon={c.icon} tone="purple"
            disabled={busy || house?.costume === BigInt(c.item) || balances[c.item - 1] === 0n}
            onClick={() => run(`Putting on the ${c.name.toLowerCase()}`, () => send(owner, 'wear', [BigInt(id), BigInt(c.item)]))}>
            Wear {c.name.toLowerCase()}
          </Sticker>
        ))}
        <Sticker icon="hanger" disabled={busy || !house?.costume}
          onClick={() => run('Hanging up the costume', () => send(owner, 'wear', [BigInt(id), 0n]))}>
          Take it off
        </Sticker>
      </div>

      {marked && (
        <>
          <h3>Pranked!</h3>
          <div className="row">
            <Sticker icon="broom" tone="orange" disabled={busy || wallet.owner < fee}
              title={wallet.owner < fee ? `Needs ${chog(fee)} $CHOG` : 'Pay $CHOG into the finale pot to clean it now'}
              onClick={() => run('Scrubbing your house', async () => {
                await approveChog(owner, fee)
                await send(owner, 'clean', [BigInt(id), BigInt(id)])
              })}>
              Scrub it off · {chog(fee)} $CHOG
            </Sticker>
            <span>…or ask a friend's Chog to clean it for free.</span>
          </div>
        </>
      )}

      {isFork && <h3>Test tools (local fork only)</h3>}
      {isFork && <div className="row">
        <Sticker icon="coin" tone="gold" disabled={busy}
          onClick={() => run('Fetching 1,000 test $CHOG', () => testChog(owner))}>
          Get 1,000 test $CHOG
        </Sticker>
      </div>}
    </section>
  )
}
