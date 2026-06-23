import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keystrokesForText, wordsForText } from "./lib/hangul";
import { pickRandom, type Lang, type Length } from "./lib/sentences";
import { getBest, saveBest, type BestRecord } from "./lib/records";

interface Result {
  kpm: number; // 타/분
  cpm: number; // 글자/분
  wpm: number; // 단어/분 (5타 = 1 word 표준)
  accuracy: number; // %
  seconds: number;
  totalChars: number;
  errors: number;
  isBest: boolean;
}

export default function App() {
  const [lang, setLang] = useState<Lang>("ko");
  const [length, setLength] = useState<Length>("short");
  const [target, setTarget] = useState(() => pickRandom("ko", "short"));
  const [typed, setTyped] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<BestRecord | null>(() =>
    getBest("ko", "short")
  );
  const [maxErrors, setMaxErrors] = useState(0); // 누적 오타(틀린 적 있는 위치 수)

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  const isEn = lang === "en";

  // 실시간 표시용 타이머 (타이핑 중일 때만 갱신)
  useEffect(() => {
    if (startTime !== null && result === null) {
      const id = window.setInterval(() => setNow(Date.now()), 100);
      return () => window.clearInterval(id);
    }
  }, [startTime, result]);

  const targetArr = useMemo(() => Array.from(target), [target]);

  // 글자별 상태 계산 (조합 중 글자 포함된 typed 기준)
  const charStates = useMemo(() => {
    const typedArr = Array.from(typed);
    return targetArr.map((ch, i) => {
      const t = typedArr[i];
      if (t === undefined) return "pending" as const;
      if (t === ch) return "correct" as const;
      return "wrong" as const;
    });
  }, [targetArr, typed]);

  const caretIndex = Array.from(typed).length;

  // 주지표: 한글은 KPM(타/분), 영문은 WPM(단어/분)
  const metric = useMemo(
    () =>
      isEn
        ? { label: "WPM (단어/분)", key: "wpm" as const }
        : { label: "타/분 (KPM)", key: "kpm" as const },
    [isEn]
  );

  // 실시간 통계
  const liveStats = useMemo(() => {
    const elapsed =
      startTime !== null ? Math.max((now - startTime) / 1000, 0.001) : 0;
    const committed = Array.from(typed);
    let correctChars = 0;
    for (let i = 0; i < committed.length; i++) {
      if (committed[i] === targetArr[i]) correctChars++;
    }
    // 입력한 만큼의 목표 텍스트 기준으로 측정 (실제 친 분량만 카운트)
    const typedTarget = targetArr.slice(0, committed.length).join("");
    const strokes = keystrokesForText(typedTarget);
    const kpm = elapsed > 0 ? Math.round((strokes / elapsed) * 60) : 0;
    const wpm =
      elapsed > 0 ? Math.round((wordsForText(typedTarget) / elapsed) * 60) : 0;
    const primary = isEn ? wpm : kpm;
    const accuracy =
      committed.length > 0
        ? Math.round((correctChars / committed.length) * 100)
        : 100;
    const progress =
      targetArr.length > 0
        ? Math.min(committed.length / targetArr.length, 1)
        : 0;
    return { elapsed, kpm, wpm, primary, accuracy, progress };
  }, [now, startTime, typed, targetArr, isEn]);

  const finishTest = useCallback(
    (finalTyped: string) => {
      const end = Date.now();
      const seconds = startTime !== null ? (end - startTime) / 1000 : 0.001;
      const typedArr = Array.from(finalTyped);
      let correctChars = 0;
      for (let i = 0; i < targetArr.length; i++) {
        if (typedArr[i] === targetArr[i]) correctChars++;
      }
      const totalStrokes = keystrokesForText(target);
      const safeSec = Math.max(seconds, 0.001);
      const kpm = Math.round((totalStrokes / safeSec) * 60);
      const cpm = Math.round((targetArr.length / safeSec) * 60);
      const wpm = Math.round((wordsForText(target) / safeSec) * 60);
      const errors = Math.max(maxErrors, targetArr.length - correctChars);
      const accuracy =
        targetArr.length > 0
          ? Math.round((correctChars / targetArr.length) * 100)
          : 100;

      const rec: BestRecord = {
        kpm,
        wpm,
        accuracy,
        date: new Date().toISOString(),
      };
      const isBest = saveBest(lang, length, rec);
      if (isBest) setBest(rec);

      setResult({
        kpm,
        cpm,
        wpm,
        accuracy,
        seconds: safeSec,
        totalChars: targetArr.length,
        errors,
        isBest,
      });
    },
    [startTime, target, targetArr, lang, length, maxErrors]
  );

  const applyValue = useCallback(
    (value: string) => {
      if (result) return;
      if (startTime === null && value.length > 0) {
        const t = Date.now();
        setStartTime(t);
        setNow(t);
      }
      // 목표 길이를 넘어서지 않게 자르기
      const valArr = Array.from(value);
      const sliced = valArr.slice(0, targetArr.length).join("");
      setTyped(sliced);

      // 현재 틀린 위치 수 누적
      const slicedArr = Array.from(sliced);
      let curErrors = 0;
      for (let i = 0; i < slicedArr.length; i++) {
        if (slicedArr[i] !== targetArr[i]) curErrors++;
      }
      setMaxErrors((m) => Math.max(m, curErrors));

      // 완료 판정: IME 조합이 끝난 상태에서 마지막 글자까지 정확히 입력됨
      if (
        !composingRef.current &&
        slicedArr.length >= targetArr.length &&
        slicedArr.every((c, i) => c === targetArr[i])
      ) {
        finishTest(sliced);
      }
    },
    [result, startTime, targetArr, finishTest]
  );

  const reset = useCallback(
    (next?: { lang?: Lang; length?: Length }) => {
      const l = next?.lang ?? lang;
      const len = next?.length ?? length;
      const keepExclude = next ? undefined : target;
      setTarget(pickRandom(l, len, keepExclude));
      setTyped("");
      setStartTime(null);
      setResult(null);
      setMaxErrors(0);
      setNow(Date.now());
      setBest(getBest(l, len));
      composingRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [lang, length, target]
  );

  const switchLang = (l: Lang) => {
    if (l === lang) return;
    setLang(l);
    reset({ lang: l });
  };

  const switchLength = (len: Length) => {
    if (len === length) return;
    setLength(len);
    reset({ length: len });
  };

  // 키보드 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        reset();
        return;
      }
      if (e.key === "Enter") {
        // 한글 IME 조합 중의 엔터(조합 확정)는 무시
        if (e.isComposing || composingRef.current) return;
        e.preventDefault();
        if (result) {
          // 결과 표시 중 → 다음 문장으로
          reset();
        } else if (startTime !== null) {
          // 타이핑 중(측정 시작됨) → 현재 측정 종료 & 결과 확정
          finishTest(typed);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset, result, startTime, typed, finishTest]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const bestLabel = isEn ? "WPM" : "타/분";
  const bestValue = best ? (isEn ? best.wpm : best.kpm) : null;

  return (
    <div className="min-h-svh w-full bg-[#0b0a12] font-mono text-violet-50 selection:bg-violet-500/40">
      {/* 배경 글로우 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-rose-500/10 blur-[120px]" />
      </div>

      <main className="relative mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-5 py-8 sm:py-12">
        {/* 헤더 */}
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/5 px-3 py-1 text-xs text-violet-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            한글 · 영문 타이핑 속도 테스트
          </div>
          <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-rose-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            타닥타닥 · 타이핑 측정기
          </h1>
          <p className="max-w-md text-sm text-violet-200/60">
            {isEn
              ? "영문 지문으로 WPM(분당 단어)과 정확도를 실시간으로 측정합니다."
              : "자모 분해 기반의 정확한 한글 타수(KPM)와 정확도를 실시간으로 측정합니다."}
          </p>
        </header>

        {/* 언어 토글 */}
        <div className="flex justify-center">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(["ko", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition ${
                  lang === l
                    ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30"
                    : "text-violet-200/60 hover:text-violet-100"
                }`}
              >
                {l === "ko" ? "한글" : "영문"}
              </button>
            ))}
          </div>
        </div>

        {/* 글 길이 + 최고기록 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(["short", "long"] as Length[]).map((len) => (
              <button
                key={len}
                onClick={() => switchLength(len)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  length === len
                    ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                    : "text-violet-200/60 hover:text-violet-100"
                }`}
              >
                {len === "short" ? "짧은 글" : "긴 글"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-1.5 text-xs">
            <span className="text-amber-300/80">최고</span>
            {bestValue !== null && best ? (
              <span className="font-bold text-amber-100">
                {bestValue.toLocaleString()} {bestLabel}
                <span className="ml-1 font-normal text-amber-200/50">
                  ({best.accuracy}%)
                </span>
              </span>
            ) : (
              <span className="text-amber-200/40">기록 없음</span>
            )}
          </div>
        </div>

        {/* 실시간 진행 바 */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-[width] duration-150"
            style={{ width: `${liveStats.progress * 100}%` }}
          />
        </div>

        {/* 지문 표시 영역 */}
        <section
          onClick={() => inputRef.current?.focus()}
          className="relative cursor-text rounded-2xl border border-white/10 bg-[#13111d]/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8"
        >
          <p className="text-2xl leading-relaxed tracking-wide sm:text-[28px] sm:leading-[1.7]">
            {targetArr.map((ch, i) => {
              const state = charStates[i];
              const isCaret = i === caretIndex && !result;
              return (
                <span
                  key={i}
                  className={`relative whitespace-pre-wrap rounded transition-colors duration-75 ${
                    state === "correct"
                      ? "text-emerald-300"
                      : state === "wrong"
                        ? "bg-rose-500/25 text-rose-300"
                        : "text-violet-200/30"
                  }`}
                >
                  {isCaret && (
                    <span className="caret-blink absolute -left-[2px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-fuchsia-400 sm:h-8" />
                  )}
                  {ch === " " ? " " : ch}
                </span>
              );
            })}
            {caretIndex >= targetArr.length && !result && (
              <span className="caret-blink inline-block h-7 w-[3px] translate-y-1 rounded-full bg-fuchsia-400 align-middle sm:h-8" />
            )}
          </p>

          {/* 숨겨진 입력창 (IME 조합 처리) */}
          <textarea
            ref={inputRef}
            value={typed}
            onChange={(e) => applyValue(e.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              composingRef.current = false;
              applyValue(e.currentTarget.value);
            }}
            disabled={!!result}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="absolute inset-0 h-full w-full cursor-text resize-none rounded-2xl bg-transparent p-6 text-transparent caret-transparent opacity-0 outline-none sm:p-8"
            aria-label="타이핑 입력창"
          />
        </section>

        {/* 실시간 통계 (결과 없을 때) */}
        {!result && (
          <div className="grid grid-cols-3 gap-3">
            <LiveStat
              label={metric.label}
              value={liveStats.primary.toLocaleString()}
              accent="violet"
            />
            <LiveStat
              label="정확도"
              value={`${liveStats.accuracy}%`}
              accent="emerald"
            />
            <LiveStat
              label="시간"
              value={`${liveStats.elapsed.toFixed(1)}s`}
              accent="rose"
            />
          </div>
        )}

        {/* 결과 패널 */}
        {result && (
          <div className="pop-in rounded-2xl border border-violet-400/20 bg-gradient-to-b from-violet-500/10 to-transparent p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-center gap-2">
              {result.isBest ? (
                <span className="rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-300">
                  새로운 최고 기록 달성
                </span>
              ) : (
                <span className="text-sm text-violet-200/60">결과</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {isEn ? (
                <>
                  <ResultStat
                    big
                    label="WPM (단어/분)"
                    value={result.wpm.toLocaleString()}
                  />
                  <ResultStat label="정확도" value={`${result.accuracy}%`} />
                  <ResultStat
                    label="타/분 (KPM)"
                    value={result.kpm.toLocaleString()}
                  />
                  <ResultStat
                    label="시간"
                    value={`${result.seconds.toFixed(1)}s`}
                  />
                </>
              ) : (
                <>
                  <ResultStat
                    big
                    label="타/분 (KPM)"
                    value={result.kpm.toLocaleString()}
                  />
                  <ResultStat label="정확도" value={`${result.accuracy}%`} />
                  <ResultStat label="WPM (단어)" value={String(result.wpm)} />
                  <ResultStat
                    label="시간"
                    value={`${result.seconds.toFixed(1)}s`}
                  />
                </>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-violet-200/50">
              <span>CPM(글자/분) {result.cpm.toLocaleString()}</span>
              <span>·</span>
              <span>전체 {result.totalChars}자</span>
              <span>·</span>
              <span className="text-rose-300/70">오타 {result.errors}개</span>
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => reset()}
                className="rounded-xl bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400 active:scale-95"
              >
                다음 문장 →
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-fuchsia-300/40">
              <kbd className="rounded bg-fuchsia-400/15 px-1.5 py-0.5 text-fuchsia-200/80">
                Enter
              </kbd>{" "}
              로 다음 문장
            </p>
          </div>
        )}

        {/* 하단 컨트롤 */}
        {!result && (
          <div className="flex items-center justify-center gap-4 text-xs text-violet-200/40">
            <button
              onClick={() => reset()}
              className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-violet-400/40 hover:text-violet-200"
            >
              다음 문장
            </button>
            <span className="hidden sm:inline">
              <kbd className="rounded bg-white/10 px-1.5 py-0.5">Tab</kbd> 새 문장
            </span>
            <span className="text-fuchsia-300/50">
              <kbd className="rounded bg-fuchsia-400/15 px-1.5 py-0.5 text-fuchsia-200/80">
                Enter
              </kbd>{" "}
              로 완료 · 한 번 더 누르면 다음 문장
            </span>
          </div>
        )}

        <div className="mt-auto pt-4 text-center text-[11px] text-violet-200/30">
          {isEn
            ? "표준 WPM(5타=1단어) 환산 · 모든 처리는 브라우저에서만 이루어집니다"
            : "자모(초성·중성·종성) 분해 기반 타건수 계산 · 모든 처리는 브라우저에서만 이루어집니다"}
        </div>
      </main>
    </div>
  );
}

function LiveStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "violet" | "emerald" | "rose";
}) {
  const ring = {
    violet: "border-violet-400/20 bg-violet-400/5",
    emerald: "border-emerald-400/20 bg-emerald-400/5",
    rose: "border-rose-400/20 bg-rose-400/5",
  }[accent];
  const text = {
    violet: "text-violet-200",
    emerald: "text-emerald-200",
    rose: "text-rose-200",
  }[accent];
  return (
    <div className={`rounded-xl border ${ring} px-4 py-3 text-center`}>
      <div className={`text-2xl font-bold tabular-nums ${text}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-white/40">{label}</div>
    </div>
  );
}

function ResultStat({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`font-bold tabular-nums ${
          big
            ? "bg-gradient-to-b from-fuchsia-200 to-violet-300 bg-clip-text text-4xl text-transparent"
            : "text-3xl text-violet-100"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-white/40">{label}</div>
    </div>
  );
}
