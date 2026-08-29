import type { Vec2 } from '../../../shared/geometry/vec'
import type { BandFace } from './ring'

/**
 * The plate: bands of type laid out from the rim inward, and whatever furniture
 * has been asked for.
 *
 * **The type is the plate.** Everything else — the rim, the rules between bands,
 * ticks, inner circles, a star, spokes — is off by default and switched on one
 * piece at a time. The name of the tool is a figure of speech; a pentagram
 * arriving unasked would make it the subject, and the subject is the sentence.
 *
 * Two rules run through all of it.
 *
 * **The rim is fixed and the courses stack inward.** The hand sets one number —
 * how far the plate reaches — and everything else is measured back from it. The
 * other way round (a core radius, bands growing outward) makes a long sentence
 * silently swell the plate off the frame, which is exactly the number the hand
 * was supposed to own.
 *
 * **Reading order is reveal order.** Whatever is at the rim draws first, then the
 * lines in the order they were typed, and the middle lands last. So opening a hand
 * writes the sentence outward and closes on the centre — with nothing switched on
 * that is exactly the three lines writing themselves in order, which is the whole
 * of what the tool does.
 */

export interface Segment {
  a: Vec2
  b: Vec2
}

export interface Course {
  /** 0..1 — how far this course has been drawn. */
  reveal: number
  /** Degrees. Courses turn into place; a circle cannot show it, the rest can. */
  spin: number
}

export interface Ring extends Course {
  r: number
}

export interface TextBand extends Course {
  text: string
  /** Baseline radius, px. */
  radius: number
  /** Drawn cap height for **this** band, px — see `taper`. */
  size: number
  face: BandFace
}

export interface Sigil {
  /** The plate's outer radius after bloom, px. */
  radius: number
  rings: Ring[]
  ticks: Course & { segments: Segment[] }
  spokes: Course & { segments: Segment[] }
  /** A star polygon can be several closed cycles — {6/2} is two triangles. */
  star: Course & { cycles: Vec2[][] }
  bands: TextBand[]
  /** Clear radius left in the middle, px. */
  core: number
  /** Lines the plate had no room for. */
  dropped: number
}

export interface SigilInput {
  /** Outer radius at full bloom, px. */
  radius: number
  /** 0..1 — a fist to a flat hand. */
  bloom: number
  /** Degrees. Where the whole plate is turned to. */
  spin: number
  /**
   * Where each line's run is centred, in degrees clockwise from twelve.
   *
   * One angle per line rather than one step applied to all of them, and the
   * reference photograph is the argument: its title and its detail are *both*
   * across the top, and only the date is at the bottom. No single step per band
   * produces that — a step of 90° walks the lines round like a spiral and a step
   * of 180° puts two of three back in the same place. Composing a ring of type
   * means putting each phrase where it belongs.
   *
   * Short arrays are fine: a line with no angle sits at twelve.
   */
  angles: number[]
  /** Drawn cap height of the outermost band, px. */
  size: number
  /**
   * What each band inward is worth against the one outside it.
   *
   * 1 sets every line at the same size. Below that the lines step down as they
   * go in, which is how a ring of type carries a hierarchy — a title, then the
   * detail under it — without anyone having to set three sizes by hand.
   */
  taper: number
  /** Gutter between courses, px. */
  gap: number
  /** One band per line, outermost first. */
  lines: string[]
  /**
   * Which side of its circle each band stands on. `alternate` flips band by
   * band, which is how a plate with more than one ring is usually drawn — the
   * two runs face each other across the rule between them.
   */
  face: 'out' | 'in' | 'alternate'
  /** The double rule around the outside, and the circles that bound the ticks. */
  rim: boolean
  /** A hairline closing each band. Off, the gutter is the only separation. */
  bandRules: boolean
  ticks: number
  /** Extra hairlines inside the innermost band. */
  ringCount: number
  starPoints: number
  starSkip: number
  spokes: number
}

/**
 * How much of the bloom is spent staggering the courses; what is left is each
 * course's own window. Named for the reveal to keep it clear of `stagger`, which
 * is an angle a designer sets.
 */
const REVEAL_STAGGER = 0.6
/**
 * Room reserved below each band's baseline, as a fraction of its cap height.
 *
 * Not an aesthetic margin — descenders. The letters stand with their feet on the
 * band, so a `p` or a `g` hangs into whatever is next, and it was **measured
 * doing it**: at the tool's own defaults the tails of one line met the caps of
 * the one under it at exactly the same radius. Roughly a quarter of the cap
 * height covers every face here. A line of capitals leaves the room empty, which
 * reads as a slightly wider gutter rather than as a mistake.
 */
const DESCENT = 0.26
/** How far a course is turned back before it settles, degrees. */
const SPIN_IN = 30
/** The plate does not start at nothing: a fist still has a palm's worth of width. */
const CLOSED_SCALE = 0.55
/** Nothing may be drawn closer to the middle than this fraction of the rim. */
const FLOOR = 0.14

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * The reveal window of course `index` of `count`.
 *
 * The windows are staggered but the **last one ends exactly on full bloom**, at
 * any count. Fixing the width instead leaves the plate finished at four fifths
 * of the way open on a three-course plate, so the last of the hand's travel does
 * nothing — and it is the part of the gesture a designer feels most.
 */
export function revealAt(index: number, count: number, bloom: number): number {
  if (count <= 0) return 0
  const step = REVEAL_STAGGER / count
  return clamp01((bloom - index * step) / (1 - step * (count - 1)))
}

/**
 * A star polygon {p/q} as closed cycles.
 *
 * When p and q share a factor the figure is not one path — {6/2} is the two
 * triangles of a hexagram, {9/3} is three. Returning the cycles separately is
 * what lets each be a closed subpath in the export instead of a single line
 * that doubles back on itself.
 */
export function starCycles(points: number, skip: number, r: number): Vec2[][] {
  const p = Math.round(points)
  if (p < 3 || r <= 0) return []
  const q = clampSkip(p, skip)

  const at = (k: number): Vec2 => {
    const a = (2 * Math.PI * (k % p)) / p
    return { x: r * Math.sin(a), y: -r * Math.cos(a) }
  }

  const cycles: Vec2[][] = []
  const seen = new Set<number>()
  for (let start = 0; start < p; start++) {
    if (seen.has(start)) continue
    const cycle: Vec2[] = []
    let k = start
    do {
      seen.add(k)
      cycle.push(at(k))
      k = (k + q) % p
    } while (k !== start)
    cycles.push(cycle)
  }
  return cycles
}

/**
 * A skip of p/2 or more retraces the same figure the other way round, and a skip
 * of p is p coincident points. So the useful range stops just short of half.
 */
export function clampSkip(points: number, skip: number): number {
  const limit = Math.max(1, Math.floor((points - 1) / 2))
  return Math.max(1, Math.min(limit, Math.round(skip)))
}

function radial(deg: number, from: number, to: number): Segment {
  const a = (deg * Math.PI) / 180
  const sin = Math.sin(a)
  const cos = -Math.cos(a)
  return { a: { x: from * sin, y: from * cos }, b: { x: to * sin, y: to * cos } }
}

/**
 * Lay the plate out.
 *
 * Everything is in plate coordinates with the middle at the origin, so the
 * renderer's only job is one translate. Courses are collected in reveal order
 * first and given their windows afterwards, because a window depends on how many
 * courses there turned out to be — which the text decides.
 */
export function buildSigil(input: SigilInput): Sigil {
  const bloom = clamp01(input.bloom)
  const R = Math.max(1, input.radius) * (CLOSED_SCALE + (1 - CLOSED_SCALE) * bloom)
  const gap = Math.max(0, input.gap)
  const size = Math.max(1, input.size)
  const floor = R * FLOOR

  // Course slots, filled in reveal order. The reveal itself is stamped on at
  // the end — a course cannot know its window until the count is settled.
  const rings: Ring[] = []
  const bands: TextBand[] = []
  const tickSegments: Segment[] = []
  const spokeSegments: Segment[] = []
  let cycles: Vec2[][] = []

  /** Which course each thing belongs to, by the order they were added. */
  const ringCourse: number[] = []
  const bandCourse: number[] = []
  let tickCourse = -1
  let spokeCourse = -1
  let starCourse = -1
  let courses = 0

  /*
   * 1 — the rim, when it has been asked for: a double rule, because a single
   * hairline at the edge of a plate reads as a crop mark and a pair reads as an
   * edge. Off by default. With nothing here the first band's outer edge is the
   * plate's own radius, and the type is the only thing at the rim.
   */
  let cursor = R
  let rimCourse = -1
  if (input.rim) {
    rimCourse = courses++
    rings.push({ r: R, reveal: 0, spin: 0 })
    ringCourse.push(rimCourse)
    if (R - gap * 0.55 > floor) {
      cursor = R - gap * 0.55
      rings.push({ r: cursor, reveal: 0, spin: 0 })
      ringCourse.push(rimCourse)
    }
  }

  // 2 — the tick band, hanging inward off whatever the outside edge is. Its
  // bounding circle belongs to the rim, so it appears only with the rim.
  if (input.ticks > 0) {
    const count = Math.round(input.ticks)
    const long = Math.min(size * 0.4, (cursor - floor) * 0.45)
    if (long > 0.5) {
      tickCourse = courses++
      // Every fifth tick longer, but only when five divides the count — a
      // stagger that does not come out even leaves a visible stumble at twelve
      // o'clock, which reads as a mistake rather than as a scale.
      const stagger = count % 5 === 0
      for (let k = 0; k < count; k++) {
        const length = !stagger || k % 5 === 0 ? long : long * 0.5
        tickSegments.push(radial((360 * k) / count, cursor, cursor - length))
      }
      cursor -= long
      if (input.rim) {
        rings.push({ r: cursor, reveal: 0, spin: 0 })
        ringCourse.push(tickCourse)
      }
    }
  }

  /*
   * 3 — the lines. The first one typed is the outermost, and each one inward is
   * `taper` times the size of the one outside it, so a title can sit over its own
   * detail without three sizes being set by hand. The gutter above the first band
   * is skipped when there is no rim: the type is then the edge, and an inset from
   * nothing is just a smaller plate.
   */
  const taper = Math.max(0.2, Math.min(1, input.taper))
  let dropped = 0
  for (let i = 0; i < input.lines.length; i++) {
    const bandSize = size * taper ** i
    // Caps plus descenders. Both faces spend the same, so flipping one does not
    // reflow the courses under it.
    const height = bandSize * (1 + DESCENT)
    const outer = i === 0 && !input.rim && input.ticks <= 0 ? cursor : cursor - gap
    if (outer - height < floor) {
      dropped = input.lines.length - i
      break
    }
    const face: BandFace =
      input.face === 'alternate' ? (i % 2 === 0 ? 'out' : 'in') : input.face
    /*
     * `out` stands its letters on the baseline with their caps reaching outward
     * and their tails hanging in; `in` is the same box flipped, so the tails hang
     * *out* and the baseline has to be inset by that much to keep them inside the
     * band. Either way the band occupies the same ring.
     */
    bands.push({
      text: input.lines[i],
      radius: face === 'out' ? outer - bandSize : outer - bandSize * DESCENT,
      size: bandSize,
      face,
      reveal: 0,
      spin: 0,
    })
    bandCourse.push(courses++)
    cursor = outer - height
    if (input.bandRules) {
      rings.push({ r: cursor, reveal: 0, spin: 0 })
      ringCourse.push(bandCourse[bandCourse.length - 1])
    }
  }

  // 4 — what is left in the middle.
  const core = Math.max(0, cursor - gap)

  if (core > floor * 0.5) {
    const extra = Math.round(input.ringCount)
    if (extra > 0) {
      const ringsCourse = courses++
      for (let k = 0; k < extra; k++) {
        // Stepped inward from just inside the core, and stopped well short of
        // the middle: a hairline circle at the centre is a dot, and a dot on a
        // plate reads as dirt rather than as drawing.
        rings.push({ r: core * (0.94 - (k * 0.72) / extra), reveal: 0, spin: 0 })
        ringCourse.push(ringsCourse)
      }
    }

    if (input.starPoints >= 3) {
      starCourse = courses++
      cycles = starCycles(input.starPoints, input.starSkip, core * 0.9)
    }

    if (input.spokes > 0) {
      spokeCourse = courses++
      const count = Math.round(input.spokes)
      for (let k = 0; k < count; k++) {
        spokeSegments.push(radial((360 * k) / count, core * 0.16, core))
      }
    }
  }

  // Windows, now that the count is known. Alternate courses turn in from
  // opposite directions, which is what makes a settling plate read as machinery
  // rather than as a fade.
  const stamp = (index: number): Course => {
    const reveal = revealAt(index, courses, bloom)
    return { reveal, spin: input.spin + (1 - reveal) * SPIN_IN * (index % 2 ? -1 : 1) }
  }

  rings.forEach((ring, i) => Object.assign(ring, stamp(ringCourse[i])))
  /*
   * Each band carries its own turn on top of the plate's. Three things add up in
   * that one number and they are all angles of the same kind: where the whole
   * plate is turned to, where this line was placed on it, and how far this course
   * is still turned back from where it settles.
   */
  bands.forEach((band, i) => {
    const course = stamp(bandCourse[i])
    Object.assign(band, course, { spin: course.spin + (input.angles[i] ?? 0) })
  })

  return {
    radius: R,
    rings,
    bands,
    ticks: { segments: tickSegments, ...stamp(tickCourse < 0 ? 0 : tickCourse) },
    spokes: { segments: spokeSegments, ...stamp(spokeCourse < 0 ? 0 : spokeCourse) },
    star: { cycles, ...stamp(starCourse < 0 ? 0 : starCourse) },
    core,
    dropped,
  }
}
