// Explicit simulation snapshots only. Passing a Phaser scene here is an error:
// renderer objects, wall clocks and functions do not belong in a state hash.
export function canonicalState(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '{"$undefined":true}'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return JSON.stringify({ $number: String(value) })
    return Object.is(value, -0) ? '-0' : String(value)
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalState).join(',')}]`
  if (value instanceof Set) return canonicalState([...value].map(canonicalState).sort())
  if (value instanceof Map) return canonicalState([...value.entries()].sort(([a], [b]) => String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0))
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalState((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  throw new Error('Snapshot contains a non-simulation value')
}

// Two 32-bit streams: a cheap desync checksum, not an authentication primitive.
export function hashState(snapshot: unknown): string {
  const text = canonicalState(snapshot)
  let a = 0x811c9dc5, b = 0x9e3779b9
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193)
    b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b)
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')
}
