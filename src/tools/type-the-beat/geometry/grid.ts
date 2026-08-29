import { levelOf } from './sequence'
import type { BeatDoc, Division, Lane } from '../types'

/**
 * The sequencer grid.
 *
 * One row per lane, one column per step, plus a ghost row for whatever the discs
 * are dialled to but not yet placed. Bar lines where the bars fall, a lighter rule
 * on each beat.
 *
 * **Font-free on purpose.** Everything here is the grid; the renderer sets the
 * lane headers into the boxes it is given. That keeps the arithmetic
 * unit-testable and keeps this from being the third module that has to know about
 * a 3.9MB face.
 */

export interface Cell {
  step: number
  on: boolean
  x: number
  y: number
  width: number
  height: number
}

export interface Row {
  /** The lane's syllable, or the dialled one for the ghost row. */
  syllable: string
  /** True for the row that is not a lane yet. */
  ghost: boolean
  /** The lane's level, 0..1. A ghost is always at full — it has no mix yet. */
  level: number
  y: number
  height: number
  cells: Cell[]
  /** Where the lane's own letter is set, left of the steps. */
  header: { x: number; y: number; width: number; height: number }
}

export interface Grid {
  rows: Row[]
  /** Left edge of the first step column. */
  left: number
  column: number
  rowHeight: number
  width: number
  height: number
  /** x of every bar line, the first and last included. */
  bars: number[]
  /** x of every beat that is not already a bar line. */
  beats: number[]
  steps: number
}

export interface GridSpec {
  /** One step's width, px. */
  column: number
  /** One lane's height, px. */
  rowHeight: number
  /** Air between rows, px. */
  gutter: number
  /** Width of the lane-header column, px. */
  header: number
  division: Division
}

/** How many steps make a bar of four. One step is a 1/`division` note. */
export function barSteps(division: Division): number {
  return division
}

export function gridOf(doc: BeatDoc, dialed: string | null, spec: GridSpec): Grid {
  const { column, rowHeight, gutter, header } = spec
  const pitch = rowHeight + gutter

  /*
   * The dialled sound gets a row of its own when it is not already a lane.
   *
   * Without it the machine has nowhere to put a first hit, and the designer has to
   * guess that tapping an existing row would do the wrong thing. With it, the
   * gesture is the same one everywhere: tap a step in the row you want.
   */
  const rows: Array<{ lane: Lane; ghost: boolean }> = doc.lanes.map((lane) => ({
    lane,
    ghost: false,
  }))
  if (dialed && !doc.lanes.some((l) => l.syllable === dialed)) {
    rows.push({
      lane: { syllable: dialed, steps: new Array(doc.steps).fill(false), level: 1 },
      ghost: true,
    })
  }

  const laid: Row[] = rows.map(({ lane, ghost }, index) => {
    const y = index * pitch
    return {
      syllable: lane.syllable,
      ghost,
      level: ghost ? 1 : levelOf(lane),
      y,
      height: rowHeight,
      header: { x: 0, y, width: header, height: rowHeight },
      cells: Array.from({ length: doc.steps }, (_, step) => ({
        step,
        on: lane.steps[step] === true,
        x: header + step * column,
        y,
        width: column,
        height: rowHeight,
      })),
    }
  })

  const width = header + doc.steps * column
  // The last row needs no gutter under it; a trailing one would push whatever
  // sits below down by a gap that is not separating anything.
  const height = laid.length > 0 ? laid.length * pitch - gutter : 0

  const perBar = barSteps(spec.division)
  const perBeat = Math.max(1, spec.division / 4)
  const bars: number[] = []
  const beats: number[] = []
  for (let step = 0; step <= doc.steps; step++) {
    const x = header + step * column
    if (step % perBar === 0) bars.push(x)
    else if (step % perBeat === 0) beats.push(x)
  }

  return {
    rows: laid,
    left: header,
    column,
    rowHeight,
    width,
    height,
    bars,
    beats,
    steps: doc.steps,
  }
}

/**
 * Where the playhead is, for a fractional step.
 *
 * Wrapped, so a loop that has gone round eleven times still draws in the bar — the
 * transport counts up forever and the grid is one bar long.
 */
export function xAt(grid: Grid, step: number): number {
  if (grid.steps === 0) return grid.left
  const wrapped = ((step % grid.steps) + grid.steps) % grid.steps
  return grid.left + wrapped * grid.column
}

/** Which cell a point lands in, for tapping a step. */
export function cellAt(
  grid: Grid,
  x: number,
  y: number,
  gutter: number,
): { row: number; step: number } | null {
  const pitch = grid.rowHeight + gutter
  const row = Math.floor(y / pitch)
  if (row < 0 || row >= grid.rows.length) return null
  // Inside the gutter rather than inside a row: a tap there is between lanes and
  // means nothing, and snapping it to a neighbour would place a hit somewhere the
  // designer did not point.
  if (y - row * pitch > grid.rowHeight) return null

  const step = Math.floor((x - grid.left) / grid.column)
  if (x < grid.left || step < 0 || step >= grid.steps) return null
  return { row, step }
}
