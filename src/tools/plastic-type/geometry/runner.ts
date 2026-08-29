import type { Rect, Vec2 } from '../../../shared/geometry/vec'
import { clipHalfPlane } from '../../../shared/geometry/polygon'
import { bboxOf, nearestOnPiece, pointInPolygon, type Piece } from './glyphs'
import type { Frame, PlacedPart, Sheet } from './layout'

export interface RunnerStyle {
  /** Thickness of the outer wall. */
  bar: number
  /** Spur thickness as a fraction of the wall — branches are thinner. */
  spurRatio: number
  /** Gate width where it leaves the runner. */
  gateWidth: number
  /** Gate width where it meets the part. The narrow end is where you cut. */
  neckWidth: number
  /** Preferred ceiling on gate length. Past it, the runner grows a spur. */
  maxGate: number
  /** A piece longer than this along its major axis is held at both ends. */
  twoGateLength: number
  /** Outer corner radius of the frame. */
  radius: number
  /** Draw the injection tab on each frame. */
  tab: boolean
  /** Join neighbouring frames into one lattice with bridges. */
  bridges: boolean
  /** Divide a frame into cells with bars running between its parts. */
  lattice: boolean
}

export interface Gate {
  /** Trapezoid: wide at the runner, narrowed to the neck at the part. */
  polygon: Vec2[]
  from: Vec2
  to: Vec2
  length: number
}

export interface Bar {
  polygon: Vec2[]
  a: Vec2
  b: Vec2
  thickness: number
}

export interface PiecePlan {
  piece: Piece
  gates: Gate[]
  /**
   * The piece already meets the runner somewhere.
   *
   * Not the same as "needs no gate": a long piece can touch a wall at one end
   * and still want holding at the other, so this says only that contact exists.
   * The connectedness rule is `gates.length > 0 || touching`.
   */
  touching: boolean
}

export interface PartPlan {
  part: PlacedPart
  pieces: PiecePlan[]
}

export interface FramePlan {
  label: string
  rect: Rect
  /** The wall ring, as path data. Nonzero fill turns the inside into a void. */
  wall: string
  tab: Vec2[] | null
  /** Bars dividing the frame into one cell per part. */
  lattice: Bar[]
  spurs: Bar[]
  parts: PartPlan[]
  /** Index into the palette. */
  colour: number
  row: number
  column: number
}

export interface RunnerPlan {
  frames: FramePlan[]
  bridges: Bar[]
  bounds: Rect
}

/**
 * A line the runner can hang a gate from: a wall face, a cell bar, or a branch.
 *
 * `out` is the set of directions a new branch may leave in. Walls face inward;
 * a bar can be left from either side.
 */
interface Anchor {
  a: Vec2
  b: Vec2
  out: Vec2[]
  /**
   * How much material stands behind this line, in px.
   *
   * A gate is buried backwards into whatever it leaves from, so that the flat
   * drawing shows no seam at the join. **How far back is not a constant** — a
   * wall's face has the whole wall behind it, and a bar's line is its centre, so
   * it has only half a bar. Burying every gate by a wall's thickness pushed the
   * root of every bar-hung gate clean through the far side, where it hung in the
   * cell as a stub with nothing holding it. Measured on the default sheet: 8 of
   * 10 gates, up to 6px past the bar.
   */
  back: number
}

/** A bar becomes an anchor that a later branch can fork off. */
function barAnchor(bar: Bar): Anchor {
  const d = norm({ x: bar.b.x - bar.a.x, y: bar.b.y - bar.a.y })
  return {
    a: bar.a,
    b: bar.b,
    out: [{ x: -d.y, y: d.x }, { x: d.y, y: -d.x }],
    // `a`–`b` is the bar's centre line, so half of it is behind the join.
    back: bar.thickness / 2,
  }
}

interface Connection {
  /** On the anchor. */
  from: Vec2
  /** On the piece boundary. */
  to: Vec2
  /** How long the gate would be, measured to where a gate may actually hang. */
  distance: number
  /**
   * How far the piece really is from the runner, ignoring where a gate fits.
   *
   * The two differ by the margin, and both are needed: `distance` decides where
   * to put a gate, `contact` decides whether one is wanted at all. Asked through
   * the margin, a stroke resting on the wall a few pixels from a corner reads as
   * not touching — and the sheet grows a gate onto material it is already part
   * of. Carried on the same result rather than searched for twice, because the
   * search is the expensive half of this file.
   */
  contact: number
  anchor: Anchor
}

/** Below this, a piece already touches the runner and a gate would be a sliver. */
const TOUCHING = 1

const norm = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y)
  return l < 1e-9 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l }
}

/** Every solid boundary point of a piece — the only places a gate may land. */
function solidPoints(piece: Piece): Vec2[] {
  const out: Vec2[] = []
  for (const c of piece.contours) if (c.kind === 'solid') out.push(...c.points)
  return out
}

/**
 * Shortest line from an anchor to any of `points`.
 *
 * `margin` keeps the foot that far from either end of the anchor. A gate is a
 * shape, not a line: its wide end is `gateWidth` across, and a foot landing on
 * the last pixel of a cell bar hangs half that width off the end of it. Holding
 * the foot half a gate in from each end is what puts the whole wide end on the
 * member — and on an anchor too short to give that room, the middle is the best
 * there is.
 */
function closest(points: Vec2[], anchor: Anchor, margin = 0): Connection | null {
  const ab = { x: anchor.b.x - anchor.a.x, y: anchor.b.y - anchor.a.y }
  const lengthSq = ab.x * ab.x + ab.y * ab.y
  const length = Math.sqrt(lengthSq)
  const room = margin > 0 && length > margin * 2
  const lo = room ? margin / length : margin > 0 ? 0.5 : 0
  const hi = room ? 1 - margin / length : margin > 0 ? 0.5 : 1
  let best: Connection | null = null

  let contact = Infinity

  for (const p of points) {
    const along =
      lengthSq < 1e-12 ? 0 : ((p.x - anchor.a.x) * ab.x + (p.y - anchor.a.y) * ab.y) / lengthSq
    const free = Math.max(0, Math.min(1, along))
    const foot = { x: anchor.a.x + ab.x * free, y: anchor.a.y + ab.y * free }
    contact = Math.min(contact, Math.hypot(p.x - foot.x, p.y - foot.y))

    const t = Math.max(lo, Math.min(hi, along))
    const at = { x: anchor.a.x + ab.x * t, y: anchor.a.y + ab.y * t }
    const distance = Math.hypot(p.x - at.x, p.y - at.y)
    if (!best || distance < best.distance) best = { from: at, to: p, distance, contact, anchor }
  }

  if (best) best.contact = contact
  return best
}

/** Gap between two boxes along whichever axes separate them; 0 if they touch. */
function boxGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)))
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)))
  return Math.hypot(dx, dy)
}

const anchorBox = (anchor: Anchor): Rect => bboxOf([anchor.a, anchor.b])

/**
 * The shortest line from any anchor to these points.
 *
 * `box` is the points' own bounding box, and passing it turns the search from a
 * scan of every anchor into a scan of the nearby ones. Cell bars are what make
 * that matter: a frame holding a phrase can carry seventy of them, and a letter
 * at one end has no business being measured against a bar at the other. The box
 * gap is a true lower bound on any point-to-anchor distance, so nothing is lost
 * — the answer is identical, and the far anchors are simply never opened.
 */
function bestConnection(
  points: Vec2[],
  anchors: Anchor[],
  box?: Rect,
  margin = 0,
): Connection | null {
  if (!box || anchors.length < 8) {
    let best: Connection | null = null
    let contact = Infinity
    for (const anchor of anchors) {
      const hit = closest(points, anchor, margin)
      if (!hit) continue
      contact = Math.min(contact, hit.contact)
      if (!best || hit.distance < best.distance) best = hit
    }
    // The nearest the runner comes, over every anchor — not just the one the
    // gate would hang from.
    if (best) best.contact = contact
    return best
  }

  // Nearest boxes first, so the bound tightens as early as possible.
  const ranked = anchors
    .map((anchor) => ({ anchor, floor: boxGap(box, anchorBox(anchor)) }))
    .sort((a, b) => a.floor - b.floor)

  let best: Connection | null = null
  let contact = Infinity
  for (const { anchor, floor } of ranked) {
    if (best && floor >= best.distance) break
    const hit = closest(points, anchor, margin)
    if (!hit) continue
    contact = Math.min(contact, hit.contact)
    if (!best || hit.distance < best.distance) best = hit
  }
  if (best) best.contact = contact
  return best
}

/**
 * Build the gate.
 *
 * Not one wedge from the wall to the part — that reads as a cartoon of a gate.
 * A real one has two stages, and the reference photograph shows both: a long
 * shallow **taper** carrying the melt away from the runner, then a step down to a
 * short **parallel neck** right before the part. The neck is the whole point of
 * the shape. It is the thinnest section, it is the same width along its length,
 * and that is what makes the part snap off there rather than anywhere else.
 *
 * The taper does not run all the way down to the neck width; it stops part way
 * and steps. Smoothing that step out is what made the old single trapezoid look
 * so exaggerated: with nothing but a slope, the eye reads the whole length as
 * one fat wedge and there is no obvious place to cut.
 */
function makeGate(from: Vec2, to: Vec2, style: RunnerStyle, anchor: Anchor): Gate {
  const d = norm({ x: to.x - from.x, y: to.y - from.y })
  const p = { x: -d.y, y: d.x }

  // Buried into the member it leaves, so the wide end sits inside the runner
  // rather than on its face, and overshooting the part so no seam shows.
  // **How far back comes from the anchor, not from the wall thickness** — see
  // the note on `Anchor.back`.
  const back = anchor.back
  const root = { x: from.x - d.x * back, y: from.y - d.y * back }
  const tip = { x: to.x + d.x * 0.6, y: to.y + d.y * 0.6 }
  const span = Math.hypot(tip.x - root.x, tip.y - root.y)

  const wide = style.gateWidth / 2
  const thin = Math.min(style.neckWidth, style.gateWidth) / 2

  // The neck is short: enough to read as parallel-sided, never so long that the
  // part looks like it is on a stalk.
  const neck = Math.min(Math.max(style.gateWidth * 1.1, 3), span * 0.34)
  // The taper stops above the neck width, and the difference is taken as a step.
  const shoulder = thin + (wide - thin) * 0.42

  const along = (dist: number) => ({ x: root.x + d.x * dist, y: root.y + d.y * dist })
  const edge = (at: Vec2, half: number, sign: number) => ({
    x: at.x + p.x * half * sign,
    y: at.y + p.y * half * sign,
  })

  const taperEnd = along(Math.max(0, span - neck))

  const polygon = [
    edge(root, wide, 1),
    edge(taperEnd, shoulder, 1),
    edge(taperEnd, thin, 1),
    edge(tip, thin, 1),
    edge(tip, thin, -1),
    edge(taperEnd, thin, -1),
    edge(taperEnd, shoulder, -1),
    edge(root, wide, -1),
  ]

  return {
    /*
     * Trimmed at the far face of what it hangs from.
     *
     * Perpendicular to a wall or a bar the trim does nothing — the root already
     * lands on that face. **At an angle it is the whole difference:** the wide
     * end is `gateWidth` across, so when the gate leaves obliquely one of its
     * corners swings past the member's face and stands in open air. Measured on
     * a branch at the default settings, 3–4px of it. Burying deeper or moving
     * the foot only moves that corner; cutting the root against the face is
     * right at every angle, and it is also the seam a mould would leave.
     */
    polygon: trimToFace(polygon, from, d, anchor),
    from,
    to,
    length: Math.hypot(to.x - from.x, to.y - from.y),
  }
}

/** Cut everything behind the face of the member the gate leaves from. */
function trimToFace(polygon: Vec2[], from: Vec2, d: Vec2, anchor: Anchor): Vec2[] {
  if (anchor.back <= 0 || anchor.out.length === 0) return polygon

  // The side of the anchor the part is on — the gate leaves that way, so the
  // material behind it ends `back` in the other direction.
  let normal = anchor.out[0]
  for (const candidate of anchor.out) {
    if (candidate.x * d.x + candidate.y * d.y > normal.x * d.x + normal.y * d.y) normal = candidate
  }

  const origin = { x: from.x - normal.x * anchor.back, y: from.y - normal.y * anchor.back }
  const trimmed = clipHalfPlane(polygon, origin, normal)
  // A cut that leaves nothing is not a cut worth making.
  return trimmed.length >= 3 ? trimmed : polygon
}

/**
 * A bar, drawn half a thickness past each of its endpoints.
 *
 * `a`–`b` stays the centre line — that is what gates measure against — but the
 * material runs a little further, and it has to. A bar that stopped dead on its
 * endpoints would be a branch with a sawn-off tip, and a gate hung near that tip
 * puts the corner of its wide end past the end of the bar: measured, 3–4px of
 * plastic standing in air at the default settings. Extending the ends is also
 * what the thing being drawn does — a branch merges into the wall it leaves and
 * ends in a blunt stub, it does not stop on a plane.
 *
 * The extension is harmless everywhere it lands. A cell bar runs wall to wall, so
 * both ends bury themselves in the wall; a bridge buries itself in the two frames
 * it ties; a branch buries its root in the runner and moves its tip half a
 * thickness closer to the part, which is still well inside the clearance the
 * branch was grown with.
 */
function makeBar(a: Vec2, b: Vec2, thickness: number): Bar {
  const d = norm({ x: b.x - a.x, y: b.y - a.y })
  const p = { x: (-d.y * thickness) / 2, y: (d.x * thickness) / 2 }
  const cap = thickness / 2
  const from = { x: a.x - d.x * cap, y: a.y - d.y * cap }
  const to = { x: b.x + d.x * cap, y: b.y + d.y * cap }
  return {
    polygon: [
      { x: from.x + p.x, y: from.y + p.y },
      { x: to.x + p.x, y: to.y + p.y },
      { x: to.x - p.x, y: to.y - p.y },
      { x: from.x - p.x, y: from.y - p.y },
    ],
    a,
    b,
    thickness,
  }
}

function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 }
}

/**
 * Segment against an axis-aligned box, by the slab method: exact, and constant
 * time whatever the segment's length.
 *
 * It is the first pass in front of the outline test, so it runs once per bar per
 * part. Walking the segment instead cost a hundred samples every time and was
 * most of the work in a crowded frame — for an answer this test gives outright.
 */
function segmentHitsRect(a: Vec2, b: Vec2, r: Rect): boolean {
  const spans: [number, number, number, number][] = [
    [a.x, b.x - a.x, r.x, r.x + r.width],
    [a.y, b.y - a.y, r.y, r.y + r.height],
  ]

  let enter = 0
  let leave = 1

  for (const [from, delta, lo, hi] of spans) {
    if (Math.abs(delta) < 1e-12) {
      // Parallel to this pair of edges: either inside the slab or it misses.
      if (from < lo || from > hi) return false
      continue
    }
    const first = (lo - from) / delta
    const second = (hi - from) / delta
    enter = Math.max(enter, Math.min(first, second))
    leave = Math.min(leave, Math.max(first, second))
    if (enter > leave) return false
  }

  return true
}

/**
 * Whether a branch can run past a piece without touching it.
 *
 * Tested against the outline, not the bounding box. A box refuses a branch that
 * would slip cleanly between the arms of a ㅅ, and in a crowded frame nearly
 * every box overlaps something — so the coarse test starves the pieces that
 * need a branch most, which is the opposite of what it is for. The box is kept
 * only as a cheap first pass.
 */
function segmentClearsPiece(a: Vec2, b: Vec2, piece: Piece, clearance: number): boolean {
  if (!segmentHitsRect(a, b, inflate(piece.bbox, clearance))) return true

  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2))
  const solids = piece.contours.filter((c) => c.kind === 'solid')

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    const hit = nearestOnPiece(piece, p)
    if (hit && hit.distance < clearance) return false
    if (solids.some((c) => pointInPolygon(p, c.points))) return false
  }
  return true
}

/**
 * Grow a branch from the wall toward a piece no wall can reach.
 *
 * This is the line between "letters in a box" and a runner that would actually
 * work. The Bandai sprue and the spare-parts frame both show the frame detouring
 * inward to meet a part stranded in the middle; without it, an interior piece
 * would hang off a gate as long as the frame is wide, which no mould would
 * survive.
 *
 * The branch stops short of its target by half a gate so there is still a gate
 * to cut, and it refuses to run through another piece on the way.
 */
/** Start points along an anchor, so a branch is not stuck leaving at one spot. */
function sampleAnchor(anchor: Anchor, spacing: number): Vec2[] {
  const length = Math.hypot(anchor.b.x - anchor.a.x, anchor.b.y - anchor.a.y)
  const steps = Math.max(1, Math.min(80, Math.round(length / Math.max(1, spacing))))
  const out: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    out.push({
      x: anchor.a.x + (anchor.b.x - anchor.a.x) * t,
      y: anchor.a.y + (anchor.b.y - anchor.a.y) * t,
    })
  }
  return out
}

/**
 * How far a branch can travel from `start` along `dir` before it meets a part or
 * leaves the frame.
 *
 * Because the direction is axis-aligned, a box test is very nearly exact and
 * costs one comparison per part — no walking along the ray, no outline search.
 * That is what makes it affordable to try eighty start positions on every wall.
 */
function clearReach(start: Vec2, dir: Vec2, boxes: Rect[], inner: Rect): number {
  const vertical = dir.y !== 0
  let limit = vertical
    ? dir.y > 0
      ? inner.y + inner.height - start.y
      : start.y - inner.y
    : dir.x > 0
      ? inner.x + inner.width - start.x
      : start.x - inner.x

  for (const box of boxes) {
    if (vertical) {
      if (start.x < box.x || start.x > box.x + box.width) continue
      const d = dir.y > 0 ? box.y - start.y : start.y - (box.y + box.height)
      if (d < 0) return 0 // the start already sits inside this part's box
      limit = Math.min(limit, d)
    } else {
      if (start.y < box.y || start.y > box.y + box.height) continue
      const d = dir.x > 0 ? box.x - start.x : start.x - (box.x + box.width)
      if (d < 0) return 0
      limit = Math.min(limit, d)
    }
  }

  return Math.max(0, limit)
}

/**
 * Grow a branch toward a piece no wall can reach.
 *
 * This is the line between "letters in a box" and a runner that would actually
 * work. The Bandai sprue and the spare-parts frame both show the frame detouring
 * inward to meet a part stranded in the middle; without it an interior piece
 * would hang off a gate as long as the frame is wide, which no mould would
 * survive.
 *
 * Branches run square to the wall they leave, never at a slant. Aimed straight
 * at its target a branch reads as a stray line dropped on the drawing; squared
 * up, the same structure reads as a runner, and forking one branch off another
 * gives the right-angled skeleton the references have. What that costs in
 * freedom is bought back by trying many start positions along each wall — which
 * is how a branch finds the corridor beside 글's ㄱ instead of stopping on it.
 */
function growSpur(
  target: Vec2[],
  anchors: Anchor[],
  boxes: Rect[],
  inner: Rect,
  style: RunnerStyle,
): Bar | null {
  let best: { bar: Bar; gap: number } | null = null

  for (const anchor of anchors) {
    for (const dir of anchor.out) {
      for (const from of sampleAnchor(anchor, style.bar * 0.5)) {
        const limit = clearReach(from, dir, boxes, inner)
        if (limit < style.bar) continue

        const at = (r: number) => ({ x: from.x + dir.x * r, y: from.y + dir.y * r })

        // Run out as far as it can, see where a gate would land, then trim the
        // branch back to short of that point so there is still a gate to cut.
        // A probe line, not a real anchor: only its geometry is read here.
        const full = closest(target, { a: from, b: at(limit), out: [], back: 0 })
        if (!full) continue

        const along = (full.to.x - from.x) * dir.x + (full.to.y - from.y) * dir.y
        const reach = Math.max(style.bar, Math.min(limit, along - style.maxGate * 0.3))
        const hit = closest(target, { a: from, b: at(reach), out: [], back: 0 })
        if (!hit) continue

        if (!best || hit.distance < best.gap) {
          best = { bar: makeBar(from, at(reach), style.bar * style.spurRatio), gap: hit.distance }
        }
        // Nothing beats a gate already comfortably inside the limit.
        if (best.gap <= style.maxGate * 0.5) return best.bar
      }
    }
  }

  return best?.bar ?? null
}

/**
 * Split a piece's boundary into bands along its long axis.
 *
 * A long piece held at one point would pivot and warp, so real frames hold it
 * at both ends — the ladder in the spare-parts frame has a gate at each end of every
 * rail. Gating per band puts the gates apart by construction, rather than
 * letting two "nearest point" searches both land on the same corner.
 */
function bands(piece: Piece, count: number): Vec2[][] {
  const points = solidPoints(piece)
  if (count <= 1) return [points]

  const horizontal = piece.bbox.width >= piece.bbox.height
  const min = horizontal ? piece.bbox.x : piece.bbox.y
  const span = (horizontal ? piece.bbox.width : piece.bbox.height) || 1

  const out: Vec2[][] = Array.from({ length: count }, () => [])
  for (const p of points) {
    const t = ((horizontal ? p.x : p.y) - min) / span
    const index = Math.min(count - 1, Math.max(0, Math.floor(t * count)))
    out[index].push(p)
  }
  return out.filter((band) => band.length > 0)
}

function gateCount(piece: Piece, style: RunnerStyle): number {
  const major = Math.max(piece.bbox.width, piece.bbox.height)
  if (style.twoGateLength <= 0) return 1
  return Math.max(1, Math.min(3, Math.floor(major / style.twoGateLength) + 1))
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * A rounded rectangle, clockwise or counter-clockwise.
 *
 * The two windings are used together to build the wall as a ring, so the
 * reversed one has to be an exact mirror of the forward one: same corner points,
 * opposite order. Traversed backwards a rectangle starts on a corner arc rather
 * than on an edge, and getting that off by one turns each arc into a sweep
 * across a whole side — the hole stops being a hole and the frame fills in.
 */
export function roundedRectPath(r: Rect, radius: number, clockwise: boolean): string {
  const rad = Math.max(0, Math.min(radius, Math.min(r.width, r.height) / 2))
  const x0 = round(r.x)
  const y0 = round(r.y)
  const x1 = round(r.x + r.width)
  const y1 = round(r.y + r.height)
  const k = round(rad)
  const sweep = clockwise ? 1 : 0

  if (k <= 0) {
    return clockwise
      ? `M${x0} ${y0}L${x1} ${y0}L${x1} ${y1}L${x0} ${y1}Z`
      : `M${x0} ${y0}L${x0} ${y1}L${x1} ${y1}L${x1} ${y0}Z`
  }

  const arc = (x: number, y: number) => `A${k} ${k} 0 0 ${sweep} ${x} ${y}`
  return clockwise
    ? [
        `M${x0 + k} ${y0}`,
        `L${x1 - k} ${y0}`, arc(x1, y0 + k),
        `L${x1} ${y1 - k}`, arc(x1 - k, y1),
        `L${x0 + k} ${y1}`, arc(x0, y1 - k),
        `L${x0} ${y0 + k}`, arc(x0 + k, y0),
        'Z',
      ].join('')
    : [
        `M${x0 + k} ${y0}`,
        arc(x0, y0 + k), `L${x0} ${y1 - k}`,
        arc(x0 + k, y1), `L${x1 - k} ${y1}`,
        arc(x1, y1 - k), `L${x1} ${y0 + k}`,
        arc(x1 - k, y0), `L${x0 + k} ${y0}`,
        'Z',
      ].join('')
}

/** The wall as a ring: outer boundary one way, inner the other. */
function wallPath(rect: Rect, style: RunnerStyle): string {
  const inner = inflate(rect, -style.bar)
  if (inner.width <= 0 || inner.height <= 0) return roundedRectPath(rect, style.radius, true)
  return (
    roundedRectPath(rect, style.radius, true) +
    roundedRectPath(inner, style.radius - style.bar, false)
  )
}

/** The inside faces of the four walls, where gates begin. */
function wallAnchors(rect: Rect, style: RunnerStyle): Anchor[] {
  const i = inflate(rect, -style.bar)
  const x1 = i.x + i.width
  const y1 = i.y + i.height
  // These lines are the wall's *inner face*, so the whole wall is behind them.
  const back = style.bar
  return [
    { a: { x: i.x, y: i.y }, b: { x: x1, y: i.y }, out: [{ x: 0, y: 1 }], back },
    { a: { x: i.x, y: y1 }, b: { x: x1, y: y1 }, out: [{ x: 0, y: -1 }], back },
    { a: { x: i.x, y: i.y }, b: { x: i.x, y: y1 }, out: [{ x: 1, y: 0 }], back },
    { a: { x: x1, y: i.y }, b: { x: x1, y: y1 }, out: [{ x: -1, y: 0 }], back },
  ]
}

/**
 * Bars dividing a frame into one cell per part.
 *
 * The spare-parts frame is an outer frame with exactly this: internal bars cutting the
 * sheet into cells, so no part is ever far from something to hang off. In a
 * frame holding a whole phrase it is what a real parts frame would do, and it
 * beats letting the runner sprout a branch toward every stranded letter.
 *
 * The bars run down the gaps between parts, never across one. A gap too narrow
 * to take a bar with clearance is left alone, and any bar that would still
 * graze a letter is dropped rather than drawn through it.
 */
function latticeBars(frame: Frame, pieces: Piece[], style: RunnerStyle): Bar[] {
  if (frame.parts.length < 2) return []

  const inner = inflate(frame.rect, -style.bar)
  const top = inner.y
  const bottom = inner.y + inner.height
  const thickness = style.bar * style.spurRatio
  const clearance = style.bar * 0.6
  const bars: Bar[] = []

  for (let i = 0; i < frame.parts.length - 1; i++) {
    const left = frame.parts[i].bbox
    const right = frame.parts[i + 1].bbox
    const gapStart = left.x + left.width
    const gapEnd = right.x
    if (gapEnd - gapStart < thickness + clearance * 2) continue

    const x = (gapStart + gapEnd) / 2
    const a = { x, y: top }
    const b = { x, y: bottom }
    if (!pieces.every((piece) => segmentClearsPiece(a, b, piece, clearance))) continue
    bars.push(makeBar(a, b, thickness))
  }

  return bars
}

/**
 * The injection tab — the flap where the shot enters the runner.
 *
 * Small, and it reads as a detail rather than a shape of its own, but both
 * the syllable runners and the spare-parts frame both have one, and a frame without it looks like a
 * drawing of a runner rather than a runner.
 */
function injectionTab(rect: Rect, style: RunnerStyle): Vec2[] {
  // Kept small and pinned just past the corner. Sized off the wall it grows
  // from, it read as a hat on the frame rather than as the stub where the shot
  // goes in — on a real sprue the tab is barely wider than the runner itself.
  const width = Math.min(style.bar * 2.6, rect.width * 0.3)
  const height = style.bar * 1.4
  const x = rect.x + Math.min(style.radius + style.bar, Math.max(0, rect.width - width))
  const y = rect.y
  const taper = width * 0.22
  return [
    { x: x + taper, y: y - height },
    { x: x + width - taper, y: y - height },
    { x: x + width, y: y + style.bar },
    { x, y: y + style.bar },
  ]
}

/**
 * Plan every frame on the sheet: walls, branches, and a gate for each piece.
 *
 * The one rule that cannot bend is that every piece leaves here connected. A
 * gate longer than `maxGate` is a compromise; a piece with no gate is a part
 * that falls on the floor, so when a branch cannot be grown the gate is made
 * long rather than skipped.
 */
export function planRunner(sheet: Sheet, style: RunnerStyle): RunnerPlan {
  const frames: FramePlan[] = []

  sheet.frames.forEach((frame, index) => {
    const walls = wallAnchors(frame.rect, style)
    const anchors = [...walls]
    const spurs: Bar[] = []

    const allPieces = frame.parts.flatMap((part) => part.pieces)
    const lattice = style.lattice ? latticeBars(frame, allPieces, style) : []
    for (const bar of lattice) anchors.push(barAnchor(bar))
    const inner = inflate(frame.rect, -style.bar)

    /*
     * Branch until nothing is stranded.
     *
     * Each round finds the piece currently reached by the longest gate and
     * grows one branch for it, then looks again — a branch may fork off an
     * earlier branch, and one grown for a stranded piece often brings its
     * neighbours within reach too, so the picture has to be re-read after every
     * addition rather than decided once up front.
     *
     * A branch is only kept if it measurably shortens the gate it was grown
     * for. Without that check a blocked piece collects the same useless branch
     * every round.
     */
    const points = new Map<Piece, Vec2[]>()
    for (const piece of allPieces) points.set(piece, solidPoints(piece))

    /*
     * Each piece's shortest reach, kept up to date rather than recomputed.
     *
     * The loop below runs once per branch, and rescanning every piece against
     * every anchor each time is what turns a long sheet in a single frame from
     * milliseconds into tens of them. A new branch can only ever shorten a
     * reach, so testing just the branch that was added and taking the smaller
     * value gives the same answer for a fraction of the work.
     */
    // Half a gate: the same margin the gates themselves are placed with, so the
    // reach a branch is grown against is the reach a gate will really have.
    const margin = style.gateWidth / 2

    const reach = new Map<Piece, number>()
    for (const piece of allPieces) {
      const hit = bestConnection(points.get(piece) as Vec2[], anchors, piece.bbox, margin)
      reach.set(piece, hit ? hit.distance : Infinity)
    }

    const absorb = (anchor: Anchor) => {
      for (const piece of allPieces) {
        const hit = closest(points.get(piece) as Vec2[], anchor, margin)
        if (hit && hit.distance < (reach.get(piece) as number)) reach.set(piece, hit.distance)
      }
    }

    const done = new Set<Piece>()
    for (let round = 0; round < allPieces.length + 4; round++) {
      let worst: { piece: Piece; distance: number } | null = null

      for (const piece of allPieces) {
        if (done.has(piece)) continue
        const distance = reach.get(piece) as number
        if (distance <= style.maxGate) continue
        if (!worst || distance > worst.distance) worst = { piece, distance }
      }
      if (!worst) break

      const boxes = allPieces
        .filter((p) => p !== worst.piece)
        .map((p) => inflate(p.bbox, style.bar * 0.6))
      const spur = growSpur(points.get(worst.piece) as Vec2[], anchors, boxes, inner, style)
      if (!spur) {
        done.add(worst.piece)
        continue
      }

      // Only keep a branch that measurably shortens the gate it was grown for.
      // Without this check a boxed-in piece collects the same useless branch
      // every round.
      const anchor = barAnchor(spur)
      const gained = closest(points.get(worst.piece) as Vec2[], anchor, margin)
      if (!gained || gained.distance >= worst.distance - 0.5) {
        done.add(worst.piece)
        continue
      }

      anchors.push(anchor)
      spurs.push(spur)
      absorb(anchor)
    }

    const parts: PartPlan[] = frame.parts.map((part) => ({
      part,
      pieces: part.pieces.map((piece) => {
        const wanted = gateCount(piece, style)
        const gates: Gate[] = []

        for (const band of bands(piece, wanted)) {
          const hit = bestConnection(band, anchors, bboxOf(band), margin)
          if (!hit) continue
          // Already on the runner along this stretch: a gate would be a sliver
          // buried in solid material.
          if (hit.contact <= TOUCHING) continue
          // Two bands can still resolve to the same spot on a small piece.
          const dup = gates.some((g) => Math.hypot(g.to.x - hit.to.x, g.to.y - hit.to.y) < style.gateWidth)
          if (dup) continue
          gates.push(makeGate(hit.from, hit.to, style, hit.anchor))
        }

        const held = bestConnection(points.get(piece) as Vec2[], anchors, piece.bbox, margin)
        const touching = held !== null && held.contact <= TOUCHING

        // The invariant. A piece with neither a gate nor contact with the
        // runner would simply fall out, so it gets a gate at any length.
        if (gates.length === 0 && !touching && held) {
          gates.push(makeGate(held.from, held.to, style, held.anchor))
        }

        return { piece, gates, touching }
      }),
    }))

    frames.push({
      label: frame.label,
      rect: frame.rect,
      wall: wallPath(frame.rect, style),
      tab: style.tab ? injectionTab(frame.rect, style) : null,
      lattice,
      spurs,
      parts,
      colour: index,
      row: frame.row,
      column: frame.column,
    })
  })

  return { frames, bridges: style.bridges ? planBridges(frames, style) : [], bounds: sheet.bounds }
}

/**
 * Short bars joining neighbouring frames into one lattice.
 *
 * The bridged column is a grid of per-letter frames tied together this way, which is
 * what makes the sheet one object you could pick up rather than a row of
 * separate ones.
 */
function planBridges(frames: FramePlan[], style: RunnerStyle): Bar[] {
  const bars: Bar[] = []
  const thickness = style.bar * style.spurRatio

  const at = new Map<string, FramePlan>()
  for (const f of frames) at.set(`${f.row},${f.column}`, f)

  for (const f of frames) {
    const right = at.get(`${f.row},${f.column + 1}`)
    if (right) {
      const y = Math.max(f.rect.y, right.rect.y) + Math.min(f.rect.height, right.rect.height) / 2
      bars.push(makeBar({ x: f.rect.x + f.rect.width, y }, { x: right.rect.x, y }, thickness))
    }

    const below = at.get(`${f.row + 1},${f.column}`)
    if (below) {
      // Rows are ragged, so the frame below may not sit under this one at all.
      // A bridge only makes sense across the part they actually share.
      const left = Math.max(f.rect.x, below.rect.x)
      const right = Math.min(f.rect.x + f.rect.width, below.rect.x + below.rect.width)
      if (right - left > thickness) {
        const x = (left + right) / 2
        bars.push(makeBar({ x, y: f.rect.y + f.rect.height }, { x, y: below.rect.y }, thickness))
      }
    }
  }

  return bars.filter((b) => Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y) > 0.5)
}

export function polygonPath(points: Vec2[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return (
    `M${round(first.x)} ${round(first.y)}` +
    rest.map((p) => `L${round(p.x)} ${round(p.y)}`).join('') +
    'Z'
  )
}
