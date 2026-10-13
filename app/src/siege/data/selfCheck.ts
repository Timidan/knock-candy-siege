import { eliteBonus, modifiersFor, traitsFor } from './traits'
import { LEVEL1, readGeometry } from './level1'
import { starsFor } from './config'

// Two small development checks: real trait decoding, and rejecting a broken art map.
export function selfCheck() {
  const traits = traitsFor({ keys: ['Aura', 'Eyes', 'Tier'], values: { Aura: ['', 'Burning Aura'], Eyes: ['', 'Green laser'], Tier: ['', 'Epic'] }, chogs: { '1': [1, 1, 1] } }, 1)
  console.assert(modifiersFor(traits).join(',') === 'burning,laser,elite' && eliteBonus(traits) === 2 && starsFor(20) === 3 && starsFor(12) === 2 && starsFor(1) === 1 && starsFor(0) === 0, 'Siege trait and reward rules')
  console.assert(readGeometry(LEVEL1.geometry) !== null && readGeometry({ ...LEVEL1.geometry, paths: [[]] }) === null, 'Siege keeps a playable map when an art export is incomplete')
}
