import { lazy, Suspense } from 'react'
import { useStore } from '../store'
import { useCopy } from '../../../shared/i18n/lang'
import { COPY } from '../copy'
import { FlatStage } from './FlatStage'

/**
 * Which form of the sheet is on the stage.
 *
 * **The solid half is loaded on demand, and only that half.** three.js is roughly
 * the size of the rest of the site, and this tool's flat form — which is what it
 * opens as — has no use for it. Deferring the whole tool the way tool 03 does
 * would make a visitor pay for a renderer to look at an SVG; deferring nothing
 * would put it in the index chunk, where every visitor pays for it to look at the
 * front page. So the seam is here, at the one control that decides whether a
 * renderer is needed at all. The register above sees a plain component and the
 * `Tool` interface still has not changed a line.
 */
const SolidStage = lazy(() => import('./SolidStage').then((m) => ({ default: m.SolidStage })))

export function Stage() {
  const solid = useStore((s) => s.doc.solid)
  const background = useStore((s) => s.doc.background)
  const c = useCopy(COPY)

  if (!solid) return <FlatStage />

  return (
    <Suspense
      fallback={
        <div className="stage" style={{ background }}>
          <p className="stage-status">{c.loadingRenderer}</p>
        </div>
      }
    >
      <SolidStage />
    </Suspense>
  )
}
