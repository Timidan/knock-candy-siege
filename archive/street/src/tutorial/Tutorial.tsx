import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { thumb } from '../images'
import { Sticker } from '../ui'
import { markTutorialSeen } from './seen'
import './tutorial.css'

const titles = ['The street', 'Treat, trick or bounce', 'Aim. Let it fly.', 'Raid the bowl', 'Tonight', 'Your house', '$KNOCK, and ready']
const tricks = [
  { name: 'Egg', icon: 'egg', overlay: 'egg-splat' },
  { name: 'Toilet paper', icon: 'toilet-paper', overlay: 'toilet-paper' },
  { name: 'Mustache', icon: 'paint-brush', overlay: 'painted-mustache' },
]

function knockOutcome(candy: boolean, trap: boolean, ghost: boolean) {
  return candy ? 'treat' : trap && !ghost ? 'bounce' : 'trick'
}

// Same facade coordinates and grades as game/aim.ts, without loading the game.
// shortcut: this is a standalone practice facade, update with gradeFront if its geometry changes.
function gradeThrow(point: { x: number; y: number }) {
  const x = (point.x - 500) / 400
  const y = (600 - point.y) / 400
  if (x >= -.075 && x <= .875 && y >= -.55 && y <= .4) return 'BULLSEYE'
  if (x >= -.925 && x <= 1 && y >= -1.21 && y <= .46) return 'HIT'
  const roofWidth = (1.325 - y) / .865
  if (y >= .46 && y <= 1.325 && x >= -.2 - .82 * roofWidth && x <= -.2 + 1.28 * roofWidth) return 'HIT'
  return 'MISS'
}

if (import.meta.env.DEV) {
  console.assert(knockOutcome(true, true, false) === 'treat' && knockOutcome(false, true, false) === 'bounce' && knockOutcome(false, true, true) === 'trick', 'Tutorial bowl and trap outcomes')
  console.assert(gradeThrow({ x: 660, y: 600 }) === 'BULLSEYE' && gradeThrow({ x: 300, y: 880 }) === 'HIT' && gradeThrow({ x: 1100, y: 600 }) === 'MISS', 'Tutorial practice grades')
}

function Portrait({ yours = false, overlay }: { yours?: boolean; overlay?: string }) {
  return <span className="tutorial-portrait">
    <img src={thumb(yours ? 1 : 2)} alt={yours ? 'Your practice Chog' : 'Their practice Chog'} />
    {overlay && <img className="tutorial-mark" src={`/art/overlays/${overlay}-right.svg`} alt="" />}
  </span>
}

function House({ overlay, bowl = false, trap = false }: { overlay?: string; bowl?: boolean; trap?: boolean }) {
  return <span className="tutorial-house" aria-hidden="true">
    <span className="tutorial-window"><Portrait overlay={overlay} /></span>
    <img className="tutorial-facade" src="/art/scenery/house.svg" alt="" />
    {bowl && <img className="tutorial-bowl" src="/art/scenery/state-bowl.svg" alt="" />}
    {trap && <img className="tutorial-trap" src="/art/icons/pumpkin-trap.svg" alt="" />}
  </span>
}

function Street() {
  const [witch, setWitch] = useState(false)
  const [knocked, setKnocked] = useState(false)
  return <>
    <p>Every Chog Genesis has a house in this haunted town, with 3 knocks a night (4 in a witch hat).</p>
    <p>Your revenge knock targets the last Chog that tricked or raided you.</p>
    <div className="tutorial-street-demo">
      <Sticker className="tutorial-house-button" aria-label="Try your first knock" onClick={() => setKnocked(true)}>
        <House overlay={witch ? 'witch-hat' : undefined} />
      </Sticker>
      <div className="tutorial-street-bag">
        <span>Quiet night</span>
        <strong>{(witch ? 4 : 3) - (knocked ? 1 : 0)} knocks left</strong>
        <Sticker icon="witch-hat" aria-pressed={witch} onClick={() => setWitch(!witch)}>Hat {witch ? 'on' : 'off'}</Sticker>
      </div>
    </div>
    <Sticker icon="door-knocker" tone="orange" onClick={() => setKnocked(true)}>{knocked ? 'Knocked!' : 'Try your first knock'}</Sticker>
    <div className="tutorial-result" role="status">
      {knocked ? <><strong>Ration collected!</strong><span>+5 candy · +3 eggs · 1 knock used</span></> : <><strong>Tap the house</strong><span>First knock → 5 candy + 3 eggs</span></>}
    </div>
  </>
}

function Door() {
  const [candy, setCandy] = useState(true)
  const [trap, setTrap] = useState(false)
  const [ghost, setGhost] = useState(false)
  const [trick, setTrick] = useState(0)
  const [shot, setShot] = useState<{ outcome: ReturnType<typeof knockOutcome>; trick: number; count: number } | null>(null)
  const reset = () => setShot(null)
  const outcome = shot?.outcome
  const throwTrick = () => {
    const result = knockOutcome(candy, trap, ghost)
    setShot({ outcome: result, trick, count: (shot?.count ?? 0) + 1 })
    if (result === 'bounce') setTrap(false)
  }
  return <>
    <p>Change the bowl and trap, pick a trick, then tap the door to throw.</p>
    <p>A house whose owner hasn't played yet is haunted: it may treat you, bounce your trick, or take the hit.</p>
    <div className="tutorial-door-stage">
      <div className="tutorial-visitor"><Portrait yours overlay={shot?.outcome === 'bounce' ? tricks[shot.trick].overlay : ghost ? 'ghost-sheet' : undefined} /><span>You</span></div>
      <Sticker className="tutorial-house-button tutorial-door-button" aria-label={`Throw ${tricks[trick].name.toLowerCase()} at the door`} onClick={throwTrick}>
        <House bowl={candy} trap={trap} overlay={shot?.outcome === 'trick' ? tricks[shot.trick].overlay : undefined} />
        <span className="tutorial-door-label">Throw!</span>
      </Sticker>
      {shot && <img key={shot.count} className="tutorial-callout" src={`/art/ui/${outcome === 'bounce' ? 'boing' : outcome === 'trick' ? 'splat' : 'treat'}.svg`} alt="" />}
    </div>
    <div className="tutorial-toggles tutorial-door-options">
      <Sticker aria-pressed={candy} aria-label={`Bowl: ${candy ? 'candy' : 'empty'}`} onClick={() => { setCandy(!candy); reset() }}><span>Bowl<br />{candy ? 'Candy' : 'Empty'}</span></Sticker>
      <Sticker aria-pressed={trap} aria-label={`Trap: ${trap ? 'set' : 'off'}`} onClick={() => { setTrap(!trap); reset() }}><span>Trap<br />{trap ? 'Set' : 'Off'}</span></Sticker>
      <Sticker aria-pressed={ghost} aria-label={`Ghost sheet: ${ghost ? 'on' : 'off'}`} onClick={() => { setGhost(!ghost); reset() }}><span>Ghost sheet<br />{ghost ? 'On' : 'Off'}</span></Sticker>
    </div>
    <div className="tutorial-tricks" role="group" aria-label="Pick a trick">
      {tricks.map((item, i) => <Sticker key={item.name} icon={item.icon} aria-pressed={trick === i} onClick={() => { setTrick(i); reset() }}>{item.name}</Sticker>)}
    </div>
    <div className="tutorial-result" role="status">
      {outcome === 'treat' ? <><strong>TREAT · +1 candy</strong><span>Plus any $CHOG the bowl pays; keep your trick, even with a trap set.</span></>
        : outcome === 'bounce' ? <><strong>BOUNCE · the trick lands on you</strong><span>Trick and trap used · 24-hour mark, unless cleaned</span></>
        : outcome === 'trick' ? <><strong>TRICK · mark their portrait</strong><span>Trick used · 24-hour mark, unless cleaned · they get a revenge knock</span></>
        : <><strong>What will this door do?</strong><span>A ghost sheet keeps traps from bouncing your trick.</span></>}
    </div>
  </>
}

function Aim() {
  const [point, setPoint] = useState({ x: -120, y: 600 })
  const [holding, setHolding] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [grade, setGrade] = useState<ReturnType<typeof gradeThrow> | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const gesture = useRef<{ start: number; x: number; y: number; pointer?: number; dragged: boolean } | null>(null)
  const target = useRef(point)
  const moveTarget = (next: typeof point) => { target.current = next; setPoint(next) }
  const holdTarget = (start: number) => ({ x: -120 + ((performance.now() - start) % 2400) / 2400 * 1240, y: 600 })
  const begin = (x = 0, y = 0, pointer?: number) => {
    if (gesture.current) return
    gesture.current = { start: performance.now(), x, y, pointer, dragged: false }
    setGrade(null); setHolding(true); setDragging(false)
    moveTarget({ x: -120, y: 600 })
  }
  const cancel = () => { gesture.current = null; setHolding(false); setDragging(false) }
  const release = () => {
    const current = gesture.current
    if (!current) return
    const landed = current.dragged ? target.current : holdTarget(current.start)
    moveTarget(landed); setGrade(gradeThrow(landed)); cancel()
  }
  const gestureHandlers = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement | SVGSVGElement>) => {
      if (!event.isPrimary || event.button !== 0) return
      event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
      begin(event.clientX, event.clientY, event.pointerId)
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement | SVGSVGElement>) => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId || !svg.current) return
      const dx = event.clientX - current.x, dy = event.clientY - current.y
      if (!current.dragged && Math.hypot(dx, dy) < 8) return
      current.dragged = true; setDragging(true)
      const rect = svg.current.getBoundingClientRect()
      const scale = Math.min(rect.width / 1500, rect.height / 1300)
      moveTarget({ x: Math.max(-180, Math.min(1180, 660 - dx / scale)), y: Math.max(-20, Math.min(1170, 600 - dy / scale)) })
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement | SVGSVGElement>) => { if (gesture.current?.pointer === event.pointerId) release() },
    onPointerCancel: cancel, onLostPointerCapture: cancel, onBlur: cancel,
  }
  useEffect(() => {
    if (!holding) return
    const timer = window.setInterval(() => {
      if (gesture.current && !gesture.current.dragged) moveTarget(holdTarget(gesture.current.start))
    }, 40)
    const blur = () => cancel()
    window.addEventListener('blur', blur)
    return () => { window.clearInterval(timer); window.removeEventListener('blur', blur) }
  }, [holding])
  return <>
    <p>Press the picture or the Throw button, pull back like a slingshot, and release. Or hold Throw and let go when the aim looks right.</p>
    <p>A miss costs nothing; only a hit sends a transaction.</p>
    <svg ref={svg} {...gestureHandlers} tabIndex={-1} className={`tutorial-aim ${holding && !dragging ? 'tutorial-aim-holding' : ''}`} viewBox="-250 -70 1500 1300" role="img" aria-label="Practice house; aim for the portrait for a bullseye">
      <image href={thumb(2)} x="470" y="440" width="380" height="380" />
      <image href="/art/scenery/house.svg" width="1000" height="1200" />
      <image className="tutorial-reticle" href="/art/ui/aim-reticle.svg" x={point.x - 85} y={point.y - 85} width="170" height="170" />
    </svg>
    <div className="tutorial-aim-readout" aria-hidden="true">{holding ? `Aim: ${gradeThrow(point)}` : 'Portrait → BULLSEYE · house → HIT'}</div>
    <Sticker className="tutorial-throw" tone="orange" icon="egg" aria-label="Practice throw: hold Space or Enter, then release; or drag back and release"
      {...gestureHandlers}
      onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) begin() } }}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); release() } }}
      onClick={event => {
        // Assistive technology can activate a button without pointer or key events.
        if (event.detail === 0 && !gesture.current) { moveTarget({ x: 660, y: 600 }); setGrade('BULLSEYE') }
      }}>{holding ? 'Release to throw' : 'Hold Throw'}</Sticker>
    <div className="tutorial-result" role="status"><strong>{grade ?? 'Give it a go'}</strong><span>{grade === 'MISS' ? 'No transaction · no knock or trick used' : grade ? 'In the game: confirm the transaction to use a knock' : 'Keyboard: hold Space or Enter, then release'}</span></div>
  </>
}

function Raid() {
  const [trap, setTrap] = useState(false)
  const [ghost, setGhost] = useState(false)
  const caught = trap && !ghost
  return <>
    <p>Raid a bowl with candy to grab up to 3 candy and up to three treat payouts of $CHOG, limited by its balance.</p>
    <p>A raid always uses a regular knock and gives them a revenge knock.</p>
    <div className="tutorial-door-stage tutorial-raid-stage">
      <div className="tutorial-visitor"><Portrait yours overlay={ghost ? 'ghost-sheet' : undefined} /><span>You</span></div>
      <House bowl trap={trap} />
      <img key={`${caught}`} className="tutorial-callout" src={`/art/ui/${caught ? 'caught' : 'looted'}.svg`} alt="" />
    </div>
    <div className="tutorial-toggles">
      <Sticker icon="pumpkin-trap" aria-pressed={trap} onClick={() => setTrap(!trap)}>Trap: {trap ? 'set' : 'off'}</Sticker>
      <Sticker icon="ghost-sheet" aria-pressed={ghost} onClick={() => setGhost(!ghost)}>Sheet: {ghost ? 'on' : 'off'}</Sticker>
    </div>
    <div className="tutorial-result" role="status">
      <strong>{caught ? 'CAUGHT · lose up to 2 candy' : 'LOOTED · up to 3 candy + $CHOG'}</strong>
      <span>{caught ? 'Your candy goes into their bowl; the trap is used up.' : ghost && trap ? 'Your ghost sheet gets you past the trap.' : 'Try setting the trap to see what changes.'}</span>
    </div>
  </>
}

function Tonight() {
  const [card, setCard] = useState<'route' | 'boss' | 'crews'>('route')
  return <>
    <p>Tap tonight’s plans to see what you can earn.</p>
    <div className="tutorial-plans">
      <Sticker aria-pressed={card === 'route'} onClick={() => setCard('route')}><img src="/art/route/lantern-marker.svg" alt="" /><span>The route<strong>3 houses</strong></span></Sticker>
      <Sticker aria-pressed={card === 'boss'} onClick={() => setCard('boss')}><img src="/art/boss/great-pumpkin-idle.svg" alt="" /><span>The Great Pumpkin<strong>Hit with tricks</strong></span></Sticker>
      <Sticker aria-pressed={card === 'crews'} onClick={() => setCard('crews')}><img src="/art/icons/crew.svg" alt="" /><span>Crews<strong>Join 1 of 4, for good</strong></span></Sticker>
    </div>
    <div className="tutorial-plan-result tutorial-result" role="status" key={card}>
      {card === 'route' ? <><div className="tutorial-stamps">{[1, 2, 3].map(stop => <img key={stop} src="/art/route/stamp-done.svg" alt="" />)}</div><strong>Knock or raid all 3 stops → +10 candy</strong></>
        : card === 'boss' ? <><img className="tutorial-boss" src="/art/boss/great-pumpkin-down.svg" alt="Defeated Great Pumpkin" /><strong>When it falls, everyone who hit it can claim candy</strong><span>Each hit costs a regular knock and a trick</span></>
        : <><div className="tutorial-crews">{['ghosts', 'witches', 'pumpkins', 'bats'].map(crew => <span key={crew}><img src={`/art/crews/${crew}.svg`} alt="" />{crew}</span>)}</div><strong>Winning crew → +3 candy next night</strong><span>Join before the bonus night · no bonus for ties</span></>}
    </div>
    <p className="tutorial-themes">Blood Moon doubles crew points; Candy Rain doubles rations; Costume Night adds a knock if you wear a costume.</p>
  </>
}

function YourHouse() {
  const [action, setAction] = useState('bowl')
  const choices = [
    { id: 'bowl', icon: 'candy-bucket', label: 'Fill bowl', result: 'Your candy → treats for visitors' },
    { id: 'trap', icon: 'pumpkin-trap', label: 'Set trap', result: 'Use a pumpkin trap → catch a raid or bounce a trick' },
    { id: 'craft', icon: 'cauldron', label: 'Craft', result: '2 candy → 1 toilet paper in the cauldron' },
    { id: 'costume', icon: 'ghost-sheet', label: 'Wear costume', result: 'Wear a ghost sheet → get past traps' },
  ]
  return <>
    <p>Fill your bowl, set a trap, craft items from candy in the cauldron, and wear a costume.</p>
    <p>Candy and items live in your Chog’s own wallet, so they go with the Chog if it’s sold.</p>
    <div className="tutorial-home-stage">
      <House bowl={action === 'bowl'} trap={action === 'trap'} overlay={action === 'costume' ? 'ghost-sheet' : undefined} />
      {action === 'craft' && <img className="tutorial-cauldron" src="/art/icons/cauldron.svg" alt="Cauldron" />}
    </div>
    <div className="tutorial-toggles">
      {choices.map(choice => <Sticker key={choice.id} icon={choice.icon} aria-pressed={action === choice.id} onClick={() => setAction(choice.id)}>{choice.label}</Sticker>)}
    </div>
    <div className="tutorial-result" role="status"><strong>{choices.find(choice => choice.id === action)?.result}</strong></div>
  </>
}

function Ready({ finish }: { finish: (choice: 'play' | 'explore') => void }) {
  // These are relay defaults (scripts/relay.mjs), not rewards minted by Knock.sol.
  const rewards = [{ label: 'Treat', amount: 100 }, { label: 'Raid', amount: 50 }, { label: 'Route', amount: 500 }, { label: 'Boss loot', amount: 300 }]
  const [reward, setReward] = useState(0)
  return <>
    <p>Earn $KNOCK through vibe/vibe on Robinhood Chain Testnet: testnet only, no real value.</p>
    <div className="tutorial-toggles tutorial-rewards" role="group" aria-label="$KNOCK rewards">
      {rewards.map((item, i) => <Sticker key={item.label} aria-pressed={reward === i} onClick={() => setReward(i)}><span>{item.label}<strong>+{item.amount}</strong></span></Sticker>)}
    </div>
    <div className="tutorial-receipt tutorial-result" role="status"><img src="/art/token/knock-coin.svg" alt="" /><strong>{rewards[reward].label} → +{rewards[reward].amount} $KNOCK</strong><span>Paid to the wallet that owns your Chog</span></div>
    <p>Chog Genesis holders connect the wallet that owns their Chog; everyone else can explore and watch.</p>
    <div className="tutorial-finish">
      <Sticker tone="orange" icon="key" onClick={() => finish('play')}>Play</Sticker>
      <Sticker icon="lantern" onClick={() => finish('explore')}>Explore the street</Sticker>
    </div>
  </>
}

export default function Tutorial({ onClose }: { onClose: (choice: 'play' | 'explore' | 'skip') => void }) {
  const [step, setStep] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const closed = useRef(false)
  const titleId = useId()
  const finish = (choice: 'play' | 'explore' | 'skip') => {
    if (closed.current) return
    closed.current = true
    markTutorialSeen()
    dialog.current?.close()
    onClose(choice)
  }
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = dialog.current!
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    modal.showModal()
    heading.current?.focus()
    return () => {
      modal.close()
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    if (content.current) content.current.scrollTop = 0
  }, [step])
  return <dialog ref={dialog} className="knock-tutorial" aria-modal="true" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); finish('skip') }}
    onKeyDown={event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        setStep(current => Math.max(0, Math.min(titles.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1))))
      }
    }}>
    <section className="board tutorial-sheet">
      <div className="tutorial-top"><span>Practice · {step + 1}/{titles.length} · no wallet needed</span><Sticker onClick={() => finish('skip')}>Skip</Sticker></div>
      <h2 ref={heading} id={titleId} tabIndex={-1}>{titles[step]}</h2>
      <div className="tutorial-content" ref={content}>
        <div key={step} className="tutorial-step">
          {step === 0 ? <Street /> : step === 1 ? <Door /> : step === 2 ? <Aim /> : step === 3 ? <Raid /> : step === 4 ? <Tonight /> : step === 5 ? <YourHouse /> : <Ready finish={finish} />}
        </div>
      </div>
      <nav className="tutorial-nav" aria-label="Tutorial steps">
        <Sticker disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Sticker>
        <div className="tutorial-pips" aria-label={`Step ${step + 1} of ${titles.length}`}>
          {titles.map((title, i) => <span key={title} className={i <= step ? 'tutorial-pip-done' : ''} aria-hidden="true"><img src="/art/icons/candy.svg" alt="" /></span>)}
        </div>
        {step < titles.length - 1 ? <Sticker tone="orange" onClick={() => setStep(step + 1)}>Next</Sticker> : <span className="tutorial-nav-end">Let’s go!</span>}
      </nav>
    </section>
  </dialog>
}
