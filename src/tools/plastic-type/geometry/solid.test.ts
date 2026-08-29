import { describe, expect, it } from 'vitest'
import { testFace, testFontSize } from '../../../shared/media/type/face.fixture'
import { pointInPolygon, signedArea } from '../../../shared/geometry/polygon'
import { layoutSheet, type LayoutStyle } from './layout'
import { planRunner, type RunnerStyle } from './runner'
import { depthsOf, frontOf, lumpsOf, roleOf, type Lump } from './solid'

/*
 * The flat plan, translated. What these check is not the picture — a renderer
 * makes that, and no assertion here can look at it — but that nothing on the
 * sheet is lost or gains material on the way into three dimensions. Both are
 * failures a screenshot hides: a missing gate looks like a design choice, and a
 * frame whose opening filled in looks like a slab someone meant to draw.
 */

const layout = (over: Partial<LayoutStyle> = {}): LayoutStyle => ({
  fontSize: testFontSize(testFace(), 150),
  tracking: 12,
  inset: 26,
  gap: 14,
  perRow: 0,
  uniformHeight: true,
  tolerance: 0.4,
  round: 9,
  ...over,
})

const runner = (over: Partial<RunnerStyle> = {}): RunnerStyle => ({
  bar: 12,
  spurRatio: 0.9,
  gateWidth: 13,
  neckWidth: 4.5,
  maxGate: 34,
  twoGateLength: 90,
  radius: 5,
  tab: true,
  bridges: true,
  lattice: true,
  ...over,
})

function sheet(text: string, l = layout(), r = runner()) {
  const plan = planRunner(layoutSheet(text, 'syllable', 'syllable', testFace(), l), r)
  return { plan, style: r, lumps: lumpsOf(plan, r) }
}

const solidsOf = (lump: Lump) => lump.rings.filter((ring) => !ring.hole)

describe('the three depths', () => {
  it('never lets a gate stand proud of the runner feeding it', () => {
    // The recess between frame and part is the whole reason a gate reads as the
    // thing to cut. Past its runner it would be a ridge instead.
    expect(depthsOf({ part: 34, runner: 22, gate: 40 }).gate).toBe(22)
    expect(depthsOf({ part: 34, runner: 22, gate: 11 }).gate).toBe(11)
  })

  it('has no negative material', () => {
    const d = depthsOf({ part: -10, runner: -4, gate: -2 })
    expect([d.part, d.runner, d.gate]).toEqual([0, 0, 0])
  })

  it('reports the front as the deepest role, whichever that is', () => {
    expect(frontOf({ part: 34, runner: 22, gate: 11 })).toBe(34)
    // A frame can legitimately be built up past its parts.
    expect(frontOf({ part: 8, runner: 40, gate: 6 })).toBe(40)
  })
})

describe('the sheet as lumps', () => {
  it('keeps every part and every gate the flat drawing has', () => {
    for (const text of ['KIOSK', 'MADE TO', 'A', 'PLASTIC TYPE']) {
      const { plan, lumps } = sheet(text)
      const pieces = plan.frames.flatMap((f) => f.parts.flatMap((p) => p.pieces))

      expect(lumps.filter((l) => l.role === 'part')).toHaveLength(pieces.length)
      expect(lumps.filter((l) => l.role === 'gate')).toHaveLength(
        pieces.reduce((n, p) => n + p.gates.length, 0),
      )
      // Nothing may arrive as holes alone: a lump with no solid is a lump that
      // would extrude into nothing, or worse, into its own opening.
      for (const lump of lumps) expect(solidsOf(lump).length).toBeGreaterThan(0)
    }
  })

  it('carries the frame, its bars, its tab and the bridges as runner', () => {
    const { plan, lumps } = sheet('MADE TO')
    const bars = plan.frames.reduce((n, f) => n + f.lattice.length + f.spurs.length, 0)
    const tabs = plan.frames.filter((f) => f.tab).length

    expect(plan.bridges.length).toBeGreaterThan(0)
    expect(lumps.filter((l) => l.role === 'runner')).toHaveLength(
      plan.bridges.length + plan.frames.length + bars + tabs,
    )
    // A bridge belongs to no single frame, so it takes the first one's colour —
    // the same rule the flat drawing follows.
    for (let i = 0; i < plan.bridges.length; i++) expect(lumps[i].frame).toBe(0)
  })

  it('gives the frame an opening rather than a slab', () => {
    const { plan, style, lumps } = sheet('KIOSK')

    // The wall is the one lump built from two rings, and its second has to be a
    // hole strictly inside the first. Extrude the outer ring on its own and every
    // frame on the sheet comes out filled — which is what happened when the two
    // windings were a step out of phase.
    const walls = lumps.filter(
      (l) => l.role === 'runner' && l.rings.length === 2 && l.rings[1].hole,
    )
    expect(walls).toHaveLength(plan.frames.length)

    for (const wall of walls) {
      const [outer, opening] = wall.rings
      expect(pointInPolygon(opening.points[0], outer.points)).toBe(true)
      // Wound against each other, or nonzero fill leaves no void at all.
      expect(Math.sign(signedArea(outer.points))).toBe(-Math.sign(signedArea(opening.points)))
      expect(wall.thin).toBe(style.bar)
    }
  })

  it('keeps a counter as a counter', () => {
    // The invariant this tool has paid for twice: a letter with a counter is one
    // piece of flesh with a void in it. Lose the void here and the O extrudes
    // into a lozenge.
    const { lumps } = sheet('O')
    const parts = lumps.filter((l) => l.role === 'part')
    expect(parts).toHaveLength(1)
    expect(parts[0].rings.filter((r) => r.hole)).toHaveLength(1)
  })

  it('tells the bevel how thin the thinnest member is', () => {
    const style = runner({ neckWidth: 3 })
    const { lumps } = sheet('KIOSK', layout(), style)
    // A chamfer wider than half of what it cuts turns the solid inside out, and
    // the gate's neck is the thinnest thing on the sheet by design. Every lump
    // has to say what its own limit is.
    for (const lump of lumps.filter((l) => l.role === 'gate')) {
      expect(lump.thin).toBe(style.neckWidth)
    }
    for (const lump of lumps.filter((l) => l.role === 'part')) {
      expect(lump.thin).toBe(Infinity)
    }
  })

  it('gives every ring enough points to be a ring', () => {
    const { lumps } = sheet('PLASTIC TYPE')
    for (const lump of lumps) {
      for (const ring of lump.rings) expect(ring.points.length).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('what each lump is called', () => {
  it('names a kind for everything on the sheet, and a role that follows from it', () => {
    const { plan, lumps } = sheet('MADE TO')
    const counts: Record<string, number> = {}
    for (const lump of lumps) {
      counts[lump.kind] = (counts[lump.kind] ?? 0) + 1
      // The file names bodies by kind and the renderer picks depths by role, so
      // the two must not be able to disagree.
      expect(lump.role).toBe(roleOf(lump.kind))
    }
    const count = (kind: string) => counts[kind] ?? 0
    expect(count('frame')).toBe(plan.frames.length)
    expect(count('bridge')).toBe(plan.bridges.length)
    expect(count('tab')).toBe(plan.frames.filter((f) => f.tab).length)
    expect(count('bar')).toBe(
      plan.frames.reduce((n, f) => n + f.lattice.length + f.spurs.length, 0),
    )
    expect(count('part')).toBeGreaterThan(0)
    expect(count('gate')).toBeGreaterThan(0)
  })
})
