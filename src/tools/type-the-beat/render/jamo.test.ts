import { describe, expect, it } from 'vitest'
import { CHO, JONG } from '../../../shared/text/hangul'
import { VERTICAL_JUNG } from '../geometry/deck'
import { JAMO_EM, jamoParts, placedJamo } from './jamo'

/*
 * The machine draws its own letters, so nothing else checks them.
 *
 * A face at least fails loudly — a missing glyph comes back as a notdef box. A
 * hand-built shape that was never written just draws nothing, and an empty wheel
 * position looks like a rendering fault rather than like a gap in a table.
 */

import { applied, boundsOf, signedArea, subpaths } from './pathgeom'

/**
 * A jamo's real outline in em coordinates — every part, transform applied.
 *
 * The shapes are no longer all written the same way. Seven of them are the
 * designer's artwork, in the designer's own commands, so a check that reads the
 * path text is checking the spelling rather than the letter. These go through the
 * flattener instead: a bounding box and a winding direction mean the same thing
 * whichever way a contour was typed.
 */
function outline(jamo: string) {
  return jamoParts(jamo).flatMap((part) =>
    subpaths(part.d).map((sub) => ({
      points: sub.points.map((p) => applied(part.t, p)),
    })),
  )
}

describe('the shapes stay in proportion to one another', () => {
  it('keeps every letter near the em, and lets the round ones overshoot', () => {
    /*
     * **Not "inside the box" — in proportion to the box.**
     *
     * The supplied family is drawn to one common measure and its letters are
     * deliberately different sizes against it: ㅇ is 55.47 across where ㅁ is
     * 50.64, because a circle has to be bigger than a square to read the same
     * size, and ㅡ and ㅜ are wider than both because a medial is. Scaling each
     * one to fill the em would divide every one of those numbers by itself and
     * flatten the family into six unrelated drawings.
     *
     * So the bound is loose enough for the overshoot and tight enough that a
     * letter cannot silently arrive at twice the size of its neighbours.
     */
    const bad: string[] = []
    for (const jamo of [...CHO, ...VERTICAL_JUNG, ...JONG.filter(Boolean)]) {
      const b = boundsOf(outline(jamo))
      if (b.x1 < -0.1 * JAMO_EM || b.x2 > 1.1 * JAMO_EM) bad.push(`${jamo}: x ${b.x1}..${b.x2}`)
      if (b.y1 < -0.1 * JAMO_EM || b.y2 > 1.1 * JAMO_EM) bad.push(`${jamo}: y ${b.y1}..${b.y2}`)
    }
    expect(bad.slice(0, 8)).toEqual([])
  })

  it('gives the round letters their overshoot and the square ones none', () => {
    // The one relationship that a per-letter fit would destroy, checked head-on.
    const height = (j: string) => {
      const b = boundsOf(outline(j))
      return b.y2 - b.y1
    }
    expect(height('ㅇ')).toBeGreaterThan(height('ㅁ'))
    expect(height('ㅇ') / height('ㅁ')).toBeLessThan(1.15)
    // And a medial is a stroke inside the same em, not a letter-sized shape.
    expect(height('ㅡ')).toBeLessThan(height('ㅁ') * 0.25)
    expect(height('ㅜ')).toBeLessThan(height('ㅁ') * 0.6)
  })

  it('centres every letter on the em, whatever its box', () => {
    // Which is what makes a wheel turn about the letter rather than about a
    // corner of it, and what keeps the slider from stepping up and down.
    for (const jamo of ['ㅁ', 'ㅇ', 'ㅜ', 'ㅡ', 'ㅊ', 'ㅂ', 'ㄷ']) {
      const b = boundsOf(outline(jamo))
      expect((b.x1 + b.x2) / 2, jamo).toBeCloseTo(JAMO_EM / 2, 0)
      expect((b.y1 + b.y2) / 2, jamo).toBeCloseTo(JAMO_EM / 2, 0)
    }
  })

  it('gives a pair two halves that do not overlap', () => {
    // A cluster is two letters side by side, and it has to read as two.
    for (const cluster of ['ㄲ', 'ㅄ', 'ㄺ', 'ㅀ']) {
      const parts = jamoParts(cluster)
      expect(parts, cluster).toHaveLength(2)
      // Scaled evenly, so the monoline weight survives. A horizontal-only squash
      // keeps the horizontals heavy and halves the verticals.
      for (const part of parts) {
        const k = /scale\((-?[\d.]+)(?:\s+(-?[\d.]+))?\)/.exec(part.t ?? '')
        expect(k, cluster).not.toBeNull()
        if (k![2] !== undefined) expect(k![1]).toBe(k![2])
      }
      expect(parts[1].t).toContain('translate')
    }
  })

  it('keeps a single letter in one piece', () => {
    // The thing that separates a letter from a cluster: a cluster is two drawings
    // placed beside each other, a letter is one drawing however many strokes it
    // has. (It used to be spelled as "no transform", which stopped being the same
    // statement once the artwork arrived carrying its own placement.)
    for (const jamo of ['ㄱ', 'ㅁ', 'ㅇ', 'ㅜ', 'ㅊ', 'ㅂ']) {
      expect(jamoParts(jamo), jamo).toHaveLength(1)
    }
  })
})

describe('the letters are built the way the alphabet is', () => {
  it('closes ㅁ and ㅇ, and leaves ㄱ and ㄴ open', () => {
    // A closed letter has a counter, which is a second contour. An open one has
    // strokes only. Counted as contours rather than as `M`s, because a stroke can
    // be its own contour too — what separates them is the winding, below.
    const closed = (j: string) => outline(j).filter((s) => signedArea(s) < 0).length
    expect(closed('ㅁ')).toBe(1)
    expect(closed('ㅇ')).toBe(1)
    expect(closed('ㄱ')).toBe(0)
    expect(closed('ㄴ')).toBe(0)
  })

  it('adds a stroke where 가획 adds one', () => {
    /*
     * ㄱ → ㅋ is the alphabet's own derivation: one more stroke for one more puff
     * of air, and the drawing has to agree with the sound table.
     *
     * Only the pair that is still drawn here. ㄷ→ㅌ and ㅈ→ㅊ each straddle the
     * boundary now — the first of each is artwork drawn as a single contour and
     * the second is built out of bars — so counting strokes across them compares
     * two ways of writing a path, not two letters.
     */
    const strokes = (j: string) => (jamoParts(j)[0].d.match(/M/g) ?? []).length
    expect(strokes('ㅋ')).toBeGreaterThan(strokes('ㄱ'))
  })

  it('gives the y-glide medial one more stem than its base', () => {
    // ㅗ and ㅛ, which are both still drawn. ㅜ is artwork, so ㅜ/ㅠ would be the
    // same cross-boundary comparison as above.
    const strokes = (j: string) => (jamoParts(j)[0].d.match(/M/g) ?? []).length
    expect(strokes('ㅛ')).toBe(strokes('ㅗ') + 1)
  })
})

describe('the strokes join instead of cancelling', () => {
  /*
   * A jamo is one path of several contours and the strokes cross. Under `evenodd`
   * every crossing is a hole — the first drawing came out notched at every
   * junction — so the shapes are wound for `nonzero`: everything that fills turns
   * one way and a counter turns against it.
   *
   * Measured by signed area over the flattened contour, which is the definition,
   * rather than by pattern-matching the path text. That matters more now than it
   * did: the artwork was drawn in another application and its winding is its own,
   * so this is the check that says the two sets agree.
   */
  it('winds a letter\'s strokes with each other, not against each other', () => {
    /*
     * The check that caught the real one: ㅅ's two legs were wound in opposite
     * directions, so the wedge where they cross at the apex cancelled itself out
     * and the letter had a notch in its own point. Every stroke of a letter — as
     * opposed to a counter, which is checked below — has to turn the same way.
     */
    for (const jamo of ['ㅅ', 'ㅈ', 'ㅊ', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅂ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅜ', 'ㅗ', 'ㅡ']) {
      const areas = outline(jamo).map(signedArea)
      const outer = Math.sign(areas.slice().sort((a, b) => Math.abs(b) - Math.abs(a))[0])
      // ㅁ-like counters are the only contours allowed to disagree, and none of
      // these letters except ㅂ has one.
      const against = areas.filter((a) => Math.sign(a) !== outer).length
      expect(against, jamo).toBeLessThanOrEqual(jamo === 'ㅂ' ? 1 : 0)
    }
  })

  it('winds a counter against the letter that holds it', () => {
    // The four letters with a counter, artwork and drawn alike. If either set
    // ever flipped, its counters would fill in solid under `nonzero` — which is
    // exactly the failure that started this file.
    for (const jamo of ['ㅁ', 'ㅇ', 'ㅂ', 'ㅎ']) {
      const areas = outline(jamo).map(signedArea)
      expect(areas.some((a) => a > 0), jamo).toBe(true)
      expect(areas.some((a) => a < 0), jamo).toBe(true)
    }
  })

  it('cuts less than it fills, in every letter', () => {
    /*
     * The invariant is **inside** a letter, not across the alphabet.
     *
     * `nonzero` is resolved per path element and each jamo is its own path, so the
     * artwork turning the other way from the drawn shapes — which it does, having
     * been drawn in another application — costs nothing. A first version of this
     * test asserted a shared direction and failed on ㅁ, and the failure was the
     * test's, not the drawing's: it had promised something the renderer never asks
     * for. What the renderer does ask is that the largest contour fills and that
     * the counters, whichever sign they are, are the minority.
     */
    for (const jamo of [...CHO, ...VERTICAL_JUNG, ...JONG.filter(Boolean)]) {
      const areas = outline(jamo).map(signedArea)
      const outer = Math.sign(areas.slice().sort((a, b) => Math.abs(b) - Math.abs(a))[0])
      const fills = areas.filter((a) => Math.sign(a) === outer).length
      // Equal is legitimate — ㅁ is one square and one counter — and fewer is not.
      expect(fills, jamo).toBeGreaterThanOrEqual(areas.length - fills)
    }
  })
})

/** The six arguments of a `matrix(...)`, parsed whole. */
function matrixOf(t: string): number[] {
  return t
    .slice(t.indexOf('(') + 1, t.lastIndexOf(')'))
    .split(/\s+/)
    .map(Number)
}

describe('placing a jamo', () => {
  it('centres the box on the point it is given', () => {
    // The matrix maps the box's own centre to (cx, cy). Checked by pushing the
    // centre through it rather than by reading the numbers back.
    const m = matrixOf(placedJamo(100, 200, 50))
    const [a, b, c, d, e, f] = m
    const x = a * (JAMO_EM / 2) + c * (JAMO_EM / 2) + e
    const y = b * (JAMO_EM / 2) + d * (JAMO_EM / 2) + f
    expect(x).toBeCloseTo(100, 1)
    expect(y).toBeCloseTo(200, 1)
  })

  it('scales the box to the size asked for', () => {
    const m = matrixOf(placedJamo(0, 0, 80))
    expect(Math.hypot(m[0], m[1])).toBeCloseTo(80 / JAMO_EM, 5)
  })

  it('turns about that point, so a rotated letter does not drift', () => {
    for (const angle of [0, Math.PI / 3, Math.PI, -1.2]) {
      const m = matrixOf(placedJamo(300, 400, 60, angle))
      const [a, b, c, d, e, f] = m
      expect(a * 500 + c * 500 + e).toBeCloseTo(300, 1)
      expect(b * 500 + d * 500 + f).toBeCloseTo(400, 1)
    }
  })
})
