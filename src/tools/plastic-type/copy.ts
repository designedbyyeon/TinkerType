import type { Lang } from '../../shared/i18n/lang'

/** Everything this tool says out loud. Korean typed against English. */
const en = {
  groups: {
    page: 'Page',
    text: 'Text',
    split: 'Split',
    paint: 'Paint',
    solid: 'Solid',
    runner: 'Runner',
    gate: 'Gate',
    sheet: 'Sheet',
    export: 'Export',
  },
  form: 'Form',
  flat: 'Flat',
  solidForm: 'Solid',
  ground: 'Ground',
  zoom: 'Zoom',

  latin: 'Latin',
  hangul: 'Hangul',
  size: 'Size',
  weight: 'Weight',
  width: 'Width',
  tracking: 'Tracking',

  /*
   * The middle rung is renamed rather than relabelled per face. `Letter` and
   * `Syllable` are the same cut — one character — but calling a 음절 a letter is
   * wrong in the way that makes a tool feel written by someone who has not set
   * the language.
   */
  unitLetter: 'Letter',
  unitJamo: 'Jamo',
  unitSyllable: 'Syllable',
  unitWord: 'Word',
  unitLine: 'Line',
  unitAll: 'All',
  part: 'Part',
  runner: 'Runner',
  splitNote:
    'Whatever the split, a stroke that stands on its own is its own part — the tittle of an i gets a gate of its own, because it would fall off without one.',

  onePlastic: 'One plastic',
  perRunner: 'Per runner',
  sprue: (letter: string) => `Sprue ${letter}`,
  cycleNote: 'A runner and its parts are one shot of one plastic, so they share a colour.',

  gate: 'Gate',
  depthNote:
    'One flat back, three heights. The part stands proud of the frame that carries it and the gate is left as a recess between them — the notch you would put the snips into. A gate deeper than its runner is held down to it.',
  bevel: 'Bevel',
  gloss: 'Gloss',
  bevelNote:
    'A perfectly sharp edge is the one thing no moulded part has, and putting that line of light back is most of what stops this reading as a drawing with shading on it.',

  density: 'Density',
  wall: 'Wall',
  mouldRadius: 'Mould radius',
  corner: 'Corner',
  cellBars: 'Cell bars',
  tieFrames: 'Tie frames',

  atRunner: 'At runner',
  atPart: 'At part',
  gateNote: 'The narrow end is where you would cut the part free.',

  across: 'Across',
  oneRow: 'one row',
  injectionTab: 'Injection tab',
  plate: 'Plate',

  working: 'WORKING',
  stillLoading: 'Outlines are still loading',
  exportFailed: 'Export failed',
  exportSolid:
    'The sheet as a solid, about 200mm on its long side — a real sprue. Parts, frames and gates all arrive; OBJ carries no colour, so the two plastics come out as one object to paint.',
  exportFlat: 'Parts, gates and frames come out as paths. Plate labels stay live text.',
  /*
   * The PNG says something different in each form, and the difference is worth a
   * line: in the solid form the file carries the angle you orbited to, where the
   * model file carries no camera at all.
   */
  exportPngSolid:
    'The PNG is this view, from where you have put the camera, about 2400px on its long side.',
  exportPngFlat:
    'The PNG is the same drawing at about 2400px on its long side, ground included.',
  viewNotReady: 'The view is not ready',

  /** Stage. */
  loading: 'Loading outlines…',
  loadingRenderer: 'Loading the renderer…',
  missing: (list: string) => `Not in this face — ${list}`,
  orbitHint: 'Drag to orbit · Scroll to zoom · Right-drag to pan',
  nothingToMould: 'Nothing to mould',
  previewLabel: 'Plastic Type preview',
}

export type Copy = typeof en

const ko: Copy = {
  groups: {
    page: '지면',
    text: '글자',
    split: '분해',
    paint: '색',
    solid: '입체',
    runner: '런너',
    gate: '게이트',
    sheet: '사출 판',
    export: '내보내기',
  },
  form: '형태',
  flat: '평면',
  solidForm: '입체',
  ground: '바탕',
  zoom: '배율',

  latin: '라틴',
  hangul: '한글',
  size: '크기',
  weight: '굵기',
  width: '너비',
  tracking: '자간',

  unitLetter: '낱자',
  unitJamo: '자모',
  unitSyllable: '음절',
  unitWord: '낱말',
  unitLine: '줄',
  unitAll: '전체',
  part: '부품',
  runner: '런너',
  splitNote:
    '어느 단위로 자르든, 홀로 떨어져 있는 획은 그 자체로 하나의 부품이다 — i의 점에도 게이트가 따로 붙는다. 없으면 떨어져 나가기 때문이다.',

  onePlastic: '한 가지 플라스틱',
  perRunner: '런너마다',
  sprue: (letter) => `스프루 ${letter}`,
  cycleNote: '런너와 그 부품들은 한 번에 사출된 같은 플라스틱이므로 색을 함께 쓴다.',

  gate: '게이트',
  depthNote:
    '뒷면은 하나로 평평하고 높이는 셋이다. 부품이 그것을 물고 있는 프레임보다 솟아 있고, 게이트는 그 사이에 파인 홈으로 남는다 — 니퍼를 넣을 자리다. 런너보다 깊은 게이트는 런너 높이까지 눌린다.',
  bevel: '모따기',
  gloss: '광택',
  bevelNote:
    '완벽하게 날카로운 모서리는 성형 부품에 없는 유일한 것이고, 그 빛의 선을 되돌려 놓는 것이 이것을 음영 넣은 그림으로 읽히지 않게 하는 것의 대부분이다.',

  density: '밀도',
  wall: '벽 두께',
  mouldRadius: '성형 반경',
  corner: '모서리',
  cellBars: '셀 바',
  tieFrames: '프레임 잇기',

  atRunner: '런너 쪽',
  atPart: '부품 쪽',
  gateNote: '좁은 쪽 끝이 부품을 잘라 내는 자리다.',

  across: '가로 개수',
  oneRow: '한 줄',
  injectionTab: '주입 탭',
  plate: '명판',

  working: '작업 중',
  stillLoading: '윤곽선을 아직 불러오는 중이다',
  exportFailed: '내보내기 실패',
  exportSolid:
    '사출 판을 입체로, 긴 변 약 200mm — 실제 스프루 하나다. 부품·프레임·게이트가 모두 따라간다. OBJ는 색을 싣지 않으므로 두 가지 플라스틱이 칠할 하나의 오브젝트로 나온다.',
  exportFlat: '부품·게이트·프레임이 패스로 나온다. 명판의 글자는 살아 있는 텍스트로 남는다.',
  exportPngSolid: 'PNG는 지금 이 시점 그대로다 — 카메라를 둔 자리까지. 긴 변 약 2400px.',
  exportPngFlat: 'PNG는 같은 그림을 긴 변 약 2400px로 굽는다. 지면 색까지 들어간다.',
  viewNotReady: '아직 그려지지 않았다',

  loading: '윤곽선 불러오는 중…',
  loadingRenderer: '렌더러 불러오는 중…',
  missing: (list) => `이 서체에 없는 글자 — ${list}`,
  orbitHint: '드래그로 궤도 · 휠로 줌 · 오른쪽 드래그로 이동',
  nothingToMould: '성형할 것이 없다',
  previewLabel: 'Plastic Type 미리보기',
}

export const COPY: Record<Lang, Copy> = { en, ko }
