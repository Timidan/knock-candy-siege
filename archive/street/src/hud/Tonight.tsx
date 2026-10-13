import { useEffect, useId, useRef, useState } from 'react'
import type { Night } from '../chain'
import { Sticker } from '../ui'

export const CREWS = ['ghosts', 'witches', 'pumpkins', 'bats']
const THEMES = ['quiet', 'blood-moon', 'candy-rain', 'costume-night']
const THEME_ICONS = ['moon-phase', 'moon-phase', 'candy', 'witch-hat']
const EFFECTS = ['A quiet night. The usual rules apply.', 'Crew points count double tonight.', 'Daily ration doubles: 10 candy and 6 eggs.', 'Wear a costume you still hold for +1 knock tonight.']

export function Tonight({ night, crew, fresh, disabled, go, claim, join }: {
  night: Night; crew: number; fresh: boolean; disabled: boolean
  go: (id: number) => void; claim: (day: bigint) => Promise<void>; join: (crew: number) => Promise<void>
}) {
  const picker = useRef<HTMLDialogElement>(null)
  const [choice, setChoice] = useState(0)
  const panelId = useId()
  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem('knock:tonight-expanded') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { sessionStorage.setItem('knock:tonight-expanded', String(expanded)) } catch { /* Private browsing can disable storage. */ }
  }, [expanded])
  const goTo = (id: number) => { setExpanded(false); go(id) }
  const hp = Math.max(0, night.boss.hp - night.boss.damage)
  const health = night.boss.hp > 0 ? hp / night.boss.hp * 100 : 0
  const stops = [0, 1, 2].filter(i => night.mask & (1 << i)).length
  const place = crew > 0 ? 1 + night.points.filter(points => points > night.points[crew - 1]).length : 0
  const loot = night.claims[0]
  const leading = night.points.reduce((max, points) => points > max ? points : max, 0n)
  const won = crew > 0 && night.day > 0n && night.crewSince < night.day && night.previousPoints.every((points, i) => i === crew - 1 || points < night.previousPoints[crew - 1])
  return <section className="board hud-tonight" aria-label="Tonight's adventures">
    <div className="tonight-row">
      <Sticker className="tonight-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} Tonight: ${THEMES[night.theme].replaceAll('-', ' ')}, boss at house ${night.boss.house}, ${hp} of ${night.boss.hp} health, ${stops}/3 stops, ${crew > 0 ? `${CREWS[crew - 1]} in place ${place}` : 'no crew'}`}>
        <img className={`tonight-theme ${THEMES[night.theme]}`} src={`/art/icons/${THEME_ICONS[night.theme]}.svg`} alt="" title={THEMES[night.theme].replaceAll('-', ' ')} />
        <span className="tonight-boss" aria-hidden="true"><b>Pumpkin #{night.boss.house}</b><span className="tonight-vitals"><span className="tonight-hp"><span style={{ width: `${health}%` }} /></span><span>{hp}/{night.boss.hp}</span></span></span>
        <span className="tonight-stops">Route {night.player === null ? '—' : `${stops}/3`}</span>
        <span className="tonight-crew">{crew > 0 ? <><img src={`/art/crews/${CREWS[crew - 1]}.svg`} alt="" /><span>Crew: {CREWS[crew - 1]} · {['1st', '2nd', '3rd', '4th'][place - 1]}</span></> : 'Join a crew'}</span>
      </Sticker>
      <Sticker className="tonight-go" disabled={disabled} onClick={() => goTo(night.boss.house)} aria-label={`Go to the Pumpkin at house ${night.boss.house}`}>Go to the Pumpkin</Sticker>
      {loot && <Sticker className="tonight-claim" tone="gold" disabled={disabled} onClick={() => void claim(loot.day)} title={`Claim loot for night ${loot.day}`}>
        Claim loot
      </Sticker>}
    </div>
    <div id={panelId} className="tonight-body" hidden={!expanded}>
      <div className="tonight-heading"><h3>Tonight</h3><Sticker onClick={() => setExpanded(false)}>Collapse</Sticker></div>
      <div className="night-banner"><img src={`/art/themes/${THEMES[night.theme]}.svg`} alt={THEMES[night.theme].replaceAll('-', ' ')} /><p>{EFFECTS[night.theme]}</p></div>
      <div className="boss-heading"><strong>The Great Pumpkin is at #{night.boss.house}</strong></div>
      <div className="boss-health" role="progressbar" aria-label="Great Pumpkin health" aria-valuemin={0} aria-valuemax={night.boss.hp} aria-valuenow={hp}>
        <span className="hp-track"><span style={{ width: `${health}%` }} /></span>
        <img src="/art/boss/hp-frame.svg" alt="" />
      </div>
      <p className="hp-label">{night.boss.defeated ? 'Defeated!' : `${hp} / ${night.boss.hp} health`}</p>
      {night.claims.slice(1).map(loot => <Sticker key={loot.day.toString()} tone="gold" icon="candy-bucket" disabled={disabled} onClick={() => void claim(loot.day)}>
        Claim loot{loot.day !== night.day ? ' · yesterday' : ''}
      </Sticker>)}
      {night.player !== null ? <>
        <h3>Tonight's route</h3>
        <ol className="route-stops">{night.route.map((id, i) => {
          const done = !!(night.mask & (1 << i))
          return <li key={id}><img src={`/art/route/stamp-${done ? 'done' : 'todo'}.svg`} alt={done ? 'Done' : 'To do'} /><span>House #{id}</span><Sticker disabled={disabled} onClick={() => goTo(id)} aria-label={`Go to route house ${id}`}>Go</Sticker></li>
        })}</ol>
        <p>{night.mask === 7 ? 'Route done! +10 candy · +500 $KNOCK earned.' : 'Visit all three: +10 candy and +500 $KNOCK.'}</p>
      </> : <p>Choose a Chog to see its route and join a crew.</p>}
      <h3>Tonight's crews</h3>
      <ol className="crew-scores">{CREWS.map((name, i) => <li key={name} className={crew === i + 1 ? 'my-crew' : ''}>
        <img src={`/art/crews/${name}.svg`} alt="" /><span>{name}{crew === i + 1 ? ' · yours' : ''}</span><b>{night.points[i].toString()}</b>
        {leading > 0n && night.points[i] === leading && <small>{night.points.filter(points => points === leading).length > 1 ? 'Tied lead' : 'Leader'}</small>}
      </li>)}</ol>
      <p>Treat +1, trick or raid +2, friend clean +1, boss hit +damage. Blood Moon doubles points.</p>
      {won && <p>Your crew won last night: +3 candy{fresh ? ' with your first knock, raid, boss hit or friend clean.' : ' in today’s ration.'}</p>}
      {night.player !== null && crew === 0 && <Sticker icon="crew" tone="purple" disabled={disabled} onClick={() => { setChoice(0); picker.current?.showModal() }}>Choose a crew</Sticker>}
    </div>
    <dialog ref={picker} className="board crew-picker" aria-labelledby="crew-title">
      <h2 id="crew-title">Choose your crew</h2>
      <p>Owner only. Joining is permanent for this Chog; you cannot switch.</p>
      <p>Score through treats, tricks, raids, helping friends and boss damage. The sole winning crew gets +3 candy in the next day's ration.</p>
      <div className="crew-options">{CREWS.map((name, i) => <Sticker key={name} tone={choice === i + 1 ? 'gold' : 'paper'} aria-pressed={choice === i + 1} disabled={disabled} onClick={() => setChoice(i + 1)}>
        <img src={`/art/crews/${name}.svg`} alt="" />{name}
        <small>{night.points[i].toString()} point{night.points[i] === 1n ? '' : 's'} tonight</small>
        {leading > 0n && night.points[i] === leading && <small>{night.points.filter(points => points === leading).length > 1 ? 'Tied lead' : 'Leader'}</small>}
      </Sticker>)}</div>
      <div className="row"><Sticker tone="orange" disabled={!choice || disabled} onClick={async () => { await join(choice); picker.current?.close() }}>Join {choice ? CREWS[choice - 1] : 'crew'} permanently</Sticker><Sticker disabled={disabled} onClick={() => picker.current?.close()}>Back</Sticker></div>
    </dialog>
  </section>
}
