import { useEffect, useState } from 'react'
import type { AssetPack } from './assets'
import { hasAsset, loadAtlas } from './assets'
import { ENEMIES, SPECIALISATIONS, TOWERS, CONSUMABLES } from './data/config'
import { MODIFIERS } from './data/traits'
import { resolveKit } from './data/kits'
import { HeroPreview } from './hero/HeroPreview'
import { thumb } from '../images'

function GuideCharacter({ assets, id }: { assets: AssetPack; id: number }) {
  const kit = resolveKit(assets.kits, assets.traits, assets.chogs, id)
  const [pack, setPack] = useState<AssetPack | null>(null), [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController(), key = `hero-${kit.costume}`
    const keys = [key, ...(hasAsset(`/siege/atlas/${key}@2x.json`) ? [`${key}@2x`] : [])]
    setPack(null); setError(false)
    void Promise.all(keys.filter(key => !assets.atlases.some(a => a.key === key)).map(key => loadAtlas(key, controller.signal))).then(extra => {
      if (!controller.signal.aborted) setPack({ ...assets, atlases: [...assets.atlases, ...extra] })
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [assets, kit.costume])
  return <div className="siege-chog-comparison siege-guide-comparison">
    <figure className="siege-nft"><figcaption>NFT portrait</figcaption><img src={thumb(id, true)} alt={`Original portrait of Chog #${id}`} /><small>Chog #{id}</small></figure>
    <figure className="siege-in-game"><figcaption>In Siege</figcaption>{pack ? <HeroPreview assets={pack} kit={kit} still /> : <span className="siege-character-loading" role="status">{error ? 'Reopen guide to retry.' : 'Loading character…'}</span>}</figure>
  </div>
}

export function FieldGuide({ assets, seen, heroId = 1 }: { assets: AssetPack; seen: string[]; heroId?: number }) {
  const [atlases, setAtlases] = useState(assets.atlases)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all(['units2', 'towers3', 'items'].filter(key => !assets.atlases.some(a => a.key === key)).map(key => loadAtlas(key, controller.signal))).then(extra => { if (!controller.signal.aborted) setAtlases([...assets.atlases, ...extra]) }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [assets])
  const hero = resolveKit(assets.kits, assets.traits, assets.chogs, heroId)
  const entries: { key: string; frame: string; name: string; description: string; group: string; portrait?: string }[] = [
    { key: `hero/${heroId}`, frame: '', portrait: String(heroId), name: hero.legend?.name ?? `Chog #${heroId}`, description: `${assets.kits.slots.weapon[hero.weapon].name} · ${assets.kits.slots.special[hero.special].name}. Its real traits shape its look and powers.`, group: 'Heroes' },
    ...Object.entries(ENEMIES).map(([key, value]) => ({ key: `enemy/${key}`, frame: `enemy/${key}/walk/0`, ...value, group: 'Enemies' })),
    ...Object.entries(TOWERS).map(([key, value]) => ({ key: `tower/${key}`, frame: `tower/${key}/3`, ...value, description: value.description + (value.unlock ? ` Unlock: ${value.unlock.hint}.` : key === 'roost' ? ' Unlock: Bat Roost in the $KNOCK shop.' : ''), group: 'Towers' })),
    ...Object.entries(CONSUMABLES).map(([key, value]) => ({ key: `item/${key}`, frame: `item/${key}`, ...value, description: `${value.description} ${value.stock} per level · ${value.cooldown}s cooldown.`, group: 'Supplies' })),
    ...Object.entries(SPECIALISATIONS).map(([key, value]) => ({ key: `spec/${key}`, frame: `tower/${value.kind}/${key}`, ...value, group: 'Specialisations' })),
    ...MODIFIERS.map(m => ({ key: `mod/${m.name}`, frame: `mod/${m.name}`, name: m.name, description: m.enemy, group: 'Modifiers' })),
    ...Object.entries(assets.kits.slots).filter(([slot]) => slot !== 'emote').flatMap(([slot, families]) => Object.entries(families).filter(([key]) => !key.startsWith('legend-')).map(([key, value]) => ({ key: `kit/${slot}/${key}`, frame: `kit/${slot}/${key}`, name: value.name, description: value.effect || 'Your Chog’s natural look.', group: `Kit · ${slot}` }))),
  ]
  // The bosses: each legend's real portrait, and the Great Pumpkin, discovered the first time they walk the road.
  const bosses = [
    ...Object.entries(assets.legends.legends).map(([id, legend]) => ({ key: `boss/${id}`, portrait: id, frame: '', name: legend.name, description: `${legend.boss.move}: ${legend.boss.effect}.`, group: 'Bosses' })),
    { key: 'boss/pumpkin', portrait: '', frame: '', name: assets.legends.greatPumpkin.name, description: assets.legends.greatPumpkin.phases.join('. ') + '.', group: 'Bosses' },
  ]
  entries.push(...bosses)
  return <>{error && <p role="status">Some guide art could not load. Reopen the guide to retry.</p>}{[...new Set(entries.map(e => e.group))].map(group => <section key={group}><h3>{group}</h3><div className="siege-guide">{entries.filter(e => e.group === group).map(e => {
    const known = seen.includes(e.key) || e.group === 'Heroes' || e.group === 'Supplies' || e.group === 'Towers' && !['tower/egg', 'tower/tp', 'tower/lantern', 'tower/patch'].includes(e.key), atlas = atlases.find(a => a.data.frames[e.frame]), f = atlas?.data.frames[e.frame]?.frame
    const scale = f ? Math.min(96 / f.w, 100 / f.h) : 1
    return <article key={e.key} className={`${known ? '' : 'siege-guide-unseen'} ${e.portrait && known ? 'siege-guide-character' : ''}`}>
      {e.portrait && known ? <GuideCharacter assets={assets} id={Number(e.portrait)} /> : <div className="siege-guide-art" aria-hidden="true">{e.portrait ? <img className="siege-guide-portrait" src={thumb(e.portrait, true)} alt="" /> : e.key === 'boss/pumpkin' ? <span>◉</span> : f && atlas ? <span style={{ display: 'block', width: f.w * scale, height: f.h * scale, backgroundImage: `url(${atlas.image.src})`, backgroundSize: `${atlas.image.width * scale}px ${atlas.image.height * scale}px`, backgroundPosition: `-${f.x * scale}px -${f.y * scale}px` }} /> : <span>{known && e.key === 'kit/trinket/none' ? '—' : '?'}</span>}</div>}
      <h4>{known ? e.name : 'Undiscovered'}</h4><p>{known ? e.description : 'Meet this in a level to learn its secrets.'}</p>
    </article>
  })}</div></section>)}</>
}
