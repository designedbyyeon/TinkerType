import { create } from 'zustand'
import { CANVAS_GROUND, CANVAS_INK } from '../../shared/styles/canvas'
import type { MagicDoc } from './types'

/**
 * The opening plate: **type and nothing else.**
 *
 * The reference photograph has no drawn line anywhere on it — a hand at the lens
 * and three phrases running round it, and that is the whole image. So the rim,
 * the rules between bands, the ticks, the inner circles, the star and the spokes
 * all open at nothing. They are a menu of what can be added, not the thing the
 * tool makes. Type is the thing the tool makes.
 *
 * Three lines of a call for work, in the reference's own shape — a title, the
 * detail under it, a date — because that is what a ring of type is actually for,
 * and because three lines at three sizes is the claim the tool has to make in its
 * first second: **a line is a ring, a paragraph is a plate, and the sizes step
 * down as they go in.**
 *
 * Ink on paper rather than the white-on-photograph of the reference. The tool has
 * to open on something finished before a camera is ever switched on — that is the
 * state the index card is drawn in, and the state a designer with no camera works
 * in. Paint is one group away when the footage arrives.
 */
export const DEFAULT_DOC: MagicDoc = {
  width: 1200,
  height: 800,
  background: CANVAS_GROUND,
  mirror: true,
  photo: null,

  // Caps for the title, sentence case under it — because the tool does not
  // impose a case and the default should not imply that it does.
  /*
   * Line lengths are part of the composition, not filler.
   *
   * Each line inward sits on a shorter circumference *and* at a smaller size, so
   * a phrase of the same length sweeps further the further in it goes. These three
   * are cut to close the ring between them: the first two cover the top at about
   * 190° each and the date covers the bottom, and the two seams fall where the
   * eye is already turning. A longer second line laps past both of them and the
   * reading order stops being followable.
   */
  text: 'A CALL FOR NEW WORK 2026\nSend photographs by post\nDeadline August 5th',
  face: 'bigshoulders',
  // Condensed by drawing, which is what a long line set round a small circle
  // wants. Heavy, because the reference's type is heavy and because white type
  // over footage needs the mass.
  wght: 800,
  /*
   * Big. A sixth of the radius, so the three bands together fill the outer half
   * of the plate and the middle is left to the hand — which is the proportion in
   * the reference photograph. Set smaller, the type becomes a caption around an
   * empty circle, and the circle becomes the subject.
   */
  size: 46,
  // A title over its own detail, at a step you can see and would not call a
  // mistake. Anything under about four fifths starts reading as two typefaces.
  taper: 0.82,
  tracking: 8,
  /*
   * The type's own width, which is what the reference does: each phrase is an arc
   * as long as the phrase needs, and three of them at these lengths cover most of
   * their rings without anything being stretched to fit.
   *
   * The other two fills close the circle exactly, and both have a cost worth
   * knowing. `ring` opens the letterspacing until one phrase reaches all the way
   * round — beautiful on a long line, eighty pixels a letter on a short one.
   * `repeat` sets the phrase again and again, which is what a seal does and stays
   * readable at any radius, but it is a seal rather than a sentence.
   */
  fill: 'natural',
  // Used only by `repeat`. Present in all three shipped faces — checked, not assumed.
  joiner: '·',

  cx: 0.5,
  cy: 0.5,
  radius: 300,
  // Fully cast. A document that opened at nothing would look broken, and the
  // bloom is the one value the hand takes over the instant a camera starts.
  bloom: 1,
  spin: 0,
  /*
   * The reference photograph's own arrangement: the title and the detail both
   * across the top, the date across the bottom.
   *
   * Which is worth saying out loud because it is not a pattern. Two of the three
   * lines share a clock position and the third is opposite them, and between them
   * the three partial arcs cover the whole circumference — the gap the two top
   * lines leave at the bottom is exactly where the date goes. That is composition,
   * not arithmetic, and it is why there is an angle per line rather than one step
   * applied to all of them.
   */
  angles: [0, 0, 180],
  // Small, because the descender allowance in the band already keeps the tails of
  // one line off the caps of the next. This is air on top of that.
  gap: 8,
  // All three bands the same way round, so the ring reads as one continuous run
  // — upright across the top, inverted across the bottom, exactly as in the
  // reference. Alternating is the plate look, and the plate is not the default.
  band: 'out',

  ink: CANVAS_INK,
  plate: 'none',
  plateOpacity: 0.7,
  dim: 0,

  // Nothing below draws a line yet, so this is the weight waiting for the first
  // thing that does. The row for it is hidden until then.
  rule: 1.4,
  rim: false,
  bandRules: false,
  rings: 0,
  starPoints: 0,
  // Where the star lands the moment anybody asks for five points or more.
  starSkip: 2,
  ticks: 0,
  spokes: 0,

  // Roughly the reach in the reference photograph: a ring about three palm
  // lengths across, so the hand sits inside it with room to spare.
  reach: 3.2,
  followHand: true,
  // Off. Turning your wrist to turn the plate is the kind of control that has to
  // be asked for — left on, every small tilt of the hand rolls the type.
  followSpin: false,
}

const HISTORY_LIMIT = 60

interface State {
  doc: MagicDoc
  /**
   * True while a control is being dragged.
   *
   * Which in this tool means: hold the plate still. The other tools use this to
   * drop to draft quality; here the hand is the thing that has to stop, so a
   * designer can tune the gutter without the plate wandering out from under
   * their finger.
   */
  interacting: boolean
  /**
   * Whether the lens is open, as plain data rather than a callback.
   *
   * The panel needs to know, because there is no ground and no photograph behind
   * the plate while the feed is showing — so Export has nothing to write until
   * the shutter has fired, and says so instead of quietly handing back a
   * transparent file. The stage owns the camera and posts the fact here.
   */
  cameraLive: boolean
  past: MagicDoc[]
  future: MagicDoc[]

  pushHistory: () => void
  undo: () => void
  redo: () => void
  setInteracting: (value: boolean) => void
  setCameraLive: (value: boolean) => void
  setAngle: (index: number, degrees: number) => void
  setDoc: (patch: Partial<MagicDoc>) => void
  reset: () => void
}

const clone = (doc: MagicDoc): MagicDoc => structuredClone(doc)

export const useStore = create<State>((set) => ({
  doc: DEFAULT_DOC,
  interacting: false,
  cameraLive: false,
  past: [],
  future: [],

  pushHistory: () =>
    set((s) => ({ past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT), future: [] })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      return {
        doc: s.past[s.past.length - 1],
        past: s.past.slice(0, -1),
        future: [clone(s.doc), ...s.future].slice(0, HISTORY_LIMIT),
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const [head, ...rest] = s.future
      return {
        doc: head,
        past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
        future: rest,
      }
    }),

  setInteracting: (value) => set({ interacting: value }),

  setCameraLive: (value) => set({ cameraLive: value }),

  /*
   * The angles array is indexed by line and may be shorter than the text — a
   * fourth line typed into a three-angle document sits at twelve until it is
   * moved. So the setter pads rather than assuming a slot is there; keeping the
   * array in step with the text on every keystroke would mean the text field
   * owning a second piece of state, and that is the kind of coupling that goes
   * wrong the first time a line is deleted from the middle.
   */
  setAngle: (index, degrees) =>
    set((s) => {
      const angles = [...s.doc.angles]
      while (angles.length <= index) angles.push(0)
      angles[index] = degrees
      return { doc: { ...s.doc, angles } }
    }),

  setDoc: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),

  reset: () =>
    set((s) => ({
      doc: clone(DEFAULT_DOC),
      past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),
}))

// The same instance the app is using, for measuring from the console. A dynamic
// import would hand back a different one — Vite appends an HMR timestamp, so the
// module is evaluated twice. The window guard is what keeps a Node test from
// dying on import before a single assertion runs.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __magicStore?: typeof useStore }).__magicStore = useStore
}
