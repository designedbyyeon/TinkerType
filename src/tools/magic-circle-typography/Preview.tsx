import { useFace } from '../../shared/media/type/store'
import { DEFAULT_DOC } from './store'
import { SigilArt } from './render/SigilArt'
import { sigilFor, type MagicDoc } from './types'

/**
 * The index still, drawn by the real renderer rather than by a stored picture.
 *
 * Same plate layout, same outlines, same write-on — so the card cannot drift from
 * what the tool makes. No camera and no photograph: the card has to be the tool
 * at rest, and it is also the state a designer with no camera works in.
 *
 * The tool's own opening document at card scale — the same words, the same
 * composition, nothing else drawn. Which is the card's whole job: to say what this
 * makes. A card with a pentagram on it would advertise the wrong tool.
 *
 * Only the geometry is overridden, and every number is scaled by the same 0.773
 * the radius is, so the arcs come out at exactly the angles the tool's own do. A
 * size that is not scaled with the radius laps the lines round the card.
 *
 * The frame is square, which the tool's own stage never is. A round subject in a
 * landscape box fitted into a portrait card letterboxes twice over and the plate
 * ends up a coin in the middle of it; square, it fills whatever shape the card
 * happens to be.
 */
const DOC: MagicDoc = {
  ...DEFAULT_DOC,
  width: 520,
  height: 520,
  // The card's own ground, so all four index stills sit on one surface. A CSS
  // variable in a document field, which the artwork palette forbids — allowed
  // only because this document is never exported. Tool 03's card does the same.
  background: 'var(--paper-sunk)',
  radius: 232,
  size: 36,
  gap: 6,
}

/** Nothing about the card moves, so its plate is laid out once at import. */
const SIGIL = sigilFor(DOC)

export function Preview() {
  const { face } = useFace(DOC.face)

  // Until the outlines arrive the card shows its own ground, which reads as
  // still loading rather than as broken.
  return (
    <svg
      viewBox={`0 0 ${DOC.width} ${DOC.height}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={DOC.width} height={DOC.height} fill={DOC.background} />
      {face && <SigilArt doc={DOC} sigil={SIGIL} face={face} />}
    </svg>
  )
}
