import { describe, expect, it } from 'vitest'
import { CHO, JONG, JUNG } from '../../../shared/text/hangul'
import { NEUTRAL, voiceFor, type VoiceTrim } from './voice'

/*
 * What this file is for.
 *
 * The constants in `voice.ts` were chosen by ear, and a number chosen by ear is
 * one person's number — tool 04 learned that about its finger-bend thresholds and
 * wrote it down. So nothing here asserts a value. Everything here asserts a
 * **relation that has to hold for any tuning of the kit**: that the alphabet's own
 * gradations come out as gradations in the sound, in the right direction.
 *
 * Which matters more in this tool than in the other four, because **sound cannot
 * be screenshotted.** A mapping that has quietly inverted looks exactly like one
 * that has not.
 */

/** Every syllable in the language. */
function everySyllable(): string[] {
  const out: string[] = []
  for (let code = 0xac00; code <= 0xd7a3; code++) out.push(String.fromCodePoint(code))
  return out
}

const syllable = (cho: string, jung: string, jong = '') => {
  const i = CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)
  return String.fromCodePoint(0xac00 + i * 28 + JONG.indexOf(jong))
}

/** `voiceFor` on a syllable built from three jamo, with the null already ruled out. */
const voice = (cho: string, jung: string, jong = '', trim: VoiceTrim = NEUTRAL) => {
  const spec = voiceFor(syllable(cho, jung, jong), trim)
  expect(spec).not.toBeNull()
  return spec!
}

describe('every syllable is playable', () => {
  it('answers for all 11,172 with nothing but finite numbers', () => {
    const bad: string[] = []
    for (const char of everySyllable()) {
      const v = voiceFor(char)
      if (!v) {
        bad.push(`${char}: null`)
        continue
      }
      const numbers = [
        v.pitch, v.open, v.glide, v.hits, v.roll, v.tail, v.ring, v.drive,
        v.attack.tint, v.attack.bite, v.attack.air,
        ...(v.ghost ? [v.ghost.tint, v.ghost.bite, v.ghost.air] : []),
      ]
      if (numbers.some((n) => !Number.isFinite(n))) bad.push(`${char}: not finite`)
      // A voice with no length and no pitch is a voice that cannot be heard, and
      // an engine given either would produce silence while looking busy — which
      // is the audio form of tool 02's ambient-occlusion pass painting 2.15
      // million pixels the same grey.
      if (v.tail <= 0) bad.push(`${char}: tail ${v.tail}`)
      if (v.pitch <= 0) bad.push(`${char}: pitch ${v.pitch}`)
      if (v.open < 0 || v.open > 1) bad.push(`${char}: open ${v.open}`)
    }
    expect(bad).toEqual([])
  })

  it('refuses anything that is not a syllable', () => {
    for (const char of ['A', ' ', '4', 'ㄱ', 'ㅜ', '-', '·', '']) {
      expect(voiceFor(char)).toBeNull()
    }
  })
})

describe('가획과 병서 — the alphabet adds energy, so the sound does', () => {
  /*
   * The five series where a plain consonant has a tense and/or an aspirate form.
   * ㅅ has no aspirate, which is why the rows are different lengths — the test
   * walks whatever is there rather than assuming three.
   */
  const SERIES = [
    ['ㄱ', 'ㄲ', 'ㅋ'],
    ['ㄷ', 'ㄸ', 'ㅌ'],
    ['ㅂ', 'ㅃ', 'ㅍ'],
    ['ㅅ', 'ㅆ'],
    ['ㅈ', 'ㅉ', 'ㅊ'],
  ]

  it('rises in bite through every series', () => {
    for (const series of SERIES) {
      const bites = series.map((cho) => voice(cho, 'ㅏ').attack.bite)
      for (let i = 1; i < bites.length; i++) {
        expect(bites[i], `${series[i]} over ${series[i - 1]}`).toBeGreaterThan(bites[i - 1])
      }
    }
  })

  it('keeps a series on one instrument while it gets harder', () => {
    // 둠 · 뚬 · 툼 have to be the same drum hit three ways, not three drums. The
    // moment a tense form lands on a different `hit` or a different `tint`, the
    // spelling has stopped being a dynamic mark and become a kit change.
    for (const series of SERIES) {
      const specs = series.map((cho) => voice(cho, 'ㅏ').attack)
      for (const a of specs) {
        expect(a.hit).toBe(specs[0].hit)
        expect(a.tint).toBe(specs[0].tint)
      }
    }
  })

  it('makes the tense form less breathy than the plain one, and the aspirate more', () => {
    // The reason there are two numbers and not one. A 경음 is more forceful *and*
    // drier; only a 격음 is more of both. A single "strength" value cannot say that.
    for (const [plain, tense, aspirate] of SERIES) {
      expect(voice(tense, 'ㅏ').attack.air).toBeLessThan(voice(plain, 'ㅏ').attack.air)
      if (aspirate) {
        expect(voice(aspirate, 'ㅏ').attack.air).toBeGreaterThan(voice(plain, 'ㅏ').attack.air)
      }
    }
  })
})

describe('초성 — where the mouth closes decides which drum', () => {
  it('orders the bursts dark to bright by place of articulation', () => {
    // 순음 → 아음 → 설음 → 치음. This ordering is the whole reason ㅂ comes out a
    // kick and ㄷ a snare without either being named anywhere.
    const tint = (cho: string) => voice(cho, 'ㅏ').attack.tint
    expect(tint('ㅂ')).toBeLessThan(tint('ㄱ'))
    expect(tint('ㄱ')).toBeLessThan(tint('ㄷ'))
    expect(tint('ㄷ')).toBeLessThan(tint('ㅅ'))
  })

  it('gives 초성 ㅇ no attack at all', () => {
    // 움 is 둠 with the transient taken off — a silent initial is a seat for the
    // vowel, not a consonant. This is the entry the reference's six sounds need.
    const bare = voice('ㅇ', 'ㅜ', 'ㅁ')
    expect(bare.attack.hit).toBe('none')
    expect(bare.attack.bite).toBe(0)

    // And it is the only initial that does. Anything else silently landing on
    // 'none' would be a hole in the kit that nobody would hear as a bug.
    const silent = CHO.filter((cho) => voice(cho, 'ㅏ').attack.hit === 'none')
    expect(silent).toEqual(['ㅇ'])
  })

  it('rolls on ㄹ and nowhere else in the initial', () => {
    expect(voice('ㄹ', 'ㅏ').roll).toBeGreaterThan(0)
    for (const cho of CHO.filter((c) => c !== 'ㄹ')) {
      expect(voice(cho, 'ㅏ').roll, cho).toBe(0)
    }
  })

  it('leaves the body alone — an initial never moves the pitch', () => {
    // Otherwise the three positions have stopped being three positions.
    const pitches = new Set(CHO.map((cho) => voice(cho, 'ㅜ').pitch))
    expect(pitches.size).toBe(1)
  })
})

describe('how much of a syllable is voice', () => {
  /*
   * The fix for everything sounding alike.
   *
   * The body is the loudest thing in a syllable and it used to play at one level
   * whatever the initial was — so a 츠 and a 으 were the same sawtooth with a
   * different scratch on the front. What separates them is not the attack: it is
   * how much *voice* the initial leaves behind it.
   */
  it('belongs to the initial — a final never moves it', () => {
    for (const cho of CHO) {
      const across = JONG.map((jong) => voice(cho, 'ㅜ', jong).attack.voiced)
      expect(new Set(across).size, cho).toBe(1)
      const onsets = JONG.map((jong) => voice(cho, 'ㅜ', jong).attack.onset)
      expect(new Set(onsets).size, cho).toBe(1)
      const delays = JONG.map((jong) => voice(cho, 'ㅜ', jong).attack.delay)
      expect(new Set(delays).size, cho).toBe(1)
    }
  })

  it('keeps the sonorants voiced and drops only the sibilants', () => {
    /*
     * **Measured, not assumed.** A recorded 우, 붐 and 둠 come back periodic to
     * within a few percent of each other — only the sibilants fall away, and they
     * fall a long way. An earlier tuning halved the body for every plosive, which
     * sounded like phonetics and was really a mixer decision.
     */
    const v = (cho: string) => voice(cho, 'ㅜ', 'ㅁ').attack.voiced
    for (const cho of ['ㅇ', 'ㅁ', 'ㄴ']) expect(v(cho), cho).toBeGreaterThanOrEqual(v('ㅂ'))
    expect(v('ㅂ') - v('ㅇ')).toBeGreaterThan(-0.2) // close, not halved
    expect(v('ㅂ')).toBeGreaterThan(v('ㅊ') * 2)
    expect(v('ㅊ')).toBeGreaterThan(v('ㅅ'))
    // And nothing is silent: every initial leaves some body, or the vowel is gone.
    for (const cho of CHO) expect(v(cho), cho).toBeGreaterThan(0)
  })

  it('starts the vowel later the more friction is in front of it', () => {
    /*
     * The relationship that separates the four initials, and the one guessing had
     * missed entirely. Time-to-peak in the recordings: 우 20ms, 붐 and 둠 70ms,
     * 추 105ms. That gap is not the vowel being quieter — it is the vowel not
     * having started, because a stop is a closure released into a vowel and an
     * affricate is a closure released into *friction* and then a vowel.
     */
    const d = (cho: string) => voice(cho, 'ㅜ', 'ㅁ').attack.delay
    expect(d('ㅇ')).toBe(0)
    expect(d('ㅁ')).toBe(0)
    expect(d('ㅂ')).toBeGreaterThan(d('ㅇ'))
    expect(d('ㅊ')).toBeGreaterThan(d('ㅂ'))
    expect(d('ㅅ')).toBeGreaterThan(d('ㅊ'))
    // Never so late that the syllable reads as arriving off the beat.
    for (const cho of CHO) expect(d(cho), cho).toBeLessThan(0.08)
  })

  it('swells where there is no release to strike with', () => {
    // ㅇ and the nasals have no burst, so the voice comes up rather than being
    // struck — that swell is the difference between 웅 humming and 웅 thudding.
    expect(voice('ㅇ', 'ㅜ', '').attack.onset).toBeGreaterThan(
      voice('ㅂ', 'ㅜ', '').attack.onset,
    )
  })

  it('leaves the least voice where there is the most noise', () => {
    // The two numbers describe one mouth, so they have to disagree with each other.
    const pairs = CHO.map((cho) => voice(cho, 'ㅜ', 'ㅁ').attack)
    const sibilants = pairs.filter((a) => a.tint > 0.8)
    const others = pairs.filter((a) => a.tint <= 0.5 && a.hit !== 'none')
    for (const s of sibilants) {
      for (const o of others) expect(s.voiced).toBeLessThan(o.voiced)
    }
  })
})

describe('중성 — the body', () => {
  it('brightens monotonically from the dark rounded vowels to the front ones', () => {
    const order = ['ㅜ', 'ㅗ', 'ㅡ', 'ㅓ', 'ㅏ', 'ㅐ', 'ㅔ', 'ㅣ']
    const opens = order.map((jung) => voice('ㄷ', jung).open)
    for (let i = 1; i < opens.length; i++) {
      expect(opens[i], `${order[i]} over ${order[i - 1]}`).toBeGreaterThan(opens[i - 1])
    }
  })

  it('raises the pitch along the same axis', () => {
    // Brightness and pitch move together, so one spelling of one drum covers a
    // bass note and a tick: 둠 is low, 딤 is high, and it is the same snare.
    const order = ['ㅜ', 'ㅗ', 'ㅡ', 'ㅓ', 'ㅏ', 'ㅐ', 'ㅔ', 'ㅣ']
    const pitches = order.map((jung) => voice('ㄷ', jung).pitch)
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]).toBeGreaterThan(pitches[i - 1])
    }
  })

  it('hits twice for the y-glide medials and once for everything else', () => {
    // ㅏ → ㅑ is one added stroke, and the stroke is a second articulation.
    const doubled = JUNG.filter((jung) => voice('ㄷ', jung).hits === 2)
    expect(doubled).toEqual(['ㅑ', 'ㅒ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ'])
  })

  it('glides only on the diphthongs, and towards the vowel it ends on', () => {
    const gliding = JUNG.filter((jung) => voice('ㄷ', jung).glide !== 0)
    expect(gliding).toEqual(['ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅢ'])
    // Every one of them is a back vowel moving to a more open or fronter one, so
    // every glide is upward. A negative one would mean a table entry is reversed.
    for (const jung of gliding) expect(voice('ㄷ', jung).glide, jung).toBeGreaterThan(0)
    // ㅚ (ㅗ→ㅣ) travels further than ㅘ (ㅗ→ㅏ), because ㅣ is further than ㅏ.
    expect(voice('ㄷ', 'ㅚ').glide).toBeGreaterThan(voice('ㄷ', 'ㅘ').glide)
  })

  it('starts a diphthong where its first element starts', () => {
    // ㅘ is ㅗ and ㅏ in one space: it must begin on ㅗ's note, not average them.
    expect(voice('ㄷ', 'ㅘ').pitch).toBe(voice('ㄷ', 'ㅗ').pitch)
    expect(voice('ㄷ', 'ㅝ').pitch).toBe(voice('ㄷ', 'ㅜ').pitch)
    expect(voice('ㄷ', 'ㅢ').pitch).toBe(voice('ㄷ', 'ㅡ').pitch)
  })

  it('keeps a y-glide on its base vowel', () => {
    for (const [base, glided] of [['ㅏ', 'ㅑ'], ['ㅓ', 'ㅕ'], ['ㅗ', 'ㅛ'], ['ㅜ', 'ㅠ']]) {
      expect(voice('ㄷ', glided).pitch).toBe(voice('ㄷ', base).pitch)
      expect(voice('ㄷ', glided).open).toBe(voice('ㄷ', base).open)
    }
  })
})

describe('종성 — how the mouth finishes decides the tail', () => {
  it('closes shorter the more the mouth closes', () => {
    /*
     * The ladder the kit is played on: **ㅂ < ㅁ < ㅇ < none.**
     *
     * 붑 is stopped dead, 붐 is closed and short, 붕 rings on, 부 is left open. Four
     * endings that have to be four lengths — an earlier tuning had ㅁ and ㅂ seven
     * milliseconds apart and they were the same sound.
     */
    const t = (jong: string) => voice('ㄷ', 'ㅜ', jong).tail
    expect(t('ㅂ')).toBeLessThan(t('ㅁ'))
    expect(t('ㅁ')).toBeLessThan(t('ㄴ'))
    expect(t('ㄴ')).toBeLessThan(t('ㅇ'))
    expect(t('ㅇ')).toBeLessThan(t(''))
    // Far enough apart to be heard as different, not as one value with jitter.
    expect(t('ㅁ') / t('ㅂ')).toBeGreaterThan(1.8)
    expect(t('ㅇ') / t('ㅁ')).toBeGreaterThan(2.5)
  })

  it('shuts the mouth as far forward as the closure is', () => {
    /*
     * Length alone was not enough: 붐 and 붕 differed by two hundred milliseconds
     * and by nothing else, so they read as one sound held for two durations.
     *
     * ㅁ is bilabial — the seal is at the very front, so nothing is left to ring and
     * the tail dives dark. ㅇ is velar — the seal is at the back and everything
     * ahead of it is still a pipe, so it stays open. ㄴ is between them, which is
     * where the tongue is.
     */
    const c = (jong: string) => voice('ㄷ', 'ㅜ', jong).close
    expect(c('ㅁ')).toBeGreaterThan(c('ㄴ'))
    expect(c('ㄴ')).toBeGreaterThan(c('ㅇ'))
    /*
     * And an open syllable closes **least of all** — strictly less than every coda,
     * not merely less than ㄴ. The looser version of this line let the table say
     * that 부 was darker than 붕, which is the opposite of both the anatomy and the
     * recordings, and the test still passed.
     */
    for (const jong of JONG.filter(Boolean)) expect(c(''), jong).toBeLessThan(c(jong))
  })

  it('leaves the closing to the final — an initial never moves it', () => {
    for (const jong of JONG) {
      const across = CHO.map((cho) => voice(cho, 'ㅜ', jong).close)
      expect(new Set(across).size, jong).toBe(1)
    }
  })

  it('rings more the more resonant the final is', () => {
    expect(voice('ㄷ', 'ㅜ', 'ㅁ').ring).toBeLessThan(voice('ㄷ', 'ㅜ', 'ㄴ').ring)
    expect(voice('ㄷ', 'ㅜ', 'ㄴ').ring).toBeLessThan(voice('ㄷ', 'ㅜ', 'ㅇ').ring)
  })

  it('cuts on the unreleased stops and nowhere else', () => {
    // 음절말 중화: only [ㄱ], [ㄷ] and [ㅂ] are unreleased. Sixteen of the
    // twenty-eight spellings land on one of them — twelve singles and the four
    // clusters whose surviving letter is a stop. The list is asserted whole so a
    // spelling cannot quietly move from a gate to a fade.
    const cutting = JONG.filter((jong) => voice('ㄷ', 'ㅜ', jong).cut)
    expect([...cutting].sort()).toEqual(
      [
        'ㄱ', 'ㄲ', 'ㅋ', // → [ㄱ]
        'ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅎ', // → [ㄷ]
        'ㅂ', 'ㅍ', // → [ㅂ]
        'ㄳ', 'ㄺ', // 넋 [넉] · 닭 [닥]
        'ㄿ', 'ㅄ', // 읊 [읍] · 값 [갑]
      ].sort(),
    )
    // ㄼ is the cluster that does *not* cut: 넓 is [널], and a ㄹ does not close.
    expect(voice('ㄷ', 'ㅜ', 'ㄼ').cut).toBe(false)
    // And a cut is always shorter than the shortest fade, or it is not a cut.
    for (const jong of cutting) {
      expect(voice('ㄷ', 'ㅜ', jong).tail).toBeLessThan(voice('ㄷ', 'ㅜ', 'ㅁ').tail)
    }
  })

  it('neutralises the seven ways Korean actually does', () => {
    // ㅅ·ㅆ·ㅈ·ㅊ·ㅌ·ㅎ → [ㄷ], ㅋ·ㄲ → [ㄱ], ㅍ → [ㅂ]. A final that sounded like
    // its spelling rather than its pronunciation would be a transliteration, not
    // a reading.
    const release = (jong: string) => {
      const v = voice('ㄷ', 'ㅜ', jong)
      return { tail: v.tail, ring: v.ring, cut: v.cut }
    }
    for (const jong of ['ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅎ']) {
      expect(release(jong), jong).toEqual(release('ㄷ'))
    }
    for (const jong of ['ㄲ', 'ㅋ']) expect(release(jong), jong).toEqual(release('ㄱ'))
    expect(release('ㅍ')).toEqual(release('ㅂ'))
  })

  it('gives every 겹받침 a ghost and every single final none', () => {
    const clusters = ['ㄳ', 'ㄵ', 'ㄶ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅄ']
    const ghosted = JONG.filter((jong) => voice('ㄷ', 'ㅜ', jong).ghost !== null)
    expect(ghosted.sort()).toEqual([...clusters].sort())
    // The ghost is the letter 자음군 단순화 drops — 값 is [갑], so the ㅅ is the
    // one that goes quiet, and it is the ㅅ that comes back as a tap.
    expect(voice('ㄷ', 'ㅜ', 'ㅄ').ghost).toEqual(voice('ㅅ', 'ㅏ').attack)
    expect(voice('ㄷ', 'ㅜ', 'ㄺ').ghost).toEqual(voice('ㄹ', 'ㅏ').attack)
  })

  it('leaves the attack alone — a final never moves the transient', () => {
    const attacks = new Set(JONG.map((jong) => JSON.stringify(voice('ㄷ', 'ㅜ', jong).attack)))
    expect(attacks.size).toBe(1)
  })
})

describe('the reference six', () => {
  it('is one note, three attacks and two tails', () => {
    // 둠 · 움 · 붐 · 둥 · 웅 · 붕 — the sounds the tool was asked for, and what
    // they are in this mapping: {ㄷ ㅇ ㅂ} x ㅜ x {ㅁ ㅇ}. One pitch across all
    // six, three different transients, two different lengths.
    const six = ['둠', '움', '붐', '둥', '웅', '붕'].map((s) => voiceFor(s)!)
    expect(six.every((v) => v !== null)).toBe(true)
    expect(new Set(six.map((v) => v.pitch)).size).toBe(1)
    expect(new Set(six.map((v) => v.tail)).size).toBe(2)
    /*
     * Three transients, but only **two** mechanisms.
     *
     * ㄷ and ㅂ are both bursts — a release of a closure — and what separates a
     * snare from a kick is where the closure was, which is `tint`. Only ㅇ is a
     * different mechanism, because it is no mechanism. Asserting three `hit`s
     * here would be asserting that the mapping has stopped grouping consonants
     * the way the alphabet does.
     */
    expect(new Set(six.map((v) => v.attack.hit)).size).toBe(2)
    expect(new Set(six.map((v) => v.attack.tint)).size).toBe(3)
    // And the bass ones really are bass: the darkest, lowest vowel there is.
    for (const v of six) expect(v.open).toBeLessThan(0.2)
  })

  it('reads 붐 as a kick and 츱 as a hat', () => {
    // The opening document's outer two lanes, checked to be two different
    // instruments rather than two spellings of one.
    expect(voiceFor('붐')!.attack.tint).toBeLessThan(0.2)
    expect(voiceFor('츱')!.attack.tint).toBeGreaterThan(0.8)
    expect(voiceFor('츱')!.attack.hit).toBe('chirp')
    // The hat is short: 츱 ends on an unreleased [ㅂ], so it is cut, not faded.
    expect(voiceFor('츱')!.cut).toBe(true)
  })

  it('still knows the vowels the deck cannot build', () => {
    /*
     * 칫 is the hat this tool would use if ㅣ stacked. It does not — 세로모임꼴만 —
     * so the machine cannot dial it, and 츱 stands in.
     *
     * The sound table keeps it anyway, and keeps all twenty-one medials, because
     * **that table is linguistics rather than layout.** Trimming it to the five the
     * deck reaches would make the mapping a description of one UI decision, and the
     * day the horizontal arrangement is thought through the sound is already there.
     */
    for (const char of ['칫', '밤', '뷁', '왕']) {
      const v = voiceFor(char)
      expect(v, char).not.toBeNull()
      expect(v!.tail).toBeGreaterThan(0)
    }
    expect(voiceFor('칫')!.attack.hit).toBe('chirp')
  })
})

describe('the trim scales, it does not replace', () => {
  const TRIMS: VoiceTrim[] = [
    NEUTRAL,
    { tune: -12, attack: 0.4, tail: 0.3, tone: -0.5, drive: 0 },
    { tune: 19, attack: 1.8, tail: 2, tone: 0.6, drive: 1 },
    // The degenerate ones, which is where a multiplier turns into a replacement
    // if anybody ever writes `Math.max(0.5, ...)` into the wrong line.
    { tune: 0, attack: 0, tail: 0, tone: -1, drive: 0 },
    { tune: 0, attack: 4, tail: 4, tone: 1, drive: 1 },
  ]

  it('never inverts the orderings the alphabet sets', () => {
    /*
     * Non-strict, and deliberately so: `open` and `bite` are clamped to 0..1, so a
     * hard enough trim flattens the top or the bottom of a run and two values
     * become equal. What must never happen is a swap. Equal is a trim pushed to
     * its end; reversed is a bug.
     */
    for (const trim of TRIMS) {
      const vowels = ['ㅜ', 'ㅗ', 'ㅡ', 'ㅓ', 'ㅏ', 'ㅐ', 'ㅔ', 'ㅣ']
      const opens = vowels.map((jung) => voice('ㄷ', jung, '', trim).open)
      for (let i = 1; i < opens.length; i++) {
        expect(opens[i], `open ${vowels[i]} under ${JSON.stringify(trim)}`).toBeGreaterThanOrEqual(opens[i - 1])
      }

      const bites = ['ㄱ', 'ㄲ', 'ㅋ'].map((cho) => voice(cho, 'ㅏ', '', trim).attack.bite)
      expect(bites[1]).toBeGreaterThanOrEqual(bites[0])
      expect(bites[2]).toBeGreaterThanOrEqual(bites[1])

      const finals = ['ㅁ', 'ㄴ', 'ㅇ', ''].map((jong) => voice('ㄷ', 'ㅜ', jong, trim).tail)
      for (let i = 1; i < finals.length; i++) {
        expect(finals[i]).toBeGreaterThanOrEqual(finals[i - 1])
      }
    }
  })

  it('cannot silence a voice or make it unplayable', () => {
    for (const trim of TRIMS) {
      for (const char of ['둠', '붕', '칫', '똬', '값', '읊']) {
        const v = voiceFor(char, trim)!
        expect(v.tail, `${char} ${JSON.stringify(trim)}`).toBeGreaterThan(0)
        expect(v.pitch).toBeGreaterThan(0)
        expect(Number.isFinite(v.pitch)).toBe(true)
      }
    }
  })

  it('cannot change which instrument a jamo is, or how a final ends', () => {
    // The line between trimming and replacing. Tune moves the note; it must not
    // turn a kick into a hat, and no amount of Tail may un-cut an unreleased stop.
    for (const trim of TRIMS) {
      expect(voice('ㅂ', 'ㅏ', '', trim).attack.hit).toBe(voice('ㅂ', 'ㅏ').attack.hit)
      expect(voice('ㅂ', 'ㅏ', '', trim).attack.tint).toBe(voice('ㅂ', 'ㅏ').attack.tint)
      expect(voice('ㄷ', 'ㅜ', 'ㄱ', trim).cut).toBe(true)
      expect(voice('ㄷ', 'ㅜ', 'ㅁ', trim).cut).toBe(false)
      expect(voice('ㄷ', 'ㅑ', '', trim).hits).toBe(2)
    }
  })

  it('passes neutral trim through untouched', () => {
    const v = voiceFor('둠')!
    expect(v).toEqual(voiceFor('둠', NEUTRAL))
    expect(v.glide).toBe(0)
    expect(v.hits).toBe(1)
  })
})
