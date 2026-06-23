# 타닥타닥 · 한글·영문 타이핑 속도 테스트

> 자모(초성·중성·종성)를 분해해 **실제 타건수(KPM)**를 정확히 측정하는 한글·영문 타이핑 속도 테스트

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-8B5CF6)

## 🔗 라이브 데모

**[https://hangul-typing-test.vercel.app](https://hangul-typing-test.vercel.app)**

![앱 스크린샷](docs/screenshot.png)

## ✨ 주요 기능

- 🌐 **한글 / 영문 모드** — 언어 토글로 한국어·영어 연습을 전환합니다. 한글은 **KPM(타/분)**, 영문은 **WPM(단어/분)**을 주지표로 보여줍니다.
- ⌨️ **실시간 속도 측정** — 따라 치는 즉시 주지표(KPM/WPM)와 정확도가 갱신됩니다.
- 🧩 **정확한 한글 타건수 계산** — 완성형 한글을 유니코드 기준으로 초성·중성·종성으로 분해하고, 받침 유무와 복합 자모(ㅘ, ㄳ 등)까지 반영해 **실제 키보드 타건수**로 계산합니다. (단순 글자수가 아님)
- 🎯 **정확도(%) & 오타 측정** — 정확히 친 글자 비율과 누적 오타 개수를 보여줍니다.
- 🌈 **실시간 색상 하이라이트** — 맞은 글자는 초록, 틀린 글자는 빨강, 현재 위치는 깜빡이는 커서로 표시됩니다.
- 🇰🇷 **한글 IME 조합 입력 처리** — `compositionstart` / `compositionend`로 조합 중인 글자를 안전하게 다뤄, 조합 중간 상태에서 오타로 오판하지 않습니다.
- 📚 **랜덤 지문 풀** — 한국어·영어 명언·문장을 랜덤으로 제공하고, `Tab` 키 또는 버튼으로 다음 문장을 받을 수 있습니다.
- 📝 **짧은 글 / 긴 글 모드** — 난이도와 분량을 골라 연습할 수 있습니다.
- 🏆 **결과 리포트** — KPM / WPM / CPM(글자/분) / 정확도 / 걸린 시간을 한눈에.
- 💾 **최고 기록 저장** — `localStorage`에 언어·길이별 최고 기록을 저장해 갱신 시 알려줍니다.

## 🧮 한글 타수 계산 방식

```
완성형 한글 (가 ~ 힣, U+AC00 ~ U+D7A3)
  → (글자코드 - 0xAC00) 로 오프셋 계산
  → 종성 = offset % 28
  → 중성 = (offset % 588) / 28
  → 초성 = offset / 588

타건수 = 초성(1타) + 중성(1~2타) + 종성(0~2타)
  · 복합 중성(ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ) = 2타
  · 복합 종성(ㄳ ㄵ ㄶ ㄺ … ㅄ) = 2타
영문 / 숫자 / 공백 / 문장부호 = 1타
```

예) `값` = ㄱ(1) + ㅏ(1) + ㅄ(2) = **4타**, `안녕하세요` = 3+3+2+2+2 = **12타** (한컴타자 등 두벌식 실입력 타수 기준과 일치)

> **속도 공식**: `KPM = 타건수 / 경과시간(분)`, `WPM = (글자수 / 5) / 경과시간(분)`.
> 타이머는 첫 입력 시점에 시작되고 마지막 글자를 정확히 입력한 시점에 종료됩니다.

## 🛠 기술 스택

- **React 19** + **TypeScript**
- **Vite 8** (빌드 / 개발 서버)
- **Tailwind CSS 4** (`@tailwindcss/vite` 플러그인)
- **JetBrains Mono** 모노스페이스 폰트
- 100% 클라이언트 사이드 — 서버 / API 불필요

## 🚀 로컬 실행

```bash
npm install
npm run dev
```

빌드:

```bash
npm run build
npm run preview
```

## ⌨️ 단축키

| 키 | 동작 |
| --- | --- |
| `Tab` | 새 문장으로 교체 |
| `Enter` | (결과 화면) 다음 문장 |

## 📄 라이선스

MIT
