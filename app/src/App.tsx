import { lazy, Suspense } from 'react'
import { useWallet } from './wallet'

// Knock: Candy Siege is the whole app. The Knock street game is archived in knock/archive/street.
const Siege = lazy(() => import('./siege/Siege'))
// The public live stats page loads none of the game and reads no wallet.
const StatsPage = lazy(() => import('./stats/StatsPage'))
const loading = <main className="loading-screen"><section className="board" role="status"><h2>Unpacking the candy…</h2></section></main>

export default function App() {
  return location.pathname.replace(/\/+$/, '') === '/stats' ? <Suspense fallback={loading}><StatsPage /></Suspense> : <Game />
}
function Game() {
  const wallet = useWallet()
  return <Suspense fallback={loading}>
    <Siege wallet={wallet} />
  </Suspense>
}
