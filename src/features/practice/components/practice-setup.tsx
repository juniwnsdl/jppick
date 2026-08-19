"use client";

import Link from "next/link";
import { useState } from "react";

import type { KanaUnit } from "../../kana/types";
import {
  COUNT_OPTIONS,
  DEFAULT_PRACTICE_CONFIG,
  GROUP_OPTIONS,
  SCRIPT_OPTIONS,
  STRATEGY_OPTIONS,
} from "../practice-config";
import type { PracticeConfig, PracticeMode } from "../types";

function practiceRunHref(config: PracticeConfig, kanaIds: string[]): string {
  const selectedKana = kanaIds.length > 0 ? `&kanaIds=${kanaIds.join(",")}` : "";
  return `/practice/run?mode=${config.mode}&scripts=${config.scripts.join(",")}&groups=${config.groups.join(",")}&count=${config.count}&strategy=${config.strategy}${selectedKana}`;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function selectedIndicator(selected: boolean) {
  return selected ? <span aria-hidden="true" data-selected-indicator>✓</span> : null;
}

interface PracticeSetupProps {
  catalog: KanaUnit[];
  initialConfig?: PracticeConfig;
  selectedKanaIds?: string[];
}

export function PracticeSetup({
  catalog,
  initialConfig = DEFAULT_PRACTICE_CONFIG,
  selectedKanaIds = [],
}: PracticeSetupProps) {
  const [config, setConfig] = useState<PracticeConfig>(initialConfig);
  const matchingKana = catalog.filter((unit) => (
    config.scripts.includes(unit.script) && config.groups.includes(unit.group)
  ));
  const matchingKanaIds = new Set(matchingKana.map((unit) => unit.id));
  const activeSelectedKanaIds = selectedKanaIds.filter((kanaId) => matchingKanaIds.has(kanaId));
  const selectedKanaCount = activeSelectedKanaIds.length || matchingKana.length;
  const canStart = selectedKanaCount > 0;

  return (
    <section aria-label="연습 설정" className="practice-setup">
      <div className="setup-card">
        <div aria-labelledby="setup-mode-label" className="setup-row" role="group">
          <span className="setup-label" id="setup-mode-label">연습 모드</span>
          <div className="pill-group">
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
                {option.label} {selectedIndicator(config.mode === option.value)}
              </button>
            ))}
          </div>
        </div>

        <div aria-labelledby="setup-script-label" className="setup-row" role="group">
          <span className="setup-label" id="setup-script-label">문자 체계</span>
          <div className="pill-group">
            {SCRIPT_OPTIONS.map((option) => (
              <button
                aria-pressed={config.scripts.length === 1 && config.scripts[0] === option.value}
                key={option.value}
                onClick={() => setConfig((current) => ({ ...current, scripts: [option.value] }))}
                type="button"
              >
                {option.label} {selectedIndicator(config.scripts.length === 1 && config.scripts[0] === option.value)}
              </button>
            ))}
            <button
              aria-pressed={config.scripts.length === SCRIPT_OPTIONS.length}
              onClick={() => setConfig((current) => ({ ...current, scripts: SCRIPT_OPTIONS.map((option) => option.value) }))}
              type="button"
            >
              혼합 {selectedIndicator(config.scripts.length === SCRIPT_OPTIONS.length)}
            </button>
          </div>
        </div>

        <div aria-labelledby="setup-range-label" className="setup-row" role="group">
          <span className="setup-label" id="setup-range-label">연습 범위</span>
          <div className="pill-group">
            {GROUP_OPTIONS.map((option) => (
              <button
                aria-pressed={config.groups.includes(option.value)}
                key={option.value}
                onClick={() => setConfig((current) => ({ ...current, groups: toggle(current.groups, option.value) }))}
                type="button"
              >
                {option.label} {selectedIndicator(config.groups.includes(option.value))}
              </button>
            ))}
          </div>
        </div>

        <div aria-labelledby="setup-count-label" className="setup-row" role="group">
          <span className="setup-label" id="setup-count-label">문제 수</span>
          <div className="pill-group">
            {COUNT_OPTIONS.map((option) => (
              <button
                aria-pressed={config.count === option.value}
                key={option.label}
                onClick={() => setConfig((current) => ({ ...current, count: option.value }))}
                type="button"
              >
                {option.label} {selectedIndicator(config.count === option.value)}
              </button>
            ))}
          </div>
        </div>

        <div aria-labelledby="setup-strategy-label" className="setup-row" role="group">
          <span className="setup-label" id="setup-strategy-label">출제 방식</span>
          <div className="pill-group">
            {STRATEGY_OPTIONS.map((option) => (
              <button
                aria-pressed={config.strategy === option.value}
                key={option.value}
                onClick={() => setConfig((current) => ({ ...current, strategy: option.value }))}
                type="button"
              >
                {option.label} {selectedIndicator(config.strategy === option.value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="practice-setup-summary">
        <div>
          <p aria-live="polite">선택한 문자: <strong>{selectedKanaCount}</strong>개</p>
          {!canStart ? <p className="practice-setup-empty">선택한 범위에 연습할 문자가 없어요.</p> : null}
        </div>
        {canStart ? (
          <Link className="primary-action" href={practiceRunHref(config, activeSelectedKanaIds)}>
            연습 시작
          </Link>
        ) : (
          <button className="btn-primary" disabled type="button">연습 시작</button>
        )}
      </div>
    </section>
  );
}
