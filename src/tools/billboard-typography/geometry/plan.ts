import { mulberry32 } from '../../../shared/geometry/vec'
import { wallOf, type View, type Wall } from './wall'
import type { Mass } from './types'

/**
 * The building's form, and the numbers everything else is measured in.
 *
 * The requirement is that **the line's length sets the row count and the row
 * count sets the building.** So the causality runs one way only: rows in,
 * footprint out. The packer then reports how many rows it actually needed and
 * the search in `layout.ts` takes the smallest that fits.
 *
 * Fixing the aspect ratio rather than the width is what makes that search
 * well-behaved. For a given row count the panel's size is determined, so
 * `fits(r)` depends on the words alone — and appending a word can only ever turn
 * a fit into a non-fit, never the reverse. The smallest feasible `r` is
 * therefore monotone in the sentence, which is exactly the growth invariant the
 * tool promises. Deriving the width from the total ink instead makes the two
 * grow together and the row count can then *drop* when a word is added.
 */

/**
 * The camera.
 *
 * The elevation is fixed — the whole arrangement is built on looking slightly
 * down at a building, and there is nothing to gain from letting that wander. The
 * **azimuth is a control**, because the two things it changes are both worth
 * having: how much of the side wall you see, and, at the far end, whether there
 * is a side wall in the composition at all.
 *
 * It lives here rather than in the renderer because a board's standoff shifts it
 * sideways on screen, and the packer holds gaps wide enough to absorb that. The
 * angle is an input to the arrangement, not a thing chosen afterwards.
 */
export const OBLIQUE: View = { azimuth: 21, elevation: 12 }
export const CAMERA = OBLIQUE

/**
 * **One dial, not two.** The elevation rides along with the azimuth.
 *
 * Holding the elevation fixed made "angle zero" a front view seen slightly from
 * above, which is neither one thing nor the other — you cannot read a facade
 * squarely and you cannot see the roof properly either. Tying them together
 * makes the control mean *how oblique*: at zero it is a true front elevation, at
 * the default it is the three-quarter view the building was designed for, and
 * past that it keeps turning.
 */
export const viewOf = (azimuth: number): View => ({
  azimuth,
  elevation: (azimuth * OBLIQUE.elevation) / OBLIQUE.azimuth,
})

/** Height of one row band, in cap units. */
export const PITCH = 2.9

/**
 * Share of a row band a board fills.
 *
 * Under half, and that is the whole reason the wall reads. In a Korean
 * shop-building the signs run the full **width** of a storey and leave a strip of
 * concrete and window under each one — the wall shows between the *rows*, not
 * between the boards. Getting that backwards (narrow boards, tall boards) is what
 * made an earlier version a stack of coloured tiles.
 *
 * What is left over is not slack: it is the window course, and it has to be tall
 * enough to hold an opening worth looking into.
 */
export const TILE_HEIGHT = 0.46

/**
 * Air between a board and the storey line above it.
 *
 * Small, and at the **top** rather than split either side. Signage in the
 * references hangs from the slab above; centring a board in its storey left it
 * floating in the middle of the wall with nothing to belong to, and it took the
 * window course's height with it.
 */
export const TOP_INSET = 0.08

/**
 * Panel height over merged wall length. Fixed, so the search is monotone.
 *
 * Under one, because a 상가 is **wider than it is tall**. At 1.05 the building
 * came out a tower with a shop at the bottom, which is a different animal from
 * the three- and four-storey shop-houses of 종로 and 을지로 — those are squat,
 * and the squatness is most of why they read as one premises rather than as an
 * office block.
 */
export const ASPECT = 0.78

/** Depth over width, in plan. The side wall is a real face but a minor one. */
export const DEPTH_RATIO = 0.55

/** Breathing space inside a board, each side, at cap 1. */
export const PAD = 0.42

export const MIN_ROWS = 3
/**
 * The ceiling exists for the tidy specimen mode, not for the street.
 *
 * At Order 1 the shop-house rate keeps a long line to five or six storeys on its
 * own; at Order 0 a storey per word is the whole point, so a long line genuinely
 * wants a tall column and clamping it low made the packing fall back to a
 * jumbled facade — the dial silently stopped meaning what it says.
 */
export const MAX_ROWS = 24

/**
 * How tall a building a line of this many words deserves.
 *
 * The requirement, taken literally: **the length of the line sets the row count
 * and the row count sets the building.** Letting the packer decide instead — the
 * smallest row count the words would fit into — produced a squat five-storey
 * block for a nine-word line, with each board a quarter of the wall wide. The
 * boards were not too big; the building was too small.
 *
 * Monotone by inspection, which is the other reason to state it outright rather
 * than infer it from packing.
 *
 * A shop-house is three to five storeys whatever it has to say, so a long line
 * makes a **busier facade rather than a taller building** — which is what the
 * references show: one storey of a 학원 carries a whole line of characters spread
 * across its window band. An earlier rate built a sixteen-storey tower out of a
 * sentence, and no amount of detailing was going to make that read as one
 * premises.
 */
export const rowsFor = (words: number, order = 1): number => {
  const tidy = Math.min(1, Math.max(0, order))
  /*
   * **Derived from capacity, not from a rate.**
   *
   * A rate per word had to be guessed, and the guess disagreed with how many
   * boards a storey would actually take — so a mid-dial building came out six
   * storeys when the same words fitted comfortably on four. Ask the real
   * question instead: how many storeys does this many words need, given how many
   * boards a storey holds at this setting?
   *
   * `perRow` is the same number the packer uses, and the upper storeys take one
   * board each whatever it says, so the capacity has to count them separately.
   * Monotone in the word count by inspection, which the growth guarantee needs.
   */
  const perRow = 1 + Math.round(tidy * 3)
  const holds = (rows: number) => Math.ceil(rows * 0.45) + Math.floor(rows * 0.55) * perRow

  // One board of slack. With none, a single storey that cannot take its allotted
  // board — a side wall too narrow for the word that fell to it — cascades into
  // the whole balanced pass failing, and the facade drops back to the greedy one.
  let rows = MIN_ROWS
  while (rows < MAX_ROWS && holds(rows) < words + 1) rows++
  return rows
}

/** Ground floor. Shopfront territory, below the sign panel. */
export const PLINTH = PITCH * 1.2

/** Thickness of the facade skin the openings are cut through. */
export const SKIN = 0.3

/**
 * How far the floor slabs project past the facade.
 *
 * Shared, because the signs have to clear it. A board that spans two storeys —
 * every vertical column does — **crosses a slab by definition**, and if the slab
 * stands further off the wall than the board does, the slab is drawn across the
 * front of the sign and cuts the word in half. It did.
 */
export const SLAB_OUT = 0.32

/** Parapet and roof clutter allowance above the panel. */
export const CROWN = PITCH * 0.42

export interface Form {
  wall: Wall
  rows: number
  /** Height of the sign panel alone. */
  panel: number
  /** World y of the panel's bottom edge. */
  panelBase: number
  /** Total height of the main mass. */
  height: number
}

export function formFor(rows: number, spread = 1, girth = DEPTH_RATIO): Form {
  const panel = rows * PITCH
  const front = ((panel / ASPECT) * spread) / (1 + DEPTH_RATIO)
  const total = front * (1 + girth)
  return {
    wall: wallOf(front, total - front),
    rows,
    panel,
    panelBase: PLINTH,
    height: PLINTH + panel + CROWN,
  }
}

/** World y of a row band's top edge. Row 0 is the top: the line reads downward. */
export const rowTop = (form: Form, row: number): number =>
  form.panelBase + (form.rows - row) * PITCH

/**
 * The volumes. **Two of them, and that is the whole building.**
 *
 * A shop-building in the shape references is a plain box with a shopfront at
 * street level, and everything interesting on it is signage. The earlier version
 * put a rooftop hut, water tanks on legs, a terrace railing and awnings on it,
 * and it read as invented — the roof especially, where a made-up hut competes
 * with the crown of the building and loses.
 *
 * So: the prism, and a plinth for the ground floor. The roof gets a parapet and
 * nothing else. The ground floor gets glazing and nothing else. What is left is a
 * building carrying a sentence, which is what the tool is for.
 *
 * Neither volume cuts into the sign panel, which is what keeps the sign area a
 * clean rectangle and the reading rule a one-line sort.
 */
export function massesFor(form: Form, seed: number): Mass[] {
  const { width: W, depth: D } = form.wall
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  // Just enough for the shopfront to sit proud of the wall above it.
  const jut = 0.4 + rand() * 0.3
  return [
    { x: 0, y: 0, z: 0, w: W, h: form.height, d: D, tone: 0 },
    { x: -jut, y: 0, z: 0, w: W + jut * 2, h: PLINTH, d: D + jut, tone: 1 },
  ]
}
