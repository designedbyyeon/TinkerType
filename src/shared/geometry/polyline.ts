import { dist, lerp, normalize, type Vec2 } from './vec'

/** A point on a path plus the local direction of travel. */
export interface PathSample {
  pos: Vec2
  /** Unit tangent. */
  tangent: Vec2
  /** Normalised position along the path, 0..1. */
  t: number
}

export function polylineLength(pts: Vec2[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i])
  return total
}

/**
 * Re-space a polyline so every vertex is `spacing` apart. Used to give the
 * smoothing kernel a uniform domain — a raw pointer trace has wildly uneven
 * point density (fast strokes are sparse, slow ones are dense).
 */
export function resampleUniform(pts: Vec2[], spacing: number): Vec2[] {
  if (pts.length < 2 || spacing <= 0) return pts.slice()

  const out: Vec2[] = [pts[0]]
  let carry = 0

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = dist(a, b)
    if (seg < 1e-9) continue

    let walked = spacing - carry
    while (walked <= seg) {
      out.push(lerp(a, b, walked / seg))
      walked += spacing
    }
    carry = seg - (walked - spacing)
  }

  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > spacing * 0.5) out.push(last)
  return out
}

/**
 * Gaussian blur along the polyline. Endpoints use edge-clamped padding so the
 * stroke does not shrink away from where it was drawn.
 *
 * `sigmaSamples` is in vertices, so callers convert px via the resample spacing.
 */
export function smoothPolyline(pts: Vec2[], sigmaSamples: number): Vec2[] {
  if (pts.length < 3 || sigmaSamples < 0.25) return pts.slice()

  const radius = Math.max(1, Math.ceil(sigmaSamples * 3))
  const kernel: number[] = []
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigmaSamples * sigmaSamples))
    kernel.push(w)
    sum += w
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum

  const n = pts.length
  const out: Vec2[] = new Array(n)
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    for (let k = -radius; k <= radius; k++) {
      const idx = Math.min(n - 1, Math.max(0, i + k))
      const w = kernel[k + radius]
      x += pts[idx].x * w
      y += pts[idx].y * w
    }
    out[i] = { x, y }
  }
  return out
}

/** Douglas-Peucker. Keeps the shape, drops redundant vertices. */
export function simplify(pts: Vec2[], tolerance: number): Vec2[] {
  if (pts.length < 3 || tolerance <= 0) return pts.slice()

  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1

  const stack: [number, number][] = [[0, pts.length - 1]]
  const tol2 = tolerance * tolerance

  while (stack.length) {
    const [first, last] = stack.pop()!
    if (last - first < 2) continue

    const a = pts[first]
    const b = pts[last]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const segLen2 = dx * dx + dy * dy

    let maxDist2 = -1
    let maxIdx = -1
    for (let i = first + 1; i < last; i++) {
      const p = pts[i]
      let d2: number
      if (segLen2 < 1e-12) {
        d2 = (p.x - a.x) ** 2 + (p.y - a.y) ** 2
      } else {
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / segLen2
        t = Math.min(1, Math.max(0, t))
        d2 = (p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2
      }
      if (d2 > maxDist2) {
        maxDist2 = d2
        maxIdx = i
      }
    }

    if (maxDist2 > tol2 && maxIdx > 0) {
      keep[maxIdx] = 1
      stack.push([first, maxIdx], [maxIdx, last])
    }
  }

  return pts.filter((_, i) => keep[i] === 1)
}

/**
 * Turn a raw pointer trace into the editable centreline.
 * `raw` is kept untouched in the store so smoothing stays re-adjustable.
 */
export function buildCenterline(raw: Vec2[], smoothingPx: number): Vec2[] {
  if (raw.length < 2) return raw.slice()
  const step = 2
  const dense = resampleUniform(raw, step)
  const smoothed = smoothPolyline(dense, smoothingPx / step)
  return simplify(smoothed, 0.4)
}

function tangentAt(pts: Vec2[], index: number): Vec2 {
  const prev = pts[Math.max(0, index - 1)]
  const next = pts[Math.min(pts.length - 1, index + 1)]
  return normalize({ x: next.x - prev.x, y: next.y - prev.y })
}

/** Walk the polyline placing a sample every `spacing` px of arc length. */
export function samplePathBySpacing(pts: Vec2[], spacing: number): PathSample[] {
  if (pts.length < 2 || spacing <= 0) return []
  const total = polylineLength(pts)
  if (total < 1e-6) return []

  const out: PathSample[] = []
  let target = 0
  let walked = 0

  for (let i = 1; i < pts.length && target <= total + 1e-6; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = dist(a, b)
    if (seg < 1e-9) continue

    while (target <= walked + seg + 1e-6 && target <= total + 1e-6) {
      const local = (target - walked) / seg
      out.push({
        pos: lerp(a, b, Math.min(1, Math.max(0, local))),
        tangent: normalize({ x: b.x - a.x, y: b.y - a.y }),
        t: total < 1e-9 ? 0 : target / total,
      })
      target += spacing
    }
    walked += seg
  }

  return out
}

/** Distribute exactly `count` samples evenly along the polyline. */
export function samplePathByCount(pts: Vec2[], count: number): PathSample[] {
  if (pts.length < 2 || count < 1) return []
  if (count === 1) {
    const mid = Math.floor(pts.length / 2)
    return [{ pos: pts[mid], tangent: tangentAt(pts, mid), t: 0.5 }]
  }
  const total = polylineLength(pts)
  return samplePathBySpacing(pts, total / (count - 1)).slice(0, count)
}
