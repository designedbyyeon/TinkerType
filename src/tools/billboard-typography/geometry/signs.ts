import { mulberry32 } from '../../../shared/geometry/vec'
import { CANVAS_GROUND, CANVAS_INK } from '../../../shared/styles/canvas'
import { PAD, PITCH, SLAB_OUT, TILE_HEIGHT } from './plan'
import type {
  KindSpec,
  LiverySpec,
  MeasuredWord,
  SignKind,
  SignLivery,
  Style,
  Tile,
} from './types'

/**
 * What kind of sign a word becomes, how long its board is, and where its
 * letters sit on it.
 *
 * **The kind is decided before the sentence is broken up, not after.** Deciding
 * afterwards was a real bug in the scrapped tool: every board came out the same
 * type and the seed did nothing, because by the time the kind was chosen the
 * lengths were already fixed and only one kind could fit. So the kind comes from
 * the word and its index alone — never from how packing happened to go — which
 * has a second benefit that the growth invariant depends on: appending a word
 * cannot change any earlier word's kind, so the packing of a prefix is exactly
 * what it was.
 */

/*
 * The sign types of a Korean 상가건물, from the shape references.
 *
 * The dominant one is not a plate at all — it is a **fascia band that runs the
 * width of the storey**, one per floor, stacked up the building with a strip of
 * wall and windows between. Boards of a few different depths share a row with it,
 * and vertical columns run down the corner past several floors.
 *
 * The type is roughly the same size on all of them, which is worth stating
 * because the previous version did the opposite: the variety in the reference is
 * in a sign's **length and depth**, not in its type size. A band is long because
 * it says more, not because it shouts louder.
 */
export const KINDS: Record<SignKind, KindSpec> = {
  band: { out: 0.26, span: 1, vertical: false, cap: 1, weight: 0.42 },
  panel: { out: 0.68, span: 1, vertical: false, cap: 0.92, weight: 0.26 },
  box: { out: 1.35, span: 1, vertical: false, cap: 1.06, weight: 0.18 },
  standoff: { out: 2.2, span: 1, vertical: false, cap: 1.18, weight: 0.14 },
  // Vertical, and it hangs into the row below. Refs 05/06/11 keep making this
  // shape, and it is the only one that fills a gap too narrow for a board.
  blade: { out: 1.5, span: 2, vertical: true, cap: 1.05, weight: 0 },
}

const HORIZONTAL: SignKind[] = ['band', 'panel', 'box', 'standoff']

export const LIVERIES: Record<SignLivery, LiverySpec> = {
  /*
   * Weighted toward the plain fascia on purpose. The dark and pale boards are
   * the accents *within* the signage, and a street where half the shops reverse
   * out is a street that has lost its colour — which is what the first balance
   * did, turning an orange building grey.
   */
  panel: { cap: 1, tracking: 0, board: true, block: 0, foot: 0, weight: 0.34 },
  plate: { cap: 0.88, tracking: 0.03, board: true, block: 0, foot: 0, weight: 0.2 },
  channel: { cap: 1.02, tracking: 0.05, board: false, block: 0, foot: 0, weight: 0.16 },
  underline: { cap: 0.86, tracking: 0.02, board: true, block: 0, foot: 0.24, weight: 0.16 },
  knockout: { cap: 0.98, tracking: 0.02, board: true, block: 0, foot: 0, weight: 0.14 },
}

const LIVERY_LIST = Object.keys(LIVERIES) as SignLivery[]

/**
 * Which shopfitting a word gets, and whether it carries a logo block.
 *
 * Drawn from its own seed stream, not from the kind's — a board's size and a
 * board's trade have nothing to do with each other, and tying them would make
 * every deep box look like the same shop. Tidy at zero puts every sign back to
 * the plain fascia, which is what makes the Order dial mean one thing.
 */
export function liveryFor(
  order: number,
  seed: number,
  tidy: number,
): { livery: SignLivery; block: 'start' | 'end' | null } {
  if (tidy <= 0.001) return { livery: 'panel', block: null }
  const rand = mulberry32(hashSeed(seed ^ 0x5bf03635, order))
  if (rand() > tidy) return { livery: 'panel', block: null }

  const total = LIVERY_LIST.reduce((sum, k) => sum + LIVERIES[k].weight, 0)
  let roll = rand() * total
  let livery: SignLivery = 'panel'
  for (const k of LIVERY_LIST) {
    roll -= LIVERIES[k].weight
    if (roll <= 0) {
      livery = k
      break
    }
  }
  const wants = rand() < LIVERIES[livery].block * tidy
  return { livery, block: wants ? (rand() < 0.5 ? 'start' : 'end') : null }
}

/**
 * Stir two integers into a seed.
 *
 * **Mulberry32 does not like arithmetic sequences.** Seeding it with
 * `seed * A + index * B` gives streams whose *first* draw decorrelates fine and
 * whose third does not — which is exactly where the kind is chosen, so a nine
 * word line came out with two kinds instead of five and the variety dial looked
 * broken. It was not: the generator was being fed a ramp. Avalanche the bits
 * first and the third draw is as good as the first.
 */
export function hashSeed(a: number, b: number): number {
  let h = (Math.imul(a >>> 0, 0x9e3779b1) ^ Math.imul(b >>> 0, 0x85ebca6b)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return h >>> 0
}

/** Boards that can carry a vertical stack without the type going tiny. */
const BLADE_MAX_SYLLABLES = 3
const BLADE_CHANCE = 0.24

/**
 * What kind a word's board is. Deterministic per word, so a prefix always packs
 * the same way — which is what the growth guarantee rests on.
 *
 * `tidy` is the dial. At zero every board is a plain fascia band: same depth,
 * same type size, same height. Turning it up admits the other kinds in
 * proportion, so the building drifts from a specimen sheet toward a street
 * without ever jumping.
 */
export function kindFor(
  word: MeasuredWord,
  order: number,
  seed: number,
  tidy: number,
): SignKind {
  if (tidy <= 0.001) return 'band'
  const rand = mulberry32(hashSeed(seed, order))
  const n = [...word.text].length
  if (n <= BLADE_MAX_SYLLABLES && n > 0 && rand() < BLADE_CHANCE * tidy) return 'blade'
  // Everything that is not admitted by the dial falls back to the plain band.
  if (rand() > tidy) return 'band'

  const total = HORIZONTAL.reduce((sum, k) => sum + KINDS[k].weight, 0)
  let roll = rand() * total
  for (const k of HORIZONTAL) {
    roll -= KINDS[k].weight
    if (roll <= 0) return k
  }
  return 'band'
}

/** Type size on a board, once its kind and its shopfitting have both had a say. */
export const capOf = (kind: SignKind, livery: SignLivery = 'panel'): number =>
  KINDS[kind].cap * LIVERIES[livery].cap

/**
 * How much of the merged wall line a word's board takes up.
 *
 * **The word decides.** The board is its text plus air, and nothing else — not a
 * share of the storey, not a grid column. That is the difference between a sign
 * and a tile, and an earlier version got it wrong in a way that made a
 * one-syllable shop the same size as a five-syllable one.
 */
export function tileLength(
  word: MeasuredWord,
  kind: SignKind,
  livery: SignLivery,
  block: 'start' | 'end' | null,
  pad: number,
): number {
  const spec = KINDS[kind]
  const dress = LIVERIES[livery]
  const cap = spec.cap * dress.cap
  const air = PAD * (0.4 + pad * 1.6)
  if (spec.vertical) {
    // A blade is one column wide: the widest single character, not the run.
    const widest = word.advances.reduce((m, a) => Math.max(m, a), 0)
    return widest * cap + air * 1.6
  }
  const chars = Math.max(1, [...word.text].length)
  const run = word.width * cap + dress.tracking * cap * (chars - 1)
  return run + air * 2 + (block ? cap * 0.85 : 0)
}

/** Width of the logo block on a board of this height. Square, and modest. */
export const blockWidth = (cap: number): number => cap * 0.85

/**
 * The widest board a word could possibly end up on.
 *
 * The building is sized so its front wall holds the sentence's longest word, and
 * that guarantee is only worth having if it accounts for the **widest** the word
 * might be drawn — a deep standoff board sets larger type than a flat band, and
 * a logo block adds a square on the end. Measuring the plain case let a hero
 * board come out a third wider than the wall it was promised, and the packer had
 * to squeeze its type to fit.
 */
export function maxTileLength(word: MeasuredWord, pad: number): number {
  let widest = 0
  for (const kind of HORIZONTAL) {
    for (const livery of LIVERY_LIST) {
      for (const block of [null, 'end'] as const) {
        widest = Math.max(widest, tileLength(word, kind, livery, block, pad))
      }
    }
  }
  return widest
}

/** How tall a board of this kind is, given how many rows it spans. */
export function tileHeight(kind: SignKind): number {
  const spec = KINDS[kind]
  return spec.span * PITCH - PITCH * (1 - TILE_HEIGHT)
}

/** Rough relative luminance. Enough to pick between ink and paper for the type. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** One character, positioned in the board's own frame. */
export interface Letter {
  char: string
  /** From the board's low-s edge. */
  along: number
  /** From the board's bottom edge. */
  up: number
  cap: number
}

export interface Sign extends Tile {
  /** Board thickness. Deeper boards are chunkier boxes. */
  thick: number
  /** The board's face. Ignored when the livery has no board. */
  colour: string
  /** The lettering. */
  ink: string
  /** A bar along the board's foot, or none. */
  rule: string | null
  /** How tall that bar is. Zero when there is none. */
  foot: number
  /** Whether a board is drawn at all — `channel` letters go on the wall. */
  board: boolean
  letters: Letter[]
}

/**
 * The deepest a board may stand off the **side** wall.
 *
 * Low, and it has to be. At a shallow azimuth the side wall's screen extent is
 * squeezed by `sin a` while a standoff is projected at `cos a`, so a board two
 * units proud of it appears to move nearly the whole width of that wall — past
 * its neighbours, and the sentence comes out in the wrong order. Depth variety
 * lives on the front wall; the side wall stays close to the brick.
 */
export const SIDE_MAX_OUT = 0.5

export function outFor(kind: SignKind, side: boolean, depth: number): number {
  let out = KINDS[kind].out * depth
  /*
   * A board that spans storeys has to clear the slab it crosses.
   *
   * Not a rendering nicety: a vertical column runs past a floor line by
   * definition, so at a low Relief the slab — which projects whatever the
   * structure projects — was drawn in front of the sign and sliced the word.
   * The floor is on the standoff rather than on the dial, because the dial is
   * about how proud a sign looks and this is about whether it is buried.
   */
  if (KINDS[kind].span > 1) out = Math.max(out, SLAB_OUT + 0.08)
  return side ? Math.min(out, SIDE_MAX_OUT) : out
}

/**
 * A placed tile, dressed: depth, thickness, colour, and the letters on it.
 *
 * The type is fitted to the board rather than the other way round — a board's
 * length came from its word at its kind's cap, so the fit is normally exact, but
 * a word that had to be squeezed to fit a row gets smaller type instead of being
 * dropped. **Losing a word is the one thing this tool must never do.**
 */
/**
 * The four shopfittings, as colours.
 *
 * One accent, one ink, one paper, and the variety comes from **which of the
 * three is the board and which is the lettering**. That is how real signage gets
 * its variety too — a street of shops is rarely a street of different hues, it is
 * a street of different polarities.
 */
function palette(livery: SignLivery, accent: string) {
  const dark = luminance(accent) > 0.42 ? CANVAS_INK : CANVAS_GROUND
  switch (livery) {
    case 'plate':
      // No border. A keyline made every pale board read as the same shop.
      return { colour: CANVAS_GROUND, ink: CANVAS_INK, rule: null }
    case 'channel':
      // Letters on the wall, in ink. Not the accent: on a pale wall the accent
      // has nothing to sit against and the word stops being legible.
      return { colour: accent, ink: CANVAS_INK, rule: null }
    case 'underline':
      return { colour: CANVAS_GROUND, ink: CANVAS_INK, rule: accent }
    case 'knockout':
      // The one board whose type is pale. Against everything else on the
      // building it reads as the lit sign, which is what it is.
      return { colour: accent, ink: CANVAS_GROUND, rule: null }
    default:
      return { colour: accent, ink: dark, rule: null }
  }
}

export function dress(tile: Tile, word: MeasuredWord | null, style: Style): Sign {
  const spec = KINDS[tile.kind]
  const dressed = LIVERIES[tile.livery]
  const { colour, ink, rule } = palette(tile.livery, style.sign)
  const board = dressed.board

  const len = tile.s1 - tile.s0
  const letters: Letter[] = []
  const chars = word ? [...word.text] : []
  /*
   * Channel letters sit **on the wall**, so their board's standoff is spent.
   * Reducing it here is safe: the packer sized the gaps for the larger number,
   * and a smaller shift can only make the reading order more comfortable, never
   * less.
   */
  const out = board ? tile.out : Math.min(tile.out, 0.06)
  const foot = tile.height * dressed.foot
  const base = { ...tile, out, thick: 0.16 + out * 0.22, colour, ink, rule, foot, board }

  if (!word) return { ...base, letters }

  /*
   * Centred on the **ink**, never on the em box.
   *
   * A Hangul syllable in this face hangs about a tenth of a cap below the
   * baseline, so placing the baseline at `(height − cap) / 2` drops the lettering
   * by that tenth on every horizontal board. Measuring what is drawn fixes it
   * once, for every face and every word — a line ending in a full stop is
   * shallower than one that does not, and it lands right too.
   */
  const inkHeight = Math.max(0.05, word.top - word.bottom)
  // The foot bar takes the bottom of the board, so the type centres in what is
  // left and is lifted clear of it — not centred on the whole board and then
  // half-buried by its own rule.
  const sit = (height: number, cap: number) =>
    foot + (height - foot - inkHeight * cap) / 2 - word.bottom * cap

  if (spec.vertical) {
    const cap = Math.min(tile.cap, (tile.height - PAD) / Math.max(1, chars.length) / 1.06)
    const stack = cap * 1.06
    const top = tile.height - (tile.height - stack * chars.length) / 2
    chars.forEach((char, i) => {
      const advance = word.advances[i] ?? cap
      letters.push({
        char,
        along: (len - advance * cap) / 2,
        up: top - stack * (i + 1) + sit(stack, cap),
        cap,
      })
    })
  } else {
    // The logo block eats into the run from whichever end it sits at, so the
    // lettering centres in what is left rather than on the whole board.
    const room = len - (tile.block ? blockWidth(tile.cap) : 0)
    const inner = Math.max(room * 0.72, room - PAD * 2)
    const tracked = word.width + dressed.tracking * Math.max(0, chars.length - 1)
    const cap = Math.min(
      tile.cap,
      inner / Math.max(0.001, tracked),
      ((tile.height - foot) * 0.94) / inkHeight,
    )
    const run = tracked * cap
    let along = (tile.block === 'start' ? blockWidth(tile.cap) : 0) + (room - run) / 2
    chars.forEach((char, i) => {
      letters.push({ char, along, up: sit(tile.height, cap), cap })
      along += ((word.advances[i] ?? 0) + dressed.tracking) * cap
    })
  }

  return { ...base, letters }
}
