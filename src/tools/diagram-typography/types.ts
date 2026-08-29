import type { Vec2 } from '../../shared/geometry/vec'

import type { Transform } from '../../shared/geometry/transform'
import type { DocImage } from '../../shared/media/images'

// Re-exported so the tool's own modules keep importing them from one place.
export type { Transform, DocImage }

export type ShapeKind = 'circle' | 'square' | 'roundSquare'
export type SizeVariationMode = 'none' | 'ramp' | 'wave' | 'random'
export type CountMode = 'spacing' | 'text'

/**
 * `fillet` keeps each shape's own outline intact and only rounds off the
 * joints. `metaball` lets neighbours pull the whole surface around, which is
 * the swollen, teardrop look — a different aesthetic, not a worse one.
 */
export type BlendMode = 'fillet' | 'metaball'

export type Easing = 'back' | 'out' | 'linear'

/**
 * Shapes pop in along the path. Every object stretches to the same total
 * duration, so chains of different lengths still land together.
 */
export interface AnimSettings {
  /** Whole run, ms. */
  durationMs: number
  /** How long one shape takes to pop, ms. */
  popMs: number
  easing: Easing
  loop: boolean
}

export interface Style {
  shape: ShapeKind
  /** Corner radius for roundSquare, as a fraction of half-size (0..1). */
  cornerRadius: number
  /** Shape diameter / edge length in px. */
  size: number
  sizeVariation: SizeVariationMode
  /** 0..1 — how far sizes deviate from `size`. */
  sizeAmount: number
  /** Cycles along the path, for the `wave` mode. */
  sizeFrequency: number
  sizeSeed: number

  /** Arc-length gap between shape centres, px. */
  spacing: number
  countMode: CountMode
  /**
   * Where the text begins along the chain, as a percentage of the way round.
   * A closed path has no natural start, so this is how you rotate the words
   * to the side of the shape you want them on.
   */
  textStart: number

  /** Joint radius in px. 0 = shapes stay separate. */
  blend: number
  blendMode: BlendMode

  fill: string
  stroke: string
  strokeWidth: number

  rotateToTangent: boolean

  fontSize: number
  fontWeight: number
  textColor: string
  /** Manual vertical nudge for the glyph, px. */
  textOffset: number

  /** Small decorative shapes inserted between the lettered ones. */
  fillerEnabled: boolean
  fillerSize: number
  fillerCount: number
}

export interface PathObj {
  id: string
  /** Untouched pointer trace — kept so smoothing stays re-adjustable. */
  raw: Vec2[]
  /** Smoothing radius in px, applied to `raw` to derive the centreline. */
  smoothing: number
  transform: Transform
  text: string
  /** Overrides layered on top of the document defaults. */
  style: Partial<Style>
}

export interface Doc {
  width: number
  height: number
  background: string
  image: DocImage | null
  defaults: Style
  anim: AnimSettings
  paths: PathObj[]
}

/** One placed shape: where it sits, how big, and which glyph rides on it. */
export interface ShapeNode {
  pos: Vec2
  /** Tangent angle in radians, for `rotateToTangent`. */
  angle: number
  size: number
  shape: ShapeKind
  cornerRadius: number
  /** null for decorative shapes that carry no text. */
  text: string | null
  /** How far this shape has popped in, 0..1. Absent means fully present. */
  reveal?: number
}
