import { describe, expect, it } from 'vitest'
import {
  angleDelta,
  gripOf,
  openness,
  readHand,
  smoothReading,
  type Grip,
  type HandReading,
  type Point3,
} from './landmarks'
import { handPatch } from './drive'

/**
 * The gesture, checked without a camera.
 *
 * There is no recorded hand to compare against here, so the tests check the
 * things that have to be true of *any* hand rather than the exact number a
 * particular one produces: closing the fingers lowers openness and never raises
 * it, the reading does not change when the same hand is moved, turned or held
 * closer, and a fist reads near zero while a flat hand reads near one.
 *
 * Those invariants are what the tool actually rests on. A calibrated number
 * would be a number for one person's hand.
 */

/**
 * A synthetic hand, posed.
 *
 * Twenty-one points laid out the way MediaPipe indexes them: the wrist, then
 * four chains of four from thumb to little finger. `curl` folds the fingers into
 * the palm — 0 flat, 1 a fist — by swinging each bone back toward the wrist, so
 * the fingertips end up *on* the palm rather than shortened in place. That is the
 * distinction that matters: a fist is a hand whose tips have come back, and
 * scaling a flat hand down would not test anything.
 */
function hand(curl: number, at = { x: 0, y: 0 }, size = 1, turn = 0): Point3[] {
  const points: Point3[] = []
  const push = (x: number, y: number) => {
    const a = (turn * Math.PI) / 180
    points.push({
      x: at.x + (x * Math.cos(a) - y * Math.sin(a)) * size,
      y: at.y + (x * Math.sin(a) + y * Math.cos(a)) * size,
      z: 0,
    })
  }

  // The wrist at the origin, the hand running up the screen (negative y).
  push(0, 0)

  // Knuckle line across the top of the palm, one palm length up.
  const knuckles = [
    { x: -0.42, y: -0.42, bones: [0.3, 0.24, 0.2], lie: -55 },
    { x: -0.2, y: -1.0, bones: [0.42, 0.3, 0.22], lie: 0 },
    { x: 0.0, y: -1.0, bones: [0.46, 0.32, 0.24], lie: 0 },
    { x: 0.2, y: -0.98, bones: [0.4, 0.3, 0.22], lie: 6 },
    { x: 0.38, y: -0.9, bones: [0.3, 0.22, 0.18], lie: 14 },
  ]

  for (const finger of knuckles) {
    push(finger.x, finger.y)
    let x = finger.x
    let y = finger.y
    let heading = finger.lie
    for (const bone of finger.bones) {
      // Each joint bends by the same amount, which is what a curling finger
      // does — three bends of 60° bring the tip back to the palm.
      heading += curl * 62
      const a = ((heading - 90) * Math.PI) / 180
      x += Math.cos(a) * bone
      y += Math.sin(a) * bone
      push(x, y)
    }
  }

  return points
}

const flat = () => hand(0)
const fist = () => hand(1)

describe('openness', () => {
  it('reads a flat hand as open and a fist as closed', () => {
    expect(openness(flat())).toBeGreaterThan(0.9)
    expect(openness(fist())).toBeLessThan(0.1)
  })

  it('never goes up as the fingers come in', () => {
    let previous = Infinity
    for (let curl = 0; curl <= 1.001; curl += 0.05) {
      const value = openness(hand(curl))
      expect(value).toBeLessThanOrEqual(previous + 1e-9)
      previous = value
    }
  })

  it('does not care where the hand is, how big it is, or which way up', () => {
    // Which is the whole reason it is measured in palm lengths. A hand nearer
    // the lens is a bigger hand, not a more open one.
    const base = openness(flat())
    expect(openness(hand(0, { x: 400, y: -220 }))).toBeCloseTo(base, 9)
    expect(openness(hand(0, { x: 0, y: 0 }, 4.5))).toBeCloseTo(base, 9)
    expect(openness(hand(0, { x: 30, y: 12 }, 0.3, 137))).toBeCloseTo(base, 9)
  })

  it('has nothing to say about a truncated point list', () => {
    expect(openness([])).toBe(0)
    expect(openness(flat().slice(0, 12))).toBe(0)
  })
})

describe('reading a hand', () => {
  it('puts the palm inside the knuckle line, not out at the wrist', () => {
    const reading = readHand(flat())!
    expect(reading.palm.y).toBeLessThan(-0.2)
    expect(reading.palm.y).toBeGreaterThan(-1)
    expect(Math.abs(reading.palm.x)).toBeLessThan(0.25)
  })

  it('measures the span as the palm’s own length, so nearer is bigger', () => {
    expect(readHand(hand(0, { x: 0, y: 0 }, 1))!.span).toBeCloseTo(1, 6)
    expect(readHand(hand(0, { x: 0, y: 0 }, 3))!.span).toBeCloseTo(3, 6)
    // And curling the fingers does not change it — a fist is the same palm.
    expect(readHand(fist())!.span).toBeCloseTo(readHand(flat())!.span, 6)
  })

  it('calls a hand held fingers-up zero, and follows it round', () => {
    expect(readHand(flat())!.roll).toBeCloseTo(0, 6)
    for (const turn of [-40, 25, 90]) {
      expect(readHand(hand(0, { x: 0, y: 0 }, 1, turn))!.roll).toBeCloseTo(turn, 6)
    }
  })

  it('does not spin as the fingers close', () => {
    // Read across the knuckles instead of up the hand, this would swing with
    // every curl and the plate would turn while it bloomed.
    for (const curl of [0, 0.3, 0.6, 1]) {
      expect(readHand(hand(curl))!.roll).toBeCloseTo(0, 4)
    }
  })

  it('refuses a point list that is not a whole hand', () => {
    expect(readHand([])).toBeNull()
    expect(readHand(flat().slice(0, 20))).toBeNull()
  })
})

describe('angles', () => {
  it('always takes the short way round', () => {
    expect(angleDelta(170, -170)).toBeCloseTo(20, 9)
    expect(angleDelta(-170, 170)).toBeCloseTo(-20, 9)
    expect(angleDelta(0, 90)).toBeCloseTo(90, 9)
    expect(Math.abs(angleDelta(0, 180))).toBeCloseTo(180, 9)
  })

  it('never sends a plate the long way round as a hand crosses upright', () => {
    const before: HandReading = { palm: { x: 0, y: 0 }, span: 1, openness: 1, roll: 179 }
    const after: HandReading = { ...before, roll: -179 }
    const blended = smoothReading(before, after)
    // Blended naively this lands near zero — the plate whipping half a turn.
    expect(Math.abs(angleDelta(179, blended.roll))).toBeLessThan(2)
  })
})

describe('smoothing', () => {
  it('takes the first reading whole and eases into the ones after', () => {
    const first: HandReading = { palm: { x: 10, y: 20 }, span: 5, openness: 0.5, roll: 0 }
    expect(smoothReading(null, first)).toBe(first)

    const next: HandReading = { palm: { x: 110, y: 20 }, span: 5, openness: 1, roll: 0 }
    const blended = smoothReading(first, next)
    expect(blended.palm.x).toBeGreaterThan(10)
    expect(blended.palm.x).toBeLessThan(110)
    expect(blended.openness).toBeLessThan(1)
  })

  it('settles on a held value rather than creeping past it', () => {
    let reading: HandReading = { palm: { x: 0, y: 0 }, span: 1, openness: 0, roll: 0 }
    const target: HandReading = { palm: { x: 100, y: 50 }, span: 3, openness: 1, roll: 40 }
    for (let i = 0; i < 200; i++) reading = smoothReading(reading, target)
    expect(reading.palm.x).toBeCloseTo(100, 3)
    expect(reading.openness).toBeCloseTo(1, 3)
    expect(reading.roll).toBeCloseTo(40, 3)
  })
})

describe('the grip read-out', () => {
  it('does not strobe while a hand rests on the boundary', () => {
    // The reason for two edges rather than one. A label that flickers is one a
    // designer stops reading.
    let grip: Grip = 'open'
    for (const value of [0.7, 0.66, 0.72, 0.68, 0.7]) grip = gripOf(value, grip)
    expect(grip).toBe('open')

    grip = 'fist'
    for (const value of [0.2, 0.28, 0.22, 0.25]) grip = gripOf(value, grip)
    expect(grip).toBe('fist')
  })

  it('names the extremes whatever it said last', () => {
    for (const previous of ['fist', 'opening', 'open'] as Grip[]) {
      expect(gripOf(1, previous)).toBe('open')
      expect(gripOf(0, previous)).toBe('fist')
    }
  })
})

describe('what the hand does to the document', () => {
  const view = { width: 1200, height: 800 }
  const doc = { reach: 3, followHand: true, followSpin: true }
  const reading: HandReading = { palm: { x: 300, y: 200 }, span: 90, openness: 0.6, roll: 25 }

  it('turns the palm into a fraction of the frame, so a resize keeps it', () => {
    const patch = handPatch(reading, view, doc)
    expect(patch.cx).toBeCloseTo(0.25, 9)
    expect(patch.cy).toBeCloseTo(0.25, 9)
  })

  it('measures the plate in palm lengths', () => {
    expect(handPatch(reading, view, doc).radius).toBeCloseTo(270, 9)
    expect(handPatch(reading, view, { ...doc, reach: 5 }).radius).toBeCloseTo(450, 9)
  })

  it('leaves out what its switch turned off, and never leaves out the bloom', () => {
    const bloomOnly = handPatch(reading, view, { ...doc, followHand: false, followSpin: false })
    expect(Object.keys(bloomOnly)).toEqual(['bloom'])
    expect(bloomOnly.bloom).toBeCloseTo(0.6, 9)

    const noSpin = handPatch(reading, view, { ...doc, followSpin: false })
    expect(noSpin.spin).toBeUndefined()
    expect(noSpin.radius).toBeDefined()
  })

  it('keeps the plate on the frame however far the hand goes', () => {
    const off: HandReading = { ...reading, palm: { x: -400, y: 3000 } }
    const patch = handPatch(off, view, doc)
    expect(patch.cx).toBe(0)
    expect(patch.cy).toBe(1)
  })
})
