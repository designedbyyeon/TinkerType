import { mulberry32 } from '../../../shared/geometry/vec'
import { PAD, PITCH, rowTop, TOP_INSET, type Form } from './plan'
import {
  capOf,
  hashSeed,
  KINDS,
  kindFor,
  liveryFor,
  outFor,
  tileHeight,
  tileLength,
} from './signs'
import type { MeasuredWord, SignKind, Style, Tile } from './types'
import { atS, shiftOf, type Facing, type View } from './wall'

/**
 * Laying the sentence onto the wall, row by row.
 *
 * This is typesetting, and the reading order mostly falls out of it: rows run
 * top to bottom, and within a row boards are laid down in increasing `s`, which
 * `wall.ts` shows is increasing screen x — **for boards flush with the wall.**
 *
 * Four things it must not do.
 *
 * **Never swap two words.** The one real complication. A board standing off the
 * wall shifts sideways on screen by `shiftOf`, so two neighbours at different
 * depths can cross over and the sentence comes out wrong. The fix is a floor on
 * the gap between each pair, wide enough to absorb the shift between *those two*
 * depths. It also means no two boards in a row can overlap on screen at all,
 * which is what keeps any one of them from being swallowed.
 *
 * **Never straddle the corner.** A board folded around it reads as two boards.
 * Structural rather than checked: the corner is a hard boundary between free
 * segments, so nothing can span it.
 *
 * **Never lose a word.** A word too long for the row it lands in is set smaller,
 * not dropped. Character-count splitting once dropped words silently, because
 * `MMM` is not the width of `III`; everything here is measured.
 *
 * **Leave the wall showing.** Boards take `style.fill` of a row's length and no
 * more. The upper bound matters more than the lower — the requirement is that a
 * real wall exists underneath, and a wall covered end to end is the patchwork the
 * previous attempt was scrapped for.
 */

interface Seg {
  a: number
  b: number
}

/** Smallest board worth placing. Below this a gap is just a gap. */
const MIN_BOARD = PAD * 2 + 0.35

/** A blade's reserved column gets a little air either side. */
const BLADE_CLEAR = 0.3

const sum = (values: number[]): number => values.reduce((total, v) => total + v, 0)

function subtract(segs: Seg[], holes: Seg[]): Seg[] {
  let out = segs
  for (const h of holes) {
    const next: Seg[] = []
    for (const s of out) {
      if (h.b <= s.a || h.a >= s.b) {
        next.push(s)
        continue
      }
      if (h.a > s.a) next.push({ a: s.a, b: h.a })
      if (h.b < s.b) next.push({ a: h.b, b: s.b })
    }
    out = next
  }
  return out.filter((s) => s.b - s.a > 1e-6)
}

/**
 * The gaps a row of boards needs: one before each board and one after.
 *
 * Two neighbours keep their reading order when `gap > shift(prev) − shift(next)`,
 * so what each gap owes depends on **that pair** and no other. The first version
 * charged every gap the widest spread any pair could produce, which is safe and
 * expensive — it spent a fifth of the wall on air and pulled the coverage under
 * the floor the facade is judged on.
 *
 * The two end gaps are a different constraint: they keep a board from appearing
 * to hang off the end of the wall it is fixed to. A front-wall board shifts left,
 * so the low end owes; on the side wall the shift is rightward and the high end
 * owes. Both fall out of the same expression.
 */
function gapsFor(shifts: number[]): number[] {
  if (shifts.length === 0) return [0]
  const needs = [Math.max(0, -shifts[0])]
  for (let i = 1; i < shifts.length; i++) needs.push(Math.max(0, shifts[i - 1] - shifts[i]))
  needs.push(Math.max(0, shifts[shifts.length - 1]))
  return needs
}

export interface Packed {
  tiles: Tile[]
  /** Total board area over panel area. The 50–70% requirement. */
  coverage: number
}

interface Choice {
  text: string
  order: number
  kind: SignKind
  livery: import('./types').SignLivery
  block: 'start' | 'end' | null
  len: number
  height: number
  span: number
  cap: number
  out: number
}

/**
 * Fit the whole sentence into exactly `form.rows` rows, or fail.
 *
 * Failing is the useful half: `layout.ts` walks the row count upward and takes
 * the first that works.
 *
 * **Two passes, and the split is what makes growth monotone.** The first is plain
 * greedy — fill a row, move down — and it alone decides whether the row count
 * works. Because a word's kind depends only on the word and its index, greedy
 * packs any prefix identically no matter what follows it, so adding a word can
 * only turn a fit into a non-fit and the smallest feasible row count can only
 * rise. The second pass spreads the same words evenly down the rows, which needs
 * to know how many words there are in total and therefore *cannot* be trusted
 * with the row count — greedy on its own leaves the lower floors bare, and a
 * quota inside the feasibility pass turned eight rows into six when one word was
 * added. So the quota runs only after the row count is settled, and if it fails
 * the plain packing stands.
 */
export function packInto(
  form: Form,
  words: MeasuredWord[],
  style: Style,
  view: View,
): Packed | null {
  /*
   * The width every board takes when the dial is at zero: the widest the line
   * needs, so a tidy building is a stack of identical plates and nothing has to
   * be squeezed to achieve it.
   */
  const uniform = words.reduce(
    (m, w) => Math.max(m, tileLength(w, 'band', 'panel', null, style.pad)),
    MIN_BOARD,
  )
  /*
   * Three attempts, and the order of them is the design.
   *
   * Greedy decides whether the words fit at all — that answer must not depend on
   * any layout preference, or a preference becomes a lost sentence. Then the
   * balanced pass, which spreads the line down the storeys *and* across the two
   * walls. If the side wall cannot take what it was dealt, the same spread
   * without the two-wall split usually can; only if that fails too does the
   * greedy packing stand.
   */
  const plain = run(form, words, style, view, uniform, { spread: false, balance: false })
  if (!plain) return null

  /*
   * Attempts, loosest-looking first.
   *
   * The bottom-weighted profile is tight by construction — it allocates almost
   * exactly as many slots as there are words — so one storey that cannot take
   * its share sinks the whole pass and the facade drops back to the greedy
   * packing, top-heavy and one-walled. Giving the profile a slot or two of slack
   * before abandoning it keeps the shape of the thing far more often than not.
   */
  const tiles =
    run(form, words, style, view, uniform, { spread: true, balance: true }) ??
    run(form, words, style, view, uniform, { spread: true, balance: true, relax: 1 }) ??
    run(form, words, style, view, uniform, { spread: true, balance: false, relax: 1 }) ??
    run(form, words, style, view, uniform, { spread: true, balance: false, relax: 3 }) ??
    plain

  const area = tiles.reduce((total, t) => total + (t.s1 - t.s0) * t.height, 0)
  return { tiles, coverage: area / (form.wall.total * form.panel) }
}

function run(
  form: Form,
  words: MeasuredWord[],
  style: Style,
  view: View,
  uniform: number,
  { spread, balance, relax = 0 }: { spread: boolean; balance: boolean; relax?: number },
): Tile[] | null {
  const tidy = Math.min(1, Math.max(0, style.order))
  // One board to a storey when tidy, up to three when not.
  const perRow = 1 + Math.floor(tidy * 2.4)
  /*
   * Whether there is a second wall to deal boards to at all.
   *
   * Near dead-on the side wall's screen width goes to nothing, so a board put
   * there would be invisible and the gaps it owes are wider than the wall. Slots
   * reserved for it are storeys left blank, which is what happened: a front view
   * came out with every other floor bare.
   */
  const twoWalled = view.azimuth >= 4
  const { wall, rows } = form
  const reserved: Seg[][] = Array.from({ length: rows }, () => [])
  const tiles: Tile[] = []
  const inset = PITCH * TOP_INSET
  let next = 0

  for (let row = 0; row < rows && next < words.length; row++) {
    /*
     * **Sparse at the top, busy at the street.**
     *
     * Every reference does this and none does the opposite: the upper storeys of
     * a shop-house are windows with a sign or two, and everything else piles up
     * over the shopfront. Spreading the line evenly up the building is what made
     * it read as an office block with signage stuck on.
     *
     * **The feasibility pass has no cap at all.** Its only job is to say whether
     * the words fit the building, and a cap there turns a layout choice into a
     * lost sentence — which it did: a nine-word line on a four-storey shop-house
     * failed every row count and the fallback handed back nothing.
     */
    /*
     * Allocated on a **bottom-weighted profile**, not spread evenly.
     *
     * Every reference does this and none does the opposite: the upper storeys of
     * a shop-house are windows with a sign or two, and everything else piles up
     * over the shopfront. An even spread is what made it read as an office block
     * with signage stuck on.
     *
     * Recomputed from what is left at each storey, so a row that could not take
     * its share hands it downward instead of stranding the sentence.
     */
    const share = (r: number) => (r < rows * 0.45 ? 1 : 2.6)
    let ahead = 0
    for (let r = row; r < rows; r++) ahead += share(r)
    const want = Math.max(1, Math.round(((words.length - next) * share(row)) / ahead))
    const quota = spread ? Math.min(row < rows * 0.45 ? 1 : perRow, want) + relax : Infinity

    /*
     * Deal the row's boards across its two walls instead of letting the front
     * take them all.
     *
     * The front segment comes first in `s`, so a greedy row filled it and left
     * the side wall whatever was over — which was nothing, once the spread pass
     * had cut the row down to a single board. The lower half of the side wall
     * came out bare.
     *
     * Words still go on in order: the front wall holds the earlier `s`, so it
     * takes the earlier word. All that changes is **how many** each wall may
     * take. When only one board is going, the walls alternate by storey. Below a
     * little Order the side is left out entirely, because a tidy building is a
     * column on the main facade and nothing else.
     */
    let frontLeft = quota
    let sideLeft = 0
    if (balance && Number.isFinite(quota) && tidy >= 0.15 && twoWalled) {
      if (quota === 1) {
        sideLeft = row % 2 === 1 ? 1 : 0
        frontLeft = 1 - sideLeft
      } else {
        sideLeft = Math.floor(quota / 2)
        frontLeft = quota - sideLeft
      }
    }
    let placed = 0

    // The corner is a segment boundary, not a rule to remember.
    const segs = subtract(
      [
        { a: 0, b: wall.width },
        { a: wall.width, b: wall.total },
      ],
      reserved[row],
    )

    for (const [segIndex, seg] of segs.entries()) {
      const room = seg.b - seg.a
      if (room < MIN_BOARD || next >= words.length) continue

      const facing = atS(wall, (seg.a + seg.b) / 2).facing
      const side = facing === 'right'
      const allowed = side ? sideLeft : frontLeft
      if (allowed <= 0) continue
      // Denser toward the street, sparser up top — how a building fills up, and
      // refs 05/09/10 all do it. A function of the row index alone, so it cannot
      // disturb the prefix packing the growth guarantee rests on.
      const rand = mulberry32(hashSeed(style.seed, row * 977 + segIndex))
      const chosen: Choice[] = []
      let used = 0

      const shiftsOf = (list: Choice[]) => list.map((c) => shiftOf(facing, c.out, view))
      const overhead = (list: Choice[]) => sum(gapsFor(shiftsOf(list)))

      while (next < words.length && chosen.length < allowed && placed + chosen.length < quota) {
        const word = words[next]
        let kind = kindFor(word, next, style.seed, tidy)
        /*
         * **The side wall prefers a vertical column.**
         *
         * That stack of tall narrow panels down the corner is the one thing every
         * shop-house reference has, and the side wall is where it can live: it is
         * last in the row, so a board there reads after the facade's and the
         * sentence is undisturbed. It also suits the wall — a face that narrow
         * fits a column of syllables and not much else.
         */
        if (side && tidy >= 0.15 && [...word.text].length <= 3 && row + 2 <= rows) {
          kind = 'blade'
        }
        // A blade that would hang past the bottom of the panel becomes a board.
        if (KINDS[kind].span + row > rows) kind = 'box'

        /*
         * The word sets the width, and the dial decides how far the board is
         * allowed to be its own size. At zero every horizontal board takes the
         * uniform width and the facade comes out as a column of identical
         * plates; at one each takes exactly what its text needs.
         */
        const { livery, block } = liveryFor(next, style.seed, tidy)
        const natural = tileLength(word, kind, livery, block, style.pad)
        let len = KINDS[kind].vertical ? natural : uniform + (natural - uniform) * tidy
        const out = outFor(kind, side, style.depth)
        const entry: Choice = {
          text: word.text,
          order: next,
          kind,
          livery,
          block,
          len,
          height: tileHeight(kind),
          span: KINDS[kind].span,
          cap: capOf(kind, livery),
          out,
        }
        const gaps = overhead([...chosen, entry])

        if (len + used + gaps > room) {
          if (chosen.length > 0) break
          /*
           * Too long for this stretch of wall, even alone.
           *
           * **Only a full front wall squeezes.** The building is sized so its
           * front wall holds the sentence's widest word, so a squeeze there is a
           * last resort that almost never fires. The side wall has no such
           * guarantee — it is narrow by design — and neither does a front wall cut
           * in half by the blade hanging down from the storey above. Squeezing in
           * either would shrink that word's type for nothing. Leave it for the
           * next storey; no word is ever dropped either way.
           */
          if (side || room < wall.width * 0.7 || room - gaps < MIN_BOARD) break
          len = room - gaps
          entry.len = len
        }

        chosen.push(entry)
        used += len
        next++
      }

      placed += chosen.length
      if (side) sideLeft -= chosen.length
      else frontLeft -= chosen.length

      if (chosen.length === 0) continue

      const needs = gapsFor(shiftsOf(chosen))
      // At zero the weights are equal, so a lone board lands dead centre and the
      // column stacks true. The jitter arrives with the dial, not before it.
      const weights = needs.map(() => 1 + (rand() - 0.5) * 1.1 * tidy)

      /*
       * A vertical board drifts to the corner.
       *
       * The signature of a 종로 shop-house is a **stack of vertical panels at the
       * corner**, running several storeys — not blades scattered along the
       * facade. Sending the row's last vertical to the far end of the front wall
       * makes consecutive storeys stack into that column on their own, and it
       * costs nothing: the board was already last in `s`, so the reading order is
       * untouched.
       */
      if (!side && KINDS[chosen[chosen.length - 1].kind].vertical) {
        weights[chosen.length - 1] = 5
      }
      const share = sum(weights)
      const spare = Math.max(0, room - used - sum(needs))

      let cursor = seg.a
      chosen.forEach((c, i) => {
        cursor += needs[i] + (spare * weights[i]) / share
        // Every board hangs from the storey line above it. No jitter: the
        // references are strict about this, and a row of boards at wandering
        // heights reads as stickers rather than as a fascia.
        tiles.push({
          text: c.text,
          order: c.order,
          row,
          kind: c.kind,
          livery: c.livery,
          block: c.block,
          s0: cursor,
          s1: cursor + c.len,
          y: rowTop(form, row) - inset - c.height,
          height: c.height,
          cap: c.cap,
          out: c.out,
        })
        if (c.span > 1) {
          // Widened by what the gaps owe: a board in the row below could slide
          // under the blade on screen while staying clear of it on the wall.
          const clear = BLADE_CLEAR + needs[i] + needs[i + 1]
          const hole = { a: cursor - clear, b: cursor + c.len + clear }
          for (let r = row + 1; r < Math.min(rows, row + c.span); r++) reserved[r].push(hole)
        }
        cursor += c.len
      })
    }
  }

  return next < words.length ? null : tiles
}

export type { Facing }
