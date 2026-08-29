import { useMemo } from 'react'
import { missingFrom } from '../geometry/layout'
import { useFace } from '../../../shared/media/type/store'
import { useStore } from '../store'
import { useCopy } from '../../../shared/i18n/lang'
import { COPY } from '../copy'
import { sheetOf } from './plan'
import { SolidView } from './SolidView'

/**
 * The sheet as a moulded object.
 *
 * The same plan as the flat stage, from the same function — the two forms have to
 * be one sheet seen twice. The ground is painted here rather than in the scene:
 * the canvas is transparent, so the colour never goes through the tone mapper and
 * stays exactly the paper the flat sheet is printed on.
 *
 * **No page size is written back.** The flat stage measures the stage into the
 * document because the SVG needs a viewBox; here the renderer measures its own
 * canvas, and putting a pixel size into the document would only mean the solid
 * form could dirty the artwork by being looked at in a different window.
 */
export function SolidStage() {
  const doc = useStore((s) => s.doc)
  const { face, loading, error } = useFace(doc.face)
  const c = useCopy(COPY)

  const sheet = useMemo(() => (face ? sheetOf(face, doc) : null), [face, doc])

  const missing = face ? missingFrom(face, doc.text) : []
  const status =
    error ??
    (loading
      ? c.loading
      : missing.length > 0
        ? c.missing(missing.join(' '))
        : sheet
          ? // The stage has to say what it can be done to. There is no camera
            // group on the rail — the view is not part of the document — so this
            // line is the only place the tool can offer it.
            c.orbitHint
          : c.nothingToMould)

  return (
    <div className="stage" style={{ background: doc.background }}>
      {sheet && <SolidView plan={sheet.plan} style={sheet.style} doc={doc} />}
      <p className="stage-status">{status}</p>
    </div>
  )
}
