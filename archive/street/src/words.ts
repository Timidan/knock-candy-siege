import type { Visit } from './chain'

const items = ['', 'Candy', 'Egg', 'Toilet paper', 'Mustache', 'Pumpkin trap', 'Ghost sheet', 'Witch hat']
const tricked = ['', '', 'egged', 'toilet-papered', 'painted a mustache on']
export const age = (then: bigint, now: bigint) => {
  const minutes = Math.max(0, Number((now - then) / 60n))
  return minutes < 60
    ? `${minutes} min ago`
    : minutes < 1440
      ? `${Math.floor(minutes / 60)} hr ago`
      : `${Math.floor(minutes / 1440)} d ago`
}
export function visitText(v: Visit, now: bigint) {
  const [from, to, item] = [`#${v.from}`, `#${v.to}`, items[Number(v.item)].toLowerCase()]
  const what = [
    `${from} got a treat from ${to}`,
    `${from}'s ${item} bounced off ${to}`,
    `${from} ${tricked[Number(v.item)]} ${to}`,
    `${from} cleaned up ${to}`,
    `${from} raided ${to}`,
    `${from} got caught raiding ${to}`,
  ][v.outcome]
  return `${what} · ${age(v.timestamp, now)}`
}
