/**
 * Cutting text into moulded parts and frames.
 *
 * The script itself — `decompose`, `compose`, the three jamo tables — moved to
 * `shared/text/hangul.ts` when tool 05 turned up needing exactly the same
 * arithmetic. What is left here is the half that really is about this tool: what
 * becomes one part, and what becomes one frame. A frame is not a fact about
 * Hangul.
 */
import { decompose } from '../../../shared/text/hangul'

/** What becomes one moulded part. */
export type PartUnit = 'jamo' | 'syllable' | 'word' | 'sentence'
/** What becomes one frame. */
export type RunnerUnit = 'syllable' | 'word' | 'sentence' | 'all'

const PART_RANK: Record<PartUnit, number> = { jamo: 0, syllable: 1, word: 2, sentence: 3 }
const RUNNER_RANK: Record<RunnerUnit, number> = { syllable: 1, word: 2, sentence: 3, all: 4 }
const RUNNER_ORDER: RunnerUnit[] = ['syllable', 'word', 'sentence', 'all']

/**
 * A frame cannot hold less than one part, so a runner unit below the part unit
 * is raised to the nearest one that can. Splitting by word and framing by
 * syllable would ask a frame to hold a third of a part.
 */
export function clampRunnerUnit(part: PartUnit, runner: RunnerUnit): RunnerUnit {
  const floor = PART_RANK[part]
  if (RUNNER_RANK[runner] >= floor) return runner
  return RUNNER_ORDER.find((u) => RUNNER_RANK[u] >= floor) ?? 'all'
}

export interface Part {
  /** The characters to draw. */
  text: string
  /**
   * Jamo are drawn as standalone letters from the compatibility block, so their
   * advance and side bearings have nothing to do with the syllable they came
   * from. Layout needs to know which case it is holding.
   */
  kind: 'jamo' | 'text'
  /** The syllable or word this came from, for readable part numbers. */
  source: string
}

export interface RunnerGroup {
  parts: Part[]
  /** The text this frame holds, as it reads. */
  label: string
}

/** Terminal punctuation, Latin and CJK, or a hard break. */
const SENTENCE_SPLIT = /(?<=[.!?…。？！])\s+|\n+/

function splitSentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean)
}

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** One word cut into parts at the requested granularity. */
function wordToParts(word: string, unit: PartUnit): Part[] {
  if (unit === 'word' || unit === 'sentence') {
    return [{ text: word, kind: 'text', source: word }]
  }

  const chars = [...word]
  if (unit === 'syllable') {
    return chars.map((c) => ({ text: c, kind: 'text' as const, source: c }))
  }

  // jamo: decompose what decomposes, leave everything else per character —
  // Latin has no jamo level, so the finest cut it owns is the letter.
  const out: Part[] = []
  for (const char of chars) {
    const jamo = decompose(char)
    if (!jamo) {
      out.push({ text: char, kind: 'text', source: char })
      continue
    }
    out.push({ text: jamo.cho, kind: 'jamo', source: char })
    out.push({ text: jamo.jung, kind: 'jamo', source: char })
    if (jamo.jong) out.push({ text: jamo.jong, kind: 'jamo', source: char })
  }
  return out
}

function sentenceToParts(sentence: string, part: PartUnit): Part[] {
  if (part === 'sentence') return [{ text: sentence, kind: 'text', source: sentence }]
  return splitWords(sentence).flatMap((w) => wordToParts(w, part))
}

/**
 * The text, cut twice: into frames, and each frame into parts.
 *
 * The two cuts are independent axes because they answer different questions —
 * what gets moulded, and what holds it. The syllable runners (one syllable per coloured
 * frame, its ㅇ and ㅣ each gated separately) is part=jamo, runner=syllable.
 */
export function splitText(text: string, part: PartUnit, wanted: RunnerUnit): RunnerGroup[] {
  const runner = clampRunnerUnit(part, wanted)
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []

  if (runner === 'all') {
    const parts = sentences.flatMap((s) => sentenceToParts(s, part))
    return parts.length ? [{ parts, label: text.trim() }] : []
  }

  const groups: RunnerGroup[] = []
  for (const sentence of sentences) {
    if (runner === 'sentence') {
      const parts = sentenceToParts(sentence, part)
      if (parts.length) groups.push({ parts, label: sentence })
      continue
    }

    for (const word of splitWords(sentence)) {
      if (runner === 'word') {
        const parts = wordToParts(word, part)
        if (parts.length) groups.push({ parts, label: word })
        continue
      }

      // syllable: one frame per character
      for (const char of [...word]) {
        const parts = wordToParts(char, part)
        if (parts.length) groups.push({ parts, label: char })
      }
    }
  }
  return groups
}
