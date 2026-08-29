/** Object placement, applied as an SVG transform rather than baked into the
 * geometry — moving and scaling stay instant and lossless. */
export interface Transform {
  x: number
  y: number
  scale: number
  /** Degrees. */
  rotation: number
  /** Fixed point for scale and rotation, in the path's own coordinates. */
  originX: number
  originY: number
}

import type { Vec2 } from './vec'

export function centroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.x
    y += p.y
  }
  return { x: x / points.length, y: y / points.length }
}

/** Drag deltas carry float noise; the exported file should not. */
const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

/**
 * The transform as an SVG attribute, read right to left: pull the origin to
 * zero, scale, rotate, put it back, then translate.
 */
export function transformAttr(t: Transform): string | undefined {
  const moved = t.x !== 0 || t.y !== 0
  const scaled = t.scale !== 1
  const rotated = t.rotation !== 0
  if (!moved && !scaled && !rotated) return undefined

  const parts: string[] = []
  if (moved) parts.push(`translate(${fmt(t.x)} ${fmt(t.y)})`)
  if (rotated) parts.push(`rotate(${fmt(t.rotation)} ${fmt(t.originX)} ${fmt(t.originY)})`)
  if (scaled) {
    parts.push(`translate(${fmt(t.originX)} ${fmt(t.originY)})`)
    parts.push(`scale(${fmt(t.scale)})`)
    parts.push(`translate(${fmt(-t.originX)} ${fmt(-t.originY)})`)
  }
  return parts.join(' ')
}

/** Map a point from the path's own coordinates into poster coordinates. */
export function applyTransform(t: Transform, p: Vec2): Vec2 {
  const dx = (p.x - t.originX) * t.scale
  const dy = (p.y - t.originY) * t.scale
  const rad = (t.rotation * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  return {
    x: t.originX + dx * c - dy * s + t.x,
    y: t.originY + dx * s + dy * c + t.y,
  }
}

/** Where the fixed point of scale and rotation ends up on the poster. */
export function transformedOrigin(t: Transform): Vec2 {
  return { x: t.originX + t.x, y: t.originY + t.y }
}
