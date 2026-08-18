"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

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
      <main className="page-container">
        <p aria-live="polite">연습 결과를 불러오는 중이에요.</p>
      </main>
    );
  }

  if (summary === null) {
    return (
      <main className="page-container">
        <h1>연습 결과</h1>
        <p>표시할 연습 결과가 없어요. 새 연습을 시작해 주세요.</p>
        <Link className="primary-action" href="/practice">연습 설정으로</Link>
      </main>
    );
  }

  const retryKanaIds = [...new Set(
    summary.results
      .filter((result) => result.evaluation === "retry")
      .map((result) => result.kanaId),
  )];

  return (
    <main className="page-container">
      <section aria-label="연습 결과">
        <h1>연습 결과</h1>
        <p>{summary.results.length}문제 중 {retryKanaIds.length}문자를 다시 연습해 보세요.</p>
        <div className="primary-actions">
          {retryKanaIds.length > 0 ? (
            <Link className="primary-action" href={practiceRunHref(summary.config, retryKanaIds)}>
              어려웠던 문자만 다시 하기
            </Link>
          ) : (
            <p>어려웠던 문자가 없어요. 훌륭해요!</p>
          )}
          <Link className="primary-action" href={practiceRunHref(summary.config)}>
            같은 설정으로 다시 하기
          </Link>
          <Link href="/">홈으로</Link>
        </div>
      </section>
    </main>
  );
}
