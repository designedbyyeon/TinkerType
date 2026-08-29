/** Shared drawing setup for every pictogram, in one place so all icons in the
 *  system share a stroke weight and grid. */
export interface IconProps {
  className?: string
}

export const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.15,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}
