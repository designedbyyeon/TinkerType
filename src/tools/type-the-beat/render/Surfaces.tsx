import type { BeatDoc } from '../types'
import { IDS } from './surfaceIds'

/**
 * The machine's surface treatment, defined once.
 *
 * Everything here is **shading, not colour**: overlays of `ink` and of the ground
 * at low opacity, laid over whatever `Paint` has set underneath. So a designer can
 * take the disc near-black or the panel to paper and the shading still runs the
 * same way, which a set of hard-coded greys would not survive.
 *
 * **There is very little of it, and that is the second draft.** A pass with lit
 * discs, rolled rims, drop shadows and a knurled specular barrel read as rendered
 * hardware — the reference is a printed instrument, and the letters were losing to
 * the lighting. What is left is the two places depth actually says something: the
 * ends of the slide, where the list runs off round something, and the track the
 * steps sit in.
 */

export function Surfaces({ doc }: { doc: BeatDoc }) {
  return (
    <defs>
      {/* The slide's ends, curving away. */}
      <linearGradient id={IDS.barrelEnds} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={doc.disc} stopOpacity={0.95} />
        <stop offset="14%" stopColor={doc.disc} stopOpacity={0} />
        <stop offset="86%" stopColor={doc.disc} stopOpacity={0} />
        <stop offset="100%" stopColor={doc.disc} stopOpacity={0.95} />
      </linearGradient>

      {/* A milled well: the track the steps sit in, shadowed under its top edge. */}
      <linearGradient id={IDS.well} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={doc.ink} stopOpacity={0.07} />
        <stop offset="16%" stopColor={doc.ink} stopOpacity={0.02} />
        <stop offset="100%" stopColor={doc.ink} stopOpacity={0} />
      </linearGradient>
    </defs>
  )
}
