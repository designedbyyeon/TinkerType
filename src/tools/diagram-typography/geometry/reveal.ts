import type { AnimSettings, Easing, ShapeNode } from '../types'

/** Overshoot constant for the back-out curve — the "pop" in pop-in. */
const BACK_C1 = 1.70158
const BACK_C3 = BACK_C1 + 1

export function ease(t: number, kind: Easing): number {
  // Pinned exactly at the ends. The back polynomial evaluates to ~1e-16 rather
  // than 0 at t=0, which would leave every un-started shape with a sliver of
  // size instead of none.
  if (t <= 0) return 0
  if (t >= 1) return 1

  const x = t
  switch (kind) {
    case 'linear':
      return x
    case 'out':
      return 1 - Math.pow(1 - x, 3)
    case 'back':
      // Rises past 1 near the end and settles back — reads as a physical pop.
      return 1 + BACK_C3 * Math.pow(x - 1, 3) + BACK_C1 * Math.pow(x - 1, 2)
  }
}

/**
 * When node `index` of `count` starts popping, in ms.
 *
 * Every object normalises to the same total duration, so a 10-shape chain and
 * a 40-shape chain finish together and no cross-object scheduling is needed.
 */
export function nodeStart(index: number, count: number, settings: AnimSettings): number {
  if (count <= 1) return 0
  const pop = Math.min(settings.popMs, settings.durationMs)
  const spread = Math.max(0, settings.durationMs - pop)
  return (index / (count - 1)) * spread
}

/** How far node `index` has popped at time `timeMs`, eased, 0..1-ish. */
export function nodeReveal(
  index: number,
  count: number,
  timeMs: number,
  settings: AnimSettings,
): number {
  const pop = Math.max(1, Math.min(settings.popMs, settings.durationMs))
  const local = (timeMs - nodeStart(index, count, settings)) / pop
  return ease(local, settings.easing)
}

/**
 * Scale every shape by its reveal value and record it for the letters.
 *
 * Returns the same array when nothing is animating, so the memo chain
 * downstream (field -> contour -> path data) stays untouched at rest.
 */
export function applyReveal(
  nodes: ShapeNode[],
  timeMs: number,
  settings: AnimSettings,
  playing: boolean,
): ShapeNode[] {
  // At rest the poster is simply finished; no per-node work, no new identities.
  if (!playing && timeMs >= settings.durationMs) return nodes

  return nodes.map((node, i) => {
    const reveal = nodeReveal(i, nodes.length, timeMs, settings)
    return { ...node, size: Math.max(0, node.size * reveal), reveal }
  })
}

/** Letters fade in over the back half of their shape's pop. */
export function letterOpacity(reveal: number): number {
  return Math.min(1, Math.max(0, (reveal - 0.35) / 0.45))
}
