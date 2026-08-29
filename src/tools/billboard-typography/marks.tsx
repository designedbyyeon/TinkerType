/**
 * Miniatures for the rows whose name and number do not, between them, say what
 * will happen.
 *
 * **Three of them, and that is on purpose.** A mark on every row is decoration,
 * and then none of them carries weight. The rows deliberately left bare:
 *
 * - `Ground`, `Sign`, `Wall` — a swatch already shows its own answer.
 * - `Width`, `Height`, `Girth`, `Angle` — the name and the number are the
 *   picture. A thumbnail of "wider" is a worse version of the building itself,
 *   which is already on screen at full size.
 * - `Seed` — there is nothing to draw. The number means "another one".
 * - `Occlusion` and `Key` — the difference lands in the render immediately and
 *   at full size; a 26×14 thumbnail of shading would be a worse version of what
 *   is already on screen.
 * - `Detail` — "more air conditioners" is what the word says.
 */

const Box = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 26 14" width={26} height={14} fill="none" stroke="currentColor">
    {children}
  </svg>
)

/**
 * Tidy against varied: four boards that start identical and stacked, and drift
 * apart in width and height as the dial rises.
 */
export function OrderMark({ value }: { value: number }) {
  const t = Math.max(0, Math.min(1, value))
  const rows = [
    { w: 14, h: 2, x: 6 },
    { w: 14 - 6 * t, h: 2 - 0.6 * t, x: 6 - 4 * t },
    { w: 14 + 7 * t, h: 2 + 0.4 * t, x: 6 - 1 * t },
    { w: 14 - 9 * t, h: 2 - 0.3 * t, x: 6 + 6 * t },
  ]
  return (
    <Box>
      {rows.map((r, i) => (
        <rect
          key={i}
          x={Math.max(1, r.x)}
          y={1.4 + i * 3.1}
          width={Math.max(2, Math.min(24 - Math.max(1, r.x), r.w))}
          height={r.h}
          strokeWidth={0}
          fill="currentColor"
        />
      ))}
    </Box>
  )
}

/** Air around the word. The bar is the text, the outline is the board. */
export function PadMark({ value }: { value: number }) {
  const air = 1.4 + Math.max(0, Math.min(1.6, value)) * 4
  return (
    <Box>
      <rect x={1.5} y={2} width={23} height={10} strokeWidth={0.9} opacity={0.5} />
      <rect
        x={1.5 + air}
        y={4.4}
        width={Math.max(2, 23 - air * 2)}
        height={5.2}
        strokeWidth={0}
        fill="currentColor"
      />
    </Box>
  )
}

/** How far a board stands off the wall. The wall is the line; the board floats. */
export function DepthMark({ value }: { value: number }) {
  const out = Math.max(0, Math.min(2, value)) * 3.4
  return (
    <Box>
      <line x1={4} y1={1.5} x2={4} y2={12.5} strokeWidth={0.9} opacity={0.45} />
      <rect x={4 + out} y={3.5} width={9} height={7} strokeWidth={0.9} />
      <line x1={4} y1={7} x2={4 + out} y2={7} strokeWidth={0.9} opacity={0.6} />
    </Box>
  )
}
