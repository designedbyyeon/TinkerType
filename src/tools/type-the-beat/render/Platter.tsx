import { dividersOf, rimAt, type Platter as Disc } from '../geometry/deck'
import type { BeatDoc } from '../types'
import { jamoParts, placedJamo } from './jamo'

/**
 * One wheel — a record on a deck.
 *
 * **Flat, with one hairline.** A pale face on a darker panel, a drawn edge, and
 * nothing else: no drop shadow, no radial lighting, no rolled rim. A pass that had
 * all three read as a rendered button rather than as a printed instrument, and the
 * reference has none of it. The only depth on the whole wheel is the spindle, which
 * is a hole.
 *
 * **The letters turn with the disc.** They are printed on it, so the one at the
 * reading mark stands square and the rest lean by how far round they are. Drawing
 * them all upright made the wheel stop reading as a wheel: nothing on it appeared
 * to rotate, three letters just hopped between positions.
 *
 * **The divisions follow the kit.** One sector per item, each spoke bisecting the
 * gap between two letters — so three jamo give three sectors and nineteen give
 * nineteen. A fixed four was the drawing disagreeing with the thing it was drawing.
 *
 * And the graduated ring outside does **not** turn. Turning face, fixed scale: that
 * contrast is the whole reading of the instrument.
 */

/** Fine graduations round the fixed ring. Sixty, as on a dial. */
const FINE = 60

export function Platter({
  disc,
  doc,
  spin,
  onSpinStart,
  onSpinMove,
  onSpinEnd,
  onPick,
}: {
  disc: Disc
  doc: BeatDoc
  /** The live rotation while dragging, or null at rest. */
  spin: number | null
  onSpinStart: (e: React.PointerEvent<SVGElement>) => void
  onSpinMove: (e: React.PointerEvent<SVGElement>) => void
  onSpinEnd: (e: React.PointerEvent<SVGElement>) => void
  onPick: (index: number) => void
}) {
  const turned: Disc = spin === null ? disc : { ...disc, spin }

  const tickIn = disc.r * 1.05
  const tickOut = disc.r * 1.18
  const cardinalIn = disc.r * 1.02
  const mark = {
    x: disc.cx + disc.r * 1.3 * Math.sin(disc.read),
    y: disc.cy - disc.r * 1.3 * Math.cos(disc.read),
  }
  const ray = (a: number, from: number, to: number) =>
    `M${disc.cx + from * Math.sin(a)} ${disc.cy - from * Math.cos(a)}L${
      disc.cx + to * Math.sin(a)
    } ${disc.cy - to * Math.cos(a)}`


  return (
    <g>
      {/* The fixed scale. Sixty fine marks, and four long ones at the quarters so
          the eye has something to measure the turn against. */}
      {doc.ticks && (
        <g stroke={doc.ink} fill="none">
          <g opacity={0.34} strokeWidth={1}>
            {Array.from({ length: FINE }, (_, i) => (
              <path key={i} d={ray((i / FINE) * Math.PI * 2, tickIn, tickOut)} />
            ))}
          </g>
          <g opacity={0.7} strokeWidth={1.4}>
            {[0, 1, 2, 3].map((q) => (
              <path key={q} d={ray((q / 4) * Math.PI * 2, cardinalIn, tickOut)} />
            ))}
          </g>
        </g>
      )}

      {/* The face, and its edge. */}
      <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill={doc.disc} />
      <circle
        cx={disc.cx}
        cy={disc.cy}
        r={disc.r - 0.5}
        fill="none"
        stroke={doc.ink}
        strokeWidth={1}
        opacity={0.13}
        pointerEvents="none"
      />

      {/* The drag surface: **above the face and below the letters.** Painted last
          it would win every hit test and the letters could never be tapped at all —
          `stopPropagation` cannot save an event that was never delivered. */}
      <circle
        data-ui
        cx={disc.cx}
        cy={disc.cy}
        r={disc.r}
        fill="transparent"
        style={{ cursor: 'grab' }}
        onPointerDown={onSpinStart}
        onPointerMove={onSpinMove}
        onPointerUp={onSpinEnd}
        onPointerCancel={onSpinEnd}
      />

      {/* The divisions, turning with the face — one per item on the rim, each
          bisecting the gap between two letters. These are what actually sell the
          rotation: a rim tick moving a few degrees is invisible, a line sweeping
          across the whole face is not.

          **Their angles come from the geometry, not from a rotation applied here.**
          A group rotated by the disc's own spin disagreed with the letters by
          exactly the reading angle, which on a three-item wheel drew every division
          straight through a letter. */}
      <g stroke={doc.ink} strokeWidth={1} opacity={0.14} fill="none" pointerEvents="none">
        {dividersOf(turned).map((a, i) => (
          <path key={i} d={ray(a, disc.hub * 1.35, disc.r * 0.9)} />
        ))}
      </g>

      {/* The spindle. The one recess on the wheel. */}
      <circle cx={disc.cx} cy={disc.cy} r={disc.hub} fill={doc.panel} pointerEvents="none" />

      {/* The kit, drawn rather than set, printed on the disc and turning with it. */}
      {turned.rim.map((jamo, index) => {
        const at = rimAt(turned, index)
        const lit = index === turned.selected
        if (jamo === '') {
          // The empty final has no letter to draw, so it gets a mark that means
          // "nothing" — a wheel with a blank gap on it looks broken.
          return (
            <circle
              key="none"
              cx={at.x}
              cy={at.y}
              r={disc.rimSize * 0.26}
              fill="none"
              stroke={doc.ink}
              strokeWidth={1.5}
              strokeDasharray="2.5 3"
              opacity={lit ? 1 : 0.3}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onPick(index)
              }}
            />
          )
        }
        return (
          <g
            key={jamo + index}
            transform={placedJamo(at.x, at.y, disc.rimSize, at.angle)}
            fill={doc.ink}
            // Everything but the one at the reading mark steps back, so the wheel
            // reads as pointing at something rather than as a ring of equals.
            opacity={lit ? 1 : 0.24}
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

      {/* Which side this wheel is read from. */}
      {doc.ticks && <circle cx={mark.x} cy={mark.y} r={disc.r * 0.038} fill={doc.playhead} />}
    </g>
  )
}
