"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties } from "react";

import { getKanaById } from "../../kana/catalog";
import { formatKanaReading } from "../../kana/reading";
import {
  isPracticeConfig,
  PRACTICE_RESULT_STORAGE_KEY,
  type PracticeSessionSummary,
} from "../session-reducer";
import type { PracticeConfig } from "../types";

interface PracticeResultProps {
  initialSummary?: PracticeSessionSummary;
}

function practiceRunHref(config: PracticeConfig, kanaIds?: string[]): string {
  const query = [
    `mode=${config.mode}`,
    `scripts=${config.scripts.join(",")}`,
    `groups=${config.groups.join(",")}`,
    `count=${config.count}`,
    `strategy=${config.strategy}`,
  ];

  if (kanaIds && kanaIds.length > 0) {
    query.push(`kanaIds=${kanaIds.join(",")}`);
  }

  return `/practice/run?${query.join("&")}`;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSessionSummary(value: unknown): value is PracticeSessionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PracticeSessionSummary>;
  return Boolean(
    isPracticeConfig(candidate.config)
    && isValidTimestamp(candidate.startedAt)
    && isValidTimestamp(candidate.endedAt)
    && Array.isArray(candidate.results)
    && candidate.results.every((result) => (
      result
      && typeof result.kanaId === "string"
      && result.kanaId.length > 0
      && (result.evaluation === "good" || result.evaluation === "retry")
      && isValidTimestamp(result.answeredAt)
    )),
  );
}

let cachedRawSummary: string | null | undefined;
let cachedSummary: PracticeSessionSummary | null = null;

function subscribeToResultHandoff() {
  return () => {};
}

function readSessionSummary(): PracticeSessionSummary | null | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const stored = window.sessionStorage.getItem(PRACTICE_RESULT_STORAGE_KEY);

    if (stored === cachedRawSummary) {
      return cachedSummary;
    }

    cachedRawSummary = stored;

    if (!stored) {
      cachedSummary = null;
      return cachedSummary;
    }

    const parsed: unknown = JSON.parse(stored);
    cachedSummary = isSessionSummary(parsed) ? parsed : null;
    return cachedSummary;
  } catch {
    cachedRawSummary = null;
    cachedSummary = null;
    return null;
  }
}

export function PracticeResult({ initialSummary }: PracticeResultProps) {
  const summary = useSyncExternalStore(
    subscribeToResultHandoff,
    () => initialSummary ?? readSessionSummary(),
    () => initialSummary,
  );

  if (summary === undefined) {
    return (
      <main className="page-container page-container--narrow">
        <p aria-live="polite" className="loading-state">연습 결과를 불러오는 중이에요.</p>
      </main>
    );
  }

  if (summary === null) {
    return (
      <main className="page-container page-container--narrow">
        <section className="resume-card">
          <h1>연습 결과</h1>
          <p>표시할 연습 결과가 없어요. 새 연습을 시작해 주세요.</p>
          <Link className="primary-action" href="/practice">연습 설정으로</Link>
        </section>
      </main>
    );
  }

  const retryKanaIds = [...new Set(
    summary.results
      .filter((result) => result.evaluation === "retry")
      .map((result) => result.kanaId),
  )];
  const good = summary.results.filter((result) => result.evaluation === "good").length;
  const successRate = summary.results.length === 0
    ? 0
    : Math.round(good / summary.results.length * 100);

  const retryCount = summary.results.length - good;

  return (
    <main className="page-container page-container--narrow">
      <section aria-label="연습 결과">
        <div className="result-hero">
          <div className="result-score">
            <div aria-hidden="true" className="result-score-ring" style={{ "--rate": successRate } as CSSProperties}>
              <span>{successRate}%</span>
            </div>
            <p className="result-score-caption">성공률</p>
          </div>
          <div>
            <span className="eyebrow">수고했어요</span>
            <h1>연습 결과</h1>
            <p>{summary.results.length}문제 중 {retryKanaIds.length}문자를 다시 연습해 보세요.</p>
            <p>성공률 {successRate}% ({good}/{summary.results.length})</p>
          </div>
        </div>

        <dl className="result-stats">
          <div className="result-stat"><dt>전체</dt><dd>{summary.results.length}</dd></div>
          <div className="result-stat"><dt>잘 썼어요</dt><dd>{good}</dd></div>
          <div className="result-stat"><dt>다시 연습</dt><dd>{retryCount}</dd></div>
        </dl>

        {retryKanaIds.length > 0 ? (
          <div className="result-retry">
            <div className="section-title">
              <h2>다시 연습할 문자</h2>
              <p>{retryKanaIds.length}자</p>
            </div>
            <ul aria-label="다시 연습할 문자" className="kana-grid">
              {retryKanaIds.map((kanaId) => {
                const unit = getKanaById(kanaId);
                return (
                  <li key={kanaId}>
                    <span className="kana-cell-glyph">{unit?.display ?? kanaId}</span>
                    {unit ? <span aria-hidden="true" className="kana-cell-reading">{formatKanaReading(unit)}</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="result-empty result-retry">어려웠던 문자가 없어요. 훌륭해요!</p>
        )}

        <div className="result-actions">
          {retryKanaIds.length > 0 ? (
            <Link className="primary-action" href={practiceRunHref(summary.config, retryKanaIds)}>
              어려웠던 문자만 다시 하기
            </Link>
          ) : null}
          <Link
            className={retryKanaIds.length > 0 ? "secondary-action" : "primary-action"}
            href={practiceRunHref(summary.config)}
          >
            같은 설정으로 다시 하기
          </Link>
          <Link className="text-link" href="/">홈으로</Link>
        </div>
      </section>
    </main>
  );
}
