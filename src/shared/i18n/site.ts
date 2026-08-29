import { useLangStore, type Lang } from './lang'

/*
 * The shell's own words: the index, and the handful of strings the shared
 * controls say for themselves.
 *
 * What is **not** here is as considered as what is. `ON`/`OFF`, `px`, `bpm`,
 * `st`, `°`, `×`, `SVG`, `OBJ`, `STL`, `WAV` and every numeral stay as they are
 * in both languages. They are not English — they are the mono register, the
 * language of measurement, and it is the half of the panel that makes it an
 * instrument. Translating a unit would be the same mistake as translating a
 * typeface's name.
 */

const en = {
  /** `05 tools` under the wordmark. */
  count: (n: number) => `${String(n).padStart(2, '0')} ${n === 1 ? 'tool' : 'tools'}`,
  railLabel: 'Tools',
  lede:
    'Instruments for making the thing, not templates of it. Each hands back something you can take away and work on.',
  licence: 'SIL Open Font License · Chosun Ilbo',
  /** Shared controls. */
  giveColour: 'Give it a colour',
  setNone: 'Set to none',
  allTools: 'All tools',

  /** Import failures, raised from `media/images.ts` and `geometry/importSvg.ts`. */
  imgUnreadable: 'That image could not be read',
  imgUnopenable: 'That image could not be opened',
  imgNotAnImage: 'That is not an image file',
  imgSvgInstead: 'Paste an SVG as paths instead',
  imgUnusable: 'That image could not be used',
  svgUnreadable: 'That SVG could not be read',
  svgNotAnSvg: 'That is not an SVG',
  svgUnmeasurable: 'That SVG could not be measured',
  svgNoOutlines: 'No usable outlines in that SVG',
  pasteUnusable: 'That paste could not be used',
}

export type SiteCopy = typeof en

const ko: SiteCopy = {
  count: (n: number) => `도구 ${String(n).padStart(2, '0')}`,
  railLabel: '도구',
  lede:
    '결과물의 틀이 아니라 그것을 만드는 기계다. 하나하나가 가져가서 계속 작업할 수 있는 파일을 돌려준다.',
  licence: 'SIL 오픈 폰트 라이선스 · 조선일보',
  giveColour: '색을 지정',
  setNone: '색 없음으로',
  allTools: '전체 도구',

  imgUnreadable: '그 이미지를 읽을 수 없었다',
  imgUnopenable: '그 이미지를 열 수 없었다',
  imgNotAnImage: '이미지 파일이 아니다',
  imgSvgInstead: 'SVG는 패스로 붙여넣어 달라',
  imgUnusable: '그 이미지는 쓸 수 없다',
  svgUnreadable: '그 SVG를 읽을 수 없었다',
  svgNotAnSvg: 'SVG가 아니다',
  svgUnmeasurable: '그 SVG를 잴 수 없었다',
  svgNoOutlines: '그 SVG에 쓸 만한 윤곽선이 없다',
  pasteUnusable: '그 붙여넣기는 쓸 수 없다',
}

export const SITE: Record<Lang, SiteCopy> = { en, ko }

/**
 * The same copy, read outside a render.
 *
 * For the modules that raise these messages — an image importer, an SVG parser,
 * a camera — none of which run inside a component. Reading the store's current
 * value is the rule those places already follow for the document; a language is
 * no different.
 */
export const siteWords = (): SiteCopy => SITE[useLangStore.getState().lang]
