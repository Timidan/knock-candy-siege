import { loadAtlas, loadHeroAssets, loadLevelAssets } from '../assets'
import type { AssetPack } from '../assets'
import { resolveKit } from '../data/kits'
import { LEVELS } from '../data/level1'
import { bossAtlasKey } from '../Boss'
import type { HeroSelection } from './protocol'

export async function prepareParty(assets: AssetPack, players: [HeroSelection, HeroSelection], level: number, signal: AbortSignal) {
  let pack = await loadLevelAssets(assets, level, signal)
  for (const player of players) {
    const kit = resolveKit(pack.kits, pack.traits, pack.chogs, player.id, player.home)
    pack = await loadHeroAssets(pack, kit, signal, player.costume, player.owned)
  }
  const bosses = LEVELS[level - 1].waves.flatMap(wave => wave.boss ? [wave.boss.id] : [])
  const keys = new Set(bosses.length ? ['boss', ...bosses.map(bossAtlasKey)] : [])
  // Both peers must finish these loads before ready; a local fallback cannot decide spawn time.
  for (const key of keys) if (!pack.atlases.some(atlas => atlas.key === key)) pack.atlases.push(await loadAtlas(key, signal))
  return pack
}
