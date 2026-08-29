import { create } from 'zustand'
import type { AnimSettings, Doc, DocImage, PathObj, Style, Transform } from './types'
import { centroid } from '../../shared/geometry/transform'
import type { Vec2 } from '../../shared/geometry/vec'
import { CANVAS_GROUND, CANVAS_INK } from '../../shared/styles/canvas'
import { useLangStore, type Lang } from '../../shared/i18n/lang'

export type Tool = 'brush' | 'select'

export const BLANK_SLOT = 'new'

/** A workspace keeps its own undo stack, so switching never tangles them. */
interface Workspace {
  doc: Doc
  past: Doc[]
  future: Doc[]
}

/*
 * The opening values.
 *
 * Deliberately the index card's composition rather than a neutral zero state:
 * a beaded chain with the fillet already working, so the first line drawn looks
 * like what the homepage promised. A blank tool that makes something plainer
 * than its own advertisement teaches the wrong thing first.
 *
 * The three presets set `countMode` themselves, because they carry per-path
 * spacing worked back from path length and need to stay in "by gap".
 */
export const DEFAULT_STYLE: Style = {
  shape: 'circle',
  cornerRadius: 0.3,
  size: 87,
  sizeVariation: 'none',
  sizeAmount: 0.35,
  sizeFrequency: 2,
  sizeSeed: 1,

  spacing: 48,
  countMode: 'text',
  textStart: 0,

  blend: 26,
  blendMode: 'fillet',

  // Dark shapes on the light ground below — flipped together, since white
  // fill on near-white paper would be invisible.
  fill: CANVAS_INK,
  stroke: 'none',
  strokeWidth: 2,

  rotateToTangent: false,

  fontSize: 24,
  fontWeight: 600,
  textColor: CANVAS_GROUND,
  // Zero, because the baseline now lands on true cap-height centre by itself.
  // The old measurement used the font's layout box instead of its cap height,
  // which pushed every glyph ~9px low at this size — that is what a manual
  // nudge used to be correcting.
  textOffset: 0,

  fillerEnabled: false,
  fillerSize: 10,
  fillerCount: 1,
}

export const DEFAULT_ANIM: AnimSettings = {
  durationMs: 1600,
  popMs: 420,
  easing: 'back',
  loop: true,
}

/**
 * One format, 1:√2 — the poster proportion. Fixed rather than configurable:
 * the artboard has no visible edge any more, so a size control would be
 * adjusting something the designer cannot see.
 */
export const CANVAS_WIDTH = 900
export const CANVAS_HEIGHT = 1273

export const DEFAULT_DOC: Doc = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  background: CANVAS_GROUND,
  image: null,
  defaults: DEFAULT_STYLE,
  anim: DEFAULT_ANIM,
  paths: [],
}

/** A fresh empty document, sized to the work area it will open in. */
export const blankDoc = (view: { width: number; height: number }): Doc => ({
  ...structuredClone(DEFAULT_DOC),
  width: view.width,
  height: view.height,
})

const HISTORY_LIMIT = 60

/** Smoothing a fresh stroke gets: enough to kill hand tremor, not the shape. */
export const NEW_PATH_SMOOTHING = 6
/**
 * What a freshly drawn line says, per language.
 *
 * A word rather than a placeholder: the first stroke has to come out looking like
 * the thing the index promised, and an empty chain of shapes does not. Read at the
 * moment the stroke lands, not at import — the language can change between the two.
 */
const NEW_PATH_WORDS: Record<Lang, string> = {
  en: 'SIDEWINDER',
  ko: '미끄러지는 선',
}

export const newPathText = (): string => NEW_PATH_WORDS[useLangStore.getState().lang]

let pathCounter = 0
const nextPathId = () => `path-${++pathCounter}`

interface AppState {
  doc: Doc
  selectedPathId: string | null
  tool: Tool
  /** True while a stroke or a slider is actively being dragged. */
  interacting: boolean

  /** Transient feedback for actions with no visible control, e.g. paste. */
  notice: string | null

  playing: boolean
  /**
   * Playhead in ms. Rests at the end of the run, so the canvas — and every
   * export taken from it — shows the finished poster unless you are playing.
   */
  timeMs: number

  past: Doc[]
  future: Doc[]

  /**
   * Which starting point is open. NEW and each preset are separate
   * workspaces, so exploring a preset never costs you what you were making.
   */
  activeSlot: string
  slots: Record<string, Workspace>

  pushHistory: () => void
  undo: () => void
  redo: () => void

  setTool: (tool: Tool) => void
  setNotice: (notice: string | null) => void
  setInteracting: (value: boolean) => void
  setDoc: (patch: Partial<Doc>) => void
  applyToAll: (patch: Partial<Style>) => void
  setAnim: (patch: Partial<AnimSettings>) => void

  play: () => void
  pause: () => void
  setTime: (ms: number) => void

  setImage: (image: DocImage) => void
  updateImage: (patch: Partial<DocImage>) => void
  clearImage: () => void

  addPath: (raw: Vec2[]) => void
  addPaths: (polylines: Vec2[][], smoothing?: number) => void
  switchSlot: (id: string, seed: (view: { width: number; height: number }) => Doc) => void
  updatePath: (id: string, patch: Partial<PathObj>) => void
  updatePathStyle: (id: string, patch: Partial<Style>) => void
  updatePathTransform: (id: string, patch: Partial<Transform>) => void
  resetPathTransform: (id: string) => void
  deletePath: (id: string) => void
  selectPath: (id: string | null) => void
  clearAll: () => void
}

const clone = (doc: Doc): Doc => structuredClone(doc)

/** Park the playhead on the finished poster. */
const restPlayhead = (doc: Doc) => ({ playing: false, timeMs: doc.anim.durationMs })

export const useStore = create<AppState>((set, get) => ({
  doc: DEFAULT_DOC,
  selectedPathId: null,
  tool: 'brush',
  notice: null,
  interacting: false,
  playing: false,
  timeMs: DEFAULT_ANIM.durationMs,
  past: [],
  future: [],
  activeSlot: BLANK_SLOT,
  slots: {},

  pushHistory: () =>
    set((s) => ({
      past: [...s.past, clone(s.doc)].slice(-HISTORY_LIMIT),
      future: [],
    })),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      const previous = s.past[s.past.length - 1]
      return {
        doc: previous,
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

  setTool: (tool) => set({ tool }),

  setNotice: (notice) => set({ notice }),

  setInteracting: (value) => set({ interacting: value }),

  setDoc: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),

  /**
   * Set a value for every object — including ones carrying their own
   * override. Without stripping the overrides, "All" would silently do
   * nothing to any path that had been tuned individually, and a preset that
   * ships per-path values would leave the global control dead.
   */
  applyToAll: (patch) =>
    set((s) => {
      const keys = Object.keys(patch) as (keyof Style)[]
      return {
        doc: {
          ...s.doc,
          defaults: { ...s.doc.defaults, ...patch },
          paths: s.doc.paths.map((p) => {
            if (!keys.some((k) => k in p.style)) return p
            const style = { ...p.style }
            for (const k of keys) delete style[k]
            return { ...p, style }
          }),
        },
      }
    }),

  setAnim: (patch) =>
    set((s) => {
      const anim = { ...s.doc.anim, ...patch }
      return {
        doc: { ...s.doc, anim },
        // Retiming while parked at the end should keep it parked at the end.
        timeMs: s.playing ? s.timeMs : anim.durationMs,
      }
    }),

  play: () => set({ playing: true, timeMs: 0 }),
  pause: () => set({ playing: false }),
  setTime: (ms) => set((s) => ({ timeMs: Math.max(0, Math.min(s.doc.anim.durationMs, ms)) })),

  setImage: (image) => {
    get().pushHistory()
    set((s) => ({ doc: { ...s.doc, image } }))
  },

  updateImage: (patch) =>
    set((s) => ({
      doc: { ...s.doc, image: s.doc.image ? { ...s.doc.image, ...patch } : null },
    })),

  clearImage: () => {
    get().pushHistory()
    set((s) => ({ doc: { ...s.doc, image: null } }))
  },

  addPath: (raw) => {
    get().pushHistory()
    // Anchoring scale and rotation at the stroke's own centre keeps the object
    // in place as it is resized, and stays put when shape settings change.
    const origin = centroid(raw)
    const path: PathObj = {
      id: nextPathId(),
      raw,
      smoothing: NEW_PATH_SMOOTHING,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, originX: origin.x, originY: origin.y },
      text: newPathText(),
      style: {},
    }
    set((s) => ({
      doc: { ...s.doc, paths: [...s.doc.paths, path] },
      selectedPathId: path.id,
      // Drawing means you are back to composing, so the canvas returns to the
      // finished poster rather than staying on whatever frame was scrubbed to.
      ...restPlayhead(s.doc),
    }))
  },

  /**
   * Bulk insert, one history entry for the lot. Imported vector art defaults
   * to zero smoothing — it is already clean, and the brush default would round
   * off corners the designer drew deliberately.
   */
  addPaths: (polylines, smoothing = 0) => {
    const usable = polylines.filter((p) => p.length >= 2)
    if (usable.length === 0) return
    get().pushHistory()

    const added: PathObj[] = usable.map((raw) => {
      const origin = centroid(raw)
      return {
        id: nextPathId(),
        raw,
        smoothing,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, originX: origin.x, originY: origin.y },
        text: newPathText(),
        style: {},
      }
    })

    set((s) => ({
      doc: { ...s.doc, paths: [...s.doc.paths, ...added] },
      selectedPathId: added[0].id,
      ...restPlayhead(s.doc),
    }))
  },

  updatePath: (id, patch) =>
    set((s) => ({
      doc: {
        ...s.doc,
        paths: s.doc.paths.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
    })),

  updatePathStyle: (id, patch) =>
    set((s) => ({
      doc: {
        ...s.doc,
        paths: s.doc.paths.map((p) =>
          p.id === id ? { ...p, style: { ...p.style, ...patch } } : p,
        ),
      },
    })),

  updatePathTransform: (id, patch) =>
    set((s) => ({
      doc: {
        ...s.doc,
        paths: s.doc.paths.map((p) =>
          p.id === id ? { ...p, transform: { ...p.transform, ...patch } } : p,
        ),
      },
    })),

  resetPathTransform: (id) => {
    get().pushHistory()
    set((s) => ({
      doc: {
        ...s.doc,
        paths: s.doc.paths.map((p) =>
          p.id === id ? { ...p, transform: { ...p.transform, x: 0, y: 0, scale: 1, rotation: 0 } } : p,
        ),
      },
    }))
  },

  deletePath: (id) => {
    get().pushHistory()
    set((s) => ({
      doc: { ...s.doc, paths: s.doc.paths.filter((p) => p.id !== id) },
      selectedPathId: s.selectedPathId === id ? null : s.selectedPathId,
    }))
  },

  selectPath: (id) => set({ selectedPathId: id }),

  clearAll: () => {
    get().pushHistory()
    set((s) => ({ doc: { ...s.doc, paths: [] }, selectedPathId: null }))
  },

  /**
   * Park the current workspace and open another, seeding it the first time.
   *
   * Nothing is thrown away: leave a preset half-edited, wander through the
   * others, come back and it is exactly as you left it — undo stack included.
   */
  switchSlot: (id, seed) =>
    set((s) => {
      if (id === s.activeSlot) return s

      const slots: Record<string, Workspace> = {
        ...s.slots,
        [s.activeSlot]: { doc: s.doc, past: s.past, future: s.future },
      }
      const view = { width: s.doc.width, height: s.doc.height }
      const stored = slots[id]
      // A workspace parked at an old window size adopts the current one.
      const target = stored
        ? { ...stored, doc: { ...stored.doc, ...view } }
        : { doc: seed(view), past: [], future: [] }

      return {
        slots,
        activeSlot: id,
        doc: target.doc,
        past: target.past,
        future: target.future,
        selectedPathId: target.doc.paths[0]?.id ?? null,
        notice: null,
        ...restPlayhead(target.doc),
      }
    }),
}))

/**
 * Dev-only handle on the live store.
 *
 * Authoring a preset means building it in the browser and reading the document
 * back out; and verifying anything about state needs the *app's* store, not a
 * second instance that a fresh dynamic import would create. Stripped from the
 * production bundle.
 */
// The window guard matters: a unit test importing this module runs in Node,
// where reaching for `window` throws before a single assertion runs.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __store?: typeof useStore }).__store = useStore
}
