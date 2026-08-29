import { Path, Shape } from 'three'
import { pointInPolygon } from '../../../shared/geometry/polygon'
import type { Vec2 } from '../../../shared/geometry/vec'
import type { Lump } from '../geometry/solid'

/**
 * A lump as `THREE.Shape`s — the one place three.js meets this tool's geometry.
 *
 * Kept out of `geometry/` on purpose. Every module in there is imported by the
 * flat drawing as well, and three.js is roughly the size of the rest of the site;
 * one import in the wrong file would put all of it in the index chunk, which the
 * register goes to some trouble to avoid. The plan is pure geometry, this is the
 * translation, and only the solid renderer ever asks for it.
 */

/**
 * Lay a ring onto a shape or a hole.
 *
 * **The y axis flips.** The plan is in the drawing's own space, y increasing
 * downward; three's is up. Negating y here rather than rotating the group later
 * keeps the model the same way up as the picture the tool has been showing all
 * along, which is what makes the exported file recognisable.
 */
function trace(target: Path, points: Vec2[]): void {
  const last = points[points.length - 1]
  // A ring that repeats its first point would leave a zero-length edge for the
  // triangulator to trip over.
  const n =
    points.length > 1 && Math.abs(last.x - points[0].x) < 1e-9 && Math.abs(last.y - points[0].y) < 1e-9
      ? points.length - 1
      : points.length

  target.moveTo(points[0].x, -points[0].y)
  for (let i = 1; i < n; i++) target.lineTo(points[i].x, -points[i].y)
  target.closePath()
}

/**
 * One lump as the shapes it encloses: one `Shape` per solid, carrying its own
 * openings.
 *
 * Containment decides which opening belongs to which solid rather than winding,
 * for the reason tool 03 found from the other end and this tool paid for in
 * filled-in letters: the sign convention differs between TrueType and CFF, and
 * the y flip inverts it again. A piece is routinely several solids — `이` is two,
 * and so is any letter whose strokes do not meet.
 */
export function shapesOfLump(lump: Lump): Shape[] {
  const solids = lump.rings.filter((r) => !r.hole && r.points.length > 2)
  const holes = lump.rings.filter((r) => r.hole && r.points.length > 2)

  return solids.map((solid) => {
    const shape = new Shape()
    trace(shape, solid.points)
    for (const hole of holes) {
      if (!pointInPolygon(hole.points[0], solid.points)) continue
      const path = new Path()
      trace(path, hole.points)
      shape.holes.push(path)
    }
    return shape
  })
}
