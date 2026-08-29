import type { Shape } from 'three'
import { drawGlyph, type Parsed } from '../../../shared/media/type/measure'
import type { Sign } from '../geometry/signs'
import { signUnit } from '../../../shared/media/type/hangul/face'
import { shapesOfGlyph } from './glyphShapes'

/**
 * One glyph outline per character, cut once and reused across every board.
 *
 * Shared by the view and the export because they must not disagree: a file that
 * came out of a different pipeline than the picture is a file nobody can trust.
 * Everything is drawn at **cap height 1**, so a board's own `cap` is the only
 * scale applied downstream.
 */
export function glyphCacheFor(face: Parsed, signs: Sign[]): Map<string, Shape[]> {
  const size = 1 / Math.max(0.1, signUnit(face))
  const cache = new Map<string, Shape[]>()
  for (const sign of signs) {
    for (const letter of sign.letters) {
      if (cache.has(letter.char)) continue
      cache.set(letter.char, shapesOfGlyph(drawGlyph(face, letter.char, 0, size).commands))
    }
  }
  return cache
}
