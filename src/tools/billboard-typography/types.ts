import type { Style } from './geometry/types'

/**
 * The document.
 *
 * Deliberately small. Everything about *where* a sign goes lives in
 * `geometry/`, so this is the line, the four dials that feed the layout, and the
 * handful that decide how the model is lit and dressed.
 *
 * **There is no camera in here.** The composition is the tool — a view that can
 * be moved is a view that can be moved wrong, and the whole arrangement is built
 * around one angle.
 */
export interface BillboardDoc {
  text: string
  background: string

  /** The layout's own inputs. */
  seed: number
  /** Tidy at 0, a street at 1. */
  order: number
  /** Air around a word inside its board. */
  pad: number
  /** Proportions, as multipliers on what the line asked for. */
  width: number
  height: number
  /** The side wall's depth, as a share of the front wall. */
  girth: number
  /** Multiplies every board's standoff. */
  depth: number
  /** Degrees off dead-on. Feeds the arrangement, not only the view. */
  azimuth: number

  /** Contact occlusion, which is where the depth in the reference reads from. */
  occlusion: number
  /** The sun. A hint, not a key — see the note in `render/build.ts`. */
  key: number
  /** Air conditioners, windows, drainpipes, awnings. */
  detail: number
  /** Chamfer on every edge. Where the light catches. */
  bevel: number

  /** One colour for every sign, and one for the building. */
  sign: string
  wall: string
}

export const styleOf = (doc: BillboardDoc): Style => ({
  seed: doc.seed,
  order: doc.order,
  pad: doc.pad,
  width: doc.width,
  height: doc.height,
  girth: doc.girth,
  depth: doc.depth,
  azimuth: doc.azimuth,
  sign: doc.sign,
})
