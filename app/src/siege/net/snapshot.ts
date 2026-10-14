import type { SiegeScene } from '../SiegeScene'

// Explicit simulation fields only: no renderer, settings, camera or wall clock.
const pick = (object: object, keys: string) => Object.fromEntries(keys.split(' ').filter(key => (object as Record<string, unknown>)[key] !== undefined).map(key => [key, (object as Record<string, unknown>)[key]]))
const rigState = (rig: object) => ({ ...pick(rig, 'clip time facing walkSpeed size pendingDance'), releasePending: !!(rig as { release?: unknown }).release })
const guardState = (guard: object) => pick(guard, 'x y hp maxHp respawn cooldown slow life damage')


export function simulationSnapshot(scene: SiegeScene) {
    const internal = scene as unknown as { later: { at: number; run: () => void; state: unknown }[]; rewarded: Set<number>; combos: Set<string> }
    return {
      rules: { level: scene.options.level, mode: scene.options.mode, players: scene.heroes.map(hero => hero.selection) },
      scene: pick(scene, 'seed clock candy jars kills killsByKind bossesDefeated jarsLost earlyCalls wave countdown spellCooldown itemCooldown stock schedule waveAlive bridgeUp sugarRush bonfire missTime speedScale candyScale shuffle ended'),
      rng: { seed: scene.seed, draws: scene.randomDraws },
      rewarded: internal.rewarded, combos: internal.combos, talents: scene.talentDeadlines,
      heroes: scene.heroes.map(hero => ({ ...pick(hero, 'kit x y target level xp hp maxHp cooldown ability respawn hit fear slow charge dealt attackCount specials ultimates revives talents talentLevels offered frogUsed skullUsed shield untargetable devil scare pep smoke streak lastKill waveBuff zones trail oddity attackTarget'), rig: rigState(hero.rig) })),
      // Pool order and inactive generations matter for reused projectile targets.
      enemies: scene.enemies.map(enemy => ({ ...pick(enemy, 'active generation wave kind id mods path distance speed hp maxHp candy jars status age hit attack skill lucky revived armour visible slowPower heroDot heroOwner returning casting poisonStacks shield gold lit'), route: enemy.route ? { length: enemy.route.length, points: enemy.route.points.map(p => [p.x, p.y]) } : null, position: [enemy.x, enemy.y], boss: enemy.boss ? { ...pick(enemy.boss, 'id cast casting phase started intro dash dashSpeed blocks revived trail total stolen child state stateTime roll shared split immune scale'), rig: enemy.boss.rig ? rigState(enemy.boss.rig) : null } : null })),
      towers: scene.towers.map(tower => tower ? { ...pick(tower, 'x y kind level spec rank spent targeting cooldown stun boost gold'), guards: tower.guards.map(guardState) } : null),
      projectiles: scene.projectiles.map(projectile => ({ ...pick(projectile, 'active generation life duration x y fromX fromY endX endY damage kind splash arc frame frameCount owner'), targetSlot: projectile.target ? scene.enemies.indexOf(projectile.target) : -1, onHit: !!projectile.onHit, after: !!projectile.after })),
      traps: scene.traps.map(trap => pick(trap, 'kind x y life armed')),
      items: scene.items.map(item => pick(item, 'kind x y life pulse hp')),
      allies: scene.allies.map(guardState), blockers: scene.blockers.map(blocker => pick(blocker, 'x y life radius')),
      hazards: scene.hazards, fallen: scene.fallen,
      props: scene.props.map(prop => ({ data: prop.data, cooldown: prop.cooldown, used: prop.used })),
      sources: scene.sources.map(light => pick(light, 'x y r')),
      deferred: internal.later.map(task => ({ at: task.at, callback: !!task.run, state: task.state })),
    }
  }
