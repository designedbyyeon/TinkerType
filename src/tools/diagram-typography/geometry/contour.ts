import type { ScalarField } from './field'
import type { Vec2 } from '../../../shared/geometry/vec'

/**
 * Marching squares at the zero iso-line.
 *
 * Segments are addressed by the grid edge they cross rather than by their
 * coordinates: every edge is crossed at most once, so an edge id is a stable
 * key for stitching segments into closed loops without any float comparison.
 */
export function marchingSquares(field: ScalarField): Vec2[][] {
  const { data, w, h, x0, y0, cell } = field

  const horizontalId = (i: number, j: number) => 2 * (j * w + i)
  const verticalId = (i: number, j: number) => 2 * (j * w + i) + 1

  const points = new Map<number, Vec2>()

  function pointFor(id: number): Vec2 {
    const cached = points.get(id)
    if (cached) return cached

    const base = id >> 1
    const isVertical = (id & 1) === 1
    const i = base % w
    const j = (base - i) / w

    const a = data[j * w + i]
    const b = isVertical ? data[(j + 1) * w + i] : data[j * w + i + 1]
    const denom = a - b
    const t = Math.abs(denom) < 1e-12 ? 0.5 : Math.min(1, Math.max(0, a / denom))

    const p = isVertical
      ? { x: x0 + i * cell, y: y0 + (j + t) * cell }
      : { x: x0 + (i + t) * cell, y: y0 + j * cell }

    points.set(id, p)
    return p
  }

  // from-edge -> to-edge. Oriented so the inside is always on the left.
  const next = new Map<number, number>()
  const link = (from: number, to: number) => {
    next.set(from, to)
    pointFor(from)
    pointFor(to)
  }

  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const v0 = data[j * w + i]
      const v1 = data[j * w + i + 1]
      const v2 = data[(j + 1) * w + i + 1]
      const v3 = data[(j + 1) * w + i]

      const code = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0)
      if (code === 0 || code === 15) continue

      const top = horizontalId(i, j)
      const right = verticalId(i + 1, j)
      const bottom = horizontalId(i, j + 1)
      const left = verticalId(i, j)

      switch (code) {
        case 1: link(left, top); break
        case 2: link(top, right); break
        case 3: link(left, right); break
        case 4: link(right, bottom); break
        case 6: link(top, bottom); break
        case 7: link(left, bottom); break
        case 8: link(bottom, left); break
        case 9: link(bottom, top); break
        case 11: link(bottom, right); break
        case 12: link(right, left); break
        case 13: link(right, top); break
        case 14: link(top, left); break

        // Saddles: the cell centre decides whether the two inside corners are
        // joined through the middle or pinched apart.
        case 5: {
          const centre = (v0 + v1 + v2 + v3) / 4
          if (centre < 0) {
            link(right, top)
            link(left, bottom)
          } else {
            link(left, top)
            link(right, bottom)
          }
          break
        }
        case 10: {
          const centre = (v0 + v1 + v2 + v3) / 4
          if (centre < 0) {
            link(top, left)
            link(bottom, right)
          } else {
            link(top, right)
            link(bottom, left)
          }
          break
        }
      }
    }
  }

  const loops: Vec2[][] = []
  const visited = new Set<number>()

  for (const start of next.keys()) {
    if (visited.has(start)) continue

    const loop: Vec2[] = []
    let current = start

    while (!visited.has(current)) {
      visited.add(current)
      loop.push(pointFor(current))
      const following = next.get(current)
      if (following === undefined) break
      current = following
    }

    if (loop.length >= 3) loops.push(loop)
  }

  return loops
}
