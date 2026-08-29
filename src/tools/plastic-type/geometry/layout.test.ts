import { describe, expect, it } from 'vitest'
import { FACES, type FaceId } from '../../../shared/media/type/faces'
import { testFace } from '../../../shared/media/type/face.fixture'
import type { PartUnit, RunnerUnit } from './hangul'
import { applyAxes, layoutSheet, type LayoutStyle } from './layout'

const SIZE = 150

interface Build {
  text: string
  face?: FaceId
  wght?: number
  size?: number
  part?: PartUnit
  runner?: RunnerUnit
  style?: Partial<LayoutStyle>
}

/**
 * One sheet, with the axes set exactly once on the way in.
 *
 * Spelled out as a single ordered path because `applyAxes` moves the shared font:
 * a helper that resolved the size in one place and applied the axes in another
 * left every sheet drawn at whichever weight ran last.
 */
function build({ text, face: faceId = 'bigshoulders', wght = 800, size = SIZE, part = 'syllable', runner = 'syllable', style = {} }: Build) {
  const face = testFace(faceId)
  const unitHeight = applyAxes(face, { wght, wdth: 100 })
  return layoutSheet(text, part, runner, face, {
    fontSize: size / unitHeight,
    tracking: 12,
    inset: 26,
    gap: 14,
    perRow: 0,
    uniformHeight: true,
    tolerance: 0.4,
    round: 0,
    ...style,
  })
}

describe('size means the drawn height', () => {
  it('solves the font size from the face, not from the em', () => {
    // Each face draws its cap at a different fraction of the em, so one font size
    // gives visibly different letters. Size is a measurement, so the font size is
    // solved backwards from it, per face and per weight.
    const solved = (['bigshoulders', 'kumbhsans', 'poppins'] as FaceId[]).map(
      (id) => SIZE / applyAxes(testFace(id), { wght: 800, wdth: 100 }),
    )
    expect(new Set(solved.map((n) => Math.round(n))).size).toBeGreaterThan(1)
    for (const n of solved) expect(n).toBeGreaterThan(SIZE)
  })

  it('draws every face at the height that was asked for', () => {
    for (const face of ['bigshoulders', 'kumbhsans', 'poppins'] as FaceId[]) {
      expect(build({ text: 'H', face }).frames[0].ink.height).toBeCloseTo(SIZE, 0)
    }
  })

  it('holds the height as the weight axis moves', () => {
    // Weight moves the cap height along with the outlines. Measured once at one
    // weight, Size would drift as the weight changed.
    for (const wght of [200, 500, 900]) {
      expect(build({ text: 'H', wght }).frames[0].ink.height).toBeCloseTo(SIZE, 0)
    }
  })

  it('scales linearly, so Size is a real measurement', () => {
    expect(build({ text: 'H', size: 300 }).frames[0].ink.height).toBeCloseTo(300, 0)
  })

  it('widens the letters as the weight rises', () => {
    // Same drawn height, more mass — which is the whole point of the axis here.
    const narrow = build({ text: 'H', wght: 200 }).frames[0].ink.width
    const heavy = build({ text: 'H', wght: 900 }).frames[0].ink.width
    expect(heavy).toBeGreaterThan(narrow * 1.15)
  })

  it('declares only the axes a face actually has', () => {
    // The panel hides a row rather than greying it, so these have to be honest.
    expect(FACES.bigshoulders.wght).toBeDefined()
    expect(FACES.kumbhsans.wght).toBeDefined()

    // Poppins has no variable cut at all, so not even a weight axis.
    expect(FACES.poppins.wght).toBeUndefined()

    // And no shipped face has a width axis at the moment.
    for (const id of ['bigshoulders', 'kumbhsans', 'poppins'] as FaceId[]) {
      expect(FACES[id].wdth, id).toBeUndefined()
    }
  })

  it('draws a static cut at the height asked for, whatever the weight says', () => {
    // Size is solved from a measurement, so a face with nothing to set still
    // lands on the number — and asking for a weight it has no axis for is a
    // no-op rather than an error.
    for (const wght of [100, 900]) {
      expect(build({ text: 'H', face: 'poppins', wght }).frames[0].ink.height).toBeCloseTo(SIZE, 0)
    }
  })
})

describe('frames around the letters', () => {
  it('leaves exactly the inset clear on every side', () => {
    const s = { inset: 26 }
    for (const frame of build({ text: 'KIOSK' }).frames) {
      expect(frame.ink.x - frame.rect.x).toBeCloseTo(s.inset, 4)
      expect(frame.rect.x + frame.rect.width - (frame.ink.x + frame.ink.width)).toBeCloseTo(s.inset, 4)
    }
  })

  it('levels every frame when they are tied into one lattice', () => {
    // The bridged column is a column of bridged frames. Cells only line up if they
    // share edges, so a tied sheet gives every frame the tallest one's height.
    const built = build({ text: 'Rj', style: { uniformHeight: true } })
    expect(new Set(built.frames.map((f) => Math.round(f.rect.height))).size).toBe(1)
    for (const frame of built.frames) {
      // The ink stays centred, so the extra height is shared top and bottom.
      const above = frame.ink.y - frame.rect.y
      const below = frame.rect.y + frame.rect.height - (frame.ink.y + frame.ink.height)
      expect(above).toBeCloseTo(below, 4)
    }
  })

  it('cuts each separate runner close around its own content', () => {
    // The syllable runners are four separate frames, each trimmed to its own
    // syllable — which is what makes them read as four things, not one sheet.
    const s = { inset: 26 }
    const built = build({ text: 'Rj', style: { uniformHeight: false } })
    expect(new Set(built.frames.map((f) => Math.round(f.rect.height))).size).toBeGreaterThan(1)

    for (const frame of built.frames) {
      expect(frame.ink.y - frame.rect.y).toBeCloseTo(s.inset, 4)
      expect(frame.rect.y + frame.rect.height - (frame.ink.y + frame.ink.height)).toBeCloseTo(s.inset, 4)
    }

    // Still one middle line, so a row of unequal runners reads off one axis.
    const centres = built.frames.map((f) => Math.round(f.rect.y + f.rect.height / 2))
    expect(new Set(centres).size).toBe(1)
  })
})

describe('arranging the sheet', () => {
  it('keeps everything on one row until columns are set', () => {
    const built = build({ text: 'KIOSK' })
    expect(built.frames.every((f) => f.row === 0)).toBe(true)
    expect(built.frames.map((f) => f.column)).toEqual([0, 1, 2, 3, 4])
  })

  it('wraps at the column count', () => {
    const built = build({ text: 'KIOSK', style: { perRow: 2 } })
    expect(built.frames.map((f) => f.row)).toEqual([0, 0, 1, 1, 2])
    expect(built.frames.map((f) => f.column)).toEqual([0, 1, 0, 1, 0])
  })

  it('opens the gap between parts as tracking rises', () => {
    // Tracking is space between parts inside a frame, so the three letters have
    // to share one frame for it to have anything to open.
    const tight = build({ text: 'KIT', runner: 'word', style: { tracking: 0 } })
    const loose = build({ text: 'KIT', runner: 'word', style: { tracking: 40 } })
    expect(loose.frames[0].ink.width).toBeGreaterThan(tight.frames[0].ink.width + 60)
  })

  it('reports bounds that contain every frame', () => {
    const built = build({ text: 'KIOSK', style: { perRow: 2 } })
    for (const f of built.frames) {
      expect(f.rect.x).toBeGreaterThanOrEqual(built.bounds.x - 0.001)
      expect(f.rect.y).toBeGreaterThanOrEqual(built.bounds.y - 0.001)
      expect(f.rect.x + f.rect.width).toBeLessThanOrEqual(built.bounds.x + built.bounds.width + 0.001)
      expect(f.rect.y + f.rect.height).toBeLessThanOrEqual(built.bounds.y + built.bounds.height + 0.001)
    }
  })

  it('drops text that draws nothing', () => {
    expect(build({ text: '   ' }).frames).toEqual([])
    expect(build({ text: '' }).frames).toEqual([])
  })
})
