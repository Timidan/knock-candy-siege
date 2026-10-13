import { reducedMotion } from './data/save'

// Optional, sparse buzzes for the heaviest moments. Off until the Settings toggle (Siege.tsx mirrors it here);
// silent with reduced motion, in a hidden tab, or where the browser has no vibration (iOS Safari). Visuals and audio carry on regardless.
const PATTERNS: Record<'jar' | 'boss' | 'star', number[]> = { jar: [30], star: [45], boss: [70, 50, 110] }
let enabled = false, last = -Infinity
export const setHaptics = (on: boolean) => { enabled = on }
export function haptic(kind: 'jar' | 'boss' | 'star') {
  const now = performance.now()
  if (!enabled || reducedMotion() || document.visibilityState !== 'visible' || typeof navigator.vibrate !== 'function' || now - last < 400) return
  last = now
  try { navigator.vibrate(PATTERNS[kind]) } catch { /* Some browsers refuse before a tap; nothing else depends on it. */ }
}
