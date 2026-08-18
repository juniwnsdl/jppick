"use client";

import { useEffect, useMemo, useState } from "react";

import { getKanaById } from "../../kana/catalog";
import { getLearningRepository } from "../learning-repository";
import type {
  KanaProgress,
  LearningRepository,
  ProgressDashboard as ProgressDashboardValue,
} from "../types";

const EMPTY_DASHBOARD: ProgressDashboardValue = {
  totalPresented: 0,
  completedSessions: 0,
  lastPracticedAt: null,
  kana: [],
  recentKanaIds: [],
};

interface ProgressDashboardProps {
  repository?: LearningRepository;
}

function kanaLabel(kanaId: string): string {
  return getKanaById(kanaId)?.display ?? kanaId;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "아직 기록이 없어요";
  }
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

function byLeastPracticed(left: KanaProgress, right: KanaProgress): number {
  return left.presented - right.presented || left.kanaId.localeCompare(right.kanaId);
}

function byDifficulty(left: KanaProgress, right: KanaProgress): number {
  const ratioDifference = right.retry / right.presented - left.retry / left.presented;
  return ratioDifference || right.retry - left.retry || left.kanaId.localeCompare(right.kanaId);
}

export function ProgressDashboard({
  repository,
}: ProgressDashboardProps) {
  const [dashboard, setDashboard] = useState<ProgressDashboardValue | null>(null);
  const [activeRepository, setActiveRepository] = useState<LearningRepository | null>(repository ?? null);
  const [deleteStep, setDeleteStep] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const nextRepository = repository ?? getLearningRepository();
    void nextRepository.getDashboard().then(
      (value) => {
        if (current) {
          setActiveRepository(nextRepository);
          setDashboard(value);
          setErrorMessage(null);
        }
      },
      () => {
        if (current) {
          setActiveRepository(nextRepository);
          setErrorMessage("학습 기록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
        }
      },
    );
    return () => {
      current = false;
    };
  }, [repository]);

  const value = dashboard ?? EMPTY_DASHBOARD;
  const leastPracticed = useMemo(() => [...value.kana].sort(byLeastPracticed), [value.kana]);
  const difficult = useMemo(() => [...value.kana].sort(byDifficulty), [value.kana]);

  async function clearRecords() {
    if (!activeRepository) {
      return;
    }
    try {
      await activeRepository.clearAll();
      setDashboard(await activeRepository.getDashboard());
      setErrorMessage(null);
      setDeleteStep(false);
      setConfirmation("");
    } catch {
      setErrorMessage("기록을 삭제하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.");
      setDeleteStep(false);
      setConfirmation("");
    }
  }

  return (
    <>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {activeRepository && !activeRepository.persistent ? (
        <p role="status">이 브라우저에서는 기록이 유지되지 않아요.</p>
      ) : null}

      <section aria-labelledby="record-summary-heading" className="dashboard-section">
        <h2 id="record-summary-heading">학습 요약</h2>
        <div className="progress-grid">
          <article className="progress-card"><h3>누적 연습</h3><p>총 {value.totalPresented}회</p></article>
          <article className="progress-card"><h3>완료한 연습</h3><p>완료한 연습 {value.completedSessions}회</p></article>
          <article className="progress-card"><h3>마지막 연습</h3><p>{formatDate(value.lastPracticedAt)}</p></article>
        </div>
      </section>

      <section aria-labelledby="least-heading" className="dashboard-section">
        <h2 id="least-heading">가장 적게 연습한 문자</h2>
        <ol aria-label="가장 적게 연습한 문자">
          {leastPracticed.length > 0 ? leastPracticed.slice(0, 5).map((item) => (
            <li key={item.kanaId}>{kanaLabel(item.kanaId)} · {item.presented}회</li>
          )) : <li>아직 연습한 문자가 없어요.</li>}
        </ol>
      </section>

      <section aria-labelledby="difficult-heading" className="dashboard-section">
        <h2 id="difficult-heading">어려운 문자</h2>
        <ol aria-label="어려운 문자 순위">
          {difficult.length > 0 ? difficult.slice(0, 5).map((item) => (
            <li key={item.kanaId}>
              {kanaLabel(item.kanaId)} · 다시 연습 {Math.round(item.retry / item.presented * 100)}%
            </li>
          )) : <li>연습 기록이 쌓이면 표시돼요.</li>}
        </ol>
      </section>

      <section aria-labelledby="per-kana-heading" className="dashboard-section">
        <h2 id="per-kana-heading">문자별 기록</h2>
        <table className="progress-table">
          <thead><tr><th scope="col">문자</th><th scope="col">전체</th><th scope="col">잘 씀</th><th scope="col">다시</th></tr></thead>
          <tbody>
            {value.kana.map((item) => (
              <tr key={item.kanaId}>
                <th scope="row">{kanaLabel(item.kanaId)}</th>
                <td>{item.presented}</td><td>{item.good}</td><td>{item.retry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="delete-heading" className="dashboard-section records-delete">
        <h2 id="delete-heading">기록 관리</h2>
        {!deleteStep ? (
          <button onClick={() => setDeleteStep(true)} type="button">기록 삭제</button>
        ) : (
          <div className="records-delete-controls">
            <p role="alert">삭제한 기록은 복구할 수 없어요.</p>
            <label>
              삭제 확인
              <input
                onChange={(event) => setConfirmation(event.currentTarget.value)}
                value={confirmation}
              />
            </label>
            <div className="records-delete-actions">
              <button
                disabled={confirmation !== "삭제"}
                onClick={() => void clearRecords()}
                type="button"
              >
                모든 기록 영구 삭제
              </button>
              <button onClick={() => { setDeleteStep(false); setConfirmation(""); }} type="button">취소</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
