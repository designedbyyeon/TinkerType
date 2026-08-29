import type { BlendMode, ShapeNode } from '../types'
import { roundUnion, shapeSdf, smin } from './sdf'

/** A distance field sampled on a regular grid covering the shapes' bounds. */
export interface ScalarField {
  data: Float32Array
  /** Sample counts, not cell counts. */
  w: number
  h: number
  /** World position of sample (0, 0). */
  x0: number
  y0: number
  cell: number
}

/** Large finite sentinel — Infinity would poison the smin arithmetic. */
const FAR = 1e6

/**
 * The polynomial smin pulls a surface at most k/4 toward its neighbour, so the
 * metaball slider is scaled by 4 to make its number mean something a designer
 * can see: "blend 20" = the shape bulges 20px toward the next one, and two
 * shapes fuse once the gap between them closes to twice that.
 *
 * The fillet union takes its radius directly, since that radius *is* the
 * visible size of the joint.
 */
const METABALL_BLEND_TO_K = 4

/**
 * A few folds of smin can stack their dips, so the grid is given headroom
 * beyond one bulge. Without it the contour would clip at the grid edge.
 * The fillet union never pushes a surface past its own fillet radius, so it
 * needs no headroom at all.
 */
const METABALL_BULGE_HEADROOM = 3

/** Below this diameter a shape is treated as not yet present. */
const MIN_LIVE_SIZE = 0.5

/**
 * Rasterise the smooth-union of every node into a scalar field.
 *
 * Each node only touches the cells it can actually influence, so cost scales
 * with total shape area rather than canvas area — a long stroke across a big
 * poster stays cheap.
 *
 * `blend` is the slider value, not the raw smin k.
 */
export function buildField(
  nodes: ShapeNode[],
  blend: number,
  cell: number,
  mode: BlendMode = 'fillet',
): ScalarField | null {
  if (nodes.length === 0 || cell <= 0) return null

  const metaball = mode === 'metaball'
  const amount = Math.max(0, blend)
  // The smin band, or the fillet radius — whichever this mode uses.
  const k = metaball ? amount * METABALL_BLEND_TO_K : amount
  const surfaceReach = metaball ? amount * METABALL_BULGE_HEADROOM : amount

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  // Mid-animation most shapes are still at zero. They contribute nothing to
  // the union, and a zero-size shape inside the fillet band would still add
  // material, so they are dropped rather than rasterised.
  const live = nodes.filter((n) => n.size >= MIN_LIVE_SIZE)
  if (live.length === 0) return null

  for (const n of live) {
    const reach = n.size / 2 + surfaceReach
    minX = Math.min(minX, n.pos.x - reach)
    minY = Math.min(minY, n.pos.y - reach)
    maxX = Math.max(maxX, n.pos.x + reach)
    maxY = Math.max(maxY, n.pos.y + reach)
  }

  // Two cells of padding guarantee a ring of positive samples, so every
  // contour closes inside the grid instead of running off the edge.
  const pad = cell * 3
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  const w = Math.max(2, Math.ceil((maxX - minX) / cell) + 1)
  const h = Math.max(2, Math.ceil((maxY - minY) / cell) + 1)

  // Guard against a pathological allocation if someone cranks size way up.
  if (w * h > 40_000_000) return null

  const data = new Float32Array(w * h).fill(FAR)

  // Once a cell is this far inside, nothing another node can do will bring it
  // back to the zero crossing — both unions only ever decrease the field, and
  // a cell this deep cannot share a grid edge with the contour. Skipping them
  // cuts most of the work out of heavily overlapping strokes.
  const deepInside = -(k + cell * 4)

  for (const node of live) {
    // A node still shifts the result anywhere its own distance comes within k
    // of the running field, which is further out than the contour itself.
    const reach = node.size / 2 + k + cell * 3
    const i0 = Math.max(0, Math.floor((node.pos.x - reach - minX) / cell))
    const i1 = Math.min(w - 1, Math.ceil((node.pos.x + reach - minX) / cell))
    const j0 = Math.max(0, Math.floor((node.pos.y - reach - minY) / cell))
    const j1 = Math.min(h - 1, Math.ceil((node.pos.y + reach - minY) / cell))

    const { x: cx, y: cy } = node.pos
    const isCircle = node.shape === 'circle'
    const radius = node.size / 2

    for (let j = j0; j <= j1; j++) {
      const py = minY + j * cell
      const row = j * w
      const dy = py - cy
      const dy2 = dy * dy

      for (let i = i0; i <= i1; i++) {
        const idx = row + i
        const current = data[idx]
        if (current < deepInside) continue

        const px = minX + i * cell
        // The circle case is the hot path; inlining it avoids a call and
        // Math.hypot's overflow guard, neither of which earns its cost here.
        const d = isCircle
          ? Math.sqrt((px - cx) * (px - cx) + dy2) - radius
          : shapeSdf(px, py, cx, cy, node.size, node.shape, node.cornerRadius, node.angle)

        data[idx] = metaball ? smin(current, d, k) : roundUnion(current, d, k)
      }
    }
  }

  // Belt and braces: keep the border strictly outside.
  for (let i = 0; i < w; i++) {
    data[i] = FAR
    data[(h - 1) * w + i] = FAR
  }
  for (let j = 0; j < h; j++) {
    data[j * w] = FAR
    data[j * w + w - 1] = FAR
  }

  return { data, w, h, x0: minX, y0: minY, cell }
}
