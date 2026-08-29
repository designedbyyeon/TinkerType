/**
 * What the layout engine takes in and hands back.
 *
 * Nothing here knows about three.js, and nothing here knows about fonts. Text
 * arrives already measured — a list of advances at cap height 1 — so the whole
 * engine is arithmetic and can be tested without a browser or a typeface.
 *
 * That separation is also the insurance. If the 3D render turns out wrong, the
 * renderer is the only thing that gets replaced.
 */

/**
 * One word, measured. Advances are per character at cap height 1.
 *
 * `top` and `bottom` are the **ink**, not the em box, and they are here because
 * centring type by its em box is wrong. 조선견고딕 hangs its syllables about a
 * tenth of a cap below the baseline, so a board centred on the cap box sits its
 * lettering a tenth low — small, and unmistakable once seen. Measure what is
 * actually drawn and the sag goes away for any face and any word, including the
 * ones ending in a full stop.
 */
export interface MeasuredWord {
  text: string
  advances: number[]
  /** Sum of the advances. */
  width: number
  /** Highest and lowest ink, in cap units, y up from the baseline. */
  top: number
  bottom: number
}

/**
 * The kinds of sign, which are really **depth families**.
 *
 * The scrapped tool's signs were all thin plates at one standoff, and that is
 * most of why the wall read as a patchwork rather than as a street. Density in
 * refs 05/09/10 comes from boards at genuinely different distances from the
 * wall, overlapping in projection and shading each other.
 */
export type SignKind = 'band' | 'panel' | 'box' | 'standoff' | 'blade'

/**
 * How a sign is made, as opposed to how it is mounted.
 *
 * `SignKind` is the carpentry — how big the board is and how far it stands off
 * the wall. This is the **shopfitting**, and it is what makes two signs the same
 * size read as two different businesses.
 *
 * With one colour to work with, the variety has to come from **polarity, edge and
 * type**, which is how real signage does it anyway. Four is the right number: two
 * is a pattern, six is noise, and these four are the ones a Korean street
 * actually shows.
 *
 * Three, and the lettering is dark on all of them. What changes is **what the
 * lettering is on**:
 *
 * - `panel` — a solid coloured board. The plain fascia, and the commonest.
 * - `plate` — a pale board, no edge, no trim. An office or a clinic.
 * - `channel` — **no board at all.** Letters fixed straight to the wall,
 *   standing proud of it. The one that changes the facade rather than
 *   decorating it.
 * - `underline` — a pale board with a coloured bar along its foot. The trade
 *   name above, the strip below, which is where a phone number would go.
 * - `knockout` — a coloured board with the lettering reversed out of it. The
 *   only one whose type is pale, so it reads as the lit one.
 *
 * A *dark* board with the colour reversed out was here too and is gone: at any
 * useful frequency it turned an orange building grey, and it competed with the
 * signs carrying the sentence rather than joining them.
 */
export type SignLivery = 'panel' | 'plate' | 'channel' | 'underline' | 'knockout'

export interface LiverySpec {
  /** Type size against the board's own. A plate sets smaller than a fascia. */
  cap: number
  /** Extra space between letters, in cap units. */
  tracking: number
  /** Whether a board is drawn at all. */
  board: boolean
  /** Chance of a logo block at one end, which no two trades use alike. */
  block: number
  /** Share of the board's height taken by a bar along its foot. */
  foot: number
  weight: number
}

export interface KindSpec {
  /** How far the board's back sits off the wall plane. */
  out: number
  /** How many rows a board of this kind occupies. Blades hang. */
  span: number
  /** Syllables stacked downward instead of run along. */
  vertical: boolean
  /** Type size relative to the nominal cap. A bigger board carries bigger type. */
  cap: number
  /** Chance of being drawn, before the vertical-only filter. */
  weight: number
}

/**
 * One placed board: which row, where along the merged wall line, how tall.
 *
 * **Every board carries a word. There is exactly one board per word.** An earlier
 * version filled the wall out with blank boards — the neighbours' signage — to
 * reach a density the sentence alone could not. It made the building look right
 * and the tool wrong: a sign with nothing on it is a decoration, and this is a
 * typography tool. The count comes from the text, and the building is sized to
 * suit the count rather than the other way round.
 */
export interface Tile {
  text: string
  /** Index in the original line. The reading invariant is about this. */
  order: number
  row: number
  kind: SignKind
  /** Start and end along the merged wall line. Never straddles the corner. */
  s0: number
  s1: number
  /** World y of the board's bottom and its height. */
  y: number
  height: number
  /** Type size for this board. */
  cap: number
  /** How the sign is made. */
  livery: SignLivery
  /** A logo block at one end of the board, or neither end. */
  block: 'start' | 'end' | null
  /**
   * Standoff from the wall plane.
   *
   * Decided during packing, not by the kind alone: the packer knows which wall
   * the board landed on, and the side wall cannot take a deep board without the
   * projection throwing it out of reading order. See `shiftOf` in `wall.ts`.
   */
  out: number
}

/** A volume of the building. Nothing here ever cuts into the sign panel. */
export interface Mass {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  /** Which palette entry, so the renderer does not have to invent one. */
  tone: number
}

export interface Style {
  seed: number
  /**
   * Tidy at 0, a street at 1.
   *
   * The one dial that moves everything at once. At zero every board is the same
   * width, the same height and the same type size, one to a storey, stacked in a
   * column — a specimen sheet. Turning it up lets each board take its own word's
   * width, lets the kinds and depths vary, lets a vertical column appear, and
   * lets a storey carry more than one sign.
   *
   * It is a dial rather than a switch because the interesting settings are in
   * between: a building that is *mostly* ordered reads as designed, and one that
   * is entirely disordered reads as noise.
   */
  order: number

  /**
   * Air around a word inside its board.
   *
   * **A board's width comes from its word**, not from the storey it sits on. An
   * earlier version stretched every board out to a share of the wall, which made
   * a one-syllable sign the same size as a five-syllable one — the boards stopped
   * being typography and became a grid. This is the only thing that widens them.
   */
  pad: number
  /**
   * The building's proportions, as multipliers on what the line asked for.
   *
   * Neither of these changes what the sentence says, only the shape it has to
   * fit into — and the packer takes it from there. A wider building fits more
   * words per storey, so the same line comes out shorter; a taller one spreads
   * the same words over more storeys. **The arrangement is a consequence, never
   * a separate setting**, which is why there is no "words per row" control.
   */
  width: number
  height: number
  /** The side wall's depth, as a share of the front wall's width. */
  girth: number
  /** Multiplies every board's standoff. */
  depth: number
  /**
   * Where the camera stands, in degrees off dead-on.
   *
   * **Not just a view.** A board standing off the wall shifts sideways on screen
   * by an amount that depends on this angle, and the packer holds gaps wide
   * enough to absorb it — so the angle is an input to the arrangement, not a
   * thing you choose afterwards. At zero the side wall has no screen width at
   * all and the packer stops using it, which falls out of the same arithmetic
   * rather than needing a special case.
   */
  azimuth: number
  /**
   * **One colour, for every sign.**
   *
   * The building was cycling six. It read as a colour chart rather than as a
   * street, and worse, it made the palette the subject — the eye sorted the
   * boards by hue instead of reading them. One colour against a quiet wall puts
   * the sentence back in charge, and it is the site's own accent, so the tool
   * looks like it belongs to the site rather than to itself.
   */
  sign: string
}

/**
 * The site's accent, and the building's own grey.
 *
 * `--accent` is a screen token — the rule there is that it marks the one thing
 * that is on, and it is never decoration. On the artwork side it is doing the
 * same job for the same reason: the signs are the one thing that is on, and the
 * building is the ground they are on. Literals rather than `var()`, like
 * everything else that leaves the app (`styles/canvas.ts`).
 */
export const SIGN_COLOUR = '#ff4a12'
export const WALL_COLOUR = '#cbc7bd'

export const DEFAULT_STYLE: Style = {
  seed: 29,
  order: 0.55,
  pad: 0.45,
  width: 1,
  height: 1,
  girth: 0.55,
  depth: 0.25,
  azimuth: 21,
  sign: SIGN_COLOUR,
}
