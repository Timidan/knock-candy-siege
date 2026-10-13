import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sparkles, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, BackSide, BoxGeometry, CanvasTexture, ClampToEdgeWrapping, Color, ExtrudeGeometry, Float32BufferAttribute, FrontSide, LinearFilter, Shape, Texture, TextureLoader, Vector3, Vector2, Matrix4, Euler, Quaternion, Plane, Raycaster } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Group, PerspectiveCamera, InstancedMesh, Material } from 'three'
import type { Boss, House, Night, Visit } from '../chain'
import { original, thumb } from '../images'
import { houseBadges } from '../ui'
import { CREWS } from '../hud/Tonight'
import { gradeBoss, gradeFront, liteMode, type Aim, type Shot } from './aim'

export type Chog = { id: number; side: string; name: string; art: number; background: string }
export type Flight = { item: number; target: number; outcome: number; start: number; phase: 'knock' | 'result' | 'miss'; shot?: Shot }
export const icon = ['raid', 'candy', 'egg', 'toilet-paper', 'paint-brush']
const mark = ['', '', 'egg-splat', 'toilet-paper', 'painted-mustache']
export const results = ['TREAT', 'BOING', 'SPLAT', 'SWEPT', 'LOOTED', 'CAUGHT']
const blank = document.createElement('canvas')
blank.width = blank.height = 1
const transparent = new CanvasTexture(blank)
const textureCache = new Map<string, Promise<Texture>>()
function texture(path: string, fallback?: string) {
  if (!textureCache.has(path)) textureCache.set(path, new Promise(resolve => {
    const loader = new TextureLoader()
    loader.setCrossOrigin('anonymous')
    const accept = (loaded: Texture) => {
      const image = loaded.image as HTMLImageElement
      if (liteMode() && Math.max(image.width, image.height) > (path.startsWith('/chogs') ? 256 : 512)) {
        const canvas = document.createElement('canvas')
        const scale = (path.startsWith('/chogs') ? 256 : 512) / Math.max(image.width, image.height)
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
        loaded.image = canvas
      }
      loaded.colorSpace = 'srgb'
      loaded.wrapS = loaded.wrapT = ClampToEdgeWrapping
      loaded.minFilter = LinearFilter
      loaded.generateMipmaps = false
      resolve(loaded)
    }
    loader.load(path, accept, undefined, () => fallback ? loader.load(fallback, accept, undefined, () => resolve(transparent)) : resolve(transparent))
  }))
  return textureCache.get(path)!
}
function useArt(path: string, fallback?: string) {
  const [art, setArt] = useState<Texture>(transparent)
  useEffect(() => { let live = true; texture(path, fallback).then(t => { if (live) setArt(t) }); return () => { live = false } }, [path, fallback])
  return art
}
function Card({ path, fallback, position, size, rotation = 0, opacity = 1, color = '#ffffff', renderOrder = 0 }: { path: string; fallback?: string; position: [number, number, number]; size: [number, number]; rotation?: number; opacity?: number; color?: string; renderOrder?: number }) {
  const art = useArt(path, fallback)
  if (art === transparent || opacity <= 0) return null
  return <mesh position={position} rotation={[0, rotation, 0]} renderOrder={renderOrder}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={art} color={color} transparent opacity={opacity} side={FrontSide} depthWrite={false} />
  </mesh>
}
const plaqueCache = new Map<number, Texture>()
function plaque(id: number) {
  if (!plaqueCache.has(id)) {
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#241536'; ctx.font = 'bold 42px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(id), 64, 34)
    plaqueCache.set(id, new CanvasTexture(canvas))
  }
  return plaqueCache.get(id)!
}
function painted(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  draw(canvas.getContext('2d')!)
  const result = new CanvasTexture(canvas)
  result.colorSpace = 'srgb'
  return result
}
const sky = painted(4, 512, ctx => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#120a24'); gradient.addColorStop(1, '#3a2551')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 512)
})
const glow = painted(128, 128, ctx => {
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,198,100,.8)')
  gradient.addColorStop(.3, 'rgba(255,122,26,.4)')
  gradient.addColorStop(1, 'rgba(255,122,26,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
})
const shadow = painted(128, 128, ctx => {
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(13,7,24,.65)')
  gradient.addColorStop(1, 'rgba(13,7,24,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
})
const grain = painted(64, 64, ctx => {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 450; i++) {
    ctx.fillStyle = `rgba(75,42,59,${(i % 5 + 1) * .012})`
    ctx.fillRect((i * 37) % 64, (i * 53) % 64, 1, 1)
  }
})
const pumpkinFace = painted(128, 128, ctx => {
  ctx.fillStyle = '#ffe081'
  for (const x of [33, 88]) { ctx.beginPath(); ctx.moveTo(x, 45); ctx.lineTo(x - 13, 67); ctx.lineTo(x + 13, 67); ctx.fill() }
  ctx.beginPath(); ctx.moveTo(34, 82); ctx.quadraticCurveTo(64, 112, 94, 82); ctx.lineTo(81, 87); ctx.lineTo(75, 80); ctx.lineTo(66, 91); ctx.lineTo(57, 81); ctx.lineTo(49, 89); ctx.fill()
})
// SVG pixels map to a 2.5 × 3 unit facade: walls x=130..900, y=400..1084; roof apex (420,70), eaves (122,423)..(922,381).
const roofShape = new Shape()
roofShape.moveTo(-1.02, .46); roofShape.lineTo(-.2, 1.325); roofShape.lineTo(1.08, .46); roofShape.closePath()
const roofGeometry = new ExtrudeGeometry(roofShape, { depth: 1.72, bevelEnabled: false })
roofGeometry.translate(0, 0, -1.75)
const palettes = [
  { wall: '#F4EEDD', roof: '#200052', roofAccent: '#836EF9', trim: '#E64893' },
  { wall: '#EDF2DE', roof: '#133D48', roofAccent: '#41B7AA', trim: '#E66D83' },
  { wall: '#F5E8C5', roof: '#49301C', roofAccent: '#D7A642', trim: '#9C5383' },
  { wall: '#E4E8E2', roof: '#22344F', roofAccent: '#738CB3', trim: '#C85892' },
  { wall: '#F7E6DF', roof: '#55284D', roofAccent: '#D46DA0', trim: '#8064B8' },
  { wall: '#EFE9D1', roof: '#283F2D', roofAccent: '#82A65D', trim: '#A65581' },
]
// One material per palette keeps the original grain, UVs and roof-face colours.
const houseShells = palettes.map(colors => {
  const wall = new BoxGeometry(1.925, 1.71, 1.6).toNonIndexed().translate(.0375, -.355, -.83)
  const roof = roofGeometry.clone()
  const chimney = new BoxGeometry(.3, .65, .38).toNonIndexed().rotateZ(-.1).translate(.64, .99, -1.12)
  const pieces = [wall, roof, chimney]
  pieces.forEach((geometry, i) => {
    const color = new Color([colors.wall, colors.roof, colors.trim][i])
    const attribute = new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3), 3)
    for (let j = 0; j < attribute.count; j++) attribute.setXYZ(j, color.r, color.g, color.b)
    if (geometry === roof) {
      color.set(colors.roofAccent)
      for (const group of roof.groups.filter(group => group.materialIndex === 1)) {
        for (let j = group.start; j < group.start + group.count; j++) attribute.setXYZ(j, color.r, color.g, color.b)
      }
    }
    geometry.setAttribute('color', attribute)
  })
  const merged = mergeGeometries(pieces)!
  if (import.meta.env.DEV) console.assert(merged.getAttribute('position').count === pieces.reduce((sum, piece) => sum + piece.getAttribute('position').count, 0), 'House batching preserves every vertex')
  pieces.forEach(piece => piece.dispose())
  return merged
})
const hills = painted(1024, 256, ctx => {
  ctx.fillStyle = '#271536'
  ctx.beginPath(); ctx.moveTo(0, 256)
  for (let x = 0; x <= 1024; x += 8) ctx.lineTo(x, 150 + Math.sin(x * .009) * 35 + Math.sin(x * .021) * 14)
  ctx.lineTo(1024, 256); ctx.fill()
})
const roofs = painted(1024, 256, ctx => {
  ctx.fillStyle = '#170e29'
  ctx.fillRect(0, 190, 1024, 66)
  for (let x = 0; x < 1024; x += 64) {
    const top = 130 - (x * 17 % 45)
    ctx.fillRect(x, top + 22, 52, 190 - top)
    ctx.beginPath(); ctx.moveTo(x - 8, top + 24); ctx.lineTo(x + 22, top - 14); ctx.lineTo(x + 60, top + 24); ctx.fill()
    ctx.fillRect(x + 35, top - 8, 9, 40)
  }
})
function Halo({ position, size, opacity = 1, colour = '#ffffff' }: { position: [number, number, number]; size: number; opacity?: number; colour?: string }) {
  return <sprite position={position} scale={[size, size, 1]}>
    <spriteMaterial map={glow} color={colour} transparent opacity={opacity} depthWrite={false} blending={AdditiveBlending} />
  </sprite>
}
// Three units of arc per house; the facade's local +Z always points into the park.
const streetRadius = (count: number) => Math.max(3, count * 3 / (2 * Math.PI))
function streetPosition(index: number, count: number, across = 0, inward = 0) {
  const angle = index * 2 * Math.PI / Math.max(1, count), facing = angle + Math.PI
  const radius = streetRadius(count) - inward
  return { x: Math.sin(angle) * radius + Math.cos(facing) * across,
    z: Math.cos(angle) * radius - Math.sin(facing) * across, facing }
}
function door(index: number, count: number): [number, number] {
  const { x, z } = streetPosition(index, count, -.52, .6)
  return [x, z]
}
if (import.meta.env.DEV) {
  const [x, z] = door(0, 40)
  console.assert(Math.abs(streetRadius(40) * 2 * Math.PI / 40 - 3) < 1e-9 && Math.hypot(x, z) < streetRadius(40) - .35, 'Ring spacing and reachable door')
}
function HouseShells({ chogs, flight }: { chogs: Chog[]; flight: Flight | null }) {
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const { entries, counts } = useMemo(() => {
    const counts = palettes.map(() => 0)
    const entries = chogs.map((chog, index) => {
      const { x, z, facing } = streetPosition(index, chogs.length), variant = chog.id % palettes.length
      const position = new Vector3(x, 1.5, z)
      const rotation = new Euler(0, facing, Math.sin(chog.id * 17.13) * .045)
      return { id: chog.id, variant, instance: counts[variant]++, position, rotation,
        matrix: new Matrix4().compose(position, new Quaternion().setFromEuler(rotation), new Vector3(1, 1, 1)) }
    })
    return { entries, counts }
  }, [chogs])
  const shaken = useRef<(typeof entries)[number] | undefined>(undefined)
  const matrix = useMemo(() => new Matrix4(), [])
  const rotation = useMemo(() => new Euler(), [])
  useLayoutEffect(() => {
    shaken.current = undefined
    for (const entry of entries) meshes.current[entry.variant]!.setMatrixAt(entry.instance, entry.matrix)
    for (const mesh of meshes.current) if (mesh) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      // The hit tilt can move the furthest shell vertex by less than .2 units.
      mesh.boundingSphere!.radius += .2
    }
  }, [entries])
  useFrame(() => {
    const time = performance.now()
    const hit = flight?.phase === 'knock' && time - flight.start < 600 ? entries.find(entry => entry.id === flight.target) : undefined
    if (shaken.current && shaken.current !== hit) {
      const previous = shaken.current, mesh = meshes.current[previous.variant]!
      mesh.setMatrixAt(previous.instance, previous.matrix); mesh.instanceMatrix.needsUpdate = true
    }
    if (hit) {
      rotation.copy(hit.rotation); rotation.z += Math.sin(time * .06) * .055
      matrix.makeRotationFromEuler(rotation).setPosition(hit.position)
      const mesh = meshes.current[hit.variant]!
      mesh.setMatrixAt(hit.instance, matrix); mesh.instanceMatrix.needsUpdate = true
    }
    shaken.current = hit
  })
  return <>{counts.map((count, variant) => count > 0 && <instancedMesh key={variant} ref={mesh => { meshes.current[variant] = mesh }} args={[houseShells[variant], undefined, count]}>
    <meshLambertMaterial vertexColors map={grain} />
  </instancedMesh>)}</>
}
type HouseLayer = { path: string; fallback?: string; position: [number, number, number]; size: [number, number] }
// Flatten the same ordered artwork in lite mode: marks and badges cost no extra draw calls.
function HouseArtwork({ layers, id, lite }: { layers: HouseLayer[]; id: number; lite: boolean }) {
  const [art, setArt] = useState<Texture>(transparent)
  useEffect(() => {
    if (!lite) return
    let live = true, composed: Texture | undefined
    void Promise.all(layers.map(layer => texture(layer.path, layer.fallback))).then(textures => {
      if (!live) return
      // 384 px wide keeps the 256 px portrait sharp on a phone at about half the memory of 512.
      const [W, H] = [384, 462]
      composed = painted(W, H, ctx => {
        const draw = (image: CanvasImageSource, x: number, y: number, w: number, h: number) => {
          ctx.drawImage(image, (x - w / 2 + 1.25) / 2.5 * W, (1.5 - y - h / 2) / 3 * H, w / 2.5 * W, h / 3 * H)
        }
        layers.forEach((layer, i) => draw(textures[i].image as CanvasImageSource, layer.position[0], layer.position[1], ...layer.size))
        draw(plaque(id).image as CanvasImageSource, -.525, .05, .27, .12)
      })
      composed.minFilter = LinearFilter; composed.generateMipmaps = false
      setArt(composed)
    })
    return () => { live = false; composed?.dispose() }
  }, [layers, id, lite])
  if (lite) return <mesh position={[0, 0, .1]} renderOrder={2}><planeGeometry args={[2.5, 3]} /><meshBasicMaterial map={art} transparent side={FrontSide} depthWrite={false} /></mesh>
  return <>
    {layers.map((layer, i) => <Card key={layer.path} {...layer} renderOrder={i + 1} />)}
    <mesh position={[-.525, .05, .14]} renderOrder={40}><planeGeometry args={[.27, .12]} /><meshBasicMaterial map={plaque(id)} transparent side={FrontSide} depthWrite={false} /></mesh>
  </>
}
function HouseCard({ chog, state, now, index, count, shake, near, lite, player, crew, route }: { chog: Chog; state?: House; now: bigint; index: number; count: number; shake: number; near: boolean; lite: boolean; player: React.RefObject<Vector3>; crew: number; route: boolean }) {
  const group = useRef<Group>(null)
  const cue = useRef<Group>(null)
  const viewPosition = useMemo(() => new Vector3(), [])
  const [detail, setDetail] = useState(!lite)
  const { x, z, facing } = streetPosition(index, count)
  const variant = chog.id % 6
  const lean = Math.sin(chog.id * 17.13) * 0.045
  const active = state && state.markUntil > now
  const sideName = chog.side.toLowerCase()
  const layers = useMemo(() => {
    const cards: HouseLayer[] = [
      { path: thumb(chog.id, lite), fallback: original(chog.art), position: [.4, -.075, .025], size: [.95, .95] },
      { path: `/art/scenery/house-${variant + 1}.svg`, position: [0, 0, .06], size: [2.5, 3] },
    ]
    if (detail && sideName && active && Number(state.markItem) >= 2 && Number(state.markItem) <= 4)
      cards.push({ path: `/art/overlays/${mark[Number(state.markItem)]}-${sideName}.svg`, position: [.4, -.075, .07], size: [.95, .95] })
    if (detail && sideName && (state?.costume === 6n || state?.costume === 7n))
      cards.push({ path: `/art/overlays/${state.costume === 6n ? 'ghost-sheet' : 'witch-hat'}-${sideName}.svg`, position: [.4, -.075, .075], size: [.95, .95] })
    const states = [!state?.day && 'dark', active && state.markItem === 2n && 'egged', active && state.markItem === 3n && 'tp',
      state?.trap && 'pumpkin', state && state.bowlCandy > 0n && 'bowl', state && state.bowlChog > 0n && 'coins']
    states.forEach((layer, i) => { if (layer) cards.push({ path: `/art/scenery/state-${layer}.svg`, position: [0, 0, .08 + i * .004], size: [2.5, 3] }) })
    if (detail && crew > 0) cards.push({ path: `/art/crews/banner-${CREWS[crew - 1]}.svg`, position: [-.87, .53, .13], size: [.42, .85] })
    if (detail) houseBadges(state).forEach((badge, i) => cards.push({ path: `/art/badges/${badge.name}.svg`, fallback: '/art/icons/candy.svg', position: [-.65 + i * .5, -.98, .12], size: [.42, .42] }))
    return cards
  }, [chog.id, chog.art, lite, variant, detail, sideName, active, state, crew])
  useFrame(({ clock, camera }) => {
    if (lite) { const close = Math.hypot(player.current.x - x, player.current.z - z) < 25; if (close !== detail) setDetail(close) }
    if (group.current) {
      group.current.rotation.z = lean + (shake > 0 && performance.now() - shake < 600 ? Math.sin(performance.now() * .06) * .055 : 0)
      // Beyond fog's far plane, even the nearest corner and route marker are hidden.
      viewPosition.copy(group.current.position).applyMatrix4(camera.matrixWorldInverse)
      group.current.visible = !lite || -viewPosition.z < 46
    }
    if (cue.current) {
      cue.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * .065)
      cue.current.position.y = -.6 + Math.sin(clock.elapsedTime * 4) * .04
    }
  })
  return <group ref={group} position={[x, 1.5, z]} rotation={[0, facing, lean]}>
    {!!state?.day && <Halo position={[.4, -.075, -.08]} size={1.45} opacity={.42} />}
    <HouseArtwork layers={layers} id={chog.id} lite={lite} />
    {route && <Card path="/art/route/lantern-marker.svg" position={[0, 2.05, .15]} size={[.6, .8]} renderOrder={41} />}
    {near && <group ref={cue} position={[-.52, -.6, .12]}>
      <Halo position={[0, 0, -.03]} size={1.5} opacity={.8} />
      <mesh renderOrder={50} position={[-.32, 0, 0]}><planeGeometry args={[.045, .95]} /><meshBasicMaterial color="#ff9b3d" transparent opacity={.9} /></mesh>
      <mesh renderOrder={50} position={[.32, 0, 0]}><planeGeometry args={[.045, .95]} /><meshBasicMaterial color="#ff9b3d" transparent opacity={.9} /></mesh>
      <mesh renderOrder={50} position={[0, .47, 0]}><planeGeometry args={[.68, .045]} /><meshBasicMaterial color="#ff9b3d" transparent opacity={.9} /></mesh>
      <mesh renderOrder={50} position={[0, -.47, 0]}><planeGeometry args={[.68, .045]} /><meshBasicMaterial color="#ff9b3d" transparent opacity={.9} /></mesh>
      <Card path="/art/icons/door-knocker.svg" position={[0, .83, .02]} size={[.36, .36]} renderOrder={51} />
    </group>}
  </group>
}
function PumpkinBoss({ boss, index, count, hit }: { boss: Boss; index: number; count: number; hit: number }) {
  const [flashing, setFlashing] = useState(false)
  const { x, z, facing } = streetPosition(index, count, 0, .52)
  useEffect(() => {
    for (const state of ['idle', 'angry', 'hit', 'down']) void texture(`/art/boss/great-pumpkin-${state}.svg`)
  }, [])
  useEffect(() => {
    const remaining = hit ? 400 - (performance.now() - hit) : 0
    setFlashing(remaining > 0)
    if (remaining <= 0) return
    const timer = setTimeout(() => setFlashing(false), remaining)
    return () => clearTimeout(timer)
  }, [hit])
  const state = flashing ? 'hit' : boss.defeated ? 'down' : boss.hp - boss.damage < boss.hp * .4 ? 'angry' : 'idle'
  return <Card path={`/art/boss/great-pumpkin-${state}.svg`} position={[x, 1.9, z]} size={[3.2, 3.2]} rotation={facing} renderOrder={45} />
}
function CandyRain({ player }: { player: React.RefObject<Vector3> }) {
  const art = useArt('/art/icons/candy.svg')
  const mesh = useRef<InstancedMesh>(null)
  const matrix = useMemo(() => new Matrix4(), [])
  const position = useMemo(() => new Vector3(), [])
  const scale = useMemo(() => new Vector3(.24, .24, .24), [])
  useFrame(({ clock, camera }) => {
    for (let i = 0; i < 8; i++) {
      position.set(player.current.x + (i - 3.5) * 1.7, 5 - (clock.elapsedTime * .7 + i * .63) % 5, player.current.z + (i % 3 - 1) * 1.9)
      mesh.current?.setMatrixAt(i, matrix.compose(position, camera.quaternion, scale))
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[undefined, undefined, 8]} frustumCulled={false}><planeGeometry /><meshBasicMaterial map={art} transparent opacity={.7} depthWrite={false} /></instancedMesh>
}
function RouteTrail({ index, count, player }: { index: number; count: number; player: React.RefObject<Vector3> }) {
  const mesh = useRef<InstancedMesh>(null)
  const matrix = useMemo(() => new Matrix4(), [])
  const [x, z] = door(index, count)
  useFrame(() => {
    for (let i = 0; i < 18; i++) {
      const t = (i + 1) / 18
      matrix.makeRotationX(-Math.PI / 2)
      matrix.setPosition(player.current.x + (x - player.current.x) * t, .015, player.current.z + (z - player.current.z) * t)
      mesh.current?.setMatrixAt(i, matrix)
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[undefined, undefined, 18]} frustumCulled={false}><circleGeometry args={[.065, 6]} /><meshBasicMaterial color="#ffd54f" transparent opacity={.65} depthWrite={false} /></instancedMesh>
}
function Player({ chog, moving, position, facing, lite }: { chog?: Chog; moving: React.RefObject<boolean>; position: React.RefObject<Vector3>; facing: React.RefObject<number>; lite: boolean }) {
  const group = useRef<Group>(null)
  const headGroup = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const head = useArt(chog ? thumb(chog.id, lite) : '/art/icons/ghost-sheet.svg', chog ? original(chog.art) : undefined)
  useFrame(({ clock, camera }) => {
    if (!group.current) return
    const step = Math.sin(clock.elapsedTime * 11)
    group.current.position.y = moving.current ? Math.abs(step) * .09 : Math.sin(clock.elapsedTime * 2) * .02
    if (leftLeg.current) leftLeg.current.rotation.x = moving.current ? step * .5 : 0
    if (rightLeg.current) rightLeg.current.rotation.x = moving.current ? -step * .5 : 0
    if (headGroup.current) headGroup.current.rotation.y = Math.atan2(camera.position.x - position.current.x, camera.position.z - position.current.z) - facing.current
  })
  return <group scale={.72}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .012, 0]} scale={[1.3, .62, 1]}><planeGeometry args={[1.5, 1.5]} /><meshBasicMaterial map={shadow} transparent depthWrite={false} /></mesh>
    <group ref={group}>
      <group ref={leftLeg} position={[-.2, .17, 0]}>
        <mesh><boxGeometry args={[.17, .2, .19]} /><meshBasicMaterial color="#171018" /></mesh>
        <mesh position={[0, 0, .01]}><boxGeometry args={[.13, .16, .19]} /><meshBasicMaterial color="#fff0ce" /></mesh>
      </group>
      <group ref={rightLeg} position={[.2, .17, 0]}>
        <mesh><boxGeometry args={[.17, .2, .19]} /><meshBasicMaterial color="#171018" /></mesh>
        <mesh position={[0, 0, .01]}><boxGeometry args={[.13, .16, .19]} /><meshBasicMaterial color="#fff0ce" /></mesh>
      </group>
      <mesh position={[0, .49, 0]}><cylinderGeometry args={[.34, .28, .58, 16]} /><meshBasicMaterial color="#ff881c" /></mesh>
      <mesh position={[0, .78, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.34, .025, 6, 16]} /><meshBasicMaterial color="#201426" /></mesh>
      <mesh position={[0, .76, 0]}><torusGeometry args={[.34, .035, 6, 16, Math.PI]} /><meshBasicMaterial color="#201426" /></mesh>
      <mesh position={[0, .49, .32]}><planeGeometry args={[.48, .38]} /><meshStandardMaterial map={pumpkinFace} transparent depthWrite={false} emissive="#ffc158" emissiveMap={pumpkinFace} emissiveIntensity={1.6} toneMapped={false} /></mesh>
      <group ref={headGroup} position={[0, 1.12, 0]}>
        <mesh position={[0, 0, -.005]}><circleGeometry args={[.49, 32]} /><meshBasicMaterial color="#141018" side={FrontSide} /></mesh>
        <mesh position={[0, 0, .005]}><circleGeometry args={[.4, 32]} /><meshBasicMaterial map={head} transparent side={FrontSide} /></mesh>
      </group>
    </group>
  </group>
}
function Effects({ flight, target, player }: { flight: Flight | null; target: [number, number] | null; player: React.RefObject<Vector3> }) {
  const sprite = useRef<Group>(null)
  const candy = useRef<Group>(null)
  const burst = useRef<Group>(null)
  const [item, setItem] = useState(2)
  useEffect(() => { if (flight) setItem(flight.item) }, [flight])
  useFrame(({ camera }) => {
    if (!sprite.current || !candy.current || !burst.current) return
    if (!flight || !target) { sprite.current.visible = candy.current.visible = burst.current.visible = false; return }
    const elapsed = (performance.now() - flight.start) / 1000
    const duration = flight.phase === 'result' ? 1.05 : .55
    const t = Math.min(1, elapsed / duration)
    const loot = flight.outcome === 0 || flight.outcome === 4
    const back = flight.phase === 'result' && (flight.outcome === 1 || flight.outcome === 5) && t > .52
    const p = back ? (t - .52) / .48 : flight.phase === 'result' ? Math.min(1, t * 1.9) : t
    const from = flight.shot ? new Vector3(...flight.shot.from) : player.current
    const tx = flight.shot?.to[0] ?? target[0], tz = flight.shot?.to[2] ?? target[1]
    const ty = flight.shot?.to[1] ?? (flight.outcome === 2 ? 1.42 : .8)
    sprite.current.visible = elapsed < duration && (flight.phase !== 'result' || !loot)
    sprite.current.position.set(from.x + (tx - from.x) * (back ? 1 - p : p), .8 + (ty - .8) * (back ? 1 - p : p) + Math.sin(p * Math.PI) * 1.25, from.z + (tz - from.z) * (back ? 1 - p : p))
    sprite.current.rotation.y = Math.atan2(camera.position.x - sprite.current.position.x, camera.position.z - sprite.current.position.z)
    candy.current.visible = elapsed < duration && flight.phase === 'result' && loot
    candy.current.position.set(tx + (from.x - tx) * t, .7 + Math.sin(t * Math.PI) * 1.2, tz + (from.z - tz) * t)
    candy.current.rotation.y = Math.atan2(camera.position.x - candy.current.position.x, camera.position.z - candy.current.position.z)
    candy.current.rotation.z = t * 10
    candy.current.scale.setScalar(.3 + t * 1.5)
    burst.current.visible = flight.phase === 'result' && !loot && elapsed < .5
    burst.current.position.set(tx, ty, tz)
    burst.current.rotation.y = Math.atan2(camera.position.x - tx, camera.position.z - tz)
    burst.current.scale.setScalar(.15 + elapsed * 3.2)
    burst.current.rotation.z = elapsed * 4
  })
  return <>
    <group ref={sprite} visible={false}><Card path={`/art/icons/${flight?.outcome === 3 ? 'broom' : flight?.outcome === 5 ? 'pumpkin-trap' : icon[item]}.svg`} position={[0, 0, 0]} size={[.6, .6]} /></group>
    <group ref={candy} visible={false}>{Array.from({ length: 6 }, (_, i) => <Card key={i} path="/art/icons/candy.svg" position={[Math.sin(i * 2.4) * .4, Math.cos(i * 1.4) * .35, i * .002]} size={[.3, .3]} />)}</group>
    <group ref={burst} visible={false}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[Math.cos(i * 2.4) * .25, Math.sin(i * 2.4) * .22, i * .001]}>
      <circleGeometry args={[i % 3 ? .09 : .14, 8]} /><meshBasicMaterial color={i % 2 ? '#f4eedd' : '#ffd54f'} />
    </mesh>)}</group>
  </>
}
function Part({ matrices, children }: { matrices: Matrix4[]; children: ReactNode }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    matrices.forEach((matrix, i) => mesh.current!.setMatrixAt(i, matrix))
    mesh.current!.instanceMatrix.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [matrices])
  return <instancedMesh ref={mesh} args={[undefined, undefined, matrices.length]}>{children}</instancedMesh>
}
function RepeatedProps({ count, lite, colour }: { count: number; lite: boolean; colour: string }) {
  const lantern = useArt('/art/icons/lantern.svg')
  const parts = useMemo(() => {
    const parts = { pumpkin: [] as Matrix4[], face: [] as Matrix4[], stem: [] as Matrix4[], pole: [] as Matrix4[], lantern: [] as Matrix4[], halo: [] as Matrix4[], road: [] as Matrix4[], shadow: [] as Matrix4[] }
    const put = (list: Matrix4[], index: number, across: number, y: number, inward: number, sx: number, sy: number, sz: number, flat = false) => {
      const { x, z, facing } = streetPosition(index, count, across, inward)
      list.push(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(flat ? -Math.PI / 2 : 0, flat ? 0 : facing, flat ? facing : 0)), new Vector3(sx, sy, sz)))
    }
    for (let i = 0; i < count; i++) {
      put(parts.shadow, i, 0, .006, .1, 3.1, 2.1, 1, true)
      put(parts.road, i, 0, .01, 2.5, .8, .055, 1, true)
      if (i % (lite ? 4 : 2)) continue
      put(parts.pumpkin, i, -.9, .22, .4, .34, .26, .31)
      put(parts.face, i, -.9, .22, .715, .45, .35, 1)
      put(parts.stem, i, -.9, .49, .4, 1, 1, 1)
      put(parts.pole, i + .5, 0, 1.15, 1.4, 1, 1, 1)
      put(parts.lantern, i + .5, 0, 2.25, 1.46, .48, .58, 1)
      put(parts.halo, i + .5, 0, 2.25, 1.52, 2.1, 2.1, 1)
    }
    return parts
  }, [count, lite])
  return <>
    <Part matrices={parts.shadow}><planeGeometry /><meshBasicMaterial map={shadow} transparent depthWrite={false} /></Part>
    <Part matrices={parts.pumpkin}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color="#ff881c" /></Part>
    <Part matrices={parts.face}><planeGeometry /><meshBasicMaterial map={pumpkinFace} transparent depthWrite={false} toneMapped={false} /></Part>
    <Part matrices={parts.stem}><cylinderGeometry args={[.045, .06, .16, 5]} /><meshLambertMaterial color="#52602c" /></Part>
    <Part matrices={parts.pole}><cylinderGeometry args={[.035, .045, 2.3, 5]} /><meshLambertMaterial color="#2a1b34" /></Part>
    <Part matrices={parts.lantern}><planeGeometry /><meshBasicMaterial map={lantern} transparent depthWrite={false} /></Part>
    <Part matrices={parts.halo}><planeGeometry /><meshBasicMaterial map={glow} color={colour} transparent opacity={.55} depthWrite={false} blending={AdditiveBlending} /></Part>
    <Part matrices={parts.road}><planeGeometry /><meshBasicMaterial color="#b5a496" /></Part>
  </>
}
function Sign({ name, colour }: { name: string; colour: string }) {
  const { camera } = useThree()
  const group = useRef<Group>(null)
  const art = useMemo(() => painted(1024, 256, ctx => {
    ctx.fillStyle = '#241536'; ctx.fillRect(0, 0, 1024, 256)
    ctx.strokeStyle = colour; ctx.lineWidth = 14; ctx.strokeRect(10, 10, 1004, 236)
    ctx.fillStyle = colour; ctx.font = 'bold 92px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(name, 512, 116, 944)
    ctx.fillStyle = '#f4eedd'; ctx.font = '32px system-ui'; ctx.fillText('CHOG TOWN', 512, 208)
  }), [name, colour])
  useEffect(() => () => art.dispose(), [art])
  useFrame(() => { if (group.current) group.current.rotation.y = Math.atan2(camera.position.x, camera.position.z) })
  return <group ref={group}>
    <mesh position={[0, 1.25, -.05]}><boxGeometry args={[.16, 2.5, .16]} /><meshLambertMaterial color="#5e4452" /></mesh>
    <mesh position={[0, 2.5, 0]}><planeGeometry args={[5, 1.25]} /><meshBasicMaterial map={art} side={FrontSide} /></mesh>
    <mesh position={[1.8, 1.8, 0]}><cylinderGeometry args={[.05, .075, 3.6, 6]} /><meshLambertMaterial color="#2a1b34" /></mesh>
    <Card path="/art/icons/lantern.svg" position={[1.8, 3.6, .05]} size={[.65, .8]} />
    <Halo position={[1.8, 3.6, .06]} size={3} colour={colour} />
  </group>
}
function AimGuide({ aim, chogs, player, pointer, sample }: {
  aim: Aim; chogs: Chog[]; player: React.RefObject<Vector3>
  pointer: React.RefObject<{ x: number; y: number } | null>; sample: React.RefObject<(() => Shot) | null>
}) {
  const { camera, gl } = useThree()
  const dots = useRef<InstancedMesh>(null)
  const reticle = useRef<Group>(null)
  const calculate = useMemo(() => {
    const index = chogs.findIndex(chog => chog.id === aim.target)
    const { x, z, facing } = streetPosition(index, chogs.length, 0, aim.boss ? .52 : 0)
    const matrix = new Matrix4().compose(new Vector3(x, aim.boss ? 1.9 : 1.5, z), new Quaternion().setFromEuler(new Euler(0, facing, aim.boss ? 0 : Math.sin(aim.target * 17.13) * .045)), new Vector3(1, 1, 1))
    const inverse = matrix.clone().invert()
    const plane = new Plane(new Vector3(0, 0, 1), aim.boss ? 0 : -.12).applyMatrix4(matrix)
    const ray = new Raycaster()
    return (): Shot => {
      let point = new Vector3(0, aim.boss ? 0 : -.6, aim.boss ? 0 : .12).applyMatrix4(matrix)
      let intersects = true
      if (pointer.current) {
        const rect = gl.domElement.getBoundingClientRect()
        ray.setFromCamera(new Vector2((pointer.current.x - rect.left) / rect.width * 2 - 1, 1 - (pointer.current.y - rect.top) / rect.height * 2), camera)
        intersects = !!ray.ray.intersectPlane(plane, point)
        if (!intersects) point = ray.ray.at(8, point)
      }
      const local = point.clone().applyMatrix4(inverse)
      return { from: [player.current.x, .8, player.current.z], to: point.toArray(), grade: intersects ? (aim.boss ? gradeBoss(local.x, local.y) : gradeFront(local.x, local.y)) : 'miss' }
    }
  }, [aim.target, aim.boss, chogs, camera, gl, player, pointer])
  useLayoutEffect(() => { sample.current = calculate; return () => { sample.current = null } }, [calculate, sample])
  useFrame(() => {
    const shot = calculate()
    const from = new Vector3(...shot.from), to = new Vector3(...shot.to)
    const matrix = new Matrix4()
    for (let i = 0; i < 24; i++) {
      const t = i / 23, point = from.clone().lerp(to, t)
      point.y += Math.sin(t * Math.PI) * 1.25
      matrix.makeTranslation(point.x, point.y, point.z)
      dots.current?.setMatrixAt(i, matrix)
    }
    if (dots.current) dots.current.instanceMatrix.needsUpdate = true
    if (reticle.current) { reticle.current.position.copy(to); reticle.current.quaternion.copy(camera.quaternion) }
  })
  return <>
    <instancedMesh ref={dots} args={[undefined, undefined, 24]} frustumCulled={false}>
      <sphereGeometry args={[.026, 6, 4]} /><meshBasicMaterial color="#ffe07b" depthTest={false} />
    </instancedMesh>
    <group ref={reticle}><Card path="/art/ui/aim-reticle.svg" fallback="/aim-reticle-placeholder.svg" position={[0, 0, 0]} size={[.4, .4]} /></group>
  </>
}

function Ghosts({ feed, chogs, all, lite }: { feed: readonly Visit[]; chogs: Chog[]; all: Chog[]; lite: boolean }) {
  const events = useMemo(() => feed.filter(event => event.outcome >= 0 && event.outcome <= 5 && chogs.some(chog => chog.id === Number(event.to))).sort((a, b) => Number(b.timestamp - a.timestamp)), [feed, chogs])
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => value + 1), 6500)
    return () => clearInterval(timer)
  }, [])
  const event = events[index % events.length]
  const chog = event && all.find(chog => chog.id === Number(event.from))
  if (!event || !chog) return null
  // One replay at a time keeps the street readable and stays below the three-ghost cap.
  return <Ghost key={`${index}:${event.from}:${event.to}:${event.timestamp}`} event={event} chog={chog} targetIndex={chogs.findIndex(chog => chog.id === Number(event.to))} count={chogs.length} lite={lite} />
}
function Ghost({ event, chog, targetIndex, count, lite }: { event: Visit; chog: Chog; targetIndex: number; count: number; lite: boolean }) {
  const group = useRef<Group>(null)
  const position = useRef(new Vector3())
  const start = useRef(performance.now())
  const played = useRef(false)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [x, z] = door(targetIndex, count)
  const startPoint = streetPosition(targetIndex, count, -.52, 4.6)
  useFrame(({ camera }) => {
    const age = (performance.now() - start.current) / 1000, t = Math.min(1, age / 3)
    position.current.set(startPoint.x + (x - startPoint.x) * t, 0, startPoint.z + (z - startPoint.z) * t)
    if (group.current) {
      group.current.position.copy(position.current)
      group.current.position.y = t < 1 ? Math.abs(Math.sin(age * 10)) * .08 : 0
      group.current.quaternion.copy(camera.quaternion)
    }
    if (age > 3 && !played.current) {
      played.current = true
      setFlight({ item: Number(event.item), target: Number(event.to), outcome: event.outcome, start: performance.now(), phase: 'result' })
    }
  })
  return <>
    <group ref={group}>
      <mesh position={[0, .42, 0]}><coneGeometry args={[.36, .8, 12]} /><meshBasicMaterial color="#c8baff" transparent opacity={.28} depthWrite={false} /></mesh>
      <Card path={thumb(chog.id, lite)} fallback={original(chog.art)} position={[0, .98, .02]} size={[.62, .62]} opacity={.42} />
    </group>
    <Effects flight={flight} target={[x, z]} player={position} />
  </>
}

function RenderMetrics({ onMetrics }: { onMetrics: (text: string) => void }) {
  const { gl, scene } = useThree()
  const frames = useRef<number[]>([])
  const last = useRef(0)
  useEffect(() => {
    const autoReset = gl.info.autoReset
    gl.info.autoReset = false
    return () => { gl.info.autoReset = autoReset }
  }, [gl])
  useFrame(({ clock }) => {
    if (gl.info.render.calls) frames.current.push(gl.info.render.calls)
    gl.info.reset()
    if (clock.elapsedTime - last.current < 2 || !frames.current.length) return
    last.current = clock.elapsedTime
    const textures = new Set<Texture>()
    scene.traverse(object => {
      const material = (object as unknown as { material?: Material | Material[] }).material
      for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
        for (const value of Object.values(entry)) if (value instanceof Texture) textures.add(value)
      }
    })
    let bytes = 0
    for (const texture of textures) {
      const image = texture.image as { width?: number; height?: number } | undefined
      bytes += (image?.width ?? 0) * (image?.height ?? 0) * 4 * (texture.generateMipmaps ? 4 / 3 : 1)
    }
    const samples = frames.current.splice(0)
    onMetrics(`${Math.min(...samples)}–${Math.max(...samples)} calls/frame · ${(bytes / 1048576).toFixed(1)} MiB scene textures (RGBA + mips estimate) · DPR ${gl.getPixelRatio().toFixed(2)}`)
  }, -1000)
  return null
}

export function World({ chogs, houses, now, neighbourhood, colour, arrival, paused, playerId, targetId, onNear, keys, touch, flight, lite, all, feed, aim, aimPointer, sampleShot, onMetrics, night, crews, bossHit }: {
  chogs: Chog[]; houses: Map<number, House>; now: bigint; neighbourhood: string; colour: string; arrival: number; paused: boolean; playerId: number | null; targetId: number | null
  onNear: (id: number | null) => void; keys: React.RefObject<Set<string>>; touch: React.RefObject<{ x: number; y: number }>; flight: Flight | null
  lite: boolean; all: Chog[]; feed: readonly Visit[]; aim: Aim | null
  aimPointer: React.RefObject<{ x: number; y: number } | null>; sampleShot: React.RefObject<(() => Shot) | null>
  onMetrics?: (text: string) => void
  night: Night | null; crews: Map<number, number>; bossHit: number
}) {
  const { camera, gl } = useThree()
  const player = useRef(new Vector3())
  const radius = streetRadius(chogs.length)
  const parkRadius = Math.min(5, radius * .35)
  const playerGroup = useRef<Group>(null)
  const moving = useRef(false)
  const facing = useRef(Math.PI / 2)
  const yaw = useRef(0)
  const lastOrbit = useRef(0)
  const pitch = useRef(.2)
  const zoom = useRef(3.6)
  const cameraGoal = useRef(new Vector3())
  const lookGoal = useRef(new Vector3())
  const lastNear = useRef<number | null>(null)
  const [nearId, setNearId] = useState<number | null>(null)
  const [playerArt, setPlayerArt] = useState<Chog>()
  const bats = useRef<Group[]>([])
  const fogCards = useRef<Group[]>([])
  const lampPools = useRef<Group[]>([])
  const targetIndex = targetId === null ? -1 : chogs.findIndex(c => c.id === targetId)
  const aiming = useRef(false)
  aiming.current = !!aim
  useEffect(() => {
    if (!chogs.length) return
    const keep = new Set(chogs.map(chog => chog.id))
    if (playerId !== null) keep.add(playerId)
    for (const event of feed) if (chogs.some(chog => chog.id === Number(event.to))) keep.add(Number(event.from))
    for (const [path, pending] of textureCache) {
      const portrait = path.match(/^\/chogs(?:-256)?\/(\d+)\.webp$/)
      if (portrait && !keep.has(Number(portrait[1]))) {
        textureCache.delete(path)
        void pending.then(art => { if (art !== transparent) art.dispose() })
      }
    }
    for (const [id, art] of plaqueCache) if (!keep.has(id)) { art.dispose(); plaqueCache.delete(id) }
  }, [chogs, playerId, feed])
  useEffect(() => {
    if (playerId === null) { setPlayerArt(undefined); return }
    const local = chogs.find(c => c.id === playerId)
    if (local) { setPlayerArt(local); return }
    let live = true
    fetch('/chogs.json').then(r => r.json()).then(data => {
      if (live) setPlayerArt((data.chogs as Chog[]).find(c => c.id === playerId))
    }).catch(() => {})
    return () => { live = false }
  }, [playerId, chogs])
  useEffect(() => {
    const canvas = gl.domElement
    const priorTouchAction = canvas.style.touchAction
    canvas.style.touchAction = 'none'
    let drag = false, lastX = 0, lastY = 0
    const down = (event: PointerEvent) => { if (aiming.current) return; drag = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId) }
    const move = (event: PointerEvent) => {
      if (!drag || aiming.current) return
      yaw.current -= (event.clientX - lastX) * .006
      lastOrbit.current = performance.now()
      pitch.current = Math.max(.17, Math.min(.61, pitch.current + (event.clientY - lastY) * .004))
      lastX = event.clientX; lastY = event.clientY
    }
    const up = () => { drag = false }
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoom.current = Math.max(3, Math.min(7, zoom.current + event.deltaY * .005)) }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      canvas.style.touchAction = priorTouchAction
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [gl])
  useEffect(() => {
    const spawn = streetPosition(0, chogs.length, 0, 2.5)
    player.current.set(spawn.x, 0, spawn.z)
    yaw.current = 0
    facing.current = Math.PI / 2
    camera.position.set(player.current.x - Math.cos(yaw.current) * 3.6, 1.8, player.current.z - Math.sin(yaw.current) * 3.6)
    ;(camera as PerspectiveCamera).fov = 66
    ;(camera as PerspectiveCamera).updateProjectionMatrix()
    lastNear.current = null; setNearId(null); onNear(null)
  }, [arrival, chogs, camera, onNear])
  useFrame(({ clock }, delta) => {
    const pos = player.current
    const step = Math.min(delta, .05)
    let forward = Number(keys.current.has('w') || keys.current.has('arrowup')) - Number(keys.current.has('s') || keys.current.has('arrowdown')) + touch.current.y
    let strafe = Number(keys.current.has('d') || keys.current.has('arrowright')) - Number(keys.current.has('a') || keys.current.has('arrowleft')) + touch.current.x
    let dx = Math.cos(yaw.current) * forward - Math.sin(yaw.current) * strafe
    let dz = Math.sin(yaw.current) * forward + Math.cos(yaw.current) * strafe
    if (targetIndex >= 0 && !keys.current.size && !touch.current.x && !touch.current.y) {
      const [tx, tz] = door(targetIndex, chogs.length)
      const distance = Math.hypot(tx - pos.x, tz - pos.z)
      if (distance > .28) { dx = (tx - pos.x) / distance; dz = (tz - pos.z) / distance }
      else { dx = 0; dz = 0 }
    }
    if (paused || aim || flight?.phase === 'knock') { dx = 0; dz = 0 }
    const length = Math.hypot(dx, dz)
    moving.current = length > .01
    if (length) {
      dx /= Math.max(1, length); dz /= Math.max(1, length)
      pos.x += dx * step * 4
      pos.z += dz * step * 4
      const distance = Math.hypot(pos.x, pos.z), limit = radius - .35
      if (distance > limit) { pos.x *= limit / distance; pos.z *= limit / distance }
      facing.current += Math.atan2(Math.sin(Math.atan2(dx, dz) - facing.current), Math.cos(Math.atan2(dx, dz) - facing.current)) * (1 - Math.exp(-step * 12))
    }
    if (flight) {
      let index = -1
      for (let i = 0; i < chogs.length; i++) if (chogs[i].id === flight.target) { index = i; break }
      if (index >= 0) {
        const [tx, tz] = door(index, chogs.length)
        facing.current += Math.atan2(Math.sin(Math.atan2(tx - pos.x, tz - pos.z) - facing.current), Math.cos(Math.atan2(tx - pos.x, tz - pos.z) - facing.current)) * (1 - Math.exp(-step * 12))
      }
    }
    if (playerGroup.current) {
      playerGroup.current.position.copy(pos)
      playerGroup.current.rotation.y = facing.current
    }
    const punch = flight?.phase === 'knock' ? .5 * Math.max(0, 1 - (performance.now() - flight.start) / 550) : 0
    const range = zoom.current - punch
    cameraGoal.current.set(pos.x - Math.cos(yaw.current) * range * Math.cos(pitch.current), 1.1 + range * Math.sin(pitch.current), pos.z - Math.sin(yaw.current) * range * Math.cos(pitch.current))
    camera.position.lerp(cameraGoal.current, 1 - Math.exp(-step * 6))
    const shake = flight?.phase === 'result' && flight.outcome !== 0 ? Math.max(0, 1 - (performance.now() - flight.start) / 400) : 0
    if (shake) camera.position.x += Math.sin(clock.elapsedTime * 65) * .08 * shake
    lookGoal.current.set(pos.x + Math.cos(yaw.current) * .8, 1.1, pos.z + Math.sin(yaw.current) * .8)
    camera.lookAt(lookGoal.current)
    let near: number | null = null, nearIndex = -1, best = 1.6
    for (let i = 0; i < chogs.length; i++) {
      const [x, z] = door(i, chogs.length)
      const d = Math.hypot(pos.x - x, pos.z - z)
      if (d < best) { best = d; near = chogs[i].id; nearIndex = i }
    }
    if (near !== lastNear.current) { lastNear.current = near; setNearId(near); onNear(near) }
    if (!aim && nearIndex >= 0 && best < .8 && performance.now() - lastOrbit.current > 2000) {
      const front = streetPosition(nearIndex, chogs.length)
      const desired = Math.atan2(front.z - pos.z, front.x - pos.x)
      yaw.current += Math.atan2(Math.sin(desired - yaw.current), Math.cos(desired - yaw.current)) * (1 - Math.exp(-step * 2.5))
    }
    for (let i = 0; i < bats.current.length; i++) {
      const bat = bats.current[i]
      bat.position.x = pos.x + Math.sin(clock.elapsedTime * (.18 + i * .04) + i * 2.4) * (14 + i * 3)
      bat.position.y = 5.5 + i * .75 + Math.sin(clock.elapsedTime * .8 + i) * .45
      if (bat.children.length === 2) {
        bat.children[0].visible = Math.floor(clock.elapsedTime / .15 + i) % 2 === 0
        bat.children[1].visible = !bat.children[0].visible
      }
    }
    for (let i = 0; i < fogCards.current.length; i++) {
      fogCards.current[i].position.x = pos.x + (i - 2) * 10 + Math.sin(clock.elapsedTime * (.11 + i * .025) + i) * 2
    }
    for (const pool of lampPools.current) pool.position.set(pos.x, 0, pos.z)
  })
  const flightIndex = flight ? chogs.findIndex(c => c.id === flight.target) : -1
  const bossIndex = chogs.findIndex(chog => chog.id === night?.boss.house)
  const nextStop = night?.route.find((_, i) => !(night.mask & (1 << i)))
  const routeIndex = chogs.findIndex(chog => chog.id === nextStop)
  const bloodMoon = night?.theme === 1
  const impact = streetPosition(flightIndex, chogs.length, flight?.outcome === 2 ? .4 : -.52, .05)
  const target: [number, number] | null = flightIndex < 0 ? null : [impact.x, impact.z]
  const tint = (base: string, amount: number) => new Color(base).lerp(new Color(colour), amount)
  return <>
    <color attach="background" args={[bloodMoon ? '#29080d' : '#120a24']} />
    <fog attach="fog" args={[tint(bloodMoon ? '#3a1520' : '#22132f', .035), 15, 42]} />
    <hemisphereLight args={['#8b80c3', '#271524', .47]} />
    <directionalLight position={[-8, 11, 4]} color="#9390dc" intensity={1.05} />
    <group ref={node => { if (node) lampPools.current[0] = node }}>
      <pointLight position={[0, 2.15, 0]} color={tint('#ffa64d', .2)} intensity={8} distance={6} decay={2} />
    </group>
    <pointLight position={[0, 3.6, 0]} color={tint('#ffa64d', .2)} intensity={8} distance={10} decay={2} />
    <Stars radius={90} depth={30} count={350} factor={2} fade speed={.3} />
    <mesh renderOrder={-1000}><sphereGeometry args={[78, 16, 12]} /><meshBasicMaterial map={sky} color={bloodMoon ? '#ff493a' : '#ffffff'} side={BackSide} fog={false} depthWrite={false} /></mesh>
    <mesh position={[0, 4, 0]} renderOrder={-900}>
      <cylinderGeometry args={[radius + 18, radius + 18, 14, 64, 1, true]} /><meshBasicMaterial map={hills} transparent side={BackSide} fog={false} depthWrite={false} />
    </mesh>
    <mesh position={[0, 2.5, 0]} renderOrder={-800}>
      <cylinderGeometry args={[radius + 9, radius + 9, 9, 64, 1, true]} /><meshBasicMaterial map={roofs} transparent side={BackSide} fog={false} depthWrite={false} />
    </mesh>
    <group position={[10, 12, -radius - 12]}>
      <Halo position={[0, 0, -.1]} size={7} opacity={.35} />
      <Card path="/art/ui/moon.svg" position={[0, 0, 0]} size={[2.5, 2.5]} color={bloodMoon ? '#ff493a' : '#ffffff'} />
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.06, 0]}><circleGeometry args={[radius + 6, 80]} /><meshLambertMaterial color={tint('#251c32', .04)} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><ringGeometry args={[Math.max(.5, radius - 4), radius - .2, 80]} /><meshLambertMaterial color={tint('#30283e', .045)} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.015, 0]}><circleGeometry args={[parkRadius, 80]} /><meshLambertMaterial color={tint('#192b28', .04)} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[parkRadius, parkRadius + .15, 80]} /><meshLambertMaterial color={tint('#6b596c', .12)} /></mesh>
    <Sign name={neighbourhood} colour={colour} />
    <HouseShells chogs={chogs} flight={flight} />
    {chogs.map((chog, index) => <HouseCard key={chog.id} chog={chog} state={houses.get(chog.id)} now={now} index={index} count={chogs.length} near={nearId === chog.id} lite={lite} player={player} crew={crews.get(chog.id) ?? 0} route={!!night?.route.includes(chog.id)} shake={flight?.target === chog.id && flight.phase === 'knock' ? flight.start : 0} />)}
    {night && bossIndex >= 0 && <PumpkinBoss key={night.day.toString()} boss={night.boss} index={bossIndex} count={chogs.length} hit={bossHit} />}
    {routeIndex >= 0 && <RouteTrail index={routeIndex} count={chogs.length} player={player} />}
    {!lite && night?.theme === 2 && <CandyRain player={player} />}
    <RepeatedProps count={chogs.length} lite={lite} colour={colour} />
    {!lite && <Sparkles count={45} scale={[radius * 2, 2.5, radius * 2]} size={2.2} speed={.35} color="#ffcf84" position={[0, 1.5, 0]} />}
    {Array.from({ length: lite ? 2 : 5 }, (_, i) => {
      const row = i % 2 ? 1 : -1
      return <group key={i} ref={node => { if (node) fogCards.current[i] = node }} position={[(i - 2) * 10, .55, row * (i < 2 ? 4.5 : 2.65)]} rotation={[0, row === 1 ? Math.PI : 0, 0]}>
        <Card path="/art/ui/fog.svg" position={[0, 0, 0]} size={[15, 1.9]} opacity={.3} />
      </group>
    })}
    {Array.from({ length: 3 }, (_, i) => {
      const row = i % 2 ? 1 : -1
      return <group key={i} ref={node => { if (node) bats.current[i] = node }} position={[0, 5.5, row * 9]} rotation={[0, row === 1 ? Math.PI : 0, 0]}>
        <Card path="/art/ui/bat-1.svg" position={[0, 0, 0]} size={[.9, .5]} />
        <Card path="/art/ui/bat-2.svg" position={[0, 0, 0]} size={[.9, .5]} />
      </group>
    })}
    <group ref={playerGroup}><Player chog={playerArt?.id === playerId ? playerArt : undefined} moving={moving} position={player} facing={facing} lite={lite} /></group>
    <Ghosts feed={feed} chogs={chogs} all={all} lite={lite} />
    {aim && <AimGuide aim={aim} chogs={chogs} player={player} pointer={aimPointer} sample={sampleShot} />}
    {onMetrics && <RenderMetrics onMetrics={onMetrics} />}
    <Effects flight={flight} target={target} player={player} />
    {!lite && <EffectComposer multisampling={0}><Bloom intensity={.55} luminanceThreshold={.7} mipmapBlur /><Vignette eskil={false} offset={.24} darkness={.45} /></EffectComposer>}
  </>
}
