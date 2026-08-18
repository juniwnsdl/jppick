"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { DEFAULT_SETTINGS, loadSettings, type AppSettings } from "../../../lib/settings";
import { StrokeGuide } from "../../kana/components/stroke-guide";
import type { KanaUnit } from "../../kana/types";
import {
  appendUnlimitedCycle,
  createPracticeSessionState,
  PRACTICE_RESULT_STORAGE_KEY,
  practiceSessionReducer,
  toSessionSummary,
  type Evaluation,
  type PracticeResultEntry,
  type PracticeSessionSummary,
} from "../session-reducer";
import { createQuestionQueue } from "../question-generator";
import type { Stroke } from "../strokes";
import type { PracticeConfig, Question, Random } from "../types";
import { WritingCanvas } from "./writing-canvas";

interface PersistedSessionSummary {
  id: string;
  startedAt: string;
  endedAt: string;
  config: PracticeConfig;
  completed: number;
  good: number;
  retry: number;
  answers: PracticeResultEntry[];
}

interface InterruptedPracticeSession {
  id: string;
  startedAt: string;
  config: PracticeConfig;
  queue: Question[];
  currentIndex: number;
  answers: PracticeResultEntry[];
}

interface PracticePersistence {
  recordEvaluation(kanaId: string, value: Evaluation, at: string): Promise<void>;
  saveSession(summary: PersistedSessionSummary): Promise<void>;
  saveInterrupted(session: InterruptedPracticeSession): Promise<void>;
  loadInterrupted(): Promise<InterruptedPracticeSession | null>;
  clearInterrupted(): Promise<void>;
}

interface PracticeSessionProps {
  catalog: KanaUnit[];
  config: PracticeConfig;
  initialQuestions?: Question[];
  initialSettings?: AppSettings;
  now?: () => string;
  onComplete?: (summary: PracticeSessionSummary) => void;
  random?: Random;
  repository?: PracticePersistence;
}

interface ActivePracticeSessionProps extends Omit<PracticeSessionProps, "initialQuestions" | "random"> {
  initialQuestions: Question[];
  interrupted?: InterruptedPracticeSession;
  random: Random;
  repository?: PracticePersistence;
}

let cachedSettings: AppSettings | undefined;
const EMPTY_QUESTIONS: Question[] = [];

function subscribeToStaticSettings() {
  return () => {};
}

function storedSettingsSnapshot(): AppSettings {
  cachedSettings ??= loadSettings();
  return cachedSettings;
}

function configsMatch(left: PracticeConfig, right: PracticeConfig): boolean {
  return left.mode === right.mode
    && left.count === right.count
    && left.strategy === right.strategy
    && left.scripts.length === right.scripts.length
    && left.scripts.every((value, index) => value === right.scripts[index])
    && left.groups.length === right.groups.length
    && left.groups.every((value, index) => value === right.groups[index]);
}

function isCompatibleInterrupted(
  session: InterruptedPracticeSession,
  config: PracticeConfig,
  catalog: KanaUnit[],
): boolean {
  const catalogIds = new Set(catalog.map((unit) => unit.id));
  return configsMatch(session.config, config)
    && session.queue.length > 0
    && session.currentIndex >= 0
    && session.currentIndex <= session.queue.length
    && session.answers.length === session.currentIndex
    && session.queue.every((question) => catalogIds.has(question.kanaId))
    && session.answers.every((answer, index) => session.queue[index]?.kanaId === answer.kanaId);
}

function persistentSummary(summary: PracticeSessionSummary): PersistedSessionSummary {
  const answers = summary.results;
  return {
    id: `session:${summary.startedAt}`,
    startedAt: summary.startedAt,
    endedAt: summary.endedAt ?? summary.startedAt,
    config: summary.config,
    completed: answers.length,
    good: answers.filter((answer) => answer.evaluation === "good").length,
    retry: answers.filter((answer) => answer.evaluation === "retry").length,
    answers,
  };
}

export function PracticeSession({
  catalog,
  config,
  initialQuestions,
  random = (maxExclusive) => Math.random() * maxExclusive,
  repository,
  ...activeProps
}: PracticeSessionProps) {
  const [interrupted, setInterrupted] = useState<InterruptedPracticeSession | null | undefined>(
    initialQuestions || !repository ? null : undefined,
  );
  const [resumedSession, setResumedSession] = useState<InterruptedPracticeSession | undefined>();
  const generatedQuestionsRef = useRef<Question[] | undefined>(initialQuestions);
  const questions = useSyncExternalStore(
    subscribeToStaticSettings,
    () => {
      generatedQuestionsRef.current ??= createQuestionQueue(config, catalog, undefined, random);
      return generatedQuestionsRef.current;
    },
    () => initialQuestions ?? EMPTY_QUESTIONS,
  );

  useEffect(() => {
    if (interrupted !== undefined || !repository) {
      return;
    }

    let current = true;
    void repository.loadInterrupted().then((saved) => {
      if (!current) {
        return;
      }
      if (saved && isCompatibleInterrupted(saved, config, catalog)) {
        setInterrupted(saved);
        return;
      }
      if (saved) {
        void repository.clearInterrupted();
      }
      setInterrupted(null);
    });
    return () => {
      current = false;
    };
  }, [catalog, config, interrupted, repository]);

  if (questions.length === 0 || interrupted === undefined) {
    return (
      <main className="page-container">
        <p aria-live="polite">연습 문제를 준비하고 있어요.</p>
      </main>
    );
  }

  if (interrupted) {
    return (
      <main className="page-container">
        <section aria-labelledby="resume-heading" className="progress-card">
          <h1 id="resume-heading">중단한 연습이 있어요</h1>
          <p>{interrupted.answers.length}문제를 마친 지점부터 이어갈 수 있어요.</p>
          <div className="primary-actions">
            <button
              className="primary-action"
              onClick={() => {
                setResumedSession(interrupted);
                setInterrupted(null);
              }}
              type="button"
            >
              이어하기
            </button>
            <button
              onClick={() => {
                void repository?.clearInterrupted().finally(() => setInterrupted(null));
              }}
              type="button"
            >
              새로 시작
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <ActivePracticeSession
      {...activeProps}
      catalog={catalog}
      config={config}
      initialQuestions={resumedSession?.queue ?? questions}
      interrupted={resumedSession}
      random={random}
      repository={repository}
    />
  );
}

function ActivePracticeSession({
  catalog,
  config,
  initialQuestions,
  initialSettings,
  interrupted,
  now = () => new Date().toISOString(),
  onComplete,
  random,
  repository,
}: ActivePracticeSessionProps) {
  const router = useRouter();
  const settings = useSyncExternalStore(
    subscribeToStaticSettings,
    () => initialSettings ?? storedSettingsSnapshot(),
    () => initialSettings ?? DEFAULT_SETTINGS,
  );
  const [state, dispatch] = useReducer(
    practiceSessionReducer,
    undefined,
    () => {
      const fresh = createPracticeSessionState({
        config,
        questions: initialQuestions,
        overlayOpacity: (initialSettings ?? storedSettingsSnapshot()).overlayOpacity,
        startedAt: interrupted?.startedAt ?? now(),
      });
      if (!interrupted) {
        return fresh;
      }
      return {
        ...fresh,
        currentIndex: interrupted.currentIndex,
        phase: interrupted.currentIndex >= interrupted.queue.length ? "complete" as const : "writing" as const,
        results: interrupted.answers,
      };
    },
  );
  const completedRef = useRef(false);
  const persistedAnswerCountRef = useRef(interrupted?.answers.length ?? 0);
  const persistenceChainRef = useRef(Promise.resolve());

  useEffect(() => {
    if (state.results.length <= persistedAnswerCountRef.current) {
      return;
    }

    const firstNewAnswer = persistedAnswerCountRef.current;
    const answers = state.results.slice();
    const questions = state.questions.slice();
    persistedAnswerCountRef.current = answers.length;
    if (!repository) {
      return;
    }

    persistenceChainRef.current = persistenceChainRef.current.then(async () => {
      for (const answer of answers.slice(firstNewAnswer)) {
        await repository.recordEvaluation(answer.kanaId, answer.evaluation, answer.answeredAt);
      }
      await repository.saveInterrupted({
        id: `session:${state.startedAt}`,
        startedAt: state.startedAt,
        config: state.config,
        queue: questions,
        currentIndex: answers.length,
        answers,
      });
    }).catch(() => {
      // Practice remains usable even if a browser revokes storage mid-session.
    });
  }, [repository, state.config, state.questions, state.results, state.startedAt]);

  useEffect(() => {
    if (state.phase === "complete") {
      return;
    }

    const history = window.history;
    const sessionUrl = window.location.href;
    const originalState = history.state;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const originalBack = history.back;
    const guardId = `kana-practice-${Date.now()}-${Math.random()}`;
    const sentinelState = {
      ...(originalState && typeof originalState === "object" ? originalState : {}),
      __kanaPracticeGuard: guardId,
    };
    let allowNextHistoryNavigation = false;
    let installed = true;

    function isGuardSentinel(value: unknown): boolean {
      return Boolean(
        value
        && typeof value === "object"
        && (value as { __kanaPracticeGuard?: string }).__kanaPracticeGuard === guardId,
      );
    }

    function confirmDeparture(): boolean {
      return window.confirm("연습을 끝내고 이동할까요?");
    }

    function shouldGuardUrl(url: string | URL | null | undefined): boolean {
      return url !== undefined
        && url !== null
        && new URL(String(url), window.location.href).href !== window.location.href;
    }

    function restoreHistoryGuard() {
      if (!installed) {
        return;
      }

      installed = false;
      window.removeEventListener("popstate", handleHistoryTraversal);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;

      if (isGuardSentinel(history.state)) {
        originalReplaceState.call(history, originalState, "", sessionUrl);
      }
    }

    function handleHistoryTraversal() {
      if (!installed) {
        return;
      }

      if (!confirmDeparture()) {
        originalPushState.call(history, sentinelState, "", sessionUrl);
        return;
      }

      restoreHistoryGuard();
      originalBack.call(history);
    }

    originalPushState.call(history, sentinelState, "", sessionUrl);
    history.pushState = function guardedPushState(data, unused, url) {
      if (allowNextHistoryNavigation) {
        allowNextHistoryNavigation = false;
      } else if (shouldGuardUrl(url) && !confirmDeparture()) {
        return;
      }

      originalPushState.call(history, data, unused, url);
    };
    history.replaceState = function guardedReplaceState(data, unused, url) {
      if (allowNextHistoryNavigation) {
        allowNextHistoryNavigation = false;
      } else if (shouldGuardUrl(url) && !confirmDeparture()) {
        return;
      }

      originalReplaceState.call(history, data, unused, url);
    };
    window.addEventListener("popstate", handleHistoryTraversal);

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function warnBeforeInternalNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest("a[href]");
      if (
        !(anchor instanceof HTMLAnchorElement)
        || anchor.hasAttribute("download")
        || (anchor.target && anchor.target !== "_self")
        || anchor.href === window.location.href
      ) {
        return;
      }

      if (!confirmDeparture()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      allowNextHistoryNavigation = true;
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", warnBeforeInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", warnBeforeInternalNavigation, true);
      restoreHistoryGuard();
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "complete" || completedRef.current) {
      return;
    }

    completedRef.current = true;
    const summary = toSessionSummary(state);
    if (repository) {
      persistenceChainRef.current = persistenceChainRef.current.then(async () => {
        await repository.saveSession(persistentSummary(summary));
        await repository.clearInterrupted();
      }).catch(() => {
        // Result handoff must remain available even when durable storage fails.
      });
    }

    void persistenceChainRef.current.then(() => {
      if (onComplete) {
        onComplete(summary);
        return;
      }

      try {
        window.sessionStorage.removeItem(PRACTICE_RESULT_STORAGE_KEY);
        window.sessionStorage.setItem(PRACTICE_RESULT_STORAGE_KEY, JSON.stringify(summary));
      } catch {
        try {
          window.sessionStorage.removeItem(PRACTICE_RESULT_STORAGE_KEY);
        } catch {
          // The result route still provides a safe empty-state if storage is unavailable.
        }
      }
      router.push("/practice/result");
    });
  }, [onComplete, repository, router, state]);

  const question = state.questions[state.currentIndex];
  const kana = catalog.find((unit) => unit.id === question?.kanaId);
  const evaluated = state.results.length > state.currentIndex;

  if (!question || !kana) {
    return <p role="alert">문제를 불러오지 못했어요. 연습 설정으로 돌아가 다시 시작해 주세요.</p>;
  }

  function handleCanvasChange(nextStrokes: Stroke[]) {
    if (state.phase !== "writing") {
      return;
    }

    if (nextStrokes.length === 0) {
      dispatch({ type: "CLEAR" });
      return;
    }
    if (nextStrokes.length < state.currentStrokes.length) {
      dispatch({ type: "UNDO" });
      return;
    }

    const addedStroke = nextStrokes[nextStrokes.length - 1];
    if (addedStroke) {
      dispatch({ type: "START_STROKE", stroke: addedStroke });
    }
  }

  function revealAnswer() {
    if (
      state.currentStrokes.length === 0
      && !window.confirm("아직 쓴 획이 없어요. 그래도 정답을 확인할까요?")
    ) {
      return;
    }

    dispatch({ type: "REVEAL" });
  }

  function evaluate(evaluation: Evaluation) {
    dispatch({ type: "EVALUATE", evaluation, answeredAt: now() });
  }

  function goNext() {
    const atQueueBoundary = state.currentIndex + 1 >= state.questions.length;
    const nextQuestions = config.count === "unlimited" && atQueueBoundary
      ? appendUnlimitedCycle({
        config,
        catalog,
        previousKanaId: question.kanaId,
        questionOffset: state.questions.length,
        random,
      })
      : undefined;

    dispatch({ type: "NEXT", nextQuestions, endedAt: now() });
  }

  const guide = (
    <Fragment>
      {settings.guideLines ? (
        <>
          <line x1="0.5" y1="0" x2="0.5" y2="1" />
          <line x1="0" y1="0.5" x2="1" y2="0.5" />
        </>
      ) : null}
      {config.mode === "copy" && settings.traceGuide && state.phase === "writing" ? (
        <text
          data-testid="trace-kana-guide"
          dominantBaseline="central"
          fill="#d8ccc3"
          fontSize="0.72"
          stroke="none"
          textAnchor="middle"
          x="0.5"
          y="0.5"
        >
          {kana.display}
        </text>
      ) : null}
    </Fragment>
  );

  return (
    <main className="page-container">
      <section aria-label="쓰기 연습" className="practice-session">
        <p aria-live="polite">
          {config.count === "unlimited"
            ? `${state.results.length}개 완료 · 무제한 연습`
            : `${state.currentIndex + 1} / ${state.questions.length}`}
        </p>

        {config.mode === "copy" ? (
          <p aria-label="따라 쓸 문자" style={{ fontSize: "4rem", margin: "1rem 0", textAlign: "center" }}>
            {kana.display}
          </p>
        ) : (
          <dl aria-label="문자 힌트" style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <div><dt>한국어 읽기</dt><dd>{kana.readingKo}</dd></div>
            <div><dt>로마자</dt><dd>{kana.romaji}</dd></div>
          </dl>
        )}

        <div style={{ position: "relative" }}>
          <div style={{ pointerEvents: state.phase === "writing" ? "auto" : "none" }}>
            <WritingCanvas guide={guide} strokes={state.currentStrokes} onChange={handleCanvasChange} />
          </div>
          {state.phase === "reviewing" ? (
            <span
              aria-label="정답 모델"
              style={{
                alignItems: "center",
                aspectRatio: "1",
                display: "flex",
                fontSize: "clamp(6rem, 45vw, 14rem)",
                inset: "0 0 auto",
                justifyContent: "center",
                opacity: state.overlayOpacity,
                pointerEvents: "none",
                position: "absolute",
              }}
            >
              {kana.display}
            </span>
          ) : null}
        </div>

        {state.phase === "writing" ? (
          <button className="primary-action" onClick={revealAnswer} type="button">
            정답 확인
          </button>
        ) : null}

        {state.phase === "reviewing" ? (
          <section aria-label="정답 비교">
            <label>
              정답 투명도
              <input
                aria-label="정답 투명도"
                max="1"
                min="0"
                onChange={(event) => dispatch({
                  type: "SET_OVERLAY_OPACITY",
                  opacity: Number(event.currentTarget.value),
                })}
                step="0.05"
                type="range"
                value={state.overlayOpacity}
              />
            </label>
            <StrokeGuide assetKeys={kana.strokeAssetKeys} />
            {evaluated ? (
              <button className="primary-action" onClick={goNext} type="button">
                {config.count !== "unlimited" && state.currentIndex + 1 >= state.questions.length
                  ? "결과 보기"
                  : "다음 문제"}
              </button>
            ) : (
              <div aria-label="자기 평가" style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => evaluate("good")} type="button">잘 썼어요</button>
                <button onClick={() => evaluate("retry")} type="button">다시 연습</button>
              </div>
            )}
          </section>
        ) : null}

        {config.count === "unlimited" && state.phase !== "complete" ? (
          <button onClick={() => dispatch({ type: "END", endedAt: now() })} type="button">
            연습 끝내기
          </button>
        ) : null}
      </section>
    </main>
  );
}
