import { roundedRectRing } from '../../../shared/geometry/polygon'
import type { Rect, Vec2 } from '../../../shared/geometry/vec'
import type { Piece } from './glyphs'
import type { Bar, FramePlan, RunnerPlan, RunnerStyle } from './runner'

/**
 * The sheet as solid lumps — closed outlines, each with the depth its role
 * carries.
 *
 * This is the whole of the flat plan's translation into three dimensions, and it
 * is deliberately small — because in a real renderer almost nothing has to be
 * decided. The plan is already a set of closed outlines; a moulded sheet is those
 * outlines given a depth. What used to be in this file was an axonometric
 * projection that built the side walls itself, and every hard problem in it
 * existed only because there was no depth buffer: which faces are buried, which
 * walls face away, what order to paint in, where a merged ribbon folds back over
 * itself. All of that is what a renderer is for. Handing the outlines over
 * deletes six classes of bug at once, along with the file that held them.
 *
 * Two things survive from the flat drawing and both matter.
 *
 * **One flat back, three heights.** The sheet was moulded against a plate, so
 * every lump starts at z = 0 and rises by its own role's depth. The part stands
 * proud of the frame that carries it and the gate is left as a recess between
 * them — the notch you would put the snips into. That is not decoration: it is
 * the reason a gate reads as the thing to cut.
 *
 * **A lump is one solid, openings included.** The frame's wall is its outer ring
 * *and* its opening, together, or the extruder fills the middle in and the frame
 * becomes a slab. Same for a letter and its counters. Everything else on the
 * sheet — bars, bridges, gates, the tab — is a single ring on its own.
 */

/** What a lump is, which is what decides how thick it is. */
export type Role = 'part' | 'runner' | 'gate'

/**
 * What a lump is *called*, which is finer than its role.
 *
 * The frame, the bars inside it, the injection tab and the bridges between frames
 * are all moulded to the same depth in the same plastic, so as far as the
 * renderer is concerned they are one role. They are not one thing, though, and
 * the exported file says so: every body arrives named, and a designer opening the
 * model can pull `B-part-1` off `B-frame` instead of hunting through two hundred
 * anonymous objects.
 */
export type Kind = 'part' | 'gate' | 'frame' | 'bar' | 'tab' | 'bridge'

export const roleOf = (kind: Kind): Role =>
  kind === 'part' ? 'part' : kind === 'gate' ? 'gate' : 'runner'

export interface Depths {
  part: number
  runner: number
  gate: number
}

export interface Ring {
  points: Vec2[]
  /** An opening in this lump, not a solid of its own. */
  hole: boolean
}

export interface Lump {
  kind: Kind
  /** `roleOf(kind)`, carried along because the depth and the colour ask for it. */
  role: Role
  /** Solids and their openings. Together they are one closed body. */
  rings: Ring[]
  /** The frame it belongs to, which is how it takes its colour. */
  frame: number
  /**
   * The narrowest member this lump is known to have.
   *
   * Only the bevel reads it. A chamfer wider than half of what it is cutting
   * turns the profile inside out, and the neck of a gate is the thinnest thing
   * on the sheet by design — a couple of pixels, where the wall is twelve.
   */
  thin: number
}

/**
 * Depths as the mould can actually make them.
 *
 * A gate thicker than the runner feeding it would stand proud of its own frame,
 * and then the recess that says "cut here" is a ridge instead. Clamped rather
 * than hidden from the panel: the number stays where the designer left it, and
 * the drawing simply stops changing once it passes the runner.
 */
export function depthsOf(d: Depths): Depths {
  const part = Math.max(0, d.part)
  const runner = Math.max(0, d.runner)
  return { part, runner, gate: Math.max(0, Math.min(d.gate, runner)) }
}

/** The deepest anything on the sheet stands. */
export const frontOf = (d: Depths): number => Math.max(d.part, d.runner, d.gate)

const barLump = (bar: Bar, frame: number, kind: 'bar' | 'bridge'): Lump => ({
  kind,
  role: 'runner',
  rings: [{ points: bar.polygon, hole: false }],
  frame,
  thin: bar.thickness,
})

/**
 * The frame's wall as two rings.
 *
 * Rebuilt from points rather than parsed back out of `frame.wall`, which is path
 * data with real arcs in it. `roundedRectRing` is corner for corner with the path
 * version and a test in `runner.test.ts` holds the two against each other — the
 * one that caught the mirrored winding being a step out of phase.
 */
function wallRings(frame: FramePlan, style: RunnerStyle): Ring[] {
  const inner: Rect = {
    x: frame.rect.x + style.bar,
    y: frame.rect.y + style.bar,
    width: frame.rect.width - style.bar * 2,
    height: frame.rect.height - style.bar * 2,
  }
  const rings: Ring[] = [{ points: roundedRectRing(frame.rect, style.radius, true), hole: false }]
  if (inner.width > 0 && inner.height > 0) {
    rings.push({
      points: roundedRectRing(inner, style.radius - style.bar, false),
      hole: true,
    })
  }
  return rings
}

/** Every ring of a piece: its solids and its counters alike. */
const pieceRings = (piece: Piece): Ring[] =>
  piece.contours.map((c) => ({ points: c.points, hole: c.kind === 'hole' }))

/**
 * The whole sheet, decomposed.
 *
 * Order is not significant — there is a depth buffer now — so this is grouped
 * the way the sheet is built instead: what ties the frames together, then each
 * frame, then what each frame holds.
 */
export function lumpsOf(plan: RunnerPlan, style: RunnerStyle): Lump[] {
  const lumps: Lump[] = []

  // Bridges belong to no single frame, so they take the first one's colour —
  // the same rule the flat drawing follows.
  for (const bridge of plan.bridges) lumps.push(barLump(bridge, 0, 'bridge'))

  for (const frame of plan.frames) {
    lumps.push({
      kind: 'frame',
      role: 'runner',
      rings: wallRings(frame, style),
      frame: frame.colour,
      thin: style.bar,
    })

    if (frame.tab) {
      lumps.push({
        kind: 'tab',
        role: 'runner',
        rings: [{ points: frame.tab, hole: false }],
        frame: frame.colour,
        thin: style.bar,
      })
    }

    for (const bar of frame.lattice) lumps.push(barLump(bar, frame.colour, 'bar'))
    for (const bar of frame.spurs) lumps.push(barLump(bar, frame.colour, 'bar'))

    for (const part of frame.parts) {
      for (const piece of part.pieces) {
        /*
         * The gate keeps its buried end.
         *
         * `makeGate` starts the wide end a wall-thickness *inside* the runner so
         * that the flat drawing has no seam there, and the axonometric version
         * had to cut that end off again — displaced by parallax, it came out the
         * far side as a tab hanging off the frame. Here it is simply inside the
         * wall, which is thicker than it, so nothing shows. The clamp in
         * `depthsOf` is what guarantees that, and it is the only reason it can be
         * left alone.
         */
        for (const gate of piece.gates) {
          lumps.push({
            kind: 'gate',
            role: 'gate',
            rings: [{ points: gate.polygon, hole: false }],
            frame: frame.colour,
            thin: style.neckWidth,
          })
        }

        lumps.push({
          kind: 'part',
          role: 'part',
          rings: pieceRings(piece.piece),
          frame: frame.colour,
          // A letter's own narrowest stroke is not known here, and the mould
          // radius has already taken the spikes off it.
          thin: Infinity,
        })
      }
    }
  }

  return lumps
}
