import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Sticker, playUi } from '../ui'
import type { AssetPack } from './assets'
import { loadImage } from './assets'
import { reducedMotion, CRATE_CANDY } from './data/save'
import { thumb } from '../images'
import type { Kit } from './data/kits'
import type { Outcome } from './SiegeScene'
import { LEVELS, ENDLESS_LEVEL } from './data/level1'
import { NIGHTS, DAILY_LEVEL } from './data/endless'
import { heroPainter, loadPreviewHeads } from './hero/HeroPreview'

export const gameLink = () => 'https://knock.timidan.xyz'
// A friend's challenge, carried in a shared link: the night (1-6, DAILY_LEVEL or ENDLESS_LEVEL), their Chog, score and stars, plus the Daily's
// number or a story night's run seed. Nothing in it is verified, so the game calls the score "theirs" and never saves or reports it.
export type Challenge = { level: number; hero: number; score: number; stars: number; day: number; seed?: number }
export function challengeLink(result: Outcome, id: number, seed?: number) {
  const params = new URLSearchParams({ vs: result.mode === 'level' ? String(result.level) : result.mode, chog: String(id), score: String(result.score) })
  if (result.mode !== 'endless') params.set('stars', String(result.stars))
  if (result.mode === 'daily') params.set('day', String(result.daily))
  if (result.mode === 'level' && seed !== undefined) params.set('seed', String(seed >>> 0))
  return `${gameLink()}/?${params}`
}
// Strict: each value a plain integer in range and the night a known one. Anything else and the link is quietly ignored (null).
export function readChallenge(search: string): Challenge | null {
  const query = new URLSearchParams(search), vs = query.get('vs') ?? ''
  const int = (key: string, max: number, min = 0) => { const value = query.get(key) ?? ''; return /^\d{1,10}$/.test(value) && +value >= min && +value <= max ? +value : NaN }
  const level = vs === 'daily' ? DAILY_LEVEL : vs === 'endless' ? ENDLESS_LEVEL : /^[1-6]$/.test(vs) ? +vs : NaN
  const hero = int('chog', 1969, 1), score = int('score', 9_999_999), stars = level === ENDLESS_LEVEL ? 0 : int('stars', 3), day = level === DAILY_LEVEL ? int('day', 99_999, 1) : 0
  const seed = level <= 6 && query.has('seed') ? int('seed', 4_294_967_295) : undefined
  return [level, hero, score, stars, day, seed ?? 0].some(Number.isNaN) ? null : { level, hero, score, stars, day, ...(seed === undefined ? {} : { seed }) }
}
// Every shared result is a challenge: the text ends with its challenge link.
export function shareText(result: Outcome, id: number, seed?: number) {
  const score = result.score.toLocaleString('en-US'), stars = `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`, link = challengeLink(result, id, seed)
  if (result.mode === 'endless') return `I held out to wave ${result.wave} in Candy Siege Endless with Chog #${id}: ${result.kills} Chogs stopped, ${score} points. Can you beat it? ${link}`
  if (result.mode === 'daily') return `Daily #${result.daily} in Candy Siege (${LEVELS[result.level - 1].name}, ${NIGHTS[result.theme].name}) with Chog #${id}: ${stars}, ${score} points. Can you beat it? ${link}`
  return `I ${result.won ? 'held' : 'took on'} ${LEVELS[result.level - 1].name} in Candy Siege with Chog #${id}: ${stars}, ${score} points. Can you beat it? ${link}`
}
const NIGHT = '#1B0F2B', DUSK = '#2E1A47', MONAD = '#836EF9', PUMPKIN = '#FF7A00', SLIME = '#22C55E', GOLD = '#FFD23F'
// A star, or with four points and a thin waist, a sparkle.
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5, inner = .48) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / points, d = i % 2 ? r * inner : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) }
  ctx.closePath()
}
// The name of the run's last defeated boss: 'pumpkin' is the Great Pumpkin, any other id is a legend's Chog number.
const bossName = (assets: AssetPack, id?: string) => !id ? '' : id === 'pumpkin' ? assets.legends.greatPumpkin.name : assets.legends.legends[id]?.name ?? ''
// Only what the run proves: a boss the scene recorded as defeated on a won level, else a full porch at the end (perks refill jars, so not "no jars lost"), else the kill count.
function accolade(result: Outcome, boss: string) {
  return result.won && boss ? `BOSS SLAYER · ${boss.toUpperCase()}` : result.won && result.jars === 20 ? 'PERFECT DEFENSE · ALL 20 JARS SAVED' : `${result.kills.toLocaleString('en-US')} ${result.kills === 1 ? 'CHOG' : 'CHOGS'} STOPPED`
}
// A trophy for the NFT: the Chog cheers out of a Monad-purple burst on the right, the result sits on the left. Defeats get a quieter card.
// featured: the run's Chog was that day's Chog of the Day, which adds a gold badge under the accolade. crate: the run started with a Candy Crate, which adds a badge below.
export async function renderShareCard(assets: AssetPack, kit: Kit, costume: string, result: Outcome, boss = '', featured = false, crate = false) {
  const [portrait, heads] = await Promise.all([loadImage(thumb(kit.id, true)), loadPreviewHeads(), document.fonts.ready])
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350
  const ctx = canvas.getContext('2d')!
  const endless = result.mode === 'endless', daily = result.mode === 'daily', proud = result.won || endless, frame = kit.home ? GOLD : proud ? MONAD : '#5b4a7a'
  const text = (value: string, x: number, y: number, size: number, color: string, font = 'Luckiest Guy', max?: number) => { ctx.fillStyle = color; ctx.font = `${size}px "${font}", sans-serif`; ctx.fillText(value, x, y, max) }
  // Display text with a dark outline over an extruded lip, like the game's stickers.
  const bold = (value: string, x: number, y: number, size: number, color: string, lip: string, max?: number) => {
    ctx.font = `${size}px "Luckiest Guy", sans-serif`; ctx.lineWidth = size / 9; ctx.strokeStyle = NIGHT; ctx.lineJoin = 'round'
    ctx.strokeText(value, x, y + size / 16, max); ctx.fillStyle = lip; ctx.fillText(value, x, y + size / 16, max)
    ctx.strokeText(value, x, y, max); ctx.fillStyle = color; ctx.fillText(value, x, y, max)
  }
  ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, 1080, 1350)
  if (assets.background) { ctx.save(); ctx.globalAlpha = proud ? .3 : .18; ctx.drawImage(assets.background, (1080 - assets.background.width) / 2, 240); ctx.restore() }
  const shade = ctx.createLinearGradient(0, 0, 0, 1350); shade.addColorStop(0, NIGHT); shade.addColorStop(.5, '#1b0f2b44'); shade.addColorStop(1, NIGHT); ctx.fillStyle = shade; ctx.fillRect(0, 0, 1080, 1350)
  // A win holds the GG fist pump (the default victory dance); a defeat stands at ease. Neither plays the signature emote, so no Chog sobs on its trophy.
  const clip = proud ? 'dance-gg' : 'idle', layer = document.createElement('canvas'); layer.width = layer.height = 1200
  const lc = layer.getContext('2d')!, paint = heroPainter(assets, kit, heads, costume || kit.costume)
  // Double-size parts lift the old 2× cap: draw at 4× and let the fit below bring the hero down to the card.
  lc.translate(600, 800); lc.scale(paint.sharp ? 4 : 2, paint.sharp ? 4 : 2); paint(lc, clip, proud ? 1400 : assets.rig.clips[clip].ms * .4)
  // Fit the actual silhouette, raised fist included.
  const pixels = lc.getImageData(0, 0, 1200, 1200).data
  let left = 1200, right = 0, top = 1200, bottom = 0
  for (let y = 0; y < 1200; y++) for (let x = 0; x < 1200; x++) if (pixels[(y * 1200 + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  const w = right - left + 1, h = bottom - top + 1, scale = Math.min(1.25, 440 / w, 680 / h), dw = w * scale, dh = h * scale
  const cx = 810, feet = 1150, lift = proud ? 26 : 0, gy = feet - dh * .55
  const glow = ctx.createRadialGradient(cx, gy, 20, cx, gy, 600)
  glow.addColorStop(0, proud ? '#c4b8ff' : '#4d3d70'); glow.addColorStop(.3, proud ? '#836ef9bb' : '#3b2d5a88'); glow.addColorStop(1, '#836ef900')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1350)
  if (proud) {
    const rays = ctx.createRadialGradient(cx, gy, 60, cx, gy, 720); rays.addColorStop(0, '#ffffff40'); rays.addColorStop(1, '#ffffff00')
    ctx.fillStyle = rays; ctx.beginPath()
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.moveTo(cx, gy); ctx.arc(cx, gy, 720, a, a + Math.PI / 18); ctx.closePath() }
    ctx.fill()
  }
  ctx.fillStyle = '#0c061899'; ctx.beginPath(); ctx.ellipse(cx, feet - 6, Math.max(110, dw * .38), 24, 0, 0, Math.PI * 2); ctx.fill()
  ctx.drawImage(layer, left, top, w, h, cx - dw / 2, feet - lift - dh, dw, dh)
  if (proud) for (const [x, y, r] of [[cx - 270, gy - 200, 26], [cx + 235, gy - 300, 32], [cx + 250, gy + 150, 18], [cx - 250, gy + 230, 15]]) { star(ctx, x, y, r, 4, .3); ctx.fillStyle = '#fff4d6'; ctx.fill() }
  ctx.strokeStyle = frame; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(22, 22, 1036, 1306, 44); ctx.stroke()
  // Left column: the game and level, the stars (or the wave reached), the score and one accolade.
  const tag = `KNOCK: CANDY SIEGE · ${endless ? 'Endless' : daily ? `Daily #${result.daily} · ${NIGHTS[result.theme].name}` : LEVELS[result.level - 1].name}`.toUpperCase()
  ctx.font = '30px "Luckiest Guy", sans-serif'
  const pw = Math.min(ctx.measureText(tag).width + 60, 860)
  ctx.fillStyle = proud ? MONAD : DUSK; ctx.strokeStyle = NIGHT; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(70, 76, pw, 64, 32); ctx.fill(); ctx.stroke()
  text(tag, 100, 120, 30, proud ? '#ffffff' : '#d7c1e3', 'Luckiest Guy', pw - 60)
  const icons = assets.atlases.find(a => a.key === 'props3'), icon = daily ? icons?.data.frames[NIGHTS[result.theme].icon]?.frame : undefined
  if (icons && icon) ctx.drawImage(icons.image, icon.x, icon.y, icon.w, icon.h, 86 + pw, 64, 88, 88)
  text(endless ? 'HOW LONG CAN YOU HOLD?' : result.won ? 'THE PORCH IS YOURS.' : 'ONE MORE NIGHT?', 74, 226, 40, '#d7c1e3', 'Patrick Hand')
  if (endless) bold(`WAVE ${result.wave}`, 70, 440, 120, GOLD, PUMPKIN, 500)
  else for (let i = 0; i < 3; i++) {
    const x = 150 + i * 170, y = i === 1 ? 350 : 374, r = i === 1 ? 84 : 74, earned = i < result.stars
    star(ctx, x, y + 9, r); ctx.fillStyle = NIGHT; ctx.fill()
    const fill = ctx.createLinearGradient(0, y - r, 0, y + r); fill.addColorStop(0, '#ffe680'); fill.addColorStop(.55, GOLD); fill.addColorStop(1, '#f59e0b')
    star(ctx, x, y, r); ctx.fillStyle = earned ? fill : '#36234e'; ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = NIGHT; ctx.lineJoin = 'round'; ctx.stroke()
  }
  bold(result.score.toLocaleString('en-US'), 66, 648, 168, proud ? '#fff4d6' : '#d9c8e6', proud ? PUMPKIN : DUSK, 500)
  text('POINTS', 74, 708, 38, '#d7c1e3', 'Patrick Hand')
  // The pill's colour names the accolade: Monad purple for a boss slayer, slime green for a perfect porch, pumpkin otherwise.
  const award = accolade(result, boss), [face, lip] = !proud ? [DUSK, '#140a22'] : result.won && boss ? [MONAD, '#5438dc'] : result.won && result.jars === 20 ? [SLIME, '#15803d'] : [PUMPKIN, '#b84e00']
  const pill = (label: string, y: number, face: string, lip: string, ink: string, mark: string) => {
    ctx.font = '28px "Luckiest Guy", sans-serif'
    const w = Math.min(ctx.measureText(label).width + 100, 560)
    ctx.lineWidth = 5; ctx.strokeStyle = NIGHT
    ctx.beginPath(); ctx.roundRect(70, y + 8, w, 66, 33); ctx.fillStyle = lip; ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.roundRect(70, y, w, 66, 33); ctx.fillStyle = face; ctx.fill(); ctx.stroke()
    star(ctx, 110, y + 32, 19); ctx.fillStyle = mark; ctx.fill()
    text(label, 142, y + 44, 28, ink, 'Luckiest Guy', w - 100)
  }
  pill(award, 754, face, lip, proud ? NIGHT : '#eadff2', proud ? NIGHT : '#d7c1e3')
  if (featured) pill('CHOG OF THE DAY', 852, GOLD, '#c48a0c', NIGHT, NIGHT)
  if (crate) pill(`CANDY CRATE +${CRATE_CANDY}`, featured ? 950 : 852, DUSK, '#140a22', '#eadff2', PUMPKIN)
  // Footer: the original NFT stays identifiable beside its number.
  ctx.fillStyle = '#12091fdd'; ctx.strokeStyle = frame; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(52, 1186, 976, 112, 30); ctx.fill(); ctx.stroke()
  ctx.save(); ctx.beginPath(); ctx.arc(116, 1242, 42, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(portrait, 74, 1200, 84, 84); ctx.restore()
  ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(116, 1242, 44, 0, Math.PI * 2); ctx.stroke()
  text(`CHOG #${kit.id}`, 182, 1262, 50, '#fff4d6')
  ctx.textAlign = 'right'; text(gameLink().replace('https://', ''), 996, 1256, 36, '#d7c1e3', 'Patrick Hand'); ctx.textAlign = 'left'
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be created.')), 'image/png'))
}

// `bosses` is the scene's runStats().bossesDefeated; only its last entry's name reaches the effect, so a fresh array each render can't redraw the card.
// children sit on the share button's line (the result card's feedback link), so the card stays short on a landscape phone.
// seed: the run's seed, which a story night's challenge link carries. back: this run answered a friend's challenge.
export function ShareCard({ assets, kit, costume, result, bosses, featured = false, crate = false, seed, back = false, children }: { assets: AssetPack; kit: Kit; costume: string; result: Outcome; bosses?: string[]; featured?: boolean; crate?: boolean; seed?: number; back?: boolean; children?: ReactNode }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState(''), [open, setOpen] = useState(false), [status, setStatus] = useState(''), [attempt, setAttempt] = useState(0), [sent, setSent] = useState('')
  const text = shareText(result, kit.id, seed), link = challengeLink(result, kit.id, seed), boss = result.won ? bossName(assets, bosses?.at(-1)) : ''
  useEffect(() => {
    let active = true, objectUrl = ''
    setFile(null); setStatus('')
    // Drawing the card blocks the main thread for a moment (a 1200 × 1200 pixel scan), so wait until the result fanfare has landed.
    const timer = setTimeout(() => void renderShareCard(assets, kit, costume, result, boss, featured, crate).then(blob => {
      if (!active) return
      const file = new File([blob], `candy-siege-chog-${kit.id}.png`, { type: 'image/png' }); objectUrl = URL.createObjectURL(file); setFile(file); setUrl(objectUrl)
    }).catch(() => { if (active) setStatus('Could not make the share image. Check your connection and try again.') }), attempt ? 0 : 1400)
    return () => { active = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [assets, kit.id, costume, result, boss, featured, crate, attempt])
  const share = async () => {
    if (!file) return
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file], title: 'Candy Siege', text, url: link }); return }
      catch (reason) { if ((reason as Error).name === 'AbortError') return; setStatus('Sharing was unavailable. You can save the image and copy the text below.') }
    }
    setOpen(true)
  }
  // The challenge alone, without the image: the system share sheet where there is one, else the text and link on the clipboard.
  const challenge = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Candy Siege', text: text.replace(` ${link}`, ''), url: link }); return }
      catch (reason) { if ((reason as Error).name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(text); setSent('Challenge copied. Send it to a friend!') } catch { setSent(`Copy your challenge link: ${link}`) }
  }
  const intents = {
    X: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    Telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(` ${link}`, ''))}`,
    WhatsApp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    Facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`,
  }
  // The fallback panel opens at the bottom of a tall result card, so it scrolls into view.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { if (open) panel.current?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' }) }, [open])
  return <div className="siege-sharing">
    <div className="siege-share-row"><Sticker tone="gold" sound="ui-confirm" disabled={!file} onClick={() => void share()}>{file ? 'Share your night ↗' : 'Making share card…'}</Sticker><Sticker sound="ui-confirm" onClick={() => void challenge()}>{back ? 'Challenge back ↗' : 'Challenge a friend ↗'}</Sticker>{children}</div>
    {sent && <p className="siege-challenge-sent" role="status">{sent}</p>}
    {status && <p role="status">{status}{!file && <button className="siege-text-button" onClick={() => setAttempt(n => n + 1)}>Retry image</button>}</p>}
    {open && file && <section ref={panel} className="siege-share-panel" aria-label="Share your result">
      <img src={url} alt={`Candy Siege result: Chog #${kit.id}, ${result.stars} stars, ${result.score} points`} />
      <div className="row"><a className="sticker sticker--gold" href={url} download={file.name} onClick={() => playUi('ui-confirm')}>Download image</a><Sticker sound="ui-confirm" onClick={async () => { try { await navigator.clipboard.writeText(text); setStatus('Text copied.') } catch { setStatus('Copy the text from the box below.') } }}>Copy text</Sticker></div>
      <textarea aria-label="Share text" value={text} readOnly onFocus={event => event.currentTarget.select()} />
      <div className="row">{Object.entries(intents).map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer">{name} ↗</a>)}</div>
      <small>These links share the text and game link. Download and attach the image to include it. Nothing is uploaded by Knock.</small>
      <button className="siege-text-button" onClick={() => { setOpen(false); playUi('ui-close') }}>Close share panel</button>
    </section>}
  </div>
}
