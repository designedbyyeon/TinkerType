import type { Lang } from '../../shared/i18n/lang'
import type { ToolCopy } from '../../app/tools'
import { Preview } from './Preview'
import { Stage } from './render/Stage'
import { ToolPanel } from './ToolPanel'

const copy: Record<Lang, ToolCopy> = {
  en: {
    blurb:
      'Draw a line and letters ride a chain of shapes along it. Raise the join and the shapes fuse without losing their own outlines.',
    spec: [
      ['Input', 'Drawn line · Pasted SVG'],
      ['Output', 'Editable SVG'],
      ['Extras', 'Background image · Motion'],
    ],
  },
  ko: {
    blurb:
      '선을 하나 그으면 그 위로 도형이 체인처럼 이어지고 글자가 하나씩 올라탄다. 이음을 올리면 도형끼리 붙되 저마다의 윤곽은 그대로 남는다.',
    spec: [
      ['입력', '그린 선 · 붙여넣은 SVG'],
      ['출력', '편집 가능한 SVG'],
      ['그 밖에', '배경 이미지 · 모션'],
    ],
  },
}

export const diagramTypography = {
  id: 'diagram-typography',
  name: 'Slither',
  copy,
  Preview,
  Panel: ToolPanel,
  Stage,
}
