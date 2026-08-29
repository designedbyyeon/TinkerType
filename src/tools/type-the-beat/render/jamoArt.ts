/**
 * The drawn jamo, as supplied.
 *
 * These are the designer's own outlines (`0827_DJ is my Type /design/SVG`), kept
 * in **their own coordinates** and never rewritten. Everything about them that is
 * a decision is in the numbers: the stroke is 9 units on a vertical and 8.07 on a
 * horizontal, which is the optical correction that stops a cross from looking
 * bottom-heavy; ㅇ is 55.47 across where ㅁ is 50.64, which is the overshoot a
 * round letter needs to read the same size as a square one; ㅡ and ㅜ are 54.8
 * wide, wider than either, because a medial is.
 *
 * **So there is exactly one scale for the whole set, and it is not per letter.**
 * Fitting each outline to its own box would divide every one of those numbers by
 * itself — the overshoot would vanish, ㅡ would become a bar half the em thick,
 * and the family would come apart into six unrelated drawings. The one scale is
 * taken off ㅁ, which is `JAMO_REFERENCE` for the same reason: it is the square
 * the alphabet is drawn inside.
 *
 * Each letter is then centred in the em on its own box. A shape wider or taller
 * than ㅁ therefore hangs out over the em's edge, which is the point.
 */

export interface Outline {
  /** The path, in the artwork's own units. */
  d: string
  /** The artwork's own box. */
  w: number
  h: number
}

/**
 * The square the family is measured against — ㅁ's box.
 *
 * Every other letter is scaled by the same factor this one needs, so the ratios
 * between them survive intact.
 */
export const ART_UNIT = 50.64

export const ART: Record<string, Outline> = {
  // Asset 1 — a bar and nothing else. 8.07 is the family's horizontal weight.
  ㅡ: { d: 'M0 0H54.8V8.07H0Z', w: 54.8, h: 8.07 },

  // Asset 2 — the bar with its stem, drawn as one contour.
  ㅜ: {
    d: 'M0 8.07L22.9 8.07L22.9 23.19L31.9 23.19L31.9 8.07L54.8 8.07L54.8 0L0 0Z',
    w: 54.8,
    h: 23.19,
  },

  // Asset 3 — the tick, the bar and the two legs.
  ㅊ: {
    d:
      'M49.17 43.74L29.08 27.57L29.08 19.08L48.84 19.08L48.84 11.01L29.08 11.01' +
      'L29.08 0L20.09 0L20.09 11.01L.33 11.01L.33 19.08L20.09 19.08L20.09 27.57' +
      'L0 43.74L5.64 50.74L24.59 35.5L43.53 50.74Z',
    w: 49.17,
    h: 50.74,
  },

  // Asset 4 — two uprights, a waist and a foot. The counter is wound against it.
  ㅂ: {
    d: 'M40.65,17.25H9V0H0v50.64h49.64V0h-9v17.25ZM9,42.57v-17.25h31.65v17.25H9Z',
    w: 49.64,
    h: 50.64,
  },

  // Asset 5 — the mouth. The reference square.
  ㅁ: { d: 'M0,50.64h50.64V0H0v50.64ZM9,9h32.64v32.64H9V9Z', w: 50.64, h: 50.64 },

  // Asset 6 — the throat. Wider than ㅁ on purpose.
  ㅇ: {
    d:
      'M27.74,0C12.42,0,0,12.42,0,27.74s12.42,27.74,27.74,27.74,27.74-12.42,27.74-27.74S43.06,0,27.74,0Z' +
      'M27.74,46.47c-10.33,0-18.74-8.41-18.74-18.74S17.41,9,27.74,9s18.74,8.41,18.74,18.74-8.41,18.74-18.74,18.74Z',
    w: 55.47,
    h: 55.47,
  },

  /*
   * ㄷ — **not supplied, drawn to match.**
   *
   * The kit needs seven letters and the folder holds six. Rather than leave this
   * one in the old geometric alphabet, where it would arrive at a different
   * stroke weight beside its own kit-mates, it is built here in the artwork's own
   * units off the artwork's own measurements: ㅂ's box, ㅂ's 9-unit upright, ㅂ's
   * 8.07-unit horizontals. One contour, wound like the rest.
   *
   * It is a stand-in and it is meant to be replaced. When the drawn ㄷ arrives,
   * this entry is the only thing that changes.
   */
  ㄷ: { d: 'M0 0H49.64V8.07H9V42.57H49.64V50.64H0Z', w: 49.64, h: 50.64 },
}

/**
 * The transform that puts one outline into an em box of `em`, centred.
 *
 * `k` is the same for every letter — that is the whole contract of this file.
 */
export function artTransform(o: Outline, em: number): string {
  const k = em / ART_UNIT
  const r = (v: number) => Math.round(v * 1000) / 1000
  return `translate(${r((em - o.w * k) / 2)} ${r((em - o.h * k) / 2)}) scale(${r(k)})`
}
