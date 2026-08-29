import type { HandReading } from './landmarks'
import type { MagicDoc } from '../types'

/**
 * What the hand does to the document.
 *
 * The one place the gesture turns into numbers, kept pure and away from the
 * camera so it can be checked. It matters that this is a **patch on the document
 * rather than a second set of live values**: while the camera runs the renderer
 * draws `{ ...doc, ...patch }`, and the shutter writes the same patch into the
 * document for good. So there is exactly one description of where the plate is,
 * and freezing cannot land somewhere other than where you were looking.
 *
 * Bloom is not switchable. Openness driving the bloom *is* the tool — a switch
 * for it would be a switch for turning the tool off.
 */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function handPatch(
  reading: HandReading,
  view: { width: number; height: number },
  doc: Pick<MagicDoc, 'reach' | 'followHand' | 'followSpin'>,
): Partial<MagicDoc> {
  const patch: Partial<MagicDoc> = { bloom: clamp01(reading.openness) }

  if (doc.followHand) {
    // Stored as a fraction of the frame, like the document keeps it, so the
    // plate does not jump when the window changes size.
    patch.cx = clamp01(reading.palm.x / Math.max(1, view.width))
    patch.cy = clamp01(reading.palm.y / Math.max(1, view.height))
    // The palm's own length is the unit. Push your hand at the lens and the
    // plate grows with it, because a nearer hand measures longer.
    patch.radius = Math.max(24, reading.span * doc.reach)
  }

  if (doc.followSpin) patch.spin = reading.roll

  return patch
}
