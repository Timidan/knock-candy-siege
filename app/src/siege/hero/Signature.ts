import Phaser from 'phaser'
import type { Art } from '../assets'
import { REST, trackPose } from './pose'
import type { Keyframe } from './pose'
import { reducedMotion } from '../data/save'
import type { ChogHeads } from '../chogHead'
export type SignatureLayer = { portrait?: Keyframe[]; frames?: string; count?: number; fps?: number; loop?: boolean; anchor?: string; origin?: [number, number]; rotate?: string; at?: number }
export type SignatureDefinition = { ms: number; layers: SignatureLayer[] }
export type SignatureData = Record<string, SignatureDefinition>
// Parent transforms carry these registered head-space points through the dance.
function facePoint(anchor: string, radius: number, heads: ChogHeads) {
  const { anchors, pivot } = heads
  if (anchor === 'centre') return { x: 0, y: 0, angle: 0 }
  const a = anchors.eyeNear as number[], b = anchors.eyeFar as number[]
  if (!a || !b) return null
  const name = { eye0: 'eyeNear', eye1: 'eyeFar', top: 'headTop' }[anchor as 'eye0' | 'eye1' | 'top'] ?? anchor
  const point = anchor === 'eyes' ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : anchors[name] as number[] | undefined
  if (!point) return null
  const scale = .44 * radius / 30
  return { x: (point[0] - pivot.x) * scale, y: (point[1] - pivot.y) * scale, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }
}
export class Signature {
  root: Phaser.GameObjects.Container
  private portrait: Phaser.GameObjects.Container
  private layers: { data: SignatureLayer; image: Phaser.GameObjects.Image }[] = []
  private definition: SignatureDefinition
  private time = 0
  private radius: number
  private face: Phaser.GameObjects.Image
  private heads: ChogHeads
  private id: number
  private left = false
  constructor(scene: Phaser.Scene, art: Art, definitions: SignatureData, name: string, id: number, _side: string, radius: number) {
    this.radius = radius
    this.id = id; this.heads = (scene as Phaser.Scene & { heads: ChogHeads }).heads
    this.definition = definitions[name]
    this.root = scene.add.container(0, 0)
    this.portrait = scene.add.container(0, 0)
    this.root.add(this.portrait)
    const ref = this.heads.head(id), pivot = this.heads.pivot
    this.face = scene.add.image(0, 0, ref.key, ref.frame).setOrigin(pivot.x / 256, pivot.y / 320).setScale(.88 * radius / 30)
    this.portrait.add(this.face)
    for (const data of this.definition.layers) {
      if (!data.frames) continue
      const anchor = facePoint(data.anchor!, radius, this.heads)
      if (!anchor) continue
      const image = art.image(anchor.x, anchor.y, `${data.frames}/0`).setOrigin(...(data.origin ?? [.5, .5])).setScale(radius / 48).setRotation(data.rotate === 'eyes' ? anchor.angle : 0)
      this.portrait.add(image); this.layers.push({ data, image })
    }
  }
  update(dt: number) {
    this.time += dt * 1000
    const matrix = this.root.getWorldTransformMatrix(), left = matrix.a * matrix.d - matrix.b * matrix.c < 0
    if (left !== this.left) {
      this.left = left
      const ref = this.heads.head(this.id, left)
      this.face.setTexture(ref.key, ref.frame).setFlipX(left)
    }
    const motion = this.definition.layers.find(l => l.portrait)?.portrait
    const p = reducedMotion() ? REST : trackPose(motion, this.time)
    this.portrait.setPosition(p.x * this.radius / 48, p.y * this.radius / 48).setAngle(p.r).setScale(p.sx, p.sy)
    for (const { data, image } of this.layers) {
      const elapsed = this.time - (data.at ?? 0), frame = Math.floor(Math.max(0, elapsed) * data.fps! / 1000)
      image.setVisible(elapsed >= 0).setFrame(`${data.frames}/${data.loop ? frame % data.count! : Math.min(data.count! - 1, frame)}`).setOrigin(...(data.origin ?? [.5, .5]))
    }
    return this.time < this.definition.ms
  }
  destroy() { this.root.destroy() }
}
