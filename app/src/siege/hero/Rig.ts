import Phaser from 'phaser'
import { localPose, mix, compose, REST } from './pose'
import type { RigData, Transform } from './pose'
import type { Art, AssetPack } from '../assets'
import type { Kit, Skin } from '../data/kits'
import { Signature } from './Signature'
import { reducedMotion } from '../data/save'
import type { ChogHeads, HeadRef } from '../chogHead'
export class Rig {
  root: Phaser.GameObjects.Container
  head: Phaser.GameObjects.Container
  face: Phaser.GameObjects.Image
  walkSpeed = 80
  size = 1
  clip = 'spawn'
  time = 0
  facing = 1
  private puppet: Phaser.GameObjects.Container
  private parts: Record<string, Phaser.GameObjects.Container> = {}
  private skins: Phaser.GameObjects.Image[] = []
  private flashes: Phaser.GameObjects.Image[] = []
  private sources: { image: Phaser.GameObjects.Image; source: string; frame: string }[] = []
  private hitTime = 0
  private skin: Skin & { face?: string }
  private heads: ChogHeads
  private headScale: number
  private aura?: Phaser.GameObjects.Image
  private auraFrames: HeadRef[] | null
  private accessory?: { image: Phaser.GameObjects.Image; hand: Transform }
  private sparkle?: Phaser.GameObjects.Star
  private sharpHead?: { key: string; frame: string; left: boolean }
  private data: RigData
  private kit: Kit
  private costume: string
  private pose: Record<string, Transform>
  private from: Record<string, Transform> | null = null
  private fade = 0
  private release?: () => void
  private pendingDance: string | null = null
  private signature?: Signature
  private art: Art
  private assets: AssetPack
  private scene: Phaser.Scene
  private onEvent: (event: string) => void
  constructor(scene: Phaser.Scene, art: Art, assets: AssetPack, kit: Kit, onEvent: (event: string) => void, costume = kit.costume) {
    this.scene = scene; this.art = art; this.assets = assets; this.data = assets.rig; this.kit = kit; this.onEvent = onEvent
    this.costume = costume
    this.skin = assets.skins[kit.skinValue]
    this.heads = (scene as Phaser.Scene & { heads: ChogHeads }).heads
    this.headScale = .44 * this.data.R / 30
    this.root = scene.add.container(0, 0); this.puppet = scene.add.container(0, 0); this.root.add(this.puppet)
    const config = this.data.costumes[costume], texture = `hero-${costume}`
    this.head = scene.add.container(0, 0)
    const ref = this.heads.head(kit.id), pivot = this.heads.pivot
    this.face = scene.add.image(0, 0, ref.key, ref.frame).setOrigin(pivot.x / 256, pivot.y / 320).setScale(this.headScale * 2)
    this.head.add(this.face); this.parts.head = this.head
    this.auraFrames = this.heads.auraFrames(kit.id)
    if (this.auraFrames?.length) {
      const aura = this.auraFrames[0]
      this.aura = scene.add.image(0, 0, aura.key, aura.frame).setOrigin(pivot.x / 256, pivot.y / 320)
      this.puppet.add(this.aura)
    }
    for (const part of Object.keys(this.data.skeleton)) {
      if (part === 'head') continue
      const container = scene.add.container(0, 0); this.parts[part] = container
      const source = part === 'weapon' ? `hero-${kit.costume}` : texture
      for (const frame of [`rig/${part}-skin`, `rig/${part}`]) if (scene.textures.get(source).has(frame)) {
        const image = scene.add.image(0, 0, source, frame).setOrigin(...((part === 'weapon' ? this.data.costumes[kit.costume] : config).pivots[part] ?? [.5, .5]))
        container.add(image); this.flashes.push(image); this.sources.push({ image, source, frame }); if (frame.endsWith('-skin') || costume === 'tickle' && source === texture) this.skins.push(image)
      }
    }
    for (const part of this.data.order) this.puppet.add(this.parts[part])
    this.parts['arm-front'].addAt(this.parts.weapon, this.data.costumes[kit.costume].weaponBehind ? 0 : this.parts['arm-front'].length)
    const accessory = this.heads.accessory(kit.id)
    if (accessory) {
      const hand = this.data.costumes[kit.costume].joints.weapon ?? this.data.skeleton.weapon.joint
      const prop = scene.add.image(hand[0], hand[1], accessory.ref.key, accessory.ref.frame)
        .setOrigin(accessory.grip.x / scene.textures.getFrame(accessory.ref.key, accessory.ref.frame).realWidth, accessory.grip.y / scene.textures.getFrame(accessory.ref.key, accessory.ref.frame).realHeight).setScale(this.headScale * 2)
      // Its grip follows the back palm, but the held object must clear the torso.
      this.puppet.addAt(prop, this.puppet.getIndex(this.head)); this.flashes.push(prop)
      this.accessory = { image: prop, hand: { ...REST, x: hand[0], y: hand[1] } }
    }
    if (kit.home) {
      const badge = scene.add.star(-12, -30, 5, 3, 7, 0xffd45e).setStrokeStyle(1.5, 0x352342)
      this.sparkle = scene.add.star(-5, -36, 4, 1, 3, 0xfff6ce)
      this.parts.torso.add([badge, this.sparkle])
    }
    const leg = scene.textures.get(texture).get('rig/leg-front'), footPivot = config.pivots['leg-front'] ?? [.5, .5]
    const foot = { ...REST, x: leg.width * (.5 - footPivot[0]), y: leg.height * (1 - footPivot[1]) - 3 }
    const start = compose(localPose(this.data, costume, 'walk', 0)['leg-front'], foot)
    const end = compose(localPose(this.data, costume, 'walk', this.data.clips.walk.ms / 2)['leg-front'], foot)
    const stride = Math.abs(start.x - end.x)
    // The front-facing waddle lifts the feet in place; keep its authored cadence.
    this.walkSpeed = stride < 1 ? 80 : Math.max(30, stride / (this.data.clips.walk.ms / 2000))
    this.pose = localPose(this.data, costume, this.clip, 0)
    this.update(0)
  }
  get dancing() { return this.clip.startsWith('dance-') && (this.data.clips[this.clip].loop || this.time < this.data.clips[this.clip].ms) }
  get busy() { return this.dancing || !['idle', 'walk', 'victory'].includes(this.clip) && (this.clip === 'faint' || this.time < this.data.clips[this.clip].ms) }
  dance(name: string) {
    if (this.clip === 'faint') return
    // Finish an already-paid ability or attack release before the dance takes over.
    if (this.busy && !this.dancing) { this.pendingDance = name; return }
    this.startDance(name)
  }
  private startDance(name: string) {
    this.pendingDance = null; this.signature?.destroy(); this.signature = undefined; this.face.setVisible(true)
    this.play(this.assets.dances[name]?.clip ?? 'emote')
    if (name === this.kit.emote) {
      this.signature = new Signature(this.scene, this.art, this.assets.signatures, name, this.kit.id, this.kit.side, this.data.R)
      this.head.add(this.signature.root); this.face.setVisible(false)
    }
  }
  cancelDance() {
    this.pendingDance = null
    if (!this.clip.startsWith('dance-')) return
    this.signature?.destroy(); this.signature = undefined; this.face.setVisible(true); this.play('idle')
  }
  play(clip: string, release?: () => void) {
    if (this.clip === clip && this.data.clips[clip].loop) return
    if (clip === 'faint' || clip === 'victory') this.pendingDance = null
    this.from = this.pose; this.fade = 0; this.clip = clip; this.time = 0; this.release = release
  }
  // Close-ups (the victory zoom) swap in the double-size parts: the same frame names, drawn at half scale, so the rig keeps its size and stays sharp.
  sharpen() {
    let swapped = false
    for (const part of this.sources) {
      const key = `${part.source}@2x`
      if (this.scene.textures.exists(key) && this.scene.textures.get(key).has(part.frame)) {
        const { originX, originY } = part.image
        part.image.setTexture(key, part.frame).setOrigin(originX, originY).setScale(.5); swapped = true
      }
    }
    return swapped
  }
  setPortrait(key: string) {
    const left = this.facing < 0, canvas = this.heads.canvas(this.kit.id, left)
    const texture = this.scene.textures.get(key) as Phaser.Textures.CanvasTexture
    texture.setSize(256, 320); texture.clear(); texture.draw(0, 0, canvas)
    this.sharpHead = { key, frame: '__BASE', left }
    this.face.setTexture(key).setDisplaySize(256 * this.headScale, 320 * this.headScale).setFlipX(left)
  }
  // A hit flash without interrupting the current clip: bosses take far too many hits to flinch at each one.
  flash() { this.hitTime = .1 }
  hurt() {
    this.hitTime = .14
    const release = this.data.clips[this.clip].events.release
    if (!this.busy || this.clip.startsWith('attack-') && this.time >= (Array.isArray(release) ? release[0] : release ?? Infinity)) this.play('hurt')
  }
  emote() {
    this.dance(this.kit.emote)
  }
  update(dt: number, rate = 1) {
    const clip = this.data.clips[this.clip], before = this.time
    this.time += dt * 1000 * rate; this.fade = Math.min(1, this.fade + dt / .12)
    for (const [name, value] of Object.entries(clip.events)) for (const at of Array.isArray(value) ? value : [value]) {
      const cycle = clip.loop ? Math.floor(before / clip.ms) : 0
      for (let i = cycle; i <= (clip.loop ? Math.floor(this.time / clip.ms) : 0); i++) {
        const eventTime = at + i * clip.ms
        if ((eventTime > before || before === 0 && eventTime === 0) && eventTime <= this.time) {
          this.onEvent(name)
          if (name === 'release') { const release = this.release; this.release = undefined; release?.() }
        }
      }
    }
    const next = localPose(this.data, this.costume, this.clip, reducedMotion() && clip.loop ? 0 : this.time)
    for (const part of Object.keys(next)) {
      const p = this.from && this.fade < 1 ? mix(this.from[part], next[part], this.fade) : next[part]
      next[part] = p
      const container = part === 'root' ? this.puppet : this.parts[part]
      container.setPosition(p.x, p.y).setAngle(p.r).setScale(p.sx, p.sy).setAlpha(Math.max(0, Math.min(1, p.a)))
    }
    this.pose = next
    this.root.setScale(this.facing * this.size, this.size)
    if (this.accessory) {
      const p = compose(next['arm-back'], this.accessory.hand)
      this.accessory.image.setPosition(p.x, p.y).setAngle(p.r).setScale(p.sx * this.headScale * 2, p.sy * this.headScale * 2).setAlpha(p.a)
    }
    const left = this.facing < 0, ref = this.sharpHead?.left === left ? this.sharpHead : this.heads.head(this.kit.id, left)
    this.face.setTexture(ref.key, ref.frame).setDisplaySize(256 * this.headScale, 320 * this.headScale).setFlipX(left)
    if (this.aura && this.auraFrames?.length) {
      const ref = this.auraFrames[reducedMotion() ? 0 : Math.floor(this.scene.time.now * 6 / 1000) % this.auraFrames.length], p = next.head
      this.aura.setTexture(ref.key, ref.frame).setPosition(p.x, p.y).setAngle(p.r).setScale(p.sx * this.headScale * 2, p.sy * this.headScale * 2).setAlpha(p.a)
    }
    this.sparkle?.setAlpha(reducedMotion() ? 1 : .4 + .6 * Math.max(0, Math.sin(this.scene.time.now / 180)))
    const cycle = this.costume === 'tickle' ? this.skin.cycle : undefined
    const color = cycle ? cycle[Math.floor(this.scene.time.now / 500) % cycle.length] : this.costume === 'tickle' ? this.skin.tint : this.skin.face ?? this.skin.tint
    let tint = parseInt(color.slice(1), 16)
    if (this.skin.shine) { const c = Phaser.Display.Color.ValueToColor(tint), shine = (Math.sin(this.scene.time.now / 450) + 1) * .2; tint = Phaser.Display.Color.GetColor(c.red + (255 - c.red) * shine, c.green + (255 - c.green) * shine, c.blue + (255 - c.blue) * shine) }
    this.hitTime = Math.max(0, this.hitTime - dt)
    for (const image of this.flashes) image.clearTint()
    for (const image of this.skins) image.setTint(tint)
    if (this.hitTime > 0) for (const image of this.flashes) image.setTint(0xffaaaa)
    if (this.signature && !this.signature.update(dt)) { this.signature.destroy(); this.signature = undefined; this.face.setVisible(true) }
    if (this.pendingDance && !clip.loop && this.time >= clip.ms) this.startDance(this.pendingDance)
  }
}
