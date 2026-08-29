import type * as opentype from 'opentype.js'
import type { Rect } from '../../geometry/vec'
import { clampAxis, FACES, type FaceId } from './faces'

/**
 * Reading a face: put it on its axes, pull one glyph's outline, measure it.
 *
 * This is the part of tool 02's layout that was never about sprues. Two tools
 * now draw with these faces and both need the same three lines in the same
 * order, and getting the order wrong is silent — so it lives here once, with the
 * traps written down beside the code that avoids them.
 */

/**
 * One drawing command, matching opentype.js's `PathCommand` so a parsed glyph
 * can be stored without translation.
 *
 * Commands are kept, not just the flattened polyline, because the export has to
 * hand back real curves. A designer who opens the SVG should find a Bézier
 * outline, not a three-hundred-point polygon.
 */
export type Seg =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' }

/**
 * The variable-font API, which `@types/opentype.js` does not have.
 *
 * The types are still on 1.3 while the library is on 2.0 and the axes arrived in
 * between. Declared and cast in this one place rather than augmenting the module
 * — merging an interface into an upstream class across a module boundary is
 * fragile, and a single named cast says what is going on more plainly.
 */
interface VariableFont {
  variation: { set(coords: Record<string, number>): void }
}

/** Where on its axes a face is set. */
export interface Axes {
  wght: number
  wdth: number
}

/**
 * A parsed font, and nothing more.
 *
 * Split from `Face` because most of this module never needed the other half. A
 * `Face` is a parsed font **plus an entry in the shipped registry**, and only
 * `applyAxes` needs that entry — it looks the axes up. Drawing and measuring do
 * not, so they ask for `Parsed` and a caller with a font from anywhere else can
 * use them without inventing a registry id to satisfy the type.
 */
export interface Parsed {
  font: opentype.Font
}

export interface Face extends Parsed {
  id: FaceId
}

/**
 * Put the face on its axes and report the reference letter's height at size 1.
 *
 * Both halves have to happen together. Weight and width move the outlines, which
 * moves the cap height with them, so a unit height measured at one setting is
 * wrong at another — a Size control would quietly mean something different at
 * every weight.
 *
 * `variation.set` is state on the parsed font, and the font is shared by whatever
 * else is drawing. Every caller therefore sets the axes immediately before
 * pulling outlines. Splitting the two apart means the last call wins and the
 * earlier measurement describes a font that no longer exists.
 */
export function applyAxes(face: Face, axes: Axes): number {
  const spec = FACES[face.id]
  const coords: Record<string, number> = {}
  if (spec.wght) coords.wght = clampAxis(spec.wght, axes.wght)
  if (spec.wdth) coords.wdth = clampAxis(spec.wdth, axes.wdth)

  // A static cut has nothing to move, and asking anyway would throw.
  if (Object.keys(coords).length > 0) {
    try {
      ;(face.font as unknown as VariableFont).variation.set(coords)
    } catch {
      // Leave the face where it is rather than fail the whole drawing.
    }
  }

  const box = drawGlyph(face, spec.reference, 0, 1000).bbox
  const height = box.height
  return height > 0 ? height / 1000 : 0.7
}

export interface Drawn {
  commands: Seg[]
  advance: number
  bbox: Rect
}

/**
 * One character's outline with the pen at (x, baseline).
 *
 * Two things here are deliberate and easy to undo by accident.
 *
 * It goes glyph by glyph rather than through `font.getPath(text, …)`, because
 * that path runs opentype.js's shaper and nothing here needs shaping — asking
 * for substitution would only invite the library's gaps.
 *
 * And the advance is read **after** the path is drawn, never before. The library
 * applies the variable-width table inside its glyph transform, which `getPath`
 * triggers; read the other way round you get the default instance's advance, and
 * at heavy weights every letter overlaps the next by a fifth of its width.
 */
export function drawGlyph(face: Parsed, char: string, x: number, fontSize: number): Drawn {
  const glyph = face.font.charToGlyph(char)
  const path = glyph.getPath(x, 0, fontSize, undefined, face.font)
  const box = path.getBoundingBox()
  const scale = fontSize / face.font.unitsPerEm

  return {
    commands: path.commands as Seg[],
    advance: (glyph.advanceWidth ?? 0) * scale,
    bbox: { x: box.x1, y: box.y1, width: box.x2 - box.x1, height: box.y2 - box.y1 },
  }
}

/** Characters the face has no glyph for. Said out loud beats dropped silently. */
export function missingFrom(face: Parsed, text: string): string[] {
  const out: string[] = []
  for (const char of new Set([...text.replace(/\s+/g, '')])) {
    if (!face.font.hasChar(char)) out.push(char)
  }
  return out
}

/**
 * Height of a reference glyph at size 1.
 *
 * What Size means. A face draws its letters at its own scale inside the em, so
 * passing a font size straight through makes the same number come out visibly
 * different per face — and in a mixed line the letters ride up and down. Measure
 * the glyph that matters instead: a Latin cap, or a full-stack Hangul syllable.
 */
export function unitHeight(face: Parsed, reference: string): number {
  const box = drawGlyph(face, reference, 0, 1000).bbox
  return box.height > 0 ? box.height / 1000 : 0.7
}

/** Advance width of a whole run, measured the same way one glyph is. */
export function runWidth(face: Parsed, text: string, fontSize: number): number {
  let x = 0
  for (const char of text) x += drawGlyph(face, char, x, fontSize).advance
  return x
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * A glyph's commands as SVG path data, in the font's own curves.
 *
 * Here rather than in a tool because `Seg` is here: a type and the way it is
 * written out belong together, and a second tool now needs the same twenty
 * lines. Tool 02 keeps its own wrapper because a *contour* has one extra rule —
 * it must close — which a glyph outline as a whole does not.
 */
export function outlineData(commands: Seg[]): string {
  const out: string[] = []
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        out.push(`M${round(cmd.x)} ${round(cmd.y)}`)
        break
      case 'L':
        out.push(`L${round(cmd.x)} ${round(cmd.y)}`)
        break
      case 'Q':
        out.push(`Q${round(cmd.x1)} ${round(cmd.y1)} ${round(cmd.x)} ${round(cmd.y)}`)
        break
      case 'C':
        out.push(
          `C${round(cmd.x1)} ${round(cmd.y1)} ${round(cmd.x2)} ${round(cmd.y2)} ${round(cmd.x)} ${round(cmd.y)}`,
        )
        break
      case 'Z':
        out.push('Z')
        break
    }
  }
  return out.join('')
}
