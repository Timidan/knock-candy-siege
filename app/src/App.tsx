import { Component, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { useWallet } from './wallet'
import { Sticker } from './ui'

// Knock: Candy Siege is the whole app. The Knock street game is archived in knock/archive/street.
const Siege = lazy(() => import('./siege/Siege'))
// The public live stats page loads none of the game and reads no wallet.
const StatsPage = lazy(() => import('./stats/StatsPage'))
// The same markup as the static shell in index.html (its inline styles), so React taking over doesn't flash.
const logo = <img className="boot-logo" src="/art/ui/logo.svg" alt="Knock" width="240" height="80" />
const loading = <main className="boot" role="status">{logo}<span className="boot-candy" aria-hidden="true" /><p>Unpacking the candy…</p></main>
// A lazy chunk that fails to load (often a stale tab after a deploy) or a render error ends here instead of a blank page.
class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) { return { error } }
  componentDidCatch(error: unknown) {
    console.error(error)
    // A chunk from an older deploy is gone; one automatic reload per tab session fetches the new build.
    if (!/dynamically imported module|Importing a module script failed|not a valid JavaScript MIME type/i.test(String((error as Error)?.message))) return
    try { if (sessionStorage.getItem('knock-chunk-reload')) return; sessionStorage.setItem('knock-chunk-reload', '1') } catch { return }
    location.reload()
  }
  render() {
    const detail = this.state.error ? String((this.state.error as Error).message || this.state.error).slice(0, 200) : ''
    return this.state.error ? <main className="boot" role="alert">{logo}<p>Something broke.</p><p style={{ fontSize: 12, opacity: .7, maxWidth: 420, overflowWrap: 'anywhere' }}>{detail}</p><Sticker tone="orange" onClick={() => location.reload()}>Reload</Sticker></main> : this.props.children
  }
}

export default function App() {
  return <Boundary>{location.pathname.replace(/\/+$/, '') === '/stats' ? <Suspense fallback={loading}><StatsPage /></Suspense> : <Game />}</Boundary>
}
function Game() {
  const wallet = useWallet()
  return <Suspense fallback={loading}>
    <Siege wallet={wallet} />
  </Suspense>
}
