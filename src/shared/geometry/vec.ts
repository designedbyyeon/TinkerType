export interface Vec2 {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec2 => ({ x, y })

/** An axis-aligned box, in the same units as the points around it. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })

export const len = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y)

export function normalize(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Deterministic PRNG so size variation is stable across re-renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
