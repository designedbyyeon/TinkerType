import { applyAxes, layoutSheet, type Face } from '../geometry/layout'
import { planRunner, type RunnerPlan, type RunnerStyle } from '../geometry/runner'
import { stylesFor, type PlasticDoc } from '../types'

/**
 * The document as a planned sheet — the one place the pipeline is written down.
 *
 * Four callers need it and they must not disagree: the flat stage, the solid
 * stage, the index still, and the model file. A file that came out of a different
 * pipeline than the picture is a file nobody can trust, and the two forms of this
 * tool have to be the same sheet seen twice rather than two sheets.
 *
 * **The order of the first two lines decides the result.** `applyAxes` moves the
 * parsed outlines, so the reference height has to be measured on the face as it
 * will actually be drawn — and the measuring has to happen in the same call, or
 * the last setter wins and the size was solved for a font that no longer exists.
 */
export function sheetOf(face: Face, doc: PlasticDoc): { plan: RunnerPlan; style: RunnerStyle } | null {
  const unitHeight = applyAxes(face, { wght: doc.wght, wdth: doc.wdth })
  const styles = stylesFor(doc, doc.size / unitHeight)

  const sheet = layoutSheet(doc.text, doc.partUnit, doc.runnerUnit, face, styles.layout)
  if (sheet.frames.length === 0) return null

  return { plan: planRunner(sheet, styles.runner), style: styles.runner }
}
