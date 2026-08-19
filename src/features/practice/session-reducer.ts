import type { KanaGroup, KanaScript, KanaUnit } from "../kana/types";
import { createQuestionQueue } from "./question-generator";
import type { Stroke } from "./strokes";
import type {
  KanaProgressById,
  PracticeConfig,
  PracticeCount,
  PracticeMode,
  PracticeStrategy,
  Question,
  Random,
} from "./types";

export type Evaluation = "good" | "retry";
export type SessionPhase = "writing" | "reviewing" | "complete";

export interface PracticeResultEntry {
  kanaId: string;
  evaluation: Evaluation;
  answeredAt: string;
}

export interface PracticeSessionState {
  config: PracticeConfig;
  questions: Question[];
  currentIndex: number;
  currentStrokes: Stroke[];
  phase: SessionPhase;
  overlayOpacity: number;
  results: PracticeResultEntry[];
  startedAt: string;
  endedAt?: string;
}

export interface PracticeSessionSummary {
  config: PracticeConfig;
  results: PracticeResultEntry[];
  startedAt: string;
  endedAt?: string;
}

export type PracticeSessionAction =
  | { type: "START_STROKE"; stroke: Stroke }
  | { type: "UNDO" }
  | { type: "CLEAR" }
  | { type: "REVEAL" }
  | { type: "SET_OVERLAY_OPACITY"; opacity: number }
  | { type: "EVALUATE"; evaluation: Evaluation; answeredAt: string }
  | { type: "REWRITE" }
  | { type: "NEXT"; nextQuestions?: Question[]; endedAt?: string }
  | { type: "END"; endedAt: string };

interface CreatePracticeSessionStateOptions {
  config: PracticeConfig;
  questions: Question[];
  overlayOpacity: number;
  startedAt: string;
}

export const PRACTICE_RESULT_STORAGE_KEY = "kana-learning-practice-result";

export function createPracticeSessionState({
  config,
  questions,
  overlayOpacity,
  startedAt,
}: CreatePracticeSessionStateOptions): PracticeSessionState {
  return {
    config,
    questions,
    currentIndex: 0,
    currentStrokes: [],
    phase: "writing",
    overlayOpacity: clampOpacity(overlayOpacity),
    results: [],
    startedAt,
  };
}

function currentQuestionWasEvaluated(state: PracticeSessionState): boolean {
  return state.results.length > state.currentIndex;
}

export function practiceSessionReducer(
  state: PracticeSessionState,
  action: PracticeSessionAction,
): PracticeSessionState {
  switch (action.type) {
    case "START_STROKE":
      return state.phase === "writing"
        ? { ...state, currentStrokes: [...state.currentStrokes, action.stroke] }
        : state;
    case "UNDO":
      return state.phase === "writing" && state.currentStrokes.length > 0
        ? { ...state, currentStrokes: state.currentStrokes.slice(0, -1) }
        : state;
    case "CLEAR":
      return state.phase === "writing" && state.currentStrokes.length > 0
        ? { ...state, currentStrokes: [] }
        : state;
    case "REVEAL":
      return state.phase === "writing" ? { ...state, phase: "reviewing" } : state;
    case "SET_OVERLAY_OPACITY":
      return state.phase === "reviewing"
        ? { ...state, overlayOpacity: clampOpacity(action.opacity) }
        : state;
    case "EVALUATE": {
      const question = state.questions[state.currentIndex];

      if (state.phase !== "reviewing" || !question || currentQuestionWasEvaluated(state)) {
        return state;
      }

      return {
        ...state,
        currentStrokes: [],
        results: [...state.results, {
          kanaId: question.kanaId,
          evaluation: action.evaluation,
          answeredAt: action.answeredAt,
        }],
      };
    }
    case "REWRITE":
      // After a self-evaluation the learner may write the same kana again before moving on.
      return state.phase === "reviewing" && currentQuestionWasEvaluated(state)
        ? { ...state, currentStrokes: [], phase: "writing" }
        : state;
    case "NEXT": {
      if (state.phase === "complete" || !currentQuestionWasEvaluated(state)) {
        return state;
      }

      const nextIndex = state.currentIndex + 1;
      let questions = state.questions;

      if (nextIndex >= questions.length && state.config.count === "unlimited") {
        if (!action.nextQuestions || action.nextQuestions.length === 0) {
          return state;
        }
        questions = [...questions, ...action.nextQuestions];
      }

      if (nextIndex >= questions.length) {
        return {
          ...state,
          currentStrokes: [],
          phase: "complete",
          endedAt: action.endedAt,
        };
      }

      return {
        ...state,
        questions,
        currentIndex: nextIndex,
        currentStrokes: [],
        phase: "writing",
      };
    }
    case "END":
      return state.phase !== "complete" && state.config.count === "unlimited"
        ? { ...state, currentStrokes: [], phase: "complete", endedAt: action.endedAt }
        : state;
  }
}

export function toSessionSummary(state: PracticeSessionState): PracticeSessionSummary {
  return {
    config: state.config,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    results: state.results,
  };
}

interface AppendUnlimitedCycleOptions {
  config: PracticeConfig;
  catalog: KanaUnit[];
  progress?: KanaProgressById;
  previousKanaId?: string;
  questionOffset: number;
  random: Random;
}

export function appendUnlimitedCycle({
  config,
  catalog,
  progress,
  previousKanaId,
  questionOffset,
  random,
}: AppendUnlimitedCycleOptions): Question[] {
  const cycle = createQuestionQueue(
    { ...config, count: "unlimited" },
    catalog,
    progress,
    random,
  );

  if (cycle.length > 1 && cycle[0]?.kanaId === previousKanaId) {
    const replacementIndex = cycle.findIndex((question) => question.kanaId !== previousKanaId);

    if (replacementIndex > 0) {
      [cycle[0], cycle[replacementIndex]] = [cycle[replacementIndex], cycle[0]];
    }
  }

  return cycle.map((question, index) => ({
    ...question,
    id: `question-${questionOffset + index + 1}-${question.kanaId}`,
  }));
}

type SearchParamValues = Record<string, string | string[] | undefined>;

const MODES: readonly PracticeMode[] = ["copy", "recall"];
const SCRIPTS: readonly KanaScript[] = ["hiragana", "katakana"];
const GROUPS: readonly KanaGroup[] = ["basic", "voiced", "yoon", "small", "extended"];
const COUNTS: ReadonlyArray<PracticeCount | "5" | "10" | "20"> = ["5", "10", "20", "unlimited"];
const STRATEGIES: readonly PracticeStrategy[] = ["uniform", "least-practiced", "difficult"];

function isUniqueAllowedList(value: unknown, allowed: readonly string[]): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "string" && allowed.includes(item))
    && new Set(value).size === value.length;
}

export function isPracticeConfig(value: unknown): value is PracticeConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Partial<PracticeConfig>;
  return MODES.includes(config.mode as PracticeMode)
    && isUniqueAllowedList(config.scripts, SCRIPTS)
    && isUniqueAllowedList(config.groups, GROUPS)
    && (config.count === 5 || config.count === 10 || config.count === 20 || config.count === "unlimited")
    && STRATEGIES.includes(config.strategy as PracticeStrategy);
}

function isSingleValue(value: string | string[] | undefined): value is string {
  return typeof value === "string";
}

function parseList<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T[] | null {
  if (!isSingleValue(value) || value.length === 0) {
    return null;
  }

  const values = value.split(",");
  const allowedValues = new Set<string>(allowed);

  if (values.some((item) => item.length === 0 || !allowedValues.has(item)) || new Set(values).size !== values.length) {
    return null;
  }

  return values as T[];
}

export interface ParsedPracticeRun {
  config: PracticeConfig;
  kanaIds?: string[];
}

export function parsePracticeRunSearchParams(searchParams: SearchParamValues): ParsedPracticeRun | null {
  const { mode, scripts, groups, count, strategy, kanaIds } = searchParams;
  const parsedScripts = parseList(scripts, SCRIPTS);
  const parsedGroups = parseList(groups, GROUPS);

  if (
    !isSingleValue(mode)
    || !MODES.includes(mode as PracticeMode)
    || !parsedScripts
    || !parsedGroups
    || !isSingleValue(count)
    || !COUNTS.includes(count as PracticeCount | "5" | "10" | "20")
    || !isSingleValue(strategy)
    || !STRATEGIES.includes(strategy as PracticeStrategy)
  ) {
    return null;
  }

  let parsedKanaIds: string[] | undefined;

  if (kanaIds !== undefined) {
    if (!isSingleValue(kanaIds) || kanaIds.length === 0) {
      return null;
    }
    parsedKanaIds = kanaIds.split(",");
    if (parsedKanaIds.some((id) => id.length === 0) || new Set(parsedKanaIds).size !== parsedKanaIds.length) {
      return null;
    }
  }

  return {
    config: {
      mode: mode as PracticeMode,
      scripts: parsedScripts,
      groups: parsedGroups,
      count: count === "unlimited" ? "unlimited" : Number(count) as 5 | 10 | 20,
      strategy: strategy as PracticeStrategy,
    },
    ...(parsedKanaIds ? { kanaIds: parsedKanaIds } : {}),
  };
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.55;
  }

  return Math.min(1, Math.max(0, value));
}
