import type { Vec2 } from '../../../shared/geometry/vec'
import type { Seg } from './glyphs'

/**
 * Put a mould radius on the letters.
 *
 * Injection-moulded plastic has no zero-radius edge — the steel that cuts the
 * cavity has a nose radius, so every corner of a real part comes out slightly
 * blunt. Type drawn for print has perfectly sharp corners, and that single
 * difference is most of what makes letters in a frame read as a drawing of a
 * runner rather than as a part off one.
 *
 * The fillet is real geometry, not a stroke effect: each corner is trimmed back
 * along both of its edges and joined with a tangent arc, so the outline stays a
 * single filled path that a designer can open and edit. Curves get trimmed as
 * well as straights, which is not optional — better than half the sharp corners
 * in these faces have a curve on one side of them.
 */

/** Below this turn the junction is the typeface being smooth; leave it alone. */
const CORNER_DEGREES = 12

/**
 * Most of an edge a single corner may eat.
 *
 * Two corners share an edge, so anything above a half lets neighbouring fillets
 * cross and turn the outline inside out. Under a half leaves a sliver of the
 * original edge between them.
 */
const MAX_EAT = 0.45

interface Segment {
  kind: 'L' | 'Q' | 'C'
  from: Vec2
  to: Vec2
  /** Quadratic control point. */
  c?: Vec2
  /** Cubic control points. */
  c1?: Vec2
  c2?: Vec2
  length: number
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

function norm(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y)
  return l < 1e-9 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l }
}

function pointAt(s: Segment, t: number): Vec2 {
  if (s.kind === 'L') return lerp(s.from, s.to, t)
  if (s.kind === 'Q' && s.c) {
    const u = 1 - t
    return {
      x: u * u * s.from.x + 2 * u * t * s.c.x + t * t * s.to.x,
      y: u * u * s.from.y + 2 * u * t * s.c.y + t * t * s.to.y,
    }
  }
  const c1 = s.c1 as Vec2
  const c2 = s.c2 as Vec2
  const u = 1 - t
  return {
    x: u * u * u * s.from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * s.to.x,
    y: u * u * u * s.from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * s.to.y,
  }
}

const SAMPLES = 16

function measure(s: Omit<Segment, 'length'>): number {
  if (s.kind === 'L') return Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y)
  let total = 0
  let prev = s.from
  for (let i = 1; i <= SAMPLES; i++) {
    const p = pointAt({ ...s, length: 0 }, i / SAMPLES)
    total += Math.hypot(p.x - prev.x, p.y - prev.y)
    prev = p
  }
  return total
}

/** The parameter at which `distance` of arc length has been covered. */
function paramAtLength(s: Segment, distance: number): number {
  if (s.kind === 'L') return s.length < 1e-9 ? 0 : distance / s.length
  let travelled = 0
  let prev = s.from
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const p = pointAt(s, t)
    const step = Math.hypot(p.x - prev.x, p.y - prev.y)
    if (travelled + step >= distance) {
      const within = step < 1e-9 ? 0 : (distance - travelled) / step
      return (i - 1 + within) / SAMPLES
    }
    travelled += step
    prev = p
  }
  return 1
}

/** de Casteljau. Returns the piece of `s` between the two parameters. */
function slice(s: Segment, t0: number, t1: number): Segment {
  let cur = s
  if (t1 < 1) cur = splitBefore(cur, t1)
  if (t0 > 0) cur = splitAfter(cur, t1 < 1 ? t0 / t1 : t0)
  return cur
}

function splitBefore(s: Segment, t: number): Segment {
  if (s.kind === 'L') {
    const to = lerp(s.from, s.to, t)
    return { ...s, to, length: measure({ ...s, to }) }
  }
  if (s.kind === 'Q' && s.c) {
    const a = lerp(s.from, s.c, t)
    const b = lerp(s.c, s.to, t)
    const mid = lerp(a, b, t)
    const next = { ...s, c: a, to: mid }
    return { ...next, length: measure(next) }
  }
  const c1 = s.c1 as Vec2
  const c2 = s.c2 as Vec2
  const a = lerp(s.from, c1, t)
  const b = lerp(c1, c2, t)
  const c = lerp(c2, s.to, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const mid = lerp(d, e, t)
  const next = { ...s, c1: a, c2: d, to: mid }
  return { ...next, length: measure(next) }
}

function splitAfter(s: Segment, t: number): Segment {
  if (s.kind === 'L') {
    const from = lerp(s.from, s.to, t)
    return { ...s, from, length: measure({ ...s, from }) }
  }
  if (s.kind === 'Q' && s.c) {
    const a = lerp(s.from, s.c, t)
    const b = lerp(s.c, s.to, t)
    const mid = lerp(a, b, t)
    const next = { ...s, from: mid, c: b }
    return { ...next, length: measure(next) }
  }
  const c1 = s.c1 as Vec2
  const c2 = s.c2 as Vec2
  const a = lerp(s.from, c1, t)
  const b = lerp(c1, c2, t)
  const c = lerp(c2, s.to, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const mid = lerp(d, e, t)
  const next = { ...s, from: mid, c1: e, c2: c }
  return { ...next, length: measure(next) }
}

function startTangent(s: Segment): Vec2 {
  if (s.kind === 'Q' && s.c) return norm(sub(s.c, s.from))
  if (s.kind === 'C' && s.c1) return norm(sub(s.c1, s.from))
  return norm(sub(s.to, s.from))
}

function endTangent(s: Segment): Vec2 {
  if (s.kind === 'Q' && s.c) return norm(sub(s.to, s.c))
  if (s.kind === 'C' && s.c2) return norm(sub(s.to, s.c2))
  return norm(sub(s.to, s.from))
}

/** Split a contour's commands into segments, closing the loop. */
function toSegments(commands: Seg[]): Segment[] {
  const out: Segment[] = []
  let cur: Vec2 = { x: 0, y: 0 }
  let start: Vec2 = { x: 0, y: 0 }

  const push = (s: Omit<Segment, 'length'>) => {
    const length = measure(s)
    if (length > 1e-7) out.push({ ...s, length })
  }

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        cur = { x: cmd.x, y: cmd.y }
        start = cur
        break
      case 'L':
        push({ kind: 'L', from: cur, to: { x: cmd.x, y: cmd.y } })
        cur = { x: cmd.x, y: cmd.y }
        break
      case 'Q':
        push({ kind: 'Q', from: cur, c: { x: cmd.x1, y: cmd.y1 }, to: { x: cmd.x, y: cmd.y } })
        cur = { x: cmd.x, y: cmd.y }
        break
      case 'C':
        push({
          kind: 'C',
          from: cur,
          c1: { x: cmd.x1, y: cmd.y1 },
          c2: { x: cmd.x2, y: cmd.y2 },
          to: { x: cmd.x, y: cmd.y },
        })
        cur = { x: cmd.x, y: cmd.y }
        break
      case 'Z':
        break
    }
  }

  // Close it, if the outline did not already come back to the start.
  if (out.length > 0) {
    const last = out[out.length - 1].to
    if (Math.hypot(last.x - start.x, last.y - start.y) > 1e-7) {
      push({ kind: 'L', from: last, to: start })
    }
  }
  return out
}

/** A circular arc as one or two cubics — exact enough that nothing shows. */
function arcToCubics(centre: Vec2, radius: number, from: Vec2, to: Vec2, clockwise: boolean): Seg[] {
  const a0 = Math.atan2(from.y - centre.y, from.x - centre.x)
  const a1 = Math.atan2(to.y - centre.y, to.x - centre.x)

  let sweep = a1 - a0
  if (clockwise && sweep < 0) sweep += Math.PI * 2
  if (!clockwise && sweep > 0) sweep -= Math.PI * 2

  // A single cubic holds a quarter turn to within a rounding error; past that it
  // starts to show, so a wider fillet is halved.
  const pieces = Math.abs(sweep) > Math.PI / 2 ? 2 : 1
  const step = sweep / pieces
  const k = (4 / 3) * Math.tan(step / 4)

  const out: Seg[] = []
  for (let i = 0; i < pieces; i++) {
    const s0 = a0 + step * i
    const s1 = s0 + step
    const p0 = { x: centre.x + radius * Math.cos(s0), y: centre.y + radius * Math.sin(s0) }
    const p3 = { x: centre.x + radius * Math.cos(s1), y: centre.y + radius * Math.sin(s1) }
    const t0 = { x: -Math.sin(s0), y: Math.cos(s0) }
    const t1 = { x: -Math.sin(s1), y: Math.cos(s1) }
    const p1 = add(p0, mul(t0, k * radius))
    const p2 = sub(p3, mul(t1, k * radius))
    out.push({ type: 'C', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x: p3.x, y: p3.y })
  }
  return out
}

interface Fillet {
  /** How much to trim off the end of segment i and the start of i+1. */
  eat: number
  radius: number
  clockwise: boolean
}

/** Round every corner of one closed contour. */
function roundContour(commands: Seg[], radius: number): Seg[] {
  const segs = toSegments(commands)
  if (segs.length < 2 || radius <= 0) return commands

  const threshold = (CORNER_DEGREES * Math.PI) / 180
  const fillets = new Map<number, Fillet>()

  for (let i = 0; i < segs.length; i++) {
    const a = segs[i]
    const b = segs[(i + 1) % segs.length]
    const ta = endTangent(a)
    const tb = startTangent(b)

    const dot = Math.max(-1, Math.min(1, ta.x * tb.x + ta.y * tb.y))
    const turn = Math.acos(dot)
    if (turn < threshold) continue

    // d = r·tan(φ/2) puts the arc tangent to both edges. A near-spike sends that
    // to infinity, which is exactly the case the clamp is for — and blunting the
    // sharpest points hardest is what was wanted.
    const wanted = radius * Math.tan(turn / 2)
    const eat = Math.min(wanted, a.length * MAX_EAT, b.length * MAX_EAT)
    if (eat < 1e-4) continue

    const tan = Math.tan(turn / 2)
    fillets.set(i, {
      eat,
      radius: tan < 1e-6 ? radius : eat / tan,
      clockwise: ta.x * tb.y - ta.y * tb.x > 0,
    })
  }

  if (fillets.size === 0) return commands

  const out: Seg[] = []
  let first: Vec2 | null = null

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    const before = fillets.get((i - 1 + segs.length) % segs.length)
    const after = fillets.get(i)

    const head = before ? Math.min(before.eat, seg.length * MAX_EAT) : 0
    const tail = after ? Math.min(after.eat, seg.length * MAX_EAT) : 0

    const t0 = head > 0 ? paramAtLength(seg, head) : 0
    const t1 = tail > 0 ? paramAtLength(seg, seg.length - tail) : 1
    const kept = t1 > t0 + 1e-6 ? slice(seg, t0, t1) : null

    if (kept) {
      if (first === null) {
        first = kept.from
        out.push({ type: 'M', x: kept.from.x, y: kept.from.y })
      }
      if (kept.kind === 'L') out.push({ type: 'L', x: kept.to.x, y: kept.to.y })
      else if (kept.kind === 'Q' && kept.c) {
        out.push({ type: 'Q', x1: kept.c.x, y1: kept.c.y, x: kept.to.x, y: kept.to.y })
      } else if (kept.c1 && kept.c2) {
        out.push({
          type: 'C',
          x1: kept.c1.x,
          y1: kept.c1.y,
          x2: kept.c2.x,
          y2: kept.c2.y,
          x: kept.to.x,
          y: kept.to.y,
        })
      }
    }

    if (!after) continue

    // The arc, from where this segment was cut to where the next one resumes.
    const next = segs[(i + 1) % segs.length]
    const arcFrom = kept ? kept.to : pointAt(seg, paramAtLength(seg, Math.max(0, seg.length - tail)))
    const arcTo = pointAt(next, paramAtLength(next, Math.min(after.eat, next.length * MAX_EAT)))

    const ta = endTangent(seg)
    const side: Vec2 = after.clockwise ? { x: -ta.y, y: ta.x } : { x: ta.y, y: -ta.x }
    const centre = add(arcFrom, mul(side, after.radius))

    if (first === null) {
      first = arcFrom
      out.push({ type: 'M', x: arcFrom.x, y: arcFrom.y })
    }
    out.push(...arcToCubics(centre, after.radius, arcFrom, arcTo, after.clockwise))
  }

  if (out.length === 0) return commands
  out.push({ type: 'Z' })
  return out
}

/**
 * Round the corners of a glyph's outlines.
 *
 * Contours are handled one at a time, so a counter gets the same radius as the
 * outside — which is right, since the same cutter made both.
 */
export function roundCorners(commands: Seg[], radius: number): Seg[] {
  if (radius <= 0) return commands

  const out: Seg[] = []
  let contour: Seg[] = []

  const flush = () => {
    if (contour.length > 1) out.push(...roundContour(contour, radius))
    contour = []
  }

  for (const cmd of commands) {
    if (cmd.type === 'M') {
      flush()
      contour = [cmd]
    } else {
      contour.push(cmd)
      if (cmd.type === 'Z') flush()
    }
  }
  flush()

  return out.length > 0 ? out : commands
}
