import { isSyllable } from '../../../shared/text/hangul'
import type { BeatDoc, Lane } from '../types'

/**
 * The bar, as lanes of steps.
 *
 * **Nothing here parses text.** An earlier version read the sequence out of a
 * `textarea`, which made a tidy story — a line of Hangul is a bar of drums — and
 * the wrong instrument: you built a beat by typing it. The discs were reduced to
 * an editor for whatever the cursor was sitting on.
 *
 * So the model is a drum machine's: **one lane per syllable, one column per
 * step.** You dial a sound on the three wheels and tap it into the bar. A lane is
 * named by its own syllable because the syllable is the entire description of the
 * sound — 초성 the attack, 중성 the body, 종성 the release — so there is no channel
 * strip to name separately.
 *
 * The type did not go anywhere. It moved from a field into the machine: the lane
 * headers, the read-out and the letters on the wheels are all set in the face.
 */

/** How many lanes can sound at once. */
export const MAX_LANES = 8
/** Bar lengths worth having. Eight is a half bar of sixteenths, 32 is two. */
export const STEP_COUNTS = [8, 16, 32]

/** A lane's steps, resized to the bar without losing what is inside it. */
export function fitSteps(steps: boolean[], count: number): boolean[] {
  if (steps.length === count) return steps
  // Growing keeps what was there and leaves the new tail empty; shrinking drops
  // the tail. Rescaling instead would move every hit the designer placed.
  const out = new Array<boolean>(count).fill(false)
  for (let i = 0; i < Math.min(count, steps.length); i++) out[i] = steps[i]
  return out
}

export function emptyLane(syllable: string, count: number): Lane {
  return { syllable, steps: new Array<boolean>(count).fill(false), level: 1 }
}

/**
 * A lane's level, clamped.
 *
 * Read through this everywhere rather than off the field, so a document from
 * before lanes had levels — an undo snapshot, say — plays at full rather than
 * silently at nothing.
 */
export function levelOf(lane: Pick<Lane, 'level'>): number {
  const raw = lane.level
  return typeof raw === 'number' && isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1
}

/** Set one lane's level. */
export function setLevel(lanes: Lane[], syllable: string, level: number): Lane[] {
  return lanes.map((l) =>
    l.syllable === syllable ? { ...l, level: Math.min(1, Math.max(0, level)) } : l,
  )
}

export function laneIndex(doc: BeatDoc, syllable: string): number {
  return doc.lanes.findIndex((l) => l.syllable === syllable)
}

/**
 * Turn one step on or off, creating the lane if this is its first hit.
 *
 * Which is the whole editing gesture of the tool. A lane appears when a sound is
 * first placed rather than when it is dialled, because dialling through a wheel
 * of nineteen initials would otherwise leave nineteen empty rows behind it.
 */
export function toggleStep(doc: BeatDoc, syllable: string, step: number): Lane[] {
  if (!isSyllable(syllable) || step < 0 || step >= doc.steps) return doc.lanes

  const at = laneIndex(doc, syllable)
  if (at < 0) {
    if (doc.lanes.length >= MAX_LANES) return doc.lanes
    const lane = emptyLane(syllable, doc.steps)
    lane.steps[step] = true
    return [...doc.lanes, lane]
  }

  const lanes = doc.lanes.map((l) => ({ ...l, steps: [...l.steps] }))
  lanes[at].steps[step] = !lanes[at].steps[step]
  /*
   * A lane emptied of its last hit is dropped.
   *
   * Otherwise the grid fills with rows that do nothing, and the designer has to
   * tidy up after their own undoing. The sound is not lost — it is still on the
   * wheels, and tapping any step brings the row straight back.
   */
  if (!lanes[at].steps.some(Boolean)) lanes.splice(at, 1)
  return lanes
}

/** Every lane's steps resized at once, for when the bar length changes. */
export function fitLanes(lanes: Lane[], count: number): Lane[] {
  return lanes.map((l) => ({ ...l, steps: fitSteps(l.steps, count) }))
}

/** Clear one lane out of the grid. */
export function removeLane(lanes: Lane[], syllable: string): Lane[] {
  return lanes.filter((l) => l.syllable !== syllable)
}

/**
 * What sounds on a given step, and how loud. What the scheduler asks for.
 *
 * A lane at zero is dropped here rather than booked at zero gain, so a muted lane
 * costs nothing at all — no oscillator, no envelope, and nothing in the render.
 */
export function hitsAt(doc: BeatDoc, step: number): Array<{ syllable: string; level: number }> {
  const local = ((step % doc.steps) + doc.steps) % doc.steps
  const out: Array<{ syllable: string; level: number }> = []
  for (const lane of doc.lanes) {
    if (!lane.steps[local]) continue
    const level = levelOf(lane)
    if (level > 0) out.push({ syllable: lane.syllable, level })
  }
  return out
}

/**
 * Whether anything at all is placed. Export and the transport both need this.
 *
 * A muted lane still counts as placed — the bar is written, it is just not being
 * heard right now, and an Export that refused because everything happened to be
 * turned down would be answering a question nobody asked.
 */
export function isEmpty(doc: BeatDoc): boolean {
  return !doc.lanes.some((l) => l.steps.some(Boolean))
}
