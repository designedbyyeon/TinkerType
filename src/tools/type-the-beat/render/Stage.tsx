import { useEffect, useMemo, useRef, useState } from 'react'
import { compose, decompose } from '../../../shared/text/hangul'
import { useSignFace } from '../../../shared/media/type/hangul/face'
import { missingFrom } from '../../../shared/media/type/measure'
import { isTyping } from '../../../shared/ui/typing'
import { PlayIcon, StopIcon } from '../icons'
import { makeTransport, type Transport } from '../audio/transport'
import {
  deckOf,
  snapAlong,
  snapTo,
  type DeckSpec,
  type Role,
} from '../geometry/deck'
import { gridOf, xAt } from '../geometry/grid'
import { MAX_LANES, isEmpty, removeLane, setLevel, toggleStep } from '../geometry/sequence'
import { useStore } from '../store'
import { useCopy } from '../../../shared/i18n/lang'
import { COPY } from '../copy'
import { Platter } from './Platter'
import { Ruler } from './Ruler'
import { Sequencer } from './Sequencer'
import { Surfaces } from './Surfaces'

/**
 * The work area: the deck on the left, the bar on the right, the transport at the
 * foot.
 *
 * **The beat is built by turning the discs and tapping steps.** There is no text
 * field — dial a sound on the three wheels, and tap it into the bar. Which is a
 * drum machine's gesture, and the reason the type had to move out of a field and
 * into the machine: the read-out, the lane headers and the letters on the wheels
 * are now the only type there is, and they are all of it.
 *
 * **The transport is here and not in the rail**, which is tool 04's rule — an empty
 * stage is the thing that has to say what to do next — plus a reason of its own: an
 * `AudioContext` will not start without a gesture, so this button *is* that gesture.
 */

/** Air between lane rows, px. */
const GUTTER = 9
/** The strip at the foot the transport chips occupy, px. */
const TRANSPORT = 92
/** Inset of the panels from the stage edge, px. */
const MARGIN = 34
/** Padding inside a panel, px. */
const PAD = 26
/** Corner radius of a panel, px. */
const RADIUS = 22

export function Stage() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const pushHistory = useStore((s) => s.pushHistory)
  const setInteracting = useStore((s) => s.setInteracting)
  const setPlaying = useStore((s) => s.setPlaying)
  const playing = useStore((s) => s.playing)
  const stageRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<SVGSVGElement>(null)
  const c = useCopy(COPY)

  const { face, loading, error: faceError } = useSignFace()

  // The work area is whatever the window gives us. There is no page edge.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measure = () => {
      const width = Math.max(1, Math.round(stage.clientWidth))
      const height = Math.max(1, Math.round(stage.clientHeight))
      const current = useStore.getState().doc
      if (current.width === width && current.height === height) return
      setDoc({ width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [setDoc])

  /*
   * The transport, made once and handed the store's own getter.
   *
   * `useStore.getState` and not a value from a hook: a scheduler that reads a React
   * snapshot books the whole next bar against a document the designer has already
   * changed, and unlike every other bug in this repository you cannot see it in a
   * screenshot. See the note at the top of `audio/transport.ts`.
   */
  const transportRef = useRef<Transport | null>(null)
  const transport = () => {
    if (!transportRef.current) {
      transportRef.current = makeTransport(() => useStore.getState().doc)
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        ;(window as unknown as { __beatAudio?: Transport }).__beatAudio = transportRef.current
      }
    }
    return transportRef.current
  }
  useEffect(() => () => transportRef.current?.dispose(), [])

  /* ------------------------------------------------------------- geometry */

  const deckSpec: DeckSpec = {
    radius: doc.radius,
    letter: doc.letter,
    spacing: doc.spacing,
  }
  const deck = deckOf(doc.dialed, deckSpec)

  const deckWidth = deck ? deck.box.width + PAD * 2 : 0
  const deckLeft = MARGIN
  const barLeft = deckLeft + deckWidth + 18
  const barWidth = Math.max(220, doc.width - barLeft - MARGIN)

  /*
   * Wide enough for the clear mark, the lane's own letter, and its fader.
   *
   * **Not a multiple of the letter size**, which is what it used to be. Two of the
   * three things in here do not scale with the type — a fader is a fader at any
   * lane height and so is a cross — so a purely proportional header collapses onto
   * them at the small end: at Lane 16 the letter, the cross and the fader cap all
   * wanted the same twelve pixels. The floor is the letter plus what the other two
   * actually occupy.
   */
  const headerWidth = Math.round(Math.max(doc.lane * 1.9, doc.lane + 42))
  const rowHeight = Math.round(doc.lane * 1.5)
  /*
   * A step is as wide as the panel allows, and no wider.
   *
   * The floor used to be 10px, which is what made the grid run out through the
   * panel's right edge in a narrow window: a minimum that the available width
   * cannot honour is not a minimum, it is an overflow. Four is the point below
   * which a hit has nothing left to draw with.
   */
  const column = Math.max(
    4,
    Math.floor((barWidth - PAD * 2 - headerWidth) / Math.max(1, doc.steps)),
  )

  const grid = useMemo(
    () =>
      gridOf(doc, doc.dialed, {
        column,
        rowHeight,
        gutter: GUTTER,
        header: headerWidth,
        division: doc.division,
      }),
    [doc, column, rowHeight, headerWidth],
  )

  /* --------------------------------------------------------------- layout */

  /*
   * Every position, resolved here — **above the handlers that need it.**
   *
   * The deck's offset is derived once and used by both the drawing and the drag.
   * An earlier version recomputed the centre inside `onSpinStart` and left out the
   * box's own origin, so the gesture measured its angles about a point ninety
   * pixels off the disc and a turn produced almost no rotation. The drawing was
   * right, which is what made it hard to see: the wheel simply did not respond.
   */

  /*
   * Two panels, one height, top aligned.
   *
   * The bar's panel is sized for **eight lanes** — the most it can hold — rather
   * than for the lanes that happen to be in it. So the surface does not jump as
   * sounds are added, and the room under the last lane is not dead space: it is
   * exactly the room there is left. Which also brings the two panels to nearly the
   * same height on their own, and the taller one settles it.
   */
  /*
   * The bar's head is now only the clock.
   *
   * The big read-out is gone: the deck spells the syllable in your hand down its own
   * middle, so a second copy of it beside the bar was saying the same thing twice —
   * and the deck says it in the place where you are already looking.
   */
  const META = 26
  const readoutH = META
  const deckBody = deck ? deck.box.height : 0
  const laneBody = MAX_LANES * (rowHeight + GUTTER) - GUTTER
  const panelHeight = Math.max(deckBody, readoutH + laneBody) + PAD * 2
  const free = Math.max(0, doc.height - TRANSPORT - MARGIN)
  const panelTop = Math.round(MARGIN + Math.max(0, (free - MARGIN - panelHeight) / 2))

  // The discs sit in the middle of their own panel; the bar starts at the top of
  // its own, because a grid grows downward and a column of wheels does not.
  const deckTop = Math.round(panelTop + (panelHeight - deckBody) / 2)
  const barTop = panelTop
  /** Where the deck group is placed. The one source for drawing and for dragging. */
  const deckDX = deckLeft + PAD - (deck?.box.x ?? 0)
  const deckDY = deckTop - (deck?.box.y ?? 0)


  /* ------------------------------------------------------------ the playhead */

  /*
   * Driven straight at the node, off the audio clock.
   *
   * Not React state: this runs sixty times a second, and re-rendering a grid of
   * outlines to move one line is the mistake tool 04 wrote down — per frame,
   * nothing changes but a transform.
   */
  const headRef = useRef<SVGGElement>(null)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const draw = () => {
      const head = headRef.current
      const t = transportRef.current
      if (head && t) head.setAttribute('transform', `translate(${xAt(grid, t.position())} 0)`)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [playing, grid])

  /* --------------------------------------------------------------- the spin */

  /**
   * The live rotation of whichever disc is under the hand.
   *
   * Two copies of one number, on purpose. The state is what draws; **the ref is
   * what the gesture reads.** An earlier version had `onSpinEnd` read the state,
   * which works under a real hand only because React happens to re-render between
   * pointer moves — fire the whole gesture inside one task, as a test does, and the
   * closure still holds the `null` it was created with and the spin lands nowhere.
   */
  const [spin, setSpin] = useState<{ role: 'cho' | 'jong'; value: number } | null>(null)
  const dragRef = useRef<{
    role: 'cho' | 'jong'
    angle0: number
    spin0: number
    /** Where the disc has actually been turned to, updated per move. */
    spin: number
    cx: number
    cy: number
    moved: boolean
  } | null>(null)

  /** Pointer position in the artwork's own coordinates. */
  function local(e: React.PointerEvent): { x: number; y: number } {
    const svg = artRef.current
    if (!svg) return { x: 0, y: 0 }
    const box = svg.getBoundingClientRect()
    return {
      x: ((e.clientX - box.left) / box.width) * doc.width,
      y: ((e.clientY - box.top) / box.height) * doc.height,
    }
  }

  /**
   * Dial one wheel to a jamo. **This changes the instrument, not the bar.**
   *
   * The sound is auditioned as it lands, the way a platter does under a hand — you
   * hear what you are dialling before you commit it to a step.
   */
  function dial(role: Role, jamo: string) {
    // From the store, not from this render's `doc`: a gesture must not be resolved
    // against a snapshot that may be a render behind it. Bug type 1's rule applied
    // to a value rather than to a closure.
    const jamoOf = decompose(useStore.getState().doc.dialed)
    if (!jamoOf) return
    const next = compose({ ...jamoOf, [role]: jamo })
    if (!next) return
    transport().audition(next)
    setDoc({ dialed: next })
  }

  function onSpinStart(role: 'cho' | 'jong') {
    return (e: React.PointerEvent<SVGElement>) => {
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* an enhancement; a refusal must not swallow the gesture */
      }
      const disc = role === 'cho' ? deck?.cho : role === 'jong' ? deck?.jong : null
      if (!disc) return
      const p = local(e)
      const cx = disc.cx + deckDX
      const cy = disc.cy + deckDY
      dragRef.current = {
        role,
        angle0: Math.atan2(p.x - cx, -(p.y - cy)),
        spin0: disc.spin,
        spin: disc.spin,
        cx,
        cy,
        moved: false,
      }
      setSpin({ role, value: disc.spin })
    }
  }

  function onSpinMove(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    const p = local(e)
    const angle = Math.atan2(p.x - drag.cx, -(p.y - drag.cy))
    // Resolved against the angle at pointerdown, never the last rendered one.
    let delta = angle - drag.angle0
    // Shortest way round, so crossing twelve o'clock does not spin the disc back.
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    if (Math.abs(delta) > 0.02) drag.moved = true
    drag.spin = drag.spin0 + delta
    setSpin({ role: drag.role, value: drag.spin })
  }

  function onSpinEnd(e: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current
    dragRef.current = null
    setSpin(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    // Everything from the ref: `drag.spin` was written by the last move, not by a
    // render that may not have happened.
    if (!drag || !drag.moved || !deck) return
    const disc = drag.role === 'cho' ? deck.cho : deck.jong
    dial(drag.role, disc.rim[snapTo(disc.rim, drag.spin)])
  }

  /**
   * The vowel slider, dragged sideways.
   *
   * Same shape as the spin and for the same reason: the state draws, **the ref is
   * what the gesture reads.** One axis instead of an angle, and clamped rather than
   * wrapped — a list of five vowels that looped round would put ㅡ next to ㅗ with
   * nothing to say it had.
   */
  const [slide, setSlide] = useState<number | null>(null)
  const slideRef = useRef<{ x0: number; offset: number; moved: boolean } | null>(null)

  function onSlideStart(e: React.PointerEvent<SVGElement>) {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* an enhancement; a refusal must not swallow the gesture */
    }
    slideRef.current = { x0: local(e).x, offset: 0, moved: false }
    setSlide(0)
  }

  function onSlideMove(e: React.PointerEvent<SVGElement>) {
    const drag = slideRef.current
    if (!drag) return
    const offset = local(e).x - drag.x0
    if (Math.abs(offset) > 2) drag.moved = true
    drag.offset = offset
    setSlide(offset)
  }

  function onSlideEnd(e: React.PointerEvent<SVGElement>) {
    const drag = slideRef.current
    slideRef.current = null
    setSlide(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!drag || !drag.moved || !deck) return
    dial('jung', deck.jung.items[snapAlong(deck.jung, drag.offset)])
  }

  /* ------------------------------------------------------------- the bar */

  function tap(row: number, step: number) {
    const syllable = grid.rows[row]?.syllable
    if (!syllable) return
    pushHistory()
    setDoc({ lanes: toggleStep(doc, syllable, step) })
  }

  function drop(syllable: string) {
    pushHistory()
    setDoc({ lanes: removeLane(doc.lanes, syllable) })
  }

  /*
   * A lane's level.
   *
   * History is pushed once at the start of the gesture rather than on every move,
   * the way the wheels do it — otherwise one drag of a fader leaves fifty entries
   * behind it and undo stops being able to undo anything.
   */
  function levelBegin() {
    pushHistory()
    setInteracting(true)
  }

  function level(syllable: string, value: number) {
    setDoc({ lanes: setLevel(useStore.getState().doc.lanes, syllable, value) })
  }

  function levelEnd() {
    setInteracting(false)
  }

  /* ------------------------------------------------------------- transport */

  async function play() {
    setPlaying(true)
    await transport().start()
  }

  function stop() {
    transportRef.current?.stop()
    setPlaying(false)
  }

  // The space bar, because that is where a transport is. Through a ref, so the
  // listener is not rebound as the document changes under it.
  const toggleRef = useRef<() => void>(() => {})
  toggleRef.current = () => (playing ? stop() : void play())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || isTyping(e.target)) return
      e.preventDefault()
      toggleRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const missing = face ? missingFrom(face, doc.lanes.map((l) => l.syllable).join('') + doc.dialed) : []
  const status =
    faceError ??
    (loading
      ? c.loading
      : missing.length > 0
        ? c.missing(missing.join(' '))
        : !deck
          ? c.stacksOnly
          : isEmpty(doc)
            ? c.empty
            : null)

  return (
    <div ref={stageRef} className="stage beat-stage" style={{ background: doc.background }}>
      <svg
        id="artwork"
        ref={artRef}
        className="artwork"
        xmlns="http://www.w3.org/2000/svg"
        width={doc.width}
        height={doc.height}
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Every gradient the machine is shaded with, declared once. */}
        <Surfaces doc={doc} />

        <rect x={0} y={0} width={doc.width} height={doc.height} fill={doc.background} />

        {face && deck && (
          <>
            {/* The deck, set into the ground. */}
            <rect
              x={deckLeft}
              y={panelTop}
              width={deckWidth}
              height={panelHeight}
              rx={RADIUS}
              fill={doc.panel}
            />
            {/* A lip along the top of each panel: the one line that says the
                surface is sunk into the ground rather than laid on it. */}
            <path
              d={`M${deckLeft + RADIUS} ${panelTop + 0.5}h${deckWidth - RADIUS * 2}`}
              stroke={doc.ink}
              strokeWidth={1}
              opacity={0.08}
              fill="none"
            />
            <g transform={`translate(${deckDX} ${deckDY})`}>
              {([deck.cho, deck.jong] as const).map((disc) => (
                <Platter
                  key={disc.role}
                  disc={disc}
                  doc={doc}
                  spin={spin?.role === disc.role ? spin.value : null}
                  onSpinStart={onSpinStart(disc.role)}
                  onSpinMove={onSpinMove}
                  onSpinEnd={onSpinEnd}
                  onPick={(index) => dial(disc.role, disc.rim[index])}
                />
              ))}

              <Ruler
                strip={deck.jung}
                doc={doc}
                offset={slide}
                onSlideStart={onSlideStart}
                onSlideMove={onSlideMove}
                onSlideEnd={onSlideEnd}
                onPick={(index) => dial('jung', deck.jung.items[index])}
              />

              {/* The audition pad: hear what is in your hand without committing it
                  to a step. The one filled accent shape on the machine, because it
                  is the one thing on it that makes a sound by itself. */}
              <circle
                data-ui
                cx={deck.pad.cx}
                cy={deck.pad.cy}
                r={deck.pad.r}
                fill={doc.playhead}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  transport().audition(useStore.getState().doc.dialed)
                }}
              />

            </g>

            {/* The bar. */}
            <rect
              x={barLeft}
              y={barTop}
              width={barWidth}
              height={panelHeight}
              rx={RADIUS}
              fill={doc.panel}
            />
            <path
              d={`M${barLeft + RADIUS} ${barTop + 0.5}h${barWidth - RADIUS * 2}`}
              stroke={doc.ink}
              strokeWidth={1}
              opacity={0.08}
              fill="none"
            />

            <text
              className="beat-meta"
              x={barLeft + barWidth - PAD}
              y={barTop + PAD + 10}
              textAnchor="end"
              fill={doc.ink}
            >
              {doc.bpm} BPM · 1/{doc.division} · {doc.steps} STEPS
              {doc.swing > 0 ? ` · SWING ${Math.round(doc.swing * 100)}` : ''}
            </text>
            <g transform={`translate(${barLeft + PAD} ${barTop + PAD + readoutH})`}>
              <Sequencer
                grid={grid}
                doc={doc}
                face={face}
                onTap={tap}
                onRemove={drop}
                onLevel={level}
                onLevelBegin={levelBegin}
                onLevelEnd={levelEnd}
              />

              {/* The one thing that moves. Its transform is set by the frame loop,
                  so nothing above it re-renders while the loop goes round. */}
              <g ref={headRef} data-ui opacity={playing ? 1 : 0}>
                <path
                  d={`M0 ${-10}V${grid.height + 10}`}
                  stroke={doc.playhead}
                  strokeWidth={1.6}
                />
                <circle cx={0} cy={-10} r={3} fill={doc.playhead} />
              </g>
            </g>

          </>
        )}
      </svg>

      <div className="stage-deck" data-ui>
        <button
          type="button"
          className={`stage-chip${playing ? '' : ' is-primary'}`}
          onClick={() => (playing ? stop() : void play())}
        >
          {playing ? <StopIcon /> : <PlayIcon />}
          <span>{playing ? c.stop : c.play}</span>
          <em>SPACE</em>
        </button>
        <span className="beat-lanes">{c.lanes(doc.lanes.length, MAX_LANES)}</span>
      </div>

      {status && <p className="stage-status">{status}</p>}
    </div>
  )
}
