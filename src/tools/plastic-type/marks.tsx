/**
 * Miniatures of what each parameter does, drawn from its live value.
 *
 * The panel is a parts catalogue, so the annotation next to a number is a small
 * technical drawing of the thing that number changes. They move as you drag,
 * which is the point: "Density 0.42" says nothing, and a frame breathing around
 * a fixed letter says all of it without a word.
 *
 * Rules they all follow. A 26×14 box, so a row of them lines up. `currentColor`
 * only, so each one inherits its label's state instead of carrying its own
 * colour — and so a renamed token can never blank one out. And no mark on a row
 * that already explains itself: a mark everywhere is decoration, and then none of
 * them mean anything.
 *
 * Rows that were left without one, and why. `Size` and `Zoom` say what they do in
 * their own name and number. And `Gloss` has none for a different reason:
 * everything here is drawn
 * in `currentColor`, which cannot draw a highlight — the one thing gloss is. The
 * stage answers that row faster than a 26×14 box could.
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

/** A bar that thickens. */
export function WallMark({ value, min, max }: { value: number; min: number; max: number }) {
  const t = at(value, min, max)
  const thickness = 1 + t * 6
  return (
    <Box>
      <rect x="1" y={(H - thickness) / 2} width={W - 2} height={thickness} fill="currentColor" />
    </Box>
  )
}

/**
 * A letter's corner going blunt.
 *
 * Deliberately an L of solid material rather than the outline used for the frame
 * corner: this radius is on the part, and the two rows sit near each other.
 */
export function RoundMark({ value, min, max }: { value: number; min: number; max: number }) {
  const r = at(value, min, max) * 7
  const x = 6
  const y = 1.5
  const t = 5.5
  return (
    <Box>
      <path
        d={
          `M${x} ${H - y}L${x} ${y + r}` +
          (r > 0.2 ? `A${r} ${r} 0 0 1 ${x + r} ${y}` : `L${x} ${y}`) +
          `L${W - 4} ${y}L${W - 4} ${y + t}L${x + t} ${y + t}L${x + t} ${H - y}Z`
        }
        fill="currentColor"
      />
    </Box>
  )
}

/** A corner that rounds off. */
export function CornerMark({ value, min, max }: { value: number; min: number; max: number }) {
  const r = at(value, min, max) * 8
  return (
    <Box>
      <path
        d={`M2 ${H - 1}L2 ${2 + r}${r > 0.2 ? `A${r} ${r} 0 0 1 ${2 + r} 2` : 'L2 2'}L${W - 2} 2`}
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </Box>
  )
}

/**
 * The gate seen from above: wide where it leaves the runner, pinched at the part.
 *
 * Both the Gate and Neck rows draw the same trapezoid, so the pair reads as one
 * object described from two ends rather than as two unrelated numbers.
 */
export function GateMark({ gate, neck, max }: { gate: number; neck: number; max: number }) {
  const wide = 1.5 + clamp01(gate / max) * 8
  const thin = 1 + clamp01(neck / max) * 8
  const runner = 5
  const part = W - 5

  return (
    <Box>
      {/* the runner it leaves */}
      <rect x="0" y="1" width={runner - 2} height={H - 2} fill="currentColor" opacity="0.35" />
      <path
        d={`M${runner} ${(H - wide) / 2}L${part} ${(H - thin) / 2}L${part} ${(H + thin) / 2}L${runner} ${(H + wide) / 2}Z`}
        fill="currentColor"
      />
      {/* the part it feeds */}
      <rect x={part} y="1" width={W - part} height={H - 2} fill="currentColor" opacity="0.35" />
    </Box>
  )
}

/**
 * A frame breathing around a letter that stays put, with its gate shortening as
 * the frame closes in — which is the whole of what density does.
 */
export function DensityMark({ value }: { value: number }) {
  const t = clamp01(value)
  // Loose at 0, tight at 1, matching the direction of the control.
  const pad = 1 + (1 - t) * 3.4
  const letter = { x: 8, y: 3.6, w: 8, h: H - 7.2 }

  return (
    <Box>
      <rect
        x={letter.x - pad}
        y={letter.y - pad}
        width={letter.w + pad * 2}
        height={letter.h + pad * 2}
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect x={letter.x} y={letter.y} width={letter.w} height={letter.h} fill="currentColor" />
      {/* the gate the frame is closing in on */}
      <rect x={letter.x - pad} y={H / 2 - 0.7} width={pad} height="1.4" fill="currentColor" />
    </Box>
  )
}

/** A stem that puts on mass. */
export function WeightMark({ value, min, max }: { value: number; min: number; max: number }) {
  const w = 1.5 + at(value, min, max) * 7
  return (
    <Box>
      <rect x={W / 2 - w / 2} y="1" width={w} height={H - 2} fill="currentColor" />
    </Box>
  )
}

/** A shape that stretches sideways without changing height. */
export function WidthMark({ value, min, max }: { value: number; min: number; max: number }) {
  const w = 5 + at(value, min, max) * 16
  return (
    <Box>
      <rect x={(W - w) / 2} y="2.5" width={w} height={H - 5} fill="currentColor" />
    </Box>
  )
}

/** Two parts drifting apart. */
export function TrackingMark({ value, max }: { value: number; max: number }) {
  const gap = clamp01(value / max) * 9
  const w = 6
  return (
    <Box>
      <rect x={W / 2 - gap / 2 - w} y="2.5" width={w} height={H - 5} fill="currentColor" />
      <rect x={W / 2 + gap / 2} y="2.5" width={w} height={H - 5} fill="currentColor" />
    </Box>
  )
}

/**
 * The sheet's actual arrangement, in dots.
 *
 * This one exists because "Columns 0" is unreadable — nothing in the number says
 * that zero means one long row. Watching six dots fall into two columns says it
 * immediately, and no wording had to be invented for the edge case.
 */
export function AcrossMark({ perRow, count }: { perRow: number; count: number }) {
  const total = Math.max(1, Math.min(6, count))
  const cols = perRow > 0 ? Math.min(perRow, total) : total
  const rows = Math.ceil(total / cols)

  const cell = Math.min(4.5, (W - 2) / cols, (H - 2) / rows)
  const dot = Math.max(1, cell * 0.42)
  const originX = (W - cols * cell) / 2
  const originY = (H - rows * cell) / 2

  return (
    <Box>
      {Array.from({ length: total }, (_, i) => (
        <rect
          key={i}
          x={originX + (i % cols) * cell + (cell - dot) / 2}
          y={originY + Math.floor(i / cols) * cell + (cell - dot) / 2}
          width={dot}
          height={dot}
          fill="currentColor"
        />
      ))}
    </Box>
  )
}

/** A frame with the bars that cut it into cells, or without them. */
export function LatticeMark({ on }: { on: boolean }) {
  return (
    <Box>
      <rect x="1" y="1.5" width={W - 2} height={H - 3} stroke="currentColor" strokeWidth="1.2" />
      {on && (
        <>
          <path d={`M${W / 3} 1.5L${W / 3} ${H - 1.5}`} stroke="currentColor" strokeWidth="1.2" />
          <path d={`M${(W / 3) * 2} 1.5L${(W / 3) * 2} ${H - 1.5}`} stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
    </Box>
  )
}

/** Two frames bridged into one lattice, or standing apart. */
export function TieMark({ on }: { on: boolean }) {
  const w = 9.5
  return (
    <Box>
      <rect x="1" y="2" width={w} height={H - 4} stroke="currentColor" strokeWidth="1.2" />
      <rect x={W - 1 - w} y="2" width={w} height={H - 4} stroke="currentColor" strokeWidth="1.2" />
      {on && <rect x={1 + w} y={H / 2 - 0.9} width={W - 2 - w * 2} height="1.8" fill="currentColor" />}
    </Box>
  )
}

/** The flap where the shot enters the runner. */
export function TabMark({ on }: { on: boolean }) {
  return (
    <Box>
      {on && <path d={`M7 1.5L12 1.5L13 4.5L6 4.5Z`} fill="currentColor" />}
      <rect x="1" y="4.5" width={W - 2} height={H - 6} stroke="currentColor" strokeWidth="1.2" />
    </Box>
  )
}

/** The plaque that names the sprue. */
export function PlateMark({ on }: { on: boolean }) {
  return (
    <Box>
      <rect x="1" y="1.5" width={W - 2} height={H - 6} stroke="currentColor" strokeWidth="1.2" />
      {on && <rect x="5" y={H - 4.5} width="10" height="3.2" fill="currentColor" />}
    </Box>
  )
}

/**
 * The sheet in section, across a gate.
 *
 * The one mark on this tool that draws three rows at once, and it has to: the
 * three depths are not three independent numbers, they are one profile. What the
 * designer is really setting is that the part stands proud of the frame and the
 * gate is left as a recess between them, and no single number says that. So all
 * three rows draw the same section — frame, gate, part, left to right, on the one
 * flat back they share — with the row you are holding filled in and its two
 * neighbours left pale.
 *
 * Which is also why the section is in that order rather than in size order. It is
 * the order the material is actually in.
 */
export function DepthMark({
  part,
  runner,
  gate,
  max,
  role,
}: {
  part: number
  runner: number
  gate: number
  max: number
  role: 'part' | 'runner' | 'gate'
}) {
  const base = H - 1.5
  const rise = (value: number) => Math.max(0.9, at(value, 0, max) * (H - 4))
  const members: { key: 'runner' | 'gate' | 'part'; x: number; width: number; value: number }[] = [
    { key: 'runner', x: 1.5, width: 7, value: runner },
    { key: 'gate', x: 8.5, width: 6, value: Math.min(gate, runner) },
    { key: 'part', x: 14.5, width: 10, value: part },
  ]

  return (
    <Box>
      {members.map((m) => {
        const h = rise(m.value)
        return (
          <rect
            key={m.key}
            x={m.x}
            y={base - h}
            width={m.width}
            height={h}
            fill="currentColor"
            opacity={m.key === role ? 1 : 0.26}
          />
        )
      })}
      {/* The flat back they are all moulded against. */}
      <rect x="1.5" y={base} width={W - 3} height="0.9" fill="currentColor" opacity="0.5" />
    </Box>
  )
}

/** A moulded edge, in section: the corner going off at forty-five degrees. */
export function BevelMark({ value, max }: { value: number; max: number }) {
  const b = at(value, 0, max) * 6
  const x = 4
  const y = 3
  return (
    <Box>
      <path
        d={`M${x} ${H - 2}L${x} ${y + b}L${x + b} ${y}L${W - 3} ${y}L${W - 3} ${H - 2}Z`}
        fill="currentColor"
      />
    </Box>
  )
}
