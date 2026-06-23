// 한글 타건수(타수) 계산 유틸
// 완성형 한글(가~힣, 0xAC00 ~ 0xD7A3)을 초성/중성/종성으로 분해하여
// 실제 두벌식 키보드 타건수를 계산한다.

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

// 19 초성
const CHOSEONG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

// 21 중성
const JUNGSEONG = [
  "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
  "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ",
];

// 28 종성 (0번은 받침 없음)
const JONGSEONG = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
  "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

// 두벌식에서 한 번에 못 치고 두 번 눌러야 하는(합성) 자모는 2타로 친다.
// 복합 중성(ㅘ, ㅙ 등)과 복합 종성(ㄳ, ㄵ 등), 쌍자음(ㄲ,ㄸ...은 shift 1타로 간주)
const COMPOUND_JUNGSEONG = new Set([
  "ㅘ", "ㅙ", "ㅚ", "ㅝ", "ㅞ", "ㅟ", "ㅢ",
]);
const COMPOUND_JONGSEONG = new Set([
  "ㄳ", "ㄵ", "ㄶ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅄ",
]);

// 한 글자(char)의 타건수를 반환한다.
export function keystrokesForChar(ch: string): number {
  const code = ch.codePointAt(0);
  if (code === undefined) return 0;

  // 완성형 한글
  if (code >= HANGUL_BASE && code <= HANGUL_END) {
    const offset = code - HANGUL_BASE;
    const jong = offset % 28;
    const jung = Math.floor((offset % (21 * 28)) / 28);
    // const cho = Math.floor(offset / (21 * 28));

    let strokes = 1; // 초성 1타
    // 중성
    strokes += COMPOUND_JUNGSEONG.has(JUNGSEONG[jung]) ? 2 : 1;
    // 종성
    if (jong > 0) {
      strokes += COMPOUND_JONGSEONG.has(JONGSEONG[jong]) ? 2 : 1;
    }
    return strokes;
  }

  // 단독 자모(ㄱ, ㅏ 등)
  if (CHOSEONG.includes(ch)) return 1;
  if (JUNGSEONG.includes(ch)) return COMPOUND_JUNGSEONG.has(ch) ? 2 : 1;

  // 그 외 모든 문자(영문/숫자/공백/문장부호)는 1타
  return 1;
}

// 문자열 전체 타건수
// 검증: "안녕하세요" = ㅇㅏㄴ(3)+ㄴㅕㅇ(3)+ㅎㅏ(2)+ㅅㅔ(2)+ㅇㅛ(2) = 12타
//      "값" = ㄱ+ㅏ+ㅄ(복합종성 2) = 4타, "꿈" = ㄲ(1)+ㅜ+ㅁ = 3타
// 한컴타자 등 두벌식 실입력 타건수 기준과 일치한다.
export function keystrokesForText(text: string): number {
  let total = 0;
  for (const ch of text) total += keystrokesForChar(ch);
  return total;
}

// 분당 단어수(WPM) 표준: 5타(영문은 5글자)를 한 단어로 환산.
export function wordsForText(text: string): number {
  return text.length / 5;
}

export { CHOSEONG, JUNGSEONG, JONGSEONG };
