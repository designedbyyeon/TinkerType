import type { Rect, Vec2 } from '../../../shared/geometry/vec'
import { bboxOf, pointInPolygon, signedArea } from '../../../shared/geometry/polygon'
import { outlineData, type Seg } from '../../../shared/media/type/measure'

/*
 * Outline geometry that is not about glyphs lives in `shared/geometry/polygon`.
 * Re-exported here because it is what this module's callers already ask it for,
 * and because the winding test really is part of reading a glyph — it is just
 * not owned by it.
 */
export { bboxOf, pointInPolygon, signedArea }

/* A path command is the font library's vocabulary, not this module's. */
export type { Seg } from '../../../shared/media/type/measure'


export type ContourKind = 'solid' | 'hole'

export interface Contour {
  /** Flattened, for every geometric question. */
  points: Vec2[]
  /** As the font drew it, for rendering and export. */
  commands: Seg[]
  /** Shoelace area; the sign carries the winding. */
  area: number
  kind: ContourKind
}

/**
 * A piece is one thing that comes out of the mould: a solid, plus whatever is
 * enclosed in it, plus any other solid it overlaps.
 *
 * This is the unit the whole tool is built on. `이` is two pieces — the ㅇ and
 * the ㅣ do not touch, so on a real runner each needs its own gate, and that is
 * exactly what the references show.
 */
export interface Piece {
  /** Solids first, then holes. */
  contours: Contour[]
  bbox: Rect
}

const MIN_STEPS = 1
const MAX_STEPS = 48

function seg(a: Vec2, b: Vec2): Vec2 {
  return { x: b.x - a.x, y: b.y - a.y }
}

/**
 * Segments needed to hold a quadratic within `tolerance`.
 *
 * An n-segment approximation of a quadratic is off by at most |P0-2P1+P2| / 8n²,
 * so the count follows from the tolerance directly rather than from a guess.
 */
function quadSteps(p0: Vec2, p1: Vec2, p2: Vec2, tolerance: number): number {
  const dx = p0.x - 2 * p1.x + p2.x
  const dy = p0.y - 2 * p1.y + p2.y
  const n = Math.sqrt(Math.hypot(dx, dy) / (8 * tolerance))
  return Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.ceil(n)))
}

/** The same bound for a cubic, taken over both second differences. */
function cubicSteps(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, tolerance: number): number {
  const a = Math.hypot(p0.x - 2 * p1.x + p2.x, p0.y - 2 * p1.y + p2.y)
  const b = Math.hypot(p1.x - 2 * p2.x + p3.x, p1.y - 2 * p2.y + p3.y)
  const n = Math.sqrt((3 * Math.max(a, b)) / (4 * tolerance))
  return Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.ceil(n)))
}

function rectsOverlap(a: Rect, b: Rect, slack: number): boolean {
  return (
    a.x - slack <= b.x + b.width &&
    b.x - slack <= a.x + a.width &&
    a.y - slack <= b.y + b.height &&
    b.y - slack <= a.y + a.height
  )
}

/**
 * Split a glyph's commands into closed contours.
 *
 * `Z` is not always present — a following `M` also closes the run — so both
 * endings are handled. Degenerate contours (fewer than three points) are
 * dropped: they carry no area and would only confuse the winding test.
 */
export function flattenCommands(commands: Seg[], tolerance: number): Contour[] {
  const out: Contour[] = []
  let points: Vec2[] = []
  let raw: Seg[] = []
  let cursor: Vec2 = { x: 0, y: 0 }
  let start: Vec2 = { x: 0, y: 0 }

  const close = () => {
    if (points.length >= 3) {
      const area = signedArea(points)
      out.push({ points, commands: raw, area, kind: 'solid' })
    }
    points = []
    raw = []
  }

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        close()
        cursor = { x: cmd.x, y: cmd.y }
        start = cursor
        points = [cursor]
        raw = [cmd]
        break

      case 'L':
        cursor = { x: cmd.x, y: cmd.y }
        points.push(cursor)
        raw.push(cmd)
        break

      case 'Q': {
        const p1 = { x: cmd.x1, y: cmd.y1 }
        const p2 = { x: cmd.x, y: cmd.y }
        const steps = quadSteps(cursor, p1, p2, tolerance)
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const u = 1 - t
          points.push({
            x: u * u * cursor.x + 2 * u * t * p1.x + t * t * p2.x,
            y: u * u * cursor.y + 2 * u * t * p1.y + t * t * p2.y,
          })
        }
        cursor = p2
        raw.push(cmd)
        break
      }

      case 'C': {
        const p1 = { x: cmd.x1, y: cmd.y1 }
        const p2 = { x: cmd.x2, y: cmd.y2 }
        const p3 = { x: cmd.x, y: cmd.y }
        const steps = cubicSteps(cursor, p1, p2, p3, tolerance)
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const u = 1 - t
          points.push({
            x: u * u * u * cursor.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
            y: u * u * u * cursor.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
          })
        }
        cursor = p3
        raw.push(cmd)
        break
      }

      case 'Z':
        raw.push(cmd)
        close()
        cursor = start
        break
    }
  }
  close()

  // The closing point repeats the start in most fonts; drop it so the shoelace
  // and the nearest-point walk do not see a zero-length segment.
  for (const contour of out) {
    const pts = contour.points
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (pts.length > 3 && Math.hypot(last.x - first.x, last.y - first.y) < 1e-9) pts.pop()
  }

  return out
}

/** All of A's sampled points inside B, none, or somewhere in between. */
type Relation = 'nested' | 'apart' | 'crossing'

function relate(a: Contour, b: Contour): Relation {
  let inside = 0
  for (const p of a.points) if (pointInPolygon(p, b.points)) inside++
  if (inside === 0) return 'apart'
  if (inside === a.points.length) return 'nested'
  return 'crossing'
}

class DisjointSet {
  private parent: number[]
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]]
      i = this.parent[i]
    }
    return i
  }
  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[rb] = ra
  }
}

/**
 * Group contours into pieces.
 *
 * Solid and hole are told apart by **winding direction**, not by nesting depth.
 * Winding is what the font itself declares and what nonzero fill obeys; nesting
 * parity gets the answer wrong the moment two solids overlap and a counter sits
 * inside both. Which sign means solid is read off the largest contour, since the
 * outermost one is always solid — so this holds for TrueType and CFF alike,
 * whose conventions are opposite.
 *
 * Then two rules build the pieces: a hole belongs to the smallest solid that
 * contains it, and two solids that touch or overlap are one piece, because
 * moulded material that meets is one part.
 */
export function groupPieces(contours: Contour[]): Piece[] {
  if (contours.length === 0) return []

  let biggest = contours[0]
  for (const c of contours) if (Math.abs(c.area) > Math.abs(biggest.area)) biggest = c
  const solidSign = Math.sign(biggest.area) || 1

  const boxes = contours.map((c) => bboxOf(c.points))
  for (const c of contours) c.kind = Math.sign(c.area) === solidSign ? 'solid' : 'hole'

  const set = new DisjointSet(contours.length)

  for (let i = 0; i < contours.length; i++) {
    for (let j = i + 1; j < contours.length; j++) {
      if (!rectsOverlap(boxes[i], boxes[j], 0)) continue

      const a = contours[i]
      const b = contours[j]
      const aInB = relate(a, b)
      const bInA = relate(b, a)

      // Touching or interpenetrating: one solid. A shared edge reads as
      // crossing from at least one side, which is the answer we want.
      if (aInB === 'crossing' || bInA === 'crossing') {
        set.union(i, j)
        continue
      }

      // A hole joins whatever solid encloses it. Nesting between two solids
      // means a shape sits in the counter of another (a dot inside an O), which
      // is a separate piece — leave them apart.
      if (aInB === 'nested' && a.kind === 'hole' && b.kind === 'solid') set.union(j, i)
      if (bInA === 'nested' && b.kind === 'hole' && a.kind === 'solid') set.union(i, j)
    }
  }

  const byRoot = new Map<number, Contour[]>()
  for (let i = 0; i < contours.length; i++) {
    const root = set.find(i)
    const list = byRoot.get(root)
    if (list) list.push(contours[i])
    else byRoot.set(root, [contours[i]])
  }

  const pieces: Piece[] = []
  for (const group of byRoot.values()) {
    const solids = group.filter((c) => c.kind === 'solid')
    const holes = group.filter((c) => c.kind === 'hole')
    // A hole with no solid around it is a misread winding, not a void.
    if (solids.length === 0) {
      for (const h of holes) h.kind = 'solid'
      solids.push(...holes)
      holes.length = 0
    }
    const ordered = [...solids, ...holes]
    pieces.push({ contours: ordered, bbox: bboxOf(solids.flatMap((c) => c.points)) })
  }

  // Reading order: down the lines, then across. Part numbers follow this.
  pieces.sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y)
  return pieces
}

/** SVG path data for one contour, in the font's own curves. */
export function contourPathData(contour: Contour): string {
  // The commands themselves are written out by `outlineData`, beside the `Seg`
  // type. The one thing that is this tool's own is the closing Z: a contour is
  // a ring, and a ring that is left open reads as filled from the wrong side.
  const data = outlineData(contour.commands)
  return data.endsWith('Z') ? data : `${data}Z`
}

/** One piece as a single path. Nonzero fill turns the holes into voids. */
export function piecePathData(piece: Piece): string {
  return piece.contours.map(contourPathData).join('')
}

export interface BoundaryHit {
  point: Vec2
  /** Outward-facing unit normal of the segment the point landed on. */
  normal: Vec2
  distance: number
}

/**
 * The closest point on a piece's outer boundary to `target`.
 *
 * Only solids are searched. A gate approaches from outside, so a landing inside
 * a counter would be a gate moulded into a hole — physically impossible.
 */
export function nearestOnPiece(piece: Piece, target: Vec2): BoundaryHit | null {
  let best: BoundaryHit | null = null

  for (const contour of piece.contours) {
    if (contour.kind !== 'solid') continue
    const pts = contour.points
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const ab = seg(a, b)
      const lengthSq = ab.x * ab.x + ab.y * ab.y
      if (lengthSq < 1e-12) continue

      const t = Math.max(
        0,
        Math.min(1, ((target.x - a.x) * ab.x + (target.y - a.y) * ab.y) / lengthSq),
      )
      const point = { x: a.x + ab.x * t, y: a.y + ab.y * t }
      const distance = Math.hypot(target.x - point.x, target.y - point.y)
      if (best && distance >= best.distance) continue

      // The winding tells us which side is outside, so the normal points away
      // from the material rather than into it.
      const length = Math.sqrt(lengthSq)
      const sign = contour.area >= 0 ? 1 : -1
      const normal = { x: (ab.y / length) * sign, y: (-ab.x / length) * sign }
      best = { point, normal, distance }
    }
  }

  return best
}
