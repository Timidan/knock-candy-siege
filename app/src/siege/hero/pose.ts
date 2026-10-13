export type Transform = { x: number; y: number; r: number; sx: number; sy: number; a: number }
export type Keyframe = [number, Partial<Transform>, string?]
export type Clip = { loop: boolean; ms: number; events: Record<string, number | number[]>; tracks: Record<string, Keyframe[]> }
export type RigData = { R: number; skeleton: Record<string, { joint: [number, number]; parent?: string }>; order: string[]; costumes: Record<string, { attack: string; pivots: Record<string, [number, number]>; joints: Record<string, [number, number]>; weaponBehind: boolean }>; clips: Record<string, Clip> }
export const REST: Transform = { x: 0, y: 0, r: 0, sx: 1, sy: 1, a: 1 }
export function ease(name: string, v: number): number {
  switch (name) {
    case 'linear': return v
    case 'sineIn': return 1 - Math.cos(v * Math.PI / 2)
    case 'sineOut': return Math.sin(v * Math.PI / 2)
    case 'sineInOut': return (1 - Math.cos(v * Math.PI)) / 2
    case 'quadIn': return v * v
    case 'quadOut': return v * (2 - v)
    case 'quadInOut': return v < .5 ? 2 * v * v : 1 - 2 * (1 - v) ** 2
    case 'cubicOut': return (v - 1) ** 3 + 1
    case 'backIn': return v * v * (2.70158 * v - 1.70158)
    case 'backOut': return (v - 1) ** 2 * (2.70158 * (v - 1) + 1.70158) + 1
    case 'bounceOut': return v < 1 / 2.75 ? 7.5625 * v * v : v < 2 / 2.75 ? 7.5625 * (v - 1.5 / 2.75) ** 2 + .75 : v < 2.5 / 2.75 ? 7.5625 * (v - 2.25 / 2.75) ** 2 + .9375 : 7.5625 * (v - 2.625 / 2.75) ** 2 + .984375
    case 'elasticOut': return v === 0 || v === 1 ? v : 2 ** (-10 * v) * Math.sin((v - .025) * 2 * Math.PI / .1) + 1
    default: throw new Error(`Unknown rig ease: ${name}`)
  }
}
const FIELDS: (keyof Transform)[] = ['x', 'y', 'r', 'sx', 'sy', 'a']
export function mix(a: Partial<Transform>, b: Partial<Transform>, t: number, out: Transform = { ...REST }): Transform {
  for (const k of FIELDS) { const start = a[k] ?? REST[k]; out[k] = start + ((b[k] ?? REST[k]) - start) * t }
  return out
}
export function trackPose(track: Keyframe[] | undefined, t: number, out: Transform = { ...REST }): Transform {
  if (!track?.length) return Object.assign(out, REST)
  if (t <= track[0][0]) return Object.assign(out, REST, track[0][1])
  for (let i = 1; i < track.length; i++) if (t <= track[i][0]) {
    const [start, a] = track[i - 1], [end, b, easing = 'linear'] = track[i]
    return mix(a, b, ease(easing, (t - start) / (end - start)), out)
  }
  return Object.assign(out, REST, track[track.length - 1][1])
}
export function localPose(rig: RigData, costume: string, clipName: string, time: number, parts: Record<string, Transform> = {}): Record<string, Transform> {
  const clip = rig.clips[clipName], config = rig.costumes[costume]
  if (!clip || !config) throw new Error('Unknown rig costume or clip')
  const t = clip.loop ? Math.max(0, time) % clip.ms : Math.max(0, Math.min(time, clip.ms))
  parts.root = trackPose(clip.tracks.root, t, parts.root)
  for (const name in rig.skeleton) {
    const node = rig.skeleton[name], p = trackPose(clip.tracks[name], t, parts[name]), joint = config.joints[name] ?? node.joint
    p.x += joint[0]; p.y += joint[1]; parts[name] = p
  }
  return parts
}
export function compose(parent: Transform, local: Transform, out: Transform = { ...REST }): Transform {
  const r = parent.r * Math.PI / 180, x = local.x * parent.sx, y = local.y * parent.sy
  out.x = parent.x + Math.cos(r) * x - Math.sin(r) * y; out.y = parent.y + Math.sin(r) * x + Math.cos(r) * y
  out.r = parent.r + local.r; out.sx = parent.sx * local.sx; out.sy = parent.sy * local.sy; out.a = parent.a * local.a
  return out
}
export function pose(rig: RigData, costume: string, clip: string, time: number): Record<string, Transform> {
  const local = localPose(rig, costume, clip, time), result: Record<string, Transform> = {}
  for (const [name, node] of Object.entries(rig.skeleton)) result[name] = compose(local.root, node.parent ? compose(local[node.parent], local[name]) : local[name])
  return result
}
