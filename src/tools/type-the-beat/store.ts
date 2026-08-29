import { create } from 'zustand'
import { CANVAS_GROUND, CANVAS_INK } from '../../shared/styles/canvas'
import { NEUTRAL } from './audio/voice'
import type { BeatDoc } from './types'

/** A bar written as a string of dots and hits, because that is how it reads. */
const on = (pattern: string): boolean[] => [...pattern.replace(/ /g, '')].map((c) => c === 'x')

/**
 * The opening document: **a bar you can hear, on the reference's own sounds.**
 *
 * 붐 on the beat, 둥 on two and four, 츱 on every off-beat — which is a kick, a
 * ringing snare and a closed hat, and every one of those is a consequence of its
 * spelling. 붐 is 순음, so its burst is almost all tone and falls to the
 * fundamental. 둥 is 설음, so it is half noise and lands three octaves up, and its
 * ㅇ rings. 츱 is 치음, so it is noise alone, and its ㅂ is an unreleased stop so it
 * is cut rather than faded. **Nothing anywhere names a kick or a snare.**
 *
 * 츱 rather than 칫 for the hat: ㅣ sets beside its initial rather than under it, so
 * this machine cannot build 칫, and ㅅ is not on the final wheel. ㅡ is the neutral
 * vowel and ㅂ cuts — same instrument, same length.
 *
 * Three lanes, because the claim the tool has to make in its first second is that
 * **a syllable is a drum and a column of them is a bar.** One lane would look like
 * a metronome.
 */
export const DEFAULT_DOC: BeatDoc = {
  width: 1200,
  height: 800,
  background: CANVAS_GROUND,

  // Slow enough that a syllable is a sound rather than a click, and a common
  // enough tempo that the bar reads as a beat rather than as an exercise.
  bpm: 96,
  // Sixteen sixteenths is one bar of four, so the grid on screen is exactly a bar.
  division: 16,
  swing: 0,
  steps: 16,
  repeats: 4,

  /*
   * 붐 on the downbeat and the back half, 둥 on two and four, 츱 on every off-beat.
   * A downbeat and a backbeat are what make a bar read as a beat rather than as a
   * pattern; the rest is taste and a designer will change it in ten seconds.
   */
  lanes: [
    { syllable: '붐', steps: on('x... ..x. x... ....'), level: 1 },
    { syllable: '둥', steps: on('.... x... .... x...'), level: 1 },
    // The hat sits back a little, the way a hat does.
    { syllable: '츱', steps: on('..x. ..x. ..x. ..x.'), level: 0.72 },
  ],
  // The wheels open on the kick — the lane the ear finds first.
  dialed: '붐',

  /*
   * The machine's own letters, and the bar's.
   *
   * The three selected letters on the deck spell the syllable in your hand, so
   * they are the biggest type here — there is no separate read-out to be bigger.
   * A little over half the radius: large enough to read as set type at the
   * spacing below, small enough that a nineteen-item rim still fits round it.
   */
  /*
   * Measured off the reference: a letter is about **0.38 of the disc's radius**.
   * An earlier pass had it at 0.57 and the wheels came out as three letters with a
   * circle drawn round them — the disc has to be the object and the letter the
   * thing on it.
   */
  letter: 35,
  lane: 32,

  radius: 92,
  /*
   * About one letter-height between the selected letters, which is what makes the
   * three of them read as a syllable rather than as a column. Tighten it and the
   * discs close in; the floor is where one would sit inside the other.
   */
  spacing: 0.95,
  ticks: true,

  ink: CANVAS_INK,
  /*
   * The disc's face, and it is **lighter than the panel it sits in.**
   *
   * An earlier version had it near-black with the letters knocked out, which had
   * weight and buried the type — and the type is the point. A pale disc inside a
   * darker panel reads as a machined part set into a surface, and the letters on it
   * are ink, at full strength, which is where they belong.
   */
  disc: '#faf9f6',
  // A step lower than the ground, so the panels read as set into it.
  panel: '#eae7e0',
  // The one accent, on the one thing that is moving.
  playhead: '#ff4a12',

  trim: NEUTRAL,
}

const HISTORY_LIMIT = 60

interface State {
  doc: BeatDoc
  /**
   * True while a control is being dragged. The other tools drop to draft quality;
   * here the score stops re-laying itself out under a moving hand.
   */
  interacting: boolean
  /**
   * Whether the transport is running, as plain data.
   *
   * The panel needs it — Export renders offline and so is always available, but
   * the Voice rows read differently while a loop is going round, and the stage's
   * own transport is the only thing that can turn it on. The stage owns the audio
   * and posts the fact here, the way tool 04 posts whether its lens is open.
   */
  playing: boolean
  past: BeatDoc[]
  future: BeatDoc[]

  pushHistory: () => void
  undo: () => void
  redo: () => void
  setInteracting: (value: boolean) => void
  setPlaying: (value: boolean) => void
  setDoc: (patch: Partial<BeatDoc>) => void
  reset: () => void
}

const clone = (doc: BeatDoc): BeatDoc => structuredClone(doc)

/**
 * A restored document, keeping the size the stage actually is.
 *
 * **`width` and `height` are a measurement, not a document decision**, and history
 * must not carry them. They live in the doc because that is where the renderer
 * wants them, but a snapshot taken at one window size and restored at another puts
 * a viewBox in the doc that no longer matches its box — and `preserveAspectRatio`
 * then scales the whole instrument down to fit. Reset did exactly that: it restored
 * the default 1200x800 into a 578px stage and everything came out at 48%.
 *
 * The `ResizeObserver` cannot save it, because nothing resized. So the size is
 * re-applied on the way out of every history move.
 */
const sized = (restored: BeatDoc, live: BeatDoc): BeatDoc => ({
  ...restored,
  width: live.width,
  height: live.height,
})

export const useStore = create<State>((set) => ({
  doc: DEFAULT_DOC,
  interacting: false,
  playing: false,
  past: [],
  future: [],

  pushHistory: () =>
    set((s) => ({ past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT), future: [] })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      return {
        doc: sized(s.past[s.past.length - 1], s.doc),
        past: s.past.slice(0, -1),
        future: [clone(s.doc), ...s.future].slice(0, HISTORY_LIMIT),
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const [head, ...rest] = s.future
      return {
        doc: sized(head, s.doc),
        past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
        future: rest,
      }
    }),

  setInteracting: (value) => set({ interacting: value }),
  setPlaying: (value) => set({ playing: value }),

  setDoc: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),

  reset: () =>
    set((s) => ({
      doc: sized(clone(DEFAULT_DOC), s.doc),
      past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),
}))

// The same instance the app is using, for measuring from the console. A dynamic
// import would hand back a different one — Vite appends an HMR timestamp, so the
// module is evaluated twice. The window guard is what keeps a Node test from
// dying on import before a single assertion runs.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __beatStore?: typeof useStore }).__beatStore = useStore
}
