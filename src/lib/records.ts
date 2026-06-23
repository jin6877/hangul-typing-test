import type { Mode } from "./sentences";

export interface BestRecord {
  kpm: number; // 분당 타수 (타/분)
  accuracy: number; // %
  wpm: number;
  date: string; // ISO
}

const KEY = "hangul-typing-best-v1";

type Store = Partial<Record<Mode, BestRecord>>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

export function getBest(mode: Mode): BestRecord | null {
  return read()[mode] ?? null;
}

// 새 기록이 더 좋으면(타수 기준) 저장하고 갱신 여부를 반환
export function saveBest(mode: Mode, rec: BestRecord): boolean {
  const store = read();
  const prev = store[mode];
  if (!prev || rec.kpm > prev.kpm) {
    store[mode] = rec;
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}
