import { simplify } from '../../../shared/geometry/polyline'
import { dist, type Vec2 } from '../../../shared/geometry/vec'

/** Turn angle beyond which a vertex is treated as a hard corner, radians. */
const CORNER_THRESHOLD = (55 * Math.PI) / 180

const fmt = (n: number) => {
  const r = Math.round(n * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

/**
 * Centripetal Catmull-Rom control point. The centripetal parameterisation
 * (alpha = 0.5) is what keeps the curve from looping or overshooting where the
 * simplified contour has uneven vertex spacing.
 */
function controlPoint(prev: Vec2, a: Vec2, b: Vec2, next: Vec2, forStart: boolean): Vec2 {
  const alpha = 0.5
  const d1 = Math.pow(Math.max(dist(prev, a), 1e-6), alpha)
  const d2 = Math.pow(Math.max(dist(a, b), 1e-6), alpha)
  const d3 = Math.pow(Math.max(dist(b, next), 1e-6), alpha)

  if (forStart) {
    const denom = 3 * d1 * (d1 + d2)
    return {
      x: (d1 * d1 * b.x - d2 * d2 * prev.x + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * a.x) / denom,
      y: (d1 * d1 * b.y - d2 * d2 * prev.y + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * a.y) / denom,
    }
  }

  const denom = 3 * d3 * (d3 + d2)
  return {
    x: (d3 * d3 * a.x - d2 * d2 * next.x + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * b.x) / denom,
    y: (d3 * d3 * a.y - d2 * d2 * next.y + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * b.y) / denom,
  }
}

function isCorner(prev: Vec2, p: Vec2, next: Vec2): boolean {
  const ax = p.x - prev.x
  const ay = p.y - prev.y
  const bx = next.x - p.x
  const by = next.y - p.y
  const la = Math.hypot(ax, ay)
  const lb = Math.hypot(bx, by)
  if (la < 1e-9 || lb < 1e-9) return false
  const cos = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb)))
  return Math.acos(cos) > CORNER_THRESHOLD
}

/**
 * Fit one closed contour with cubic Béziers so the exported SVG has a handful
 * of editable anchors instead of thousands of marching-squares vertices.
 * Detected corners keep zero-length handles, which is what preserves crisp
 * square shapes.
 */
export function loopToPath(loop: Vec2[], tolerance: number): string {
  const pts = simplify(loop, tolerance)
  const n = pts.length
  if (n < 3) return ''

  const at = (i: number) => pts[((i % n) + n) % n]
  const corner = pts.map((_, i) => isCorner(at(i - 1), at(i), at(i + 1)))

  let d = `M${fmt(pts[0].x)} ${fmt(pts[0].y)}`

  for (let i = 0; i < n; i++) {
    const a = at(i)
    const b = at(i + 1)
    const c1 = corner[i] ? a : controlPoint(at(i - 1), a, b, at(i + 2), true)
    const c2 = corner[(i + 1) % n] ? b : controlPoint(at(i - 1), a, b, at(i + 2), false)
    d += `C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(b.x)} ${fmt(b.y)}`
  }

  return d + 'Z'
}

/**
 * Combine every contour into one path. Nested loops come out with opposite
 * winding from marching squares, so `fill-rule: evenodd` renders holes
 * correctly without any containment test.
 */
export function loopsToPathData(loops: Vec2[][], tolerance: number): string {
  return loops
    .map((loop) => loopToPath(loop, tolerance))
    .filter(Boolean)
    .join('')
}
