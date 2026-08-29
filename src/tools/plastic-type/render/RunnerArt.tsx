import { piecePathData } from '../geometry/glyphs'
import { polygonPath, type Bar, type FramePlan, type RunnerPlan } from '../geometry/runner'
import { runnerLetter, type PlasticDoc } from '../types'

/** Plaque text uses a stack that resolves anywhere, not a CSS variable. */
const PLAQUE_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace'

function bars(list: Bar[], fill: string, key: string) {
  return list.map((bar, i) => <path key={`${key}-${i}`} d={polygonPath(bar.polygon)} fill={fill} />)
}

/**
 * The plaque: runner letter and part count, on the bottom wall.
 *
 * The Bandai sprue and the spare-parts frame both carry one. It is the piece of a
 * real frame that tells
 * you which sprue you are holding, and at a glance it is what makes the drawing
 * read as a parts frame rather than as lettering in a box.
 */
function Plaque({ frame, index, fill, doc }: {
  frame: FramePlan
  index: number
  fill: string
  doc: PlasticDoc
}) {
  // Enough for a letter, a space and two digits, and no more. Half the wall
  // width made it a luggage tag hanging off the frame.
  const height = doc.wall * 1.35
  const width = Math.min(frame.rect.width * 0.42, doc.wall * 4.6)
  const x = frame.rect.x + doc.corner + doc.wall
  const y = frame.rect.y + frame.rect.height - doc.wall
  const count = frame.parts.reduce((n, p) => n + p.pieces.length, 0)

  return (
    <>
      <path
        d={polygonPath([
          { x, y },
          { x: x + width, y },
          { x: x + width - height * 0.22, y: y + height },
          { x: x + height * 0.22, y: y + height },
        ])}
        fill={fill}
      />
      <text
        x={x + width / 2}
        y={y + height * 0.78}
        textAnchor="middle"
        fontFamily={PLAQUE_FONT}
        fontSize={height * 0.58}
        letterSpacing={height * 0.04}
        fill={doc.background}
      >
        {runnerLetter(index)} {String(count).padStart(2, '0')}
      </text>
    </>
  )
}

/**
 * One sheet of runners.
 *
 * Drawn bottom up: wall, then the bars inside it, then the gates, then the parts
 * on top. That order is not cosmetic — a gate is buried in the part it feeds, so
 * the part has to cover its own gate for the join to read as moulded rather than
 * as two shapes overlapping.
 *
 * In cycle mode a frame and everything it holds share one colour, because a
 * runner and its parts are a single shot of a single plastic. That is what
 * the syllable runners show, and colouring the parts against their own frame would be
 * the first thing to give the drawing away.
 */
export function RunnerArt({ plan, doc }: { plan: RunnerPlan; doc: PlasticDoc }) {
  const cycling = doc.colourMode === 'cycle'
  const frameColour = (index: number) =>
    cycling ? doc.palette[index % doc.palette.length] : doc.runnerColour
  const partColour = (index: number) => (cycling ? frameColour(index) : doc.partColour)

  return (
    <g>
      {/* Bridges belong to no single frame, so they take the first colour. */}
      {bars(plan.bridges, frameColour(0), 'bridge')}

      {plan.frames.map((frame, index) => {
        const runner = frameColour(index)
        const part = partColour(index)

        return (
          <g key={`${frame.row}-${frame.column}-${frame.label}`}>
            <path d={frame.wall} fill={runner} fillRule="nonzero" />
            {frame.tab && <path d={polygonPath(frame.tab)} fill={runner} />}
            {bars(frame.lattice, runner, `lattice-${index}`)}
            {bars(frame.spurs, runner, `spur-${index}`)}

            {frame.parts.flatMap((p) =>
              p.pieces.flatMap((piece, pi) =>
                piece.gates.map((gate, gi) => (
                  <path
                    key={`gate-${index}-${p.part.slot}-${pi}-${gi}`}
                    d={polygonPath(gate.polygon)}
                    fill={runner}
                  />
                )),
              ),
            )}

            {frame.parts.map((p) =>
              p.pieces.map((piece, pi) => (
                <path
                  key={`piece-${index}-${p.part.slot}-${pi}`}
                  d={piecePathData(piece.piece)}
                  fill={part}
                  fillRule="nonzero"
                />
              )),
            )}

            {doc.plates && <Plaque frame={frame} index={index} fill={runner} doc={doc} />}
          </g>
        )
      })}
    </g>
  )
}
