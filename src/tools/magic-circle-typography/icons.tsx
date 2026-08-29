/**
 * The pictograms only this tool means anything by.
 *
 * The band-face pair is the important one: the two options are the same ring
 * with the letters standing on opposite sides of it, so the icons are the same
 * circle with the marks inside and outside. Told apart by a word, they would need
 * a sentence each — drawn, the answer is the picture.
 */

import { base, type IconProps } from '../../shared/ui/iconBase'

/** Letters standing on the outside of the ring, reading clockwise. */
export const FaceOutIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="9.6" r="4.4" />
    <path d="M8 5.2V2.4M4.5 6.4 3 4.4M11.5 6.4 13 4.4" strokeWidth="1.5" />
  </svg>
)

/** Letters hanging on the inside of the ring, reading anticlockwise. */
export const FaceInIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 4.4v2.5M5.1 5.4l1.4 1.9M10.9 5.4 9.5 7.3" strokeWidth="1.5" />
  </svg>
)

/** One band out, the next in, so the two runs face each other across a rule. */
export const FaceAlternateIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="6.4" />
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.6v2.2M8 8v2.2" strokeWidth="1.5" />
  </svg>
)

/** The type set at its own width: an arc as long as the phrase needs. */
export const FillNaturalIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="6" opacity="0.4" />
    <path d="M3.9 3.6A6 6 0 0 1 12.1 3.6" strokeWidth="1.8" />
  </svg>
)

/** Letterspacing opened until the phrase closes the circle. */
export const FillRingIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="6" strokeWidth="1.8" strokeDasharray="1.6 2" />
  </svg>
)

/** The phrase set again and again until it closes: three runs and their marks. */
export const FillRepeatIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="6" opacity="0.4" />
    <path d="M4.6 2.6A6 6 0 0 1 11.4 2.6" strokeWidth="1.8" />
    <path d="M13.4 5.6A6 6 0 0 1 10 13.7" strokeWidth="1.8" />
    <path d="M6 13.7A6 6 0 0 1 2.6 5.6" strokeWidth="1.8" />
  </svg>
)

export const CameraIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 5.6h2.6l1.1-1.6h4.6l1.1 1.6H14v7.2H2Z" />
    <circle cx="8" cy="9.2" r="2.2" />
  </svg>
)

/** A shutter: the aperture blades, closed to a point. */
export const ShutterIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 1.8 5 7M8 1.8 11 7M13.9 9.6 8 8.6M13.9 9.6 10.4 13.6M2.1 9.6 8 8.6M2.1 9.6 5.6 13.6" />
  </svg>
)

export const StopIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4.4" y="4.4" width="7.2" height="7.2" fill="currentColor" strokeWidth="0" />
  </svg>
)
