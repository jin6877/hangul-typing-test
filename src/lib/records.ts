import type { Lang, Length } from "./sentences";

export interface BestRecord {
  kpm: number; // 분당 타수 (타/분) — 한글 기준 주지표
  wpm: number; // 분당 단어수 — 영문 기준 주지표
  accuracy: number; // %
  date: string; // ISO
}

const KEY = "hangul-typing-best-v2";

type StoreKey = `${Lang}:${Length}`;
type Store = Partial<Record<StoreKey, BestRecord>>;

function keyOf(lang: Lang, length: Length): StoreKey {
  return `${lang}:${length}`;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

export function getBest(lang: Lang, length: Length): BestRecord | null {
  return read()[keyOf(lang, length)] ?? null;
}

// 새 기록이 더 좋으면 저장하고 갱신 여부를 반환.
// 한글은 KPM, 영문은 WPM을 기준으로 비교한다.
export function saveBest(
  lang: Lang,
  length: Length,
  rec: BestRecord
): boolean {
  const store = read();
  const k = keyOf(lang, length);
  const prev = store[k];
  const metric = lang === "en" ? "wpm" : "kpm";
  if (!prev || rec[metric] > prev[metric]) {
    store[k] = rec;
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}
