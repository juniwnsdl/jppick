"use client";

import Link from "next/link";
import { useState } from "react";

import type { KanaGroup, KanaScript, KanaUnit } from "../../kana/types";
import type { PracticeConfig, PracticeCount, PracticeMode, PracticeStrategy } from "../types";

const SCRIPT_OPTIONS: ReadonlyArray<{ value: KanaScript; label: string }> = [
  { value: "hiragana", label: "히라가나" },
  { value: "katakana", label: "가타카나" },
];

const GROUP_OPTIONS: ReadonlyArray<{ value: KanaGroup; label: string }> = [
  { value: "basic", label: "기본" },
  { value: "voiced", label: "탁음·반탁음" },
  { value: "yoon", label: "요음" },
  { value: "small", label: "작은 문자·기호" },
  { value: "extended", label: "확장 가타카나" },
];

const COUNT_OPTIONS: ReadonlyArray<{ value: PracticeCount; label: string }> = [
  { value: 5, label: "5문제" },
  { value: 10, label: "10문제" },
  { value: 20, label: "20문제" },
  { value: "unlimited", label: "무제한" },
];

const STRATEGY_OPTIONS: ReadonlyArray<{ value: PracticeStrategy; label: string }> = [
  { value: "uniform", label: "균등 랜덤" },
  { value: "least-practiced", label: "덜 연습한 문자 우선" },
  { value: "difficult", label: "어려운 문자 우선" },
];

const DEFAULT_PRACTICE_CONFIG: PracticeConfig = {
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
    count: count === "5" ? 5 : count === "20" ? 20 : count === "unlimited" ? "unlimited" : 10,
    strategy: strategy === "least-practiced" || strategy === "difficult" ? strategy : "uniform",
  };
}

function practiceRunHref(config: PracticeConfig): string {
  return `/practice/run?mode=${config.mode}&scripts=${config.scripts.join(",")}&groups=${config.groups.join(",")}&count=${config.count}&strategy=${config.strategy}`;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

interface PracticeSetupProps {
  catalog: KanaUnit[];
  initialConfig?: PracticeConfig;
}

export function PracticeSetup({ catalog, initialConfig = DEFAULT_PRACTICE_CONFIG }: PracticeSetupProps) {
  const [config, setConfig] = useState<PracticeConfig>(initialConfig);
  const selectedKanaCount = catalog.filter((unit) => (
    config.scripts.includes(unit.script) && config.groups.includes(unit.group)
  )).length;
  const canStart = selectedKanaCount > 0;

  return (
    <section aria-label="연습 설정" className="practice-setup">
      <fieldset>
        <legend>연습 모드</legend>
        {([
          { value: "copy", label: "따라 쓰기" },
          { value: "recall", label: "암기 테스트" },
        ] as ReadonlyArray<{ value: PracticeMode; label: string }>).map((option) => (
          <button
            aria-pressed={config.mode === option.value}
            key={option.value}
            onClick={() => setConfig((current) => ({ ...current, mode: option.value }))}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <fieldset>
        <legend>문자 체계</legend>
        {SCRIPT_OPTIONS.map((option) => (
          <button
            aria-pressed={config.scripts.length === 1 && config.scripts[0] === option.value}
            key={option.value}
            onClick={() => setConfig((current) => ({ ...current, scripts: [option.value] }))}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <button
          aria-pressed={config.scripts.length === SCRIPT_OPTIONS.length}
          onClick={() => setConfig((current) => ({ ...current, scripts: SCRIPT_OPTIONS.map((option) => option.value) }))}
          type="button"
        >
          혼합
        </button>
      </fieldset>

      <fieldset>
        <legend>연습 범위</legend>
        {GROUP_OPTIONS.map((option) => (
          <button
            aria-pressed={config.groups.includes(option.value)}
            key={option.value}
            onClick={() => setConfig((current) => ({ ...current, groups: toggle(current.groups, option.value) }))}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <fieldset>
        <legend>문제 수</legend>
        {COUNT_OPTIONS.map((option) => (
          <button
            aria-pressed={config.count === option.value}
            key={option.label}
            onClick={() => setConfig((current) => ({ ...current, count: option.value }))}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <fieldset>
        <legend>출제 방식</legend>
        {STRATEGY_OPTIONS.map((option) => (
          <button
            aria-pressed={config.strategy === option.value}
            key={option.value}
            onClick={() => setConfig((current) => ({ ...current, strategy: option.value }))}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <p aria-live="polite">선택한 문자: {selectedKanaCount}개</p>
      {canStart ? (
        <Link className="primary-action" href={practiceRunHref(config)}>
          연습 시작
        </Link>
      ) : (
        <>
          <p>선택한 범위에 연습할 문자가 없어요.</p>
          <button disabled type="button">연습 시작</button>
        </>
      )}
    </section>
  );
}
