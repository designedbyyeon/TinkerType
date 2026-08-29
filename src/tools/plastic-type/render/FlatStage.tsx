import { useEffect, useMemo, useRef } from 'react'
import { missingFrom } from '../geometry/layout'
import { useFace } from '../../../shared/media/type/store'
import { useStore } from '../store'
import { useCopy } from '../../../shared/i18n/lang'
import { COPY } from '../copy'
import { sheetOf } from './plan'
import { RunnerArt } from './RunnerArt'

/** Air left around the sheet when it is fitted to the view. */
const MARGIN = 0.055

/**
 * The sheet as flat artwork — the tool's first form, and the one that leaves as
 * an editable SVG.
 *
 * What is on screen *is* what is exported: the same SVG DOM, minus the editing
 * overlay. The solid form is a second view of the same plan and lives next door;
 * `Stage.tsx` picks between them.
 */
export function FlatStage() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const stageRef = useRef<HTMLDivElement>(null)
  const c = useCopy(COPY)

  const { face, loading, error } = useFace(doc.face)

  // The work area is whatever the window gives us; the sheet is then fitted
  // into it. There is no page edge to stay inside.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const measure = () => {
      const width = Math.max(1, Math.round(stage.clientWidth))
      const height = Math.max(1, Math.round(stage.clientHeight))
      const current = useStore.getState().doc
      if (current.width === width && current.height === height) return
      setDoc({ width, height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [setDoc])

  /*
   * One quality, not two.
   *
   * There was a draft pass here for dragging. It came out of the first
   * measurement, where a phrase in a single frame took forty-six milliseconds —
   * but nearly all of that was the search for somewhere to hang each gate
   * widening as cell bars piled up, not curve flattening. Bounding that search
   * by box distance brought the worst case to five milliseconds, at which point
   * the coarse pass measured the same as the fine one. Keeping it would have
   * been machinery for a cost that no longer exists.
   */

  const plan = useMemo(() => (face ? (sheetOf(face, doc)?.plan ?? null) : null), [face, doc])

  // Fit the sheet into the view, then let zoom take it past the edge if the
  // designer wants a bleed.
  const placement = useMemo(() => {
    if (!plan || plan.bounds.width <= 0 || plan.bounds.height <= 0) return null
    const inset = Math.min(doc.width, doc.height) * MARGIN
    const fit = Math.min(
      (doc.width - inset * 2) / plan.bounds.width,
      (doc.height - inset * 2) / plan.bounds.height,
    )
    const scale = Math.max(0.01, fit * doc.zoom)
    return {
      scale,
      x: (doc.width - plan.bounds.width * scale) / 2 - plan.bounds.x * scale,
      y: (doc.height - plan.bounds.height * scale) / 2 - plan.bounds.y * scale,
    }
  }, [plan, doc.width, doc.height, doc.zoom])

  // Characters the face has no glyph for are dropped silently by the geometry,
  // so they get said out loud instead.
  const missing = face ? missingFrom(face, doc.text) : []
  const status =
    error ??
    (loading
      ? c.loading
      : missing.length > 0
        ? c.missing(missing.join(' '))
        : null)

  return (
    <div ref={stageRef} className="stage" style={{ background: doc.background }}>
      <svg
        id="artwork"
        className="artwork"
        xmlns="http://www.w3.org/2000/svg"
        width={doc.width}
        height={doc.height}
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={0} y={0} width={doc.width} height={doc.height} fill={doc.background} />

        {plan && placement && (
          <g transform={`translate(${placement.x} ${placement.y}) scale(${placement.scale})`}>
            <RunnerArt plan={plan} doc={doc} />
          </g>
        )}
      </svg>

      {status && (
        <p className="stage-status">
          {status}
        </p>
      )}
    </div>
  )
}
