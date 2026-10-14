// AbortSignal.timeout and AbortSignal.any need iPadOS 16 and 17.4; this does both and runs on older tablets too.
export function timeoutSignal(ms: number, parent?: AbortSignal | null): AbortSignal {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(new DOMException('The request timed out.', 'TimeoutError')), ms)
  const abort = () => { clearTimeout(timer); controller.abort(parent?.reason) }
  if (parent?.aborted) abort(); else parent?.addEventListener('abort', abort, { once: true })
  return controller.signal
}
