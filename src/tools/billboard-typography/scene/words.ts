import { drawGlyph, type Parsed } from '../../../shared/media/type/measure'
import type { MeasuredWord } from '../geometry/types'
import { signUnit } from '../../../shared/media/type/hangul/face'

/**
 * A line of text, measured into words the layout engine can pack.
 *
 * The bridge, and the only place the font and the geometry meet. Everything is
 * normalised to **cap height 1** — the reference syllable's drawn height — so the
 * engine works in one unit and a change of face does not move the building.
 *
 * Advances are kept per character, not just per word, because a vertical blade
 * needs to know how wide its widest single syllable is and a horizontal board
 * needs to step from one letter to the next.
 */
export function wordsOf(face: Parsed, line: string): MeasuredWord[] {
  const size = 1 / Math.max(0.1, signUnit(face))
  return line
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((text) => {
      const advances: number[] = []
      let top = -Infinity
      let bottom = Infinity
      for (const char of text) {
        const drawn = drawGlyph(face, char, 0, size)
        advances.push(drawn.advance)
        // The bbox arrives in the font's y-down frame, the same one `glyphShapes`
        // flips. Flip it here too, so both halves agree about which way is up.
        top = Math.max(top, -drawn.bbox.y)
        bottom = Math.min(bottom, -(drawn.bbox.y + drawn.bbox.height))
      }
      return {
        text,
        advances,
        width: advances.reduce((sum, a) => sum + a, 0),
        top: Number.isFinite(top) ? top : 1,
        bottom: Number.isFinite(bottom) ? bottom : 0,
      }
    })
}
