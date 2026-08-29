import { useSignFace } from '../../shared/media/type/hangul/face'
import { deckOf, type DeckSpec } from './geometry/deck'
import { gridOf } from './geometry/grid'
import { DEFAULT_DOC } from './store'
import { Platter } from './render/Platter'
import { Ruler } from './render/Ruler'
import { Sequencer } from './render/Sequencer'
import { Surfaces } from './render/Surfaces'
import type { BeatDoc } from './types'

/**
 * The index still, drawn by the real components rather than by a stored picture.
 *
 * Same wheels, same slider, same grid, same outlines — so the card cannot drift from
 * what the tool shows. Nothing moves and nothing sounds, which is the honest state
 * for a card: the machine at rest with a bar already in it.
 *
 * A **square** frame, which the tool's own stage never is. The machine is a column
 * and the bar is a strip; side by side in a landscape card they arrive as two
 * stripes of specks, so the card stacks them instead — the one place its layout
 * departs from the tool's, and it departs to show the same two objects.
 *
 * What the card has to get across is the one thing that took two passes to find:
 * **ㅂ · ㅜ · ㅁ read down the middle of the machine as 붐.** That is why the wheels
 * face each other, and it is the whole idea in one still.
 */
const DOC: BeatDoc = {
  ...DEFAULT_DOC,
  width: 520,
  height: 520,
  // The card's own ground, so all five index stills sit on one surface. A CSS
  // variable in a document field, which the artwork palette forbids — allowed only
  // because this document is never exported. Tools 03 and 04 do the same.
  background: 'var(--paper-sunk)',
  panel: 'var(--paper)',
  /*
   * Eight steps, not sixteen. At card scale a sixteenth is three pixels wide and
   * the bar reads as a hairline smear; eight of them still says "a syllable is a
   * row and a row is a rhythm", which is the card's whole job.
   */
  steps: 8,
  division: 8,
  lanes: [
    { syllable: '붐', steps: [true, false, false, false, true, false, false, false], level: 1 },
    { syllable: '둥', steps: [false, false, true, false, false, false, true, false], level: 1 },
  ],
  dialed: '붐',
  letter: 30,
  lane: 22,
  radius: 54,
  spacing: 0.95,
}

const SPEC: DeckSpec = {
  radius: DOC.radius,
  letter: DOC.letter,
  spacing: DOC.spacing,
}
/** Nothing about the card moves, so its machine and its bar are laid out once. */
const DECK = deckOf(DOC.dialed, SPEC)
const GUTTER = 7
const GRID = gridOf(DOC, DOC.dialed, {
  column: 34,
  rowHeight: 32,
  gutter: GUTTER,
  header: 38,
  division: DOC.division,
})

/*
 * Both derived from the machine's own box, not typed in.
 *
 * An earlier version hardcoded them and the audition pad — which hangs below the
 * lower disc — drew straight through the bar's first lane. Two numbers that have to
 * agree with a geometry module are two numbers that will stop agreeing with it.
 */
const DECK_TOP = 30
const BAR_TOP = DECK_TOP + (DECK?.box.height ?? 0) + 26

export function Preview() {
  const { face } = useSignFace()

  // Until the outlines arrive the card shows its own ground, which reads as still
  // loading rather than as broken.
  return (
    <svg
      className="beat-preview"
      viewBox={`0 0 ${DOC.width} ${DOC.height}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* The same gradients the tool shades with — the card draws the real parts,
          so it needs the real surfaces or they come out flat. */}
      <Surfaces doc={DOC} />
      <rect x={0} y={0} width={DOC.width} height={DOC.height} fill={DOC.background} />
      {face && DECK && (
        <>
          <g transform={`translate(${DOC.width / 2} ${DECK_TOP - DECK.box.y})`}>
            {[DECK.cho, DECK.jong].map((disc) => (
              <Platter
                key={disc.role}
                disc={disc}
                doc={DOC}
                spin={null}
                onSpinStart={() => {}}
                onSpinMove={() => {}}
                onSpinEnd={() => {}}
                onPick={() => {}}
              />
            ))}
            <Ruler
              strip={DECK.jung}
              doc={DOC}
              offset={null}
              onSlideStart={() => {}}
              onSlideMove={() => {}}
              onSlideEnd={() => {}}
              onPick={() => {}}
            />
            <circle cx={DECK.pad.cx} cy={DECK.pad.cy} r={DECK.pad.r} fill={DOC.playhead} />
          </g>
          {/* Centred on the **steps**, not on the whole grid: the lane headers hang
              off the left, so centring the grid puts the bar visibly off-axis from
              the column of wheels above it. */}
          <g
            transform={`translate(${
              (DOC.width - (GRID.width - GRID.left)) / 2 - GRID.left
            } ${BAR_TOP})`}
          >
            {/* Nothing on a card is touchable — it is a picture of the tool. */}
            <Sequencer
              grid={GRID}
              doc={DOC}
              face={face}
              onTap={() => {}}
              onRemove={() => {}}
              onLevel={() => {}}
              onLevelBegin={() => {}}
              onLevelEnd={() => {}}
            />
          </g>
        </>
      )}
    </svg>
  )
}
