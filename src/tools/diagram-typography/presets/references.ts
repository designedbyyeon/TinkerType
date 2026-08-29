import type { Lang } from '../../../shared/i18n/lang'
import { buildCenterline, polylineLength } from '../../../shared/geometry/polyline'
import { centroid } from '../../../shared/geometry/transform'
import type { Vec2 } from '../../../shared/geometry/vec'
import { CANVAS_GROUND, CANVAS_INK } from '../../../shared/styles/canvas'
import { DEFAULT_ANIM, DEFAULT_STYLE } from '../store'
import type { Doc, PathObj, Style } from '../types'

/**
 * Preset paths are generated from formulas rather than digitised by hand: the
 * file stays small, the curves stay exact, and once loaded they are ordinary
 * editable strokes like anything drawn with the brush.
 */

/** Presets are composed in this space, then fitted to whatever the view is. */
const DESIGN_W = 900
const DESIGN_H = 1273
/** How much of the shorter view dimension the composition fills. */
const FIT = 0.9

/** Light ground, dark shapes — the same two colours the defaults use. */
const GROUND = CANVAS_GROUND
const INK = CANVAS_INK

export interface View {
  width: number
  height: number
}

function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  steps = 120,
): Vec2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }
  })
}

/** A horizontal run with a sine ripple — the spine of a hanging chain. */
function wave(
  x0: number,
  x1: number,
  y: number,
  amplitude: number,
  cycles: number,
  phase = 0,
  steps = 140,
): Vec2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return {
      x: x0 + (x1 - x0) * t,
      y: y + Math.sin(phase + t * Math.PI * 2 * cycles) * amplitude,
    }
  })
}

let presetPathCounter = 0

/**
 * The gap that lands exactly one shape per character.
 *
 * Presets stay in "by gap" mode so the Gap control is live the moment one
 * loads — locking them to "fit text" made a primary control disappear, which
 * is the opposite of what a quick start is for.
 */
function gapFor(raw: Vec2[], text: string): number {
  const length = polylineLength(buildCenterline(raw, 0))
  const count = [...text].length
  if (count < 2 || length <= 0) return Math.max(1, length)
  // Nudged under the exact division so the sample count floors to `count`.
  return (length / (count - 1)) * 0.998
}

function makePath(raw: Vec2[], text: string, style: Partial<Style> = {}): PathObj {
  const origin = centroid(raw)
  return {
    id: `preset-${++presetPathCounter}`,
    raw,
    smoothing: 0,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, originX: origin.x, originY: origin.y },
    text,
    style: { spacing: gapFor(raw, text), ...style },
  }
}

/** Style values measured in px, which have to scale with the composition. */
const SCALED_KEYS = [
  'size',
  'spacing',
  'blend',
  'fontSize',
  'strokeWidth',
  'textOffset',
  'fillerSize',
] as const

/**
 * Map a composition designed at 900x1273 onto the actual work area, scaling
 * lengths as well as coordinates so the proportions survive any window.
 */
function fitToView(doc: Doc, view: View): Doc {
  const k = Math.min(view.width / DESIGN_W, view.height / DESIGN_H) * FIT
  const dx = (view.width - DESIGN_W * k) / 2
  const dy = (view.height - DESIGN_H * k) / 2
  const place = (p: Vec2): Vec2 => ({ x: p.x * k + dx, y: p.y * k + dy })

  const scaleStyle = <T extends Partial<Style>>(style: T): T => {
    const out = { ...style }
    for (const key of SCALED_KEYS) {
      if (typeof out[key] === 'number') (out[key] as number) = (out[key] as number) * k
    }
    return out
  }

  return {
    ...doc,
    width: view.width,
    height: view.height,
    defaults: scaleStyle(doc.defaults) as Style,
    paths: doc.paths.map((path) => {
      const raw = path.raw.map(place)
      const origin = centroid(raw)
      return {
        ...path,
        raw,
        style: scaleStyle(path.style),
        transform: { ...path.transform, originX: origin.x, originY: origin.y },
      }
    }),
  }
}

export interface Preset {
  id: string
  name: string
  /** What this one teaches, one line. */
  note: string
  build: (view: View) => Doc
}

/**
 * The words on each preset, per language — its name, its one-line lesson, and
 * the line it sets.
 *
 * **The text is part of the preset, not decoration on it.** A starting point
 * whose job is to show what the tool makes cannot open in a language the person
 * looking at it does not read. The gap between shapes is worked back from the
 * character count (`gapFor`), so a Korean line of a different length lands
 * correctly without a second set of numbers.
 *
 * The ids do not translate: they key the workspaces, and a switch of language
 * must not lose the sheet you were half way through.
 */
interface Words {
  name: string
  note: string
  lines: string[]
}

const WORDS: Record<string, Record<Lang, Words>> = {
  arch: {
    en: { name: 'ARCH', note: 'Separate circles, letters turning with the curve', lines: ['MIDSUMMER'] },
    ko: { name: '아치', note: '떨어진 원들, 곡선을 따라 도는 글자', lines: ['한여름 밤의 꿈'] },
  },
  necklace: {
    en: {
      name: 'NECKLACE',
      note: 'Wave-varied beads with dots strung between',
      lines: ['EVERY LINE BEGINS SOMEWHERE'],
    },
    ko: {
      name: '목걸이',
      note: '물결로 변주된 구슬과 그 사이에 꿴 점',
      lines: ['모든 선은 어딘가에서 시작한다'],
    },
  },
  blob: {
    en: {
      name: 'BLOB',
      note: 'Fillet-merged clusters drawn as one outline',
      lines: ['SOFTNESS', 'FIELD NOTES', 'VOL. 03'],
    },
    ko: {
      name: '덩어리',
      note: '필렛으로 붙어 하나의 윤곽선이 된 무리',
      lines: ['부드러움', '현장 기록', '제3권 겨울호'],
    },
  },
}

function preset(id: string, lang: Lang, make: (w: Words) => Doc): Preset {
  const w = WORDS[id][lang]
  return { id, name: w.name, note: w.note, build: (view) => fitToView(make(w), view) }
}

export const presetsFor = (lang: Lang): Preset[] => [
  preset('arch', lang, (w) => ({
    width: DESIGN_W,
    height: DESIGN_H,
    background: GROUND,
    image: null,
    anim: DEFAULT_ANIM,
    defaults: {
      ...DEFAULT_STYLE,
      shape: 'circle',
      size: 92,
      countMode: 'spacing',
      spacing: 88,
      blend: 0,
      blendMode: 'fillet',
      fill: INK,
      stroke: 'none',
      rotateToTangent: true,
      fontSize: 40,
      fontWeight: 600,
      textColor: GROUND,
    },
    // Half turn, opening upward.
    paths: [makePath(arc(450, 690, 292, 292, Math.PI, Math.PI * 2), w.lines[0])],
  })),

  preset('necklace', lang, (w) => ({
    width: DESIGN_W,
    height: DESIGN_H,
    background: GROUND,
    image: null,
    anim: DEFAULT_ANIM,
    defaults: {
      ...DEFAULT_STYLE,
      shape: 'circle',
      size: 60,
      countMode: 'spacing',
      spacing: 58,
      blend: 0,
      blendMode: 'fillet',
      sizeVariation: 'wave',
      sizeAmount: 0.42,
      sizeFrequency: 2.5,
      fillerEnabled: true,
      fillerCount: 1,
      fillerSize: 10,
      fill: INK,
      stroke: 'none',
      rotateToTangent: true,
      fontSize: 26,
      fontWeight: 600,
      textColor: GROUND,
    },
    // A hanging half-ellipse — long enough to carry a whole sentence, and it
    // droops the way a strung chain actually does.
    paths: [makePath(arc(450, 400, 330, 470, Math.PI, 0), w.lines[0])],
  })),

  preset('blob', lang, (w) => ({
    width: DESIGN_W,
    height: DESIGN_H,
    background: GROUND,
    image: null,
    anim: DEFAULT_ANIM,
    defaults: {
      ...DEFAULT_STYLE,
      shape: 'circle',
      size: 118,
      countMode: 'spacing',
      spacing: 96,
      blend: 40,
      blendMode: 'fillet',
      // The one preset that keeps its outline treatment — with no fill, the
      // letters have to be dark to read against the ground.
      fill: 'none',
      stroke: INK,
      strokeWidth: 3,
      rotateToTangent: false,
      fontSize: 34,
      fontWeight: 600,
      textColor: INK,
    },
    paths: [
      makePath(wave(140, 760, 340, 72, 1), w.lines[0]),
      makePath(wave(120, 780, 650, 95, 1.15, Math.PI * 1.1), w.lines[1]),
      makePath(wave(235, 665, 945, 55, 0.8, Math.PI * 0.4), w.lines[2]),
    ],
  })),
]
