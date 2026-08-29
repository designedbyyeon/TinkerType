import { formFor, massesFor, MAX_ROWS, MIN_ROWS, rowsFor, viewOf, type Form } from './plan'
import { packInto } from './pack'
import { dress, maxTileLength, type Sign } from './signs'
import {
  atS,
  effectiveS,
  farDepth,
  nearDepth,
  overlapArea,
  projectBox,
  type Box,
  type Facing,
  type Point3,
  type View,
  type Wall,
} from './wall'
import { DEFAULT_STYLE, type Mass, type MeasuredWord, type Style } from './types'

/**
 * Text in, building out. The one entry point the renderer needs.
 *
 * The search is the whole shape of it: try the smallest row count, and if the
 * sentence does not fit, try one more row. `plan.ts` derives the footprint from
 * the row count and `pack.ts` reports whether the words fit, so this loop is the
 * only place the two meet.
 */

export interface Layout {
  form: Form
  masses: Mass[]
  /** The boards. One per word, no more — see the note on `Tile`. */
  signs: Sign[]
  /** Board area over panel area. */
  coverage: number
}

const dressAll = (packed: ReturnType<typeof packInto>, words: MeasuredWord[], style: Style) => ({
  signs: (packed?.tiles ?? []).map((tile) => dress(tile, words[tile.order], style)),
  coverage: packed?.coverage ?? 0,
})

export function layoutOf(words: MeasuredWord[], style: Style = DEFAULT_STYLE): Layout {
  const usable = words.filter((w) => w.text.length > 0)
  const view = viewOf(style.azimuth)

  /*
   * Start at the height the line has earned and only go up from there. The search
   * is a safety net for the pathological case — a single word wider than a whole
   * wall — not the thing that decides the building.
   *
   * `style.height` scales that starting point rather than overriding it, so the
   * dial stays a proportion and the line still sets the building.
   */
  const wanted = Math.max(
    MIN_ROWS,
    Math.min(MAX_ROWS, Math.round(rowsFor(usable.length, style.order) * style.height)),
  )

  /*
   * The longest word has to fit its storey comfortably.
   *
   * A board's width comes from its word now, so a wall narrower than the longest
   * word forces that board to be squeezed and its type set smaller — legal, since
   * nothing is ever dropped, but it looks like a mistake. The building grows
   * until the sentence's widest word is at home on it, which is the same rule as
   * everywhere else: the line sets the building.
   */
  const widest = usable.reduce((m, w) => Math.max(m, maxTileLength(w, style.pad)), 0)

  for (let rows = wanted; rows <= MAX_ROWS; rows++) {
    const form = formFor(rows, style.width, style.girth)
    if (rows < MAX_ROWS && form.wall.width < widest * 1.15) continue
    const packed = packInto(form, usable, style, view)
    if (!packed) continue
    return { form, masses: massesFor(form, style.seed), ...dressAll(packed, usable, style) }
  }

  /*
   * Past `MAX_ROWS` the building would be a tower of one-word rows, so the last
   * attempt takes the words as they come and lets the packer squeeze. It cannot
   * lose any: a word too long for its segment is set smaller, never dropped.
   */
  /*
   * Past the ceiling, the boards hug their words as tightly as the padding
   * allows, and then more tightly still. **Something has to come back** — an
   * empty layout would mean the sentence was dropped, which is the one thing this
   * must never do.
   */
  const form = formFor(MAX_ROWS, style.width, style.girth)
  for (const pad of [style.pad * 0.5, 0]) {
    const loose = { ...style, pad: Math.max(0, pad) }
    const packed = packInto(form, usable, loose, view)
    if (packed) return { form, masses: massesFor(form, style.seed), ...dressAll(packed, usable, loose) }
  }
  return { form, masses: massesFor(form, style.seed), signs: [], coverage: 0 }
}

/**
 * The signs in reading order: by row, then by where each one **appears**.
 *
 * Not by `s`. A board's standoff shifts it sideways on screen, so its physical
 * position along the wall is not where the eye finds it — and the packer holds
 * gaps wide enough that the two orders agree. Sorting by the apparent position is
 * the honest key: if the gap floor ever failed, this would still return what a
 * reader actually sees, and the invariant test would catch the mismatch.
 */
export function readingOrder(layout: Layout, view: View): Sign[] {
  const { wall } = layout.form
  return [...layout.signs].sort(
    (a, b) =>
      a.row - b.row ||
      effectiveS(facingOf(wall, a), a.s0, a.out, view) -
        effectiveS(facingOf(wall, b), b.s0, b.out, view),
  )
}

/** Which wall a board is on. Its midpoint decides, never its start. */
export const facingOf = (wall: Wall, sign: Sign): Facing =>
  atS(wall, (sign.s0 + sign.s1) / 2).facing

/**
 * A board's frame in world space: where its face starts, and which way `along`
 * runs.
 *
 * On the right wall `along` runs toward **decreasing z**, because that is the
 * direction screen x increases there. Getting this backwards mirrors every word
 * on that wall, which is the sort of thing that looks like a font problem.
 */
export interface Frame {
  facing: Facing
  origin: Point3
  along: Point3
}

export function frameOf(wall: Wall, sign: Sign): Frame {
  const face = sign.out + sign.thick
  if (facingOf(wall, sign) === 'front') {
    return {
      facing: 'front',
      origin: { x: sign.s0, y: sign.y, z: wall.depth + face },
      along: { x: 1, y: 0, z: 0 },
    }
  }
  return {
    facing: 'right',
    origin: { x: wall.width + face, y: sign.y, z: wall.depth - (sign.s0 - wall.width) },
    along: { x: 0, y: 0, z: -1 },
  }
}

/** A board as a world-space box. */
export function boxOfSign(wall: Wall, sign: Sign): Box {
  const len = sign.s1 - sign.s0
  if (facingOf(wall, sign) === 'front') {
    return {
      x: sign.s0,
      y: sign.y,
      z: wall.depth + sign.out,
      w: len,
      h: sign.height,
      d: sign.thick,
    }
  }
  return {
    x: wall.width + sign.out,
    y: sign.y,
    z: wall.depth - (sign.s1 - wall.width),
    w: sign.thick,
    h: sign.height,
    d: len,
  }
}

/**
 * How much of each board another board hides, as a fraction of its own area.
 *
 * Overlapping is wanted — boards at different depths crossing each other in
 * projection is where the density in refs 09/10 comes from. **Swallowing is
 * not.** So the rule is not "do not overlap" but "nothing is more than half
 * hidden", which is checkable, and the check earns its keep: in the scrapped
 * tool exactly this class of test caught three words that had vanished under a
 * band.
 *
 * Only boards **wholly** nearer the camera count as covering. A pair that merely
 * interleaves in depth is left alone, the same strictness the painter's-order
 * work needed — and there a loose comparison manufactured false orderings.
 */
export function hiddenFractions(layout: Layout, view: View): number[] {
  const { wall } = layout.form
  const boxes = layout.signs.map((s) => boxOfSign(wall, s))
  const rects = boxes.map((b) => projectBox(b, view))
  const near = boxes.map((b) => nearDepth(b, view))
  const far = boxes.map((b) => farDepth(b, view))

  return layout.signs.map((_, i) => {
    const rect = rects[i]
    const area = rect.width * rect.height
    if (area <= 0) return 0
    let hidden = 0
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue
      if (far[j] <= near[i]) continue
      hidden += overlapArea(rect, rects[j])
    }
    return Math.min(1, hidden / area)
  })
}

/**
 * Distinct depth families in a building, and how far the deepest board is from
 * the shallowest.
 *
 * Both measures are **scale-free**, and they have to be. Counting kinds made the
 * check depend on which names were in the table, and it broke the moment the
 * table was rewritten for the Korean shop-building types. Counting boards past a
 * fixed distance broke the moment the depth dial's default came down. The claim
 * that survives either change is the one worth holding: **the range of depths is
 * real, not decorative** — something stands several times further off the wall
 * than something else.
 */
export function depthVariety(signs: Sign[]): { families: number; spread: number } {
  const outs = signs.map((s) => s.out)
  return {
    families: new Set(outs.map((o) => Math.round(o * 100))).size,
    spread: outs.length === 0 ? 0 : Math.max(...outs) / Math.max(1e-6, Math.min(...outs)),
  }
}
