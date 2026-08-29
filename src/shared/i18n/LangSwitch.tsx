import { useLangStore, type Lang } from './lang'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ko', label: 'KO' },
]

/**
 * Two names of two languages, in the two languages' own alphabets — the only
 * control on the site that has to read the same whichever one is on, so it is
 * the one row that never translates.
 *
 * Set in mono at the meta size, which is what it is: a reading off the document,
 * next to the tool's own. **No accent.** Accent means "this is live under your
 * hand"; a language is a standing fact, and spending the site's one loud colour
 * on it would make the switch the brightest thing in a panel full of work.
 */
export function LangSwitch() {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)

  return (
    <div className="lang-switch" role="group" aria-label="Language / 언어">
      {LANGS.map((l, i) => (
        <span key={l.value}>
          {i > 0 && <i aria-hidden>/</i>}
          <button
            type="button"
            lang={l.value}
            className={l.value === lang ? 'is-active' : ''}
            aria-pressed={l.value === lang}
            onClick={() => setLang(l.value)}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  )
}
