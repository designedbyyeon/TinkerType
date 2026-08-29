import { Path, Shape } from 'three'
import { pointInPolygon, signedArea } from '../../../shared/geometry/polygon'
import type { Vec2 } from '../../../shared/geometry/vec'
import type { Seg } from '../../../shared/media/type/measure'

/**
 * A glyph's outline as `THREE.Shape`s, curves intact.
 *
 * The one thing this must not do is flatten. `Shape` takes `quadraticCurveTo`
 * and `bezierCurveTo` directly, so the font's own control points go through
 * untouched and the tessellator decides how fine to be — the same win the SVG
 * tools get from handing the browser real Béziers, arrived at differently.
 *
 * Two things need care.
 *
 * **The y axis flips.** opentype hands back SVG's convention, y increasing
 * downward from the baseline. Three's is up. So every coordinate is negated, and
 * that reverses every contour's winding as a side effect — which is why the hole
 * test below cannot be a winding test.
 *
 * **Holes are found by containment, not by winding.** The tempting version reads
 * the sign of the area and calls negative contours holes. It is wrong twice over:
 * the convention differs between TrueType and CFF outlines, and the y flip
 * inverts it anyway. Containment parity is true of any font in any convention —
 * a contour inside an odd number of others is a hole. Tool 02 learned the same
 * lesson from the other end and paid for it with letters that came out filled.
 */

/** How coarsely a curve is sampled **for the containment test only**. */
const PROBE_STEPS = 6

interface Contour {
  /** The commands, y already flipped, ready for `Shape`. */
  segs: Seg[]
  /** A coarse polyline, used to decide what is inside what. */
  probe: Vec2[]
}

function flipY(segs: Seg[]): Seg[] {
  return segs.map((c) => {
    if (c.type === 'M' || c.type === 'L') return { ...c, y: -c.y }
    if (c.type === 'Q') return { ...c, y1: -c.y1, y: -c.y }
    if (c.type === 'C') return { ...c, y1: -c.y1, y2: -c.y2, y: -c.y }
    return c
  })
}

/** Split a glyph's commands into closed contours. `Z` is not always present. */
function contoursOf(segs: Seg[]): Contour[] {
  const out: Contour[] = []
  let current: Seg[] = []
  let probe: Vec2[] = []
  let at: Vec2 = { x: 0, y: 0 }

  const close = () => {
    if (current.length > 1 && probe.length > 2) out.push({ segs: current, probe })
    current = []
    probe = []
  }

  const sample = (f: (t: number) => Vec2) => {
    for (let i = 1; i <= PROBE_STEPS; i++) probe.push(f(i / PROBE_STEPS))
  }

  for (const c of segs) {
    if (c.type === 'M') {
      close()
      at = { x: c.x, y: c.y }
      current = [c]
      probe = [at]
      continue
    }
    if (c.type === 'Z') {
      current.push(c)
      close()
      continue
    }
    current.push(c)
    if (c.type === 'L') {
      at = { x: c.x, y: c.y }
      probe.push(at)
    } else if (c.type === 'Q') {
      const p0 = at
      sample((t) => ({
        x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x1 + t * t * c.x,
        y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y1 + t * t * c.y,
      }))
      at = { x: c.x, y: c.y }
    } else {
      const p0 = at
      sample((t) => ({
        x:
          (1 - t) ** 3 * p0.x +
          3 * (1 - t) ** 2 * t * c.x1 +
          3 * (1 - t) * t * t * c.x2 +
          t ** 3 * c.x,
        y:
          (1 - t) ** 3 * p0.y +
          3 * (1 - t) ** 2 * t * c.y1 +
          3 * (1 - t) * t * t * c.y2 +
          t ** 3 * c.y,
      }))
      at = { x: c.x, y: c.y }
    }
  }
  close()
  return out
}

/** Lay a contour's commands onto a `Shape` or `Path`. */
function trace(target: Path, segs: Seg[]): void {
  for (const c of segs) {
    if (c.type === 'M') target.moveTo(c.x, c.y)
    else if (c.type === 'L') target.lineTo(c.x, c.y)
    else if (c.type === 'Q') target.quadraticCurveTo(c.x1, c.y1, c.x, c.y)
    else if (c.type === 'C') target.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y)
    else target.closePath()
  }
}

/**
 * One glyph, as the shapes its outline encloses.
 *
 * Returns one `Shape` per solid, each carrying its own holes. A Hangul syllable
 * routinely comes back as several — the jamo are separate strokes — and that is
 * correct rather than a problem: they are separate solids on the same sign.
 */
export function shapesOfGlyph(commands: Seg[]): Shape[] {
  const contours = contoursOf(flipY(commands))
  if (contours.length === 0) return []

  // Depth by containment parity. A point of each contour is tested against every
  // other's coarse polyline; odd depth means a hole. True in any font, in any
  // winding convention, which a sign test is not.
  const depth = contours.map((c, i) =>
    contours.reduce(
      (n, other, j) => (i !== j && pointInPolygon(c.probe[0], other.probe) ? n + 1 : n),
      0,
    ),
  )

  const shapes: Shape[] = []
  const solids: number[] = []
  contours.forEach((_, i) => {
    if (depth[i] % 2 === 0) solids.push(i)
  })

  for (const i of solids) {
    const shape = new Shape()
    trace(shape, contours[i].segs)

    // A hole belongs to the solid immediately containing it — the deepest solid
    // that contains it, which for a glyph is always its own outer contour.
    for (let j = 0; j < contours.length; j++) {
      if (depth[j] % 2 === 0) continue
      if (depth[j] !== depth[i] + 1) continue
      if (!pointInPolygon(contours[j].probe[0], contours[i].probe)) continue
      const hole = new Path()
      trace(hole, contours[j].segs)
      shape.holes.push(hole)
    }
    shapes.push(shape)
  }

  return shapes
}

/** Exposed for the test: how many solids and holes an outline really has. */
export function countContours(commands: Seg[]): { solids: number; holes: number } {
  const contours = contoursOf(flipY(commands))
  let solids = 0
  let holes = 0
  contours.forEach((c, i) => {
    const d = contours.reduce(
      (n, other, j) => (i !== j && pointInPolygon(c.probe[0], other.probe) ? n + 1 : n),
      0,
    )
    if (d % 2 === 0) solids++
    else holes++
  })
  return { solids, holes }
}

/** Area of a contour's probe polyline. Only the magnitude is meaningful here. */
export function probeArea(commands: Seg[]): number {
  return contoursOf(flipY(commands)).reduce((a, c) => a + Math.abs(signedArea(c.probe)), 0)
}
