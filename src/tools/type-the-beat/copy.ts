import type { Lang } from '../../shared/i18n/lang'

/*
 * Everything this tool says out loud, in both languages.
 *
 * The Korean is typed against the English (`Copy = typeof en`), so a line added
 * to one and forgotten in the other is a build error rather than a hole that
 * turns up on screen in the wrong language.
 *
 * **The jamo are not in here**, and that is the point of them: `ㄷ ㅇ ㅂ` on the
 * wheels is content, not interface — the same as a Korean word in tool 03's text
 * field. It reads the same whichever language the panel is in.
 */

const en = {
  groups: {
    page: 'Page',
    type: 'Type',
    deck: 'Deck',
    paint: 'Paint',
    voice: 'Voice',
    export: 'Export',
  },
  ground: 'Ground',
  tempo: 'Tempo',
  step: 'Step',
  bar: 'Bar',
  swing: 'Swing',
  repeats: 'Repeats',
  pageNote: (division: number, steps: number) =>
    `One step is a 1/${division} note and the bar is ${steps} of them. Repeats is how many times round the loop the exported file goes.`,

  letter: 'Letter',
  lane: 'Lane',
  typeNote: (face: string) =>
    `${face}. Letter is the size on the machine — the three selected ones spell the syllable in your hand down the middle of the deck, which is why there is no separate read-out. Lane names each row of the bar. There is nothing to type: the letters are the controls.`,

  deckNote:
    'Four places of articulation, the two darkest vowels that stack, and the four ways a syllable can end — which is a kick, a snare, a pad and a hat against closed, cut, ringing and open. There is nothing to choose here: that *is* the kit.',
  wheelsHold: (cho: string, jung: string, jong: string) =>
    `The wheels hold ${cho} · ${jung} · ${jong} and no final.`,
  radius: 'Radius',
  spacing: 'Spacing',
  graduations: 'Graduations',
  readNote:
    "The two wheels read from the sides that face each other — the initial at six o'clock, the final at twelve — so the three selected letters land a letter's height apart and the machine spells what it will play. Spacing is that distance; it stops where one disc would sit inside the other.",
  vowelNote:
    'The vowel is a slider, not a wheel: a short list wants a line, and the gap between two discs is where 세로모임꼴 puts the vowel anyway. Left is lower, which is the slider’s own direction — pushing it is tuning rather than picking.',

  ink: 'Ink',
  disc: 'Disc',
  panel: 'Panel',
  playhead: 'Playhead',
  paintNote:
    'Disc is the face the wheels and the slider are cut from, and it wants to be a shade lighter than Panel — a pale part set into a darker surface, with the letters on it in Ink at full strength. Set Disc dark and the letters go with it.',

  tune: 'Tune',
  attack: 'Attack',
  tail: 'Tail',
  tone: 'Tone',
  drive: 'Drive',
  voiceNote:
    'All five are multipliers on what the letters already said. They can lean the whole kit warmer or longer or harder; they cannot make a ㅁ end like a ㅇ. If they could, the jamo would be labels and this would be a drum machine.',

  rendering: 'RENDERING',
  nothingPlaced: 'Nothing placed yet',
  renderLoop: 'Render the loop',
  exportFailed: 'Export failed',
  exportNote: (repeats: number) =>
    `Rendered offline from the document through the same synthesis the transport plays, so the file is what you heard. 44.1k stereo, ${repeats} times round, with room at the end for the last step to ring out. Nothing has to be played first.`,

  /** Stage. */
  loading: 'Loading outlines…',
  missing: (list: string) => `Not in this face — ${list}`,
  stacksOnly: 'This machine stacks, so the middle wheel holds ㅗ ㅛ ㅜ ㅠ ㅡ',
  empty: 'Dial a sound on the wheels, then tap it into the bar',
  play: 'PLAY',
  stop: 'STOP',
  lanes: (used: number, max: number) => `${used}/${max} LANES`,
}

export type Copy = typeof en

const ko: Copy = {
  groups: {
    page: '지면',
    type: '활자',
    deck: '덱',
    paint: '색',
    voice: '보이스',
    export: '내보내기',
  },
  ground: '바탕',
  tempo: '템포',
  step: '스텝',
  bar: '마디',
  swing: '스윙',
  repeats: '반복',
  pageNote: (division, steps) =>
    `한 스텝이 ${division}분음표이고 한 마디는 그것 ${steps}개다. 반복은 내보내는 파일이 루프를 몇 바퀴 도는지다.`,

  letter: '글자',
  lane: '레인',
  typeNote: (face) =>
    `${face}. 글자는 기계 위의 크기다 — 고른 세 자모가 덱 한가운데에 손에 든 음절을 써 주므로 따로 읽기값을 두지 않았다. 레인은 마디의 각 줄에 붙는 이름이다. 타이핑할 것은 없다: 글자가 곧 컨트롤이다.`,

  deckNote:
    '조음 위치 넷, 세로로 쌓이는 가장 어두운 모음 둘, 그리고 음절이 끝나는 네 가지 방식 — 킥·스네어·패드·하이햇에 맞서 닫힘·끊김·울림·열림이다. 여기서 고를 것은 없다. 그것이 곧 킷이다.',
  wheelsHold: (cho, jung, jong) => `휠에 올라 있는 것은 ${cho} · ${jung} · ${jong} 그리고 받침 없음이다.`,
  radius: '반지름',
  spacing: '간격',
  graduations: '눈금',
  readNote:
    '두 원판은 서로 마주보는 쪽에서 읽는다 — 초성은 6시, 종성은 12시. 그래서 고른 세 글자가 글자 높이만큼 떨어져 한 축에 앉고, 기계가 자기가 연주할 음절을 쓴다. 간격은 그 거리이고, 한 원판이 다른 원판 안으로 들어가는 자리에서 멈춘다.',
  vowelNote:
    '중성은 휠이 아니라 슬라이더다: 짧은 목록은 고리가 아니라 선을 원하고, 두 원판 사이의 틈이 세로모임꼴이 모음을 두는 자리다. 왼쪽이 낮은 쪽이고 그것이 슬라이더 자신의 방향이다 — 미는 것이 고르는 것이 아니라 튜닝이 된다.',

  ink: '잉크',
  disc: '원판',
  panel: '패널',
  playhead: '플레이헤드',
  paintNote:
    '원판은 휠과 슬라이더를 깎아 낸 면이고, 패널보다 한 단 밝아야 한다 — 어두운 표면에 끼워 넣은 밝은 부품, 그 위에 잉크로 또렷하게 앉은 글자. 원판을 어둡게 하면 글자도 따라 묻힌다.',

  tune: '음정',
  attack: '어택',
  tail: '꼬리',
  tone: '음색',
  drive: '드라이브',
  voiceNote:
    '다섯 값 모두 글자가 이미 말한 것에 곱해지는 배수다. 킷 전체를 더 따뜻하게, 더 길게, 더 세게 기울일 수는 있어도 ㅁ을 ㅇ처럼 끝나게 하지는 못한다. 그럴 수 있다면 자모는 라벨이 되고 이것은 그냥 드럼머신이다.',

  rendering: '렌더링 중',
  nothingPlaced: '아직 놓인 스텝이 없다',
  renderLoop: '루프를 렌더한다',
  exportFailed: '내보내기 실패',
  exportNote: (repeats) =>
    `트랜스포트가 연주하는 것과 같은 합성 경로로, 스피커가 아니라 문서에서 오프라인 렌더한다 — 그래서 파일이 곧 들은 소리다. 44.1k 스테레오, 루프 ${repeats}바퀴, 마지막 스텝이 울려 끝날 여유까지. 한 번도 재생하지 않고 내보낼 수 있다.`,

  loading: '윤곽선 불러오는 중…',
  missing: (list) => `이 서체에 없는 글자 — ${list}`,
  stacksOnly: '이 기계는 세로로 쌓으므로 가운데 휠에는 ㅗ ㅛ ㅜ ㅠ ㅡ만 있다',
  empty: '휠을 돌려 소리를 맞추고, 격자에 탭해 넣는다',
  play: '재생',
  stop: '정지',
  lanes: (used, max) => `레인 ${used}/${max}`,
}

export const COPY: Record<Lang, Copy> = { en, ko }
