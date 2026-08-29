# 도구가 그리는 서체

이 폴더의 파일은 **도구가 아웃라인을 뽑아 쓰는** 서체다. 인터페이스가 설정된 웹폰트는
`media/fonts/`에 따로 있다 — 그 구분이 디렉터리 이름이다.

| 파일 | 서체 | 라이선스 | 크기 |
|---|---|---|---|
| `BigShoulders.ttf` | Big Shoulders (wght 100–900) | OFL | 220KB |
| `KumbhSans.ttf` | Kumbh Sans (wght 100–900) | OFL | 119KB |
| `PoppinsBlack.ttf` | Poppins Black | OFL | 153KB |
| `GothicA1Black.ttf` | Gothic A1 Black — 한글 네모꼴 | OFL | 2.2MB |
| `UnJamoDotum.ttf` | UnJamo Dotum — 한글 세벌식 탈네모꼴 | **GPL-2** | 917KB |

라이선스 원문은 전부 `public/fonts/`에 있다. 재배포하는 쪽이 원문을 같이 넣도록
요구하고, 빌드 산출물에 들어가는 건 `public/`뿐이다.

## 한글 두 종은 왜 이 둘인가

**Gothic A1 Black** — 요청은 "깔끔한 네모꼴 산세리프"였다. 11,172음절 전부, 기하학적,
Black이라 부품이 게이트보다 확실히 두껍다. 굵기 축은 없다(Poppins와 같은 경우다).
Asta Sans가 유일한 한글 베리어블 후보였는데 **opentype.js가 그 축을 못 움직인다** —
`variation.set` 뒤에도 400과 800의 아웃라인이 같게 나왔다. 재서 떨어뜨렸다.

**UnJamo Dotum** — 요청은 "세벌식 탈네모꼴"이었고, **재배포 가능한 라이선스로 존재하는
유일한 완성본이었다.** 찾은 범위: Google Fonts 한글 38종은 전부 네모꼴,
공유마당 OFL 목록도 마찬가지, 눈누 계열은 대부분 폰트 파일 재배포를 금지한다.
안상수체·한겨레결체 같은 고전 탈네모꼴은 재배포 조건이 없거나 맞지 않는다.

## GPL-2가 뜻하는 것 — 결정이 필요한 자리

UnJamo Dotum은 Un 글꼴(Koaunghi Un, 1998–2004; HLaTeX의 type1을 2003년 Won-kyu Park가
TrueType으로 옮긴 것)의 하나이고 **GPL-2**다. 폰트용 예외 조항(font exception)이 붙어
있지 않다.

이 도구는 글리프 아웃라인을 **파일로 내보낸다**(SVG의 패스, OBJ의 정점). 예외 조항이
없는 GPL 폰트에서 그 산출물이 파생물인지는 다투어지는 지점이고, FSF가 폰트 예외를
만든 이유가 바로 그 애매함이다. **상업 작업에 쓸 사람에게는 실질적인 위험이다.**

그래서 이것은 사용자가 알고 고를 문제로 남겨 뒀다. 빼기로 하면 작업은 세 줄이다 —
`faces.ts`의 항목, 이 파일, `public/fonts/`의 라이선스 둘. 배선(한글 등록·자모 분할·
검사)은 서체와 무관하게 남는다.
