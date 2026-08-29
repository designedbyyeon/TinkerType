import { base } from '../../shared/ui/iconBase'

/**
 * This tool's own marks. Two of them, both on the transport.
 *
 * Drawn rather than borrowed from tool 04: a shutter and a play button are
 * different instruments, and the site's rule is that a tool draws the result of
 * the thing rather than a generic symbol for it.
 */

export function PlayIcon() {
  return (
    <svg {...base}>
      <path d="M5 3.5 12.5 8 5 12.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function StopIcon() {
  return (
    <svg {...base}>
      <rect x={4.5} y={4.5} width={7} height={7} fill="currentColor" stroke="none" />
    </svg>
  )
}
