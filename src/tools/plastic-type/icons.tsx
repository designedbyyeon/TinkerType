import { base, type IconProps } from '../../shared/ui/iconBase'

/**
 * Icons that only mean something here: the two ways a sheet takes colour.
 *
 * The split controls deliberately carry words instead. Both of them choose a
 * level of granularity, and eight pictograms of "a bit finer than the last one"
 * would be a puzzle where four labels are simply read.
 */

/** One plastic for the whole sheet. */
export const MonoIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.4" y="2.4" width="11.2" height="11.2" fill="currentColor" stroke="none" />
  </svg>
)

/** A colour per runner, as in a four-sprue kit. */
export const CycleIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.4" y="2.4" width="5" height="5" fill="currentColor" stroke="none" />
    <rect x="8.6" y="2.4" width="5" height="5" opacity="0.55" fill="currentColor" stroke="none" />
    <rect x="2.4" y="8.6" width="5" height="5" opacity="0.3" fill="currentColor" stroke="none" />
    <rect x="8.6" y="8.6" width="5" height="5" fill="currentColor" stroke="none" />
  </svg>
)

/**
 * The two forms of the sheet: a drawing of it, or the object it describes.
 *
 * Drawn as what each one *is* rather than as what it is for — a flat plate seen
 * square on, and the same plate with its thickness turned toward you. The pair
 * has to be legible at 16px next to each other, so they share the front face and
 * differ only in whether it has a body behind it.
 */

/** Flat artwork. Leaves as an editable SVG. */
export const FlatIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.6" y="4.6" width="10.8" height="7.4" />
  </svg>
)

/** A moulded solid. Leaves as a model. */
export const SolidIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2.6 6.4h8.2v7.2H2.6z" />
    <path d="M2.6 6.4 5.2 3.8h8.2v7.2l-2.6 2.6" />
    <path d="M10.8 6.4 13.4 3.8" />
  </svg>
)
