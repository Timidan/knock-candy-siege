import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from 'react'
import type { House } from './chain'
import type { UiCue } from './siege/Sfx'
import './ui.css'

// The page's sound engine registers here (Siege's Sfx, or the stats page's small player); until then menu cues are silent.
let uiSound: ((cue: UiCue) => void) | null = null
export const setUiSound = (play: typeof uiSound) => { uiSound = play }
export const playUi = (cue: UiCue) => uiSound?.(cue)

type StickerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string // a name in /art/icons
  tone?: 'paper' | 'orange' | 'purple' | 'gold'
  round?: boolean
  badge?: ReactNode
  sound?: UiCue | false // played on click, after the handler: a cue the handler plays itself wins (menu cues share one slot)
}

export const houseBadges = (house?: House) => [
  { name: 'egg-stained', label: 'Egg-stained', earned: (house?.timesTricked ?? 0n) >= 5n },
  { name: 'prankster', label: 'Prankster', earned: (house?.tricksLanded ?? 0n) >= 5n },
  { name: 'sweetest-house', label: 'Sweetest house', earned: (house?.treatsGiven ?? 0n) >= 5n },
  { name: 'raid-master', label: 'Raid master', earned: (house?.raidsLanded ?? 0n) >= 5n },
].filter(badge => badge.earned)

export function HouseBadges({ house }: { house?: House }) {
  return <div className="house-badges">{houseBadges(house).map(badge => <span key={badge.name}>
    <img src={`/art/badges/${badge.name}.svg`} alt="" onError={e => { e.currentTarget.hidden = true }} />{badge.label}
  </span>)}</div>
}

export function Share({ to, item, outcome }: { to: number; item: number; outcome: number }) {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('house', String(to))
  const action = outcome === 0 ? `got a treat from Chog #${to}` : outcome === 4 ? `raided Chog #${to}` : `${['', '', 'egged', 'toilet-papered', 'painted a mustache on'][item]} Chog #${to}`
  const text = `I just ${action} in Knock ${outcome === 0 ? '🍬' : '🥚'} — come knock back`
  return <a className="sticker sticker--orange" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url.href)}`} target="_blank" rel="noreferrer">Share</a>
}

// Every button in Knock is a sticker: hand-drawn, tilted, and it splashes ink where you press it.
export function Sticker({ icon, tone = 'paper', round, badge, sound = 'ui-click', children, className = '', onPointerDown, onClick, ...rest }: StickerProps) {
  const splash = (event: PointerEvent<HTMLButtonElement>) => {
    // No splash under reduced motion; a timeout rather than animationend removes it, so an interrupted animation leaves nothing behind.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const box = event.currentTarget.getBoundingClientRect()
      const dot = document.createElement('span')
      dot.className = 'splash'
      dot.style.left = `${event.clientX - box.left}px`
      dot.style.top = `${event.clientY - box.top}px`
      setTimeout(() => dot.remove(), 600)
      event.currentTarget.append(dot)
    }
    onPointerDown?.(event)
  }
  const classes = ['sticker', tone !== 'paper' && `sticker--${tone}`, round && 'sticker--round', className]
  return (
    <button {...rest} className={classes.filter(Boolean).join(' ')} onPointerDown={splash} onClick={event => { onClick?.(event); if (sound) playUi(sound) }}>
      {icon && <img src={`/art/icons/${icon}.svg`} alt="" />}
      {children}
      {badge !== undefined && <span className="badge">{badge}</span>}
    </button>
  )
}

export function PlaqueInput({ label, value, onChange, min = 0, max }: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
}) {
  return (
    <label className="plaque-input">
      {label}
      <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} value={value}
        onChange={e => onChange(e.target.value)} />
    </label>
  )
}
