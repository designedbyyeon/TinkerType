import { describe, expect, it } from 'vitest'
import { coverRect } from './coverFit'

const view = { width: 800, height: 600 }
const still = { scale: 1, x: 0, y: 0 }

describe('coverRect', () => {
  it('covers the view exactly at scale 1, with a wide image', () => {
    // 2:1 image in a 4:3 view — height is the binding edge.
    const r = coverRect(view, { naturalWidth: 2000, naturalHeight: 1000, ...still })
    expect(r.height).toBeCloseTo(600, 6)
    expect(r.width).toBeGreaterThanOrEqual(800)
    expect(r.width / r.height).toBeCloseTo(2, 6)
  })

  it('covers the view exactly at scale 1, with a tall image', () => {
    const r = coverRect(view, { naturalWidth: 1000, naturalHeight: 2000, ...still })
    expect(r.width).toBeCloseTo(800, 6)
    expect(r.height).toBeGreaterThanOrEqual(600)
    expect(r.width / r.height).toBeCloseTo(0.5, 6)
  })

  it('never leaves a gap, whatever the aspect ratio', () => {
    for (const [w, h] of [[100, 4000], [4000, 100], [800, 600], [601, 599]]) {
      const r = coverRect(view, { naturalWidth: w, naturalHeight: h, ...still })
      expect(r.width).toBeGreaterThanOrEqual(view.width - 1e-6)
      expect(r.height).toBeGreaterThanOrEqual(view.height - 1e-6)
      expect(r.x).toBeLessThanOrEqual(1e-6)
      expect(r.y).toBeLessThanOrEqual(1e-6)
    }
  })

  it('keeps the image centred when there is no offset', () => {
    const r = coverRect(view, { naturalWidth: 2000, naturalHeight: 1000, ...still })
    // Equal overhang either side.
    expect(r.x).toBeCloseTo(view.width - (r.x + r.width), 6)
  })

  it('shifts by exactly the offset given', () => {
    const base = coverRect(view, { naturalWidth: 1600, naturalHeight: 900, ...still })
    const moved = coverRect(view, { naturalWidth: 1600, naturalHeight: 900, scale: 1, x: 40, y: -25 })
    expect(moved.x - base.x).toBeCloseTo(40, 6)
    expect(moved.y - base.y).toBeCloseTo(-25, 6)
    expect(moved.width).toBeCloseTo(base.width, 6)
  })

  it('scales about the centre', () => {
    const base = coverRect(view, { naturalWidth: 1600, naturalHeight: 900, ...still })
    const bigger = coverRect(view, { naturalWidth: 1600, naturalHeight: 900, scale: 2, x: 0, y: 0 })
    expect(bigger.width).toBeCloseTo(base.width * 2, 6)
    // The centre stays put.
    expect(bigger.x + bigger.width / 2).toBeCloseTo(base.x + base.width / 2, 6)
    expect(bigger.y + bigger.height / 2).toBeCloseTo(base.y + base.height / 2, 6)
  })

  it('survives degenerate input rather than producing NaN', () => {
    const r = coverRect(view, { naturalWidth: 0, naturalHeight: 0, scale: 0, x: 0, y: 0 })
    for (const n of [r.x, r.y, r.width, r.height]) expect(Number.isFinite(n)).toBe(true)
    expect(r.width).toBeGreaterThan(0)
  })
})
