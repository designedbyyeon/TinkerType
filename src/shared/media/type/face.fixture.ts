import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as opentype from 'opentype.js'
import type { FaceId } from './faces'
import { applyAxes, type Face } from './measure'

/**
 * The real shipped faces, read straight off disk.
 *
 * The geometry is only as trustworthy as the outlines it runs on, so the tests
 * use the actual fonts rather than a synthetic stand-in. A stub square would pass
 * every test here and tell us nothing about whether a tittle gets its own gate.
 */
const dir = fileURLToPath(new URL('./fonts/', import.meta.url))

const FILES: Record<FaceId, string> = {
  bigshoulders: 'BigShoulders.ttf',
  kumbhsans: 'KumbhSans.ttf',
  poppins: 'PoppinsBlack.ttf',
  gothica1: 'GothicA1Black.ttf',
  unjamo: 'UnJamoDotum.ttf',
}

const cache = new Map<FaceId, Face>()

export function testFace(id: FaceId = 'bigshoulders'): Face {
  let face = cache.get(id)
  if (!face) {
    const b = readFileSync(dir + FILES[id])
    const buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    face = { id, font: opentype.parse(buffer) }
    cache.set(id, face)
  }
  return face
}

/**
 * Put the face on its axes and return the font size that draws `size` px of
 * letter.
 *
 * **This moves the shared font**, because that is what `applyAxes` does — the
 * axes are state on the parsed font. Call it immediately before laying out, once,
 * and never twice with different weights expecting both to hold: the second call
 * wins and the first measurement is left describing a font that no longer exists.
 */
export function testFontSize(face: Face, size: number, wght = 800, wdth = 100): number {
  return size / applyAxes(face, { wght, wdth })
}
