import type { SiegeScene } from '../SiegeScene'
import type { HeroSelection } from './protocol'
import { RoomClient } from './RoomClient'
import { Lockstep } from './Lockstep'
import { hashState } from './hash'
import { simulationSnapshot } from './snapshot'
import { startClock } from './clock'

export type CoopSession = {
  client: RoomClient
  players: [HeroSelection, HeroSelection]
  onStatus: (message: string) => void
  onError: (message: string) => void
}

/** The only co-op simulation clock. Phaser continues to own presentation. */
export function attachRoom(scene: SiegeScene) {
  const session = scene.options.coop!, client = session.client
  let finished = false, waitingSince = 0
  const driver = new Lockstep({
    command: (player, command) => scene.applyCommand(player, command),
    step: (dt, tick) => scene.networkStep(dt, tick),
    snapshot: () => simulationSnapshot(scene),
  }, {
    send: message => client.send(message),
    onStop: (_reason, message) => { stopClock(); if (!finished) session.onError(message); client.close() },
  })
  scene.net = driver
  // Initial talent cards belong to the agreed initial state too.
  scene.heroes.forEach((hero, player) => { if (hero.choices) scene.talentDeadlines[player] = 450 })
  const stopClock = startClock(() => {
    if (scene.ended && driver.tick >= scene.coopFinishAt) return false
    const advanced = driver.advance()
    if (advanced) { if (waitingSince) session.onStatus(''); waitingSince = 0 }
    else if (driver.state === 'running') {
      waitingSince ||= performance.now()
      if (performance.now() - waitingSince > 350) session.onStatus('Waiting for partner…')
    }
    return advanced
  })
  const unsubscribe = client.subscribe(message => {
    driver.receive(message)
    if (message.type === 'start') session.onStatus('')
    if (!finished && scene.coopResult && driver.verifiedTick >= scene.coopFinishAt) {
      finished = true; stopClock(); session.onStatus(''); scene.options.onEnd(scene.coopResult)
    }
  })
  scene.events.once('shutdown', () => { stopClock(); unsubscribe(); client.close() })
  session.onStatus('Waiting for both Chogs…')
  client.ready(hashState(simulationSnapshot(scene)))
}
