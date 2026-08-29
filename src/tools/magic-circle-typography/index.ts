import { lazy, Suspense, createElement, type ComponentType } from 'react'
import type { Lang } from '../../shared/i18n/lang'
import type { ToolCopy } from '../../app/tools'
import { Preview } from './Preview'

/**
 * The register entry.
 *
 * Split like tool 03's, and for the same reason at a larger scale: the hand
 * runtime and its model are twenty megabytes between them, and nobody who never
 * opens this tool should pay for a byte of it. **But the split is drawn in a
 * different place.** Tool 03 defers its still as well, because its still needs a
 * Korean face a megabyte deep. This one's still needs nothing the index does not
 * already have — the same three Latin faces tools 01 and 02 draw with — so the
 * card is eager and draws the moment the page does. Only the Panel and the Stage
 * are deferred, which is where the camera lives.
 *
 * There is a second split inside that one, in `hand/tracker.ts`: opening the tool
 * fetches its own code, and *switching the lens on* is what fetches the runtime
 * and the model. A designer setting a plate on paper never triggers it.
 *
 * The `Tool` interface still has not changed a line — four tools, two of them
 * lazy in different amounts, one of them holding a camera.
 */

const defer = <T extends ComponentType>(load: () => Promise<{ default: T }>, fallback: string) => {
  const Lazy = lazy(load)
  return () => createElement(Suspense, { fallback: createElement('div', { className: fallback }) }, createElement(Lazy))
}

const Panel = defer(() => import('./ToolPanel').then((m) => ({ default: m.ToolPanel })), 'panel')
const Stage = defer(() => import('./render/Stage').then((m) => ({ default: m.Stage })), 'stage')

const copy: Record<Lang, ToolCopy> = {
  en: {
    blurb:
      'Type set on a circle, driven by a hand. Every line becomes its own ring, stepping down in size as it goes in, each one placed where you want it — and it writes itself on as you open your hand at the lens. The shutter freezes the frame and the hand together.',
    spec: [
      ['Input', 'Latin'],
      ['Output', 'SVG · real outlines + frame'],
      ['Extras', 'Webcam hand tracking · no camera needed to set type'],
    ],
  },
  ko: {
    blurb:
      '원 위에 앉힌 활자를 손이 움직인다. 한 줄이 하나의 고리가 되고 안으로 들어갈수록 크기가 한 단씩 줄며, 고리마다 원하는 자리에 놓인다 — 렌즈 앞에서 손을 펼치면 글자가 스스로 써진다. 셔터가 그 장면과 손을 함께 굳힌다.',
    spec: [
      ['입력', '라틴'],
      ['출력', 'SVG · 진짜 윤곽선 + 사진'],
      ['그 밖에', '웹캠 손 추적 · 조판만 할 때는 카메라가 필요 없다'],
    ],
  },
}

export const magicCircleTypography = {
  id: 'magic-circle-typography',
  name: 'Magic Circle Typography',
  copy,
  Preview,
  Panel,
  Stage,
}
