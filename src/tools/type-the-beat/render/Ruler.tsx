import { itemAt, type Ruler as Strip } from '../geometry/deck'
import type { BeatDoc } from '../types'
import { jamoParts, placedJamo } from './jamo'
import { IDS } from './surfaceIds'

/**
 * The vowel, as a graduated slide.
 *
 * **Not a third wheel.** Five vowels want a list rather than a ring, and the gap
 * between the two discs is where 세로모임꼴 puts the vowel anyway.
 *
 * The reference is a rule, not a barrel: a pale strip with fine graduations hanging
 * from its top edge, the current value square in the middle, the neighbours grey
 * and the ends fading out. A pass that drew it as a fully knurled cylinder with a
 * specular band had the right idea and far too much of it — the machine went from
 * flat to rendered, and the letters lost.
 *
 * What is left of the cylinder is the one thing that earns its place: **the ends
 * darken**, so the list reads as running off round something rather than as
 * stopping at a border.
 */

/** Graduations along the top edge. Every fifth one longer, as on a rule. */
const MARKS = 40

export function Ruler({
  strip,
  doc,
  offset,
  onSlideStart,
  onSlideMove,
  onSlideEnd,
  onPick,
}: {
  strip: Strip
  doc: BeatDoc
  /** The live displacement while dragging, or null at rest. */
  offset: number | null
  onSlideStart: (e: React.PointerEvent<SVGElement>) => void
  onSlideMove: (e: React.PointerEvent<SVGElement>) => void
  onSlideEnd: (e: React.PointerEvent<SVGElement>) => void
  onPick: (index: number) => void
}) {
  const slid: Strip = offset === null ? strip : { ...strip, offset }
  const mid = strip.y + strip.height / 2
  const centre = strip.x + strip.width / 2
  const radius = Math.min(5, strip.height * 0.08)
  const clip = `ttb-rule-clip-${Math.round(strip.y)}`

  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={strip.x} y={strip.y} width={strip.width} height={strip.height} rx={radius} />
        </clipPath>
      </defs>

      <rect
        x={strip.x}
        y={strip.y}
        width={strip.width}
        height={strip.height}
        rx={radius}
        fill={doc.disc}
        pointerEvents="none"
      />

      {/* The drag surface: **under everything that draws, above the ground.**
          Painted last it wins every hit test and the letters can never be tapped —
          `stopPropagation` cannot save an event that was never delivered. The
          decoration above it is deaf, so a hand on the bare rule falls through to
          here and a hand on a letter lands on the letter. */}
      <rect
        data-ui
        x={strip.x}
        y={strip.y}
        width={strip.width}
        height={strip.height}
        rx={radius}
        fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={onSlideStart}
        onPointerMove={onSlideMove}
        onPointerUp={onSlideEnd}
        onPointerCancel={onSlideEnd}
      />

      <g clipPath={`url(#${clip})`} pointerEvents="none">
        {doc.ticks && (
          <g stroke={doc.ink} strokeWidth={1} opacity={0.4} fill="none">
            {Array.from({ length: MARKS + 1 }, (_, i) => {
              const x = strip.x + (i / MARKS) * strip.width
              const len = i % 5 === 0 ? strip.height * 0.26 : strip.height * 0.15
              return <path key={i} d={`M${x} ${strip.y}v${len}`} />
            })}
          </g>
        )}

        {slid.items.map((jamo, index) => {
          const x = itemAt(slid, index)
          const away = Math.abs(x - centre) / strip.pitch
          const lit = away < 0.5
          return (
            <g
              key={jamo}
              transform={placedJamo(x, mid + strip.height * 0.08, strip.size)}
              fill={doc.ink}
              opacity={lit ? 1 : Math.max(0.16, 0.4 - (away - 1) * 0.12)}
              pointerEvents="auto"
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onPick(index)
              }}
            >
              {jamoParts(jamo).map((part, i) => (
                <path key={i} d={part.d} transform={part.t} />
              ))}
            </g>
          )
        })}

        {/* The ends running off. The one thing kept from the barrel. */}
        <rect
          x={strip.x}
          y={strip.y}
          width={strip.width}
          height={strip.height}
          fill={`url(#${IDS.barrelEnds})`}
        />
      </g>
    </g>
  )
}
