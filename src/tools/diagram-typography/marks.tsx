/**
 * Miniatures of what each parameter does, drawn from its live value.
 *
 * Same rules as the other tool's set, so a designer moving between them reads
 * one language: a 26×14 box so a row of them lines up, `currentColor` only so
 * each inherits its label's state and a renamed token can never blank one out,
 * and geometry driven by the value so the drawing moves under your hand.
 *
 * And no mark on a row that already explains itself. `Size`, `Gap`, `Radius`,
 * the letter size, the transform rows, the playhead — those are answered by the
 * canvas the instant you drag them, and a mark on all of them would make the
 * eight that mean something invisible. `Seed` has nothing to draw at all.
 */

const W = 26
const H = 14

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const at = (value: number, min: number, max: number) =>
  max === min ? 0 : clamp01((value - min) / (max - min))

function Box({ children }: { children: React.ReactNode }) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" stroke="none">
      {children}
    </svg>
  )
}

/**
 * The shape itself going from square to circle.
 *
 * The row sits directly under the shape chooser, whose third option is this
 * same square with its corners already off — so the mark is the chosen shape
 * continuing to move rather than a new drawing to learn.
 */
export function CornerMark({ value }: { value: number }) {
  const side = 11
  const r = clamp01(value) * (side / 2)
  return (
    <Box>
      <rect
        x={(W - side) / 2}
        y={(H - side) / 2}
        width={side}
        height={side}
        rx={r}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </Box>
  )
}

/**
 * Where along the line the lettering begins.
 *
 * A percentage of a path is the one number here with no visible units — 40%
 * of what, measured from where — so the mark supplies the line it is a
 * percentage of.
 */
export function StartMark({ value, min, max }: { value: number; min: number; max: number }) {
  const run = 11
  const x = 2 + at(value, min, max) * (W - 4 - run)
  return (
    <Box>
      <path d={`M2 ${H / 2}L${W - 2} ${H / 2}`} stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x + 1.8 + i * 3.7} cy={H / 2} r="1.8" fill="currentColor" />
      ))}
    </Box>
  )
}

/**
 * Four beads whose sizes pull apart.
 *
 * The variation chooser above already speaks in four dots, so the amount row
 * keeps the same four and only widens the spread between them. At zero they are
 * identical, which is the reading the word "none" has to earn.
 */
export function SpreadMark({ value, min, max }: { value: number; min: number; max: number }) {
  const t = at(value, min, max)
  const base = 2.2
  return (
    <Box>
      {[0, 1, 2, 3].map((i) => {
        const f = i / 3
        const r = base * (1 - t * 0.6 + t * 1.2 * f)
        return <circle key={i} cx={3.4 + i * 6.4} cy={H / 2} r={r} fill="currentColor" />
      })}
    </Box>
  )
}

/**
 * The wave the beads ride, gaining periods.
 *
 * Drawn proportionally rather than literally: twelve periods inside 26px is a
 * grey smear, so the count maps onto a readable range. The direction is what
 * the row needs to say.
 */
export function CyclesMark({ value, min, max }: { value: number; min: number; max: number }) {
  const cycles = 0.75 + at(value, min, max) * 3.5
  const steps = 34
  const d = Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps
    const x = 2 + u * (W - 4)
    const y = H / 2 - Math.sin(u * Math.PI * 2 * cycles) * 4.2
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join('')
  return (
    <Box>
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Box>
  )
}

/** How many dots are strung into one gap. Counted, since one to six fits. */
export function FillerCountMark({ value }: { value: number }) {
  const n = Math.max(1, Math.min(6, Math.round(value)))
  const left = 3.2
  const right = W - 3.2
  const span = right - left
  return (
    <Box>
      <circle cx={left} cy={H / 2} r="3.2" fill="currentColor" />
      <circle cx={right} cy={H / 2} r="3.2" fill="currentColor" />
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={left + (span * (i + 1)) / (n + 1)} cy={H / 2} r="1.1" fill="currentColor" />
      ))}
    </Box>
  )
}

/**
 * The dot's size against the shape it sits beside.
 *
 * On its own the number says nothing — 30px is a speck next to a 300px bead and
 * most of the gap next to a 40px one. The pair is the whole point.
 */
export function FillerSizeMark({ value, min, max }: { value: number; min: number; max: number }) {
  const r = 0.9 + at(value, min, max) * 4.4
  return (
    <Box>
      <circle cx="5.5" cy={H / 2} r="4.4" fill="currentColor" opacity="0.35" />
      <circle cx={W - 7} cy={H / 2} r={r} fill="currentColor" />
    </Box>
  )
}

/**
 * The drawn line losing its tremor.
 *
 * Smoothing is applied to the kept original trace every time, so this row can
 * be dragged long after the stroke was made — and this is the only place that
 * says so before you try it.
 */
export function SmoothMark({ value, min, max }: { value: number; min: number; max: number }) {
  const t = at(value, min, max)
  const jag = [-3, 2.9, -3.4, 3.2, -2.6, 3.4, -3]
  const d = jag
    .map((offset, i) => {
      const u = i / (jag.length - 1)
      const x = 2 + u * (W - 4)
      const calm = -2.2 * Math.sin(u * Math.PI)
      const y = H / 2 + offset * (1 - t) + calm * t
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join('')
  return (
    <Box>
      <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </Box>
  )
}

/** Letters standing upright, or turning with the curve they sit on. */
export function TangentMark({ on }: { on: boolean }) {
  const arc = `M2 ${H - 3}Q${W / 2} ${H - 13} ${W - 2} ${H - 3}`
  const stems = [0.18, 0.5, 0.82].map((u) => {
    // Point and slope of the quadratic, so the stems sit on the line they name.
    const p0 = { x: 2, y: H - 3 }
    const p1 = { x: W / 2, y: H - 13 }
    const p2 = { x: W - 2, y: H - 3 }
    const x = (1 - u) ** 2 * p0.x + 2 * (1 - u) * u * p1.x + u * u * p2.x
    const y = (1 - u) ** 2 * p0.y + 2 * (1 - u) * u * p1.y + u * u * p2.y
    const dx = 2 * (1 - u) * (p1.x - p0.x) + 2 * u * (p2.x - p1.x)
    const dy = 2 * (1 - u) * (p1.y - p0.y) + 2 * u * (p2.y - p1.y)
    const angle = on ? (Math.atan2(dy, dx) * 180) / Math.PI : 0
    return { x, y, angle }
  })
  return (
    <Box>
      <path d={arc} stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {stems.map((s, i) => (
        <rect
          key={i}
          x={s.x - 0.9}
          y={s.y - 5.6}
          width="1.8"
          height="5.2"
          fill="currentColor"
          transform={`rotate(${s.angle} ${s.x} ${s.y})`}
        />
      ))}
    </Box>
  )
}
