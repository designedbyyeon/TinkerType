import { useMemo } from 'react'
import { baselineOffset, FONT_FAMILY, useCapRatio } from '../../shared/media/metrics'
import { marchingSquares } from './geometry/contour'
import { buildField } from './geometry/field'
import { loopsToPathData } from './geometry/fitBezier'
import { buildPath, resolveStyle } from './geometry/nodes'
import { DEFAULT_STYLE } from './store'
import { useLang, type Lang } from '../../shared/i18n/lang'
import type { PathObj } from './types'

const W = 880
const H = 470
/** Fine enough for a still image; this runs once. */
const CELL = 1.1

/*
 * The card paints its own ground (`.bench-view`, --paper-sunk), so this still is
 * transparent and the letters are knocked out of the ink in that same colour.
 * Reading the token rather than repeating its value means the card and the
 * knockout can never drift apart.
 */
const GROUND = 'var(--paper-sunk)'
const INK = 'var(--ink)'

/**
 * The word on the card, per language — ten characters either way.
 *
 * `countMode: 'text'` puts one bead on the chain per character, so the count *is*
 * the composition: nine beads or twelve would change the spacing the card is
 * showing off. A space gets a bead of its own and no letter in it, which is
 * correct and is also why the Korean line is chosen to carry only one. This tool draws with Pretendard, which the interface has already
 * loaded and which carries Hangul, so the Korean card costs nothing. (Tool 02's
 * card cannot do this — see the note there — and tool 03's is Korean already.)
 */
const WORD: Record<Lang, string> = {
  en: 'SERPENTINE',
  ko: '구불구불 미끄러진다',
}

/**
 * The index preview, drawn by the tool itself.
 *
 * Not a mockup: the stroke goes through the same smoothing, resampling, fillet
 * union and Bézier fit as anything made in the app, so what the homepage shows
 * is genuinely what the tool produces.
 */
export function Preview() {
  const capRatio = useCapRatio()
  const lang = useLang()

  const art = useMemo(() => {
    const raw = Array.from({ length: 130 }, (_, i) => {
      const t = i / 129
      return { x: 96 + t * 688, y: H / 2 + Math.sin(t * Math.PI * 1.55) * 104 }
    })

    const path: PathObj = {
      id: 'preview',
      raw,
      smoothing: 0,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, originX: 0, originY: 0 },
      text: WORD[lang],
      style: {},
    }

    const style = resolveStyle(
      {
        ...DEFAULT_STYLE,
        shape: 'circle',
        size: 96,
        blend: 26,
        blendMode: 'fillet',
        countMode: 'text',
        fill: INK,
        stroke: 'none',
        rotateToTangent: true,
        fontSize: 34,
        fontWeight: 650,
        textColor: GROUND,
      },
      {},
    )

    const { nodes } = buildPath(path, style)
    const field = buildField(nodes, style.blend, CELL, style.blendMode)
    return {
      d: field ? loopsToPathData(marchingSquares(field), CELL * 0.4) : null,
      nodes,
      style,
    }
  }, [lang])

  const offset = baselineOffset(art.style.fontSize, capRatio, art.style.textOffset)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {art.d && <path d={art.d} fillRule="evenodd" fill={art.style.fill} />}
      {art.nodes.map((node, i) =>
        node.text ? (
          <text
            key={i}
            x={node.pos.x}
            y={node.pos.y + offset}
            textAnchor="middle"
            fontFamily={FONT_FAMILY}
            fontSize={art.style.fontSize}
            fontWeight={art.style.fontWeight}
            fill={art.style.textColor}
            transform={
              node.angle
                ? `rotate(${(node.angle * 180) / Math.PI} ${node.pos.x} ${node.pos.y})`
                : undefined
            }
          >
            {node.text}
          </text>
        ) : null,
      )}
    </svg>
  )
}
