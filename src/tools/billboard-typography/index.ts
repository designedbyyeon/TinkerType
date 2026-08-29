import { lazy, Suspense, createElement, type ComponentType } from 'react'
import type { Lang } from '../../shared/i18n/lang'
import type { ToolCopy } from '../../app/tools'

/**
 * The register entry.
 *
 * **Everything here is loaded on demand**, and this is the first tool that had
 * to be. three.js is roughly the size of the entire rest of the site, and the
 * index page has no use for it — a visitor who never opens this tool should
 * never pay for it. Wrapping each lazy component in a plain one keeps
 * `app/tools.ts` exactly as it was: the `Tool` interface has not needed a single
 * change across three tools, and it would be a shame to spend it on this.
 *
 * The Hangul face is fetched the same way. It is a full 11,172-syllable cut at
 * **3.9MB**, which is survivable at the end of a dynamic import and would be
 * indefensible in the index. **Subsetting it is the outstanding cost here** —
 * nothing in the build does that yet.
 */

const defer = <T extends ComponentType>(load: () => Promise<{ default: T }>, fallback: string) => {
  const Lazy = lazy(load)
  return () => createElement(Suspense, { fallback: createElement('div', { className: fallback }) }, createElement(Lazy))
}

const Panel = defer(() => import('./ToolPanel').then((m) => ({ default: m.ToolPanel })), 'panel')
const Stage = defer(() => import('./render/Stage').then((m) => ({ default: m.Stage })), 'stage')
const Preview = defer(() => import('./Preview').then((m) => ({ default: m.Preview })), 'billboard-preview')

const copy: Record<Lang, ToolCopy> = {
  en: {
    blurb:
      'A line of text becomes a building. The signs look scattered across two walls and up a dozen storeys, and read back in order.',
    spec: [
      ['Input', 'Hangul'],
      ['Output', 'OBJ · STL'],
      ['Extras', 'Fixed axonometric · 조선일보 견고딕'],
    ],
  },
  ko: {
    blurb:
      '글줄 하나가 건물이 된다. 간판은 두 벽면과 열두 층에 흩어진 것처럼 보이지만, 순서대로 다시 읽힌다.',
    spec: [
      ['입력', '한글'],
      ['출력', 'OBJ · STL'],
      ['그 밖에', '고정 축측투영 · 조선일보 견고딕'],
    ],
  },
}

export const billboardTypography = {
  id: 'billboard-typography',
  name: 'Billboard Typography',
  copy,
  Preview,
  Panel,
  Stage,
}
