import { drawGlyph, outlineData, type Parsed } from '../../../shared/media/type/measure'
import type { Rect } from '../../../shared/geometry/vec'

/**
 * Outlines, pulled once.
 *
 * The em size everything is extracted at. A glyph is measured and converted to
 * path data exactly once per character, and every size it is ever drawn at is a
 * `transform` on that one path — which is tool 04's rule arriving in a second
 * tool: **the `d` attribute is never touched per frame.** Here the playhead runs
 * at sixty frames a second over a grid of syllables and the wheels turn under a
 * dragging hand; re-serialising outlines for either would be work for nothing.
 */
const EM = 1000

export interface Glyph {
  /** Path data at `EM`, in the face's own curves. */
  d: string
  /** Where it sits at `EM`, so a caller can centre or baseline it. */
  bbox: Rect
  /** Advance at `EM`, for setting a run. */
  advance: number
}

const cache = new Map<string, Glyph>()

/**
 * One character's outline. Empty `d` for a character the face has no glyph for,
 * which the stage reports rather than drawing a blank.
 *
 * Keyed on the character alone: this face is a static cut with no axes, so there
 * is nothing else that could change what comes out. A variable face would need
 * the axes in the key — see the note in `measure.ts` about `applyAxes`.
 */
export function glyphOf(face: Parsed, char: string): Glyph {
  const hit = cache.get(char)
  if (hit) return hit

  const drawn = drawGlyph(face, char, 0, EM)
  const glyph: Glyph = {
    d: outlineData(drawn.commands),
    bbox: drawn.bbox,
    advance: drawn.advance,
  }
  cache.set(char, glyph)
  return glyph
}

/**
 * The transform that draws `glyph` on (cx, cy) at font size `em`, turned by
 * `angle` radians about that point.
 *
 * **Scaled by the em and centred on the ink**, and both halves of that are load
 * bearing.
 *
 * Scaled by the em, because a jamo is designed inside an em square and its
 * relative size is part of the design: ㅁ is a square, ㅡ is a thin bar, ㅜ is a
 * bar with a stem. An earlier version scaled each glyph to a wanted *ink height*,
 * which is right for a line of Latin caps and catastrophic here — ㅡ has almost no
 * ink height, so meeting a 26px one blew its width out to 260px and it came out as
 * a grey slash across the platter. The letters have to keep their proportions to
 * each other or the wheel is not showing the alphabet.
 *
 * Centred on the ink, because a rim slot is a place on a circle rather than a
 * position in a syllable. ㅗ sits high in its em and ㅜ low, which is exactly right
 * when they are stacked under an initial and wrong when they are beads on a wheel.
 *
 * A matrix rather than a scale-and-translate string so the rotation composes
 * without a second group: the rim jamo ride the disc and tilt with it, which is
 * one rotation per letter per frame.
 */
export function placed(glyph: Glyph, cx: number, cy: number, em: number, angle = 0): string {
  const box = glyph.bbox
  const k = em / EM
  const dx = -(box.x + box.width / 2) * k
  const dy = -(box.y + box.height / 2) * k
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Rotate about (cx, cy), then place the glyph's own centre at the origin.
  return `matrix(${cos * k} ${sin * k} ${-sin * k} ${cos * k} ${
    cx + cos * dx - sin * dy
  } ${cy + sin * dx + cos * dy})`
}

/** Drawn height of a character at size 1. What a `Size` in px is measured against. */
export function heightOf(face: Parsed, char: string): number {
  const h = glyphOf(face, char).bbox.height / EM
  return h > 0 ? h : 0.7
}

/** How big a glyph actually comes out at a given em. For aligning large type. */
export function drawnSize(glyph: Glyph, em: number): { width: number; height: number } {
  const k = em / EM
  return { width: glyph.bbox.width * k, height: glyph.bbox.height * k }
}

/**
 * The font size at which the reference jamo draws `height` px tall.
 *
 * The one conversion between what the panel says and what the renderer does. Size
 * means the drawn height of **ㅁ** — a bare Latin cap would be the wrong ruler for
 * a wheel of jamo, and a full syllable stack the wrong one too, because what sits
 * on a rim is a single letter.
 */
export function emFor(face: Parsed, char: string, height: number): number {
  return height / heightOf(face, char)
}
