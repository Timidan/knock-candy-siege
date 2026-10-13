import { lazy, Suspense } from 'react'
import { useWallet } from './wallet'

// Knock: Candy Siege is the whole app. The Knock street game is archived in knock/archive/street.
const Siege = lazy(() => import('./siege/Siege'))

export default function App() {
  const wallet = useWallet()
  return <Suspense fallback={<main className="loading-screen"><section className="board" role="status"><h2>Unpacking the candy…</h2></section></main>}>
    <Siege wallet={wallet} />
  </Suspense>
}
