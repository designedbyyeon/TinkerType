/**
 * A path's subpaths as polygons, for measuring them.
 *
 * Written because the shapes stopped being ours. The letters this machine shows
 * are now the designer's outlines, in the designer's own commands — lowercase
 * relative moves, cubics, a shorthand `s` — and the old checks read the drawing by
 * matching `M x y H…`, which is a way of testing that a path was written the way
 * this file used to write it. The facts worth defending are geometric: how big a
 * letter is, and which way each of its contours turns.
 *
 * Curves are sampled rather than solved. Nothing here needs the exact outline —
 * an area's sign and a bounding box survive sampling, and a flattener that is
 * right is worth more than one that is exact.
 */

export interface Sub {
  points: Array<[number, number]>
}

/** Every number and command letter, in order. */
function tokenize(d: string): Array<string | number> {
  const out: Array<string | number> = []
  const re = /([A-Za-z])|(-?\d*\.?\d+(?:e-?\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) out.push(m[1] ?? Number(m[2]))
  return out
}

function cubic(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  push: (p: [number, number]) => void,
) {
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    const u = 1 - t
    push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
}

/**
 * An arc, sampled off its own centre.
 *
 * Only the circular case, which is the only one drawn here. The centre comes from
 * the endpoint parameterisation; the flags pick which of the two circles through
 * the endpoints, and which way round it.
 */
function arc(
  from: [number, number],
  rx: number,
  large: number,
  sweep: number,
  to: [number, number],
  push: (p: [number, number]) => void,
) {
  const [x0, y0] = from
  const [x1, y1] = to
  const dx = (x1 - x0) / 2
  const dy = (y1 - y0) / 2
  const half = Math.hypot(dx, dy)
  const r = Math.max(rx, half)
  // Distance from the chord's midpoint to the centre, on the chord's normal.
  const h = Math.sqrt(Math.max(0, r * r - half * half)) * (large === sweep ? 1 : -1)
  const cx = x0 + dx + (h * dy) / (half || 1)
  const cy = y0 + dy - (h * dx) / (half || 1)

  const a0 = Math.atan2(y0 - cy, x0 - cx)
  let a1 = Math.atan2(y1 - cy, x1 - cx)
  if (sweep === 1 && a1 <= a0) a1 += Math.PI * 2
  if (sweep === 0 && a1 >= a0) a1 -= Math.PI * 2
  for (let i = 1; i <= 12; i++) {
    const a = a0 + ((a1 - a0) * i) / 12
    push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
}

/** Flatten a path into its subpaths. */
export function subpaths(d: string): Sub[] {
  const t = tokenize(d)
  const subs: Sub[] = []
  let cur: Sub | null = null
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  let lastC: [number, number] | null = null
  let i = 0

  const push = (p: [number, number]) => {
    if (!cur) {
      cur = { points: [] }
      subs.push(cur)
    }
    cur.points.push(p)
    x = p[0]
    y = p[1]
  }
  const num = () => t[i++] as number

  while (i < t.length) {
    if (typeof t[i] === 'string') cmd = t[i++] as string
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const bx = rel ? x : 0
    const by = rel ? y : 0

    if (C === 'M') {
      cur = { points: [] }
      subs.push(cur)
      x = bx + num()
      y = by + num()
      sx = x
      sy = y
      cur.points.push([x, y])
      cmd = rel ? 'l' : 'L'
      lastC = null
    } else if (C === 'L') {
      push([bx + num(), by + num()])
      lastC = null
    } else if (C === 'H') {
      push([bx + num(), y])
      lastC = null
    } else if (C === 'V') {
      push([x, by + num()])
      lastC = null
    } else if (C === 'C' || C === 'S') {
      const p0: [number, number] = [x, y]
      const p1: [number, number] =
        C === 'C'
          ? [bx + num(), by + num()]
          : lastC
            ? [2 * x - lastC[0], 2 * y - lastC[1]]
            : [x, y]
      const p2: [number, number] = [bx + num(), by + num()]
      const p3: [number, number] = [bx + num(), by + num()]
      cubic(p0, p1, p2, p3, push)
      lastC = p2
    } else if (C === 'A') {
      const rx = num()
      num() // ry — circular here
      num() // rotation
      const large = num()
      const sweep = num()
      arc([x, y], rx, large, sweep, [bx + num(), by + num()], push)
      lastC = null
    } else if (C === 'Z') {
      x = sx
      y = sy
      cur = null
      lastC = null
    } else {
      i++ // an unread command's argument; never happens for these shapes
    }
  }
  return subs.filter((s) => s.points.length > 2)
}

/** Twice the signed area. Positive and negative wind opposite ways. */
export function signedArea(s: Sub): number {
  let a = 0
  const p = s.points
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]
    a += p[i][0] * q[1] - q[0] * p[i][1]
  }
  return a
}

export function boundsOf(subs: Sub[]): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const s of subs) {
    for (const [px, py] of s.points) {
      x1 = Math.min(x1, px)
      y1 = Math.min(y1, py)
      x2 = Math.max(x2, px)
      y2 = Math.max(y2, py)
    }
  }
  return { x1, y1, x2, y2 }
}

/** Apply a `translate(tx ty) scale(k)` to a point. */
export function applied(t: string | undefined, p: [number, number]): [number, number] {
  if (!t) return p
  const tr = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(t)
  const sc = /scale\(\s*(-?[\d.]+)/.exec(t)
  const k = sc ? Number(sc[1]) : 1
  const tx = tr ? Number(tr[1]) : 0
  const ty = tr ? Number(tr[2]) : 0
  return [tx + p[0] * k, ty + p[1] * k]
}
