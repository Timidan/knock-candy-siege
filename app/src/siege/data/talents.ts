import type { Kit } from './kits'
export type Talent = { id: string; name: string; effect: string }
const families: Record<string, Record<string, [string, string]>> = {
  weapon: {
    'pitch-deck': ['Extra Slide', 'A fourth card joins the fan.'], scepter: ['Spell Echo', 'Bolts echo to one neighbour.'], 'ball-chain': ['Long Chain', 'Swing radius +35%.'], fastball: ['Triple Play', 'Bounces to a third enemy.'], slingshot: ['Quick Draw', 'Fire 25% faster.'], mascot: ['Big Entrance', 'Slam radius +35%.'], 'egg-lob': ['Jumbo Eggs', 'Splash radius +40%.'], junk: ['Treasure Toss', 'Always throws the strongest junk.'], blaster: ['Candy Scatter', 'Two extra pellets in a wider cone.'], fan: ['Cold Front', 'Gusts also slow.'], 'ray-gun': ['Paint the Target', 'Beams mark enemies for bonus damage.'], anime: ['Overcharge', 'Beam damage +40%.'], tickle: ['Laughing Fit', 'Every slap heals 3 health.'],
  },
  special: {
    laser: ['Split Sweep', 'Two beams sweep different targets.'], 'target-lock': ['Wide Scan', 'Mark five enemies.'], 'deal-with-it': ['Stay Cool', 'Stun lasts 2 seconds longer.'], 'tear-flood': ['High Tide', 'Pushback doubles.'], charm: ['Popular Chog', 'Charm five enemies.'], 'play-dead': ['Second Wind', 'Jump scare heals 30% health.'], 'stare-down': ['Unblinking', 'Fear lasts 2 seconds longer.'], confetti: ['Party Favours', 'Confusion lasts 3 seconds longer.'], 'pep-talk': ['Standing Ovation', 'Tower speed bonus becomes 50%.'],
  },
  passive: {
    'money-mouth': ['Compound Candy', 'Kill candy bonus grows to 25%.'], sticky: ['Extra Sticky', 'Attacks slow by 35%.'], 'rainbow-trail': ['Kind Rainbow', 'The trail also heals guards.'], 'sweet-tooth': ['Second Helping', 'Collected candy heals twice as much.'], honk: ['Encore', 'Every fifth attack confuses.'], tough: ['Tougher', 'Another 20% maximum health.'], pity: ['Please Stay', 'Nearby enemies move 20% slower.'], cheerful: ['Big Smile', 'Nearby tower damage bonus becomes 10%.'],
  },
  headgear: {
    royal: ['Royal Decree', 'Tower damage bonus becomes 25%.'], spellcraft: ['Spell Master', 'Spell cooldown reduction becomes 30%.'], hellfire: ['Long Burn', 'Burns last twice as long.'], armored: ['Fortified', 'Armour grows to 45%.'], 'degen-luck': ['Lucky Night', 'Double-drop chance becomes 20%.'], focus: ['Clear Focus', 'Another 15% critical chance.'], 'bucket-shield': ['Double Bucket', 'Blocks two hits each wave.'], chill: ['Deep Chill', 'Nearby enemies deal 35% less damage.'], prankster: ['Prank Budget', 'Traps cost 35% less.'], oddity: ['Stranger Still', 'Your oddity triggers twice as often.'], bareheaded: ['Free as Air', 'Another 15% move speed.'],
  },
  ultimate: {
    meteor: ['Hot Centre', 'Ground fire lasts twice as long.'], tidal: ['Undertow', 'Wave also freezes enemies briefly.'], twister: ['Tight Spiral', 'Drops enemies into a 3-second stun.'], vanish: ['Encore Act', 'Backstabs deal 50% more damage.'], arcane: ['Storm Front', 'Four more homing bolts.'], bloom: ['Full Bloom', 'Refill 5 jars and heal guards.'], 'love-bomb': ['Long Love', 'Charm lasts 3 seconds longer.'], purify: ['Fresh Start', 'Also heals the hero completely.'], thunder: ['Rolling Thunder', 'Chains through 18 enemies.'], 'candy-bomb': ['Biggest Treat', 'Blast radius +35%.'],
  },
}
// Hand-made legend kits get one mastery card per slot, named for the move it improves.
const legendTalents = { weapon: 'Basic attacks hit 25% harder.', special: 'Stronger, longer, and ready 15% sooner.', ultimate: 'The finale hits 35% harder.' }
const generic: Record<number, Talent> = {
  2: { id: 'generic:power', name: 'Strong Arm', effect: 'All basic attacks deal 15% more damage.' },
  3: { id: 'generic:cooldown', name: 'Quick Thinking', effect: 'Special cooldown is 20% shorter.' },
  4: { id: 'generic:health', name: 'Staying Power', effect: '+25% maximum health.' },
  5: { id: 'generic:charge', name: 'Sweet Energy', effect: 'Ultimate charges 25% faster.' },
}
export function talentChoices(kit: Kit, level: number): [Talent, Talent] | null {
  if (!generic[level]) return null
  const slot = level === 2 ? 'weapon' : level === 3 ? 'special' : level === 5 ? 'ultimate' : kit.passive === 'cheerful' && kit.headgear !== 'bareheaded' ? 'headgear' : 'passive'
  const family = kit[slot], move = kit.legend && (slot === 'weapon' || slot === 'special' || slot === 'ultimate') ? kit.legend[slot].name : ''
  const [name, effect] = move ? [`${move} Mastery`, legendTalents[slot as keyof typeof legendTalents]] : families[slot][family]
  return [{ id: `${slot}:${family}`, name, effect }, generic[level]]
}
