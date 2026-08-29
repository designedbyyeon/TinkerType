# 이 도구가 손을 읽는 데 쓰는 것

두 조각이다. 둘 다 **Apache License 2.0**, Google LLC.

| 파일 | 어디에 | 크기 |
|---|---|---|
| `hand_landmarker.task` | 여기 (도구 폴더) | 7.8MB |
| `vision_wasm_internal.js` · `.wasm` | `public/vision/` | 11.8MB |

- 모델 출처: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
  — 손바닥 검출기 + 21점 랜드마크 회귀, float16
- 런타임 출처: `node_modules/@mediapipe/tasks-vision/wasm/`
- 라이선스 원문은 `public/vision/LICENSE-Apache-2.0.txt`에 있다. Apache 2.0은
  재배포할 때 원문을 같이 넣도록 요구하고, 빌드 산출물에 들어가는 건 `public/`뿐이다
  — `public/fonts/`에 OFL 원문을 넣어 둔 것과 같은 이유다.

## 왜 저장소에 들어 있는가

MediaPipe 예제는 전부 이 파일들을 CDN에서 받는다. 그러면 **카메라 도구가 네트워크
없이는 손을 못 본다.** 이 저장소는 서체도 구글 폰트로 링크하지 않고 파일로 넣는데,
같은 이유다 — 도구는 자족해야 한다.

## 왜 둘이 다른 자리에 있는가

모델은 `?url`로 실려서 Vite가 해시를 붙여 준다. 런타임은 그럴 수 없다 —
로더(`vision_wasm_internal.js`)가 **자기 `.wasm` 경로를 자기 `.js` 경로에서 문자열
치환으로 만든다.** 콘텐츠 해시가 그 치환을 깨뜨리므로, 이름이 그대로 남는
`public/`에 둔다. `tracker.ts`의 `VISION_ROOT`가 `import.meta.env.BASE_URL`로
그 경로를 만들어서 하위 경로 배포에서도 돈다.

## SIMD 판만 있는 이유

패키지는 세 쌍(SIMD · module · nosimd)을 담고 있고 각 `.wasm`이 11MB 남짓이다.
브라우저는 **셋 중 하나만 받는다** — `FilesetResolver`가 `WebAssembly.instantiate`로
SIMD 지원을 실측해서 고른다. 현행 Safari·Chrome·Firefox는 전부 SIMD를 지원하므로
그 한 쌍만 넣었다. 나머지를 같이 넣으면 아무도 받지 않는 34MB가 저장소에 남는다.

패키지를 올린 뒤에는 다시 복사해야 한다. 스크립트로 박아 뒀다:

```bash
npm run sync:vision
```

## 비용을 어디서 치르는가

**세 단으로 갈라 놨다.**

1. 인덱스 청크에는 **한 바이트도** 안 실린다 — `index.ts`가 `Panel`·`Stage`만
   지연시키고 인덱스 카드(`Preview`)는 즉시 그린다(그건 라틴 서체 셋만 쓴다).
2. 도구를 열면 도구 코드(~9KB)만 받는다.
3. **카메라를 켤 때** 런타임과 모델을 받는다 — `tracker.ts`의 `landmarkerFor`.

**서브셋은 없다.** 폰트와 달리 이 모델은 잘라낼 수 있는 것이 아니다.

## 첫 추론이 비싸다 — 측정해서 옮겼다

블랭크 프레임 기준 정상 추론은 **7~9ms**(최악 24ms)인데, **첫 호출만 수 초**가 든다
(GPU 가속이 없는 환경에서 6.5초를 실측했다). 그래프의 셰이더가 그때 만들어지고,
그 일은 메인 스레드를 막는다. 그래서 `landmarkerFor`가 **모델을 만든 직후 256×256
빈 캔버스로 한 번 돌린다.** 비용이 "starting the camera" 안에서 치러지고, 첫
라이브 프레임은 12ms다.
