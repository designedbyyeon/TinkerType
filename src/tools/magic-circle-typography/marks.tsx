import type { ReactNode } from 'react'
import { starCycles, clampSkip } from './geometry/sigil'

/**
 * Miniatures for the rows whose name and number do not, between them, say what
 * will happen.
 *
 * **Ten of them, out of twenty-odd rows.** A mark on every row is decoration,
 * and then none of them carries weight. Left deliberately bare:
 *
 * - `Ground`, `Ink`, `Plate` — a swatch already shows its own answer.
 * - `Size`, `Tracking`, `Radius`, `Spin` — the name and the number are the
 *   picture, and the plate is on screen at full size while you drag them. A
 *   26×14 thumbnail of "bigger" is a worse version of what is already there.
 * - `Reach` — same, and it is a multiplier of a thing the stage draws a dashed
 *   circle around while the camera runs. The stage is the mark.
 * - `Plate opacity`, `Photo dim` — one number, one wash, visible instantly.
 * - `Mirror`, `Follow hand`, `Follow spin` — these are about your hand, not about
 *   the drawing, and there is nothing to draw for "the plate goes where you go".
 *
 * The ones that are here are all cases where the value changes the *kind* of
 * figure rather than its amount: how many points a star has, whether it is a
 * star at all, how many courses the plate carries, whether a line is drawn.
 *
 * The two switches in Sigil earn theirs on a different ground. `Rim` and
 * `Band rules` are the names of things a designer has never met, and the answer
 * to both is one hairline appearing somewhere specific. A word cannot say *where*;
 * a 26×14 drawing can.
 */

const Box = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 26 14" width={26} height={14} fill="none" stroke="currentColor">
    {children}
  </svg>
)

/** The plate at this much bloom: the rim drawn on, the words half written. */
export function BloomMark({ value }: { value: number }) {
  const t = Math.max(0, Math.min(1, value))
  const r = 5.6
  const c = 2 * Math.PI * r
  return (
    <Box>
      <circle
        cx={13}
        cy={7}
        r={r}
        strokeWidth={1}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - t)}
        transform="rotate(-90 13 7)"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={13 + Math.sin(((i - 2.5) * 26 * Math.PI) / 180) * 3.4 - 0.5}
          y={7 - Math.cos(((i - 2.5) * 26 * Math.PI) / 180) * 3.4 - 0.5}
          width={1}
          height={1}
          strokeWidth={0}
          fill="currentColor"
          opacity={t * 6 - i > 0 ? 1 : 0}
        />
      ))}
    </Box>
  )
}

/** The actual star this many points and this much skip would draw. */
export function StarMark({ points, skip }: { points: number; skip: number }) {
  const p = Math.round(points)
  if (p < 3) {
    return (
      <Box>
        {/* No star: the core is left empty, and the mark says so rather than
            drawing a triangle that is not there. */}
        <circle cx={13} cy={7} r={5.6} strokeWidth={0.8} opacity={0.35} />
        <path d="M9.6 3.6 16.4 10.4M16.4 3.6 9.6 10.4" strokeWidth={0.8} opacity={0.35} />
      </Box>
    )
  }
  const cycles = starCycles(p, clampSkip(p, skip), 5.8)
  return (
    <Box>
      {cycles.map((cycle, i) => (
        <path
          key={i}
          d={`${cycle.map((v, j) => `${j === 0 ? 'M' : 'L'}${(13 + v.x).toFixed(2)} ${(7 + v.y).toFixed(2)}`).join('')}Z`}
          strokeWidth={0.9}
        />
      ))}
    </Box>
  )
}

/** Ticks hanging inward off the rim, at this count. */
export function TicksMark({ value, max }: { value: number; max: number }) {
  const count = Math.max(0, Math.min(48, Math.round((value / max) * 40)))
  return (
    <Box>
      <circle cx={13} cy={7} r={5.8} strokeWidth={0.7} opacity={0.4} />
      {Array.from({ length: count }, (_, i) => {
        const a = (2 * Math.PI * i) / count
        const long = count % 5 === 0 && i % 5 === 0
        const inner = 5.8 - (long ? 2.2 : 1.2)
        return (
          <path
            key={i}
            d={`M${(13 + Math.sin(a) * 5.8).toFixed(2)} ${(7 - Math.cos(a) * 5.8).toFixed(2)}L${(13 + Math.sin(a) * inner).toFixed(2)} ${(7 - Math.cos(a) * inner).toFixed(2)}`}
            strokeWidth={0.7}
          />
        )
      })}
    </Box>
  )
}

/** Extra hairlines inside the innermost band. */
export function RingsMark({ value }: { value: number }) {
  const count = Math.max(0, Math.min(6, Math.round(value)))
  return (
    <Box>
      <circle cx={13} cy={7} r={5.8} strokeWidth={0.7} opacity={0.4} />
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={13} cy={7} r={4.6 - (i * 3.4) / Math.max(1, count)} strokeWidth={0.8} />
      ))}
    </Box>
  )
}

/** Radial lines crossing the core. */
export function SpokesMark({ value }: { value: number }) {
  const count = Math.max(0, Math.min(16, Math.round(value)))
  return (
    <Box>
      <circle cx={13} cy={7} r={5.8} strokeWidth={0.7} opacity={0.4} />
      {Array.from({ length: count }, (_, i) => {
        const a = (2 * Math.PI * i) / count
        return (
          <path
            key={i}
            d={`M${(13 + Math.sin(a) * 1).toFixed(2)} ${(7 - Math.cos(a) * 1).toFixed(2)}L${(13 + Math.sin(a) * 5.6).toFixed(2)} ${(7 - Math.cos(a) * 5.6).toFixed(2)}`}
            strokeWidth={0.7}
          />
        )
      })}
    </Box>
  )
}

/** The gutter: air between a rule and the letters that sit against it. */
export function GapMark({ value, max }: { value: number; max: number }) {
  const air = 0.6 + Math.max(0, Math.min(1, value / max)) * 3.4
  return (
    <Box>
      <path d="M2 2.5h22M2 11.5h22" strokeWidth={0.8} opacity={0.45} />
      <rect
        x={4}
        y={2.5 + air}
        width={18}
        height={Math.max(0.6, 9 - air * 2)}
        strokeWidth={0}
        fill="currentColor"
      />
    </Box>
  )
}

/**
 * The size step from one line to the next: three runs of type, each shorter than
 * the one outside it. Drawn as bars rather than arcs because what is being asked
 * about is the *sizes*, and three arcs at three radii read as a plate.
 */
export function TaperMark({ value }: { value: number }) {
  const t = Math.max(0.2, Math.min(1, value))
  return (
    <Box>
      {[0, 1, 2].map((i) => {
        const h = 4.6 * t ** i
        return (
          <rect
            key={i}
            x={2 + i * 8.4}
            y={7 - h / 2}
            width={6.6}
            height={h}
            strokeWidth={0}
            fill="currentColor"
          />
        )
      })}
    </Box>
  )
}

/**
 * The whole composition as a diagram: one arc per line, each at its own angle,
 * with the line being dragged in full ink and the rest muted.
 *
 * The same drawing appears on every angle row, which would be decoration if the
 * rows were about different things — they are about the same thing, and this is
 * the one question a number in degrees cannot answer: *where does that leave the
 * others?* Composing a ring is deciding which arc covers the gap the one above it
 * left, and the number alone never says.
 */
export function ArcMark({
  index,
  count,
  angles,
  sweeps,
}: {
  index: number
  count: number
  angles: number[]
  /** Rough arc width per line, degrees, so the gaps land where they really do. */
  sweeps: number[]
}) {
  const rings = Math.min(5, Math.max(1, count))
  return (
    <Box>
      {Array.from({ length: rings }, (_, i) => {
        const r = 6.2 - i * (4.6 / Math.max(1, rings))
        const c = 2 * Math.PI * r
        const on = Math.max(0.12, Math.min(0.97, (sweeps[i] ?? 200) / 360))
        return (
          <circle
            key={i}
            cx={13}
            cy={7}
            r={r}
            strokeWidth={i === index ? 1.4 : 0.8}
            opacity={i === index ? 1 : 0.32}
            strokeDasharray={`${c * on} ${c}`}
            // A circle's path starts at three o'clock and the angles are read
            // from twelve, and the run is centred on its angle rather than
            // starting there — hence the quarter turn and the half sweep.
            transform={`rotate(${-90 + (angles[i] ?? 0) - on * 180} 13 7)`}
          />
        )
      })}
    </Box>
  )
}

/** The double rule around the outside, against the type it holds off. */
export function RimMark({ on }: { on: boolean }) {
  return (
    <Box>
      <rect x={6} y={5.6} width={14} height={2.8} strokeWidth={0} fill="currentColor" opacity={0.45} />
      <circle cx={13} cy={7} r={6.4} strokeWidth={on ? 0.9 : 0} opacity={on ? 1 : 0} />
      <circle cx={13} cy={7} r={5.4} strokeWidth={on ? 0.7 : 0} opacity={on ? 1 : 0} />
    </Box>
  )
}

/** A hairline closing each band: two runs of type with, or without, a rule between. */
export function BandRuleMark({ on }: { on: boolean }) {
  return (
    <Box>
      <rect x={4} y={1.6} width={18} height={2.6} strokeWidth={0} fill="currentColor" opacity={0.45} />
      <rect x={4} y={9.8} width={18} height={2.6} strokeWidth={0} fill="currentColor" opacity={0.45} />
      {on && <path d="M1.5 7h23" strokeWidth={0.9} />}
    </Box>
  )
}

/** Line weight, against a letter's stem for scale. */
export function RuleMark({ value, max }: { value: number; max: number }) {
  const weight = 0.4 + Math.max(0, Math.min(1, value / max)) * 3.6
  return (
    <Box>
      <rect x={4} y={2} width={3.4} height={10} strokeWidth={0} fill="currentColor" opacity={0.3} />
      <path d={`M11 12.4 11 1.6`} strokeWidth={weight} />
      <path d={`M17 12.4 17 1.6`} strokeWidth={weight} />
    </Box>
  )
}
