import { describe, expect, it } from 'vitest'
import { applyReveal, ease, letterOpacity, nodeReveal, nodeStart } from './reveal'
import { splitSubpaths } from '../../../shared/geometry/importSvg'
import type { AnimSettings, ShapeNode } from '../types'

const anim: AnimSettings = { durationMs: 1000, popMs: 200, easing: 'back', loop: false }

const node = (i: number): ShapeNode => ({
  pos: { x: i * 10, y: 0 },
  angle: 0,
  size: 40,
  shape: 'circle',
  cornerRadius: 0,
  text: 'A',
})

describe('easing', () => {
  it('is pinned at both ends for every curve', () => {
    for (const kind of ['back', 'out', 'linear'] as const) {
      expect(ease(0, kind)).toBeCloseTo(0, 6)
      expect(ease(1, kind)).toBeCloseTo(1, 6)
    }
  })

  it('clamps outside 0..1 so an un-started shape has no size', () => {
    expect(ease(-5, 'back')).toBe(0)
    expect(ease(9, 'back')).toBeCloseTo(1, 6)
  })

  it('back overshoots past full size — that is the pop', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => ease(i / 100, 'back')))
    expect(peak).toBeGreaterThan(1.05)
  })

  it('out and linear never overshoot', () => {
    for (let i = 0; i <= 100; i++) {
      expect(ease(i / 100, 'out')).toBeLessThanOrEqual(1)
      expect(ease(i / 100, 'linear')).toBeLessThanOrEqual(1)
    }
  })
})

describe('reveal timing', () => {
  it('starts the first shape immediately and lands the last exactly on duration', () => {
    const n = 12
    expect(nodeStart(0, n, anim)).toBe(0)
    expect(nodeStart(n - 1, n, anim) + anim.popMs).toBeCloseTo(anim.durationMs, 6)
  })

  it('normalises chains of different lengths to the same finish', () => {
    for (const n of [2, 7, 40, 200]) {
      expect(nodeStart(n - 1, n, anim) + anim.popMs).toBeCloseTo(anim.durationMs, 6)
    }
  })

  it('handles a single-shape chain without dividing by zero', () => {
    expect(nodeStart(0, 1, anim)).toBe(0)
    expect(Number.isFinite(nodeReveal(0, 1, 100, anim))).toBe(true)
  })

  it('survives a pop longer than the whole run', () => {
    const squashed: AnimSettings = { ...anim, popMs: 5000 }
    expect(nodeStart(9, 10, squashed)).toBe(0)
    expect(nodeReveal(9, 10, squashed.durationMs, squashed)).toBeGreaterThan(0)
  })

  it('every shape is complete once the run ends', () => {
    for (let i = 0; i < 30; i++) {
      expect(nodeReveal(i, 30, anim.durationMs, anim)).toBeCloseTo(1, 6)
    }
  })

  it('nothing has appeared at time zero except the first shape', () => {
    expect(nodeReveal(0, 30, 0, anim)).toBeCloseTo(0, 6)
    expect(nodeReveal(1, 30, 0, anim)).toBe(0)
    expect(nodeReveal(29, 30, 0, anim)).toBe(0)
  })
})

describe('applyReveal', () => {
  const nodes = Array.from({ length: 10 }, (_, i) => node(i))

  it('returns the very same array at rest, so downstream memos never re-run', () => {
    expect(applyReveal(nodes, anim.durationMs, anim, false)).toBe(nodes)
  })

  it('shrinks not-yet-revealed shapes to nothing', () => {
    const out = applyReveal(nodes, 0, anim, true)
    expect(out[0].size).toBeCloseTo(0, 6)
    expect(out[9].size).toBe(0)
  })

  it('restores full size at the end of the run', () => {
    const out = applyReveal(nodes, anim.durationMs, anim, true)
    for (const n of out) expect(n.size).toBeCloseTo(40, 4)
  })

  it('never produces a negative size, even mid-overshoot', () => {
    for (let t = 0; t <= anim.durationMs; t += 25) {
      for (const n of applyReveal(nodes, t, anim, true)) {
        expect(n.size).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('reveals in path order', () => {
    // Checked with a non-overshooting curve: with `back`, a shape still
    // bouncing can legitimately be bigger than an earlier one that has already
    // settled, so size order is not the right probe there.
    const linear: AnimSettings = { ...anim, easing: 'linear' }
    const mid = applyReveal(nodes, linear.durationMs / 2, linear, true)
    for (let i = 1; i < mid.length; i++) {
      expect(mid[i].size).toBeLessThanOrEqual(mid[i - 1].size + 1e-9)
    }
    expect(mid[0].size).toBeGreaterThan(mid[9].size)
  })

  it('lets a mid-bounce shape briefly exceed its final size', () => {
    const peak = Math.max(
      ...Array.from({ length: 200 }, (_, i) =>
        Math.max(...applyReveal(nodes, (i / 199) * anim.durationMs, anim, true).map((n) => n.size)),
      ),
    )
    expect(peak).toBeGreaterThan(40)
  })
})

describe('letterOpacity', () => {
  it('holds the letter back until its shape is on its way', () => {
    expect(letterOpacity(0)).toBe(0)
    expect(letterOpacity(0.3)).toBe(0)
    expect(letterOpacity(1)).toBe(1)
  })

  it('stays within 0..1 through the overshoot', () => {
    expect(letterOpacity(1.15)).toBe(1)
  })
})

describe('svg subpath splitting', () => {
  it('splits absolute movetos into separate strokes', () => {
    expect(splitSubpaths('M0 0 L10 0 M20 0 L30 0')).toHaveLength(2)
  })

  it('keeps a single stroke whole', () => {
    expect(splitSubpaths('M0 0 C5 5 10 5 15 0')).toEqual(['M0 0 C5 5 10 5 15 0'])
  })

  it('leaves relative movetos alone — they chain off the previous subpath', () => {
    // Splitting these would drop the accumulated origin and misplace the piece.
    expect(splitSubpaths('M0 0 L10 0 m5 5 l10 0')).toHaveLength(1)
  })

  it('handles a path with no moveto at all', () => {
    expect(splitSubpaths('L10 10')).toEqual(['L10 10'])
  })
})
