/**
 * The Hangul writing system, arithmetically.
 *
 * This was tool 02's, in its `geometry/` folder, and it was never geometry — a
 * syllable's three positions are a fact about the script, not about sprues. The
 * fifth tool needs the same three functions and the same three tables, so it
 * comes out here: **moved when a second consumer actually appeared, not when one
 * was expected.** What stayed behind in tool 02 is the part that really is about
 * moulded parts — `splitText` and the part/runner units.
 *
 * `text/` rather than `geometry/` or `media/`: decomposing a syllable is neither
 * a shape nor an asset.
 */

/** Hangul syllables occupy one contiguous block, composed arithmetically. */
const SYLLABLE_BASE = 0xac00
const SYLLABLE_LAST = 0xd7a3
const JUNG_COUNT = 21
const JONG_COUNT = 28

/**
 * Compatibility jamo, not conjoining jamo.
 *
 * A conjoining jamo (the U+1100 block) is drawn as a partial form made to sit
 * inside a syllable; alone it renders as a fragment or as nothing. The
 * compatibility block draws each jamo as a standalone letter, which is what both
 * consumers need — tool 02 wants a ㄱ you can pick off a frame and recognise,
 * and tool 05 sets one on a turntable rim where it has to read on its own.
 *
 * Exported, because tool 05 needs the whole list: a platter's rim is a subset of
 * one of these three arrays, and the order here is the order they sit in.
 */
export const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

export const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
]

/** Index 0 is "no final consonant", which is why this list is 28 long. */
export const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

export interface Jamo {
  cho: string
  jung: string
  /** Empty when the syllable has no final consonant. */
  jong: string
}

export function isSyllable(char: string): boolean {
  const code = char.codePointAt(0)
  return code !== undefined && code >= SYLLABLE_BASE && code <= SYLLABLE_LAST
}

/** Split a composed syllable into its three positions. */
export function decompose(char: string): Jamo | null {
  if (!isSyllable(char)) return null
  const index = (char.codePointAt(0) as number) - SYLLABLE_BASE
  const jong = index % JONG_COUNT
  const jung = Math.floor(index / JONG_COUNT) % JUNG_COUNT
  const cho = Math.floor(index / (JONG_COUNT * JUNG_COUNT))
  return { cho: CHO[cho], jung: JUNG[jung], jong: JONG[jong] }
}

/**
 * Rebuild a syllable from compatibility jamo. The inverse of `decompose`.
 *
 * Tool 02 never called this — it existed so the test could round-trip all 11,172
 * syllables and prove `decompose` right without a table of expected answers to
 * get wrong. **Tool 05 calls it on every spin of a platter**, which is the point
 * of the tool: three wheels and `compose` between them will type any syllable in
 * the language, because the script is built to be assembled.
 */
export function compose(jamo: Jamo): string | null {
  const cho = CHO.indexOf(jamo.cho)
  const jung = JUNG.indexOf(jamo.jung)
  const jong = JONG.indexOf(jamo.jong)
  if (cho < 0 || jung < 0 || jong < 0) return null
  return String.fromCodePoint(
    SYLLABLE_BASE + (cho * JUNG_COUNT + jung) * JONG_COUNT + jong,
  )
}
