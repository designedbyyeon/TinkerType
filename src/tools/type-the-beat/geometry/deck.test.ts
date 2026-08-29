import { describe, expect, it } from 'vitest'
import { CHO, JONG, JUNG, compose } from '../../../shared/text/hangul'
import { voiceFor } from '../audio/voice'
import {
  CHO_RIM,
  JONG_RIM,
  JUNG_RIM,
  VERTICAL_JUNG,
  deckOf,
  dividersOf,
  isStacked,
  itemAt,
  readingOf,
  restSpin,
  rimAt,
  snapAlong,
  snapTo,
  type DeckSpec,
} from './deck'

const SPEC: DeckSpec = { radius: 92, letter: 35, spacing: 0.95 }

const deck = (syllable: string, spec: Partial<DeckSpec> = {}) => {
  const d = deckOf(syllable, { ...SPEC, ...spec })
  expect(d, syllable).not.toBeNull()
  return d!
}

/** Every syllable the kit can actually build. */
function playable(): string[] {
  const out: string[] = []
  for (const cho of CHO_RIM) {
    for (const jung of JUNG_RIM) {
      for (const jong of JONG_RIM) out.push(compose({ cho, jung, jong })!)
    }
  }
  return out
}

describe('the kit', () => {
  it('is four initials, two medials and four finals', () => {
    // Chosen, not derived. This is the whole vocabulary of the instrument, so it
    // is worth one test that says so out loud.
    expect(CHO_RIM).toEqual(['ㄷ', 'ㅂ', 'ㅇ', 'ㅊ'])
    expect(JUNG_RIM).toEqual(['ㅜ', 'ㅡ'])
    expect(JONG_RIM).toEqual(['', 'ㅁ', 'ㅂ', 'ㅇ'])
    expect(playable()).toHaveLength(32)
  })

  it('draws only from the tables the alphabet defines', () => {
    for (const j of CHO_RIM) expect(CHO).toContain(j)
    for (const j of JONG_RIM) expect(JONG).toContain(j)
    // The slider may only offer what the machine can stack.
    for (const j of JUNG_RIM) expect(VERTICAL_JUNG).toContain(j)
  })

  it('offers no-final, because taking the ending off is a move', () => {
    expect(JONG_RIM).toContain('')
  })

  it('runs the slider low to bright, because the vowel is the pitch', () => {
    /*
     * A list has a direction and a ring does not, so the direction is free to mean
     * something — and here it means what the vowel means. Asserted against the
     * sound rather than against the list: the ordering is only meaningful if it
     * agrees with what `voice.ts` actually plays.
     */
    const pitches = JUNG_RIM.map(
      (jung) => voiceFor(compose({ cho: 'ㅂ', jung, jong: 'ㅁ' })!)!.pitch,
    )
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i], JUNG_RIM[i]).toBeGreaterThan(pitches[i - 1])
    }
  })

  it('spans four places of articulation, so the kit is four instruments', () => {
    // The initials are a drum kit *because of* the 오음, not in spite of them. Two
    // letters from one place would be two of the same instrument.
    const tints = CHO_RIM.map((cho) => voiceFor(compose({ cho, jung: 'ㅜ', jong: 'ㅁ' })!)!.attack.tint)
    expect(new Set(tints).size).toBe(CHO_RIM.length)
  })

  it('spans the four ways a syllable can end', () => {
    const ends = JONG_RIM.map((jong) => {
      const v = voiceFor(compose({ cho: 'ㄷ', jung: 'ㅜ', jong })!)!
      return `${v.cut}:${v.tail}`
    })
    expect(new Set(ends).size).toBe(JONG_RIM.length)
  })
})

describe('세로모임꼴만 — the machine builds one arrangement', () => {
  it('accepts exactly the five medials that set underneath', () => {
    const stacked = JUNG.filter((jung) => isStacked(compose({ cho: 'ㄷ', jung, jong: '' })!))
    expect(stacked).toEqual(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'])
    expect(VERTICAL_JUNG).toEqual(stacked)
  })

  it('refuses a syllable it could not build', () => {
    for (const syllable of ['밤', '담', '왕', '기', '뷁']) {
      expect(deckOf(syllable, SPEC), syllable).toBeNull()
      expect(isStacked(syllable), syllable).toBe(false)
    }
    for (const char of ['A', ' ', 'ㄷ', '·', '']) expect(deckOf(char, SPEC)).toBeNull()
  })

  it('stacks initial, slider, final in that order', () => {
    const d = deck('붐')
    expect(d.cho.cy).toBeLessThan(d.jung.y)
    expect(d.jung.y + d.jung.height).toBeLessThan(d.jong.cy)
    expect(d.cho.cx).toBe(d.jong.cx)
  })
})

describe('the reading positions face each other', () => {
  it('reads the initial at the bottom of its disc and the final at the top', () => {
    const d = deck('붐')
    expect(d.cho.read).toBeCloseTo(Math.PI, 6)
    expect(d.jong.read).toBeCloseTo(0, 6)

    const cho = rimAt(d.cho, d.cho.selected)
    expect(cho.x - d.cho.cx).toBeCloseTo(0, 6)
    expect(cho.y - d.cho.cy).toBeCloseTo(d.cho.rimRadius, 6)

    const jong = rimAt(d.jong, d.jong.selected)
    expect(jong.x - d.jong.cx).toBeCloseTo(0, 6)
    expect(jong.y - d.jong.cy).toBeCloseTo(-d.jong.rimRadius, 6)
  })

  it('spaces the three selected letters evenly down one axis', () => {
    for (const syllable of playable()) {
      const read = readingOf(deck(syllable))
      for (const item of read) expect(item.x).toBeCloseTo(0, 6)
      const a = read[1].y - read[0].y
      const b = read[2].y - read[1].y
      expect(a, syllable).toBeGreaterThan(0)
      expect(b).toBeCloseTo(a, 6)
    }
  })

  it('reports what it is reading, in order', () => {
    expect(readingOf(deck('붐')).map((r) => r.jamo)).toEqual(['ㅂ', 'ㅜ', 'ㅁ'])
    expect(readingOf(deck('드')).map((r) => r.jamo)).toEqual(['ㄷ', 'ㅡ', ''])
  })

  it('turns the selected letter upright and leans the rest', () => {
    // A record label: printed on the disc, square-on only where you are reading.
    const p = deck('붐').cho
    expect(rimAt(p, p.selected).angle).toBeCloseTo(0, 6)
    for (let i = 0; i < p.rim.length; i++) {
      if (i !== p.selected) expect(rimAt(p, i).angle).not.toBeCloseTo(0, 3)
    }
  })
})

describe('the divisions bisect the letters', () => {
  /*
   * The bug this exists to stop, and it was visible rather than subtle: the
   * divisions were turned by the disc's own spin while the letters were placed from
   * the reading mark, so the two disagreed by exactly the reading angle — and on a
   * four-item wheel that drew a line straight through every letter.
   *
   * Anything that has to line up with the rim is derived from the rim.
   */
  it('puts one division between each pair of neighbouring letters', () => {
    for (const syllable of playable()) {
      const d = deck(syllable)
      for (const disc of [d.cho, d.jong]) {
        const cuts = dividersOf(disc)
        expect(cuts, syllable).toHaveLength(disc.rim.length)
        const step = (Math.PI * 2) / disc.rim.length
        for (let i = 0; i < disc.rim.length; i++) {
          const here = disc.read + disc.spin + i * step
          const next = here + step
          // Exactly halfway between, to within a full turn.
          const mid = (here + next) / 2
          const off = ((cuts[i] - mid) % (Math.PI * 2)) / (Math.PI * 2)
          expect(Math.abs(off - Math.round(off)), `${syllable} ${disc.role} ${i}`).toBeCloseTo(0, 9)
        }
      }
    }
  })

  it('never lands a division on a letter', () => {
    // The visible symptom, asserted directly: the smallest gap between any division
    // and any letter is half a step, not zero.
    for (const syllable of playable()) {
      const d = deck(syllable)
      for (const disc of [d.cho, d.jong]) {
        const step = (Math.PI * 2) / disc.rim.length
        for (const cut of dividersOf(disc)) {
          for (let i = 0; i < disc.rim.length; i++) {
            const at = disc.read + disc.spin + i * step
            let gap = Math.abs(((cut - at) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
            if (gap > Math.PI) gap = Math.PI * 2 - gap
            expect(gap, `${syllable} ${disc.role}`).toBeGreaterThan(step * 0.45)
          }
        }
      }
    }
  })

  it('turns with the disc', () => {
    const rest = deck('붐').cho
    const turned = { ...rest, spin: rest.spin + 0.7 }
    const a = dividersOf(rest)
    const b = dividersOf(turned)
    for (let i = 0; i < a.length; i++) expect(b[i] - a[i]).toBeCloseTo(0.7, 9)
  })
})

describe('the machine holds together', () => {
  it('never overlaps the two discs, at any spacing', () => {
    for (const spacing of [0, 0.1, 0.6, 0.95, 1.8]) {
      for (const radius of [48, 92, 150]) {
        const d = deck('붐', { spacing, radius })
        expect(d.jong.cy - d.cho.cy, `${spacing}/${radius}`).toBeGreaterThanOrEqual(2 * radius - 0.001)
      }
    }
  })

  it('fits the slider into the gap between them', () => {
    for (const spacing of [0, 0.6, 0.95, 1.3, 1.8]) {
      const d = deck('붐', { spacing })
      expect(d.jung.y).toBeGreaterThanOrEqual(d.cho.cy + d.cho.r - 0.001)
      expect(d.jung.y + d.jung.height).toBeLessThanOrEqual(d.jong.cy - d.jong.r + 0.001)
    }
  })

  it('reports a box that contains every part', () => {
    for (const syllable of ['드', '붐', '중']) {
      const d = deck(syllable)
      const right = d.box.x + d.box.width
      const bottom = d.box.y + d.box.height
      for (const disc of [d.cho, d.jong]) {
        expect(disc.cy - disc.r).toBeGreaterThanOrEqual(d.box.y - 0.001)
        expect(disc.cy + disc.r).toBeLessThanOrEqual(bottom + 0.001)
      }
      expect(d.jung.x).toBeGreaterThanOrEqual(d.box.x - 0.001)
      expect(d.jung.x + d.jung.width).toBeLessThanOrEqual(right + 0.001)
      expect(d.pad.cy + d.pad.r).toBeLessThanOrEqual(bottom + 0.001)
    }
  })

  it('holds for every syllable the kit can build', () => {
    const bad: string[] = []
    for (const syllable of playable()) {
      const d = deckOf(syllable, SPEC)
      if (!d) {
        bad.push(`${syllable}: null`)
        continue
      }
      for (const disc of [d.cho, d.jong]) {
        if (disc.rim[disc.selected] === undefined) bad.push(`${syllable} ${disc.role}: no selection`)
        if (disc.rimSize <= 0) bad.push(`${syllable} ${disc.role}: rimSize`)
        // A rim letter must not sit on the spindle.
        if (disc.rimRadius - disc.rimSize / 2 <= disc.hub) bad.push(`${syllable} ${disc.role}: rim on hub`)
      }
      const read = readingOf(d).map((r) => r.jamo)
      if (read.length !== 3) bad.push(`${syllable}: reads ${read.join('')}`)
    }
    expect(bad.slice(0, 8)).toEqual([])
  })

  it('carries a jamo the kit does not have, rather than lying about it', () => {
    // Reachable only from a document made elsewhere, but a wheel that showed a
    // different letter from the one the machine is on would be worse than a rim
    // with an extra item.
    const d = deck('쭉')
    expect(d.cho.rim[d.cho.selected]).toBe('ㅉ')
    expect(d.jong.rim[d.jong.selected]).toBe('ㄱ')
    expect(d.cho.rim).toHaveLength(CHO_RIM.length + 1)
  })

  it('shrinks the letters so a grown rim still fits its circumference', () => {
    for (const radius of [48, 92, 150]) {
      for (const disc of [deck('쭉', { radius }).cho, deck('쭉', { radius }).jong]) {
        const between = (Math.PI * 2 * disc.rimRadius) / disc.rim.length
        expect(disc.rimSize).toBeLessThanOrEqual(between)
      }
    }
  })

  it('never gives a rim more than the size that was asked for', () => {
    expect(deck('붐', { radius: 150 }).cho.rimSize).toBe(35)
  })
})

describe('the wheels turn and the slider slides', () => {
  it('spreads a rim evenly, which is what the divisions rely on', () => {
    const p = deck('붐').cho
    const step = (Math.PI * 2) / p.rim.length
    for (let i = 0; i < p.rim.length; i++) {
      const a = rimAt(p, i)
      const b = rimAt(p, i + 1)
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(
        2 * p.rimRadius * Math.sin(step / 2),
        6,
      )
    }
  })

  it('snaps a free rotation back to the nearest jamo', () => {
    for (let i = 0; i < CHO_RIM.length; i++) {
      const rest = restSpin(CHO_RIM, i)
      const step = (Math.PI * 2) / CHO_RIM.length
      expect(snapTo(CHO_RIM, rest)).toBe(i)
      expect(snapTo(CHO_RIM, rest + step * 0.4)).toBe(i)
      expect(snapTo(CHO_RIM, rest - step * 0.4)).toBe(i)
    }
  })

  it('wraps a wheel rather than running off the end of it', () => {
    for (const spin of [-99, -7, -1, 0, 1, 7, 99]) {
      const i = snapTo(JONG_RIM, spin)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(JONG_RIM.length)
    }
  })

  it('puts the selected vowel in the middle of the slide at rest', () => {
    const d = deck('붐')
    expect(itemAt(d.jung, d.jung.selected)).toBeCloseTo(d.jung.x + d.jung.width / 2, 6)
  })

  it('lays the vowels out evenly along the slide', () => {
    const strip = deck('붐').jung
    for (let i = 1; i < strip.items.length; i++) {
      expect(itemAt(strip, i) - itemAt(strip, i - 1)).toBeCloseTo(strip.pitch, 6)
    }
  })

  it('slides one item per pitch, in the direction of the hand', () => {
    const strip = deck('붐').jung // ㅜ, index 0
    expect(strip.items[strip.selected]).toBe('ㅜ')
    expect(snapAlong(strip, -strip.pitch)).toBe(1)
    expect(snapAlong(strip, 0)).toBe(0)
    expect(snapAlong(strip, strip.pitch * 0.4)).toBe(0)
  })

  it('clamps the slide at both ends rather than wrapping', () => {
    // A slide has ends. Looping two vowels round would make ㅡ and ㅜ neighbours in
    // both directions with nothing to say which way is up.
    const strip = deck('붐').jung
    expect(snapAlong(strip, strip.pitch * 99)).toBe(0)
    expect(snapAlong(strip, -strip.pitch * 99)).toBe(strip.items.length - 1)
  })
})
