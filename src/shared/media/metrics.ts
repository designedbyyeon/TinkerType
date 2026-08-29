import { useEffect, useState } from 'react'

export const FONT_FAMILY = "'Pretendard Variable', Pretendard, sans-serif"

/** Pretendard's measured cap height, used until the font has loaded. */
const FALLBACK_CAP_RATIO = 0.707

/**
 * Measure Pretendard's cap height as a fraction of the font size.
 *
 * Letters are centred on cap height rather than on each glyph's own ink box:
 * that keeps a row of shapes on one shared baseline, so a comma still sits low
 * and an 'O' still overshoots, exactly as in the reference posters.
 *
 * Measuring the live font also means the number is identical on screen and in
 * the exported file — no `dominant-baseline` for other apps to interpret.
 *
 * This uses canvas text metrics, not `getBBox()`: SVG's box reports the font's
 * layout height (ascender plus descender, ~1.19em here) and returns the same
 * number for H, x and O. `actualBoundingBoxAscent` of an H is the real cap
 * height, which is what makes the centring hold at any font size.
 */
function measureCapRatio(): number {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return FALLBACK_CAP_RATIO

  context.font = `100px ${FONT_FAMILY}`
  const metrics = context.measureText('H')
  const ascent = metrics.actualBoundingBoxAscent
  if (!Number.isFinite(ascent) || ascent <= 1) return FALLBACK_CAP_RATIO
  return ascent / 100
}

export function useCapRatio(): number {
  const [ratio, setRatio] = useState(FALLBACK_CAP_RATIO)

  useEffect(() => {
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) setRatio(measureCapRatio())
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ratio
}

/** Distance from a shape's centre down to the text baseline. */
export function baselineOffset(fontSize: number, capRatio: number, nudge: number): number {
  return (fontSize * capRatio) / 2 + nudge
}
