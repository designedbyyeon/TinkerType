import { describe, expect, it } from 'vitest'
import { marchingSquares } from './contour'
import { buildField } from './field'
import { loopToPath } from './fitBezier'
import { polylineLength, resampleUniform, samplePathBySpacing, simplify } from '../../../shared/geometry/polyline'
import { roundUnion, shapeSdf, smin } from './sdf'
import type { ShapeNode } from '../types'
import { dist, type Vec2 } from '../../../shared/geometry/vec'

const circleNode = (x: number, y: number, size: number): ShapeNode => ({
  pos: { x, y },
  angle: 0,
  size,
  shape: 'circle',
  cornerRadius: 0,
  text: null,
})

describe('smin', () => {
  it('degrades to a hard min at k = 0, which is what makes blend=0 mean "separate"', () => {
    for (const [a, b] of [[3, 8], [-2, 5], [0, 0], [7, -7]]) {
      expect(smin(a, b, 0)).toBe(Math.min(a, b))
    }
  })

  it('never returns more than the hard min', () => {
    for (let a = -20; a <= 20; a += 3) {
      for (let b = -20; b <= 20; b += 3) {
        for (const k of [1, 5, 20]) {
          expect(smin(a, b, k)).toBeLessThanOrEqual(Math.min(a, b) + 1e-9)
        }
      }
    }
  })

  it('is symmetric', () => {
    expect(smin(4, 9, 6)).toBeCloseTo(smin(9, 4, 6), 10)
  })

  it('dips at most k/4 below the hard min', () => {
    const k = 12
    // Deepest at a == b, where the polynomial contributes -k/4.
    expect(smin(5, 5, k)).toBeCloseTo(5 - k / 4, 10)
  })
})

describe('roundUnion', () => {
  it('degrades to a hard min at r = 0', () => {
    for (const [a, b] of [[3, 8], [-2, 5], [7, -7]]) {
      expect(roundUnion(a, b, 0)).toBe(Math.min(a, b))
    }
  })

  it('leaves the surface untouched outside the fillet band — the whole point', () => {
    const r = 10
    // Either distance beyond r means this point is not in the joint.
    for (const [a, b] of [[2, 30], [0, 11], [-5, 25], [40, 40], [12, 12]]) {
      expect(roundUnion(a, b, r)).toBeCloseTo(Math.min(a, b), 10)
    }
  })

  it('only adds material where both surfaces are within r', () => {
    const r = 10
    // Deep in the crevice, both 2px out: material appears.
    expect(roundUnion(2, 2, r)).toBeLessThan(2)
    expect(roundUnion(2, 2, r)).toBeGreaterThan(-r)
  })

  it('never returns more than the hard min', () => {
    for (let a = -20; a <= 20; a += 3) {
      for (let b = -20; b <= 20; b += 3) {
        for (const r of [1, 5, 20]) {
          expect(roundUnion(a, b, r)).toBeLessThanOrEqual(Math.min(a, b) + 1e-9)
        }
      }
    }
  })

  it('is symmetric', () => {
    expect(roundUnion(4, 9, 6)).toBeCloseTo(roundUnion(9, 4, 6), 10)
  })
})

describe('shapeSdf', () => {
  it('is zero on a circle edge and signed correctly', () => {
    expect(shapeSdf(10, 0, 0, 0, 20, 'circle', 0)).toBeCloseTo(0, 10)
    expect(shapeSdf(0, 0, 0, 0, 20, 'circle', 0)).toBeCloseTo(-10, 10)
    expect(shapeSdf(25, 0, 0, 0, 20, 'circle', 0)).toBeCloseTo(15, 10)
  })

  it('is zero on a square edge', () => {
    expect(shapeSdf(10, 0, 0, 0, 20, 'square', 0)).toBeCloseTo(0, 10)
    expect(shapeSdf(10, 10, 0, 0, 20, 'square', 0)).toBeCloseTo(0, 10)
    expect(shapeSdf(0, 0, 0, 0, 20, 'square', 0)).toBeCloseTo(-10, 10)
  })

  it('rotates a square with its node angle', () => {
    // Rotated 45deg, the corner now points along +x at half*sqrt(2).
    const d = shapeSdf(10 * Math.SQRT2, 0, 0, 0, 20, 'square', 0, Math.PI / 4)
    expect(d).toBeCloseTo(0, 6)
  })
})

describe('polyline', () => {
  const line: Vec2[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]

  it('measures length', () => {
    expect(polylineLength(line)).toBeCloseTo(100, 10)
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(5, 10)
  })

  it('resamples at an even spacing', () => {
    const out = resampleUniform(line, 10)
    for (let i = 1; i < out.length; i++) {
      expect(dist(out[i - 1], out[i])).toBeCloseTo(10, 6)
    }
  })

  it('places samples at exact arc-length multiples', () => {
    const samples = samplePathBySpacing(line, 25)
    expect(samples.map((s) => Math.round(s.pos.x))).toEqual([0, 25, 50, 75, 100])
    expect(samples[0].tangent.x).toBeCloseTo(1, 10)
    expect(samples[4].t).toBeCloseTo(1, 10)
  })

  it('keeps exact spacing on a curved path too', () => {
    const arc: Vec2[] = []
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI
      arc.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) })
    }
    const samples = samplePathBySpacing(arc, 40)
    for (let i = 1; i < samples.length; i++) {
      // Chord vs arc: consecutive samples sit slightly under the arc spacing.
      expect(dist(samples[i - 1].pos, samples[i].pos)).toBeGreaterThan(38)
      expect(dist(samples[i - 1].pos, samples[i].pos)).toBeLessThanOrEqual(40.001)
    }
  })

  it('simplify keeps endpoints and drops collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ]
    expect(simplify(pts, 0.5)).toEqual([pts[0], pts[3]])
  })
})

describe('marching squares', () => {
  it('traces a single circle at the right radius', () => {
    const cell = 0.5
    const field = buildField([circleNode(0, 0, 100)], 0, cell)!
    const loops = marchingSquares(field)

    expect(loops).toHaveLength(1)
    for (const p of loops[0]) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(50, 1)
    }
  })

  it('produces a closed loop', () => {
    const field = buildField([circleNode(0, 0, 60)], 0, 0.5)!
    const loop = marchingSquares(field)[0]
    // Last point links back to the first, within one cell.
    expect(dist(loop[0], loop[loop.length - 1])).toBeLessThan(1.5)
  })

  it('keeps far-apart shapes as separate loops when blend is 0', () => {
    const nodes = [circleNode(0, 0, 40), circleNode(200, 0, 40)]
    const loops = marchingSquares(buildField(nodes, 0, 1)!)
    expect(loops).toHaveLength(2)
  })

  it('fuses the same shapes into one loop once blend is raised', () => {
    // Surfaces are 30px apart: 20px of shape, 30px of air, 20px of shape.
    const nodes = [circleNode(0, 0, 40), circleNode(70, 0, 40)]
    expect(marchingSquares(buildField(nodes, 0, 0.5, 'fillet')!)).toHaveLength(2)
    expect(marchingSquares(buildField(nodes, 70, 0.5, 'fillet')!)).toHaveLength(1)
  })

  it('fuses at roughly half the gap in metaball mode, as the label promises', () => {
    const nodes = [circleNode(0, 0, 40), circleNode(70, 0, 40)]
    expect(marchingSquares(buildField(nodes, 12, 0.5, 'metaball')!)).toHaveLength(2)
    expect(marchingSquares(buildField(nodes, 18, 0.5, 'metaball')!)).toHaveLength(1)
  })

  it('fillet blending leaves a circle exactly circular away from the joint', () => {
    // Two overlapping circles of radius 50, centres 90 apart.
    const nodes = [circleNode(0, 0, 100), circleNode(90, 0, 100)]
    const cell = 0.5

    // Radius spread over the left circle's outer arc, away from the joint.
    // A true circle holds one radius; a swollen one does not.
    const radiusSpread = (loop: Vec2[]) => {
      const radii = loop.filter((p) => p.x < -5).map((p) => Math.hypot(p.x, p.y))
      return { min: Math.min(...radii), max: Math.max(...radii) }
    }

    const fillet = radiusSpread(marchingSquares(buildField(nodes, 25, cell, 'fillet')!)[0])
    expect(fillet.min).toBeCloseTo(50, 1)
    expect(fillet.max).toBeCloseTo(50, 1)

    // Metaball mode is the contrasting behaviour: the surface is pulled out of
    // round by its neighbour, which is exactly why it is not the default.
    const metaball = radiusSpread(marchingSquares(buildField(nodes, 25, cell, 'metaball')!)[0])
    expect(metaball.max - metaball.min).toBeGreaterThan(3)
  })

  it('unions overlapping shapes into one loop even without blend', () => {
    const nodes = [circleNode(0, 0, 60), circleNode(30, 0, 60)]
    expect(marchingSquares(buildField(nodes, 0, 0.5)!)).toHaveLength(1)
  })

  it('finds the hole inside a ring of shapes', () => {
    const nodes: ShapeNode[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      nodes.push(circleNode(Math.cos(a) * 100, Math.sin(a) * 100, 60))
    }
    // Outer contour plus the enclosed hole.
    expect(marchingSquares(buildField(nodes, 10, 1)!)).toHaveLength(2)
  })
})

describe('bezier fitting', () => {
  it('emits a closed cubic path', () => {
    const field = buildField([circleNode(0, 0, 100)], 0, 0.5)!
    const d = loopToPath(marchingSquares(field)[0], 0.2)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).toContain('C')
    expect(d).not.toContain('NaN')
  })

  it('collapses a circle to a handful of anchors instead of thousands', () => {
    const field = buildField([circleNode(0, 0, 200)], 0, 0.5)!
    const raw = marchingSquares(field)[0]
    const anchors = (loopToPath(raw, 0.4).match(/C/g) ?? []).length
    expect(raw.length).toBeGreaterThan(400)
    expect(anchors).toBeLessThan(80)
  })
})
