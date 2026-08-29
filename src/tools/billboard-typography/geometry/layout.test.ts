import { describe, expect, it } from 'vitest'
import { signFace } from '../scene/signFace.fixture'
import { wordsOf } from '../scene/words'
import { boxOfSign, depthVariety, hiddenFractions, layoutOf, readingOrder } from './layout'
import { tileLength } from './signs'
import { MAX_ROWS, PITCH, viewOf } from './plan'
import { project } from './wall'
import { DEFAULT_STYLE, type MeasuredWord, type Style } from './types'

/**
 * The invariants. These are the tool, more than the renderer is.
 *
 * A billboard building is only worth anything if the sentence survives being
 * scattered across it, and "it looked right in the browser" is not a way to know
 * that — the scrapped attempt lost three words to a sign that was painted over,
 * and it took a test of exactly this kind to find them.
 */

const face = signFace()

const LINES = [
  '간판',
  '오밀조밀 붙은 간판',
  '동아시아 상가 건물의 간판 타이포그래피',
  '글줄을 넣으면 그 글줄이 간판이 되어 건물 하나를 이룬다',
  '서울 종로 세운상가 지하 일층 사진관 간판 열두 개와 계단 위 작은 문구점',
]

const VIEW = viewOf(DEFAULT_STYLE.azimuth)

const styles: Style[] = [1, 7, 23, 91].map((seed) => ({ ...DEFAULT_STYLE, seed }))

const cases = LINES.flatMap((line) =>
  styles.map((style) => ({ line, style, words: wordsOf(face, line) })),
)

describe('reading', () => {
  it('restores the original line', () => {
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      const back = readingOrder(layout, VIEW).map((s) => s.text)
      expect(back, `${line} @ seed ${style.seed}`).toEqual(words.map((w) => w.text))
    }
  })

  it('holds at every camera angle, dead-on included', () => {
    /*
     * The angle is a control now, and it is an input to the packing rather than
     * a thing chosen afterwards — a board's standoff shifts it sideways by an
     * amount that depends on it. At zero the side wall has no screen width and
     * the packer stops using it, which has to fall out of the arithmetic rather
     * than out of a special case.
     */
    for (const azimuth of [0, 6, 21, 34, 40]) {
      for (const { line, words } of cases) {
        const style = { ...DEFAULT_STYLE, azimuth }
        const layout = layoutOf(words, style)
        const back = readingOrder(layout, viewOf(azimuth)).map((s) => s.text)
        expect(back, `${line} @ ${azimuth}°`).toEqual(words.map((w) => w.text))
      }
    }
  })

  it('agrees with where the boards actually land on screen', () => {
    /*
     * The substantive claim, checked against the projection rather than against
     * the model that produced it. Every board's real world box is projected and
     * sorted by its left edge; that has to be the sentence.
     *
     * This is the test that found the depth shift. Sorting tiles by `s` looked
     * fine and was wrong: a board standing proud of the wall appears somewhere
     * else, and two neighbours at different depths swapped.
     */
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      const { wall } = layout.form
      const byScreen = layout.signs
        .map((sign) => {
          const b = boxOfSign(wall, sign)
          const left = Math.min(
            project({ x: b.x, y: b.y, z: b.z }, VIEW).x,
            project({ x: b.x, y: b.y, z: b.z + b.d }, VIEW).x,
            project({ x: b.x + b.w, y: b.y, z: b.z }, VIEW).x,
            project({ x: b.x + b.w, y: b.y, z: b.z + b.d }, VIEW).x,
          )
          return { text: sign.text, row: sign.row, left }
        })
        .sort((a, b) => a.row - b.row || a.left - b.left)
        .map((s) => s.text)
      expect(byScreen, `${line} @ seed ${style.seed}`).toEqual(words.map((w) => w.text))
    }
  })
})

describe('no word is lost', () => {
  it('places every word exactly once', () => {
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      expect(layout.signs.length, line).toBe(words.length)
      expect(new Set(layout.signs.map((s) => s.order)).size).toBe(words.length)
    }
  })

  it('shrinks a word too long for any row rather than dropping it', () => {
    // A single word wider than a whole wall. Character-count splitting used to
    // lose these silently; the answer is smaller type, never a missing word.
    // Long enough that no building this tool will build can hold it at full
    // size. Forty used to be: the shop-house is smaller now, but the ceiling on
    // row count is higher, so the number had to grow with it.
    const size = 200
    const long: MeasuredWord = {
      text: '한'.repeat(size),
      advances: Array.from({ length: size }, () => 1),
      width: size,
      top: 0.9,
      bottom: -0.1,
    }
    const layout = layoutOf([long], DEFAULT_STYLE)
    expect(layout.signs).toHaveLength(1)
    expect(layout.signs[0].letters).toHaveLength(size)
    expect(layout.signs[0].letters[0].cap).toBeLessThan(1)
  })
})

describe('the corner', () => {
  it('never lets a board straddle it', () => {
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      const { width } = layout.form.wall
      for (const sign of layout.signs) {
        const straddles = sign.s0 < width - 1e-9 && sign.s1 > width + 1e-9
        expect(straddles, `${line}: ${sign.text}`).toBe(false)
      }
    }
  })
})

describe('bounds', () => {
  it('keeps every board on the wall panel', () => {
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      const { form } = layout
      for (const sign of layout.signs) {
        expect(sign.s0, `${line}: ${sign.text}`).toBeGreaterThanOrEqual(-1e-9)
        expect(sign.s1).toBeLessThanOrEqual(form.wall.total + 1e-9)
        expect(sign.s1).toBeGreaterThan(sign.s0)
        expect(sign.y).toBeGreaterThanOrEqual(form.panelBase - 1e-9)
        expect(sign.y + sign.height).toBeLessThanOrEqual(form.panelBase + form.panel + 1e-9)
      }
    }
  })

  it('keeps every letter on its board', () => {
    // Measured against the **ink**, which is what the eye sees and what the
    // placement is now built on. Checking the em box would pass a board whose
    // lettering hangs over the edge and fail one that sits correctly.
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      for (const sign of layout.signs) {
        const len = sign.s1 - sign.s0
        const word = words[sign.order]
        for (const letter of sign.letters) {
          expect(letter.along, `${line}: ${sign.text}`).toBeGreaterThanOrEqual(-1e-6)
          expect(letter.along).toBeLessThanOrEqual(len + 1e-6)
          expect(letter.up + word.bottom * letter.cap).toBeGreaterThanOrEqual(-1e-6)
          expect(letter.up + word.top * letter.cap).toBeLessThanOrEqual(sign.height + 1e-6)
        }
      }
    }
  })

  it('centres the lettering on its ink, not on the em box', () => {
    // The bug this replaced: 조선견고딕 hangs a syllable a tenth of a cap below
    // the baseline, so em-box centring dropped every horizontal board's type by
    // that tenth. Above and below should now match.
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      for (const sign of layout.signs) {
        if (sign.kind === 'blade' || sign.letters.length === 0) continue
        const word = words[sign.order]
        const cap = sign.letters[0].cap
        // Measured inside the board's usable face: a rule along the foot takes
        // its share first, and the type centres in what is left.
        const above = sign.height - (sign.letters[0].up + word.top * cap)
        const below = sign.letters[0].up + word.bottom * cap - sign.foot
        expect(above, `${line}: ${sign.text}`).toBeCloseTo(below, 6)
      }
    }
  })
})

describe('growth', () => {
  it('never shrinks the building as words are added', () => {
    const words = wordsOf(
      face,
      '서울 종로 세운상가 지하 일층 사진관 간판 열두 개와 계단 위 작은 문구점 그리고 옥상 광고탑',
    )
    for (const style of styles) {
      let rows = 0
      let height = 0
      for (let n = 1; n <= words.length; n++) {
        const layout = layoutOf(words.slice(0, n), style)
        expect(layout.form.rows, `${n} words @ seed ${style.seed}`).toBeGreaterThanOrEqual(rows)
        expect(layout.form.height).toBeGreaterThanOrEqual(height)
        rows = layout.form.rows
        height = layout.form.height
      }
      expect(rows).toBeGreaterThan(3)
    }
  })

  it('ties the height to the row count and nothing else', () => {
    for (const { style, words } of cases) {
      const layout = layoutOf(words, style)
      expect(layout.form.panel).toBeCloseTo(layout.form.rows * PITCH, 9)
      expect(layout.form.rows).toBeLessThanOrEqual(MAX_ROWS)
    }
  })
})

describe('the wall shows through', () => {
  /*
   * **The target here was wrong and got revised by looking at it.**
   *
   * The plan said 50–70% of the panel. At 60% the wall stops existing: the
   * boards have to be a quarter of its width each to add up, and the building
   * comes out a stack of coloured tiles rather than a wall with signs on it —
   * which is the exact failure the previous attempt was scrapped for, arrived at
   * from the other side. The requirement was never a percentage; it was "실제 벽이
   * 존재하고, 그 위로 다양한 형태와 깊이의 간판". Around 40% is where that reads.
   */
  it('leaves half the panel bare', () => {
    // Structural rather than tuned: a board fills a little over half its row
    // band, so the strip beneath every sign is wall no matter what the packer
    // does. This is the check that it stays that way.
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      expect(layout.coverage, `${line} @ seed ${style.seed}`).toBeLessThan(0.5)
    }
  })

  it('stacks a tidy building as one column of identical boards', () => {
    /*
     * The Order dial at zero, which is the whole point of it: same width, same
     * height, one to a storey, and each one centred. If any of those four drift
     * the dial has stopped meaning what the panel says it means.
     */
    for (const { line, words } of cases) {
      const style = { ...DEFAULT_STYLE, order: 0 }
      const layout = layoutOf(words, style)
      const widths = new Set(layout.signs.map((s) => Math.round((s.s1 - s.s0) * 1000)))
      const heights = new Set(layout.signs.map((s) => Math.round(s.height * 1000)))
      const rows = layout.signs.map((s) => s.row)
      expect(widths.size, `${line}: widths`).toBe(1)
      expect(heights.size, `${line}: heights`).toBe(1)
      expect(new Set(rows).size, `${line}: one per storey`).toBe(rows.length)
      expect(layout.signs.every((s) => s.kind === 'band')).toBe(true)
      expect(depthVariety(layout.signs).families, `${line}: one depth`).toBe(1)
    }
  })

  it('sizes a board from its word once the dial is up', () => {
    /*
     * The other end of the dial, and the thing the rework was for: a
     * one-syllable shop gets a small sign.
     *
     * Checked against `tileLength` rather than against a number. A board's kind
     * is drawn from the seed, and the kinds carry different type sizes, so
     * comparing two boards' widths compares two different things — the claim is
     * that a board **is** its word at its own kind, with nothing rounded to a
     * grid.
     */
    for (const { line, words } of cases) {
      const style = { ...DEFAULT_STYLE, order: 1 }
      const layout = layoutOf(words, style)
      let exact = 0
      for (const sign of layout.signs) {
        const natural = tileLength(words[sign.order], sign.kind, sign.livery, sign.block, style.pad)
        // Never wider than the word needs — that is the claim. Narrower is
        // allowed and rare: a word too long for the storey it landed in is set
        // smaller rather than dropped.
        expect(sign.s1 - sign.s0, `${line}: ${sign.text}`).toBeLessThanOrEqual(natural + 1e-6)
        if (Math.abs(sign.s1 - sign.s0 - natural) < 1e-6) exact++
      }
      // At most one board per line may be squeezed. A share would drift with the
      // line's length; the claim is that squeezing is the exception, and one is
      // what "exception" means.
      expect(layout.signs.length - exact, `${line}: squeezed`).toBeLessThanOrEqual(1)
    }
  })

  it('makes a longer word a longer board', () => {
    const [short, mid, long] = wordsOf(face, '가 사진관 세운상가에서')
    const at = (w: typeof short) => tileLength(w, 'band', 'panel', null, DEFAULT_STYLE.pad)
    expect(at(short)).toBeLessThan(at(mid))
    expect(at(mid)).toBeLessThan(at(long))
  })

  it('gives a short line fewer rows than a long one', () => {
    const short = layoutOf(wordsOf(face, '붙은 간판'), DEFAULT_STYLE)
    const long = layoutOf(wordsOf(face, LINES[4]), DEFAULT_STYLE)
    expect(short.form.rows).toBeLessThan(long.form.rows)
  })
})

describe('depth', () => {
  it('gives a building at least three depth families and one board standing proud', () => {
    // "다양한 형태와 깊이" held by a number rather than by eye, and held **with
    // the dial up** — variety is what Order buys, so testing it at the default
    // would be testing the default. Short lines sit out: with one board per word,
    // four words cannot show four depths.
    for (const { line, style: base, words } of cases) {
      if (words.length < 8) continue
      const style = { ...base, order: 1 }
      const variety = depthVariety(layoutOf(words, style).signs)
      expect(variety.families, `${line} @ seed ${style.seed}`).toBeGreaterThanOrEqual(3)
      expect(variety.spread, `${line} @ seed ${style.seed}`).toBeGreaterThan(3)
    }
  })

  it('makes one board per word and no others', () => {
    // The blank neighbours are gone. A sign with nothing on it is a decoration,
    // and this is a typography tool — the count comes from the text.
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      expect(layout.signs.length, line).toBe(words.length)
      expect(layout.signs.every((s) => s.letters.length > 0)).toBe(true)
    }
  })
})

describe('occlusion', () => {
  it('never hides more than half of any board', () => {
    // Overlap is wanted — it is where the density comes from. Swallowing is not.
    for (const { line, style, words } of cases) {
      const layout = layoutOf(words, style)
      const hidden = hiddenFractions(layout, VIEW)
      hidden.forEach((fraction, i) => {
        expect(fraction, `${line} @ seed ${style.seed}: ${layout.signs[i].text}`).toBeLessThan(0.5)
      })
    }
  })
})
