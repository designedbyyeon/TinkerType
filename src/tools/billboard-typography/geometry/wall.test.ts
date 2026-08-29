import { describe, expect, it } from 'vitest'
import { atS, projectBox, screenXAt, wallOf } from './wall'

/**
 * The reading rule, checked as arithmetic.
 *
 * Everything the tool promises rests on one claim: walking the merged wall line
 * moves monotonically to the right on screen, at every azimuth. If that fails
 * the sentence stops being readable and no amount of layout work saves it.
 */
describe('the merged wall line', () => {
  const wall = wallOf(11, 6)

  it('moves screen x monotonically along the whole line, at any azimuth', () => {
    for (const azimuth of [5, 15, 21, 38, 45, 60, 85]) {
      const view = { azimuth, elevation: 12 }
      let previous = -Infinity
      for (let s = 0; s <= wall.total; s += 0.05) {
        const x = screenXAt(wall, s, view)
        expect(x).toBeGreaterThan(previous - 1e-9)
        previous = x
      }
    }
  })

  it('is continuous across the corner', () => {
    for (const azimuth of [5, 21, 45, 85]) {
      const view = { azimuth, elevation: 12 }
      const before = screenXAt(wall, wall.width - 1e-6, view)
      const after = screenXAt(wall, wall.width + 1e-6, view)
      expect(Math.abs(after - before)).toBeLessThan(1e-4)
    }
  })

  it('puts the corner itself on the right wall, not the front one', () => {
    // `s <= width` choosing the front wall once built a right-wall board as a
    // front-wall object running off the side of the building.
    expect(atS(wall, wall.width).facing).toBe('right')
    expect(atS(wall, wall.width - 1e-9).facing).toBe('front')
  })

  it('projects a box to a rectangle that grows with the box', () => {
    const view = { azimuth: 21, elevation: 12 }
    const small = projectBox({ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1 }, view)
    const large = projectBox({ x: 0, y: 0, z: 0, w: 2, h: 2, d: 2 }, view)
    expect(large.width).toBeGreaterThan(small.width)
    expect(large.height).toBeGreaterThan(small.height)
  })
})
