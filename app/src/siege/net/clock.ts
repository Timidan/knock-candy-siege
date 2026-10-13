/** 45 Hz, at most three steps per wakeup; waiting never accumulates catch-up debt. */
export function startClock(step: () => boolean) {
  const worker = new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' })
  let previous = performance.now(), debt = 0
  worker.onmessage = () => {
    const now = performance.now()
    debt = Math.min(3 / 45, debt + (now - previous) / 1000); previous = now
    while (debt >= 1 / 45) {
      if (!step()) { debt = 1 / 45; break }
      debt -= 1 / 45
    }
  }
  return () => worker.terminate()
}
