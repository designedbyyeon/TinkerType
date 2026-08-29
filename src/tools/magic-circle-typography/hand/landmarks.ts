import type { Vec2 } from '../../../shared/geometry/vec'

/**
 * Reading a hand from twenty-one points.
 *
 * Nothing here touches a camera, a model or the DOM — it is arithmetic on a
 * list of points, which is the only reason the gesture can be tested at all. The
 * half that does talk to hardware is `tracker.ts`, and it hands its points
 * through here.
 *
 * Two coordinate systems arrive, and each answers a different question.
 *
 * - **Screen points**, already mapped through the video's cover fit, in stage
 *   pixels. Where the hand *is*: the palm's position, its size on screen, the
 *   angle it is rolled to. Pixels rather than the model's normalised 0..1
 *   because normalised x and y are divided by different numbers — a distance
 *   taken in that space is stretched by the frame's aspect ratio.
 * - **World points**, the model's own metric estimate with the origin at the
 *   hand's centre. Only openness reads these, and it is the right trade: a fist
 *   pushed at the lens is drastically foreshortened on screen but still a fist in
 *   three dimensions, and openness is the one measurement the whole tool turns on.
 */

export const WRIST = 0
export const INDEX_MCP = 5
export const INDEX_TIP = 8
export const MIDDLE_MCP = 9
export const MIDDLE_TIP = 12
export const RING_MCP = 13
export const RING_TIP = 16
export const PINKY_MCP = 17
export const PINKY_TIP = 20

/** A point with a depth that may or may not be there. */
export interface Point3 {
  x: number
  y: number
  z?: number
}

/**
 * Each finger's tip-to-wrist reach, in palm lengths, folded and straight.
 *
 * Measured in palm lengths — wrist to middle knuckle — so the numbers hold at
 * any distance from the lens and for any size of hand. The four fingers are not
 * interchangeable: a little finger at full stretch reaches barely further than a
 * middle finger half closed, so one shared threshold would read a flat hand as
 * three-quarters open and never get to the top of the range.
 *
 * The thumb is left out on purpose. It folds across the palm rather than into
 * it, so its reach barely changes between a fist and a flat hand — averaging it
 * in only flattens the signal the tool is built on.
 */
const FINGERS = [
  { tip: INDEX_TIP, closed: 1.02, open: 1.85 },
  { tip: MIDDLE_TIP, closed: 1.05, open: 2.05 },
  { tip: RING_TIP, closed: 1.0, open: 1.95 },
  { tip: PINKY_TIP, closed: 0.92, open: 1.58 },
]

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function gap(a: Point3, b: Point3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0))
}

/**
 * How far the hand is open: 0 a closed fist, 1 a flat hand.
 *
 * Scale-free by construction — every distance is divided by the palm's own
 * length — so it does not care how big the hand is or how far away. Rotation-free
 * too, when world points are passed: turning a flat hand does not close it.
 */
export function openness(points: Point3[]): number {
  if (points.length <= PINKY_TIP) return 0
  const palm = gap(points[WRIST], points[MIDDLE_MCP])
  if (palm < 1e-6) return 0

  let sum = 0
  for (const finger of FINGERS) {
    const reach = gap(points[WRIST], points[finger.tip]) / palm
    sum += clamp01((reach - finger.closed) / (finger.open - finger.closed))
  }
  return sum / FINGERS.length
}

export interface HandReading {
  /** Middle of the palm, in stage px. */
  palm: Vec2
  /** Wrist to middle knuckle, in stage px. The plate's scale reference. */
  span: number
  /** 0 fist, 1 flat hand. */
  openness: number
  /** Degrees. 0 is a hand held with the fingers up. */
  roll: number
}

/**
 * Read a hand.
 *
 * The palm is the mean of the wrist and the four knuckles rather than any single
 * landmark. A knuckle on its own jitters with the finger above it; the wrist
 * alone sits at the edge of the hand, so a plate centred there hangs off the
 * bottom of the palm instead of on it.
 */
export function readHand(screen: Vec2[], world?: Point3[]): HandReading | null {
  if (screen.length <= PINKY_TIP) return null

  const anchors = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP]
  let x = 0
  let y = 0
  for (const i of anchors) {
    x += screen[i].x
    y += screen[i].y
  }

  const span = gap(screen[WRIST], screen[MIDDLE_MCP])

  // The roll is read up the hand — wrist to middle knuckle — and zeroed so that
  // fingers-up is zero.
  //
  // Across the knuckles would seem the natural axis and is the wrong one: it
  // points one way for a right hand and the other for a left, so the plate would
  // arrive upside down depending on which hand you raised. Up the hand is the
  // same vector for both. It is a knuckle, not a fingertip, so it does not swing
  // as the fingers curl either — the plate must not spin while it blooms.
  const up = {
    x: screen[MIDDLE_MCP].x - screen[WRIST].x,
    y: screen[MIDDLE_MCP].y - screen[WRIST].y,
  }

  return {
    palm: { x: x / anchors.length, y: y / anchors.length },
    span,
    // World points when the model gave them, screen points otherwise. Falling
    // back rather than refusing keeps a hand read side-on from freezing the tool.
    openness: openness(world && world.length > PINKY_TIP ? world : screen),
    roll: (Math.atan2(up.y, up.x) * 180) / Math.PI + 90,
  }
}

/** Difference between two angles, in degrees, taken the short way round. */
export function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180
}

/**
 * Blend a new reading into the last one.
 *
 * The model's output moves by a pixel or two between frames even on a hand held
 * perfectly still, and a plate the size of a palm magnifies that into a visible
 * tremble. Openness gets the slowest coefficient of the three: it is the value a
 * designer performs with, and a jumpy one makes a written line flicker letters
 * on and off at the boundary.
 *
 * The roll is blended the short way round, so a hand crossing straight-up does
 * not send the plate the long way round the circle.
 */
export function smoothReading(
  previous: HandReading | null,
  next: HandReading,
  /** 0 keeps the old value, 1 takes the new one whole. */
  weight = { place: 0.4, span: 0.25, openness: 0.2, roll: 0.25 },
): HandReading {
  if (!previous) return next
  return {
    palm: {
      x: previous.palm.x + (next.palm.x - previous.palm.x) * weight.place,
      y: previous.palm.y + (next.palm.y - previous.palm.y) * weight.place,
    },
    span: previous.span + (next.span - previous.span) * weight.span,
    openness: previous.openness + (next.openness - previous.openness) * weight.openness,
    roll: previous.roll + angleDelta(previous.roll, next.roll) * weight.roll,
  }
}

/**
 * The word for what the hand is doing, for the read-out on the stage.
 *
 * Hysteresis, not one threshold. A single boundary sitting where a hand happens
 * to rest makes the label strobe, and a label that strobes is one a designer
 * stops trusting — the two edges are far enough apart that resting between them
 * simply keeps whatever it said last.
 */
export type Grip = 'fist' | 'opening' | 'open'

export function gripOf(openness: number, previous: Grip): Grip {
  if (openness > 0.78) return 'open'
  if (openness < 0.16) return 'fist'
  if (previous === 'open' && openness > 0.62) return 'open'
  if (previous === 'fist' && openness < 0.3) return 'fist'
  return 'opening'
}
