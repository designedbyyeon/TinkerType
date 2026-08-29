import { useSignFace } from '../../shared/media/type/hangul/face'
import { DEFAULT_DOC } from './store'
import { View } from './render/View'

/**
 * The index still, drawn by the real renderer rather than by a stored picture.
 *
 * Same layout engine, same lighting, same glyph pipeline — so the card cannot
 * drift from what the tool actually makes. A shorter line than the tool's own
 * default, because the card is small and a sixteen-storey tower would arrive as
 * a column of specks.
 */
const DOC = {
  ...DEFAULT_DOC,
  text: '오밀조밀 붙은 간판',
  // The card's own ground, so all three index stills sit on one surface.
  background: 'var(--paper-sunk)',
}

export function Preview() {
  const { face } = useSignFace()
  // Until the face arrives the card shows its own ground, which reads as still
  // loading rather than as broken.
  if (!face) return <div className="billboard-preview" style={{ background: DOC.background }} />
  return (
    <div className="billboard-card" style={{ background: DOC.background }}>
      <View doc={DOC} face={face} className="billboard-preview" still />
    </div>
  )
}
