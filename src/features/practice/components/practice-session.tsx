"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { loadSettings, saveSettings, type AppSettings } from "../../../lib/settings";
import { StrokeGuide } from "../../kana/components/stroke-guide";
import { kanaReadingParts } from "../../kana/reading";
import type { KanaUnit } from "../../kana/types";
import {
  appendUnlimitedCycle,
  createPracticeSessionState,
  isPracticeConfig,
  PRACTICE_RESULT_STORAGE_KEY,
  practiceSessionReducer,
  toSessionSummary,
  type Evaluation,
  type PracticeResultEntry,
  type PracticeSessionSummary,
} from "../session-reducer";
import { createQuestionQueue } from "../question-generator";
import { GROUP_OPTIONS, SCRIPT_OPTIONS } from "../practice-config";
import type { Stroke } from "../strokes";
import type { KanaProgressById, PracticeConfig, Question, Random } from "../types";
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
  selectedKanaIds: string[];
  queue: Question[];
  currentIndex: number;
  answers: PracticeResultEntry[];
}

interface PracticePersistence {
  saveSession(summary: PersistedSessionSummary): Promise<void>;
  saveInterrupted(session: InterruptedPracticeSession): Promise<void>;
  saveAnswerCheckpoint(session: InterruptedPracticeSession): Promise<void>;
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
  progress?: KanaProgressById;
  random?: Random;
  repository?: PracticePersistence;
}

interface ActivePracticeSessionProps extends Omit<PracticeSessionProps, "initialQuestions" | "random"> {
  initialQuestions: Question[];
  interrupted?: InterruptedPracticeSession;
  random: Random;
  repository?: PracticePersistence;
  storageWarning?: string;
}

let cachedSettings: AppSettings | undefined;
const EMPTY_QUESTIONS: Question[] = [];

function subscribeToStaticSettings() {
  return () => {};
}

function defaultRandom(maxExclusive: number): number {
  return Math.random() * maxExclusive;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export function isCompatibleInterrupted(
  value: unknown,
  config: PracticeConfig,
  catalog: KanaUnit[],
): value is InterruptedPracticeSession {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0
    || !isValidDate(value.startedAt) || !isPracticeConfig(value.config)
    || !Array.isArray(value.selectedKanaIds)
    || !Array.isArray(value.queue) || !Array.isArray(value.answers)
    || !Number.isInteger(value.currentIndex)) {
    return false;
  }
  const session = value as unknown as InterruptedPracticeSession;
  const selectedCatalog = catalog.filter((unit) => (
    config.scripts.includes(unit.script) && config.groups.includes(unit.group)
  ));
  const catalogIds = new Set(selectedCatalog.map((unit) => unit.id));
  const expectedSelectedKanaIds = Array.from(catalogIds).sort();
  const selectedKanaIdsHaveValidShape = session.selectedKanaIds.every((kanaId, index) => (
    typeof kanaId === "string"
    && kanaId.length > 0
    && kanaId === expectedSelectedKanaIds[index]
  ));
  const questionIds = new Set<string>();
  const selectedCount = selectedCatalog.length;
  const queueHasValidShape = session.queue.every((question) => {
    if (!isRecord(question) || typeof question.id !== "string" || question.id.length === 0
      || typeof question.kanaId !== "string" || question.kanaId.length === 0
      || questionIds.has(question.id)) {
      return false;
    }
    questionIds.add(question.id);
    return catalogIds.has(question.kanaId);
  });
  const answersHaveValidShape = session.answers.every((answer) => (
    isRecord(answer)
    && typeof answer.kanaId === "string"
    && (answer.evaluation === "good" || answer.evaluation === "retry")
    && isValidDate(answer.answeredAt)
  ));
  const queueLengthMatches = session.config.count === "unlimited"
    ? selectedCount > 0 && session.queue.length >= selectedCount && session.queue.length % selectedCount === 0
    : session.queue.length === session.config.count;

  return configsMatch(session.config, config)
    && selectedKanaIdsHaveValidShape
    && session.selectedKanaIds.length === expectedSelectedKanaIds.length
    && queueHasValidShape
    && answersHaveValidShape
    && queueLengthMatches
    && session.currentIndex >= 0
    && session.currentIndex <= session.queue.length
    && session.answers.length === session.currentIndex
    && session.queue.every((question) => catalogIds.has(question.kanaId))
    && session.answers.every((answer, index) => session.queue[index]?.kanaId === answer.kanaId);
}

function appendCycleAtUnlimitedBoundary(
  session: InterruptedPracticeSession,
  catalog: KanaUnit[],
  progress: KanaProgressById | undefined,
  random: Random,
): InterruptedPracticeSession {
  if (session.config.count !== "unlimited" || session.currentIndex < session.queue.length) {
    return session;
  }
  const previousKanaId = session.queue[session.queue.length - 1]?.kanaId;
  const nextQuestions = appendUnlimitedCycle({
    config: session.config,
    catalog,
    progress,
    previousKanaId,
    questionOffset: session.queue.length,
    random,
  });
  return { ...session, queue: [...session.queue, ...nextQuestions] };
}

function progressWithSessionAnswers(
  progress: KanaProgressById | undefined,
  answers: PracticeResultEntry[],
): KanaProgressById | undefined {
  if (!progress && answers.length === 0) {
    return undefined;
  }
  const next: KanaProgressById = structuredClone(progress ?? {});
  for (const answer of answers) {
    const previous = next[answer.kanaId] ?? { presented: 0, retry: 0 };
    next[answer.kanaId] = {
      presented: previous.presented + 1,
      retry: previous.retry + (answer.evaluation === "retry" ? 1 : 0),
    };
  }
  return next;
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
  progress,
  random = defaultRandom,
  repository,
  ...activeProps
}: PracticeSessionProps) {
  const [interrupted, setInterrupted] = useState<InterruptedPracticeSession | null | undefined>(
    initialQuestions || !repository ? null : undefined,
  );
  const [resumedSession, setResumedSession] = useState<InterruptedPracticeSession | undefined>();
  const [clearError, setClearError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string>();
  const generatedQuestionsRef = useRef<Question[] | undefined>(initialQuestions);
  const questions = useSyncExternalStore(
    subscribeToStaticSettings,
    () => {
      generatedQuestionsRef.current ??= createQuestionQueue(config, catalog, progress, random);
      return generatedQuestionsRef.current;
    },
    () => initialQuestions ?? EMPTY_QUESTIONS,
  );

  useEffect(() => {
    if (interrupted !== undefined || !repository || clearError) {
      return;
    }

    let current = true;
    void repository.loadInterrupted().then(
      (saved) => {
        if (!current) {
          return;
        }
        if (saved && isCompatibleInterrupted(saved, config, catalog)) {
          setInterrupted(appendCycleAtUnlimitedBoundary(saved, catalog, progress, random));
          return;
        }
        if (saved) {
          void repository.clearInterrupted().then(
            () => setInterrupted(null),
            () => setClearError(true),
          );
          return;
        }
        setInterrupted(null);
      },
      () => {
        if (current) {
          setStorageWarning("저장된 중단 기록을 불러오지 못했어요. 이번 연습은 계속할 수 있어요.");
          setInterrupted(null);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [catalog, clearError, config, interrupted, progress, random, repository]);

  async function clearInterruptedAndStart() {
    if (!repository || clearing) {
      return;
    }
    setClearing(true);
    setClearError(false);
    try {
      await repository.clearInterrupted();
      setInterrupted(null);
    } catch {
      setClearError(true);
    } finally {
      setClearing(false);
    }
  }

  if (clearError && interrupted === undefined) {
    return (
      <main className="page-container page-container--narrow">
        <section className="resume-card">
          <p role="alert">중단 기록을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.</p>
          <button className="btn-secondary" disabled={clearing} onClick={() => void clearInterruptedAndStart()} type="button">
            삭제 다시 시도
          </button>
        </section>
      </main>
    );
  }

  if (questions.length === 0 || interrupted === undefined) {
    return (
      <main className="page-container page-container--narrow">
        <p aria-live="polite" className="loading-state">연습 문제를 준비하고 있어요.</p>
      </main>
    );
  }

  if (interrupted) {
    return (
      <main className="page-container page-container--narrow">
        <section aria-labelledby="resume-heading" className="resume-card">
          <h1 id="resume-heading">중단한 연습이 있어요</h1>
          <p>{interrupted.answers.length}문제를 마친 지점부터 이어갈 수 있어요.</p>
          {clearError ? <p role="alert">중단 기록을 삭제하지 못했어요. 다시 시도해 주세요.</p> : null}
          <div className="primary-actions">
            <button
              className="btn-primary"
              onClick={() => {
                setResumedSession(interrupted);
                setInterrupted(null);
              }}
              type="button"
            >
              이어하기
            </button>
            <button
              className="btn-secondary"
              disabled={clearing}
              onClick={() => void clearInterruptedAndStart()}
              type="button"
            >
              {clearError ? "삭제 다시 시도" : "새로 시작"}
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
      progress={progress}
      random={random}
      repository={repository}
      storageWarning={storageWarning}
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
  progress,
  random,
  repository,
  storageWarning,
}: ActivePracticeSessionProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(
    () => initialSettings ?? storedSettingsSnapshot(),
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
  const resumedAnswerCountRef = useRef(interrupted?.answers.length ?? 0);
  const persistenceChainRef = useRef(Promise.resolve());
  const selectedKanaIds = useMemo(() => catalog.map((unit) => unit.id).sort(), [catalog]);

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
      for (let answerIndex = firstNewAnswer; answerIndex < answers.length; answerIndex += 1) {
        await repository.saveAnswerCheckpoint({
          id: `session:${state.startedAt}`,
          startedAt: state.startedAt,
          config: state.config,
          selectedKanaIds,
          queue: questions,
          currentIndex: answerIndex + 1,
          answers: answers.slice(0, answerIndex + 1),
        });
      }
    }).catch(() => {
      // Practice remains usable even if a browser revokes storage mid-session.
    });
  }, [repository, selectedKanaIds, state.config, state.questions, state.results, state.startedAt]);

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
  const traceFontSize = kana && kana.glyphs.length > 1 ? 0.46 : 0.72;
  const isLastQuestion = config.count !== "unlimited" && state.currentIndex + 1 >= state.questions.length;
  const nextLabel = isLastQuestion ? "결과 보기" : "다음 문제";

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

  function updateSettings(change: Partial<Pick<AppSettings, "guideLines" | "traceGuide" | "overlayOpacity">>) {
    setSettings((current) => {
      const next = { ...current, ...change };
      cachedSettings = next;
      saveSettings(next);
      return next;
    });
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
    if (evaluation === "retry") {
      // "다시 연습" hands the canvas straight back so the learner can write the kana again.
      dispatch({ type: "REWRITE" });
    }
  }

  function goNext() {
    const atQueueBoundary = state.currentIndex + 1 >= state.questions.length;
    const nextQuestions = config.count === "unlimited" && atQueueBoundary
      ? appendUnlimitedCycle({
        config,
        catalog,
        progress: progressWithSessionAnswers(
          progress,
          state.results.slice(resumedAnswerCountRef.current),
        ),
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
          fill="#e5e8eb"
          fontSize={traceFontSize}
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

  const reading = kanaReadingParts(kana);
  const finite = config.count !== "unlimited";
  const progressPercent = finite && state.questions.length > 0
    ? Math.round((state.results.length / state.questions.length) * 100)
    : 0;
  const modeLabel = config.mode === "copy" ? "따라 쓰기" : "암기 테스트";

  return (
    <main className="page-container page-container--narrow">
      {storageWarning ? <p role="alert">{storageWarning}</p> : null}
      <section aria-label="쓰기 연습" className="practice-session">
        <div className="practice-progress">
          <p aria-live="polite" className="practice-progress-meta">
            {finite ? (
              <span className="practice-progress-count">{state.currentIndex + 1} / {state.questions.length}</span>
            ) : (
              <span className="practice-progress-count">{state.results.length}개 완료 · 무제한 연습</span>
            )}
            <span>{modeLabel}</span>
          </p>
          {finite ? (
            <div aria-hidden="true" className="practice-progress-track">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          ) : null}
        </div>

        {config.mode === "copy" ? (
          <div className="practice-target">
            <p aria-label="따라 쓸 문자" className="practice-target-glyph">
              {kana.display}
            </p>
            <p aria-hidden="true" className="practice-target-reading">
              {reading.ko}
              {reading.romaji ? <small>[{reading.romaji}]</small> : null}
            </p>
          </div>
        ) : (
          <dl aria-label="문자 힌트" className="practice-hint">
            <div className="practice-hint--reading">
              <dt>한국어 읽기</dt>
              <dd>
                {kana.readingKo}
                {reading.romaji ? <small>[<span>{reading.romaji}</span>]</small> : null}
              </dd>
            </div>
            <div className="practice-hint-meta"><dt>문자 종류</dt><dd>{SCRIPT_OPTIONS.find((option) => option.value === kana.script)?.label}</dd></div>
            <div className="practice-hint-meta"><dt>분류</dt><dd>{GROUP_OPTIONS.find((option) => option.value === kana.group)?.label}</dd></div>
          </dl>
        )}

        {state.phase !== "complete" ? (
          <fieldset aria-label="쓰기 도우미 설정" className="practice-guide-settings">
            <legend>쓰기 도우미</legend>
            <label>
              <input
                checked={settings.guideLines}
                onChange={(event) => updateSettings({ guideLines: event.currentTarget.checked })}
                type="checkbox"
              />
              보조선 표시
            </label>
            <label>
              <input
                checked={settings.traceGuide}
                disabled={config.mode !== "copy"}
                onChange={(event) => updateSettings({ traceGuide: event.currentTarget.checked })}
                type="checkbox"
              />
              따라 쓰기 가이드 표시
            </label>
          </fieldset>
        ) : null}

        <div className="writing-stage">
          <div style={{ pointerEvents: state.phase === "writing" ? "auto" : "none" }}>
            <WritingCanvas guide={guide} strokes={state.currentStrokes} onChange={handleCanvasChange} />
          </div>
          {state.phase === "reviewing" ? (
            <svg
              aria-label="정답 모델"
              className="writing-answer-overlay"
              preserveAspectRatio="none"
              role="img"
              style={{ opacity: state.overlayOpacity }}
              viewBox="0 0 1 1"
            >
              <text
                dominantBaseline="central"
                fill="currentColor"
                fontSize={traceFontSize}
                textAnchor="middle"
                x="0.5"
                y="0.5"
              >
                {kana.display}
              </text>
            </svg>
          ) : null}
        </div>

        {state.phase === "writing" ? (
          <div className="practice-actions">
            {evaluated ? (
              <p aria-live="polite" className="practice-rewrite-hint">다시 한 번 써 보고 정답을 확인해 보세요.</p>
            ) : null}
            <button className="btn-primary btn-block" onClick={revealAnswer} type="button">
              정답 확인
            </button>
            {evaluated ? (
              <button className="btn-ghost practice-skip" onClick={goNext} type="button">
                {nextLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {state.phase === "reviewing" ? (
          <section aria-label="정답 비교" className="practice-review">
            <label>
              정답 투명도
              <input
                aria-label="정답 투명도"
                max="1"
                min="0"
                onChange={(event) => {
                  const opacity = Number(event.currentTarget.value);
                  dispatch({ type: "SET_OVERLAY_OPACITY", opacity });
                  updateSettings({ overlayOpacity: opacity });
                }}
                step="0.05"
                type="range"
                value={state.overlayOpacity}
              />
            </label>
            <StrokeGuide animated assetKeys={kana.strokeAssetKeys} replayable={false} />
            {evaluated ? (
              <div className="practice-evaluation">
                <button className="btn-secondary" onClick={() => dispatch({ type: "REWRITE" })} type="button">
                  다시 써 보기
                </button>
                <button className="btn-primary" onClick={goNext} type="button">
                  {nextLabel}
                </button>
              </div>
            ) : (
              <div aria-label="자기 평가" className="practice-evaluation">
                <button className="btn-good" onClick={() => evaluate("good")} type="button">잘 썼어요</button>
                <button onClick={() => evaluate("retry")} type="button">다시 연습</button>
              </div>
            )}
          </section>
        ) : null}

        {config.count === "unlimited" && state.phase !== "complete" ? (
          <button className="btn-ghost practice-end" onClick={() => dispatch({ type: "END", endedAt: now() })} type="button">
            연습 끝내기
          </button>
        ) : null}
      </section>
    </main>
  );
}
