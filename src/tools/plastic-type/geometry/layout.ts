import type { Rect } from '../../../shared/geometry/vec'
import { bboxOf, flattenCommands, groupPieces, type Contour, type Piece } from './glyphs'
import {
  applyAxes,
  drawGlyph,
  missingFrom,
  type Axes,
  type Face,
} from '../../../shared/media/type/measure'
import { splitText, type PartUnit, type RunnerUnit } from './hangul'
import { roundCorners } from './round'

/*
 * Reading a face — setting its axes, pulling a glyph, measuring it — is not
 * about sprues and now has two callers, so it lives in `shared/media/type`.
 * Re-exported because it is what this module's own callers ask it for.
 */
export { applyAxes, missingFrom }
export type { Axes, Face }

export interface PlacedPart {
  text: string
  /** Every connected solid this part is made of. Each one needs its own gate. */
  pieces: Piece[]
  bbox: Rect
  /** 1-based position in its frame, which the number plaque reads out. */
  slot: number
}

export interface Frame {
  label: string
  parts: PlacedPart[]
  /** Outer boundary, walls included. */
  rect: Rect
  /** What the letters actually occupy inside it. */
  ink: Rect
  row: number
  column: number
}

export interface Sheet {
  frames: Frame[]
  bounds: Rect
}

export interface LayoutStyle {
  /**
   * The face's own size, already solved from the drawn height the designer asked
   * for. Resolved outside because it depends on the face and its axes.
   */
  fontSize: number
  /** Extra space between parts inside a frame. */
  tracking: number
  /** Clear space from the ink to the outside of the wall. */
  inset: number
  /** Space between neighbouring frames. */
  gap: number
  /** Frames per row. 0 keeps the sheet to a single row. */
  perRow: number
  /**
   * Give every frame the tallest frame's height instead of letting each hug its
   * own content. Needed when frames are tied together, since a lattice can only
   * line up if its cells share edges.
   */
  uniformHeight: boolean
  /** Flattening error, in px. */
  tolerance: number
  /**
   * Mould radius on the letters, in px.
   *
   * Applied to the raw outlines before anything else looks at them, so the gates
   * land on the rounded silhouette rather than on corners that are no longer
   * there.
   */
  round: number
}

/**
 * One part's outlines, drawn with the pen at `penX` on the baseline.
 *
 * **One face draws the whole run, Hangul included.**
 *
 * Splitting a mixed line into script runs and handing each to whichever face had
 * the character was the plan, and it turned out not to be needed: both Hangul
 * faces carry a complete Latin alphabet, so a line of Korean with a Latin word in
 * it is one face's work. A character the face genuinely lacks is reported by the
 * stage rather than quietly redrawn in something else — which is also the honest
 * answer, since a second face would change the drawn height mid-line.
 */
function drawPart(text: string, face: Face, style: LayoutStyle, penX: number) {
  const contours: Contour[] = []
  const chars = [...text]
  const scale = style.fontSize / face.font.unitsPerEm
  let x = penX

  chars.forEach((char, i) => {
    const drawn = drawGlyph(face, char, x, style.fontSize)
    contours.push(...flattenCommands(roundCorners(drawn.commands, style.round), style.tolerance))
    x += drawn.advance

    // Kerning is the one piece of shaping worth keeping, and it is a table
    // lookup rather than a feature the library might not implement.
    const next = chars[i + 1]
    if (next === undefined) return
    x += face.font.getKerningValue(face.font.charToGlyph(char), face.font.charToGlyph(next)) * scale
  })

  // Grouped over the whole part, not per glyph: two letters that touch are one
  // solid, and at heavy weights tight pairs really do touch.
  return { pieces: groupPieces(contours), advance: x - penX }
}

function unionRect(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.width)
    maxY = Math.max(maxY, r.y + r.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function translatePiece(piece: Piece, dx: number, dy: number): Piece {
  const contours = piece.contours.map((contour) => ({
    ...contour,
    points: contour.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    commands: contour.commands.map((cmd) => {
      switch (cmd.type) {
        case 'M':
        case 'L':
          return { ...cmd, x: cmd.x + dx, y: cmd.y + dy }
        case 'Q':
          return { ...cmd, x1: cmd.x1 + dx, y1: cmd.y1 + dy, x: cmd.x + dx, y: cmd.y + dy }
        case 'C':
          return {
            ...cmd,
            x1: cmd.x1 + dx,
            y1: cmd.y1 + dy,
            x2: cmd.x2 + dx,
            y2: cmd.y2 + dy,
            x: cmd.x + dx,
            y: cmd.y + dy,
          }
        default:
          return cmd
      }
    }),
  }))
  return { contours, bbox: bboxOf(contours.filter((c) => c.kind === 'solid').flatMap((c) => c.points)) }
}

/**
 * Lay the text out as a sheet of runners.
 *
 * Frames all share one height so the sheet reads as a lattice, the way a real
 * parts frame does — the bridged column is a row of same-height frames of differing
 * widths. Width follows content, and letters keep the position type gave them:
 * the frame is built around the word, never the word rebuilt into the frame.
 */
export function layoutSheet(
  text: string,
  part: PartUnit,
  runner: RunnerUnit,
  face: Face,
  style: LayoutStyle,
): Sheet {
  const groups = splitText(text, part, runner)
  if (groups.length === 0) return { frames: [], bounds: { x: 0, y: 0, width: 0, height: 0 } }

  // First pass: draw each frame's contents at the origin to learn its extent.
  interface Draft {
    label: string
    parts: PlacedPart[]
    ink: Rect
  }

  const drafts: Draft[] = []
  for (const group of groups) {
    const parts: PlacedPart[] = []
    let pen = 0

    for (const p of group.parts) {
      const { pieces, advance } = drawPart(p.text, face, style, pen)
      pen += advance + style.tracking
      if (pieces.length === 0) continue
      parts.push({
        text: p.text,
        pieces,
        bbox: unionRect(pieces.map((piece) => piece.bbox)),
        slot: parts.length + 1,
      })
    }

    if (parts.length === 0) continue
    drafts.push({ label: group.label, parts, ink: unionRect(parts.map((p) => p.bbox)) })
  }

  if (drafts.length === 0) return { frames: [], bounds: { x: 0, y: 0, width: 0, height: 0 } }

  /*
   * Frame height: shared, or each hugging its own content.
   *
   * Both are real, and which is right follows from whether the frames are tied
   * together. The bridged column is exactly that — frames bridged into one lattice — and a
   * lattice can only line up if its cells share edges — so those must match.
   * The syllable runners are four separate coloured frames, and each one is cut close
   * around its own syllable, which is what makes them read as four things rather
   * than as one sheet.
   */
  const tallest = Math.max(...drafts.map((d) => d.ink.height))

  const sized = drafts.map((draft) => ({
    draft,
    width: draft.ink.width + style.inset * 2,
    height: (style.uniformHeight ? tallest : draft.ink.height) + style.inset * 2,
  }))

  // Rows first, so a row's height is known before anything in it is placed.
  const rows: (typeof sized)[] = []
  for (const entry of sized) {
    const last = rows[rows.length - 1]
    if (!last || (style.perRow > 0 && last.length >= style.perRow)) rows.push([entry])
    else last.push(entry)
  }

  const frames: Frame[] = []
  let cursorY = 0

  rows.forEach((entries, row) => {
    const rowHeight = Math.max(...entries.map((e) => e.height))
    let cursorX = 0

    entries.forEach((entry, column) => {
      // A frame shorter than its row sits centred in the band, so a row of
      // differently-sized runners still reads off one middle line.
      const rect = {
        x: cursorX,
        y: cursorY + (rowHeight - entry.height) / 2,
        width: entry.width,
        height: entry.height,
      }

      const { draft } = entry
      // Centre the ink in the frame, then move every piece there in one step.
      const dx = rect.x + (rect.width - draft.ink.width) / 2 - draft.ink.x
      const dy = rect.y + (rect.height - draft.ink.height) / 2 - draft.ink.y

      frames.push({
        label: draft.label,
        row,
        column,
        rect,
        ink: {
          x: draft.ink.x + dx,
          y: draft.ink.y + dy,
          width: draft.ink.width,
          height: draft.ink.height,
        },
        parts: draft.parts.map((p) => ({
          ...p,
          pieces: p.pieces.map((piece) => translatePiece(piece, dx, dy)),
          bbox: { ...p.bbox, x: p.bbox.x + dx, y: p.bbox.y + dy },
        })),
      })

      cursorX += entry.width + style.gap
    })

    cursorY += rowHeight + style.gap
  })

  return { frames, bounds: unionRect(frames.map((f) => f.rect)) }
}
