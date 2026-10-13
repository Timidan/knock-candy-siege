import { useEffect, useState } from 'react'
import { Sticker } from '../ui'
import type { AssetPack } from './assets'
import { loadImage } from './assets'
import type { Kit } from './data/kits'
import type { Outcome } from './SiegeScene'
import { LEVELS } from './data/level1'
import { NIGHTS } from './data/endless'
import { heroPainter, loadPreviewHeads } from './hero/HeroPreview'

export const gameLink = () => 'https://knock.timidan.xyz'
export function shareText(result: Outcome, id: number) {
  const score = result.score.toLocaleString('en-US'), stars = `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`
  if (result.mode === 'endless') return `I held out to wave ${result.wave} in Candy Siege Endless with Chog #${id}: ${result.kills} Chogs stopped, ${score} points. Can you beat it? ${gameLink()}`
  if (result.mode === 'daily') return `Daily #${result.daily} in Candy Siege (${LEVELS[result.level - 1].name}, ${NIGHTS[result.theme].name}) with Chog #${id}: ${stars}, ${score} points. Can you beat it? ${gameLink()}`
  return `I ${result.won ? 'held' : 'took on'} ${LEVELS[result.level - 1].name} in Candy Siege with Chog #${id}: ${stars}, ${score} points. Can you beat it? ${gameLink()}`
}
export async function renderShareCard(assets: AssetPack, kit: Kit, costume: string, dance: string, result: Outcome) {
  const [portrait, logo, heads] = await Promise.all([loadImage(`/chogs-256/${kit.id}.webp`), loadImage('/art/ui/logo.svg'), loadPreviewHeads(), document.fonts.ready])
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#21162d'; ctx.fillRect(0, 0, 1080, 1350)
  if (assets.background) { ctx.save(); ctx.globalAlpha = .75; ctx.drawImage(assets.background, (1080 - assets.background.width) / 2, 190); ctx.restore() }
  const shade = ctx.createLinearGradient(0, 0, 0, 1350); shade.addColorStop(0, '#21162d'); shade.addColorStop(.48, '#21162d55'); shade.addColorStop(.85, '#21162d'); ctx.fillStyle = shade; ctx.fillRect(0, 0, 1080, 1350)
  ctx.strokeStyle = '#ffe2ad'; ctx.lineWidth = 6; ctx.strokeRect(26, 26, 1028, 1298)
  const text = (value: string, x: number, y: number, size: number, color = '#ffe3af', font = 'Luckiest Guy') => { ctx.fillStyle = color; ctx.font = `${size}px "${font}", sans-serif`; ctx.fillText(value, x, y) }
  ctx.drawImage(logo, 70, 65, 212, 212 * logo.height / logo.width)
  ctx.textAlign = 'right'; text('CHOG TOWN / AFTER DARK', 1005, 103, 24, '#dac4e4', 'Patrick Hand'); ctx.textAlign = 'left'
  ctx.save(); ctx.translate(74, 242); ctx.rotate(-.04); ctx.shadowColor = '#120c1f'; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8
  text('CANDY', 0, 0, 130); text('SIEGE', 0, 118, 153, '#ff9c6b'); ctx.restore()
  // The endless and daily cards swap the stars for the wave reached, or the night's icon and number.
  const endless = result.mode === 'endless', daily = result.mode === 'daily'
  text(endless ? 'HOW LONG CAN YOU HOLD?' : daily ? `DAILY #${result.daily} · ${NIGHTS[result.theme].name.toUpperCase()}` : result.won ? 'THE PORCH IS YOURS.' : 'ONE MORE NIGHT?', 76, 416, 28, '#d1bbdd', 'Patrick Hand')
  text(endless ? 'ENDLESS' : LEVELS[result.level - 1].name, 76, 474, 50)
  if (endless) text(`WAVE ${result.wave}`, 74, 546, 64, '#ffd16f')
  else text('★'.repeat(result.stars) + '☆'.repeat(3 - result.stars), 74, 546, 58, '#ffd16f', 'sans-serif')
  const icons = assets.atlases.find(a => a.key === 'props3'), icon = daily ? icons?.data.frames[NIGHTS[result.theme].icon]?.frame : undefined
  if (icons && icon) ctx.drawImage(icons.image, icon.x, icon.y, icon.w, icon.h, 905, 132, 96, 96)
  // Keep the original NFT identifiable beside its trait-built character.
  ctx.save(); ctx.beginPath(); ctx.arc(886, 340, 91, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(portrait, 795, 249, 182, 182); ctx.restore()
  ctx.strokeStyle = kit.home ? '#ffd477' : '#b69acb'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(886, 340, 94, 0, Math.PI * 2); ctx.stroke()
  ctx.textAlign = 'center'; text(`Chog #${kit.id}`, 886, 468, 30, '#ffe3af', 'Patrick Hand'); ctx.textAlign = 'left'
  text(result.score.toLocaleString('en-US'), 72, 671, 95, '#fff0d2'); text('POINTS', 80, 715, 30, '#d7c1e3', 'Patrick Hand')
  const layer = document.createElement('canvas'); layer.width = layer.height = 1200
  const lc = layer.getContext('2d')!, clip = assets.dances[dance]?.clip ?? 'dance-gg'
  const paint = heroPainter(assets, kit, heads, costume || kit.costume)
  // Double-size parts lift the old 2× cap: draw at 4× and let the fit below bring the hero down to the card.
  lc.translate(600, 800); lc.scale(paint.sharp ? 4 : 2, paint.sharp ? 4 : 2); paint(lc, clip, assets.rig.clips[clip].ms * .4)
  // Fit the actual dance silhouette, including horizontal moves such as the worm.
  const pixels = lc.getImageData(0, 0, 1200, 1200).data
  let left = 1200, right = 0, top = 1200, bottom = 0
  for (let y = 0; y < 1200; y++) for (let x = 0; x < 1200; x++) if (pixels[(y * 1200 + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  // 345 px tall keeps the hero's head under the PORCH KEEPER label (a sharp 4× hero is always scaled down to the box).
  const w = right - left + 1, h = bottom - top + 1, scale = Math.min(1, 430 / w, 345 / h)
  ctx.fillStyle = '#30203de6'; ctx.strokeStyle = kit.home ? '#ffd477' : '#b69acb'; ctx.lineWidth = 5
  ctx.beginPath(); ctx.roundRect(517, 510, 476, 470, [60, 18, 60, 18]); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = '#80608f'; ctx.lineWidth = 2; ctx.strokeRect(535, 528, 440, 434)
  ctx.textAlign = 'center'; text('PORCH KEEPER', 755, 580, 28); text('✦', 557, 622, 32); text('✦', 952, 922, 32); ctx.textAlign = 'left'
  ctx.fillStyle = '#130d2299'; ctx.beginPath(); ctx.ellipse(752, 936, 180, 27, 0, 0, Math.PI * 2); ctx.fill()
  ctx.drawImage(layer, left, top, w, h, 752 - w * scale / 2, 947 - h * scale, w * scale, h * scale)
  text(`CHOG #${kit.id}`, 74, 826, 44)
  text(kit.home ? 'HOME HERO' : 'GUEST HERO', 76, 865, 25, '#d7c1e3', 'Patrick Hand')
  text('SIGNATURE MOVE', 76, 921, 24, '#d7c1e3', 'Patrick Hand')
  text(assets.kits.slots.emote[kit.emote].name, 76, 961, 31)
  ctx.fillStyle = '#ffe9c4'; ctx.beginPath(); ctx.roundRect(65, 1010, 950, 171, 24); ctx.fill()
  ctx.textAlign = 'center'
  for (const [i, stat] of [[endless ? String(result.wave) : String(result.jars), endless ? 'WAVE REACHED' : 'JARS SAVED'], [String(result.kills), 'CHOGS STOPPED'], [String(result.heroLevel), 'HERO LEVEL']].entries()) {
    const x = 225 + i * 315; text(stat[0], x, 1090, 62, '#382541'); text(stat[1], x, 1141, 23, '#624467', 'Patrick Hand')
  }
  text('YOUR PORCH. YOUR CHOG. YOUR HIGH SCORE.', 540, 1228, 27, '#ffd8a1', 'Patrick Hand')
  ctx.textAlign = 'left'; text(new Date(result.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 68, 1283, 23, '#d7c1e3', 'Patrick Hand')
  ctx.textAlign = 'right'; ctx.font = '24px "Patrick Hand", sans-serif'; ctx.fillText(gameLink().replace('https://', ''), 1006, 1283, 710)
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be created.')), 'image/png'))
}

export function ShareCard({ assets, kit, costume, dance, result }: { assets: AssetPack; kit: Kit; costume: string; dance: string; result: Outcome }) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState(''), [open, setOpen] = useState(false), [status, setStatus] = useState(''), [attempt, setAttempt] = useState(0)
  const text = shareText(result, kit.id), link = gameLink()
  useEffect(() => {
    let active = true, objectUrl = ''
    setFile(null); setStatus('')
    // Drawing the card blocks the main thread for a moment (a 1200 × 1200 pixel scan), so wait until the result fanfare has landed.
    const timer = setTimeout(() => void renderShareCard(assets, kit, costume, dance, result).then(blob => {
      if (!active) return
      const file = new File([blob], `candy-siege-chog-${kit.id}.png`, { type: 'image/png' }); objectUrl = URL.createObjectURL(file); setFile(file); setUrl(objectUrl)
    }).catch(() => { if (active) setStatus('Could not make the share image. Check your connection and try again.') }), attempt ? 0 : 1400)
    return () => { active = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [assets, kit.id, costume, dance, result, attempt])
  const share = async () => {
    if (!file) return
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file], title: 'Candy Siege', text, url: link }); return }
      catch (reason) { if ((reason as Error).name === 'AbortError') return; setStatus('Sharing was unavailable. You can save the image and copy the text below.') }
    }
    setOpen(true)
  }
  const intents = {
    X: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    Telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(` ${link}`, ''))}`,
    WhatsApp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    Facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`,
  }
  return <div className="siege-sharing">
    <Sticker tone="gold" disabled={!file} onClick={() => void share()}>{file ? 'Share your night ↗' : 'Making share card…'}</Sticker>
    {status && <p role="status">{status}{!file && <button className="siege-text-button" onClick={() => setAttempt(n => n + 1)}>Retry image</button>}</p>}
    {open && file && <section className="siege-share-panel" aria-label="Share your result">
      <img src={url} alt={`Candy Siege result: Chog #${kit.id}, ${result.stars} stars, ${result.score} points`} />
      <div className="row"><a className="sticker sticker--gold" href={url} download={file.name}>Download image</a><Sticker onClick={async () => { try { await navigator.clipboard.writeText(text); setStatus('Text copied.') } catch { setStatus('Copy the text from the box below.') } }}>Copy text</Sticker></div>
      <textarea aria-label="Share text" value={text} readOnly onFocus={event => event.currentTarget.select()} />
      <div className="row">{Object.entries(intents).map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer">{name} ↗</a>)}</div>
      <small>These links share the text and game link. Download and attach the image to include it. Nothing is uploaded by Knock.</small>
      <button className="siege-text-button" onClick={() => setOpen(false)}>Close share panel</button>
    </section>}
  </div>
}
