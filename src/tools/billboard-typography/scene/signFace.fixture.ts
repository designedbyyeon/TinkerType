import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as opentype from 'opentype.js'
import type { Parsed } from '../../../shared/media/type/measure'

/**
 * The tool's own font, read straight off disk for the tests.
 *
 * The font itself is now in `shared/media/type/hangul/` — tool 05 draws with it
 * too. This reader stays here because tool 03's tests are still its only caller;
 * it moves beside the font the day a second suite wants it.
 *
 * It is **not** in `shared/media/type/face.fixture.ts` with the Latin three, and
 * must not be: that fixture is reachable from the shipped registry, and a font
 * read from there ships. See `hangul/face.ts`.
 */
const file = fileURLToPath(
  new URL('../../../shared/media/type/hangul/fonts/ChosunBg.ttf', import.meta.url),
)

let cached: Parsed | null = null

export function signFace(): Parsed {
  if (!cached) {
    const b = readFileSync(file)
    const buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    cached = { font: opentype.parse(buffer) }
  }
  return cached
}
