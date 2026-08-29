import { ART, artTransform } from './jamoArt'

/**
 * The jamo, drawn rather than set.
 *
 * **The machine's letters are parts, not type.** Everything on a wheel or on the
 * slider is built here out of one stroke weight, true circles and right angles —
 * no optical corrections, no varying stems, no typeface. The score's lane headers
 * still use 조선일보 견고딕, and that split is the point: the instrument is
 * machined, the notation is set.
 *
 * Which is also why this is not a shortcut. A drawn ㅇ is a perfect ring, and a
 * face's ㅇ is not — it is thinner at the sides, flattened at the top, and drawn to
 * sit beside other letters. On a turntable, beside nothing, at four different
 * rotations, the ring is the right one and the typographic one reads as a wobble.
 *
 * Everything is in a unit box from 0 to `EM`, y down, and the caller centres it.
 * The shapes come from 훈민정음's own construction — ㄱ is the tongue at the throat,
 * ㅁ is the mouth, ㅇ is the throat — so a geometric drawing is closer to the
 * letters' origin than a modern face is.
 *
 * **The seven letters the kit actually reaches are now artwork**, drawn by the
 * designer and kept in `jamoArt.ts` at their own measurements. The rest of the
 * alphabet is still built here: those letters are on no wheel and no slider, and a
 * shape that is never seen is not worth commissioning. What they are for is the
 * table being complete — a wheel position that draws nothing looks like a
 * rendering fault rather than like a gap.
 */

const EM = 1000
/**
 * Stroke weight as a fraction of the em, for the letters still built here.
 *
 * **Measured off the artwork**, so a letter this file draws lands at the same
 * weight as one the folder supplied: the drawn set's uprights are 9 units on a
 * 50.64 square. It used to be a rounder 0.20, chosen before there was anything to
 * match, and leaving it there would have meant a heavier ㄹ standing beside a
 * lighter ㅂ the moment anything outside the kit was ever shown.
 */
const T = (9 / 50.64) * EM

const r = (n: number) => Math.round(n * 10) / 10

/**
 * An axis-aligned bar, wound clockwise.
 *
 * **Winding is the whole of how these shapes work.** A jamo is one path made of
 * several strokes, and strokes cross — ㅂ's uprights cross its waist, ㅜ's stem
 * meets its bar. Under `evenodd` every one of those crossings becomes a hole, which
 * is exactly what the first drawing did: the letters came out notched at every
 * junction. Under `nonzero`, same-wound shapes union and an opposite-wound one cuts,
 * so the strokes join and the counters of ㅁ, ㅇ and ㅎ still open.
 */
function bar(x1: number, y1: number, x2: number, y2: number): string {
  return `M${r(x1)} ${r(y1)}H${r(x2)}V${r(y2)}H${r(x1)}Z`
}

/** The same bar wound the other way, so it cuts instead of filling. */
function hole(x1: number, y1: number, x2: number, y2: number): string {
  return `M${r(x1)} ${r(y1)}V${r(y2)}H${r(x2)}V${r(y1)}H${r(x1)}Z`
}

/**
 * A stroke along a line, square-ended. For the diagonals of ㅅ · ㅈ · ㅊ.
 *
 * **Wound to a fixed direction, not to the line's.** Built naively, the quad turns
 * whichever way the slope leans — so ㅅ's two legs came out wound *against each
 * other*, and under `nonzero` the wedge where they meet at the apex cancels: the
 * letter is drawn with a notch cut out of its own point. It never showed, because
 * neither ㅅ nor ㅈ is on the kit's wheels; it would have shown the day one was.
 * The winding is corrected here rather than at each call site, so a diagonal added
 * later cannot reintroduce it.
 */
function slash(x1: number, y1: number, x2: number, y2: number, t = T): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = ((-dy / len) * t) / 2
  const ny = ((dx / len) * t) / 2
  const quad: Array<[number, number]> = [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ]
  let twice = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    twice += a[0] * b[1] - b[0] * a[1]
  }
  if (twice < 0) quad.reverse()
  return `M${r(quad[0][0])} ${r(quad[0][1])}L${r(quad[1][0])} ${r(quad[1][1])}L${r(
    quad[2][0],
  )} ${r(quad[2][1])}L${r(quad[3][0])} ${r(quad[3][1])}Z`
}

/** A circle as two arcs, so it can pair with an inner one under even-odd. */
function circle(cx: number, cy: number, rad: number, sweep: 1 | 0): string {
  return `M${r(cx - rad)} ${r(cy)}A${r(rad)} ${r(rad)} 0 1 ${sweep} ${r(cx + rad)} ${r(
    cy,
  )}A${r(rad)} ${r(rad)} 0 1 ${sweep} ${r(cx - rad)} ${r(cy)}Z`
}

/** A ring: an outer circle and an inner one wound against it, so it cuts. */
function ring(cx: number, cy: number, rad: number, t = T): string {
  return circle(cx, cy, rad, 1) + circle(cx, cy, rad - t, 0)
}

/** A rectangular ring — ㅁ. */
function box(x1: number, y1: number, x2: number, y2: number, t = T): string {
  return bar(x1, y1, x2, y2) + hole(x1 + t, y1 + t, x2 - t, y2 - t)
}

const E = EM
const M = EM / 2

/**
 * The nineteen initials and the twenty-eight finals, as strokes.
 *
 * Written out rather than derived, because the alphabet's shapes are the alphabet:
 * ㄷ is not ㄱ plus a rule, it is a drawn thing. The doubles and the clusters *are*
 * derived, because those genuinely are one letter written twice or two letters
 * side by side.
 */
const SHAPES: Record<string, () => string> = {
  ㄱ: () => bar(0, 0, E, T) + bar(E - T, 0, E, E),
  ㄴ: () => bar(0, 0, T, E) + bar(0, E - T, E, E),
  ㄷ: () => bar(0, 0, E, T) + bar(0, 0, T, E) + bar(0, E - T, E, E),
  ㄹ: () =>
    bar(0, 0, E, T) +
    bar(E - T, 0, E, M) +
    bar(0, M - T / 2, E, M + T / 2) +
    bar(0, M, T, E) +
    bar(0, E - T, E, E),
  ㅁ: () => box(0, 0, E, E),
  // Two uprights, a waist and a foot — so the counter is the low box the
  // reference shows, and the top stays open.
  ㅂ: () => bar(0, 0, T, E) + bar(E - T, 0, E, E) + bar(0, M - T / 2, E, M + T / 2) + bar(0, E - T, E, E),
  /*
   * The diagonals are drawn to a *set of corners*, not to the box's edges.
   *
   * A stroke is offset from its line by half its weight along the normal, so a
   * diagonal that ends exactly on the corner puts its own corner outside — by
   * forty units on this slope, which is where ㅅ and ㅈ ran over the em and into
   * their neighbours on a rim. The apex and the feet are pulled in far enough that
   * the drawn shape lands on the box instead of the centreline doing so.
   */
  ㅅ: () => slash(M, 0.06 * E, 0.15 * E, 0.95 * E) + slash(M, 0.06 * E, 0.85 * E, 0.95 * E),
  ㅇ: () => ring(M, M, M),
  ㅈ: () =>
    bar(0, 0, E, T) + slash(M, T + T / 20, 0.15 * E, 0.95 * E) + slash(M, T + T / 20, 0.85 * E, 0.95 * E),
  ㅊ: () =>
    bar(0.36 * E, 0, 0.64 * E, T * 0.72) +
    bar(0, 0.26 * E, E, 0.26 * E + T) +
    slash(M, 0.26 * E + T + T / 20, 0.15 * E, 0.935 * E) +
    slash(M, 0.26 * E + T + T / 20, 0.85 * E, 0.935 * E),
  ㅋ: () => bar(0, 0, E, T) + bar(E - T, 0, E, E) + bar(0.12 * E, M - T / 2, E, M + T / 2),
  ㅌ: () => bar(0, 0, E, T) + bar(0, 0, T, E) + bar(0, E - T, E, E) + bar(0, M - T / 2, E, M + T / 2),
  ㅍ: () => bar(0, 0, E, T) + bar(0, E - T, E, E) + bar(0.24 * E, T, 0.24 * E + T, E - T) + bar(0.76 * E - T, T, 0.76 * E, E - T),
  ㅎ: () =>
    bar(0.36 * E, 0, 0.64 * E, T * 0.72) +
    bar(0, 0.24 * E, E, 0.24 * E + T) +
    ring(M, 0.7 * E, 0.3 * E),

  // The five medials that stack. A bar, and the strokes that stand on it.
  ㅡ: () => bar(0, M - T / 2, E, M + T / 2),
  ㅜ: () => bar(0, 0.36 * E, E, 0.36 * E + T) + bar(M - T / 2, 0.36 * E, M + T / 2, 0.86 * E),
  ㅠ: () =>
    bar(0, 0.36 * E, E, 0.36 * E + T) +
    bar(0.3 * E - T / 2, 0.36 * E, 0.3 * E + T / 2, 0.86 * E) +
    bar(0.7 * E - T / 2, 0.36 * E, 0.7 * E + T / 2, 0.86 * E),
  ㅗ: () => bar(0, 0.64 * E - T, E, 0.64 * E) + bar(M - T / 2, 0.14 * E, M + T / 2, 0.64 * E),
  ㅛ: () =>
    bar(0, 0.64 * E - T, E, 0.64 * E) +
    bar(0.3 * E - T / 2, 0.14 * E, 0.3 * E + T / 2, 0.64 * E) +
    bar(0.7 * E - T / 2, 0.14 * E, 0.7 * E + T / 2, 0.64 * E),
}

/** Side by side at half width — what a double *is*, and what a cluster is. */
const PAIRS: Record<string, [string, string]> = {
  ㄲ: ['ㄱ', 'ㄱ'],
  ㄸ: ['ㄷ', 'ㄷ'],
  ㅃ: ['ㅂ', 'ㅂ'],
  ㅆ: ['ㅅ', 'ㅅ'],
  ㅉ: ['ㅈ', 'ㅈ'],
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
}

export interface JamoPart {
  d: string
  /** A local transform inside the em box. Only the halves of a pair carry one. */
  t?: string
}

const cache = new Map<string, JamoPart[]>()

/**
 * One jamo as drawable parts, or an empty list for the empty final.
 *
 * A double or a cluster comes back as **two parts with their own transforms**
 * rather than as one rewritten path. Rewriting would mean parsing the path back
 * out and scaling its numbers command by command — and `A` carries three arguments
 * that are not coordinates, which is exactly the kind of surgery that works until
 * the day somebody adds an arc to a shape that did not have one.
 *
 * Cached, and drawn once: every size a jamo is used at is a transform on these
 * paths, so a turning wheel never re-serialises anything — the same rule the
 * typeset glyphs follow in `glyphs.ts`.
 */
export function jamoParts(jamo: string): JamoPart[] {
  if (!jamo) return []
  const hit = cache.get(jamo)
  if (hit) return hit

  let parts: JamoPart[] = []
  const art = ART[jamo]
  const own = SHAPES[jamo]
  if (art) {
    // The supplied outline, in its own coordinates, with the family's one scale
    // on it. Never rewritten in place — see the note in `jamoArt.ts`.
    parts = [{ d: art.d, t: artTransform(art, EM) }]
  } else if (own) {
    parts = [{ d: own() }]
  } else {
    const pair = PAIRS[jamo]
    if (pair) {
      /*
       * Two small letters side by side — **scaled evenly, not squashed.**
       *
       * A horizontal-only squash keeps the stroke weight on the horizontals and
       * halves it on the verticals, so ㅉ came out as two heavy bars over two thin
       * V's and ㅍ's uprights collided inside their own box. A monoline alphabet
       * has one weight; the only way to keep it while making a letter narrower is
       * to make the whole letter smaller.
       *
       * Vertically centred, and a tenth of a gap between them, so a cluster reads
       * as two letters rather than as one wide one.
       */
      const k = 0.45
      const y = (EM - EM * k) / 2
      parts = [
        { d: SHAPES[pair[0]](), t: `translate(0 ${y}) scale(${k})` },
        { d: SHAPES[pair[1]](), t: `translate(${0.55 * EM} ${y}) scale(${k})` },
      ]
    }
  }
  cache.set(jamo, parts)
  return parts
}

/** The em these paths are drawn at. Callers scale from here. */
export const JAMO_EM = EM

/**
 * The transform that puts a jamo path on (cx, cy) at `size` tall, turned by
 * `angle` radians about that point.
 *
 * The box is square and the letter fills it, so `size` is the drawn height of a
 * full-height jamo — a ㅁ or a ㅇ. A ㅡ is one stroke inside the same box and comes
 * out a fifth of it, which is exactly the relationship the alphabet has.
 */
export function placedJamo(cx: number, cy: number, size: number, angle = 0): string {
  const k = size / EM
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = -EM / 2
  const dy = -EM / 2
  // Rounded, so the attribute never comes out in exponential notation. `sin(π)` is
  // 1.2e-16 and stringifies as `1.2e-16`, which a reader — and a naive parser —
  // reads as two numbers.
  const n = (v: number) => Math.round(v * 1e6) / 1e6
  const p = (v: number) => Math.round(v * 100) / 100
  return `matrix(${n(cos * k)} ${n(sin * k)} ${n(-sin * k)} ${n(cos * k)} ${p(
    cx + (cos * dx - sin * dy) * k,
  )} ${p(cy + (sin * dx + cos * dy) * k)})`
}
