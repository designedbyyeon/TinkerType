import type { Rect, Vec2 } from '../../../shared/geometry/vec'

/**
 * The two camera-facing walls, as one straight line.
 *
 * This is the whole reading mechanism and it is the one piece that survived the
 * scrapped tool. Put the footprint at x ∈ [0, W], z ∈ [0, D] and the camera in
 * the (+x, +y, +z) octant. Screen right is then
 *
 *     r = (cos a, 0, −sin a)
 *
 * so a point's screen x is `x·cos a − z·sin a`. Walk one parameter `s` from 0 to
 * `W + D` — the front wall as `x = s, z = D`, then the right wall as `x = W,
 * z = D − (s − W)` — and screen x comes out
 *
 *     front:  s·cos a − D·sin a
 *     right:  W·cos a − D·sin a + (s − W)·sin a
 *
 * **Both are increasing in s, and they agree exactly at s = W.** So for any
 * azimuth strictly between 0° and 90° the two walls are a single line of length
 * W + D whose screen x is a monotone function of position along it.
 *
 * > **A line of signs read in screen-x order is the sentence back.**
 *
 * Which means the sort key is `(row, s)` and nothing else — no arrows, no
 * numbers, no per-wall special case. It also means the camera azimuth is a
 * composition choice rather than a constraint: the earlier derivation only did
 * 45° isometric, and generalising it is what let the camera drop to a shallow,
 * nearly frontal angle without touching the layout.
 *
 * The one thing that has to be enforced elsewhere: **a sign may not straddle
 * s = W.** Its face would fold around the corner and read as two signs.
 */

export interface Wall {
  width: number
  depth: number
  /** `width + depth`. The length of the merged line. */
  total: number
}

export const wallOf = (width: number, depth: number): Wall => ({
  width,
  depth,
  total: width + depth,
})

export type Facing = 'front' | 'right'

export interface Station {
  facing: Facing
  x: number
  z: number
}

/**
 * Where along the merged line a given `s` lands.
 *
 * **The comparison is strict.** `s <= width` choosing the front wall means a
 * sign starting exactly on the corner is built as a front-wall object running
 * off the side of the building — which happened, and left the first right-wall
 * sign with nothing under it. A piece's wall is decided by its midpoint, not by
 * its start; this function is the primitive, and callers pass the midpoint.
 */
export function atS(wall: Wall, s: number): Station {
  const t = Math.min(Math.max(s, 0), wall.total)
  return t < wall.width
    ? { facing: 'front', x: t, z: wall.depth }
    : { facing: 'right', x: wall.width, z: wall.depth - (t - wall.width) }
}

/** The camera, as the two angles that fix it. Degrees. */
export interface View {
  azimuth: number
  elevation: number
}

const RAD = Math.PI / 180

/** Screen x of a station on the merged line. Monotone in `s` by construction. */
export function screenXAt(wall: Wall, s: number, view: View): number {
  const a = view.azimuth * RAD
  const at = atS(wall, s)
  return at.x * Math.cos(a) - at.z * Math.sin(a)
}

export interface Point3 {
  x: number
  y: number
  z: number
}

/**
 * Orthographic projection to screen coordinates, y up.
 *
 * Screen right is `r = (cos a, 0, −sin a)` and screen up is
 * `u = (−sin a·sin e, cos e, −cos a·sin e)`; both unit, both perpendicular to
 * the view direction. Used for the occlusion check, which needs real 2D areas
 * rather than just an ordering.
 */
export function project(p: Point3, view: View): Vec2 {
  const a = view.azimuth * RAD
  const e = view.elevation * RAD
  return {
    x: p.x * Math.cos(a) - p.z * Math.sin(a),
    y: -p.x * Math.sin(a) * Math.sin(e) + p.y * Math.cos(e) - p.z * Math.cos(a) * Math.sin(e),
  }
}

/** Distance toward the camera. Larger is nearer. */
export function depthOf(p: Point3, view: View): number {
  const a = view.azimuth * RAD
  const e = view.elevation * RAD
  return (
    p.x * Math.sin(a) * Math.cos(e) + p.y * Math.sin(e) + p.z * Math.cos(a) * Math.cos(e)
  )
}

/** An axis-aligned box by its minimum corner and its size. */
export interface Box {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

const cornersOf = (b: Box): Point3[] => {
  const out: Point3[] = []
  for (let i = 0; i < 8; i++) {
    out.push({
      x: b.x + (i & 1 ? b.w : 0),
      y: b.y + (i & 2 ? b.h : 0),
      z: b.z + (i & 4 ? b.d : 0),
    })
  }
  return out
}

/**
 * A box's screen footprint, as the bounding rectangle of its projected corners.
 *
 * A bounding box, deliberately. The exact silhouette is a hexagon and getting
 * that right consumed days in the SVG attempt — because there it decided the
 * paint order and a wrong answer buried a sign. Here the depth buffer decides
 * what covers what, and this is only feeding a "nothing is more than half
 * hidden" check. An over-estimate makes that check stricter, never wrong.
 */
export function projectBox(b: Box, view: View): Rect {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const c of cornersOf(b)) {
    const p = project(c, view)
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Nearest corner of a box, in camera depth. What "in front of" compares. */
export function nearDepth(b: Box, view: View): number {
  return cornersOf(b).reduce((m, c) => Math.max(m, depthOf(c, view)), -Infinity)
}

/** Farthest corner. A box is wholly in front of another if its far beats the other's near. */
export function farDepth(b: Box, view: View): number {
  return cornersOf(b).reduce((m, c) => Math.min(m, depthOf(c, view)), Infinity)
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * How far a board's standoff moves it **sideways on screen**, in `s` units.
 *
 * The catch in the reading rule, and it only shows up once boards have different
 * depths. A board standing `out` off the front wall projects to
 * `X(s) − out·sin a`, and since `X` climbs at `cos a` along that wall, it appears
 * where a flush board at `s − out·tan a` would. On the right wall `X` climbs at
 * `sin a` instead, so the same standoff shifts it by `out·cot a` — at a shallow
 * azimuth that is *enormous*, because the side wall's screen extent is squeezed
 * by `sin a` while the standoff is projected at `cos a`.
 *
 * So `(row, s)` order is **not** screen order once depth varies, and the
 * sentence can come out with two words swapped. The packer's answer is to hold a
 * minimum gap wider than the worst shift, and to keep the side wall shallow.
 */
export function shiftOf(facing: Facing, out: number, view: View): number {
  const a = view.azimuth * RAD
  const t = Math.tan(a)
  /*
   * The floor on the tangent is what lets the camera go dead-on.
   *
   * At azimuth zero the side wall has no screen width, so a standoff there
   * shifts a board infinitely far — mathematically true and useless as a number,
   * because two infinities subtract to `NaN` and poison the packing. Clamped, the
   * side wall's gaps simply become wider than the wall itself and the packer
   * stops putting anything there. The behaviour is right and it needs no special
   * case: at dead-on there *is* no side wall to read.
   */
  return facing === 'front' ? -out * t : out / Math.max(t, 1e-3)
}

/** Where along the merged line a board *appears* to be. The reading key. */
export const effectiveS = (facing: Facing, s: number, out: number, view: View): number =>
  s + shiftOf(facing, out, view)
