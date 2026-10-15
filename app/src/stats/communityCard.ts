import type { Stats } from './StatsPage'
import { thumb } from '../images'

// The /stats share image: a 1200 x 630 community card drawn the way ShareCard.tsx draws a result card (canvas, the game's fonts, a PNG blob).
// It loads its own portraits: importing siege/assets would pull Phaser into this page.
const NIGHT = '#1B0F2B', DUSK = '#2E1A47', MONAD = '#836EF9', PUMPKIN = '#FF7A00', GOLD = '#FFD23F', CREAM = '#FFF4D6', LILAC = '#D7C1E3'
const RANKS = [GOLD, '#DFE3EE', '#E8914F']
const fmt = (n: number) => n.toLocaleString('en-US')
// A missing or slow portrait leaves an empty ring; it never stops the card.
const portrait = (id: number) => new Promise<HTMLImageElement | null>(resolve => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = thumb(id, true)
  setTimeout(() => resolve(null), 8000)
})
export async function renderCommunityCard(stats: Stats, goal: number) {
  const top = stats.heroes.slice(0, 3)
  const [faces] = await Promise.all([Promise.all(top.map(hero => portrait(hero.id))), document.fonts.load('40px "Luckiest Guy"').catch(() => []), document.fonts.load('28px "Patrick Hand"').catch(() => [])]) // a font that failed draws in the fallback
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630
  const ctx = canvas.getContext('2d')!
  const text = (value: string, x: number, y: number, size: number, color: string, font = 'Luckiest Guy', max?: number) => { ctx.fillStyle = color; ctx.font = `${size}px "${font}", sans-serif`; ctx.fillText(value, x, y, max) }
  // Display text with a dark outline over an extruded lip, like the game's stickers.
  const bold = (value: string, x: number, y: number, size: number, color: string, lip: string, max?: number) => {
    ctx.font = `${size}px "Luckiest Guy", sans-serif`; ctx.lineWidth = size / 9; ctx.strokeStyle = NIGHT; ctx.lineJoin = 'round'
    ctx.strokeText(value, x, y + size / 16, max); ctx.fillStyle = lip; ctx.fillText(value, x, y + size / 16, max)
    ctx.strokeText(value, x, y, max); ctx.fillStyle = color; ctx.fillText(value, x, y, max)
  }
  const box = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, line = 4) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = line; ctx.strokeStyle = NIGHT; ctx.stroke() }
  ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, 1200, 630)
  for (const [x, y, r, color] of [[940, 300, 460, '#836ef970'], [120, 640, 420, '#ff7a0038']] as const) {
    const glow = ctx.createRadialGradient(x, y, 10, x, y, r); glow.addColorStop(0, color); glow.addColorStop(1, '#1b0f2b00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 1200, 630)
  }
  ctx.strokeStyle = MONAD; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(18, 18, 1164, 594, 36); ctx.stroke()

  // Left: the tag, the community total, the goal bar and three headline numbers.
  const tag = 'KNOCK: CANDY SIEGE · LIVE COMMUNITY STATS'
  ctx.font = '24px "Luckiest Guy", sans-serif'
  box(56, 50, Math.min(ctx.measureText(tag).width + 48, 640), 52, 26, MONAD)
  text(tag, 80, 86, 24, '#ffffff', 'Luckiest Guy', 592)
  bold(fmt(stats.kills.total), 60, 214, 112, GOLD, PUMPKIN, 640)
  text('MONSTERS STOPPED', 64, 268, 40, CREAM)
  const pct = Math.min(100, stats.kills.total / goal * 100)
  text(`Community goal: ${fmt(goal)} monsters stopped`, 64, 326, 30, LILAC, 'Patrick Hand')
  box(64, 342, 620, 46, 23, '#120a1f')
  if (pct > 0) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(70, 348, Math.max(34, 608 * pct / 100), 34, 17); ctx.clip()
    for (let x = 30; x < 760; x += 30) [CREAM, PUMPKIN, GOLD].forEach((color, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + i * 10, 348); ctx.lineTo(x + i * 10 + 10, 348); ctx.lineTo(x + i * 10 - 24, 382); ctx.lineTo(x + i * 10 - 34, 382); ctx.fill() })
    ctx.restore()
  }
  text(stats.kills.total >= goal ? 'Goal reached!' : `${Math.floor(pct)}% of the way. Every player’s stops count.`, 64, 426, 28, LILAC, 'Patrick Hand', 620)
  const tiles: [number, string][] = [[stats.players.allTime, 'VISITORS'], [stats.runs.started, 'RUNS'], [stats.bosses.total, 'BOSSES BEATEN']]
  tiles.forEach(([n, label], i) => {
    const x = 64 + i * 212
    box(x, 456, 196, 104, 18, DUSK)
    text(fmt(n), x + 18, 506, 44, GOLD, 'Luckiest Guy', 160)
    text(label, x + 18, 542, 22, LILAC, 'Luckiest Guy', 160)
  })

  // Right: the top three Chogs by runs, with their portraits.
  ctx.textAlign = 'center'; text('TOP PORCH PROTECTORS', 942, 92, 30, PUMPKIN); ctx.textAlign = 'left'
  if (!top.length) text('No heroes on porch duty yet.', 760, 200, 30, LILAC, 'Patrick Hand')
  top.forEach((hero, i) => {
    const y = 120 + i * 138, cx = 812, cy = y + 62
    ctx.fillStyle = '#261a35'; ctx.beginPath(); ctx.arc(cx, cy, 54, 0, Math.PI * 2); ctx.fill()
    const face = faces[i]
    if (face) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 54, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(face, cx - 54, cy - 54, 108, 108); ctx.restore() }
    ctx.lineWidth = 7; ctx.strokeStyle = RANKS[i]; ctx.beginPath(); ctx.arc(cx, cy, 55, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = 3; ctx.strokeStyle = NIGHT; ctx.beginPath(); ctx.arc(cx, cy, 59, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = RANKS[i]; ctx.beginPath(); ctx.arc(cx - 46, cy - 42, 20, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.stroke()
    ctx.textAlign = 'center'; text(String(i + 1), cx - 46, cy - 32, 26, NIGHT); ctx.textAlign = 'left'
    text(`CHOG #${hero.id}`, 886, cy + 2, 36, CREAM, 'Luckiest Guy', 270)
    text(`${fmt(hero.runs)} ${hero.runs === 1 ? 'run' : 'runs'} on the porch`, 888, cy + 38, 28, LILAC, 'Patrick Hand', 270)
  })
  ctx.textAlign = 'right'; text('knock.timidan.xyz', 1150, 590, 32, CREAM); ctx.textAlign = 'left'
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be created.')), 'image/png'))
}
