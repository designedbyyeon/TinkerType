import type { Lang } from '../../shared/i18n/lang'
import type { PlasticDoc } from './types'

/**
 * The opening sheet, per language — the one place where the language switch
 * reaches past the interface and into the document.
 *
 * A sample has one job: to be the thing the tool makes, on the first screen,
 * with nothing to set up. That job is not done by a Latin word in front of a
 * reader who came here to set Hangul — and this tool's whole claim is that it
 * does both, so the first screen may as well say which one you are looking at.
 *
 * **The Korean sheet opens cut at the jamo**, which is the claim itself: `활` is
 * not one shape with a Korean face on it, it is three, and a kit that comes
 * apart at that seam is a different kit. The Latin sheet cannot offer that rung
 * at all — there is nothing below the letter — so it opens at the letter.
 *
 * **Nothing here overwrites work.** `isSample` below is what the switch asks
 * first: swap the sample only while the sheet still *is* a sample. Type one
 * character of your own and the language switch goes back to being a switch for
 * the panel.
 */
export const SAMPLES: Record<Lang, Pick<PlasticDoc, 'text' | 'face' | 'partUnit' | 'runnerUnit' | 'perRow'>> = {
  en: {
    // Twelve characters at a frame each is a kit — which is what this is — and
    // it reads as its own label while it does it.
    text: 'PLASTIC TYPE',
    face: 'bigshoulders',
    partUnit: 'syllable',
    runnerUnit: 'syllable',
    perRow: 4,
  },
  ko: {
    // Six syllables, three across: the same lattice read as a sheet. Longer and
    // the parts come out too small to see a gate, which is the one thing the
    // first screen has to show.
    text: '플라스틱 활자',
    face: 'gothica1',
    partUnit: 'jamo',
    runnerUnit: 'syllable',
    perRow: 3,
  },
}

/** Is this sheet still one of the samples, untouched? */
export const isSample = (text: string): boolean =>
  Object.values(SAMPLES).some((s) => s.text === text)
