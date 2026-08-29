import { useRef } from 'react'
import { REFERENCE } from '../../../shared/media/type/hangul/face'
import type { Parsed } from '../../../shared/media/type/measure'
import type { Grid } from '../geometry/grid'
import type { BeatDoc } from '../types'
import { emFor, glyphOf, placed } from './glyphs'
import { IDS } from './surfaceIds'

/**
 * The bar.
 *
 * One row per lane; the row's own syllable set at the left of it, its steps to the
 * right. **The header is the type and the type is the notation** — there is no text
 * field anywhere in this tool, so this is where the syllables are read.
 *
 * A step is a filled block when it is on and a hairline when it is off, rather
 * than a lit pad: the references are printed instruments, and a grid of hollow
 * marks with a few filled reads as a score at a glance. The step under the
 * playhead is not treated specially — the playhead itself is the moving thing, and
 * two moving things on one grid is one too many.
 *
 * **The steps run in a milled track**, shaded under its own top edge, and every
 * other beat's worth of it is a shade darker. That banding is not decoration: with
 * sixteen identical columns you cannot see where beat three starts, and counting
 * hairlines is not reading. The bar lines carry the same information and the
 * banding is what makes it legible at a glance.
 *
 * **The playhead is not in here.** It is the one thing that changes every frame, so
 * the stage drives it by transform alone; this component re-renders only when the
 * document does.
 *
 * **Each lane carries a fader**, and it is deliberately the same object as a step:
 * a key standing in a milled slot. A step key says *this lane sounds here*; the
 * fader key says *this lane sounds this loud*. Drawing the second one as a
 * different kind of control — a knob, a bar graph, a number — would have put two
 * vocabularies on one grid for two facts of the same kind.
 *
 * It is a **mix** and not a sound. 가획 is still where a syllable's own force comes
 * from, and the fader cannot reach it: a lane at half level plays the same 뚬,
 * quieter. That is why there is one per lane and not one per letter.
 */

export function Sequencer({
  grid,
  doc,
  face,
  onTap,
  onRemove,
  onLevel,
  onLevelBegin,
  onLevelEnd,
}: {
  grid: Grid
  doc: BeatDoc
  face: Parsed
  onTap: (row: number, step: number) => void
  onRemove: (syllable: string) => void
  onLevel: (syllable: string, level: number) => void
  onLevelBegin: () => void
  onLevelEnd: () => void
}) {
  const em = emFor(face, REFERENCE, doc.lane)
  /*
   * A hit is a **vertical bar**, sized off the row rather than off the column.
   *
   * Sized off the column it came out nearly square at any comfortable step width
   * and the bar read as a row of dominoes. A bar taller than it is wide reads as a
   * hit — it is the mark the reference's own waveform strip is made of — and it
   * keeps its shape whether the grid holds eight steps or thirty-two.
   */
  const blockH = grid.rowHeight * 0.62
  const blockW = Math.min(grid.column - 3, Math.max(3, grid.rowHeight * 0.3))
  const perBeat = Math.max(1, doc.division / 4)

  /*
   * The fader, laid out against the row rather than against the header's width, so
   * it keeps its proportions when the lane size is dragged.
   */
  const fader = {
    x: grid.left - 11,
    y: 7,
    height: Math.max(12, grid.rowHeight - 14),
    slot: 5,
    cap: 11,
    capH: 5,
  }
  /** Where a lane's letter sits: between the clear mark and the fader. */
  const nameX = (16 + (fader.x - fader.cap / 2)) / 2

  const levelAt = (y: number) => {
    const travel = fader.height - fader.capH
    return travel <= 0 ? 1 : 1 - Math.min(1, Math.max(0, (y - fader.capH / 2) / travel))
  }

  /*
   * The gesture, in a ref.
   *
   * Bug type one, which this repository has been caught by twice: a handler that
   * reads React state reads whatever was there when the closure was made. Under a
   * real hand it looks fine, because React re-renders between moves; under
   * synthetic pointer events flushed in one tick it holds the value from
   * pointerdown forever. Everything the drag needs is captured here at
   * pointerdown and read from here afterwards.
   */
  const drag = useRef<{ syllable: string; top: number; moved: boolean } | null>(null)
  /** What a lane was at before it was muted, so a click can put it back. */
  const before = useRef(new Map<string, number>())
  const trackY = -6
  const trackH = grid.height + 12
  const radius = Math.min(7, grid.rowHeight * 0.22)

  return (
    <g>
      {/* The track the steps run in. */}
      <rect
        x={grid.left}
        y={trackY}
        width={grid.width - grid.left}
        height={trackH}
        rx={radius}
        fill={doc.ink}
        opacity={0.022}
      />
      <rect
        x={grid.left}
        y={trackY}
        width={grid.width - grid.left}
        height={trackH}
        rx={radius}
        fill={`url(#${IDS.well})`}
      />

      {/* Every other beat, a shade darker. Sixteen identical columns cannot be
          counted; two alternating tones can be read. */}
      <g opacity={0.038} fill={doc.ink}>
        {Array.from({ length: Math.ceil(grid.steps / perBeat) }, (_, i) =>
          i % 2 === 1 ? (
            <rect
              key={i}
              x={grid.left + i * perBeat * grid.column}
              y={trackY}
              width={Math.min(perBeat, grid.steps - i * perBeat) * grid.column}
              height={trackH}
            />
          ) : null,
        )}
      </g>

      {grid.rows.map((row, index) => {
        const glyph = glyphOf(face, row.syllable)
        return (
          // A lane at zero stands back, so a bar that is written but not heard
          // says so rather than looking like a bar that is not playing.
          <g key={row.syllable} opacity={row.ghost ? 0.4 : row.level === 0 ? 0.34 : 1}>
            {/* The lane's name, which is its sound. Centred in what is left of the
                header between the clear mark and the fader, rather than at a
                fraction of the header's width: the fader arrived in the space that
                fraction used to point at, and the letter was overlapping its cap. */}
            <path
              d={glyph.d}
              transform={placed(glyph, row.header.x + nameX, row.y + row.height / 2, em)}
              fill={doc.ink}
            />

            {/* A hairline under the lane, so the row reads as a staff line rather
                than as a floating strip of boxes. */}
            <path
              d={`M${row.header.x} ${row.y + row.height}H${grid.width}`}
              stroke={doc.ink}
              strokeWidth={0.6}
              opacity={0.18}
              fill="none"
            />

            {row.cells.map((cell) => {
              const y = cell.y + (cell.height - blockH) / 2
              return (
                <g key={cell.step}>
                  {cell.on ? (
                    // A key standing in the track: a rounded end so it reads as a
                    // part rather than as a fill. No shadow — the machine is
                    // printed, not rendered.
                    <rect
                      x={cell.x + (cell.width - blockW) / 2}
                      y={y}
                      width={blockW}
                      height={blockH}
                      rx={Math.min(blockW / 2, 2.5)}
                      fill={doc.ink}
                    />
                  ) : (
                    // Off steps are drawn, not left blank: a gap in a grid reads
                    // as an error and a rule reads as a decision.
                    <path
                      d={`M${cell.x + cell.width / 2} ${y + blockH * 0.34}v${blockH * 0.32}`}
                      stroke={doc.ink}
                      strokeWidth={1}
                      opacity={0.22}
                      fill="none"
                    />
                  )}
                  <rect
                    data-ui
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      onTap(index, cell.step)
                    }}
                  />
                </g>
              )
            })}

            {/* The lane's fader. Not on a ghost: it is not a lane yet, so it has
                no place in the mix to hold. */}
            {!row.ghost && (
              <g data-ui>
                {/* The slot it runs in — the step track's own language, stood up,
                    and milled with the same gradient for the same reason. */}
                <rect
                  x={fader.x - fader.slot / 2}
                  y={row.y + fader.y}
                  width={fader.slot}
                  height={fader.height}
                  rx={fader.slot / 2}
                  fill={doc.ink}
                  opacity={0.09}
                />
                {/*
                 * How much of the slot is filled **is the reading.**
                 *
                 * A cap alone is a fader and says the level only by where it sits,
                 * which at this size is a dash beside a letter — three lanes at
                 * three levels looked like three stray marks. Filled from the cap
                 * down, a lane's level can be read across all of them at a glance
                 * without measuring anything, which is what a row of lanes is for.
                 */}
                {row.level > 0 && (
                  <rect
                    x={fader.x - fader.slot / 2}
                    y={row.y + fader.y + (1 - row.level) * (fader.height - fader.capH)}
                    width={fader.slot}
                    height={fader.height - (1 - row.level) * (fader.height - fader.capH)}
                    rx={fader.slot / 2}
                    fill={doc.ink}
                    opacity={0.42}
                  />
                )}
                {/* The key. At the top it is the sound as written; at the bottom
                    the lane is out of the bar. */}
                <rect
                  x={fader.x - fader.cap / 2}
                  y={row.y + fader.y + (1 - row.level) * (fader.height - fader.capH)}
                  width={fader.cap}
                  height={fader.capH}
                  rx={1}
                  fill={doc.ink}
                  opacity={row.level === 0 ? 0.3 : 1}
                />
                <rect
                  x={fader.x - 9}
                  y={row.y}
                  width={18}
                  height={row.height}
                  fill="transparent"
                  style={{ cursor: 'ns-resize' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    drag.current = {
                      syllable: row.syllable,
                      top: e.clientY - (e.nativeEvent.offsetY - fader.y),
                      moved: false,
                    }
                    // The offset above is unreliable across browsers on an SVG
                    // child, so the top is re-derived from the element's own box.
                    const box = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                    drag.current.top = box.top + fader.y
                    onLevelBegin()
                    try {
                      ;(e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId)
                    } catch {
                      // Capture is a convenience. Losing it must not take the
                      // rest of the handler down with it — bug type two.
                    }
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current
                    if (!d) return
                    d.moved = true
                    onLevel(d.syllable, levelAt(e.clientY - d.top))
                  }}
                  onPointerUp={(e) => {
                    const d = drag.current
                    drag.current = null
                    if (!d) return
                    if (d.moved) {
                      onLevel(d.syllable, levelAt(e.clientY - d.top))
                    } else {
                      // A tap, not a drag: mute, or put back what it was.
                      const now = row.level
                      if (now > 0) {
                        before.current.set(d.syllable, now)
                        onLevel(d.syllable, 0)
                      } else {
                        onLevel(d.syllable, before.current.get(d.syllable) ?? 1)
                      }
                    }
                    onLevelEnd()
                  }}
                  onPointerCancel={() => {
                    drag.current = null
                    onLevelEnd()
                  }}
                />
              </g>
            )}

            {/* Clear the lane. Only for rows that are lanes — a ghost has nothing
                to clear, and the wheels are how it goes away. */}
            {!row.ghost && (
              <g
                data-ui
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onRemove(row.syllable)
                }}
              >
                <circle
                  cx={row.header.x + 9}
                  cy={row.y + row.height / 2}
                  r={6}
                  fill="transparent"
                />
                <path
                  d={`M${row.header.x + 6} ${row.y + row.height / 2 - 3}l6 6M${
                    row.header.x + 12
                  } ${row.y + row.height / 2 - 3}l-6 6`}
                  stroke={doc.ink}
                  strokeWidth={1.1}
                  opacity={0.3}
                  fill="none"
                />
              </g>
            )}
          </g>
        )
      })}

      {/* Bar lines only. The beats are in the banding now, and a rule for every
          beat on top of that was two answers to one question. */}
      <g stroke={doc.ink} fill="none" pointerEvents="none">
        {grid.bars.map((x) => (
          <path key={`bar${x}`} d={`M${x} ${trackY}v${trackH}`} strokeWidth={1.1} opacity={0.5} />
        ))}
      </g>
    </g>
  )
}
