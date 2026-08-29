import { describe, expect, it } from 'vitest'
import { testFace, testFontSize } from '../../../shared/media/type/face.fixture'
import type { PartUnit, RunnerUnit } from './hangul'
import { layoutSheet, type LayoutStyle } from './layout'
import { planRunner, roundedRectPath, type Bar, type FramePlan, type RunnerStyle } from './runner'
import { pointInPolygon, roundedRectRing, signedArea } from '../../../shared/geometry/polygon'
import type { Vec2 } from '../../../shared/geometry/vec'

const layout = (over: Partial<LayoutStyle> = {}): LayoutStyle => ({
  fontSize: testFontSize(testFace(), 150),
  tracking: 12,
  inset: 26,
  gap: 14,
  perRow: 0,
  uniformHeight: true,
  tolerance: 0.4,
  round: 0,
  ...over,
})

const runner = (over: Partial<RunnerStyle> = {}): RunnerStyle => ({
  bar: 10,
  spurRatio: 0.7,
  gateWidth: 6,
  neckWidth: 3,
  maxGate: 24,
  twoGateLength: 90,
  radius: 8,
  tab: true,
  bridges: false,
  lattice: true,
  ...over,
})

function plan(
  text: string,
  part: PartUnit,
  unit: RunnerUnit,
  l = layout(),
  r = runner(),
  face = testFace(),
) {
  return planRunner(layoutSheet(text, part, unit, face, l), r)
}

const allPieces = (frames: FramePlan[]) => frames.flatMap((f) => f.parts.flatMap((p) => p.pieces))

/** Distance from a point to a segment. */
function toSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** Every line a gate is allowed to start from: the inner wall faces and the bars. */
function anchorsOf(frame: FramePlan, style: RunnerStyle): [Vec2, Vec2][] {
  const r = frame.rect
  const x0 = r.x + style.bar
  const y0 = r.y + style.bar
  const x1 = r.x + r.width - style.bar
  const y1 = r.y + r.height - style.bar
  const bars: Bar[] = [...frame.lattice, ...frame.spurs]
  return [
    [{ x: x0, y: y0 }, { x: x1, y: y0 }],
    [{ x: x0, y: y1 }, { x: x1, y: y1 }],
    [{ x: x0, y: y0 }, { x: x0, y: y1 }],
    [{ x: x1, y: y0 }, { x: x1, y: y1 }],
    ...bars.map((b) => [b.a, b.b] as [Vec2, Vec2]),
  ]
}

const TEXTS = ['KIOSK', 'MADE TO SCALE', 'i', 'Rj%', 'Snap it out. Build it!']

/**
 * The same invariant, in the script that stresses it hardest.
 *
 * A Latin word is a row of one-piece letters with the odd tittle. A Hangul
 * syllable is two or three jamo that were never one shape to begin with, and a
 * face draws several of them as separate strokes on top of that — `한` comes off
 * this pipeline as **five** pieces, stacked rather than in a row. Five parts in a
 * frame the size of one letter is where a gate runs out of wall to hang from, so
 * this is the case that decides whether the tool can set Korean at all.
 *
 * The two faces are the two ways Hangul is set: `gothica1` fits every syllable to
 * one box, `unjamo` gives each jamo one shape and lets the stack fall where it
 * falls. They put the pieces in very different places.
 */
const HANGUL_TEXTS = ['한글', '이응', '읽기', '뭉게구름', '봄 여름 가을 겨울']
const PARTS: PartUnit[] = ['jamo', 'syllable', 'word', 'sentence']
const UNITS: RunnerUnit[] = ['syllable', 'word', 'sentence', 'all']

describe('the invariant: nothing leaves the frame loose', () => {
  it('gives every piece a gate, or contact with the runner', () => {
    const loose: string[] = []

    for (const text of TEXTS) {
      for (const part of PARTS) {
        for (const unit of UNITS) {
          for (const density of [
            { l: layout({ tracking: 0, inset: 14 }), r: runner({ bar: 6, maxGate: 14 }) },
            { l: layout(), r: runner() },
            { l: layout({ tracking: 30, inset: 44 }), r: runner({ bar: 16, maxGate: 40 }) },
          ]) {
            const built = plan(text, part, unit, density.l, density.r)
            for (const piece of allPieces(built.frames)) {
              if (piece.gates.length === 0 && !piece.touching) {
                loose.push(`${text} ${part}/${unit} bar=${density.r.bar}`)
              }
            }
          }
        }
      }
    }

    expect(loose).toEqual([])
  })

  it('gives every Hangul piece a gate too, in both faces', () => {
    const loose: string[] = []

    for (const faceId of ['gothica1', 'unjamo'] as const) {
      const face = testFace(faceId)
      const size = testFontSize(face, 150, 900)
      for (const text of HANGUL_TEXTS) {
        for (const part of PARTS) {
          for (const unit of UNITS) {
            for (const density of [
              { l: layout({ fontSize: size, tracking: 0, inset: 14 }), r: runner({ bar: 6, maxGate: 14 }) },
              { l: layout({ fontSize: size }), r: runner() },
              { l: layout({ fontSize: size, tracking: 30, inset: 44 }), r: runner({ bar: 16, maxGate: 40 }) },
            ]) {
              const built = plan(text, part, unit, density.l, density.r, face)
              for (const piece of allPieces(built.frames)) {
                if (piece.gates.length === 0 && !piece.touching) {
                  loose.push(`${faceId} ${text} ${part}/${unit} bar=${density.r.bar}`)
                }
              }
            }
          }
        }
      }
    }

    expect(loose).toEqual([])
  })

  it('sees a syllable as the jamo it is made of, not as one letter', () => {
    // The claim the Hangul faces are here for. `이` is a ring and a stem that
    // never touch, so it is two parts and each needs its own gate — the same
    // rule that gives the tittle of an i one, arrived at from the script rather
    // than from an accident of drawing.
    for (const faceId of ['gothica1', 'unjamo'] as const) {
      const face = testFace(faceId)
      const l = layout({ fontSize: testFontSize(face, 150, 900) })
      const built = plan('이', 'syllable', 'syllable', l, runner(), face)
      const pieces = allPieces(built.frames)
      expect(pieces.length, `${faceId} 이`).toBe(2)
      for (const piece of pieces) expect(piece.gates.length > 0 || piece.touching).toBe(true)

      // And a stacked syllable comes apart further still: an initial drawn in
      // separate strokes is separate parts, which is what the sheet should show.
      const han = allPieces(plan('한', 'syllable', 'syllable', l, runner(), face).frames)
      expect(han.length, `${faceId} 한`).toBeGreaterThanOrEqual(3)
    }
  })

  it('holds with the lattice off, when only walls and branches remain', () => {
    for (const text of TEXTS) {
      for (const unit of UNITS) {
        const built = plan(text, 'jamo', unit, layout(), runner({ lattice: false }))
        for (const piece of allPieces(built.frames)) {
          expect(piece.gates.length > 0 || piece.touching).toBe(true)
        }
      }
    }
  })

  it('keeps a gate even where no branch can be grown', () => {
    // The densest setting there is: one frame, no tracking, a tight ceiling on
    // gate length. Some gates come out long, which is a compromise — a piece
    // with no gate at all would be a part on the floor, which is not.
    const built = plan(
      'MADE TO SCALE',
      'syllable',
      'all',
      layout({ tracking: 0 }),
      runner({ maxGate: 24 }),
    )
    const pieces = allPieces(built.frames)
    expect(pieces.length).toBeGreaterThan(8)
    for (const piece of pieces) expect(piece.gates.length > 0 || piece.touching).toBe(true)
  })
})

describe('gates', () => {
  it('runs from the runner to the part outline', () => {
    const style = runner()
    const built = plan('Rj', 'syllable', 'syllable', layout(), style)

    for (const frame of built.frames) {
      const anchors = anchorsOf(frame, style)
      for (const part of frame.parts) {
        for (const { piece, gates } of part.pieces) {
          const outline = piece.contours.filter((c) => c.kind === 'solid').flatMap((c) => c.points)
          for (const gate of gates) {
            // Starts on a wall face or a bar.
            const onRunner = Math.min(...anchors.map(([a, b]) => toSegment(gate.from, a, b)))
            expect(onRunner).toBeLessThan(0.5)
            // Lands on the part itself, never in a counter or in mid-air.
            const onPart = Math.min(...outline.map((p) => Math.hypot(p.x - gate.to.x, p.y - gate.to.y)))
            expect(onPart).toBeLessThan(0.5)
          }
        }
      }
    }
  })

  it('tapers, steps, then runs parallel into the part', () => {
    // The reference profile: a long shallow taper off the runner, a step down,
    // then a short parallel neck. The neck is the thinnest section and the same
    // width along its length, which is what makes the part snap off there.
    const style = runner({ gateWidth: 8, neckWidth: 3 })
    const built = plan('i', 'syllable', 'syllable', layout(), style)
    const gates = allPieces(built.frames).flatMap((p) => p.gates)
    expect(gates.length).toBeGreaterThan(0)

    for (const gate of gates) {
      expect(gate.polygon).toHaveLength(8)
      const [root, shoulder, neckStart, tipA, tipB, neckStartB, shoulderB, rootB] = gate.polygon
      const across = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(b.x - a.x, b.y - a.y)

      // Widest at the runner, narrowest at the part.
      expect(across(root, rootB)).toBeCloseTo(style.gateWidth, 5)
      expect(across(tipA, tipB)).toBeCloseTo(style.neckWidth, 5)

      // The neck really is parallel: it enters and leaves at one width.
      expect(across(neckStart, neckStartB)).toBeCloseTo(style.neckWidth, 5)
      expect(across(neckStart, tipA)).toBeGreaterThan(0.5)

      // And the step is a step — the taper stops above the neck width.
      const shoulderWidth = across(shoulder, shoulderB)
      expect(shoulderWidth).toBeGreaterThan(style.neckWidth)
      expect(shoulderWidth).toBeLessThan(style.gateWidth)

      // The narrow end is the one at the part.
      const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      })
      const atPart = mid(tipA, tipB)
      const atRunner = mid(root, rootB)
      expect(across(atPart, gate.to)).toBeLessThan(across(atRunner, gate.to))
    }
  })

  it('holds a long piece at both ends', () => {
    // A single gate on a long part lets it pivot; the spare-parts frame puts one at each
    // end of every long rail.
    const built = plan('MADE', 'syllable', 'word', layout(), runner({ twoGateLength: 60 }))
    const tall = allPieces(built.frames).filter(
      (p) => Math.max(p.piece.bbox.width, p.piece.bbox.height) > 60,
    )
    expect(tall.length).toBeGreaterThan(0)

    for (const piece of tall) {
      expect(piece.gates.length).toBeGreaterThanOrEqual(2)
      const span = Math.max(
        ...piece.gates.flatMap((a) => piece.gates.map((b) => Math.hypot(b.to.x - a.to.x, b.to.y - a.to.y))),
      )
      // Apart, not two gates onto the same corner.
      expect(span).toBeGreaterThan(30)
    }
  })

  it('adds no gate where the piece already meets the runner', () => {
    // With almost no clearance the letters run into the wall, and a gate there
    // would be a sliver buried in solid material.
    const style = runner({ twoGateLength: 400 }) // one gate slot per piece
    const built = plan('MADE TO SCALE', 'syllable', 'syllable', layout({ inset: 2 }), style)
    const pieces = allPieces(built.frames)
    expect(pieces.some((p) => p.touching)).toBe(true)
    for (const p of pieces) if (p.touching) expect(p.gates).toHaveLength(0)
  })

  it('still holds the far end of a long piece that touches at one end', () => {
    const built = plan('MADE TO SCALE', 'syllable', 'syllable', layout({ inset: 2 }), runner({ twoGateLength: 50 }))
    const held = allPieces(built.frames).filter((p) => p.touching && p.gates.length > 0)
    expect(held.length).toBeGreaterThan(0)
  })
})

describe('branches and bars', () => {
  it('grows a branch toward a piece no wall can reach', () => {
    const style = runner({ maxGate: 20 })
    const built = plan('MADE TO SCALE', 'syllable', 'all', layout(), style)
    const frame = built.frames[0]
    expect(frame.spurs.length + frame.lattice.length).toBeGreaterThan(0)

    // Every branch starts on the runner already built, not in mid-air.
    for (const spur of frame.spurs) {
      const others = anchorsOf(frame, style).filter(([a, b]) => a !== spur.a || b !== spur.b)
      expect(Math.min(...others.map(([a, b]) => toSegment(spur.a, a, b)))).toBeLessThan(0.5)
      expect(spur.thickness).toBeCloseTo(style.bar * style.spurRatio, 5)
    }
  })

  it('brings gates under the limit once branches are in', () => {
    const style = runner({ maxGate: 24 })
    const built = plan('MADE TO SCALE', 'syllable', 'all', layout(), style)
    const lengths = allPieces(built.frames).flatMap((p) => p.gates.map((g) => g.length))
    expect(Math.max(...lengths)).toBeLessThanOrEqual(style.maxGate)
  })

  it('runs lattice bars between parts and never through one', () => {
    const style = runner()
    const built = plan('MADE TO SCALE', 'word', 'all', layout({ tracking: 20 }), style)
    const frame = built.frames[0]
    expect(frame.lattice.length).toBeGreaterThan(0)

    const clearance = style.bar * 0.5
    for (const bar of frame.lattice) {
      for (const { piece } of frame.parts.flatMap((p) => p.pieces)) {
        for (const contour of piece.contours) {
          if (contour.kind !== 'solid') continue
          for (const p of contour.points) {
            expect(toSegment(p, bar.a, bar.b)).toBeGreaterThan(clearance)
          }
        }
      }
    }
  })

  it('draws no lattice when a frame holds a single part', () => {
    const built = plan('i', 'syllable', 'syllable', layout(), runner())
    expect(built.frames[0].lattice).toHaveLength(0)
  })
})

describe('the frame itself', () => {
  it('draws the wall as a ring so the middle stays open', () => {
    const built = plan('O', 'syllable', 'syllable', layout(), runner())
    const wall = built.frames[0].wall
    expect(wall.match(/M/g)).toHaveLength(2)
    expect(wall).toContain('A') // rounded corners
  })

  it('reverses a rounded rectangle exactly, corner for corner', () => {
    // The ring is the outer rectangle plus the inner one wound the other way. If
    // the reversal is off by one the arcs sweep whole sides instead of corners,
    // the hole closes up, and every frame renders as a filled blob. Counting
    // subpaths does not catch that; comparing the two windings does.
    const rect = { x: 10, y: 20, width: 120, height: 80 }
    const points = (d: string) =>
      // Every command's endpoint, in order.
      [...d.matchAll(/(?:[ML]|A[\d.]+ [\d.]+ 0 0 [01] )(-?[\d.]+) (-?[\d.]+)/g)].map(
        (m) => `${m[1]},${m[2]}`,
      )

    const forward = points(roundedRectPath(rect, 12, true))
    const back = points(roundedRectPath(rect, 12, false))

    expect(forward).toHaveLength(9)
    expect(back).toHaveLength(9)
    // Same start, and from there the reverse walks the same corners backwards.
    expect(back[0]).toBe(forward[0])
    expect(back.slice(1)).toEqual([...forward.slice(0, -1)].reverse())
  })

  it('alternates corner arcs with straight sides in both windings', () => {
    const rect = { x: 0, y: 0, width: 60, height: 40 }
    for (const clockwise of [true, false]) {
      const kinds = [...roundedRectPath(rect, 8, clockwise).matchAll(/[MLAZ]/g)].map((m) => m[0])
      expect(kinds[0]).toBe('M')
      expect(kinds[kinds.length - 1]).toBe('Z')
      // Four corners and four sides, never two of a kind in a row.
      const middle = kinds.slice(1, -1)
      expect(middle.filter((k) => k === 'A')).toHaveLength(4)
      expect(middle.filter((k) => k === 'L')).toHaveLength(4)
      for (let i = 1; i < middle.length; i++) expect(middle[i]).not.toBe(middle[i - 1])
    }
  })

  it('squares the corners off when the radius is zero', () => {
    const rect = { x: 0, y: 0, width: 60, height: 40 }
    expect(roundedRectPath(rect, 0, true)).not.toContain('A')
    expect(roundedRectPath(rect, 0, false)).not.toContain('A')
  })

  it('carries an injection tab only when asked', () => {
    expect(plan('O', 'syllable', 'syllable', layout(), runner({ tab: true })).frames[0].tab)
      .toHaveLength(4)
    expect(plan('O', 'syllable', 'syllable', layout(), runner({ tab: false })).frames[0].tab)
      .toBeNull()
  })

  it('bridges neighbouring frames only when asked', () => {
    const l = layout()
    expect(plan('MADE TO', 'syllable', 'syllable', l, runner({ bridges: false })).bridges)
      .toHaveLength(0)

    const joined = plan('MADE TO', 'syllable', 'syllable', l, runner({ bridges: true }))
    expect(joined.frames.length).toBeGreaterThan(1)
    expect(joined.bridges.length).toBeGreaterThan(0)
    // A bridge spans the gap between two frames and nothing more.
    for (const bridge of joined.bridges) {
      expect(Math.hypot(bridge.b.x - bridge.a.x, bridge.b.y - bridge.a.y)).toBeCloseTo(l.gap, 1)
    }
  })

  it('numbers parts in reading order and cycles the palette per frame', () => {
    const built = plan('MADE TO', 'syllable', 'word', layout(), runner())
    expect(built.frames.map((f) => f.colour)).toEqual([0, 1])
    for (const frame of built.frames) {
      expect(frame.parts.map((p) => p.part.slot)).toEqual(
        frame.parts.map((_, i) => i + 1),
      )
    }
  })
})

/*
 * The wall ring against the wall path.
 *
 * These two draw the same rounded rectangle by different means — `roundedRectPath`
 * writes it as arcs for the flat sheet, `roundedRectRing` as points for the solid
 * one — and they are deliberately not derived from each other, so that this can
 * hold them together. It is the check that caught the mirrored winding being a
 * step out of phase: reversed, the ring started on a side instead of on a corner
 * arc, so an arc swept a whole side, the frame's opening closed up, and every
 * frame came out a filled slab. Counting the points did not catch it. Comparing
 * the two orders did.
 */
describe('the frame wall as points', () => {
  const rect = { x: 10, y: 20, width: 120, height: 80 }

  it('lands on the same corners as the path version', () => {
    const ring = roundedRectRing(rect, 12, true)
    const d = roundedRectPath(rect, 12, true)
    const first = d.match(/M([\d.-]+) ([\d.-]+)/)!
    expect(ring[ring.length - 1].x).toBeCloseTo(Number(first[1]), 6)
    expect(ring[ring.length - 1].y).toBeCloseTo(Number(first[2]), 6)

    // Every point has to sit on the rounded rectangle, not merely near it.
    for (const p of ring) {
      expect(p.x).toBeGreaterThanOrEqual(rect.x - 1e-9)
      expect(p.x).toBeLessThanOrEqual(rect.x + rect.width + 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(rect.y - 1e-9)
      expect(p.y).toBeLessThanOrEqual(rect.y + rect.height + 1e-9)
    }
  })

  it('winds the two directions as exact reverses of each other', () => {
    const cw = roundedRectRing(rect, 12, true)
    const ccw = roundedRectRing(rect, 12, false)
    expect(ccw).toHaveLength(cw.length)
    for (let i = 0; i < cw.length; i++) {
      expect(ccw[i].x).toBeCloseTo(cw[cw.length - 1 - i].x, 9)
      expect(ccw[i].y).toBeCloseTo(cw[cw.length - 1 - i].y, 9)
    }
    expect(Math.sign(signedArea(cw))).toBe(-Math.sign(signedArea(ccw)))
  })

  it('degrades to a plain box at zero radius', () => {
    expect(roundedRectRing(rect, 0, true)).toHaveLength(4)
    expect(roundedRectPath(rect, 0, true)).not.toContain('A')
  })
})

/*
 * A gate is buried into whatever holds it, and it has to stay buried.
 *
 * The wide end is pushed back behind the join so the flat drawing shows no seam
 * there. **How far back is a property of the member, not a constant** — and
 * burying every gate by the wall's thickness is what this caught: a wall anchor
 * sits on the wall's inner face and has the whole wall behind it, but a bar
 * anchor is the bar's *centre line* and has only half a bar. Every gate hung off
 * a cell bar or a branch pushed its root clean through the far side, where it
 * stood in the cell as a stub attached to nothing. Measured on the default
 * sheet: **8 of 10 gates, up to 6px past the bar.** On screen it reads as the
 * runner sprouting spikes, and in the solid form it is a floating tab.
 *
 * What is asserted is the invariant, not the fix: from the join back to the root,
 * a gate is inside material. The probe is deliberately blunt — walk the buried
 * span, and test the two corners of the wide end — because the failure is blunt.
 */
describe('the invariant: a gate is buried in what holds it', () => {
  const material = (frame: FramePlan, plan: ReturnType<typeof planRunner>, style: RunnerStyle) => {
    const outer = roundedRectRing(frame.rect, style.radius, true)
    const opening = roundedRectRing(
      {
        x: frame.rect.x + style.bar,
        y: frame.rect.y + style.bar,
        width: frame.rect.width - style.bar * 2,
        height: frame.rect.height - style.bar * 2,
      },
      Math.max(0, style.radius - style.bar),
      true,
    )
    const solids: Vec2[][] = [
      ...frame.lattice.map((b) => b.polygon),
      ...frame.spurs.map((b) => b.polygon),
      ...plan.bridges.map((b) => b.polygon),
      ...(frame.tab ? [frame.tab] : []),
    ]
    return (p: Vec2) =>
      (pointInPolygon(p, outer) && !pointInPolygon(p, opening)) ||
      solids.some((s) => pointInPolygon(p, s)) ||
      frame.parts.some((part) =>
        part.pieces.some((pc) =>
          pc.piece.contours.some((c) => c.kind === 'solid' && pointInPolygon(p, c.points)),
        ),
      )
  }

  it('never leaves a root standing in the open', () => {
    const loose: string[] = []
    let gates = 0

    const sheets: [string, PartUnit, RunnerUnit, ReturnType<typeof testFace> | undefined][] = [
      ['KIOSK', 'syllable', 'word', undefined],
      ['KIOSK', 'syllable', 'syllable', undefined],
      ['MADE TO SCALE', 'syllable', 'all', undefined],
      ['Snap it out. Build it!', 'syllable', 'sentence', undefined],
      ['Rj%', 'syllable', 'word', testFace('kumbhsans')],
      ['한글 부품', 'syllable', 'syllable', testFace('gothica1')],
      ['뭉게구름 열두 개', 'syllable', 'word', testFace('gothica1')],
      ['봄 여름 가을 겨울', 'jamo', 'all', testFace('unjamo')],
      ['읽기', 'syllable', 'all', testFace('unjamo')],
    ]

    for (const [text, part, unit, face] of sheets) {
      const style = runner()
      const l = face ? layout({ fontSize: testFontSize(face, 150, 900) }) : layout()
      const built = plan(text, part, unit, l, style, face ?? testFace())

      for (const frame of built.frames) {
        const solid = material(frame, built, style)
        for (const piece of allPieces([frame])) {
          for (const gate of piece.gates) {
            gates++
            const root = gate.polygon[0]
            const tail = gate.polygon[gate.polygon.length - 1]
            const mid = { x: (root.x + tail.x) / 2, y: (root.y + tail.y) / 2 }
            const burial = Math.hypot(mid.x - gate.from.x, mid.y - gate.from.y)
            if (burial < 1e-6) continue
            const d = { x: (gate.from.x - mid.x) / burial, y: (gate.from.y - mid.y) / burial }

            // Up to, but not onto, the root: the root itself sits *on* the far
            // face of what holds it, and a point exactly on a boundary is not
            // inside it.
            for (let t = 0.25; t < burial - 0.2; t += 0.25) {
              if (!solid({ x: gate.from.x - d.x * t, y: gate.from.y - d.y * t })) {
                loose.push(`${text}/${unit} centre @${t.toFixed(2)}`)
                break
              }
            }
            // The corners of the wide end, nudged a hair toward the part so a
            // root sitting exactly on a face is not read as being outside it.
            for (const corner of [root, tail]) {
              if (!solid({ x: corner.x + d.x * 0.6, y: corner.y + d.y * 0.6 })) {
                loose.push(`${text}/${unit} corner`)
                break
              }
            }
          }
        }
      }
    }

    expect(gates).toBeGreaterThan(150)
    expect(loose).toEqual([])
  })
})
