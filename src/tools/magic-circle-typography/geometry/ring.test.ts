import { describe, expect, it } from 'vitest'
import { apply, arcRun, GLYPH_EM, placeOnArc, type BandFace, type BandStyle } from './ring'
import type { Drawn } from '../../../shared/media/type/measure'

/**
 * Type on a circle, checked as arithmetic.
 *
 * The claim being tested is small and everything rests on it: a letter's feet
 * land **on** the band's radius, its baseline runs **along** the circle, and its
 * body stands on the side the band was asked for. Get any of the three wrong and
 * the ring still looks like a ring — leaning, or inside out, or a hair off the
 * rule it is supposed to sit against, which is the kind of wrong that is only
 * visible once it is printed.
 */

/** A stand-in glyph: one em wide, drawn as the unit square above the baseline. */
function box(advance = GLYPH_EM): Drawn {
  return {
    commands: [
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: advance, y: 0 },
      { type: 'L', x: advance, y: -GLYPH_EM },
      { type: 'L', x: 0, y: -GLYPH_EM },
      { type: 'Z' },
    ],
    advance,
    bbox: { x: 0, y: -GLYPH_EM, width: advance, height: GLYPH_EM },
  }
}

const style = (over: Partial<BandStyle> = {}): BandStyle => ({
  radius: 300,
  fontSize: 40,
  tracking: 0,
  start: 0,
  face: 'out',
  fill: 'natural',
  joiner: '·',
  reveal: 1,
  ...over,
})

describe('placing one glyph on an arc', () => {
  const R = 200

  it('puts the pen exactly on the radius, at every angle', () => {
    for (const deg of [0, 37, 90, 180, 271, 359]) {
      for (const face of ['out', 'in'] as BandFace[]) {
        const m = placeOnArc(deg, R, 0.04, face)
        const pen = apply(m, 0, 0)
        expect(Math.hypot(pen.x, pen.y)).toBeCloseTo(R, 6)
      }
    }
  })

  it('runs the baseline along the circle rather than across it', () => {
    for (const deg of [0, 37, 90, 180, 271]) {
      for (const face of ['out', 'in'] as BandFace[]) {
        const m = placeOnArc(deg, R, 0.04, face)
        const pen = apply(m, 0, 0)
        const along = apply(m, 1000, 0)
        // The baseline direction dotted with the radius direction is zero when
        // the two are perpendicular, which is what "tangent" means.
        const radial = { x: pen.x / R, y: pen.y / R }
        const step = { x: along.x - pen.x, y: along.y - pen.y }
        const length = Math.hypot(step.x, step.y)
        expect(Math.abs((step.x * radial.x + step.y * radial.y) / length)).toBeLessThan(1e-9)
      }
    }
  })

  it('stands the body outward for `out` and inward for `in`', () => {
    for (const deg of [0, 37, 90, 180, 271]) {
      const cap: Record<BandFace, number> = { out: 0, in: 0 }
      for (const face of ['out', 'in'] as BandFace[]) {
        const m = placeOnArc(deg, R, 0.04, face)
        // The top of a cap is at local y = -GLYPH_EM.
        const top = apply(m, 0, -GLYPH_EM)
        cap[face] = Math.hypot(top.x, top.y)
      }
      expect(cap.out).toBeGreaterThan(R)
      expect(cap.in).toBeLessThan(R)
      // Symmetric about the band: the same cap height either side of it.
      expect(cap.out - R).toBeCloseTo(R - cap.in, 6)
    }
  })

  it('reads the two faces in opposite directions round the middle', () => {
    // Which is the whole of the difference between running clockwise round the
    // outside and anticlockwise round the inside: the same advance, spent the
    // other way.
    const turn = (face: BandFace) => {
      const m = placeOnArc(30, R, 0.04, face)
      const pen = apply(m, 0, 0)
      const along = apply(m, 1000, 0)
      return Math.sign(pen.x * (along.y - pen.y) - pen.y * (along.x - pen.x))
    }
    expect(turn('out')).toBe(-turn('in'))
  })
})

describe('setting a line round a circle', () => {
  it('centres the run on `start`, not its first letter', () => {
    // The reason: a designer who sets a band to twelve o'clock means the phrase
    // is centred at the top. Anchoring the first letter slides the whole
    // composition every time a word is typed.
    const run = arcRun('ABCDE', () => box(), style({ start: 0 }))
    const first = apply(run.glyphs[0].matrix, 0, 0)
    const last = apply(run.glyphs[4].matrix, GLYPH_EM, 0)
    expect(first.x).toBeCloseTo(-last.x, 4)
    expect(first.y).toBeCloseTo(last.y, 4)
  })

  it('measures the sweep from the type’s own advances', () => {
    const r = 300
    const size = 40
    // Five ems at 40px is 200px of arc on a 300px circle.
    const run = arcRun('ABCDE', () => box(), style({ radius: r, fontSize: size }))
    expect(run.sweep).toBeCloseTo(((5 * size) / r) * (180 / Math.PI), 6)
    expect(run.laps).toBe(false)
  })

  it('opens the letterspacing until the line closes the circle', () => {
    const r = 300
    const run = arcRun('ABCD', () => box(), style({ radius: r, fill: 'ring' }))
    // Four letters and four gaps fill the turn, so the run itself is the
    // circumference less one gap — that gap being the one at the seam.
    const seam = (2 * Math.PI * r - 4 * 40) / 4
    expect(run.sweep).toBeCloseTo(((2 * Math.PI * r - seam) / r) * (180 / Math.PI), 4)
  })

  it('says so when the line is longer than the circle can hold', () => {
    const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    expect(arcRun(long, () => box(), style({ radius: 40, fill: 'ring' })).laps).toBe(true)
    expect(arcRun(long, () => box(), style({ radius: 40 })).laps).toBe(true)
    expect(arcRun('AB', () => box(), style({ radius: 400 })).laps).toBe(false)
  })

  it('writes the letters on in reading order and lands them all at full bloom', () => {
    const early = arcRun('ABCDEFGH', () => box(), style({ reveal: 0.35 }))
    for (let i = 1; i < early.glyphs.length; i++) {
      expect(early.glyphs[i].opacity).toBeLessThanOrEqual(early.glyphs[i - 1].opacity)
    }

    expect(arcRun('ABCDEFGH', () => box(), style({ reveal: 0 })).glyphs).toHaveLength(0)

    const full = arcRun('ABCDEFGH', () => box(), style({ reveal: 1 }))
    expect(full.glyphs).toHaveLength(8)
    for (const glyph of full.glyphs) {
      expect(glyph.opacity).toBe(1)
      // And every one of them is back on the band it belongs to — a letter left
      // a few pixels short of the rule is the whole point of checking. Measured
      // at the glyph's middle, which is the point that touches the circle; the
      // pen sits half an advance back along the chord and so a hair outside it.
      const middle = apply(glyph.matrix, GLYPH_EM / 2, 0)
      expect(Math.hypot(middle.x, middle.y)).toBeCloseTo(300, 6)
    }
  })

  it('turns each letter about its middle, not its pen', () => {
    // Rotating a wide glyph about its left edge tips it off the baseline. So the
    // pen of a placed letter sits *before* the point it was measured to.
    const run = arcRun('A', () => box(2000), style({ start: 0 }))
    const pen = apply(run.glyphs[0].matrix, 0, 0)
    const middle = apply(run.glyphs[0].matrix, 1000, 0)
    expect(pen.x).toBeLessThan(0)
    expect(middle.x).toBeCloseTo(0, 6)
  })
})
