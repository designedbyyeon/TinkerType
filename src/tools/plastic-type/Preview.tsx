import { useMemo } from 'react'
import { useFace } from '../../shared/media/type/store'
import { sheetOf } from './render/plan'
import { DEFAULT_DOC } from './store'
import { useCopy } from '../../shared/i18n/lang'
import { COPY } from './copy'
import { RunnerArt } from './render/RunnerArt'

const WIDTH = 620
const HEIGHT = 420

/**
 * The index still, drawn by the real pipeline rather than by a stored picture.
 *
 * Same layout, same gates, same branches — so the card cannot drift from what the
 * tool actually makes. Until the face arrives the card shows its own ground,
 * which reads as still loading rather than as broken.
 */
const DOC = {
  ...DEFAULT_DOC,
  width: WIDTH,
  height: HEIGHT,
  // Three across rather than the tool's default column, because the card is
  // landscape and a column would fit by height and leave it mostly empty.
  text: 'KIT',
  // The card's own ground shows through, so both index stills sit on one
  // surface. It is also the plaque's knockout colour.
  background: 'var(--paper-sunk)',
  perRow: 3,
  size: 150,
  density: 0.45,
  round: 9,
}

/*
 * **The card stays Latin in both languages, and that is an architecture rule
 * rather than a copy decision.** Setting `KIT` in Hangul would mean fetching a
 * 3.9MB Korean face on the index — the one thing `faces.ts` is written to
 * prevent. The card is a still of the pipeline, and a Latin still shows every
 * part of it the card is big enough to show.
 */
export function Preview() {
  const { face } = useFace(DOC.face)
  const c = useCopy(COPY)

  const view = useMemo(() => {
    const sheet = face ? sheetOf(face, DOC) : null
    if (!sheet) return null

    const { plan } = sheet
    const inset = 24
    const scale = Math.min(
      (WIDTH - inset * 2) / plan.bounds.width,
      (HEIGHT - inset * 2) / plan.bounds.height,
    )
    return {
      plan,
      transform: `translate(${(WIDTH - plan.bounds.width * scale) / 2 - plan.bounds.x * scale} ${
        (HEIGHT - plan.bounds.height * scale) / 2 - plan.bounds.y * scale
      }) scale(${scale})`,
    }
  }, [face])

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={c.previewLabel}>
      {view && (
        <g transform={view.transform}>
          <RunnerArt plan={view.plan} doc={DOC} />
        </g>
      )}
    </svg>
  )
}
