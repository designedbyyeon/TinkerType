import type { Lang } from '../../shared/i18n/lang'
import type { Grip } from './hand/landmarks'

/**
 * Everything this tool says out loud. Korean typed against English.
 *
 * **The text field is not in here.** This tool is Latin only — the three shipped
 * Latin cuts are what it draws with — so the sample line stays as it is whichever
 * language the panel is in, and the panel says so out loud rather than leaving a
 * Korean reader to find out by typing 한글 and watching it vanish.
 */
const en = {
  groups: {
    page: 'Page',
    text: 'Text',
    circle: 'Circle',
    paint: 'Paint',
    sigil: 'Sigil',
    hand: 'Hand',
    export: 'Export',
  },
  ground: 'Ground',
  mirror: 'Mirror',
  photoDim: 'Photo dim',
  clearFrame: 'Clear the frame',
  mirrorNote:
    'You are performing at your own hand, so the feed is mirrored. The capture is flipped with it — the file is what you were looking at.',

  latinOnly:
    'This one is set in Latin — the reference is a hand with Latin type going round it, and the sample opens that way in either language. The Hangul faces are in the list and they draw, so a Korean line works if you want one.',
  ringNote: 'One line, one ring. The first line is the outermost.',
  face: 'Face',
  weight: 'Weight',
  size: 'Size',
  step: 'Step',
  fill: 'Fill',
  fillRepeat: 'Repeat to close',
  fillRing: 'Space out to close',
  fillNatural: 'Own width',
  tracking: 'Tracking',
  between: 'Between',

  reach: 'Reach',
  palms: 'palms',
  radius: 'Radius',
  bloom: 'Bloom',
  spin: 'Spin',
  line: (i: number) => `Line ${i}`,
  gutter: 'Gutter',
  bands: 'Bands',
  bandOut: 'Outside the rule',
  bandIn: 'Inside the rule',
  bandAlternate: 'Alternating',

  ink: 'Ink',
  disc: 'Disc',
  discOpacity: 'Disc opacity',
  paintNote:
    'Over footage the ink usually wants to go white. The disc is for the frames where even that will not read.',

  rim: 'Rim',
  bandRules: 'Band rules',
  rule: 'Rule',
  ticks: 'Ticks',
  innerRings: 'Inner rings',
  starPoints: 'Star points',
  none: 'none',
  skip: 'Skip',
  spokes: 'Spokes',
  sigilNote:
    'All optional, and all of it off to begin with. The tool is named after a figure of speech; what it sets is type on a circle.',

  followHand: 'Follow hand',
  followSpin: 'Follow spin',
  handNote:
    'Opening your hand always blooms the plate — that is the tool. These two are the rest of it: where the plate sits and how big, and whether turning your wrist turns the type.',

  captureFirst: 'CAPTURE FIRST',
  working: 'WORKING',
  exportFailed: 'Export failed',
  exportLive:
    'The lens is still open, and a live feed is not part of the document. Press the shutter and the frame becomes one.',
  exportNote:
    'Letters come out as outlines, rules and stars as paths, and the frame as an embedded JPEG. Each ring is a group named after its own line.',

  /** Stage. */
  loading: 'Loading outlines…',
  startingCamera: 'Starting the camera — the hand model is 20MB on first use',
  missing: (list: string) => `Not in this face — ${list}`,
  noRoom: (n: number) => `No room for ${n} more ${n === 1 ? 'line' : 'lines'} — raise Radius or lower Size`,
  capture: 'CAPTURE',
  stop: 'STOP',
  starting: 'STARTING',
  cameraAgain: 'CAMERA AGAIN',
  turnOnCamera: 'TURN ON CAMERA',
  cancel: 'CANCEL',
  noHand: 'NO HAND',
  grip: { fist: 'FIST', opening: 'OPENING', open: 'OPEN' } as Record<Grip, string>,
  cue: 'Make a fist at the lens, then open your hand.',

  /** Camera failures, from `hand/tracker.ts`. */
  camNotReady: 'The camera view is not ready',
  camRefused: 'Camera access was refused — allow it in the browser bar',
  camNotFound: 'No camera was found',
  camBusy: 'The camera is busy in another app',
  camFailed: 'The camera could not be started',
}

export type Copy = typeof en

const ko: Copy = {
  groups: {
    page: '지면',
    text: '글줄',
    circle: '원',
    paint: '색',
    sigil: '시길',
    hand: '손',
    export: '내보내기',
  },
  ground: '바탕',
  mirror: '좌우 반전',
  photoDim: '사진 흐리기',
  clearFrame: '사진 지우기',
  mirrorNote:
    '자기 손을 보며 연기하는 것이므로 피드가 좌우로 뒤집혀 있다. 촬영본도 같이 뒤집힌다 — 파일이 곧 보고 있던 그 장면이다.',

  latinOnly:
    '이 도구는 라틴으로 짜는 것을 전제로 만들었다 — 레퍼런스가 손 하나와 그 주위를 도는 라틴 활자이고, 그래서 샘플은 어느 언어에서든 라틴으로 열린다. 목록의 한글 서체도 그려지므로 한글 글줄을 원하면 된다.',
  ringNote: '한 줄이 하나의 고리. 첫 줄이 가장 바깥이다.',
  face: '서체',
  weight: '굵기',
  size: '크기',
  step: '체감',
  fill: '채움',
  fillRepeat: '반복해서 닫기',
  fillRing: '벌려서 닫기',
  fillNatural: '자기 폭대로',
  tracking: '자간',
  between: '사이 기호',

  reach: '뻗음',
  palms: '뼘',
  radius: '반지름',
  bloom: '펼침',
  spin: '회전',
  line: (i) => `${i}번째 줄`,
  gutter: '고리 간격',
  bands: '띠 기준',
  bandOut: '괘선 바깥',
  bandIn: '괘선 안쪽',
  bandAlternate: '번갈아',

  ink: '잉크',
  disc: '원판',
  discOpacity: '원판 불투명도',
  paintNote:
    '영상 위에서는 잉크가 대개 흰색으로 가고 싶어 한다. 원판은 그것으로도 읽히지 않는 장면을 위한 것이다.',

  rim: '테두리',
  bandRules: '띠 괘선',
  rule: '선 두께',
  ticks: '눈금',
  innerRings: '안쪽 고리',
  starPoints: '별 꼭짓점',
  none: '없음',
  skip: '건너뜀',
  spokes: '살',
  sigilNote:
    '전부 선택이고, 처음에는 전부 꺼져 있다. 이 도구의 이름은 비유이고, 실제로 하는 일은 원 위에 활자를 앉히는 것이다.',

  followHand: '손 따라가기',
  followSpin: '손목 따라 회전',
  handNote:
    '손을 펴면 판은 언제나 펼쳐진다 — 그것이 이 도구다. 이 둘은 나머지다: 판이 어디에 얼마나 크게 앉을지, 그리고 손목을 돌리면 활자도 도는지.',

  captureFirst: '먼저 촬영',
  working: '작업 중',
  exportFailed: '내보내기 실패',
  exportLive:
    '렌즈가 아직 열려 있고, 라이브 피드는 문서의 일부가 아니다. 셔터를 누르면 그 장면이 문서가 된다.',
  exportNote:
    '글자는 윤곽선으로, 괘선과 별은 패스로, 사진은 내장 JPEG으로 나간다. 고리 하나가 자기 글줄의 이름을 단 그룹 하나다.',

  loading: '윤곽선 불러오는 중…',
  startingCamera: '카메라를 켜는 중 — 손 모델은 처음 한 번 20MB를 받는다',
  missing: (list) => `이 서체에 없는 글자 — ${list}`,
  noRoom: (n) => `${n}줄이 더 들어갈 자리가 없다 — 반지름을 올리거나 크기를 낮춘다`,
  capture: '촬영',
  stop: '정지',
  starting: '켜는 중',
  cameraAgain: '카메라 다시',
  turnOnCamera: '카메라 켜기',
  cancel: '취소',
  noHand: '손 없음',
  grip: { fist: '주먹', opening: '펴는 중', open: '편 손' },
  cue: '렌즈 앞에서 주먹을 쥐었다가 손을 펴 보라.',

  camNotReady: '카메라 화면이 아직 준비되지 않았다',
  camRefused: '카메라 권한이 거부됐다 — 주소창에서 허용해 달라',
  camNotFound: '카메라를 찾지 못했다',
  camBusy: '다른 앱이 카메라를 쓰고 있다',
  camFailed: '카메라를 시작할 수 없었다',
}

export const COPY: Record<Lang, Copy> = { en, ko }
