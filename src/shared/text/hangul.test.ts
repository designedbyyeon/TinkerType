import { describe, expect, it } from 'vitest'
import { CHO, JONG, JUNG, compose, decompose, isSyllable } from './hangul'

/*
 * The round-trip is the whole proof.
 *
 * It came over from tool 02 with the code, because a test that proves
 * `decompose` right belongs beside `decompose` — leaving it in the tool that no
 * longer owns the function would make the next person look for the proof in the
 * wrong folder.
 */

describe('syllable decomposition', () => {
  it('round-trips every one of the 11,172 syllables', () => {
    const failures: string[] = []
    for (let code = 0xac00; code <= 0xd7a3; code++) {
      const char = String.fromCodePoint(code)
      const jamo = decompose(char)
      if (!jamo || compose(jamo) !== char) failures.push(char)
    }
    expect(failures).toEqual([])
  })

  it('reports no final consonant as an empty jong', () => {
    expect(decompose('가')).toEqual({ cho: 'ㄱ', jung: 'ㅏ', jong: '' })
    expect(decompose('이')).toEqual({ cho: 'ㅇ', jung: 'ㅣ', jong: '' })
  })

  it('keeps clustered jamo as single letters', () => {
    // 값: the final is one ㅄ, not a ㅂ and a ㅅ — it is moulded as one part.
    expect(decompose('값')).toEqual({ cho: 'ㄱ', jung: 'ㅏ', jong: 'ㅄ' })
    // 뷁: clustered medial and clustered final at once.
    expect(decompose('뷁')).toEqual({ cho: 'ㅂ', jung: 'ㅞ', jong: 'ㄺ' })
    // 쌍자음 initial.
    expect(decompose('빠')).toEqual({ cho: 'ㅃ', jung: 'ㅏ', jong: '' })
  })

  it('returns null outside the syllable block', () => {
    expect(decompose('A')).toBeNull()
    expect(decompose('ㄱ')).toBeNull() // a bare jamo is not a syllable
    expect(isSyllable('한')).toBe(true)
    expect(isSyllable(' ')).toBe(false)
  })
})

describe('the jamo tables', () => {
  it('is the length the block arithmetic assumes', () => {
    // These three lengths are the modulus in `decompose`. A table edited to the
    // wrong length would shift every syllable in the language by a silent step.
    expect(CHO).toHaveLength(19)
    expect(JUNG).toHaveLength(21)
    expect(JONG).toHaveLength(28)
    expect(JONG[0]).toBe('')
  })

  it('holds compatibility jamo, which stand alone', () => {
    // The conjoining block starts at U+1100 and draws partial forms. Every entry
    // here has to be from U+3131 upward or a platter rim would show fragments.
    for (const jamo of [...CHO, ...JUNG, ...JONG.slice(1)]) {
      expect(jamo.codePointAt(0)).toBeGreaterThanOrEqual(0x3131)
    }
  })

  it('has no duplicates within a position', () => {
    for (const table of [CHO, JUNG, JONG]) {
      expect(new Set(table).size).toBe(table.length)
    }
  })

  it('composes from any combination of the three tables', () => {
    // The tool's claim: three wheels reach every syllable. 19 x 21 x 28.
    let count = 0
    for (const cho of CHO) {
      for (const jung of JUNG) {
        for (const jong of JONG) {
          const made = compose({ cho, jung, jong })
          expect(made).not.toBeNull()
          expect(isSyllable(made as string)).toBe(true)
          count++
        }
      }
    }
    expect(count).toBe(11172)
  })
})
