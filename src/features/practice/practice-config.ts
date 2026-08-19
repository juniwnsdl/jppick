import type { KanaGroup, KanaScript } from "../kana/types";
import type { PracticeConfig, PracticeCount, PracticeStrategy } from "./types";

export const SCRIPT_OPTIONS: ReadonlyArray<{ value: KanaScript; label: string }> = [
  { value: "hiragana", label: "히라가나" },
  { value: "katakana", label: "가타카나" },
];

export const GROUP_OPTIONS: ReadonlyArray<{ value: KanaGroup; label: string }> = [
  { value: "basic", label: "기본" },
  { value: "voiced", label: "탁음·반탁음" },
  { value: "yoon", label: "요음" },
  { value: "small", label: "작은 문자·기호" },
  { value: "extended", label: "확장 가타카나" },
];

export const COUNT_OPTIONS: ReadonlyArray<{ value: PracticeCount; label: string }> = [
  { value: 5, label: "5문제" },
  { value: 10, label: "10문제" },
  { value: 20, label: "20문제" },
  { value: "unlimited", label: "무제한" },
];

export const STRATEGY_OPTIONS: ReadonlyArray<{ value: PracticeStrategy; label: string }> = [
  { value: "uniform", label: "균등 랜덤" },
  { value: "least-practiced", label: "덜 연습한 문자 우선" },
  { value: "difficult", label: "어려운 문자 우선" },
];

export const DEFAULT_PRACTICE_CONFIG: PracticeConfig = {
  mode: "copy",
  scripts: SCRIPT_OPTIONS.map((option) => option.value),
  groups: GROUP_OPTIONS.map((option) => option.value),
  count: 10,
  strategy: "uniform",
};

type SearchParamValues = Record<string, string | string[] | undefined>;

function oneValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function selectedValues<T extends string>(
  value: string | undefined,
  options: ReadonlyArray<{ value: T }>,
  fallback: T[],
): T[] {
  if (!value) {
    return [...fallback];
  }

  const requested = new Set(value.split(","));
  const selected = options.map((option) => option.value).filter((option) => requested.has(option));
  return selected.length > 0 ? selected : [...fallback];
}

export function practiceConfigFromSearchParams(searchParams: SearchParamValues = {}): PracticeConfig {
  const mode = oneValue(searchParams.mode);
  const count = oneValue(searchParams.count);
  const strategy = oneValue(searchParams.strategy);

  return {
    mode: mode === "recall" ? "recall" : "copy",
    scripts: selectedValues(oneValue(searchParams.scripts), SCRIPT_OPTIONS, DEFAULT_PRACTICE_CONFIG.scripts),
    groups: selectedValues(oneValue(searchParams.groups), GROUP_OPTIONS, DEFAULT_PRACTICE_CONFIG.groups),
    count: count === "5"
      ? 5
      : count === "20"
        ? 20
        : count === "all" || count === "unlimited"
          ? count
          : 10,
    strategy: strategy === "least-practiced" || strategy === "difficult" || strategy === "ordered"
      ? strategy
      : "uniform",
  };
}
