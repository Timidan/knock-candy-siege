import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { Night } from '../chain'
import type { Town } from '../town'
import { Sticker } from '../ui'

export function TownMap({ town, current, player, night, travel, go, close }: {
  town: Town; current: number; player: number | null; night: Night | null
  travel: (index: number) => void; go: (id: number) => void; close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = dialog.current!
    modal.showModal()
    return () => { modal.close(); previous?.focus({ preventScroll: true }) }
  }, [])
  const markers = [
    ...(player === null ? [] : [{ id: player, label: 'Home', done: false }]),
    ...(night ? [{ id: night.boss.house, label: 'Great Pumpkin', done: night.boss.defeated },
      ...night.route.map((id, i) => ({ id, label: `Stop ${i + 1}`, done: !!(night.mask & (1 << i)) }))] : []),
  ]
  return <dialog ref={dialog} className="town-map" aria-labelledby={title} onCancel={event => { event.preventDefault(); close() }}>
    <header className="town-map-heading"><div><h2 id={title}>Chog Town</h2><p>Pick a street, or a marker to walk to its house.</p></div><Sticker onClick={close}>Close</Sticker></header>
    <div className="town-map-paper">
      <section className="town-square"><img src="/art/icons/lantern.svg" alt="" /><h3>Town square</h3><p>21 neighbourhoods<br />One spooky night</p><small>● You are here · ✓ Done</small></section>
      {town.neighbourhoods.map((neighbourhood, i) => <section key={neighbourhood.name} className="town-patch"
        style={{ '--patch': neighbourhood.colour, '--tilt': `${i % 2 ? 1 : -1}deg` } as CSSProperties} aria-label={neighbourhood.name}>
        <h3>{neighbourhood.name}</h3>
        <div className="town-streets">{neighbourhood.streets.map(street => <div className="town-street" key={street.index}>
          <Sticker className={`town-street-dot ${current === street.index ? 'town-current' : ''}`} onClick={() => travel(street.index)}
            aria-current={current === street.index ? 'location' : undefined} aria-label={`${street.name}, ${street.chogs.length} houses${current === street.index ? ', you are here' : ''}`}>
            <strong>{street.chogs.length}</strong><small>St {street.number}</small>{current === street.index && <span className="town-here" aria-hidden="true">●</span>}
          </Sticker>
          {markers.filter(marker => town.streetOf(marker.id)?.index === street.index).map(marker => <Sticker key={`${marker.label}:${marker.id}`} className="town-marker"
            onClick={() => go(marker.id)} aria-label={`${marker.label}${marker.done ? ', done' : ''}, house ${marker.id}`}>
            {marker.done ? '✓ ' : ''}{marker.label}<small>#{marker.id}</small>
          </Sticker>)}
        </div>)}</div>
      </section>)}
    </div>
  </dialog>
}
