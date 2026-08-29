import { decompose } from '../../../shared/text/hangul'
import type { Rect } from '../../../shared/geometry/vec'

/**
 * The machine: two wheels facing each other across a slider.
 *
 * **세로모임꼴만**, and the layout is that syllable built out of parts. 초성 above,
 * 중성 between, 종성 below — and the three letters that are *selected* sit as close
 * together as three letters in a syllable, so the machine spells what it is about
 * to play.
 *
 * That is what makes the reading positions face inward: **the top wheel reads at
 * six o'clock and the bottom wheel at twelve.** Both point at the slider between
 * them, so 초성 · 중성 · 종성 come out evenly spaced down one axis. Reading both at
 * twelve, as an earlier version did, left the syllable spread over the whole
 * height of the machine with a disc's worth of nothing between each letter.
 *
 * And 중성 is **not a third wheel.** Five vowels want a list, not a ring, and a
 * horizontal ruler is what fits in the gap between two discs — which is exactly
 * where the vowel belongs. The reference's own time-scrubber is the same object.
 *
 * Nothing here knows about fonts, the DOM or audio. Coordinates only.
 */

export type Role = 'cho' | 'jung' | 'jong'

/**
 * The medials that set underneath their initial.
 *
 * Built on a horizontal bar, so the syllable stacks. This is the classification
 * Korean typesetting has always used, not a rule invented here — and it is the
 * whole vocabulary of the slider.
 */
export const VERTICAL_JUNG = ['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ']

/**
 * What is on each wheel. **Four, two and four.**
 *
 * Chosen, not derived — this is the kit the instrument is played with, and it is
 * the whole vocabulary of the machine.
 *
 *   초성 ㄷ ㅂ ㅇ ㅊ — 설음, 순음, the silent seat, 치음. One per place of
 *     articulation that matters here, which comes out as a snare, a kick, a pad and
 *     a hat. Nothing names those; they are what the places sound like.
 *   중성 ㅡ ㅜ — the two darkest that stack. Left is lower, which is the slider's
 *     own direction.
 *   종성 ㅁ ㅂ ㅇ and none — closed, cut, ringing, open. The four endings, which is
 *     the whole release column.
 *
 * There used to be three kits per wheel and a row in the panel to pick between
 * them. With one kit each, those rows became controls with a single option, and
 * rule four says a control that cannot do anything is not shown — so the rows are
 * gone and the arrays are constants.
 */
export const CHO_RIM = ['ㄷ', 'ㅂ', 'ㅇ', 'ㅊ']
/** Ordered by pitch: ㅜ is lower than ㅡ, and the slider runs low to bright. */
export const JUNG_RIM = ['ㅜ', 'ㅡ']
/** The empty final is on the wheel: taking the ending off is a move. */
export const JONG_RIM = ['', 'ㅁ', 'ㅂ', 'ㅇ']

/** Whether a syllable can go on this machine at all. */
export function isStacked(syllable: string): boolean {
  const jamo = decompose(syllable)
  return !!jamo && VERTICAL_JUNG.includes(jamo.jung)
}

export interface DeckSpec {
  /** Platter radius, px. */
  radius: number
  /** Drawn height of a letter on the machine, px. */
  letter: number
  /** Space between the three selected letters, as a fraction of the radius. */
  spacing: number
}

export interface Platter {
  role: 'cho' | 'jong'
  cx: number
  cy: number
  r: number
  rim: string[]
  /** Index into `rim` of the jamo at the reading mark. */
  selected: number
  /** Rotation of the disc, radians clockwise. At rest, `selected` is at `read`. */
  spin: number
  /**
   * Where this wheel is read, as an angle clockwise from twelve o'clock.
   *
   * `Math.PI` for the initial — six o'clock, the side facing the slider — and `0`
   * for the final. The two therefore point at each other.
   */
  read: number
  /** Where a rim jamo's centre sits, from the platter's own centre. */
  rimRadius: number
  /** Drawn height a rim jamo actually gets, px. Capped by the circumference. */
  rimSize: number
  /** The spindle at the middle. Small: it is a bearing, not a display. */
  hub: number
}

export interface Ruler {
  /** The strip's box. */
  x: number
  y: number
  width: number
  height: number
  items: string[]
  selected: number
  /** px the list is slid by. At rest 0, which puts `selected` at the centre. */
  offset: number
  /** px between neighbouring items. */
  pitch: number
  size: number
}

export interface Deck {
  cho: Platter
  jung: Ruler
  jong: Platter
  /** The audition pad under the machine. */
  pad: { cx: number; cy: number; r: number }
  /** Everything the machine occupies, so the stage can place it. */
  box: Rect
}

/**
 * Where a rim item sits, and how far it has turned with the disc.
 *
 * **Position and rotation do not use the same angle, and that is the point.**
 *
 * The position is measured from the reading mark, so the selected letter lands on
 * whichever side this wheel is read from. The *rotation* is measured from the
 * selection, so the selected letter is upright and every other one leans by how far
 * round the wheel it is — which is exactly a record label: printed on the disc,
 * turning with it, and square-on only where you are reading.
 *
 * Drawing them all upright made the wheel unreadable as a wheel. Nothing on it
 * appeared to rotate except three letters hopping between positions.
 */
export function rimAt(
  platter: Platter,
  index: number,
): { x: number; y: number; angle: number } {
  const step = (Math.PI * 2) / Math.max(1, platter.rim.length)
  const placement = platter.read + platter.spin + index * step
  return {
    // Twelve o'clock is angle zero and the disc turns clockwise, which is why
    // this is sin/-cos rather than cos/sin.
    x: platter.cx + platter.rimRadius * Math.sin(placement),
    y: platter.cy - platter.rimRadius * Math.cos(placement),
    // Zero at rest for the selected item: `spin` is `-selected * step`.
    angle: platter.spin + index * step,
  }
}

/**
 * Where the face's divisions fall — one per rim item, each bisecting the gap
 * between two letters.
 *
 * **Measured the same way a letter is placed**, plus half a step. An earlier
 * version turned the divisions by `spin + selected * step` while the letters were
 * placed at `read + spin + i * step`, so the two disagreed by exactly the reading
 * angle — and on a three-item wheel that put every division straight through a
 * letter. Anything that has to line up with the rim is derived from the rim.
 */
export function dividersOf(platter: Platter): number[] {
  const step = (Math.PI * 2) / Math.max(1, platter.rim.length)
  return platter.rim.map((_, i) => platter.read + platter.spin + (i + 0.5) * step)
}

/** The rotation that brings `index` to the reading mark. */
export function restSpin(rim: string[], index: number): number {
  const step = (Math.PI * 2) / Math.max(1, rim.length)
  return -index * step
}

/** Which rim item a free rotation is nearest. */
export function snapTo(rim: string[], spin: number): number {
  const n = Math.max(1, rim.length)
  const step = (Math.PI * 2) / n
  const raw = Math.round(-spin / step)
  return ((raw % n) + n) % n
}

/** Where a ruler item sits along the strip. */
export function itemAt(ruler: Ruler, index: number): number {
  return ruler.x + ruler.width / 2 + ruler.offset + (index - ruler.selected) * ruler.pitch
}

/** Which ruler item a free slide is nearest. */
export function snapAlong(ruler: Ruler, offset: number): number {
  const moved = Math.round(-offset / ruler.pitch)
  const n = ruler.items.length
  // Clamped, not wrapped: a slider has ends, and a list of five vowels that
  // looped round would put ㅡ next to ㅗ with nothing to say it had.
  return Math.max(0, Math.min(n - 1, ruler.selected + moved))
}

/**
 * A kit with the syllable's own jamo guaranteed to be on it.
 *
 * A designer looking at a three-item wheel while the machine is dialled to
 * something else has to see what it is dialled to, or the wheel is lying about the
 * instrument.
 */
function rimFor(kit: string[], jamo: string): string[] {
  return kit.includes(jamo) ? kit : [jamo, ...kit]
}

/**
 * The machine for one syllable.
 *
 * `null` for anything that is not a stacked syllable — this machine cannot build a
 * ㅏ, and drawing wheels that could not produce what they were showing would be
 * worse than saying so.
 */
export function deckOf(syllable: string, spec: DeckSpec): Deck | null {
  const jamo = decompose(syllable)
  if (!jamo || !VERTICAL_JUNG.includes(jamo.jung)) return null

  const r = spec.radius
  const rimRadius = r * 0.62

  /*
   * The space between the three selected letters — the one number that sets the
   * whole machine's height, because everything else hangs off it.
   *
   * **Its floor is arithmetic, not taste.** The slider has to sit in the gap between
   * the two discs without touching either, so the spacing cannot be smaller than
   * half a strip plus the distance from a reading mark to its own disc's edge. Ask
   * for less and you get the floor; the panel's note says so.
   */
  /*
   * The slide's letters run a fifth larger than the wheels', and the strip is only
   * a little taller than they are.
   *
   * Both measured off the reference, where the vowel's box is 128 to the wheels'
   * 108 and the strip is 140. It is not decoration: the vowel is the one thing you
   * *tune* rather than select, so it is the biggest letter on the machine.
   */
  const rulerSize = spec.letter * 1.2
  const rulerH = rulerSize * 1.15
  /*
   * The clearance is 0.3r, not a hairline.
   *
   * The reading mark — the one accent dot on each wheel — sits in that gap, just
   * outside the graduated edge and just above the strip. At the 0.06r I first used
   * there was no room for it, so both dots were drawn under the strip and the one
   * mark that says which side a wheel is read from was invisible.
   */
  const floor = r - rimRadius + rulerH / 2 + r * 0.3
  const gap = Math.max(floor, r * spec.spacing)

  const choCy = 0
  const rulerMid = rimRadius + gap
  const jongCy = rulerMid + gap + rimRadius

  const rims: Record<Role, string[]> = {
    cho: rimFor(CHO_RIM, jamo.cho),
    jung: rimFor(JUNG_RIM, jamo.jung),
    jong: rimFor(JONG_RIM, jamo.jong),
  }

  const wheel = (role: 'cho' | 'jong', cy: number, read: number): Platter => {
    const rim = rims[role]
    const selected = Math.max(0, rim.indexOf(role === 'cho' ? jamo.cho : jamo.jong))
    // The slice of circumference one item gets, less a little so neighbours do not
    // touch. A jamo is drawn inside an em square, so its slice is its size.
    const slice = ((Math.PI * 2 * rimRadius) / rim.length) * 0.78
    return {
      role,
      cx: 0,
      cy,
      r,
      rim,
      selected,
      spin: restSpin(rim, selected),
      read,
      rimRadius,
      rimSize: Math.min(spec.letter, slice),
      // Measured off the reference: the spindle is about a fifth of the face. A
      // smaller one read as a dot on a disc rather than as the thing it turns on.
      hub: r * 0.2,
    }
  }

  const items = rims.jung
  // Half a radius wider than the discs, so the strip reads as the axle they turn on
  // rather than as a third thing sitting between them. Only a little wider and it
  // looks like a mistake instead of a decision.
  const rulerW = r * 2.65
  const ruler: Ruler = {
    x: -rulerW / 2,
    y: rulerMid - rulerH / 2,
    width: rulerW,
    height: rulerH,
    items,
    selected: Math.max(0, items.indexOf(jamo.jung)),
    offset: 0,
    pitch: Math.max(rulerSize * 1.25, rulerW / 3),
    size: rulerSize,
  }

  const padR = r * 0.24
  const pad = { cx: 0, cy: jongCy + r + padR * 1.9, r: padR }

  return {
    cho: wheel('cho', choCy, Math.PI),
    jung: ruler,
    jong: wheel('jong', jongCy, 0),
    pad,
    box: {
      x: -rulerW / 2,
      y: choCy - r,
      width: rulerW,
      height: pad.cy + padR - (choCy - r),
    },
  }
}

/** The three letters the machine is reading, top to bottom. What it will play. */
export function readingOf(deck: Deck): Array<{ jamo: string; x: number; y: number }> {
  const cho = rimAt(deck.cho, deck.cho.selected)
  const jong = rimAt(deck.jong, deck.jong.selected)
  return [
    { jamo: deck.cho.rim[deck.cho.selected] ?? '', x: cho.x, y: cho.y },
    { jamo: deck.jung.items[deck.jung.selected] ?? '', x: 0, y: deck.jung.y + deck.jung.height / 2 },
    { jamo: deck.jong.rim[deck.jong.selected] ?? '', x: jong.x, y: jong.y },
  ]
}
