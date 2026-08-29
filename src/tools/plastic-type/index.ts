import type { Lang } from '../../shared/i18n/lang'
import type { ToolCopy } from '../../app/tools'
import { Preview } from './Preview'
import { Stage } from './render/Stage'
import { ToolPanel } from './ToolPanel'

const copy: Record<Lang, ToolCopy> = {
  en: {
    blurb:
      'Letters as a model kit runner. Every stroke that stands alone gets its own gate, and the frame branches inward to reach the ones it cannot.',
    spec: [
      ['Input', 'Hangul · Latin'],
      // Two forms, three files. The flat sheet is the SVG it is showing; the
      // solid one is moulded, orbits under the hand, and leaves as a model. Both
      // can also be handed over as pixels — the one you send rather than the one
      // you keep working on.
      ['Output', 'Editable SVG · OBJ · PNG'],
      ['Extras', 'Jamo split · Sprue colours'],
    ],
  },
  ko: {
    blurb:
      '글자를 프라모델 런너로 만든다. 홀로 떨어진 획마다 게이트가 하나씩 붙고, 프레임이 닿지 못하는 자리에는 안쪽으로 가지를 뻗는다.',
    spec: [
      ['입력', '한글 · 라틴'],
      ['출력', '편집 가능한 SVG · OBJ · PNG'],
      ['그 밖에', '자모 분해 · 런너별 색'],
    ],
  },
}

export const plasticType = {
  id: 'plastic-type',
  name: 'Plastic Type',
  copy,
  Preview,
  Panel: ToolPanel,
  Stage,
}
