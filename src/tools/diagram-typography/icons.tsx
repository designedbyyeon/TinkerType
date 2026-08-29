import { base, type IconProps } from '../../shared/ui/iconBase'

/**
 * Radii are kept under half the 3.8 spacing so the marks always read as
 * separate dots — at 16px, touching circles blur into one bar and the four
 * variation modes stop being distinguishable.
 */
const dots = (radii: number[]) => (
  <>
    {radii.map((r, i) => (
      <circle key={i} cx={2.5 + i * 3.8} cy="8" r={r} fill="currentColor" stroke="none" />
    ))}
  </>
)

/**
 * Icons that only mean something in this tool: its two tools, its three shape
 * kinds, its two join modes, its four variation curves, its three easings.
 * Each one draws the result it selects, which is faster to read than a word.
 */

export const BrushIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M1.6 11.4C4 6.6 7.2 4 11 3.4" />
    <circle cx="2.2" cy="12.6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6.1" cy="7.7" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="11.4" cy="4.4" r="2.3" fill="currentColor" stroke="none" />
  </svg>
)

export const SelectIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="1.8" y="1.8" width="9" height="9" strokeDasharray="2.4 1.8" />
    <path d="M8.4 8.4 14.2 14.2" />
    <path d="M14.2 10.6v3.6h-3.6" />
  </svg>
)

export const CircleIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="8" cy="8" r="5.6" />
  </svg>
)

export const SquareIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.4" y="2.4" width="11.2" height="11.2" />
  </svg>
)

export const RoundSquareIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="3.6" />
  </svg>
)

export const FilletIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6.9 4.1a3.9 3.9 0 1 0 0 7.8 2.6 2.6 0 0 1 2.2-1.3 2.6 2.6 0 0 1-2.2-1.3 2 2 0 0 1 0-3.9 2.6 2.6 0 0 1 2.2-1.3 2.6 2.6 0 0 1-2.2-1.3Z" />
    <circle cx="11.1" cy="8" r="3" />
  </svg>
)

export const MetaballIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5.7 3.4a4.6 4.6 0 0 0 0 9.2c1.1 0 1.7-.7 2.7-.9 1-.2 1.4.5 2.4.3a3.6 3.6 0 0 0 0-7.2c-1 -.2-1.4.5-2.4.3-1-.2-1.6-.9-2.7-.9Z" />
  </svg>
)

export const VarNoneIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    {dots([1.3, 1.3, 1.3, 1.3])}
  </svg>
)

export const VarRampIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    {dots([0.6, 1.1, 1.5, 1.85])}
  </svg>
)

export const VarWaveIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    {dots([0.6, 1.85, 1.85, 0.6])}
  </svg>
)

export const VarRandomIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    {dots([1.7, 0.65, 1.85, 1.05])}
  </svg>
)

export const EaseBackIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 13.5C5 13.5 6.4 1.6 9.4 1.6c1.6 0 1.4 3.4 4.6 3.4" />
  </svg>
)

export const EaseOutIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 13.5C7.2 13.5 10.6 10.4 14 2.5" />
  </svg>
)

export const EaseLinearIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 13.5 14 2.5" />
  </svg>
)

