import { describe, expect, it } from 'vitest'
import { testFace } from '../../../shared/media/type/face.fixture'
import { drawGlyph, type Parsed } from '../../../shared/media/type/measure'
import { signFace } from './signFace.fixture'
import { countContours, shapesOfGlyph } from './glyphShapes'

const outline = (face: Parsed, char: string) => drawGlyph(face, char, 0, 100).commands

describe('a glyph as three shapes', () => {
  it('punches the counters out rather than filling them', () => {
    /*
     * The whole risk of the pipeline in one test. Get the hole test wrong and
     * every O, every ㅁ, every ㅇ comes out as a solid lozenge — which is
     * precisely how tool 02 failed once, from the other end.
     *
     * Latin first, because the expected counts are unarguable.
     */
    const face = testFace('bigshoulders')
    for (const [char, holes] of [
      ['O', 1],
      ['A', 1],
      ['B', 2],
      ['H', 0],
      ['I', 0],
    ] as const) {
      const shapes = shapesOfGlyph(outline(face, char))
      expect(shapes.length, char).toBeGreaterThan(0)
      const total = shapes.reduce((n, s) => n + s.holes.length, 0)
      expect(total, char).toBe(holes)
    }
  })

  it('does the same for Hangul, where a syllable is several solids', () => {
    /*
     * A syllable is not one shape and must not be forced into one: the jamo are
     * separate strokes, so several solids on the same sign is the correct answer.
     * And the ones with an enclosed counter have to keep it — ㅇ and ㅁ are the
     * Hangul equivalent of the O.
     */
    const face = signFace()
    const ring = shapesOfGlyph(outline(face, '이'))
    expect(ring.length).toBeGreaterThanOrEqual(2)
    expect(ring.reduce((n, s) => n + s.holes.length, 0)).toBeGreaterThanOrEqual(1)

    const box = countContours(outline(face, '몸'))
    expect(box.solids).toBeGreaterThan(0)
    expect(box.holes).toBeGreaterThanOrEqual(2)
  })

  it('reads winding-agnostically, so a flipped axis cannot invert it', () => {
    /*
     * Containment parity rather than the sign of the area. The sign is the
     * obvious test and it is wrong twice: the convention differs between
     * TrueType and CFF, and negating y to get into three's coordinates reverses
     * it anyway. Same counts across faces of different origin is the evidence.
     */
    for (const id of ['bigshoulders', 'kumbhsans', 'poppins'] as const) {
      const face = testFace(id)
      expect(countContours(outline(face, 'O')), id).toEqual({ solids: 1, holes: 1 })
    }
  })

  it('keeps the curves, and does not hand back a polygon', () => {
    /*
     * If this ever flattens, the lettering stops being resolution independent and
     * the export goes grainy at poster size.
     *
     * The test is not "no straight segments" — an O has plenty, and `closePath`
     * adds one. And an absolute cap on the curve count would only be measuring
     * how ornate the typeface is. What it measures instead is the **ratio to the
     * source commands**: one curve per command means the outline went through, and
     * a flattener sampling each curve would multiply it several times over.
     */
    for (const [id, chars] of [
      ['bigshoulders', ['O', 'S', 'B']],
      ['blackhansans', ['간', '이', '몸']],
    ] as const) {
      const face = id === 'blackhansans' ? signFace() : testFace(id)
      for (const char of chars) {
        const commands = outline(face, char)
        const shapes = shapesOfGlyph(commands)
        const curves = shapes.reduce(
          (n, s) => n + s.curves.length + s.holes.reduce((m, h) => m + h.curves.length, 0),
          0,
        )
        const drawn = commands.filter((c) => c.type !== 'M' && c.type !== 'Z').length
        const sourceCurves = commands.filter((c) => c.type === 'Q' || c.type === 'C').length
        const outCurves = shapes.reduce(
          (n, s) =>
            n +
            s.curves.filter((c) => c.type.includes('Bezier')).length +
            s.holes.reduce((m, h) => m + h.curves.filter((c) => c.type.includes('Bezier')).length, 0),
          0,
        )

        // Every curve in the font becomes a curve here — none is sampled away.
        // Some glyphs have none at all: Black Han Sans draws 몸 entirely straight,
        // which is a fact about the typeface, not a failure of this.
        expect(outCurves, `${id} ${char} curves`).toBe(sourceCurves)
        // And no extras: a flattener would multiply the total several times over.
        // The slack is the closing segment each contour gains.
        expect(curves, `${id} ${char} total`).toBeLessThanOrEqual(drawn + shapes.length * 4 + 8)
      }
    }
  })

  it('has nothing to say about an empty outline', () => {
    expect(shapesOfGlyph([])).toEqual([])
    expect(countContours([])).toEqual({ solids: 0, holes: 0 })
  })
})
