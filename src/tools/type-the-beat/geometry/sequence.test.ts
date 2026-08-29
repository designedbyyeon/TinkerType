import { describe, expect, it } from 'vitest'
import {
  MAX_LANES,
  emptyLane,
  fitLanes,
  fitSteps,
  hitsAt,
  isEmpty,
  laneIndex,
  levelOf,
  removeLane,
  setLevel,
  toggleStep,
} from './sequence'
import { decompose } from '../../../shared/text/hangul'
import { CHO_RIM, JONG_RIM, JUNG_RIM } from './deck'
import { DEFAULT_DOC } from '../store'
import type { BeatDoc } from '../types'

const doc = (patch: Partial<BeatDoc> = {}): BeatDoc => ({ ...DEFAULT_DOC, ...patch })
const bar = (pattern: string) => [...pattern.replace(/ /g, '')].map((c) => c === 'x')
const show = (steps: boolean[]) => steps.map((s) => (s ? 'x' : '.')).join('')

describe('tapping a step in', () => {
  it('creates the lane on its first hit', () => {
    // A lane appears when a sound is first *placed*, not when it is dialled —
    // otherwise turning through nineteen initials leaves nineteen empty rows.
    const d = doc({ lanes: [], steps: 8 })
    const lanes = toggleStep(d, '붐', 3)
    expect(lanes).toHaveLength(1)
    expect(lanes[0].syllable).toBe('붐')
    expect(show(lanes[0].steps)).toBe('...x....')
  })

  it('toggles a step that already exists', () => {
    const d = doc({ lanes: [{ syllable: '붐', steps: bar('x... x...'), level: 1 }], steps: 8 })
    expect(show(toggleStep(d, '붐', 4)[0].steps)).toBe('x.......')
    expect(show(toggleStep(d, '붐', 2)[0].steps)).toBe('x.x.x...')
  })

  it('drops a lane emptied of its last hit', () => {
    // Otherwise the grid fills with rows that do nothing and the designer has to
    // tidy up after their own undoing. The sound is still on the wheels.
    const d = doc({ lanes: [{ syllable: '붐', steps: bar('x...'), level: 1 }], steps: 4 })
    expect(toggleStep(d, '붐', 0)).toEqual([])
  })

  it('leaves the other lanes untouched', () => {
    const d = doc({
      lanes: [
        { syllable: '붐', steps: bar('x...'), level: 1 },
        { syllable: '둥', steps: bar('..x.'), level: 1 },
      ],
      steps: 4,
    })
    const lanes = toggleStep(d, '둥', 1)
    expect(show(lanes[0].steps)).toBe('x...')
    expect(show(lanes[1].steps)).toBe('.xx.')
    // And it does not mutate what it was given.
    expect(show(d.lanes[1].steps)).toBe('..x.')
  })

  it('refuses a step outside the bar and a non-syllable', () => {
    const d = doc({ lanes: [], steps: 8 })
    expect(toggleStep(d, '붐', -1)).toEqual([])
    expect(toggleStep(d, '붐', 8)).toEqual([])
    expect(toggleStep(d, 'A', 0)).toEqual([])
    expect(toggleStep(d, 'ㅂ', 0)).toEqual([])
  })

  it('refuses a ninth lane rather than silently replacing one', () => {
    const lanes = Array.from({ length: MAX_LANES }, (_, i) => ({
      syllable: ['붐', '둠', '둥', '뭄', '굼', '숨', '춤', '툼'][i],
      steps: bar('x...'),
      level: 1,
    }))
    const d = doc({ lanes, steps: 4 })
    expect(toggleStep(d, '풍', 1)).toHaveLength(MAX_LANES)
    // But an existing lane still toggles at the cap.
    expect(show(toggleStep(d, '붐', 1)[0].steps)).toBe('xx..')
  })
})

describe('the bar length', () => {
  it('keeps what is inside it when the bar grows', () => {
    // Rescaling instead would move every hit the designer placed.
    expect(show(fitSteps(bar('x.x.'), 8))).toBe('x.x.....')
  })

  it('drops the tail when the bar shrinks', () => {
    expect(show(fitSteps(bar('x.x. ..x.'), 4))).toBe('x.x.')
  })

  it('is a no-op at the same length', () => {
    const steps = bar('x.x.')
    expect(fitSteps(steps, 4)).toBe(steps)
  })

  it('resizes every lane together', () => {
    const lanes = fitLanes(
      [
        { syllable: '붐', steps: bar('x...'), level: 1 },
        { syllable: '둥', steps: bar('..x.'), level: 1 },
      ],
      8,
    )
    expect(lanes.map((l) => l.steps.length)).toEqual([8, 8])
    expect(show(lanes[1].steps)).toBe('..x.....')
  })

  it('makes an empty lane the length of the bar', () => {
    expect(emptyLane('붐', 16).steps).toHaveLength(16)
    expect(emptyLane('붐', 16).steps.some(Boolean)).toBe(false)
  })
})

describe('what sounds when', () => {
  const d = doc({
    lanes: [
      { syllable: '붐', steps: bar('x... x...'), level: 1 },
      { syllable: '둥', steps: bar('.... x...'), level: 1 },
      { syllable: '츱', steps: bar('..x. ..x.'), level: 1 },
    ],
    steps: 8,
  })

  /** Just the names, for the tests that are about which lanes rather than how loud. */
  const names = (step: number) => hitsAt(d, step).map((h) => h.syllable)

  it('gives every lane lit on a step', () => {
    expect(names(0)).toEqual(['붐'])
    expect(names(2)).toEqual(['츱'])
    expect(names(4)).toEqual(['붐', '둥'])
    expect(names(1)).toEqual([])
  })

  it('wraps, because the transport counts up forever and the bar does not', () => {
    expect(names(8)).toEqual(names(0))
    expect(names(8 * 11 + 4)).toEqual(['붐', '둥'])
    expect(names(-4)).toEqual(names(4))
  })

  it('carries each lane\'s level along with its syllable', () => {
    // The scheduler asks one question and gets both answers, so there is no
    // second lookup that could read a different document than the notes came from.
    const quiet = doc({
      lanes: [
        { syllable: '붐', steps: bar('x...'), level: 1 },
        { syllable: '츱', steps: bar('x...'), level: 0.4 },
      ],
      steps: 4,
    })
    expect(hitsAt(quiet, 0)).toEqual([
      { syllable: '붐', level: 1 },
      { syllable: '츱', level: 0.4 },
    ])
  })

  it('drops a lane turned all the way down instead of booking it silent', () => {
    // A muted lane costs nothing: no oscillator, no envelope, nothing in the file.
    const muted = doc({
      lanes: [
        { syllable: '붐', steps: bar('x...'), level: 0 },
        { syllable: '둥', steps: bar('x...'), level: 1 },
      ],
      steps: 4,
    })
    expect(hitsAt(muted, 0)).toEqual([{ syllable: '둥', level: 1 }])
    // But the bar is still written — muting is not erasing, and Export should not
    // start refusing because everything happens to be turned down.
    expect(isEmpty(muted)).toBe(false)
  })

  it('reads a level that is missing or out of range as full', () => {
    /*
     * An undo snapshot taken before lanes had levels comes back without the field.
     * Defaulting to nothing would make the fix for it look like a bug in the
     * transport — a lane that is written, lit, and silent.
     */
    expect(levelOf({ level: undefined as unknown as number })).toBe(1)
    expect(levelOf({ level: NaN })).toBe(1)
    expect(levelOf({ level: 4 })).toBe(1)
    expect(levelOf({ level: -1 })).toBe(0)
  })

  it('sets one lane\'s level and leaves the others alone', () => {
    const lanes = setLevel(d.lanes, '츱', 0.3)
    expect(lanes.map((l) => l.level)).toEqual([1, 1, 0.3])
    expect(setLevel(lanes, '츱', 2).find((l) => l.syllable === '츱')!.level).toBe(1)
    expect(setLevel(lanes, '츱', -3).find((l) => l.syllable === '츱')!.level).toBe(0)
    // The steps are untouched: a mix decision never moves a note.
    expect(lanes[2].steps).toEqual(d.lanes[2].steps)
  })

  it('reports an empty document as empty, and a placed one as not', () => {
    expect(isEmpty(doc({ lanes: [] }))).toBe(true)
    expect(isEmpty(doc({ lanes: [emptyLane('붐', 8)], steps: 8 }))).toBe(true)
    expect(isEmpty(d)).toBe(false)
  })
})

describe('finding and removing lanes', () => {
  const lanes = [
    { syllable: '붐', steps: bar('x...'), level: 1 },
    { syllable: '둥', steps: bar('..x.'), level: 1 },
  ]

  it('finds a lane by its syllable, which is its name', () => {
    expect(laneIndex(doc({ lanes }), '둥')).toBe(1)
    expect(laneIndex(doc({ lanes }), '츱')).toBe(-1)
  })

  it('removes one lane and only that lane', () => {
    expect(removeLane(lanes, '붐').map((l) => l.syllable)).toEqual(['둥'])
    expect(removeLane(lanes, '츱')).toHaveLength(2)
  })
})

describe('the opening document', () => {
  it('is three lanes that make an actual beat', () => {
    // The claim the tool has to make in its first second: a syllable is a drum and
    // a column of them is a bar.
    expect(DEFAULT_DOC.lanes.map((l) => l.syllable)).toEqual(['붐', '둥', '츱'])
    expect(isEmpty(DEFAULT_DOC)).toBe(false)
  })

  it('has every lane the length of the bar', () => {
    // A lane shorter than the bar would read as silence at the end of itself,
    // which is not a rest anybody placed.
    for (const lane of DEFAULT_DOC.lanes) {
      expect(lane.steps).toHaveLength(DEFAULT_DOC.steps)
    }
  })

  it('is built entirely from the kit', () => {
    /*
     * The opening document has to be playable on the wheels as they are. A lane
     * whose jamo is not on a rim makes the wheel grow an item on load — which is
     * the right behaviour for a document from elsewhere and a design failure for
     * the one the tool ships with.
     */
    for (const lane of [...DEFAULT_DOC.lanes.map((l) => l.syllable), DEFAULT_DOC.dialed]) {
      const jamo = decompose(lane)!
      expect(CHO_RIM, lane).toContain(jamo.cho)
      expect(JUNG_RIM, lane).toContain(jamo.jung)
      expect(JONG_RIM, lane).toContain(jamo.jong)
    }
  })

  it('opens dialled to one of its own lanes', () => {
    // Opening on a sound that is not in the bar would show a ghost row before the
    // designer has done anything.
    expect(laneIndex(DEFAULT_DOC, DEFAULT_DOC.dialed)).toBeGreaterThanOrEqual(0)
  })

  it('has a downbeat and a backbeat, which is what makes it a beat', () => {
    /*
     * The two placements that are not taste. A bar with no hit on step 0 has no
     * downbeat, and a snare that is not on two and four is not reading as a
     * backbeat — between them they are why the opening document sounds like a
     * beat instead of like a pattern.
     *
     * Deliberately *not* asserted: that nothing shares a step with the hat. A kick
     * and a closed hat on the same sixteenth is ordinary, and an earlier version of
     * this test forbade it — which was a preference dressed as an invariant.
     */
    const [kick, snare, hat] = DEFAULT_DOC.lanes.map((l) => l.steps)
    expect(kick[0]).toBe(true)
    expect(snare[4]).toBe(true)
    expect(snare[12]).toBe(true)
    // And the hat is off the downbeat, so the two are heard apart.
    expect(hat[0]).toBe(false)
  })
})

describe('history does not carry the stage size', () => {
  /*
   * `width` and `height` are a measurement, not a document decision.
   *
   * Restoring a snapshot taken at one window size into a different one puts a
   * viewBox in the document that no longer matches its box, and
   * `preserveAspectRatio` scales the whole instrument down to fit — Reset did that,
   * dropping everything to 48% in a 578px stage. The `ResizeObserver` cannot catch
   * it because nothing resized.
   *
   * Asserted through the real store rather than on `sized` directly: the bug was
   * in which setters remembered to call it, not in the helper.
   */
  it('keeps the live size through undo, redo and reset', async () => {
    const { useStore } = await import('../store')
    const live = { width: 578, height: 932 }

    useStore.getState().reset()
    useStore.getState().setDoc(live)
    useStore.getState().pushHistory()
    useStore.getState().setDoc({ bpm: 140 })

    useStore.getState().undo()
    expect(useStore.getState().doc.bpm).toBe(96)
    expect(useStore.getState().doc).toMatchObject(live)

    useStore.getState().redo()
    expect(useStore.getState().doc.bpm).toBe(140)
    expect(useStore.getState().doc).toMatchObject(live)

    useStore.getState().reset()
    expect(useStore.getState().doc.bpm).toBe(96)
    expect(useStore.getState().doc).toMatchObject(live)
  })
})
