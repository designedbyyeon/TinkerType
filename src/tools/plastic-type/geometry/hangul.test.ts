import { describe, expect, it } from 'vitest'
import { clampRunnerUnit, splitText, type PartUnit, type RunnerUnit } from './hangul'

describe('runner unit floor', () => {
  it('leaves a runner that is at or above the part unit', () => {
    expect(clampRunnerUnit('jamo', 'syllable')).toBe('syllable')
    expect(clampRunnerUnit('syllable', 'syllable')).toBe('syllable')
    expect(clampRunnerUnit('word', 'all')).toBe('all')
  })

  it('raises a runner that would hold less than one part', () => {
    expect(clampRunnerUnit('word', 'syllable')).toBe('word')
    expect(clampRunnerUnit('sentence', 'syllable')).toBe('sentence')
    expect(clampRunnerUnit('sentence', 'word')).toBe('sentence')
  })
})

describe('splitting text into frames and parts', () => {
  it('gives one frame per syllable with each jamo its own part', () => {
    // The syllable runners: one coloured frame per syllable, ㅇ and ㅣ gated separately.
    const groups = splitText('한글', 'jamo', 'syllable')
    expect(groups.map((g) => g.label)).toEqual(['한', '글'])
    expect(groups[0].parts.map((p) => p.text)).toEqual(['ㅎ', 'ㅏ', 'ㄴ'])
    expect(groups[1].parts.map((p) => p.text)).toEqual(['ㄱ', 'ㅡ', 'ㄹ'])
    expect(groups[0].parts.every((p) => p.kind === 'jamo')).toBe(true)
    expect(groups[0].parts.every((p) => p.source === '한')).toBe(true)
  })

  it('falls back to one part per letter for Latin at the jamo level', () => {
    const groups = splitText('KIT', 'jamo', 'word')
    expect(groups).toHaveLength(1)
    expect(groups[0].parts.map((p) => p.text)).toEqual(['K', 'I', 'T'])
    expect(groups[0].parts.every((p) => p.kind === 'text')).toBe(true)
  })

  it('splits words on space and sentences on terminal punctuation', () => {
    const byWord = splitText('MADE TO SCALE', 'syllable', 'word')
    expect(byWord.map((g) => g.label)).toEqual(['MADE', 'TO', 'SCALE'])

    const bySentence = splitText('Snap it out. Build it.', 'word', 'sentence')
    expect(bySentence.map((g) => g.label)).toEqual(['Snap it out.', 'Build it.'])
    expect(bySentence[0].parts.map((p) => p.text)).toEqual(['Snap', 'it', 'out.'])
  })

  it('puts everything on one frame when the runner is the whole text', () => {
    const groups = splitText('가나 다라', 'syllable', 'all')
    expect(groups).toHaveLength(1)
    expect(groups[0].parts.map((p) => p.text)).toEqual(['가', '나', '다', '라'])
  })

  it('raises the runner rather than emitting a partial part', () => {
    // Asking for word-sized parts in syllable-sized frames is incoherent.
    const groups = splitText('MADE TO SCALE', 'word', 'syllable')
    expect(groups.map((g) => g.label)).toEqual(['MADE', 'TO', 'SCALE'])
    expect(groups.every((g) => g.parts.length === 1)).toBe(true)
  })

  it('yields no empty frames or empty parts for any combination', () => {
    const texts = ['한글 타이포', 'MADE TO SCALE', '값 뷁 A1', 'Mix 섞기.  Then 다시!', '']
    const parts: PartUnit[] = ['jamo', 'syllable', 'word', 'sentence']
    const runners: RunnerUnit[] = ['syllable', 'word', 'sentence', 'all']
    for (const text of texts) {
      for (const part of parts) {
        for (const runner of runners) {
          for (const group of splitText(text, part, runner)) {
            expect(group.parts.length).toBeGreaterThan(0)
            for (const p of group.parts) expect(p.text.trim()).not.toBe('')
          }
        }
      }
    }
  })

  it('drops whitespace-only text', () => {
    expect(splitText('   \n  ', 'syllable', 'word')).toEqual([])
  })
})
