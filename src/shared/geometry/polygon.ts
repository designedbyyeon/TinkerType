import type { Rect, Vec2 } from './vec'

/**
 * Closed-outline geometry, owned here because three tools want it.
 *
 * It arrived as glyph plumbing inside tool 02 — the winding test that tells a
 * letter's flesh from its counter, the box that makes an overlap check cheap.
 * None of that is about glyphs, or about plastic, and tool 03 needs the same
 * functions for signboards and building masses. So they live here and the
 * tools re-export what they were already importing.
 */

const RAD = Math.PI / 180

/**
 * Shoelace area. **The sign carries the winding** — which is the reason this is
 * worth having rather than an absolute area: the direction a font drew a contour
 * in is the direction nonzero fill obeys, and it is how flesh is told from hole
 * without guessing at nesting depth.
 */
export function signedArea(points: Vec2[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

/** An empty outline gets a zero box rather than an infinite one. */
export function bboxOf(points: Vec2[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Ray crossing. Points exactly on an edge are undefined, which callers absorb. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Cut a polygon with one half-plane, keeping the side the normal points to.
 *
 * One plane is all this handles: an outline convex enough to cross the plane
 * exactly twice. Sutherland–Hodgman, unrolled.
 *
 * It exists because a gate is a shape, not a line. Tool 02 buries a gate's wide
 * end inside whatever holds it so the drawing shows no seam at the join — and
 * when the gate leaves at an angle, the corner of that wide end swings past the
 * face of the member and stands in open air. Measured, 3–4px of it. Trimming the
 * root against the member's own face is the only cut that is right at every
 * angle; burying deeper or shifting the foot moves the problem rather than
 * removing it.
 *
 * (It lived here before, for the axonometric prototype that was scrapped, and was
 * deleted with it. It is back because the real renderer found the same shape of
 * problem from the other end — which is its own argument that the operation is
 * not prototype scaffolding.)
 */
export function clipHalfPlane(points: Vec2[], origin: Vec2, normal: Vec2): Vec2[] {
  const len = Math.hypot(normal.x, normal.y)
  if (len === 0 || points.length < 3) return points
  const nx = normal.x / len
  const ny = normal.y / len
  const side = (p: Vec2) => (p.x - origin.x) * nx + (p.y - origin.y) * ny

  const out: Vec2[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const da = side(a)
    const db = side(b)
    if (da >= 0) out.push(a)
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out.length >= 3 ? out : []
}

/**
 * A rounded rectangle as a polygon.
 *
 * Corner for corner with tool 02's `roundedRectPath`, and deliberately *not*
 * derived from it: flattening here rather than parsing that path string keeps
 * the two independent, so a test can hold them against each other. That test
 * lives beside the path version in `tools/plastic-type/geometry/runner.test.ts`,
 * and it is what caught the mirrored winding being a step out of phase.
 */
export function roundedRectRing(
  r: Rect,
  radius: number,
  clockwise: boolean,
  perCorner = 6,
): Vec2[] {
  const rad = Math.max(0, Math.min(radius, Math.min(r.width, r.height) / 2))
  const x0 = r.x
  const y0 = r.y
  const x1 = r.x + r.width
  const y1 = r.y + r.height

  if (rad <= 0) {
    const box = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ]
    return clockwise ? box : box.reverse()
  }

  // Centre and start angle of each corner arc, in the drawing order the path
  // version uses: top-right, bottom-right, bottom-left, top-left.
  const corners: [Vec2, number][] = [
    [{ x: x1 - rad, y: y0 + rad }, -90],
    [{ x: x1 - rad, y: y1 - rad }, 0],
    [{ x: x0 + rad, y: y1 - rad }, 90],
    [{ x: x0 + rad, y: y0 + rad }, 180],
  ]

  const pts: Vec2[] = []
  for (const [c, from] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const deg = from + (90 * i) / perCorner
      pts.push({
        x: c.x + Math.cos(deg * RAD) * rad,
        y: c.y + Math.sin(deg * RAD) * rad,
      })
    }
  }

  return clockwise ? pts : pts.reverse()
}
