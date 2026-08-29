import { useState } from 'react'
import { LangSwitch } from '../shared/i18n/LangSwitch'
import { useCopy, type Lang } from '../shared/i18n/lang'
import { SITE } from '../shared/i18n/site'
import { toolHref } from './router'
import { TOOLS, type ToolCopy } from './tools'

/** Only reachable with an empty register, which the register forbids. */
const NO_COPY: Record<Lang, ToolCopy> = {
  en: { blurb: '', spec: [] },
  ko: { blurb: '', spec: [] },
}

/**
 * The index, as a bench: one large stage showing whatever the rail is pointing
 * at, and the rail on the right. It is the same two-column split the tools
 * themselves use, so the index teaches the interface before you enter one.
 *
 * The rail marks the current item with a dimension leader rather than a shape
 * of its own — a button shaped like tool 01's output would make every later
 * tool wear the first one's face.
 *
 * **The language switch is here, at the top of the rail**, and it is the first
 * decision on the site for the same reason `Page` is the first group in every
 * panel: it is a document-level fact, not a style. Putting it at the foot with
 * the colophon would hide it exactly where a Korean visitor is least likely to
 * look — under a line of English.
 */
export function Home() {
  const [activeId, setActiveId] = useState(TOOLS[0]?.id)
  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0]
  const site = useCopy(SITE)
  // Unconditional: a hook behind a ternary is a hook that changes order.
  const shown = useCopy(active?.copy ?? NO_COPY)

  return (
    <main className="bench">
      <section className="bench-stage">
        <div className="bench-view">{active && <active.Preview />}</div>
        <h1 className="bench-name">{active?.name}</h1>
        <p className="bench-blurb">{shown.blurb}</p>
        <dl className="bench-spec">
          {shown.spec.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="bench-rail" aria-label={site.railLabel}>
        <header className="rail-head">
          <span className="rail-mark">
            <span>TINKER</span>
            <span>TYPE</span>
          </span>
          <span className="rail-side">
            <span className="rail-count">{site.count(TOOLS.length)}</span>
            <LangSwitch />
          </span>
        </header>

        {/* What every tool hands back is named in its own spec table, because
            they no longer agree: editable SVG, solid models, and — since tool 05
            — a sound file. A blanket promise here would be one the site cannot
            keep for all five, which is why the lede below says only that you get
            something you can take away. */}
        <p className="rail-lede">{site.lede}</p>

        <ul className="rail-list">
          {TOOLS.map((tool, i) => (
            <li key={tool.id}>
              <a
                href={toolHref(tool.id)}
                className={`rail-item${tool.id === activeId ? ' is-current' : ''}`}
                onMouseEnter={() => setActiveId(tool.id)}
                onFocus={() => setActiveId(tool.id)}
              >
                <span className="rail-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="rail-t">{tool.name}</span>
              </a>
            </li>
          ))}
        </ul>

        {/* Every face the site ships, named. The licences no longer agree —
            four are OFL and the Korean one is Chosun Ilbo's own — so the second
            line says so rather than claiming one licence for all of them.

            The first line does not translate: those are the faces' names. */}
        <footer className="rail-foot">
          <span>Pretendard · Big Shoulders · Kumbh Sans · Poppins · 조선일보 견고딕</span>
          <span>{site.licence}</span>
        </footer>
      </nav>
    </main>
  )
}
