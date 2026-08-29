import type { PathObj, ShapeNode, Style } from '../types'
import {
  buildCenterline,
  samplePathByCount,
  samplePathBySpacing,
  type PathSample,
} from '../../../shared/geometry/polyline'
import { mulberry32, type Vec2 } from '../../../shared/geometry/vec'

export function resolveStyle(defaults: Style, overrides: Partial<Style>): Style {
  return { ...defaults, ...overrides }
}

/**
 * One glyph per shape. Spaces become blank shapes — that reads as the gap in
 * the reference posters without breaking the rhythm of the chain.
 */
export function splitText(text: string): (string | null)[] {
  return [...text].map((c) => (c.trim() === '' ? null : c))
}

function variedSize(style: Style, t: number, index: number): number {
  const { size, sizeVariation, sizeAmount, sizeFrequency, sizeSeed } = style
  let factor = 1

  switch (sizeVariation) {
    case 'ramp':
      factor = 1 + sizeAmount * (2 * t - 1)
      break
    case 'wave':
      factor = 1 + sizeAmount * Math.sin(2 * Math.PI * sizeFrequency * t)
      break
    case 'random': {
      const rand = mulberry32(sizeSeed + index * 2654435761)
      factor = 1 + sizeAmount * (rand() * 2 - 1)
      break
    }
    default:
      factor = 1
  }

  return Math.max(1, size * factor)
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface BuiltPath {
  centerline: Vec2[]
  nodes: ShapeNode[]
}

/** Bounding box of the placed shapes, in the path's own coordinates. */
export function nodeBounds(nodes: ShapeNode[], pad = 0): Bounds | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    // Circumradius, so a rotated square is covered too.
    const reach = (n.size * Math.SQRT2) / 2 + pad
    minX = Math.min(minX, n.pos.x - reach)
    minY = Math.min(minY, n.pos.y - reach)
    maxX = Math.max(maxX, n.pos.x + reach)
    maxY = Math.max(maxY, n.pos.y + reach)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Path -> placed shapes.
 *
 * Filler shapes are produced by sampling at `spacing / stride` and treating
 * every stride-th sample as a lettered one, which keeps the lettered rhythm
 * exact rather than approximating it around the decorative dots.
 */
export function buildPath(path: PathObj, style: Style): BuiltPath {
  const centerline = buildCenterline(path.raw, path.smoothing)
  if (centerline.length < 2) return { centerline, nodes: [] }

  const tokens = splitText(path.text)
  const stride = style.fillerEnabled ? Math.max(1, Math.round(style.fillerCount)) + 1 : 1

  let samples: PathSample[]
  if (style.countMode === 'text') {
    const mainCount = Math.max(1, tokens.length)
    samples = samplePathByCount(centerline, (mainCount - 1) * stride + 1)
  } else {
    const spacing = Math.max(1, style.spacing) / stride
    samples = samplePathBySpacing(centerline, spacing)
  }

  const nodes: ShapeNode[] = []
  const letteredCount = Math.ceil(samples.length / stride)
  // Rotating which shape carries which glyph — rather than moving the shapes
  // themselves — keeps the composition fixed while the words travel round it.
  // On a closed path that is the only way to choose where the text starts.
  const shift = letteredCount
    ? Math.round((((style.textStart % 100) + 100) % 100) / 100 * letteredCount)
    : 0
  let tokenIndex = 0

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const isLettered = i % stride === 0

    if (isLettered) {
      const rotated = ((tokenIndex - shift) % letteredCount + letteredCount) % letteredCount
      const token = rotated < tokens.length ? tokens[rotated] : null
      tokenIndex++
      nodes.push({
        pos: sample.pos,
        angle: style.rotateToTangent ? Math.atan2(sample.tangent.y, sample.tangent.x) : 0,
        size: variedSize(style, sample.t, i),
        shape: style.shape,
        cornerRadius: style.cornerRadius,
        text: token,
      })
    } else {
      nodes.push({
        pos: sample.pos,
        angle: 0,
        size: Math.max(1, style.fillerSize),
        shape: style.shape,
        cornerRadius: style.cornerRadius,
        text: null,
      })
    }
  }

  return { centerline, nodes }
}

/**
 * True when no two shapes touch. Lets the renderer emit exact <circle>/<rect>
 * elements instead of an approximated contour — perfect geometry and a far
 * smaller SVG for the un-merged references.
 */
export function shapesAreDisjoint(nodes: ShapeNode[]): boolean {
  if (nodes.length > 600) return false
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      // Circumradius covers squares too, so this is conservative.
      const reach = (a.size * Math.SQRT1_2 + b.size * Math.SQRT1_2) / 2
      if (dx * dx + dy * dy < reach * reach) return false
    }
  }
  return true
}
