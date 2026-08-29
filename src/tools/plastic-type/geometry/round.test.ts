import { describe, expect, it } from 'vitest'
import { testFace } from '../../../shared/media/type/face.fixture'
import { bboxOf, flattenCommands, groupPieces, type Seg } from './glyphs'
import { applyAxes } from './layout'
import { roundCorners } from './round'

/** Screen coordinates, y down: this traversal is clockwise. */
const square = (size: number): Seg[] => [
  { type: 'M', x: 0, y: 0 },
  { type: 'L', x: size, y: 0 },
  { type: 'L', x: size, y: size },
  { type: 'L', x: 0, y: size },
  { type: 'Z' },
]

const points = (commands: Seg[], tolerance = 0.02) =>
  flattenCommands(commands, tolerance)[0].points

const perimeter = (pts: { x: number; y: number }[]) => {
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

describe('rounding a square', () => {
  const size = 100
  const radius = 20

  it('leaves the outline alone at radius zero', () => {
    expect(roundCorners(square(size), 0)).toEqual(square(size))
  })

  it('keeps the same overall size', () => {
    // A fillet cuts the corner off; it never pushes past the original edges.
    const box = bboxOf(points(roundCorners(square(size), radius)))
    expect(box.x).toBeCloseTo(0, 1)
    expect(box.y).toBeCloseTo(0, 1)
    expect(box.width).toBeCloseTo(size, 1)
    expect(box.height).toBeCloseTo(size, 1)
  })

  it('shortens the outline, by the amount the corners cost', () => {
    const sharp = perimeter(points(square(size)))
    const round = perimeter(points(roundCorners(square(size), radius)))
    // Four right-angle corners: each trades 2r of straight for a quarter arc.
    const expected = sharp - 4 * (2 * radius - (Math.PI * radius) / 2)
    expect(round).toBeCloseTo(expected, 0)
  })

  it('puts every corner point at the fillet radius from its centre', () => {
    const pts = points(roundCorners(square(size), radius))
    const centre = { x: radius, y: radius } // the top-left corner's fillet
    const onArc = pts.filter((p) => p.x < radius && p.y < radius)
    expect(onArc.length).toBeGreaterThan(3)
    for (const p of onArc) {
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeCloseTo(radius, 1)
    }
  })

  it('stays inside the sharp original', () => {
    for (const p of points(roundCorners(square(size), radius))) {
      expect(p.x).toBeGreaterThanOrEqual(-0.05)
      expect(p.y).toBeGreaterThanOrEqual(-0.05)
      expect(p.x).toBeLessThanOrEqual(size + 0.05)
      expect(p.y).toBeLessThanOrEqual(size + 0.05)
    }
  })

  it('never lets two fillets on one edge cross', () => {
    // A radius far larger than the shape. The corners each get clamped to under
    // half the edge, so the outline stays a simple loop rather than folding over.
    const pts = points(roundCorners(square(size), size * 4))
    const box = bboxOf(pts)
    expect(box.width).toBeGreaterThan(size * 0.9)
    expect(box.width).toBeLessThanOrEqual(size + 0.05)
    // Still one closed loop of sane length.
    expect(perimeter(pts)).toBeGreaterThan(size * 2)
    expect(perimeter(pts)).toBeLessThan(size * 4)
  })
})

describe('what it leaves alone', () => {
  it('ignores a junction the typeface drew smooth', () => {
    // Two quadratics meeting tangentially: a curve continuing, not a corner.
    const smooth: Seg[] = [
      { type: 'M', x: 0, y: 0 },
      { type: 'Q', x1: 50, y1: 0, x: 100, y: 0 },
      { type: 'Q', x1: 150, y1: 0, x: 200, y: 0 },
      { type: 'L', x: 200, y: 40 },
      { type: 'L', x: 0, y: 40 },
      { type: 'Z' },
    ]
    const rounded = roundCorners(smooth, 6)
    // The two corners at the bottom get rounded; the tangent join does not add
    // an arc of its own, so the top edge keeps its two original curves.
    const quads = rounded.filter((c) => c.type === 'Q').length
    expect(quads).toBe(2)
  })
})

describe('rounding real letters', () => {
  const face = testFace('bigshoulders')

  function glyph(char: string, radius: number) {
    applyAxes(face, { wght: 900, wdth: 70 })
    const raw = face.font.charToGlyph(char).getPath(0, 0, 1000, undefined, face.font)
      .commands as Seg[]
    return groupPieces(flattenCommands(roundCorners(raw, radius), 0.4))
  }

  it('keeps the piece and hole structure intact', () => {
    // Rounding must not merge a counter into its ring or split a solid.
    const sharpO = glyph('O', 0)
    const roundO = glyph('O', 24)
    expect(roundO).toHaveLength(sharpO.length)
    expect(roundO[0].contours.filter((c) => c.kind === 'hole')).toHaveLength(1)

    expect(glyph('i', 24)).toHaveLength(2)
    expect(glyph('B', 24)[0].contours.filter((c) => c.kind === 'hole')).toHaveLength(2)
  })

  it('blunts the sharp corners of a K', () => {
    const sharpest = (radius: number) => {
      const pts = glyph('K', radius)[0].contours[0].points
      let worst = 0
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i - 1 + pts.length) % pts.length]
        const b = pts[i]
        const c = pts[(i + 1) % pts.length]
        const u = { x: b.x - a.x, y: b.y - a.y }
        const v = { x: c.x - b.x, y: c.y - b.y }
        const lu = Math.hypot(u.x, u.y)
        const lv = Math.hypot(v.x, v.y)
        if (lu < 1 || lv < 1) continue
        const dot = (u.x * v.x + u.y * v.y) / (lu * lv)
        worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, dot))))
      }
      return (worst * 180) / Math.PI
    }

    // A sharp K has corners turning through most of a half-circle. Rounded, no
    // single step in the outline turns anywhere near as hard.
    expect(sharpest(0)).toBeGreaterThan(60)
    expect(sharpest(28)).toBeLessThan(sharpest(0) / 2)
  })

  it('shrinks the letter slightly, and never grows it', () => {
    const box = (radius: number) => bboxOf(glyph('K', radius)[0].contours[0].points)
    const sharp = box(0)
    const round = box(28)
    expect(round.width).toBeLessThanOrEqual(sharp.width + 0.1)
    expect(round.height).toBeLessThanOrEqual(sharp.height + 0.1)
    // But still recognisably the same letter, not a blob.
    expect(round.width).toBeGreaterThan(sharp.width * 0.92)
    expect(round.height).toBeGreaterThan(sharp.height * 0.92)
  })

  it('hands back curves, not a polygon', () => {
    const rounded = roundCorners(
      face.font.charToGlyph('K').getPath(0, 0, 1000, undefined, face.font).commands as Seg[],
      24,
    )
    // Fillets come back as cubics, and the letter's own quadratics survive.
    expect(rounded.some((c) => c.type === 'C')).toBe(true)
    expect(rounded.filter((c) => c.type === 'L').length).toBeGreaterThan(0)
  })

  it('never invents a part, on any face', () => {
    /*
     * Rounding may merge — a radius wide enough closes a thin gap, and that is
     * what a real cutter would do. What it must never do is split one part into
     * two, because every part carries a gate and an invented one would be a gate
     * to nothing.
     */
    for (const id of ['bigshoulders', 'kumbhsans', 'poppins'] as const) {
      const f = testFace(id)
      applyAxes(f, { wght: 900, wdth: 70 })
      for (const char of 'KIOSABi%') {
        const raw = f.font.charToGlyph(char).getPath(0, 0, 1000, undefined, f.font).commands as Seg[]
        const sharp = groupPieces(flattenCommands(raw, 0.4))
        const round = groupPieces(flattenCommands(roundCorners(raw, 22), 0.4))
        expect(round.length, `${id} ${char}`).toBeLessThanOrEqual(sharp.length)
        expect(round.length, `${id} ${char}`).toBeGreaterThan(0)
      }
    }
  })

  it('leaves the letters alone at a radius of zero, on every face', () => {
    for (const id of ['bigshoulders', 'kumbhsans', 'poppins'] as const) {
      const f = testFace(id)
      applyAxes(f, { wght: 900, wdth: 70 })
      const raw = f.font.charToGlyph('K').getPath(0, 0, 1000, undefined, f.font).commands as Seg[]
      expect(roundCorners(raw, 0)).toEqual(raw)
    }
  })
})
