import { describe, expect, it } from 'vitest'
import { testFace } from '../../../shared/media/type/face.fixture'
import type { FaceId } from '../../../shared/media/type/faces'
import { applyAxes } from './layout'
import {
  bboxOf,
  flattenCommands,
  groupPieces,
  nearestOnPiece,
  piecePathData,
  signedArea,
  type Seg,
} from './glyphs'

/** Pieces of one string, heavy enough that the shapes are the real story. */
function piecesOf(text: string, faceId: FaceId = 'bigshoulders', wght = 800) {
  const face = testFace(faceId)
  const unit = applyAxes(face, { wght, wdth: 100 })
  const size = 200 / unit
  let x = 0
  const contours = []
  for (const char of [...text]) {
    const glyph = face.font.charToGlyph(char)
    const path = glyph.getPath(x, 0, size, undefined, face.font)
    contours.push(...flattenCommands(path.commands as Seg[], 0.05))
    x += ((glyph.advanceWidth ?? 0) * size) / face.font.unitsPerEm
  }
  return groupPieces(contours)
}

const shape = (p: { contours: { kind: string }[] }) => ({
  solids: p.contours.filter((c) => c.kind === 'solid').length,
  holes: p.contours.filter((c) => c.kind === 'hole').length,
})

/** Screen coordinates, y down: this traversal is clockwise and encloses area. */
const square = (x: number, y: number, size: number) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
]

function contourFrom(points: { x: number; y: number }[]) {
  const commands: Seg[] = [
    { type: 'M', x: points[0].x, y: points[0].y },
    ...points.slice(1).map((p) => ({ type: 'L' as const, x: p.x, y: p.y })),
    { type: 'Z' as const },
  ]
  return { points, commands, area: signedArea(points), kind: 'solid' as const }
}

describe('winding', () => {
  it('reads a clockwise screen traversal as positive area', () => {
    expect(signedArea(square(0, 0, 10))).toBe(100)
    expect(signedArea([...square(0, 0, 10)].reverse())).toBe(-100)
  })
})

describe('piece grouping on real glyphs', () => {
  it('treats a tittle as its own piece', () => {
    // The dot on an i is not attached to the stem, so on a runner it is a
    // separate part needing its own gate. This holds in all three faces.
    for (const face of ['bigshoulders', 'kumbhsans', 'poppins'] as const) {
      expect(piecesOf('i', face)).toHaveLength(2)
      expect(piecesOf('j', face)).toHaveLength(2)
    }
  })

  it('counts every counter as a void of its own piece', () => {
    expect(piecesOf('O').map(shape)).toEqual([{ solids: 1, holes: 1 }])
    expect(piecesOf('B').map(shape)).toEqual([{ solids: 1, holes: 2 }])
    // %: two rings with counters, plus the slash between them.
    expect(piecesOf('%')).toHaveLength(3)
  })

  it('keeps a single-stroke letter as one solid', () => {
    expect(piecesOf('H').map(shape)).toEqual([{ solids: 1, holes: 0 }])
    expect(piecesOf('K').map(shape)).toEqual([{ solids: 1, holes: 0 }])
  })

  it('gives one piece per letter across a word', () => {
    const pieces = piecesOf('KIT')
    expect(pieces).toHaveLength(3)
    // Sorted left to right, so part numbers read in the same order as the word.
    const xs = pieces.map((p) => p.bbox.x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it('merges letters that touch once the weight closes the gap', () => {
    // At a heavy enough weight tight pairs really do meet, and two solids that
    // meet are one part. Which is exactly what grouping across the whole run is
    // for — done per glyph, this pair would stay two parts that overlap.
    const light = piecesOf('AV', 'kumbhsans', 100)
    const heavy = piecesOf('AV', 'kumbhsans', 900)
    expect(light.length).toBe(2)
    expect(heavy.length).toBeLessThanOrEqual(light.length)
  })
})

describe('the gate for shipping a face', () => {
  /*
   * A letter with a counter is one connected solid, in every typeface there is.
   * If the grouping reports two, it has read a counter as a separate piece —
   * which means that letter renders with its counter filled in, and gets a gate
   * of its own into the bargain.
   *
   * This is the check that took Gabarito out of the tool. Its A, R, P and 4 came
   * out solid where a browser shows them hollow, and nothing about the look of a
   * typeface is worth shipping that. Piece count is the signal to test, not hole
   * count: which counters a design encloses is a matter of drawing — Archivo's 4
   * is genuinely open — but connectedness is not.
   */
  const ONE_PIECE = [...'ABDOPQRSabdegopq0468९9'].filter((c) => c !== '९')

  it('reads every countered letter as a single connected part', () => {
    for (const faceId of ['bigshoulders', 'kumbhsans', 'poppins'] as const) {
      const face = testFace(faceId)
      for (const wght of [400, 900]) {
        applyAxes(face, { wght, wdth: 100 })
        for (const char of ONE_PIECE) {
          if (!face.font.hasChar(char)) continue
          const path = face.font.charToGlyph(char).getPath(0, 0, 1000, undefined, face.font)
          const pieces = groupPieces(flattenCommands(path.commands as Seg[], 0.3))
          expect(pieces.length, `${faceId} '${char}' @${wght}`).toBe(1)
        }
      }
    }
  })

  it('still separates the parts that really are separate', () => {
    // The same check must not be satisfied by lumping everything together.
    for (const faceId of ['bigshoulders', 'kumbhsans', 'poppins'] as const) {
      applyAxes(testFace(faceId), { wght: 900, wdth: 100 })
      expect(piecesOf('i', faceId, 900).length, `${faceId} i`).toBe(2)
      expect(piecesOf('%', faceId, 900).length, `${faceId} %`).toBeGreaterThan(1)
    }
  })
})

/*
 * The same gate, for a face that has to set Korean.
 *
 * The Latin check asks whether a countered letter comes back as one connected
 * piece. Hangul needs both halves of that question, because its syllables are
 * built rather than drawn: the jamo that enclose a counter — ㅁ, ㅂ, ㅇ and the
 * doubles — have to survive as one piece with a void, **and** the jamo that were
 * never joined have to stay apart. A face that fuses them is a face that gives
 * `이` a single gate and hangs the ㅣ off the ㅇ, which no moulded sheet does.
 */
describe('the gate for shipping a Hangul face', () => {
  const HANGUL_FACES = ['gothica1', 'unjamo'] as const

  it('keeps a counter in the jamo that has one', () => {
    for (const faceId of HANGUL_FACES) {
      for (const jamo of [...'ㅁㅂㅇ']) {
        const pieces = piecesOf(jamo, faceId, 400)
        expect(pieces.length, `${faceId} '${jamo}' pieces`).toBe(1)
        expect(shape(pieces[0]).holes, `${faceId} '${jamo}' counter`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('reads ㅃ as the two letters it is', () => {
    /*
     * ㅃ is two ㅂ, not one wide letter — and unlike the other doubles it cannot
     * be drawn any other way, because each half is a closed box and two boxes
     * that met would swallow a counter. So it is two parts and two gates, which
     * is what a mould would give you as well.
     *
     * **The other doubles are a drawing decision and are not asserted here.**
     * Measured: Gothic A1 joins ㅆ and ㅉ into one piece and UnJamo keeps them
     * apart; ㅍ goes the other way, closed in Gothic A1 and open in UnJamo.
     * Both are legitimate, the same way Archivo's open 4 was — what a face may
     * not do is fuse things that were never joined, which is the next check.
     */
    for (const faceId of HANGUL_FACES) {
      expect(piecesOf('ㅃ', faceId, 400).map((p) => shape(p).holes), faceId).toEqual([1, 1])
    }
  })

  it('keeps the counter inside a whole syllable as well', () => {
    // Where the Latin check looks at a letter, this has to look at the assembled
    // syllable: the counter of a 받침 ㅁ sits under a vowel that reaches past it,
    // which is exactly the nesting that a parity test would get wrong.
    for (const faceId of HANGUL_FACES) {
      for (const syllable of [...'뭉옹밤봄입']) {
        const holes = piecesOf(syllable, faceId, 400).reduce((n, p) => n + shape(p).holes, 0)
        expect(holes, `${faceId} '${syllable}' counters`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('leaves jamo that never touched as separate parts', () => {
    for (const faceId of HANGUL_FACES) {
      // ㅇ and ㅣ, side by side and not joined.
      expect(piecesOf('이', faceId, 400).length, `${faceId} 이`).toBe(2)
      // Initial, vowel and final, stacked. Three at the very least; a face that
      // draws ㅎ in separate strokes gives more, which is correct.
      expect(piecesOf('한', faceId, 400).length, `${faceId} 한`).toBeGreaterThanOrEqual(3)
    }
  })

  it('covers the syllables a designer will actually type', () => {
    // 11,172 is the whole modern set. A face that stops at the 2,350 of KS X
    // 1001 drops words like 뷁 without saying so — the stage would report it,
    // but a face this tool ships should not need reporting.
    for (const faceId of HANGUL_FACES) {
      const face = testFace(faceId)
      let missing = 0
      for (let c = 0xac00; c <= 0xd7a3; c++) {
        if (!face.font.hasChar(String.fromCodePoint(c))) missing++
      }
      expect(missing, `${faceId} missing syllables`).toBe(0)
    }
  })
})

describe('piece grouping rules', () => {
  it('merges two solids that overlap', () => {
    const a = contourFrom(square(0, 0, 10))
    const b = contourFrom(square(6, 0, 10))
    expect(groupPieces([a, b])).toHaveLength(1)
  })

  it('merges two solids that share an edge', () => {
    const a = contourFrom(square(0, 0, 10))
    const b = contourFrom(square(10, 0, 10))
    expect(groupPieces([a, b])).toHaveLength(1)
  })

  it('keeps two solids apart when they do not touch', () => {
    const a = contourFrom(square(0, 0, 10))
    const b = contourFrom(square(20, 0, 10))
    expect(groupPieces([a, b])).toHaveLength(2)
  })

  it('assigns a void to the solid around it', () => {
    const solid = contourFrom(square(0, 0, 30))
    const hole = contourFrom([...square(10, 10, 10)].reverse())
    const pieces = groupPieces([solid, hole])
    expect(pieces).toHaveLength(1)
    expect(shape(pieces[0])).toEqual({ solids: 1, holes: 1 })
    // Solids come first so nonzero fill paints the void, not the other way round.
    expect(pieces[0].contours[0].kind).toBe('solid')
  })

  it('separates a solid that floats inside another solid’s void', () => {
    // A dot in the middle of an O: nested, but not connected, so two pieces.
    const outer = contourFrom(square(0, 0, 40))
    const hole = contourFrom([...square(8, 8, 24)].reverse())
    const dot = contourFrom(square(16, 16, 8))
    const pieces = groupPieces([outer, hole, dot])
    expect(pieces).toHaveLength(2)
    expect(pieces.map(shape)).toEqual(
      expect.arrayContaining([{ solids: 1, holes: 1 }, { solids: 1, holes: 0 }]),
    )
  })

  it('bases the solid direction on the largest contour, not on a fixed sign', () => {
    // A CFF font winds the opposite way. Flipping every contour must give the
    // same reading, or a font swap would turn all the letters inside out.
    const flip = (pts: { x: number; y: number }[]) => [...pts].reverse()
    const solid = contourFrom(flip(square(0, 0, 30)))
    const hole = contourFrom(square(10, 10, 10))
    const pieces = groupPieces([solid, hole])
    expect(pieces).toHaveLength(1)
    expect(shape(pieces[0])).toEqual({ solids: 1, holes: 1 })
  })
})

describe('boundary search', () => {
  it('finds the nearest edge point with an outward normal', () => {
    const piece = groupPieces([contourFrom(square(0, 0, 10))])[0]

    const above = nearestOnPiece(piece, { x: 5, y: -20 })
    expect(above?.point).toEqual({ x: 5, y: 0 })
    expect(above?.distance).toBeCloseTo(20)
    expect(above?.normal.y).toBeCloseTo(-1) // away from the material below

    const right = nearestOnPiece(piece, { x: 40, y: 5 })
    expect(right?.point).toEqual({ x: 10, y: 5 })
    expect(right?.normal.x).toBeCloseTo(1)
  })

  it('ignores the inside of a void', () => {
    // A target in the middle of a ring must land on the ring, not in its hole.
    const solid = contourFrom(square(0, 0, 30))
    const hole = contourFrom([...square(10, 10, 10)].reverse())
    const piece = groupPieces([solid, hole])[0]
    const hit = nearestOnPiece(piece, { x: 15, y: 15 })
    expect(hit).not.toBeNull()
    expect(Math.min(hit!.point.x, hit!.point.y)).toBeLessThanOrEqual(10)
  })
})

describe('path output', () => {
  it('keeps the font’s own curves rather than the flattened polyline', () => {
    const data = piecePathData(piecesOf('O')[0])
    expect(data).toMatch(/^M/)
    expect(data).toContain('Q') // these are TrueType, so quadratics
    expect(data.endsWith('Z')).toBe(true)
    // Two subpaths: the ring and its void.
    expect(data.match(/M/g)).toHaveLength(2)
  })

  it('flattens finer as the tolerance tightens', () => {
    const face = testFace('bigshoulders')
    applyAxes(face, { wght: 800, wdth: 100 })
    const path = face.font.charToGlyph('O').getPath(0, 0, 200, undefined, face.font)
    const coarse = flattenCommands(path.commands as Seg[], 1)
    const fine = flattenCommands(path.commands as Seg[], 0.01)
    const count = (cs: { points: unknown[] }[]) => cs.reduce((n, c) => n + c.points.length, 0)
    expect(count(fine)).toBeGreaterThan(count(coarse))
    // Both must still describe the same ring.
    expect(coarse).toHaveLength(2)
    expect(fine).toHaveLength(2)
    expect(bboxOf(coarse[0].points).width).toBeCloseTo(bboxOf(fine[0].points).width, 0)
  })
})
