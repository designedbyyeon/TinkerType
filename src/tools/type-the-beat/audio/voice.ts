import { decompose } from '../../../shared/text/hangul'

/**
 * A syllable, read as a sound.
 *
 * **This is the file the tool stands on, and it knows nothing about Web Audio.**
 * No context, no nodes, no DOM — a syllable in, numbers out. That is what makes
 * it the unit-testable core the geometry modules are in the other four tools, and
 * the invariants in `voice.test.ts` are the real specification.
 *
 * The premise, stated once: **한글 음절의 세 자리가 소리의 세 구간과 맞는다.**
 *
 *   초성 → the attack.   Where the mouth closes decides which drum it is.
 *   중성 → the body.     How open and how far forward decides pitch and colour.
 *   종성 → the release.  How the mouth finishes decides the tail.
 *
 * None of the three tables below is invented. The initials are grouped by the
 * 오음 the alphabet is itself organised by; the medials are built from eight
 * monophthongs exactly the way the letters are built from them; and the finals
 * are the real 음절말 중화 — the seven sounds a Korean syllable can actually end
 * in — rather than twenty-eight made-up entries.
 *
 * **The jamo decide and the designer trims.** `VoiceTrim` only ever scales or
 * offsets what came out of the tables. If a trim were ever allowed to replace a
 * value, the jamo would become labels on a drum machine and the tool would have
 * no argument left.
 */

/** What the attack is made of. */
export type Hit =
  /** 파열음 — a burst. Which drum it is comes from `tint`. */
  | 'burst'
  /** 마찰음 — filtered noise. Hats, shakers. */
  | 'noise'
  /** 파찰음 — a burst with noise on top. A closed hat, a "ch". */
  | 'chirp'
  /** 비음 — no burst at all, a pitched body that fades in. */
  | 'hum'
  /** 유음 — a burst that repeats. See `roll`. */
  | 'flap'
  /** 후음 ㅎ — breath, no closure. */
  | 'breath'
  /** 초성 ㅇ is silent. The vowel arrives with no attack on it. */
  | 'none'

/**
 * 오음 — the five places the alphabet groups its consonants by, and the reason
 * `tint` is a single number.
 *
 * The values are the acoustic order, not the anatomical one: a bilabial release
 * has almost no cavity in front of it and comes out dark, an alveolar one is
 * bright, and a sibilant is brighter than any stop. That ordering is why ㅂ is a
 * kick and ㄷ is a snare without either of them being told so.
 */
const TINT: Record<string, number> = {
  bilabial: 0.08, // 순음 ㅁㅂㅃㅍ
  velar: 0.45, // 아음 ㄱㄲㅋ
  glottal: 0.35, // 후음 ㅇㅎ
  alveolar: 0.68, // 설음 ㄴㄷㄸㅌㄹ
  sibilant: 0.92, // 치음 ㅅㅆㅈㅉㅊ
}

/**
 * 가획과 병서 — the two ways the alphabet adds energy to a plain consonant, and
 * the reason a designer never needs an accent control.
 *
 * ㄱ → ㅋ is one added stroke and one added puff of air. ㄱ → ㄲ is the letter
 * written twice and the sound made tense. So 뚬 is a harder kick than 둠 and 툼 is
 * an airier one, and the dynamics of a bar are already in its spelling.
 *
 * `bite` rises through all three, which is the invariant the test pins down.
 * `air` does **not**, and that is the point of having two numbers: a 경음 is
 * *more* forceful and *less* breathy than a 평음, while a 격음 is more of both.
 */
const PLAIN = { bite: 0.35, air: 0.25 } // 평음 ㄱㄷㅂㅅㅈ
const TENSE = { bite: 0.6, air: 0.1 } // 경음 ㄲㄸㅃㅆㅉ
const ASPIRATE = { bite: 0.85, air: 0.75 } // 격음 ㅋㅌㅍㅊ

export interface Attack {
  hit: Hit
  /** 0..1 spectral centre, from the 오음 group. */
  tint: number
  /** 0..1 force, from 가획/병서. */
  bite: number
  /** 0..1 aspiration. */
  air: number
  /**
   * 0..1 — **how much of this syllable is voice rather than noise.**
   *
   * The value that was missing, and the reason everything used to sound the same.
   * The body was the loudest thing in every syllable and it played at one level
   * whatever the initial was, so a 츠 and a 으 were the same sawtooth with a
   * different scratch on the front.
   *
   * It is not a mixer setting: it is what the mouth is doing. ㅇ is a seat for the
   * vowel and nothing else, so it is all voice. ㅅ is friction with the vocal folds
   * barely engaged. A plosive is a burst *and then* a vowel, so it sits between.
   */
  voiced: number
  /**
   * Seconds the body takes to come in.
   *
   * A nasal or a silent initial has no release, so the voice swells; a burst is
   * struck. That swell is what makes 웅 and 움 hum rather than thud.
   */
  onset: number
  /**
   * Seconds before the body starts at all.
   *
   * **Measured off real Korean, and the thing that was missing.** An affricate is
   * friction *and then* a vowel — a recorded 추 takes 105ms to reach its peak
   * against 우's 20ms, and that gap is not the vowel being quieter, it is the vowel
   * not having started. Making the body merely smaller for ㅊ got the loudness right
   * and left every initial sounding as though it began at the same instant.
   */
  delay: number
}

const attack = (
  hit: Hit,
  place: keyof typeof TINT,
  force: { bite: number; air: number },
  voice: { voiced: number; onset: number; delay: number },
): Attack => ({ hit, tint: TINT[place], ...force, ...voice })

/**
 * How much voice a manner carries, how fast it arrives, and **when it starts**.
 *
 * All three measured against recorded Korean rather than guessed. Two things came
 * back that guessing had got wrong.
 *
 * **The voicing barely differs between the sonorants.** A recorded 우, 붐 and 둠 are
 * all periodic to within a few percent — only the sibilants drop, and they drop a
 * long way. An earlier tuning halved the body for every plosive, which is a mixer
 * decision dressed up as phonetics.
 *
 * **What differs is when the vowel begins.** Time-to-peak in the recordings: 우 20ms,
 * 붐 and 둠 70ms, 추 105ms. That spread is the manner of articulation — a stop is a
 * closure released into a vowel, an affricate is a closure released into *friction*
 * and then a vowel — and it does more to separate the four than any level ever did.
 */
const BURST = { voiced: 0.9, onset: 0.022, delay: 0.018 }
const NASAL = { voiced: 1, onset: 0.03, delay: 0 }
const HISS = { voiced: 0.22, onset: 0.03, delay: 0.055 }
const AFFRICATE = { voiced: 0.35, onset: 0.03, delay: 0.045 }

/** Every initial, by where the mouth closes, how hard, and how much of it is voice. */
const CHO_VOICE: Record<string, Attack> = {
  // 아음 — a compact mid click. Claves, rimshots.
  ㄱ: attack('burst', 'velar', PLAIN, BURST),
  ㄲ: attack('burst', 'velar', TENSE, BURST),
  ㅋ: attack('burst', 'velar', ASPIRATE, BURST),
  // 설음 — bright bursts. Snares.
  ㄷ: attack('burst', 'alveolar', PLAIN, BURST),
  ㄸ: attack('burst', 'alveolar', TENSE, BURST),
  ㅌ: attack('burst', 'alveolar', ASPIRATE, BURST),
  // 설음, but nasal: no release at all, so no burst. A soft pitched tone.
  ㄴ: attack('hum', 'alveolar', { bite: 0.14, air: 0.05 }, NASAL),
  // 설음, but liquid: the tongue taps more than once.
  ㄹ: attack('flap', 'alveolar', { bite: 0.3, air: 0.12 }, { voiced: 0.85, onset: 0.012, delay: 0.008 }),
  /*
   * 순음 — dark bursts with nothing in front of them. Kicks, and the one manner
   * that keeps more of its voice than the other plosives: the lips are the last
   * thing to open, so the vowel is already running when they do.
   */
  ㅂ: attack('burst', 'bilabial', PLAIN, BURST),
  ㅃ: attack('burst', 'bilabial', TENSE, BURST),
  ㅍ: attack('burst', 'bilabial', ASPIRATE, BURST),
  // 순음, nasal: the sub-bass of the alphabet.
  ㅁ: attack('hum', 'bilabial', { bite: 0.12, air: 0.04 }, NASAL),
  // 치음 — noise. Hats and shakers, and almost no voice at all.
  ㅅ: attack('noise', 'sibilant', PLAIN, HISS),
  ㅆ: attack('noise', 'sibilant', TENSE, HISS),
  // 치음, affricate: a burst with the friction still on it. A closed hat.
  ㅈ: attack('chirp', 'sibilant', PLAIN, AFFRICATE),
  ㅉ: attack('chirp', 'sibilant', TENSE, AFFRICATE),
  ㅊ: attack('chirp', 'sibilant', ASPIRATE, AFFRICATE),
  // 후음 — breath with no closure anywhere.
  ㅎ: attack('breath', 'glottal', { bite: 0.3, air: 0.9 }, { voiced: 0.4, onset: 0.04, delay: 0.03 }),
  /*
   * And the one that does nothing.
   *
   * 초성 ㅇ is not a consonant; it is the seat a syllable needs when it begins
   * with its vowel. So it gets no attack, and 움 is the body of 둠 with the
   * transient taken off — which is exactly what a pad is next to a drum. This is
   * the entry that makes the reference's own six sounds work: 둠 · 움 · 붐 is a
   * snare, a pad and a kick on the same note.
   */
  /*
   * And the one that does nothing — **so it is all voice.**
   *
   * 초성 ㅇ is not a consonant; it is the seat a syllable needs when it begins with
   * its vowel. No burst, no friction, and the body swells in over fifty
   * milliseconds instead of being struck. That swell is the whole difference
   * between 웅 humming and 웅 thudding, and it is why this entry carries the
   * largest `voiced` and the longest `onset` in the table.
   */
  ㅇ: { hit: 'none', tint: TINT.glottal, bite: 0, air: 0, voiced: 1, onset: 0.045, delay: 0 },
}

/**
 * The eight monophthongs, and nothing else.
 *
 * `open` is how bright — roughly F2, the front-back axis, with openness folded
 * in. `pitch` is the body's fundamental in Hz, low for the dark rounded vowels
 * and high for the front ones, so that ㅜ is a bass note and ㅣ is a tick **at the
 * same spelling of the same drum**.
 */
const VOWEL: Record<string, { pitch: number; open: number }> = {
  ㅜ: { pitch: 55, open: 0.12 }, // close back rounded — darkest, lowest
  ㅗ: { pitch: 62, open: 0.2 }, // mid back rounded
  ㅡ: { pitch: 73, open: 0.38 }, // close back unrounded — flat, neutral
  ㅓ: { pitch: 82, open: 0.46 }, // mid central
  ㅏ: { pitch: 98, open: 0.58 }, // open central — the loud one
  ㅐ: { pitch: 110, open: 0.72 }, // open-mid front
  ㅔ: { pitch: 123, open: 0.78 }, // mid front
  ㅣ: { pitch: 147, open: 0.92 }, // close front — brightest, highest
}

/**
 * All twenty-one medials, **built the way the letters are built.**
 *
 * A ㅑ is a ㅏ with one more stroke, and that stroke is a y-glide: the syllable is
 * articulated twice. So it hits twice. A ㅘ is a ㅗ and a ㅏ written into one
 * space, so it starts on ㅗ's note and slides to ㅏ's.
 *
 * Deriving the compounds from the eight rather than tabulating twenty-one numbers
 * is not brevity — it is what keeps a diphthong from ever disagreeing with the
 * vowels it is made of.
 */
const MEDIAL: Record<string, { base: string; glideTo?: string; yGlide?: boolean }> = {
  ㅏ: { base: 'ㅏ' },
  ㅐ: { base: 'ㅐ' },
  ㅑ: { base: 'ㅏ', yGlide: true },
  ㅒ: { base: 'ㅐ', yGlide: true },
  ㅓ: { base: 'ㅓ' },
  ㅔ: { base: 'ㅔ' },
  ㅕ: { base: 'ㅓ', yGlide: true },
  ㅖ: { base: 'ㅔ', yGlide: true },
  ㅗ: { base: 'ㅗ' },
  ㅘ: { base: 'ㅗ', glideTo: 'ㅏ' },
  ㅙ: { base: 'ㅗ', glideTo: 'ㅐ' },
  ㅚ: { base: 'ㅗ', glideTo: 'ㅣ' },
  ㅛ: { base: 'ㅗ', yGlide: true },
  ㅜ: { base: 'ㅜ' },
  ㅝ: { base: 'ㅜ', glideTo: 'ㅓ' },
  ㅞ: { base: 'ㅜ', glideTo: 'ㅔ' },
  ㅟ: { base: 'ㅜ', glideTo: 'ㅣ' },
  ㅠ: { base: 'ㅜ', yGlide: true },
  ㅡ: { base: 'ㅡ' },
  ㅢ: { base: 'ㅡ', glideTo: 'ㅣ' },
  ㅣ: { base: 'ㅣ' },
}

/**
 * How a syllable ends, in the seven ways it actually can.
 *
 * **음절말 중화.** Korean realises only ㄱㄴㄷㄹㅁㅂㅇ in final position: ㅅ·ㅆ·
 * ㅈ·ㅊ·ㅌ·ㅎ all come out as [ㄷ], ㅋ·ㄲ as [ㄱ], ㅍ as [ㅂ]. So the release is
 * keyed on the seven, and the twenty-eight spellings map onto them. Writing
 * twenty-eight separate tails would be inventing distinctions a Korean mouth does
 * not make.
 *
 * `tail` is monotone through the resonants, which is the invariant the test pins:
 * ㅁ closes the lips and stops it dead, ㄴ is halfway, ㅇ rings, and no final at
 * all is left open. That single column is the reference's 둠/둥 pair.
 */
interface Release {
  /** Seconds at neutral trim. */
  tail: number
  /** 0..1 how much the tail resonates rather than just decays. */
  ring: number
  /**
   * 0..1 — how far the mouth shuts over the tail, as a filter closing.
   *
   * **Length alone was not enough.** 붐 and 붕 differed by two hundred milliseconds
   * and by nothing else, so they read as one sound held for two durations. What
   * actually separates them is where the closure is: ㅁ is bilabial, the lips seal
   * and the sound goes dark as it dies; ㅇ is velar, the passage stays open behind
   * the tongue and it rings out bright.
   */
  close: number
  /** An unreleased stop: the sound is cut, not faded. */
  cut: boolean
  /** Extra taps in the tail. ㄹ flutters. */
  roll: number
}

/**
 * How a syllable ends, in the seven ways it actually can — and each one has to be a
 * *different sound*, not the same sound at a different length.
 */
const RELEASE: Record<string, Release> = {
  /*
   * No final: **nothing closes**, so nothing damps it either. The longest tail
   * there is, and the brightest — a syllable that ends on its own vowel ends on the
   * vowel undiminished. This used to be written as closing *more* than ㅇ, which is
   * backwards on its face and measured backwards too: recorded 부 comes back with
   * twice the high content of 붕, and this table had it with less.
   */
  '': { tail: 0.72, ring: 0.3, close: 0, cut: false, roll: 0 },
  /*
   * 붕 · 둥 — the velar nasal. The tongue seals at the back and everything in front
   * of it becomes a resonant pipe, so this is the one ending that gets *longer and
   * brighter*: a slight held note rather than a decay.
   */
  ㅇ: { tail: 0.6, ring: 0.92, close: 0.3, cut: false, roll: 0 },
  ㄴ: { tail: 0.38, ring: 0.62, close: 0.55, cut: false, roll: 0 },
  /*
   * 붐 · 둠 · 춤 — the lips close and it is over. Short, and **dark**: the closure is
   * right at the front, so there is no cavity left to ring and the tail dives.
   */
  /*
   * A recorded 붐 runs *longer* than 부, because a nasal coda is held — the lips
   * close and the hum carries on behind them. So this is not a truncation: the
   * vowel stops early and a dark, quiet murmur continues. Short next to ㅇ, which is
   * what makes it 단음, and nowhere near as short as a stop.
   */
  ㅁ: { tail: 0.22, ring: 0.28, close: 0.86, cut: false, roll: 0 },
  // The liquid does not close either — it flutters.
  ㄹ: { tail: 0.34, ring: 0.5, close: 0.22, cut: false, roll: 1 },
  /*
   * 붑! 춥! 뭅! — 불파음. The closure is made and **never released**, so this is not a
   * short decay: it is a note stopped dead, with the closure itself audible as a
   * thump. Shorter than ㅁ and a different shape from it.
   */
  ㄱ: { tail: 0.06, ring: 0.06, close: 0.5, cut: true, roll: 0 },
  ㄷ: { tail: 0.055, ring: 0.06, close: 0.5, cut: true, roll: 0 },
  ㅂ: { tail: 0.06, ring: 0.06, close: 0.7, cut: true, roll: 0 },
}

/**
 * Every final spelling → what is actually pronounced, and what is silenced.
 *
 * The second entry is the letter that gets dropped by 자음군 단순화: 값 is [갑],
 * 닭 is [닥], 삶 is [삼]. It is not lost for good — it comes back the moment a
 * vowel follows (닭이 → [다기]) — so this tool makes it audible as a ghost tap
 * inside the tail. Which is the reason a cluster is worth typing here at all.
 */
const FINAL: Record<string, { as: string; ghost?: string }> = {
  '': { as: '' },
  ㄱ: { as: 'ㄱ' },
  ㄲ: { as: 'ㄱ' },
  ㅋ: { as: 'ㄱ' },
  ㄴ: { as: 'ㄴ' },
  ㄷ: { as: 'ㄷ' },
  ㅅ: { as: 'ㄷ' },
  ㅆ: { as: 'ㄷ' },
  ㅈ: { as: 'ㄷ' },
  ㅊ: { as: 'ㄷ' },
  ㅌ: { as: 'ㄷ' },
  ㅎ: { as: 'ㄷ' },
  ㄹ: { as: 'ㄹ' },
  ㅁ: { as: 'ㅁ' },
  ㅂ: { as: 'ㅂ' },
  ㅍ: { as: 'ㅂ' },
  ㅇ: { as: 'ㅇ' },
  // 겹받침 — one is pronounced, the other becomes the ghost.
  ㄳ: { as: 'ㄱ', ghost: 'ㅅ' }, // 넋 [넉]
  ㄵ: { as: 'ㄴ', ghost: 'ㅈ' }, // 앉 [안]
  ㄶ: { as: 'ㄴ', ghost: 'ㅎ' }, // 많 [만]
  ㄺ: { as: 'ㄱ', ghost: 'ㄹ' }, // 닭 [닥]
  ㄻ: { as: 'ㅁ', ghost: 'ㄹ' }, // 삶 [삼]
  ㄼ: { as: 'ㄹ', ghost: 'ㅂ' }, // 넓 [널]
  ㄽ: { as: 'ㄹ', ghost: 'ㅅ' }, // 외곬 [골]
  ㄾ: { as: 'ㄹ', ghost: 'ㅌ' }, // 핥 [할]
  ㄿ: { as: 'ㅂ', ghost: 'ㄹ' }, // 읊 [읍]
  ㅀ: { as: 'ㄹ', ghost: 'ㅎ' }, // 싫 [실]
  ㅄ: { as: 'ㅂ', ghost: 'ㅅ' }, // 값 [갑]
}

/**
 * What the designer is allowed to do to all of it.
 *
 * **Every field is a scale or an offset, never a replacement.** The panel's Voice
 * group can lean the whole kit warmer or longer or harder; it cannot make a ㅁ
 * end like a ㅇ. Neutral is `NEUTRAL` below, and at neutral the tables come
 * through untouched.
 */
export interface VoiceTrim {
  /** Semitones, applied to every pitch. */
  tune: number
  /** Multiplier on `bite`. */
  attack: number
  /** Multiplier on `tail`. */
  tail: number
  /** Offset on `open`, −1..1. */
  tone: number
  /** 0..1, handed straight to the engine's saturator. */
  drive: number
}

export const NEUTRAL: VoiceTrim = { tune: 0, attack: 1, tail: 1, tone: 0, drive: 0.2 }

export interface VoiceSpec {
  attack: Attack
  /** Hz, after `tune`. */
  pitch: number
  /** 0..1 brightness, after `tone`. */
  open: number
  /** Semitones the body slides over its own length. 0 for a monophthong. */
  glide: number
  /** 2 for the y-glide medials ㅑㅕㅛㅠㅒㅖ — the letter is articulated twice. */
  hits: 1 | 2
  /** Extra taps, from a ㄹ in either position. */
  roll: number
  /** Seconds, after `tail`. */
  tail: number
  ring: number
  /** 0..1 how far the body's filter shuts over the tail. Where the closure is. */
  close: number
  /** Unreleased final: cut it, do not fade it. */
  cut: boolean
  /** The silenced half of a 겹받침, as a tap inside the tail. */
  ghost: Attack | null
  /** Passed through from the trim. */
  drive: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const semitones = (from: number, to: number) => 12 * Math.log2(to / from)

/**
 * A syllable as a sound.
 *
 * `null` for anything that is not a Hangul syllable — a space, a Latin letter, a
 * digit. The caller decides what that means; `pattern.ts` turns it into a rest
 * and says so on the status line rather than dropping it in silence.
 */
export function voiceFor(syllable: string, trim: VoiceTrim = NEUTRAL): VoiceSpec | null {
  const jamo = decompose(syllable)
  if (!jamo) return null

  const initial = CHO_VOICE[jamo.cho]
  const medial = MEDIAL[jamo.jung]
  const spelling = FINAL[jamo.jong]
  // Unreachable through `decompose`, which only ever returns table entries — but
  // the tables are hand-written and this is the one place a typo in them would
  // otherwise surface as a `NaN` three modules downstream.
  if (!initial || !medial || !spelling) return null

  const base = VOWEL[medial.base]
  const release = RELEASE[spelling.as]

  const glide = medial.glideTo ? semitones(base.pitch, VOWEL[medial.glideTo].pitch) : 0
  // A diphthong's colour is where it starts; the slide is what takes it up.
  const open = clamp01(base.open + trim.tone)

  return {
    attack: {
      ...initial,
      bite: clamp01(initial.bite * trim.attack),
    },
    pitch: base.pitch * Math.pow(2, trim.tune / 12),
    open,
    glide,
    hits: medial.yGlide ? 2 : 1,
    roll: (initial.hit === 'flap' ? 2 : 0) + release.roll,
    // Floored rather than merely multiplied: a tail of exactly zero is a click
    // with no body, and `tail: 0` would divide by nothing in the envelope.
    tail: Math.max(0.01, release.tail * trim.tail),
    ring: release.ring,
    close: release.close,
    cut: release.cut,
    ghost: spelling.ghost ? CHO_VOICE[spelling.ghost] ?? null : null,
    drive: clamp01(trim.drive),
  }
}

/** The jamo each wheel can hold, in the order they sit on a rim. */
export const VOICED_CHO = Object.keys(CHO_VOICE)
export const VOICED_JUNG = Object.keys(MEDIAL)
export const VOICED_JONG = Object.keys(FINAL)
