import type { FaceId } from '../../shared/media/type/faces'
import type { BandFace, Fill } from './geometry/ring'
import { buildSigil, clampSkip, type Sigil } from './geometry/sigil'

export type { FaceId, BandFace, Fill }

/**
 * A captured frame.
 *
 * The pixels are **not** here — they sit in the shared bitmap registry and this
 * carries the key, for the reason written down beside that registry: undo
 * snapshots the whole document, and a data URI on the document would be copied
 * into all sixty steps.
 *
 * Not `DocImage`. That type comes with a scale, an offset and a filename, none
 * of which a camera frame has — it always covers the view, and it came from a
 * lens rather than from a file. Half-filled fields are a worse kind of reuse
 * than a second small type.
 */
export interface Frame {
  /** Key into the bitmap registry. */
  id: string
  width: number
  height: number
}

export type BandStyleChoice = 'out' | 'in' | 'alternate'

export interface MagicDoc {
  width: number
  height: number
  background: string
  /**
   * Whether the camera is shown the way a mirror would show it.
   *
   * On by default, and it is not a nicety: you are performing a gesture at your
   * own hand, and an unmirrored feed sends the plate left when you move right.
   * The capture is flipped with it, so the exported file is what you were
   * looking at.
   */
  mirror: boolean
  photo: Frame | null

  /** One line, one band. Outermost band first. */
  text: string
  face: FaceId
  wght: number
  /** Drawn cap height of the outermost line, px. */
  size: number
  /** What each line inward is worth against the one outside it. 1 = all equal. */
  taper: number
  /** Extra space between letters along the arc, px. */
  tracking: number
  /** How a line is fitted to its circle — see `Fill`. */
  fill: Fill
  /** Set between repeats when the fill is `repeat`. */
  joiner: string

  /** Middle of the plate, as a fraction of the frame — so a resize keeps it. */
  cx: number
  cy: number
  /** Outer radius at full bloom, px. */
  radius: number
  /** 0 a fist, 1 a flat hand. */
  bloom: number
  /** Degrees. */
  spin: number
  /**
   * Where each line's run is centred, degrees clockwise from twelve. Indexed by
   * line; a line past the end of the array sits at twelve.
   */
  angles: number[]
  /** Gutter between courses, px. */
  gap: number
  band: BandStyleChoice

  ink: string
  /** A disc under the plate for legibility over a photo. `none` for no disc. */
  plate: string
  plateOpacity: number
  /** 0..1 wash of the ground colour over the photo. */
  dim: number

  /** Line weight, px. Nothing reads it unless something below draws a line. */
  rule: number
  /** The double rule around the outside. */
  rim: boolean
  /** A hairline closing each band of type. */
  bandRules: boolean
  rings: number
  starPoints: number
  starSkip: number
  ticks: number
  spokes: number

  /** How many palm lengths the plate reaches. */
  reach: number
  followHand: boolean
  followSpin: boolean
}

/** One band per line, blanks dropped — a stray return should not draw a rule. */
export function linesOf(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

/**
 * The document, read as a plate.
 *
 * Here rather than beside the renderer because it is about the document: it is
 * the one place that says which document field means which part of the figure,
 * and the stage needs the answer for something other than drawing — it has to
 * ask how many lines did not fit.
 */
export function sigilFor(doc: MagicDoc): Sigil {
  return buildSigil({
    radius: doc.radius,
    bloom: doc.bloom,
    spin: doc.spin,
    angles: doc.angles,
    size: doc.size,
    taper: doc.taper,
    gap: doc.gap,
    lines: linesOf(doc.text),
    face: doc.band,
    rim: doc.rim,
    bandRules: doc.bandRules,
    ticks: doc.ticks,
    ringCount: doc.rings,
    starPoints: doc.starPoints,
    // Clamped here rather than on the way in, so the panel can show the raw
    // number a designer typed while the plate draws the figure that exists.
    starSkip: clampSkip(doc.starPoints, doc.starSkip),
    spokes: doc.spokes,
  })
}

/**
 * Does anything on this plate draw a line?
 *
 * Which decides whether the line-weight row means anything. Rule four: a control
 * that cannot change what is on screen is not shown at all.
 */
export function drawsRules(doc: MagicDoc): boolean {
  return doc.rim || doc.bandRules || doc.ticks > 0 || doc.rings > 0 || doc.starPoints >= 3 || doc.spokes > 0
}
