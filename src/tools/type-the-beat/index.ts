import { lazy, Suspense, createElement, type ComponentType } from 'react'
import type { Lang } from '../../shared/i18n/lang'
import type { ToolCopy } from '../../app/tools'

/**
 * The register entry.
 *
 * **Everything is loaded on demand, and it is the font's fault alone.** Web Audio
 * is native, so the whole synthesis engine, the scheduler and the WAV writer cost
 * nothing but their own source. The Hangul face is 3.9MB and every part of this
 * tool that draws needs it — including the index still — so the split is tool 03's
 * shape rather than tool 04's: the card is deferred too.
 *
 * The exporter is split once more inside that, at the click: `audio/render.ts` is
 * imported when Export is pressed, because the panel is in the tool's own chunk
 * and a renderer nobody presses is a module nobody should parse.
 *
 * **The `Tool` interface has still not changed a line.** Five tools now — one
 * WebGL, one holding a camera, one holding a clock.
 */

const defer = <T extends ComponentType>(load: () => Promise<{ default: T }>, fallback: string) => {
  const Lazy = lazy(load)
  return () => createElement(Suspense, { fallback: createElement('div', { className: fallback }) }, createElement(Lazy))
}

const Panel = defer(() => import('./ToolPanel').then((m) => ({ default: m.ToolPanel })), 'panel')
const Stage = defer(() => import('./render/Stage').then((m) => ({ default: m.Stage })), 'stage')
const Preview = defer(() => import('./Preview').then((m) => ({ default: m.Preview })), 'beat-preview')

const copy: Record<Lang, ToolCopy> = {
  en: {
    blurb:
      'A syllable is an envelope. The initial is the attack — where the mouth closes decides which drum it is — the vowel is the body, and the final is the release: ㅁ stops it, ㅇ rings it, ㄱ cuts it. So you dial a sound on three turntables and tap it into the bar. There is no text field anywhere: the letters are the controls.',
    spec: [
      ['Input', 'Hangul'],
      ['Output', 'WAV · 44.1k stereo loop'],
      ['Extras', 'Web Audio synthesis, no samples · 조선일보 견고딕'],
    ],
  },
  ko: {
    blurb:
      '음절 하나가 엔벨로프 하나다. 초성이 어택이고 — 입이 어디서 닫히느냐가 어느 타악기인지를 정한다 — 중성이 몸통, 종성이 릴리스다: ㅁ은 멈추고, ㅇ은 울리고, ㄱ은 끊는다. 그래서 턴테이블 세 개로 소리를 맞추고 격자에 탭해 한 마디를 짠다. 텍스트 필드는 어디에도 없다 — 글자가 곧 컨트롤이다.',
    spec: [
      ['입력', '한글'],
      ['출력', 'WAV · 44.1k 스테레오 루프'],
      ['그 밖에', '샘플 없는 Web Audio 합성 · 조선일보 견고딕'],
    ],
  },
}

export const typeTheBeat = {
  id: 'type-the-beat',
  name: 'Type the Beat',
  copy,
  Preview,
  Panel,
  Stage,
}
