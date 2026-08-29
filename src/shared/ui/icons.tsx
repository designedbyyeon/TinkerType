/**
 * Hairline pictograms, 16px grid, stroke only. These are the ones any tool
 * would want; the ones that only mean something inside a particular tool live
 * with that tool.
 */

import { base, type IconProps } from './iconBase'

export const RotateIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M13.4 8a5.4 5.4 0 1 1-1.7-3.9" />
    <path d="M13.6 2.2v3.1h-3.1" />
  </svg>
)

export const DownloadIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M8 2v8" />
    <path d="M4.8 7.1 8 10.3l3.2-3.2" />
    <path d="M2.4 13.4h11.2" />
  </svg>
)

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

export const PlayIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4.6 2.9 13 8l-8.4 5.1Z" fill="currentColor" />
  </svg>
)

export const PauseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5.2 3v10M10.8 3v10" strokeWidth="2" />
  </svg>
)

/** Jump the playhead to the end. */
export const SkipEndIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3.6 3.2 10 8l-6.4 4.8Z" fill="currentColor" />
    <path d="M12.4 3v10" strokeWidth="1.6" />
  </svg>
)

export const PictureIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.2" y="3.4" width="11.6" height="9.2" rx="1" />
    <circle cx="5.9" cy="6.6" r="1.1" />
    <path d="M2.2 11.1 6 8.4l2.6 1.9 2.3-1.9 2.9 2.3" />
  </svg>
)

export const PasteIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 2.6h4v2H6Z" />
    <path d="M6 3.6H3.6v10.8h8.8V3.6H10" />
    <path d="M6 9.4h4.4M6 11.8h3" />
  </svg>
)

/** Empty square with a slash — the printer's mark for "no colour". */
export const NoneIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.6" y="2.6" width="10.8" height="10.8" />
    <path d="M3.6 12.4 12.4 3.6" />
  </svg>
)

export const ChevronIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5.5 3.5 10.5 8l-5 4.5" />
  </svg>
)
