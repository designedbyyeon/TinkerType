import { drawGlyph, type Drawn, type Parsed } from '../../../shared/media/type/measure'
import type { Seg } from '../../../shared/media/type/measure'

/**
 * Setting a line of type around a circle.
 *
 * The letters are real outlines, not `<textPath>`. A designer opening the
 * exported file has to find Bézier contours they can pull points on — a text
 * element on a path is a promise that the font is installed wherever the file
 * lands, and it is not editable as a shape at all.
 *
 * Which means every letter is a `<path>` with a matrix. That matters for speed
 * too: the outline is pulled **once at `GLYPH_EM`** and everything after that is
 * six numbers. While a hand is driving the ring, sixty times a second, the only
 * thing that changes is those six numbers — the `d` attribute is untouched.
 */

/** Outlines are pulled at this em size, and placed by scaling the matrix. */
export const GLYPH_EM = 1000

/** SVG's `matrix(a b c d e f)`: (x, y) → (ax + cy + e, bx + dy + f). */
export type Matrix = [number, number, number, number, number, number]

export function compose(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

export function apply(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }
}

const round = (n: number) => Math.round(n * 1000) / 1000

export function matrixAttr(m: Matrix): string {
  return `matrix(${m.map(round).join(' ')})`
}

/**
 * Which side of the ring the letters stand on.
 *
 * `out` — feet on the circle, heads pointing away from the middle, reading
 * clockwise. This is the one in the reference photograph: upright across the
 * top, upside down across the bottom, one continuous run.
 *
 * `in` — heads pointing at the middle, reading anticlockwise. Which is to say:
 * upright across the *bottom*. The two together are what circular type has
 * always offered, and they are the same construction with the frame flipped.
 */
export type BandFace = 'out' | 'in'

/**
 * The glyph's own box, put down on a circle of radius `r` at `deg` clockwise
 * from twelve, scaled by `s`.
 *
 * Derived rather than assembled from transform strings, because the run has to
 * be measured as well as drawn — where a letter's baseline ends up is the
 * question the band layout keeps asking. Both faces share the same linear part
 * and differ only in sign, which is the whole of the difference between them.
 */
export function placeOnArc(deg: number, r: number, s: number, face: BandFace): Matrix {
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const flip = face === 'out' ? 1 : -1
  return [s * cos * flip, s * sin * flip, -s * sin * flip, s * cos * flip, r * sin, -r * cos]
}

export interface BandStyle {
  /** Baseline radius, px. */
  radius: number
  /** Drawn cap height, px. */
  fontSize: number
  /** Extra space between letters, measured along the arc in px. */
  tracking: number
  /** Degrees clockwise from twelve o'clock. The **middle** of the run lands here. */
  start: number
  face: BandFace
  /**
   * How the run is fitted to its circle.
   *
   * `natural` keeps the type's own advances and lets the arc be as long as the
   * phrase needs. `ring` opens the letterspacing until the phrase closes the
   * circle on its own. `repeat` sets the phrase again and again, separated, until
   * it closes — which is what a seal actually does, and the only one of the three
   * that reads properly when the phrase is short and the circle is wide.
   */
  fill: Fill
  /** Set between repeats. Ignored by the other two fills. */
  joiner: string
  /** 0..1 — how much of the line has been written on. */
  reveal: number
}

export type Fill = 'natural' | 'ring' | 'repeat'

export interface PlacedGlyph {
  char: string
  /** The outline at `GLYPH_EM`, pen at the origin, baseline on y = 0. */
  commands: Seg[]
  matrix: Matrix
  /** 0..1. Letters below a whisker of nothing are not emitted at all. */
  opacity: number
}

export interface ArcRun {
  glyphs: PlacedGlyph[]
  /** Degrees the run occupies, first pen to last letter's end. */
  sweep: number
  /** The line is longer than the circle can hold, so it overlaps itself. */
  laps: boolean
}

/** How many letters the write-on is feathered over. */
const FEATHER = 2.6
/** How far a letter starts inside its own band before settling, in cap heights. */
const DROP = 0.5

/**
 * One line of type around one circle.
 *
 * `start` is where the **middle** of the run sits, not its first letter. A
 * designer setting a band to twelve o'clock means the phrase is centred at the
 * top; anchoring the first letter instead makes the whole composition slide
 * every time a word is typed.
 */
export function arcRun(text: string, get: (char: string) => Drawn, style: BandStyle): ArcRun {
  let chars = [...text]
  const r = Math.max(1, style.radius)
  const scale = style.fontSize / GLYPH_EM
  const degPerPx = 180 / (Math.PI * r)
  const turn = style.face === 'out' ? 1 : -1

  const circumference = 2 * Math.PI * r
  const width = (list: string[]) =>
    list.reduce((sum, char) => sum + get(char).advance * scale, 0)

  if (style.fill === 'repeat' && chars.length > 0) {
    // One copy plus its separator, then as many copies as the circle takes at
    // roughly the tracking that was asked for. Rounded rather than floored: the
    // nearest whole number of copies is the one whose spacing is closest to the
    // request, and being a little tighter than asked beats a visible gap at the
    // seam. The spaces are added here rather than typed into the joiner, because
    // leading and trailing spaces in a text field are invisible to whoever
    // types them.
    const unit = [...chars, ...(style.joiner ? ` ${style.joiner} ` : '  ')]
    const unitWidth = width(unit) + style.tracking * unit.length
    const copies = Math.max(1, Math.round(circumference / Math.max(1e-6, unitWidth)))
    chars = Array.from({ length: copies }, () => unit).flat()
  }

  const drawn = chars.map(get)
  const advances = drawn.map((d) => d.advance * scale)
  const inked = advances.reduce((a, b) => a + b, 0)

  // One gap after every letter when the run has to close the circle — including
  // the last, which is the gap at the seam. Set at natural width the last gap is
  // never used.
  const gap =
    style.fill !== 'natural' && chars.length > 0
      ? (circumference - inked) / chars.length
      : style.tracking

  const total = inked + gap * Math.max(0, chars.length - 1)
  const glyphs: PlacedGlyph[] = []

  let pen = -total / 2
  for (let i = 0; i < chars.length; i++) {
    const opacity = Math.max(
      0,
      Math.min(1, (style.reveal * (chars.length + FEATHER) - i) / FEATHER),
    )
    if (opacity > 0.004) {
      // Letters arrive from inside their own band and settle onto it, so the
      // whole plate reads as blooming outward rather than fading up in place.
      const radius = r - (1 - opacity) * style.fontSize * DROP
      const deg = style.start + turn * (pen + advances[i] / 2) * degPerPx
      glyphs.push({
        char: chars[i],
        commands: drawn[i].commands,
        // The letter is turned about its own middle, not its pen: rotating a
        // wide glyph about its left edge tips it off the baseline.
        matrix: compose(placeOnArc(deg, radius, scale, style.face), [
          1,
          0,
          0,
          1,
          -drawn[i].advance / 2,
          0,
        ]),
        opacity,
      })
    }
    pen += advances[i] + gap
  }

  return {
    glyphs,
    sweep: total * degPerPx,
    // `repeat` cannot lap: it counts the copies that fit.
    laps: style.fill === 'repeat' ? false : (style.fill === 'ring' ? inked : total) > circumference,
  }
}

/**
 * Outlines at `GLYPH_EM`, kept between frames.
 *
 * The same letters are placed again on every frame a hand moves, and pulling an
 * outline is the one expensive step. The key has to carry the axis settings as
 * well as the face: `variation.set` moves the outlines, so the same character at
 * two weights is two different shapes under one name.
 */
const outlines = new Map<string, Drawn>()
/** A weight scrub mints a key per value, so the cache needs a ceiling. */
const OUTLINE_LIMIT = 4000

export function outlineOf(face: Parsed, key: string, char: string): Drawn {
  const id = `${key}|${char}`
  const hit = outlines.get(id)
  if (hit) return hit
  if (outlines.size > OUTLINE_LIMIT) outlines.clear()
  const drawn = drawGlyph(face, char, 0, GLYPH_EM)
  outlines.set(id, drawn)
  return drawn
}
