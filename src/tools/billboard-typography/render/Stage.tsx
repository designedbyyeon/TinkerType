import { useSignFace } from '../../../shared/media/type/hangul/face'
import { useStore } from '../store'
import { useCopy } from '../../../shared/i18n/lang'
import { COPY } from '../copy'
import { View } from './View'

export function Stage() {
  const doc = useStore((s) => s.doc)
  const { face, loading, error } = useSignFace()
  const c = useCopy(COPY)

  /*
   * The canvas is the work area, edge to edge. There is no artboard border and
   * no page format — the same rule the other two tools follow, and here it also
   * means the framing is free to grow with the building.
   *
   * The ground is painted here rather than in the scene: the canvas is
   * transparent, so the colour never goes through the tone mapper and matches the
   * site's paper exactly. See `View.tsx`.
   */
  return (
    <div className="stage billboard-stage" style={{ background: doc.background }}>
      {face && <View doc={doc} face={face} />}
      {!face && <p className="stage-status">{error ?? (loading ? c.loading : null)}</p>}
    </div>
  )
}
