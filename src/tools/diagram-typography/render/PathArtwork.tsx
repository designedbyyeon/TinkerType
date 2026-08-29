import { useMemo } from 'react'
import { marchingSquares } from '../geometry/contour'
import { buildField } from '../geometry/field'
import { loopsToPathData } from '../geometry/fitBezier'
import { buildPath, resolveStyle, shapesAreDisjoint } from '../geometry/nodes'
import { applyReveal, letterOpacity } from '../geometry/reveal'
import { transformAttr } from '../../../shared/geometry/transform'
import type { AnimSettings, PathObj, ShapeNode, Style } from '../types'
import { baselineOffset, FONT_FAMILY } from '../../../shared/media/metrics'

interface Props {
  path: PathObj
  defaults: Style
  capRatio: number
  /** Field sampling step in px — coarse while dragging, fine when settled. */
  cell: number
  anim: AnimSettings
  /** Playhead in ms. */
  timeMs: number
  playing: boolean
}

function ExactShapes({ nodes, style }: { nodes: ShapeNode[]; style: Style }) {
  return (
    <>
      {nodes.map((node, i) => {
        const half = node.size / 2
        const common = {
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: style.stroke === 'none' ? undefined : style.strokeWidth,
        }
        if (node.shape === 'circle') {
          return <circle key={i} cx={node.pos.x} cy={node.pos.y} r={half} {...common} />
        }
        const rx = node.shape === 'roundSquare' ? half * style.cornerRadius : 0
        return (
          <rect
            key={i}
            x={node.pos.x - half}
            y={node.pos.y - half}
            width={node.size}
            height={node.size}
            rx={rx}
            ry={rx}
            transform={
              node.angle
                ? `rotate(${(node.angle * 180) / Math.PI} ${node.pos.x} ${node.pos.y})`
                : undefined
            }
            {...common}
          />
        )
      })}
    </>
  )
}

export function PathArtwork({
  path,
  defaults,
  capRatio,
  cell,
  anim,
  timeMs,
  playing,
}: Props) {
  const style = useMemo(() => resolveStyle(defaults, path.style), [defaults, path.style])
  const built = useMemo(() => buildPath(path, style), [path, style])
  // At rest this returns the same array, so the field and contour memos below
  // never re-run just because the playhead exists.
  const nodes = useMemo(
    () => applyReveal(built.nodes, timeMs, anim, playing),
    [built.nodes, timeMs, anim, playing],
  )

  // Un-merged shapes stay as real <circle>/<rect> elements: mathematically
  // perfect, tiny SVG, and individually editable after export. The contour is
  // only computed when shapes actually need to fuse, or when a stroke would
  // expose the seams between overlapping shapes.
  const useExact =
    style.blend <= 0 && (style.stroke === 'none' || shapesAreDisjoint(nodes))

  const contourData = useMemo(() => {
    if (useExact || nodes.length === 0) return null
    const field = buildField(nodes, style.blend, cell, style.blendMode)
    if (!field) return null
    return loopsToPathData(marchingSquares(field), cell * 0.35)
  }, [useExact, nodes, style.blend, style.blendMode, cell])

  const offset = baselineOffset(style.fontSize, capRatio, style.textOffset)

  return (
    // Placement rides on the group transform, so moving and scaling never
    // touch the geometry — no field rebuild, no loss of precision.
    <g data-path-id={path.id} transform={transformAttr(path.transform)}>
      {useExact ? (
        <ExactShapes nodes={nodes} style={style} />
      ) : (
        contourData && (
          <path
            d={contourData}
            fillRule="evenodd"
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.stroke === 'none' ? undefined : style.strokeWidth}
            strokeLinejoin="round"
          />
        )
      )}

      {nodes.map((node, i) => {
        if (!node.text) return null
        const opacity = node.reveal === undefined ? 1 : letterOpacity(node.reveal)
        if (opacity <= 0) return null
        return (
          <text
            key={i}
            x={node.pos.x}
            y={node.pos.y + offset}
            opacity={opacity < 1 ? opacity : undefined}
            textAnchor="middle"
            fontFamily={FONT_FAMILY}
            fontSize={style.fontSize}
            fontWeight={style.fontWeight}
            fill={style.textColor}
            style={{ fontVariationSettings: `'wght' ${style.fontWeight}` }}
            transform={
              node.angle
                ? `rotate(${(node.angle * 180) / Math.PI} ${node.pos.x} ${node.pos.y})`
                : undefined
            }
          >
            {node.text}
          </text>
        )
      })}
    </g>
  )
}
