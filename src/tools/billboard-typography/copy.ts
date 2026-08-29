import type { Lang } from '../../shared/i18n/lang'

/** Everything this tool says out loud. Korean typed against English. */
const en = {
  groups: {
    page: 'Page',
    text: 'Text',
    arrangement: 'Arrangement',
    paint: 'Paint',
    light: 'Light',
    detail: 'Detail',
    export: 'Export',
  },
  ground: 'Ground',

  loading: 'Loading outlines…',
  readsBack: (line: string) => `Reads back as — ${line}`,

  seed: 'Seed',
  order: 'Order',
  padding: 'Padding',
  width: 'Width',
  height: 'Height',
  girth: 'Girth',
  relief: 'Relief',
  angle: 'Angle',
  boardNote:
    'One board per word, no more, and its width comes from its word — a one-syllable shop gets a small sign.',
  orderNote:
    'Order is the dial. At zero every board is the same size, one to a storey, stacked in a column; turning it up lets each take its own width, admits the other depths and the vertical columns, and lets a storey carry more than one.',
  proportionNote:
    'Width, Height and Girth are the building’s proportions and the arrangement follows them — a wider building fits more words per storey, so the same line comes out shorter. Angle feeds the arrangement too: at zero there is no side wall to read, so nothing is put there.',

  sign: 'Sign',
  wall: 'Wall',
  paintNote:
    'One colour for every sign. Six of them read as a colour chart rather than as a street, and the eye sorted the boards by hue instead of reading them — the sentence has to be the only thing that is on.',

  occlusion: 'Occlusion',
  sun: 'Sun',
  lightNote:
    'A photographed model has no key light and no hard shadow — its depth comes from surfaces darkening where they meet. Drop Occlusion to zero and raise Sun to watch it start looking like a render again.',

  density: 'Density',
  bevel: 'Bevel',
  detailNote:
    'Windows under each band, air conditioners, drainpipes. Individually nothing; together they are most of what makes a building read as built rather than as drawn.',
  bevelNote:
    'Bevel takes the edge off every box. A perfectly sharp corner is the one thing no manufactured object has, and it is most of why an untouched render looks like one — a real edge catches a line of light along it.',

  working: 'WORKING',
  exportFailed: 'Export failed',
  exportNote:
    'The building as a solid, about 200mm tall — a desk model, the size of the thing the references are photographs of. Lettering is extruded, so it survives the trip; the base plate stays behind, being scenery.',
}

export type Copy = typeof en

const ko: Copy = {
  groups: {
    page: '지면',
    text: '글줄',
    arrangement: '배치',
    paint: '색',
    light: '빛',
    detail: '디테일',
    export: '내보내기',
  },
  ground: '바탕',

  loading: '윤곽선 불러오는 중…',
  readsBack: (line) => `읽히는 순서 — ${line}`,

  seed: '시드',
  order: '규칙성',
  padding: '여백',
  width: '가로',
  height: '높이',
  girth: '안길이',
  relief: '돌출',
  angle: '방위각',
  boardNote:
    '한 낱말에 간판 하나, 그 이상은 없다. 간판의 폭은 그 낱말에서 나온다 — 한 음절짜리 가게는 작은 간판을 받는다.',
  orderNote:
    '규칙성이 이 도구의 다이얼이다. 0에서는 모든 간판이 같은 크기로 한 층에 하나씩 세로로 쌓인다. 올릴수록 각자 자기 폭을 갖고, 다른 깊이와 세로 기둥이 허용되며, 한 층이 둘 이상을 이고 갈 수 있게 된다.',
  proportionNote:
    '가로·높이·안길이는 건물의 비례이고 배치가 그것을 따른다 — 넓은 건물은 한 층에 더 많은 낱말이 들어가므로 같은 글줄이 더 짧게 나온다. 방위각도 배치의 입력이다: 0에서는 읽을 측면 벽이 없으므로 거기에는 아무것도 놓이지 않는다.',

  sign: '간판',
  wall: '벽',
  paintNote:
    '모든 간판이 한 색이다. 여섯 색이 되면 거리가 아니라 색상표로 읽히고, 눈이 간판을 읽는 대신 색으로 분류하기 시작했다 — 켜져 있어야 하는 것은 문장 하나뿐이다.',

  occlusion: '차폐',
  sun: '햇빛',
  lightNote:
    '사진으로 찍은 모형에는 키라이트도 진한 그림자도 없다. 깊이는 면과 면이 만나는 자리가 어두워지면서 생긴다. 차폐를 0으로 내리고 햇빛을 올리면 다시 렌더처럼 보이기 시작하는 것을 볼 수 있다.',

  density: '밀도',
  bevel: '모따기',
  detailNote:
    '띠마다 아래에 붙는 창, 실외기, 빗물받이. 하나씩은 아무것도 아니지만, 모이면 건물이 그려진 것이 아니라 지어진 것으로 읽히게 하는 것의 대부분이다.',
  bevelNote:
    '모따기가 모든 상자의 모서리를 죽인다. 완벽하게 날카로운 모서리는 공산품에 없는 유일한 것이고, 손대지 않은 렌더가 렌더처럼 보이는 이유의 대부분이 그것이다 — 진짜 모서리는 그 선을 따라 빛을 문다.',

  working: '작업 중',
  exportFailed: '내보내기 실패',
  exportNote:
    '건물을 입체로, 높이 약 200mm — 레퍼런스 사진이 찍은 그 크기의 데스크 모형이다. 글자는 압출되어 그대로 따라가고, 바닥판은 배경이므로 남는다.',
}

export const COPY: Record<Lang, Copy> = { en, ko }
