import type { ShapeKind } from '../types'

/**
 * Signed distance to a shape centred at (cx, cy): negative inside, zero on the
 * edge, positive outside. Working in distance space (rather than the classic
 * inverse-square metaball field) is what lets the blend slider be a real px
 * radius instead of an abstract threshold.
 */
export function shapeSdf(
  px: number,
  py: number,
  cx: number,
  cy: number,
  size: number,
  kind: ShapeKind,
  cornerRadius: number,
  angle = 0,
): number {
  const half = size / 2
  let dx = px - cx
  let dy = py - cy

  if (kind === 'circle') {
    return Math.hypot(dx, dy) - half
  }

  // Rotate the sample into the shape's own frame so a tangent-aligned square
  // blends exactly the way it is drawn.
  if (angle !== 0) {
    const c = Math.cos(-angle)
    const s = Math.sin(-angle)
    const rx = dx * c - dy * s
    const ry = dx * s + dy * c
    dx = rx
    dy = ry
  }

  // Rounded box; a plain square is just radius 0.
  const r = kind === 'roundSquare' ? Math.min(half, half * cornerRadius) : 0
  const qx = Math.abs(dx) - (half - r)
  const qy = Math.abs(dy) - (half - r)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside - r
}

/**
 * Polynomial smooth minimum (Inigo Quilez). Blends two distance fields over a
 * band of width `k`, which is exactly the "morphing" control: k px of fillet
 * where two shapes approach each other.
 *
 * k <= 0 degrades to a hard min, so the same code path renders both the
 * merged and the separated references.
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 1e-6) return Math.min(a, b)
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k))
  return b + (a - b) * h - k * h * (1 - h)
}

/**
 * Fillet union — material is added only in the crevice where two surfaces are
 * both within `r`, and everywhere else the result is exactly min(a, b).
 *
 * That exactness is the whole point: smooth-min perturbs a shape's entire
 * surface as soon as a neighbour is anywhere nearby, so circles swell and go
 * lopsided. Here a circle stays exactly circular right up to the joint, and
 * only the joint itself is rounded off.
 */
export function roundUnion(a: number, b: number, r: number): number {
  if (r <= 1e-6) return Math.min(a, b)
  const ux = Math.max(r - a, 0)
  const uy = Math.max(r - b, 0)
  // Both terms are zero unless a and b are both inside the fillet band, which
  // is what collapses this to a plain union away from the joint.
  return Math.max(r, Math.min(a, b)) - Math.hypot(ux, uy)
}
