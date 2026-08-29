import { create } from 'zustand'

/**
 * The site's language, and the one piece of state that is not a document.
 *
 * **Rule nine used to say every letter on screen is English.** That rule was
 * protecting something real — a fixed-width uppercase label makes an instrument,
 * and a panel with two languages in it makes neither. What it got wrong was the
 * remedy: the way to keep one language on screen is to *keep one language on
 * screen*, not to keep one language full stop. Setting both at once — 지면 GROUND
 * — is the version that breaks the tone, and it is the version this replaces.
 *
 * So: one language at a time, chosen once, remembered. The rule below it is
 * unchanged in spirit and written down again in CLAUDE.md.
 *
 * **Not in a document.** A language is a property of the reader, not of the
 * poster they are making — putting it in `doc` would freeze it into every undo
 * snapshot and hand a designer their own panel back in the other language on a
 * Ctrl-Z (bug type 15, exactly).
 */
export type Lang = 'en' | 'ko'

const KEY = 'tinkertype.lang'

/** Guessed from the browser on a first visit, and never guessed again. */
function initial(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'ko') return saved
  } catch {
    /* private mode has no storage; the guess below still works */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ko')
    ? 'ko'
    : 'en'
}

/**
 * Stamp the root element.
 *
 * `lang` is for the browser — line breaking and font fallback differ by script.
 * `data-lang` is for the stylesheets: a Korean label cannot wear
 * `text-transform: uppercase` and 0.09em of tracking, because Hangul has no case
 * and the tracking pulls a syllable apart. One attribute re-sets every label in
 * the site (`shared/styles/controls.css`), and the numerals stay monospaced —
 * the mono is the language of *measurement*, and that half never translates.
 */
function stamp(lang: Lang) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang
  document.documentElement.dataset.lang = lang
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLangStore = create<LangState>((set) => ({
  lang: initial(),
  setLang: (lang) => {
    try {
      window.localStorage.setItem(KEY, lang)
    } catch {
      /* ignore */
    }
    stamp(lang)
    set({ lang })
  },
}))

stamp(useLangStore.getState().lang)

export function useLang(): Lang {
  return useLangStore((s) => s.lang)
}

/**
 * The copy for whichever language is on.
 *
 * A tool's `copy.ts` types its Korean against its English, so a missing line is
 * a build error rather than a hole that shows up on screen in the wrong
 * language.
 */
export function useCopy<T>(copy: Record<Lang, T>): T {
  return copy[useLangStore((s) => s.lang)]
}
