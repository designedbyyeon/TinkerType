import { create } from 'zustand'
import { CANVAS_GROUND } from '../../shared/styles/canvas'
import { DEFAULT_STYLE, SIGN_COLOUR, WALL_COLOUR } from './geometry/types'
import type { BillboardDoc } from './types'

/**
 * The opening building.
 *
 * A line long enough to need a real tower, because the first thing the tool has
 * to say is that the sentence is the building — a two-word default would look
 * like a box with a sign on it and the idea would not land.
 */
export const DEFAULT_DOC: BillboardDoc = {
  text: '서울 종로 세운상가 지하 일층 사진관 간판 열두 개',
  background: CANVAS_GROUND,

  seed: DEFAULT_STYLE.seed,
  order: DEFAULT_STYLE.order,
  pad: DEFAULT_STYLE.pad,
  width: DEFAULT_STYLE.width,
  height: DEFAULT_STYLE.height,
  girth: DEFAULT_STYLE.girth,
  depth: DEFAULT_STYLE.depth,
  azimuth: DEFAULT_STYLE.azimuth,

  // High. The reference has no key light and no hard shadow: its depth comes
  // from surfaces darkening where they meet, and turning this down is what makes
  // the thing start looking like a render again.
  occlusion: 0.6,
  key: 0.8,
  detail: 1.8,
  // Small: at model scale this is a couple of millimetres, which is all a
  // moulded edge ever is.
  bevel: 0.05,

  sign: SIGN_COLOUR,
  wall: WALL_COLOUR,
}

const HISTORY_LIMIT = 60

interface State {
  doc: BillboardDoc
  past: BillboardDoc[]
  future: BillboardDoc[]
  /** True while a control is being dragged. The scene rebuilds on release. */
  interacting: boolean

  pushHistory: () => void
  undo: () => void
  redo: () => void
  setInteracting: (value: boolean) => void
  setDoc: (patch: Partial<BillboardDoc>) => void
  reset: () => void
}

const clone = (doc: BillboardDoc): BillboardDoc => structuredClone(doc)

export const useStore = create<State>((set) => ({
  doc: DEFAULT_DOC,
  past: [],
  future: [],
  interacting: false,

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

  reset: () =>
    set((s) => ({
      doc: clone(DEFAULT_DOC),
      past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),
}))

// Measuring the store from the console needs the same instance the app is using;
// a dynamic import gets a different one, because Vite appends an HMR timestamp
// and the module is evaluated twice. The window guard matters: a unit test
// importing this in Node would throw before a single assertion ran.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __billboardStore?: typeof useStore }).__billboardStore = useStore
}
