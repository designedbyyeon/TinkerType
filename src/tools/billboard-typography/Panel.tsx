import { useState } from 'react'
import { HOME_HREF } from '../../app/router'
import { Group, Note, Scrub, Swatch } from '../../shared/ui/controls'
import { DownloadIcon } from '../../shared/ui/icons'
import { saveModel, type ModelFormat } from './render/exportModel'
import { layoutOf, readingOrder } from './geometry/layout'
import { viewOf } from './geometry/plan'
import { DepthMark, OrderMark, PadMark } from './marks'
import { useSignFace } from '../../shared/media/type/hangul/face'
import { wordsOf } from './scene/words'
import { useStore } from './store'
import { useCopy } from '../../shared/i18n/lang'
import { LangSwitch } from '../../shared/i18n/LangSwitch'
import { SITE } from '../../shared/i18n/site'
import { COPY } from './copy'
import { styleOf } from './types'

/**
 * The rail, in the order the thing gets made.
 *
 * Document first, then the words, then the rough arrangement, then colour, then
 * the finishing — the same order the other two tools use, and for the same
 * reason: a board's size and spacing cannot be judged before its colour is
 * settled, because a pale board on a dark wall reads heavier than a dark one.
 *
 * **There is no camera group.** The composition is the tool. A view that can be
 * moved is a view that can be moved wrong, and every decision in the layout —
 * the corner rule, the depth-shift gaps, the reading order — is built around one
 * angle.
 */
export function Panel() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const pushHistory = useStore((s) => s.pushHistory)
  const { face, loading, error } = useSignFace()
  const c = useCopy(COPY)
  const site = useCopy(SITE)
  const [busy, setBusy] = useState<ModelFormat | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  function save(format: ModelFormat) {
    if (!face) return
    setBusy(format)
    setFailed(null)
    // A tick so the button repaints before the model is built; a long line makes
    // a lot of geometry and the click would otherwise look like it did nothing.
    setTimeout(() => {
      try {
        saveModel({ doc, face, format, filename: `billboard.${format}` })
      } catch (e) {
        setFailed(e instanceof Error ? e.message : c.exportFailed)
      } finally {
        setBusy(null)
      }
    }, 0)
  }

  // The line, read back the way the building presents it: by row, then by where
  // each board lands on screen. It is the tool's one claim, so it is on the rail
  // rather than in a test only.
  const reading = face
    ? readingOrder(layoutOf(wordsOf(face, doc.text), styleOf(doc)), viewOf(doc.azimuth))
        .map((s) => s.text)
        .join(' ')
    : null

  return (
    <aside className="panel">
      <header className="masthead">
        <a className="wordmark" href={HOME_HREF} title={site.allTools}>
          <span>BILLBOARD</span>
          <span>TYPOGRAPHY</span>
        </a>
        <span className="masthead-side">
          <span className="masthead-meta">STREET</span>
          <LangSwitch />
        </span>
      </header>

      {/* 1 — the document. Ground is a property of the sheet, not of a style. */}
      <Group title={c.groups.page}>
        <Swatch label={c.ground} value={doc.background} onChange={(v) => setDoc({ background: v })} />
      </Group>

      {/* 2 — the line. Everything downstream is a consequence of its length. */}
      <Group title={c.groups.text}>
        <textarea
          className="text-input billboard-text"
          value={doc.text}
          spellCheck={false}
          rows={3}
          onFocus={pushHistory}
          onChange={(e) => setDoc({ text: e.target.value })}
        />
        {error && <Note>{error}</Note>}
        {!error && loading && <Note>{c.loading}</Note>}
        {reading && <Note>{c.readsBack(reading)}</Note>}
      </Group>

      {/* 3 — the rough arrangement, before any of it is coloured. */}
      <Group title={c.groups.arrangement}>
        <Scrub label={c.seed} value={doc.seed} min={1} max={99} emphasis onChange={(v) => setDoc({ seed: v })} />
        <Scrub
          label={c.order}
          value={doc.order}
          min={0}
          max={1}
          step={0.01}
          mark={<OrderMark value={doc.order} />}
          onChange={(v) => setDoc({ order: v })}
        />
        <Scrub
          label={c.padding}
          value={doc.pad}
          min={0}
          max={1.6}
          step={0.02}
          mark={<PadMark value={doc.pad} />}
          onChange={(v) => setDoc({ pad: v })}
        />
        <Scrub
          label={c.width}
          value={doc.width}
          min={0.6}
          max={2}
          step={0.02}
          onChange={(v) => setDoc({ width: v })}
        />
        <Scrub
          label={c.height}
          value={doc.height}
          min={0.5}
          max={2}
          step={0.02}
          onChange={(v) => setDoc({ height: v })}
        />
        <Scrub
          label={c.girth}
          value={doc.girth}
          min={0.15}
          max={1.2}
          step={0.01}
          onChange={(v) => setDoc({ girth: v })}
        />
        <Scrub
          label={c.relief}
          value={doc.depth}
          min={0}
          max={2}
          step={0.05}
          mark={<DepthMark value={doc.depth} />}
          onChange={(v) => setDoc({ depth: v })}
        />
        <Scrub
          label={c.angle}
          value={doc.azimuth}
          min={0}
          max={40}
          unit="°"
          onChange={(v) => setDoc({ azimuth: v })}
        />
        <Note>{c.boardNote}</Note>
        <Note>{c.orderNote}</Note>
        <Note>{c.proportionNote}</Note>
      </Group>

      {/* 4 — colour, before the finishing. A board's weight depends on it. */}
      <Group title={c.groups.paint}>
        <Swatch label={c.sign} value={doc.sign} onChange={(v) => setDoc({ sign: v })} />
        <Swatch label={c.wall} value={doc.wall} onChange={(v) => setDoc({ wall: v })} />
        <Note>{c.paintNote}</Note>
      </Group>

      {/* 5 — the light. */}
      <Group title={c.groups.light}>
        <Scrub
          label={c.occlusion}
          value={doc.occlusion}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => setDoc({ occlusion: v })}
        />
        <Scrub label={c.sun} value={doc.key} min={0} max={3} step={0.05} onChange={(v) => setDoc({ key: v })} />
        <Note>{c.lightNote}</Note>
      </Group>

      {/* 6 — the small parts. */}
      <Group title={c.groups.detail}>
        <Scrub
          label={c.density}
          value={doc.detail}
          min={0}
          max={1.8}
          step={0.05}
          onChange={(v) => setDoc({ detail: v })}
        />
        <Scrub
          label={c.bevel}
          value={doc.bevel}
          min={0}
          max={0.16}
          step={0.005}
          onChange={(v) => setDoc({ bevel: v })}
        />
        <Note>{c.detailNote}</Note>
        <Note>{c.bevelNote}</Note>
      </Group>

      {/* 7 — the model itself, not a picture of it. */}
      <Group title={c.groups.export}>
        <button
          type="button"
          className="export-btn"
          disabled={!face || busy !== null}
          onClick={() => save('obj')}
        >
          <DownloadIcon />
          <span>{busy === 'obj' ? c.working : 'OBJ'}</span>
        </button>
        <button
          type="button"
          className="export-btn"
          disabled={!face || busy !== null}
          onClick={() => save('stl')}
        >
          <DownloadIcon />
          <span>{busy === 'stl' ? c.working : 'STL'}</span>
        </button>
        <Note>{c.exportNote}</Note>
        {failed && <Note>{failed}</Note>}
      </Group>
    </aside>
  )
}
