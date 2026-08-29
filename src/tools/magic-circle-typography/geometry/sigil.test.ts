import { describe, expect, it } from 'vitest'
import { buildSigil, clampSkip, revealAt, starCycles, type SigilInput } from './sigil'

/**
 * The plate, checked as arithmetic.
 *
 * The invariant that matters most is the one about **room**. Courses stack
 * inward from a rim the hand owns, so a long enough sentence will run out of
 * plate — and the failure has to be a dropped line that the tool says out loud,
 * never a band at a negative radius. A negative radius does not throw; it draws
 * the circle inside out and mirrors the type, which looks deliberate.
 */

/**
 * A plate with the furniture switched on, which is *not* the tool's default.
 *
 * Deliberately so: the layout has to be checked with every course present,
 * because that is when it runs out of room. The bare case the tool actually opens
 * on gets its own describe block below.
 */
const input = (over: Partial<SigilInput> = {}): SigilInput => ({
  radius: 300,
  bloom: 1,
  spin: 0,
  angles: [],
  size: 24,
  taper: 1,
  gap: 10,
  lines: ['ONE'],
  face: 'out',
  rim: true,
  bandRules: true,
  ticks: 60,
  ringCount: 2,
  starPoints: 5,
  starSkip: 2,
  spokes: 0,
  ...over,
})

describe('the plate', () => {
  it('never draws anything at or through the middle, however much text', () => {
    for (const count of [1, 2, 3, 5, 8, 14, 30]) {
      const lines = Array.from({ length: count }, (_, i) => `LINE ${i}`)
      for (const size of [12, 24, 60]) {
        const sigil = buildSigil(input({ lines, size }))
        for (const ring of sigil.rings) expect(ring.r).toBeGreaterThan(0)
        for (const band of sigil.bands) expect(band.radius).toBeGreaterThan(0)
        expect(sigil.core).toBeGreaterThanOrEqual(0)
        // What did not fit was counted rather than drawn.
        expect(sigil.bands.length + sigil.dropped).toBe(count)
      }
    }
  })

  it('keeps every band inside the rim, in the order they were typed', () => {
    const sigil = buildSigil(input({ lines: ['A', 'B', 'C'], radius: 400 }))
    expect(sigil.bands).toHaveLength(3)
    for (const band of sigil.bands) expect(band.radius).toBeLessThan(sigil.radius)
    // Outermost first: the first line typed is the outermost band.
    expect(sigil.bands[0].radius).toBeGreaterThan(sigil.bands[1].radius)
    expect(sigil.bands[1].radius).toBeGreaterThan(sigil.bands[2].radius)
  })

  it('gives a band the same ring whichever side its letters stand on', () => {
    // `out` puts the baseline a cap height lower so the caps reach the same
    // rule that `in` hangs from. Otherwise flipping the face would shift every
    // course below it, and the plate would reflow on a paint decision.
    const out = buildSigil(input({ lines: ['A', 'B'], face: 'out' }))
    const inward = buildSigil(input({ lines: ['A', 'B'], face: 'in' }))
    expect(out.core).toBeCloseTo(inward.core, 9)
    expect(out.rings.map((r) => r.r)).toEqual(inward.rings.map((r) => r.r))
  })

  it('alternates the faces band by band, and only then', () => {
    const alt = buildSigil(input({ lines: ['A', 'B', 'C'], face: 'alternate', radius: 400 }))
    expect(alt.bands.map((b) => b.face)).toEqual(['out', 'in', 'out'])
    const fixed = buildSigil(input({ lines: ['A', 'B', 'C'], face: 'in', radius: 400 }))
    expect(fixed.bands.map((b) => b.face)).toEqual(['in', 'in', 'in'])
  })

  it('draws nothing at a fist and everything at a flat hand', () => {
    const shut = buildSigil(input({ bloom: 0 }))
    for (const ring of shut.rings) expect(ring.reveal).toBe(0)
    for (const band of shut.bands) expect(band.reveal).toBe(0)
    expect(shut.star.reveal).toBe(0)

    const open = buildSigil(input({ bloom: 1, spokes: 6 }))
    for (const ring of open.rings) expect(ring.reveal).toBe(1)
    for (const band of open.bands) expect(band.reveal).toBe(1)
    expect(open.star.reveal).toBe(1)
    expect(open.spokes.reveal).toBe(1)
    // And nothing is left turned away from where it settles.
    expect(open.star.spin).toBeCloseTo(0, 9)
    for (const band of open.bands) expect(band.spin).toBeCloseTo(0, 9)
  })

  it('draws the rim before it writes the words, at every text length', () => {
    for (const count of [1, 3, 6]) {
      const lines = Array.from({ length: count }, (_, i) => `LINE ${i}`)
      for (const bloom of [0.2, 0.45, 0.7, 0.9]) {
        const sigil = buildSigil(input({ lines, bloom, radius: 500 }))
        const rim = sigil.rings[0].reveal
        for (const band of sigil.bands) expect(band.reveal).toBeLessThanOrEqual(rim + 1e-9)
        // And the middle lands last, which is the moment the spell closes.
        expect(sigil.star.reveal).toBeLessThanOrEqual(rim + 1e-9)
      }
    }
  })

  it('grows the plate as the hand opens, ending exactly on the asked radius', () => {
    let previous = 0
    for (const bloom of [0, 0.25, 0.5, 0.75, 1]) {
      const sigil = buildSigil(input({ radius: 300, bloom }))
      expect(sigil.radius).toBeGreaterThan(previous)
      previous = sigil.radius
    }
    expect(buildSigil(input({ radius: 300, bloom: 1 })).radius).toBeCloseTo(300, 9)
  })

  it('staggers the ticks only when five divides them', () => {
    const even = buildSigil(input({ ticks: 60 }))
    const lengths = (segments: typeof even.ticks.segments) =>
      new Set(
        segments.map((s) =>
          Math.round(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) * 1000) / 1000,
        ),
      )
    expect(lengths(even.ticks.segments).size).toBe(2)
    // A stagger that does not come out even leaves a stumble at twelve o'clock,
    // which reads as a mistake rather than as a scale — so it is not attempted.
    expect(lengths(buildSigil(input({ ticks: 37 })).ticks.segments).size).toBe(1)
  })
})

describe('the plate the tool actually opens on', () => {
  /** No rim, no rules, no furniture. Three lines and nothing else. */
  const bare = (over: Partial<SigilInput> = {}) =>
    buildSigil(
      input({
        rim: false,
        bandRules: false,
        ticks: 0,
        ringCount: 0,
        starPoints: 0,
        spokes: 0,
        lines: ['ONE', 'TWO', 'THREE'],
        ...over,
      }),
    )

  it('draws no line at all — the type is the whole plate', () => {
    const sigil = bare()
    expect(sigil.rings).toEqual([])
    expect(sigil.ticks.segments).toEqual([])
    expect(sigil.spokes.segments).toEqual([])
    expect(sigil.star.cycles).toEqual([])
    expect(sigil.bands).toHaveLength(3)
  })

  it('puts the first line at the rim rather than inset from nothing', () => {
    // With a rim there is something to hold the type off. Without one, an inset
    // is just a smaller plate — and the hand set that radius on purpose.
    const sigil = bare({ size: 40, taper: 1 })
    expect(sigil.bands[0].radius + sigil.bands[0].size).toBeCloseTo(sigil.radius, 9)
  })

  it('writes the lines in order and finishes exactly at full bloom', () => {
    for (const bloom of [0.15, 0.4, 0.65, 0.9]) {
      const bands = bare({ bloom }).bands
      expect(bands[0].reveal).toBeGreaterThanOrEqual(bands[1].reveal)
      expect(bands[1].reveal).toBeGreaterThanOrEqual(bands[2].reveal)
    }
    // The last of the hand's travel has to still be doing something — it is the
    // part of the gesture a designer feels most.
    expect(bare({ bloom: 0.95 }).bands[2].reveal).toBeLessThan(1)
    for (const band of bare({ bloom: 1 }).bands) expect(band.reveal).toBe(1)
  })
})

describe('the size taper', () => {
  it('steps each line down against the one outside it', () => {
    const sigil = buildSigil(input({ lines: ['A', 'B', 'C'], size: 40, taper: 0.8, radius: 500 }))
    expect(sigil.bands.map((b) => Math.round(b.size * 100) / 100)).toEqual([40, 32, 25.6])
  })

  it('sets every line the same at 1, and is what the layout reserves room for', () => {
    const flat = buildSigil(input({ lines: ['A', 'B', 'C'], size: 40, taper: 1, radius: 500 }))
    expect(flat.bands.map((b) => b.size)).toEqual([40, 40, 40])
    // A tapered plate leaves more room in the middle than a flat one, because the
    // inner bands are shorter — if it did not, the taper would only be cosmetic
    // and the lines would sit in bands cut for a bigger size.
    const tapered = buildSigil(
      input({ lines: ['A', 'B', 'C'], size: 40, taper: 0.7, radius: 500 }),
    )
    expect(tapered.core).toBeGreaterThan(flat.core)
  })

  it('cannot be pushed to nothing, or past equal', () => {
    expect(buildSigil(input({ lines: ['A', 'B'], taper: 4 })).bands[1].size).toBeCloseTo(
      buildSigil(input({ lines: ['A', 'B'], taper: 1 })).bands[1].size,
      9,
    )
    expect(buildSigil(input({ lines: ['A', 'B'], size: 40, taper: 0 })).bands[1].size).toBe(8)
  })
})

describe('descenders', () => {
  /**
   * The one that was found by measuring rather than by reading.
   *
   * At the tool's own defaults the tails of the second line met the caps of the
   * third at exactly the same radius — 197px in both cases. The band has to
   * reserve room below its baseline or a gutter of any size is a lie.
   */
  it('leaves room below the baseline, so a tail cannot reach the next line', () => {
    const sigil = buildSigil(
      input({ lines: ['A', 'B'], size: 46, taper: 1, gap: 0, rim: false, bandRules: false, ticks: 0 }),
    )
    const [first, second] = sigil.bands
    // `out` hangs its tails inward from the baseline.
    const tail = first.radius - first.size * 0.2
    const capsBelow = second.radius + second.size
    expect(tail).toBeGreaterThan(capsBelow)
  })

  it('spends the same room whichever side the letters stand on', () => {
    // Otherwise flipping one band's face reflows every course under it, and a
    // paint decision becomes a layout decision.
    const out = buildSigil(input({ lines: ['A', 'B', 'C'], face: 'out', radius: 500 }))
    const inward = buildSigil(input({ lines: ['A', 'B', 'C'], face: 'in', radius: 500 }))
    expect(out.core).toBeCloseTo(inward.core, 9)
  })

  it('keeps an `in` band inside its own course, tails and all', () => {
    const sigil = buildSigil(input({ lines: ['A', 'B'], face: 'in', size: 40, radius: 500 }))
    // `in` is the flipped box, so its tails reach outward — the baseline is inset
    // by that much rather than sitting on the band's outer edge.
    expect(sigil.bands[0].radius).toBeLessThan(sigil.radius)
  })
})

describe('placing each line', () => {
  it('centres each run where it was put', () => {
    const bands = buildSigil(
      input({ lines: ['A', 'B', 'C'], angles: [0, 0, 180], radius: 500, bloom: 1 }),
    ).bands
    expect(bands.map((b) => Math.round(b.spin))).toEqual([0, 0, 180])
  })

  it('sits a line with no angle of its own at twelve', () => {
    // The array is indexed by line and may be shorter than the text — a fourth
    // line typed into a three-angle document must not land at NaN degrees.
    const bands = buildSigil(
      input({ lines: ['A', 'B', 'C', 'D'], angles: [40], radius: 600, bloom: 1 }),
    ).bands
    expect(bands.map((b) => Math.round(b.spin))).toEqual([40, 0, 0, 0])
    expect(buildSigil(input({ lines: ['A'], angles: [] })).bands[0].spin).toBe(0)
  })

  it('rides on the plate\u2019s own spin rather than replacing it', () => {
    const bands = buildSigil(
      input({ lines: ['A', 'B'], spin: 30, angles: [0, 45], radius: 500, bloom: 1 }),
    ).bands
    expect(bands[0].spin).toBeCloseTo(30, 9)
    expect(bands[1].spin).toBeCloseTo(75, 9)
  })
})

describe('star polygons', () => {
  it('is one cycle when the skip is coprime with the count', () => {
    const cycles = starCycles(5, 2, 100)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toHaveLength(5)
  })

  it('splits into separate closed figures when they share a factor', () => {
    // A hexagram is two triangles, not one line that doubles back.
    const hexagram = starCycles(6, 2, 100)
    expect(hexagram).toHaveLength(2)
    expect(hexagram[0]).toHaveLength(3)
    // {9/3} is three triangles.
    expect(starCycles(9, 3, 100)).toHaveLength(3)
  })

  it('puts every point on the radius, first one at twelve o’clock', () => {
    for (const [p, q] of [
      [3, 1],
      [5, 2],
      [7, 3],
      [12, 5],
    ]) {
      const points = starCycles(p, q, 80).flat()
      expect(points).toHaveLength(p)
      for (const point of points) expect(Math.hypot(point.x, point.y)).toBeCloseTo(80, 9)
      expect(points[0].x).toBeCloseTo(0, 9)
      expect(points[0].y).toBeCloseTo(-80, 9)
    }
  })

  it('visits each point exactly once', () => {
    for (const [p, q] of [
      [8, 3],
      [12, 4],
      [10, 5],
    ]) {
      const cycles = starCycles(p, q, 50)
      expect(cycles.flat()).toHaveLength(p)
    }
  })

  it('refuses a skip that would retrace the same figure backwards', () => {
    // {5/3} is {5/2} drawn the other way round, and {5/5} is five coincident
    // points. Neither is a second star, so the range stops short of half.
    expect(clampSkip(5, 3)).toBe(2)
    expect(clampSkip(5, 9)).toBe(2)
    expect(clampSkip(6, 3)).toBe(2)
    expect(clampSkip(3, 1)).toBe(1)
    expect(clampSkip(4, 0)).toBe(1)
  })

  it('has nothing to draw below three points', () => {
    expect(starCycles(2, 1, 100)).toEqual([])
    expect(starCycles(0, 1, 100)).toEqual([])
  })
})

describe('reveal windows', () => {
  it('finishes the last course exactly at full bloom', () => {
    for (const count of [1, 2, 5, 9, 20]) {
      expect(revealAt(count - 1, count, 1)).toBe(1)
      expect(revealAt(0, count, 0)).toBe(0)
    }
  })

  it('never lets a later course get ahead of an earlier one', () => {
    for (const bloom of [0.1, 0.3, 0.5, 0.8, 0.95]) {
      for (let i = 1; i < 8; i++) {
        expect(revealAt(i, 8, bloom)).toBeLessThanOrEqual(revealAt(i - 1, 8, bloom))
      }
    }
  })
})
