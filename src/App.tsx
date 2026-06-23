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

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  // 확정(append-only)된 입력의 코드포인트 길이. 백스페이스로 이 길이 아래로는 못 줄인다.
  const lockedLengthRef = useRef(0);

  const isEn = lang === "en";

  // 실시간 표시용 타이머 (타이핑 중일 때만 갱신)
  useEffect(() => {
    if (startTime !== null && result === null) {
      const id = window.setInterval(() => setNow(Date.now()), 100);
      return () => window.clearInterval(id);
    }
  }, [startTime, result]);

  const targetArr = useMemo(() => Array.from(target), [target]);

  // 커서 위치(현재 입력 길이). 조합 중 글자 포함.
  const caretIndex = Array.from(typed).length;

  // 주지표: 한글은 KPM(타/분), 영문은 WPM(단어/분)
  const metric = useMemo(
    () =>
      isEn
        ? { label: "WPM (단어/분)", key: "wpm" as const }
        : { label: "타/분 (KPM)", key: "kpm" as const },
    [isEn]
  );

  // 실시간 통계 (속도/시간/진행도만 — 정답 여부는 절대 노출하지 않음)
  const liveStats = useMemo(() => {
    const elapsed =
      startTime !== null ? Math.max((now - startTime) / 1000, 0.001) : 0;
    const typedArr = Array.from(typed);
    // 입력한 만큼의 목표 텍스트 기준으로 속도 측정 (실제 친 분량만 카운트)
    const typedTarget = targetArr.slice(0, typedArr.length).join("");
    const strokes = keystrokesForText(typedTarget);
    const kpm = elapsed > 0 ? Math.round((strokes / elapsed) * 60) : 0;
    const wpm =
      elapsed > 0 ? Math.round((wordsForText(typedTarget) / elapsed) * 60) : 0;
    const primary = isEn ? wpm : kpm;
    const progress =
      targetArr.length > 0
        ? Math.min(typedArr.length / targetArr.length, 1)
        : 0;
    return { elapsed, kpm, wpm, primary, progress };
  }, [now, startTime, typed, targetArr, isEn]);

  const finishTest = useCallback(
    (finalTyped: string) => {
      // 코드포인트 단위로 통일해서 채점 (off-by-one / 조합 잔여 방지)
      const typedArr = Array.from(finalTyped);
      // 아무것도 안 친 상태에서의 종료는 의미 없으므로 무시
      if (typedArr.length === 0) return;

      const end = Date.now();
      const seconds = startTime !== null ? (end - startTime) / 1000 : 0.001;
      const safeSec = Math.max(seconds, 0.001);

      // 채점: 친 각 글자 typed[i] 를 지문의 같은 위치 target[i] 와 1:1 비교.
      // 백스페이스가 없으므로 typed 는 append-only — 친 분량만큼만 비교한다.
      const typedLen = typedArr.length;
      let correctChars = 0;
      for (let i = 0; i < typedLen; i++) {
        if (typedArr[i] === targetArr[i]) correctChars++;
      }
      // 측정 대상 = 입력한 만큼의 목표 텍스트 (실제 친 분량)
      const typedTarget = targetArr.slice(0, typedLen).join("");

      const strokes = keystrokesForText(typedTarget);
      const kpm = Math.round((strokes / safeSec) * 60);
      const cpm = Math.round((typedLen / safeSec) * 60);
      const wpm = Math.round((wordsForText(typedTarget) / safeSec) * 60);
      // 오타 = 친 글자수 - 맞은 글자수 (오로지 확정 입력 기준, 조합 중간상태 영향 없음)
      const errors = typedLen - correctChars;
      // 정확도 = 맞은 글자 / 친 글자수
      const accuracy =
        typedLen > 0 ? Math.round((correctChars / typedLen) * 100) : 100;

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
        totalChars: typedLen,
        errors,
        isBest,
      });
    },
    [startTime, targetArr, lang, length]
  );

  // hidden textarea 의 value 가 바뀔 때마다 호출.
  // 핵심: 확정 길이(lockedLength) 아래로 줄어들면 되돌려서 백스페이스를 무력화한다.
  const applyValue = useCallback(
    (rawValue: string, composing: boolean) => {
      if (result) return;

      const valArr = Array.from(rawValue);
      const locked = lockedLengthRef.current;

      // 백스페이스 차단: 확정된 길이보다 짧아지면(=확정 글자를 지우려 함) 무시.
      // 단, 조합 중에는 마지막 글자(미확정)가 자모 단위로 줄었다 늘었다 할 수 있으므로
      // "확정 길이 미만"만 차단한다. 확정 길이까지는 항상 보존된다.
      if (valArr.length < locked) {
        // 확정 프리픽스로 강제 복원
        const restored = Array.from(typed).slice(0, locked).join("");
        if (inputRef.current) inputRef.current.value = restored;
        setTyped(restored);
        return;
      }

      // 타이머 시작
      if (startTime === null && valArr.length > 0) {
        const t = Date.now();
        setStartTime(t);
        setNow(t);
      }

      // 목표 길이를 넘어서지 않게 자르기
      const sliced = valArr.slice(0, targetArr.length).join("");
      setTyped(sliced);

      // 조합이 끝난 글자는 확정 → 확정 길이 갱신.
      // 조합 중이면 마지막 글자는 미확정이므로 (길이-1) 까지만 확정으로 본다.
      if (!composing) {
        lockedLengthRef.current = Array.from(sliced).length;
      } else {
        lockedLengthRef.current = Math.max(
          lockedLengthRef.current,
          Array.from(sliced).length - 1
        );
      }

      // 완료 판정: IME 조합이 끝난 상태에서 지문 끝까지 도달
      const slicedArr = Array.from(sliced);
      if (!composing && slicedArr.length >= targetArr.length) {
        finishTest(sliced);
      }
    },
    [result, startTime, targetArr, typed, finishTest]
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
      setNow(Date.now());
      composingRef.current = false;
      lockedLengthRef.current = 0;
      if (inputRef.current) inputRef.current.value = "";
      setBest(getBest(l, len));
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

  // 키보드 단축키 + 백스페이스 차단(보강)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        reset();
        return;
      }
      // 백스페이스/딜리트 1차 차단: 결과 화면이 아니고 입력 중일 때.
      // 조합 중(IME)에는 자모 삭제가 브라우저 내부 동작이라 완전 차단이 어려우므로
      // applyValue 의 lockedLength 복원 로직이 2차 방어선이 된다.
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !result &&
        !e.isComposing &&
        !composingRef.current
      ) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        // 한글 IME 조합 중의 엔터(조합 확정)는 무시
        if (e.isComposing || composingRef.current) return;
        e.preventDefault();
        if (result) {
          // 결과 표시 중 → 다음 문장으로
          reset();
        } else if (Array.from(typed).length > 0) {
          // 한 글자라도 쳤으면 → 그 시점까지 무조건 종료 & 채점
          finishTest(typed);
        }
        // 아무것도 안 친 상태의 엔터는 무시(0타 결과는 의미 없음)
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset, result, typed, finishTest]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const bestLabel = isEn ? "WPM" : "타/분";
  const bestValue = best ? (isEn ? best.wpm : best.kpm) : null;

  const typedArr = Array.from(typed);

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
            백스페이스 없는 정확도 타이핑 게임
          </div>
          <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-rose-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            타닥타닥 · 한 번에 끝까지
          </h1>
          <p className="max-w-md text-sm text-violet-200/60">
            백스페이스 없이 한 번에! 맞았는지 틀렸는지는 끝나고 결과에서
            확인하세요.
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

        {/* 지문 표시 영역 — 중립 색만, 정답/오답 피드백 없음 */}
        <section
          onClick={() => inputRef.current?.focus()}
          className="relative cursor-text rounded-2xl border border-white/10 bg-[#13111d]/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8"
        >
          <p className="text-2xl leading-relaxed tracking-wide sm:text-[28px] sm:leading-[1.7]">
            {targetArr.map((ch, i) => {
              const passed = i < caretIndex; // 이미 지나간 글자(맞고 틀림은 표시 안 함)
              const isCaret = i === caretIndex && !result;
              return (
                <span
                  key={i}
                  className={`relative whitespace-pre-wrap rounded transition-colors duration-75 ${
                    passed ? "text-violet-100/70" : "text-violet-200/30"
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

          {/* 숨겨진 입력창 (IME 조합 처리) — value 는 state 로 제어해 백스페이스를 무력화 */}
          <textarea
            ref={inputRef}
            value={typed}
            onChange={(e) =>
              applyValue(e.target.value, composingRef.current)
            }
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              composingRef.current = false;
              applyValue(e.currentTarget.value, false);
            }}
            onKeyDown={(e) => {
              // textarea 자체에서도 백스페이스/딜리트를 차단(조합 중이 아닐 때)
              if (
                (e.key === "Backspace" || e.key === "Delete") &&
                !e.nativeEvent.isComposing &&
                !composingRef.current
              ) {
                e.preventDefault();
              }
            }}
            disabled={!!result}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="absolute inset-0 h-full w-full cursor-text resize-none rounded-2xl bg-transparent p-6 text-transparent caret-transparent opacity-0 outline-none sm:p-8"
            aria-label="타이핑 입력창"
          />
        </section>

        {/* 안내 배지 */}
        {!result && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <span className="rounded-full border border-rose-400/20 bg-rose-400/5 px-3 py-1 text-rose-200/70">
              ⌫ 백스페이스 금지 — 한 번 친 글자는 못 지웁니다
            </span>
            <span className="rounded-full border border-violet-400/20 bg-violet-400/5 px-3 py-1 text-violet-200/70">
              결과는 끝나고 확인 — 정답·오답 미리보기 없음
            </span>
          </div>
        )}

        {/* 실시간 통계 (결과 없을 때) — 속도/입력량/시간만, 정확도는 비공개 */}
        {!result && (
          <div className="grid grid-cols-3 gap-3">
            <LiveStat
              label={metric.label}
              value={liveStats.primary.toLocaleString()}
              accent="violet"
            />
            <LiveStat
              label="입력"
              value={`${typedArr.length} / ${targetArr.length}`}
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

            {/* 결과에서만 어디를 틀렸는지 보여준다 */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="mb-2 text-[11px] text-violet-200/40">
                채점 결과 — 초록은 정답, 빨강은 오타
              </div>
              <p className="text-lg leading-relaxed tracking-wide">
                {targetArr.map((ch, i) => {
                  const t = typedArr[i];
                  let cls = "text-violet-200/25"; // 안 친 글자
                  if (t !== undefined) {
                    cls =
                      t === ch
                        ? "text-emerald-300"
                        : "bg-rose-500/25 text-rose-300";
                  }
                  return (
                    <span key={i} className={`rounded ${cls}`}>
                      {ch === " " ? " " : ch}
                    </span>
                  );
                })}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-violet-200/50">
              <span>CPM(글자/분) {result.cpm.toLocaleString()}</span>
              <span>·</span>
              <span>입력 {result.totalChars}자</span>
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
          백스페이스 없이 입력한 분량을 글자별로 1:1 채점 · 모든 처리는
          브라우저에서만 이루어집니다
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
