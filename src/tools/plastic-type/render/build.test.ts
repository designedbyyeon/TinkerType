import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { testFace, testFontSize } from '../../../shared/media/type/face.fixture'
import { layoutSheet } from '../geometry/layout'
import { planRunner } from '../geometry/runner'
import { depthsFor, stylesFor, type PlasticDoc } from '../types'
import { DEFAULT_DOC } from '../store'
import { buildSolid } from './build'
import { shapesOfLump } from './shapes'
import { lumpsOf } from '../geometry/solid'

/*
 * The extrusion itself, checked without a renderer.
 *
 * Nothing here needs a GL context: shapes, geometries and bounding boxes are
 * arithmetic. Which is the point — the two things that can go wrong in an
 * extrusion are silent on screen until they are catastrophic. A chamfer wider
 * than the neck it is cutting crosses its own inset walls and comes back as NaN
 * or as inverted faces; a role landing on the wrong depth plane looks like a
 * design decision until someone tries to snip the gate.
 */

const doc = (over: Partial<PlasticDoc> = {}): PlasticDoc => ({ ...DEFAULT_DOC, ...over })

function build(d: PlasticDoc) {
  const face = testFace(d.face)
  const styles = stylesFor(d, testFontSize(face, d.size, d.wght, d.wdth))
  const plan = planRunner(layoutSheet(d.text, d.partUnit, d.runnerUnit, face, styles.layout), styles.runner)
  return { built: buildSolid(plan, styles.runner, d), plan, style: styles.runner }
}

const meshes = (group: { children: unknown[] }) =>
  group.children.filter((o): o is Mesh => o instanceof Mesh)

describe('the extruded sheet', () => {
  it('moulds every role against one flat back', () => {
    const d = doc({ text: 'KIOSK', partDepth: 34, runnerDepth: 22, gateDepth: 11 })
    const depths = depthsFor(d)

    // The back is shared and the fronts are the three roles: that is the
    // difference between a moulded sheet and three plates floating at different
    // heights.
    const { built } = build(d)
    const fronts = new Set<number>()
    for (const mesh of meshes(built.group)) {
      mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox!
      expect(box.min.z).toBeCloseTo(0, 5)
      fronts.add(Number(box.max.z.toFixed(3)))
    }
    expect([...fronts].sort((a, b) => a - b)).toEqual(
      [depths.gate, depths.runner, depths.part].sort((a, b) => a - b),
    )
    built.dispose()
  })

  it('leaves no NaN, whatever the chamfer is asked to cut', () => {
    /*
     * The bevel sweep. Four pixels of chamfer on a gate whose neck is four and a
     * half is past the point where the profile turns inside out — the clamp is
     * the only thing between that and a non-manifold mess, and it has to hold at
     * every depth as well, including the ones too shallow to bevel at all.
     */
    for (const bevel of [0, 0.4, 1.4, 4]) {
      for (const depths of [
        { partDepth: 34, runnerDepth: 22, gateDepth: 11 },
        { partDepth: 1, runnerDepth: 1, gateDepth: 1 },
        { partDepth: 90, runnerDepth: 90, gateDepth: 90 },
        // A gate asked to stand proud of its own runner, which the clamp refuses.
        { partDepth: 20, runnerDepth: 6, gateDepth: 40 },
      ]) {
        const { built } = build(doc({ text: 'KIOSK', bevel, ...depths, neck: 4.5 }))
        const found = meshes(built.group)
        expect(found.length).toBeGreaterThan(0)
        for (const mesh of found) {
          const position = mesh.geometry.getAttribute('position')
          expect(position.count).toBeGreaterThan(0)
          // Scanned with a plain loop and asserted once. One `expect` per
          // ordinate is the same coverage at forty times the cost — enough to
          // push this file past the default timeout on a two-core runner.
          let bad = -1
          for (let i = 0; i < position.count * 3 && bad < 0; i++) {
            if (!Number.isFinite(position.array[i])) bad = i
          }
          expect(bad).toBe(-1)
        }
        built.dispose()
      }
    }
  })

  it('keeps the silhouette the drawing asked for, chamfer or not', () => {
    // `bevelOffset` is negative so the chamfer is cut *into* the outline instead
    // of grown out of it. Without that, every part comes out a bevel wider than
    // the flat sheet and the two forms stop being the same drawing.
    const sharp = build(doc({ text: 'KIOSK', bevel: 0 }))
    const soft = build(doc({ text: 'KIOSK', bevel: 4 }))
    for (const axis of ['x', 'y'] as const) {
      expect(soft.built.bounds.min[axis]).toBeCloseTo(sharp.built.bounds.min[axis], 3)
      expect(soft.built.bounds.max[axis]).toBeCloseTo(sharp.built.bounds.max[axis], 3)
    }
    sharp.built.dispose()
    soft.built.dispose()
  })

  it('drops a role turned down to nothing instead of drawing a plane', () => {
    const d = doc({ text: 'KIOSK', gateDepth: 0 })
    const { built, plan, style } = build(d)
    const gates = lumpsOf(plan, style).filter((l) => l.role === 'gate').length
    expect(gates).toBeGreaterThan(0)
    for (const mesh of meshes(built.group)) {
      mesh.geometry.computeBoundingBox()
      expect(mesh.geometry.boundingBox!.max.z).toBeGreaterThan(0.02)
    }
    built.dispose()
  })
})

describe('a lump as shapes', () => {
  it('flips y, so the model stands the way the drawing did', () => {
    const face = testFace()
    const styles = stylesFor(DEFAULT_DOC, testFontSize(face, 150))
    const plan = planRunner(layoutSheet('KIOSK', 'syllable', 'syllable', face, styles.layout), styles.runner)
    const lump = lumpsOf(plan, styles.runner).find((l) => l.role === 'part')!
    const ring = lump.rings.find((r) => !r.hole)!

    const shape = shapesOfLump(lump)[0]
    const points = shape.getPoints(1)
    // Sampled points of a polyline shape are its own vertices, negated in y.
    expect(points[0].x).toBeCloseTo(ring.points[0].x, 6)
    expect(points[0].y).toBeCloseTo(-ring.points[0].y, 6)
  })

  it('gives a hole to the solid that contains it and to no other', () => {
    const lump = {
      kind: 'part' as const,
      role: 'part' as const,
      frame: 0,
      thin: Infinity,
      rings: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], hole: false },
        { points: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }], hole: false },
        { points: [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }], hole: true },
      ],
    }
    const shapes = shapesOfLump(lump)
    expect(shapes).toHaveLength(2)
    expect(shapes[0].holes).toHaveLength(1)
    // Two strokes that do not meet are two solids. The counter of one is not a
    // counter of the other, and handing it to both punches a void in clear
    // material.
    expect(shapes[1].holes).toHaveLength(0)
  })

  it('does not leave a zero-length edge where a ring repeats its start', () => {
    const closed = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 0 },
    ]
    const shape = shapesOfLump({
      kind: 'gate',
      role: 'gate',
      frame: 0,
      thin: 4,
      rings: [{ points: closed, hole: false }],
    })[0]
    // Three corners, three edges — the repeat is the closing edge, not a fourth
    // vertex sitting on top of the first for the triangulator to trip over.
    expect(shape.curves).toHaveLength(3)
  })
})
