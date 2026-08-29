import type { Lang } from '../../i18n/lang'
import bigShouldersUrl from './fonts/BigShoulders.ttf?url'
import kumbhSansUrl from './fonts/KumbhSans.ttf?url'
import poppinsUrl from './fonts/PoppinsBlack.ttf?url'

export type FaceId = 'bigshoulders' | 'kumbhsans' | 'poppins' | 'gothica1' | 'unjamo'

/**
 * Which writing system a face is here for.
 *
 * Not a label: it changes what the tool can offer. Hangul has a level below the
 * letter — the syllable is built from two or three jamo — so a face that can draw
 * them earns the `Jamo` part unit, and Latin does not.
 */
export type Script = 'latin' | 'hangul'

export interface Axis {
  min: number
  max: number
}

export interface FaceSpec {
  id: FaceId
  /**
   * The face's own name, printed as its foundry prints it. Never translated —
   * `Poppins` is `Poppins` and `조선일보 견고딕` is that, in either language.
   */
  name: string
  /**
   * One line on what this face brings to a runner, per language.
   *
   * Prose, not a label, and it is shown in the panel — so it turns over with the
   * rest of the panel. The name above it does not.
   */
  note: Record<Lang, string>
  /**
   * Where the file is — or how to go and find out.
   *
   * A Latin cut is a couple of hundred kilobytes and its URL is named here. A
   * Hangul cut is megabytes, and **naming it here would put the reference in the
   * index's module graph**: this file is loaded on the front page, and a static
   * `?url` line is what dragged a 3.9MB face into the index once already. A
   * thunk keeps the URL inside a chunk of its own, fetched by whoever actually
   * picks the face.
   */
  url: string | (() => Promise<string>)
  /** Latin or Hangul, which decides what the panel may offer. */
  script: Script
  /** The reference letter whose drawn height Size means. */
  reference: string
  /**
   * Absent on a face with no weight axis — a single static cut. The one such
   * face here is Poppins, which has no variable version, so its mass is fixed
   * and the Weight row does not appear for it.
   */
  wght?: Axis
  /** Absent on faces with only a weight axis. */
  wdth?: Axis
}

/**
 * The shipped faces, all SIL OFL, all static TTF files.
 *
 * Each one is checked against how a browser renders the same text before it is
 * offered here. Gabarito was in this list and came out: its outlines lead the
 * piece grouping to read the counters of A, R, P, B and 4 as solid, so those
 * letters came out filled where a browser shows them hollow. See the
 * counter-structure test in `glyphs.test.ts` — that check is the gate for adding
 * a face, and no amount of liking a typeface gets past it. Outfit, Sora, Lexend,
 * Montserrat, Unbounded and Hanken Grotesk were all measured and all failed the
 * same way, some of them with rounder O's than the faces that got in.
 *
 * Weight is the one type decision that belongs to this tool rather than to the
 * typeface: a part has to carry enough mass that a gate can be visibly thinner
 * than it, and that judgement changes with the size on the page. So a weight axis
 * is preferred — but Poppins has no variable cut and is round enough to be worth
 * shipping without one, which is why the axes here are optional.
 *
 * The ranges are read off the fonts' own `fvar` tables, not guessed.
 *
 * No face currently has a width axis. The plumbing for one is still here, and is
 * the same optional-axis mechanism that weight now needs, so it costs nothing to
 * keep while the choice of face is still moving.
 *
 * **The two Hangul faces are the two ways Hangul is set, not two flavours of one
 * way.** A square-frame face fits every syllable into the same box, whatever it
 * is built from; a three-set face gives each jamo one shape and lets the syllable
 * come out whatever height it comes out. On a runner that difference is
 * structural rather than stylistic — see the note on each.
 *
 * **UnJamo Dotum is GPL-2, not OFL**, which makes it the one face here that is
 * not under the licence the rest share. It is in `public/fonts/` with the
 * others; the reason it is worth the exception is that it is the only complete,
 * freely redistributable three-set face there is.
 */
export const FACES: Record<FaceId, FaceSpec> = {
  bigshoulders: {
    id: 'bigshoulders',
    name: 'Big Shoulders',
    note: {
      en: 'Condensed by drawing, so it goes narrow without a width axis.',
      ko: '너비 축 없이 그리기로 좁혀 놓은 서체라, 축이 없어도 좁게 나간다.',
    },
    url: bigShouldersUrl,
    script: 'latin',
    reference: 'H',
    wght: { min: 100, max: 900 },
  },
  kumbhsans: {
    id: 'kumbhsans',
    name: 'Kumbh Sans',
    note: {
      en: 'Geometric. The roundest O of the five, and it stays round when heavy.',
      ko: '기하학적. 다섯 중 O가 가장 둥글고, 굵어져도 둥근 채로 남는다.',
    },
    url: kumbhSansUrl,
    script: 'latin',
    reference: 'H',
    wght: { min: 100, max: 900 },
  },
  poppins: {
    id: 'poppins',
    name: 'Poppins',
    note: {
      en: 'The roundest O there is. Fixed at Black — no variable cut exists.',
      ko: 'O가 가장 둥근 서체. Black 하나로 고정 — 베리어블 판이 없다.',
    },
    url: poppinsUrl,
    script: 'latin',
    reference: 'H',
  },
  gothica1: {
    id: 'gothica1',
    name: 'Gothic A1',
    note: {
      en: 'Square frame: every syllable fills the same box, so the sheet comes out a grid.',
      ko: '네모꼴: 모든 음절이 같은 상자를 채우므로 사출 판이 격자로 나온다.',
    },
    url: () => import('./fonts/GothicA1Black.ttf?url').then((m) => m.default),
    script: 'hangul',
    /*
     * A full stack, not a bare letter. `한` has an initial, a vowel and a final,
     * which is the tallest a syllable gets — measure `이` instead and Size means
     * something different in every word.
     */
    reference: '한',
  },
  unjamo: {
    id: 'unjamo',
    name: 'UnJamo Dotum',
    note: {
      en: 'Three-set: one shape per jamo, so the syllable comes out the height it is.',
      ko: '세벌식: 자모마다 한 벌씩이라 음절 높이가 나오는 대로 나온다.',
    },
    url: () => import('./fonts/UnJamoDotum.ttf?url').then((m) => m.default),
    script: 'hangul',
    reference: '한',
  },
}

export const FACE_LIST: FaceSpec[] = [
  FACES.bigshoulders,
  FACES.kumbhsans,
  FACES.poppins,
  FACES.gothica1,
  FACES.unjamo,
]

/** The face's file, fetched now if that is what it takes. */
export const faceUrl = (spec: FaceSpec): Promise<string> =>
  typeof spec.url === 'string' ? Promise.resolve(spec.url) : spec.url()

/** Keep a requested axis value inside what the face actually offers. */
export function clampAxis(axis: Axis | undefined, value: number): number {
  if (!axis) return value
  return Math.max(axis.min, Math.min(axis.max, value))
}
