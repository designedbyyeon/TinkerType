import type { FaceId } from '../../shared/media/type/faces'
import type { PartUnit, RunnerUnit } from './geometry/hangul'
import type { LayoutStyle } from './geometry/layout'
import type { RunnerStyle } from './geometry/runner'
import { depthsOf, type Depths } from './geometry/solid'

export type { FaceId, PartUnit, RunnerUnit }

/** How the sheet is coloured. */
export type ColourMode = 'mono' | 'cycle'

export interface PlasticDoc {
  width: number
  height: number
  background: string

  text: string
  face: FaceId
  /** Weight axis. Mass is what lets a gate read as thinner than its part. */
  wght: number
  /** Width axis. Ignored by faces that do not have one. */
  wdth: number
  /** What becomes one part slot. */
  partUnit: PartUnit
  /** What becomes one frame. */
  runnerUnit: RunnerUnit

  /** Drawn letter height, px. */
  size: number
  /** Extra space between parts inside a frame, px. */
  tracking: number
  /** Frames per row. 0 keeps the sheet on one row. */
  perRow: number
  /** Multiplier on the fitted size, so the sheet can bleed off the page. */
  zoom: number

  /** 0 loose, 1 tight. Moves the frame proportions together. */
  density: number

  /** Wall thickness, px. */
  wall: number
  /** Gate width where it leaves the runner, px. */
  gate: number
  /** Gate width at the part — where you cut, px. */
  neck: number
  /** Frame corner radius, px. */
  corner: number
  /** Mould radius on the letters themselves, px. 0 leaves them as drawn. */
  round: number

  lattice: boolean
  tab: boolean
  joined: boolean
  plates: boolean

  /**
   * The drawing, or the object it describes.
   *
   * One tool, two forms. Everything above this line means the same thing in
   * both — the same sheet, the same gates, the same plan — once as flat artwork
   * that leaves as an editable SVG, and once as a moulded solid that leaves as a
   * model. Choosing between them is choosing what the file is for, not redrawing
   * anything.
   */
  solid: boolean
  /**
   * How far each role stands off the sheet's flat back, px of artwork.
   *
   * Three numbers rather than one, and that is the point of them: a part carries
   * the most material, the runner that feeds it less, the gate least of all —
   * because the gate is the bit you are meant to snip.
   */
  partDepth: number
  runnerDepth: number
  gateDepth: number
  /** Chamfer on every moulded edge, px. Where the light catches. */
  bevel: number
  /** 0 matte, 1 glossy. Nothing else says "plastic" as quickly. */
  gloss: number

  colourMode: ColourMode
  runnerColour: string
  partColour: string
  palette: string[]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * The density control, unpacked.
 *
 * One slider moves four dimensions together, because they are not independent
 * in a real frame: pull the parts closer to the walls and the gaps between
 * frames close with them, gates get shorter, and a part that used to be held at
 * one point starts needing two. Four separate sliders would let a designer build
 * combinations that no mould would produce, and would bury the one thing they
 * actually want to say — how tightly packed this sheet is.
 *
 * Gate and wall thickness stay out of it. Those are the shape of the runner
 * rather than its packing, and the designer judges them by eye against the
 * stroke weight of the letters.
 */
export function stylesFor(
  doc: PlasticDoc,
  /** Solved from the face's measured reference height — see `applyAxes`. */
  fontSize: number,
): { layout: LayoutStyle; runner: RunnerStyle } {
  const t = Math.max(0, Math.min(1, doc.density))

  // Clear space from the ink to the outside of the wall. Read off the reference
  // poster, where the letters sit with real air around them rather than pressed
  // against the frame.
  const inset = doc.size * lerp(0.46, 0.16, t)

  return {
    layout: {
      fontSize,
      tracking: doc.tracking,
      inset,
      gap: doc.size * lerp(0.22, 0.06, t),
      perRow: doc.perRow,
      // Tied frames form one lattice, which can only line up if the cells share
      // edges. Separate runners are each cut close around their own content.
      uniformHeight: doc.joined,
      tolerance: 0.35,
      round: doc.round,
    },
    runner: {
      bar: doc.wall,
      spurRatio: 0.9,
      gateWidth: doc.gate,
      neckWidth: Math.min(doc.neck, doc.gate),
      /*
       * Derived from the inset, not from density on its own.
       *
       * In a frame holding one letter the gate length *is* the inset — that is
       * the distance from the wall to the part. Set independently, the two drift
       * apart, and the moment the ceiling falls below the clearance every frame
       * starts sprouting branches to cross a gap a plain gate should have
       * covered. Tying them means a branch appears only when a piece is genuinely
       * further away than the wall clearance, which is the case it is for.
       */
      maxGate: inset * 1.35,
      twoGateLength: doc.size * lerp(1.2, 0.55, t),
      radius: doc.corner,
      tab: doc.tab,
      bridges: doc.joined,
      lattice: doc.lattice,
    },
  }
}

/**
 * The three depths, as the mould can actually make them.
 *
 * The clamp itself lives in `geometry/solid.ts`, beside the thing it protects.
 * This is only the door the document comes in through, so that no renderer has to
 * remember to ask.
 */
export const depthsFor = (doc: PlasticDoc): Depths =>
  depthsOf({ part: doc.partDepth, runner: doc.runnerDepth, gate: doc.gateDepth })

/** Runner letters, the way a kit labels them: A, B, … Z, AA. */
export function runnerLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}
