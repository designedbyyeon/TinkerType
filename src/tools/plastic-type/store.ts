import { create } from 'zustand'
import type { PlasticDoc } from './types'
import { CANVAS_GROUND } from '../../shared/styles/canvas'
import { useLangStore, type Lang } from '../../shared/i18n/lang'
import { SAMPLES, isSample } from './sample'

/**
 * The default sheet.
 *
 * Hangul and Latin in one line, because the tool's first claim is that it
 * handles both, and mixed text is where the shared drawn height shows. Part unit
 * `syllable` with runner unit `syllable` is the syllable runners — a coloured frame per
 * syllable, each of its jamo gated separately where the geometry demands it.
 */
export const DEFAULT_DOC: PlasticDoc = {
  width: 1200,
  height: 800,
  background: CANVAS_GROUND,

  /*
   * The tool's own name, as a sheet of parts.
   *
   * A sample has one job: to be the thing the tool makes, on the first screen,
   * with nothing to set up. Twelve characters at a frame each is a kit — which
   * is what this is — and it reads as its own label while it does it.
   */
  text: 'PLASTIC TYPE',
  face: 'bigshoulders',
  // Heavy, because a gate has to read as thinner than the part it holds and a
  // light weight leaves nothing for it to be thinner than.
  wght: 900,
  /*
   * No shipped face has a width axis, so this sits unused. It is what turned the
   * sheet from a row of squares into the portrait column of the reference poster
   * back when Archivo was here — condensed letters leave air at the sides and the
   * frame takes its proportion from the letter it is built around. Big Shoulders
   * gets there by being drawn narrow instead.
   */
  wdth: 100,
  partUnit: 'syllable',
  runnerUnit: 'syllable',

  size: 150,
  tracking: 14,
  /*
   * Four across, three down.
   *
   * The reference poster is a single column and that was the opening value while
   * the sample was five letters. Twelve in a column is a thread — it fits the
   * stage by height and leaves it empty either side, and the letters come out
   * too small to see a gate. Four across is the same lattice read as a sheet,
   * which is how a kit actually arrives.
   */
  perRow: 4,
  zoom: 1,

  density: 0.45,

  // Against a stem of roughly 48px at this size and weight, a wall of 12 reads
  // as clearly lighter than the parts it holds — which is the proportion in the
  // reference. Thinner than about a fifth and the frame stops looking structural.
  wall: 12,
  /*
   * Measured off the reference photograph. There the gate leaves the runner at
   * about the wall's own thickness and the neck is roughly a third of that — a
   * ratio near three to one. At the 1.5:1 this started with, the taper was too
   * shallow to see and the whole gate read as a plain bar.
   */
  gate: 13,
  neck: 4.5,
  corner: 5,
  // No moulded edge is perfectly sharp, and type drawn for print is. This is the
  // single difference that stops the letters reading as a drawing of a part.
  round: 9,

  lattice: true,
  tab: false,
  joined: true,
  plates: false,

  /*
   * Solid, and this is a change of mind worth recording.
   *
   * It opened flat, on the argument that a visitor should not pay for a renderer
   * to look at an SVG. But the sheet *is* a moulded object — the three depths,
   * the part standing proud, the gate sunk between them are the thing the tool
   * makes, and a drawing of them is the abstraction, not the other way round. A
   * first screen that shows the drawing teaches the tool backwards. The cost is
   * one deferred chunk on open, and `Form` puts the drawing back in one click.
   */
  solid: true,
  /*
   * Chosen by dragging the solid until it looked like a sprue, which is the only
   * way this kind of decision gets made. Against a 150px letter: the part stands
   * about a fifth of its own height proud, the frame carries two thirds of that,
   * and the gate half again — thin enough that the recess between frame and part
   * reads as the place to cut without measuring it.
   */
  partDepth: 34,
  runnerDepth: 22,
  gateDepth: 11,
  // A little over a pixel at this size. A moulded edge is never more than a
  // hairline of chamfer, and it is the hairline that catches the light.
  bevel: 1.4,
  // Polystyrene, not lacquer. Enough sheen to hold the environment, not enough
  // to start reflecting it.
  gloss: 0.42,

  colourMode: 'mono',
  runnerColour: '#3a34c8',
  partColour: '#3a34c8',
  palette: ['#3a34c8', '#f5a623', '#c8202c', '#1d8a4e'],
}

const HISTORY_LIMIT = 60

interface State {
  doc: PlasticDoc
  /** True while a control is being dragged, so the canvas can go coarse. */
  interacting: boolean
  past: PlasticDoc[]
  future: PlasticDoc[]

  pushHistory: () => void
  undo: () => void
  redo: () => void
  setInteracting: (value: boolean) => void
  setDoc: (patch: Partial<PlasticDoc>) => void
  setPaletteColour: (index: number, colour: string) => void
  /**
   * Put this language's sample sheet up — but only while the sheet is still a
   * sample. A designer's own line is never taken off the screen by a control
   * that says `EN / KO`.
   */
  applyLang: (lang: Lang) => void
  reset: () => void
}

const clone = (doc: PlasticDoc): PlasticDoc => structuredClone(doc)

export const useStore = create<State>((set) => ({
  doc: DEFAULT_DOC,
  interacting: false,
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

  setDoc: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),

  setPaletteColour: (index, colour) =>
    set((s) => ({
      doc: { ...s.doc, palette: s.doc.palette.map((c, i) => (i === index ? colour : c)) },
    })),

  applyLang: (lang) =>
    set((s) => (isSample(s.doc.text) ? { doc: { ...s.doc, ...SAMPLES[lang] } } : s)),

  // Back to the opening sheet — in the language that is on, not the one the
  // defaults happen to be written in.
  reset: () =>
    set((s) => ({
      doc: { ...clone(DEFAULT_DOC), ...SAMPLES[useLangStore.getState().lang] },
      past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),
}))

// Measuring the store from the console needs the same instance the app is
// using. A dynamic import gets a different one — Vite appends an HMR timestamp
// to the request, so the module is evaluated twice and the second copy is empty.
// The window guard matters: a unit test importing this module runs in Node,
// where reaching for `window` throws before a single assertion runs.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __plasticStore?: typeof useStore }).__plasticStore = useStore
}
