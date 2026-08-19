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

function retryRate(progress: KanaProgress): number {
  const evaluated = progress.good + progress.retry;
  return evaluated > 0 ? progress.retry / evaluated : 0;
}

function byDifficulty(left: KanaProgress, right: KanaProgress): number {
  const ratioDifference = retryRate(right) - retryRate(left);
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
        <div className="section-title">
          <h2 id="record-summary-heading">학습 요약</h2>
        </div>
        <div className="progress-grid progress-grid--3">
          <article className="progress-card">
            <h3>누적 연습</h3>
            <p className="stat-large">총 {value.totalPresented}회</p>
          </article>
          <article className="progress-card">
            <h3>연습 세션</h3>
            <p>완료한 연습 {value.completedSessions}회</p>
          </article>
          <article className="progress-card">
            <h3>마지막 연습</h3>
            <p>{formatDate(value.lastPracticedAt)}</p>
          </article>
        </div>
      </section>

      <div className="records-columns">
        <section aria-labelledby="least-heading" className="dashboard-section">
          <div className="section-title">
            <h2 id="least-heading">가장 적게 연습한 문자</h2>
          </div>
          <ol aria-label="가장 적게 연습한 문자" className="rank-list">
            {leastPracticed.length > 0 ? leastPracticed.slice(0, 5).map((item) => (
              <li key={item.kanaId}>
                <span className="rank-kana">{kanaLabel(item.kanaId)}</span>
                <span className="rank-meta">{item.presented}회</span>
              </li>
            )) : <li className="rank-empty">아직 연습한 문자가 없어요.</li>}
          </ol>
        </section>

        <section aria-labelledby="difficult-heading" className="dashboard-section">
          <div className="section-title">
            <h2 id="difficult-heading">어려운 문자</h2>
          </div>
          <ol aria-label="어려운 문자 순위" className="rank-list">
            {difficult.length > 0 ? difficult.slice(0, 5).map((item) => (
              <li key={item.kanaId}>
                <span className="rank-kana">{kanaLabel(item.kanaId)}</span>
                <span className="rank-meta">다시 연습 {Math.round(retryRate(item) * 100)}%</span>
              </li>
            )) : <li className="rank-empty">연습 기록이 쌓이면 표시돼요.</li>}
          </ol>
        </section>
      </div>

      <section aria-labelledby="per-kana-heading" className="dashboard-section">
        <div className="section-title">
          <h2 id="per-kana-heading">문자별 기록</h2>
          <p>{value.kana.length}자</p>
        </div>
        <div className="progress-table-wrap">
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
          {value.kana.length === 0 ? <p className="progress-table-empty">아직 기록이 없어요. 연습을 마치면 문자별 기록이 쌓여요.</p> : null}
        </div>
      </section>

      <section aria-labelledby="delete-heading" className="dashboard-section records-delete">
        <h2 id="delete-heading">기록 관리</h2>
        <p>모든 학습 기록을 이 브라우저에서 지워요. 삭제 후에는 되돌릴 수 없어요.</p>
        {!deleteStep ? (
          <button className="btn-secondary" onClick={() => setDeleteStep(true)} type="button">기록 삭제</button>
        ) : (
          <div className="records-delete-controls">
            <p role="alert">삭제한 기록은 복구할 수 없어요.</p>
            <label>
              삭제 확인
              <input
                onChange={(event) => setConfirmation(event.currentTarget.value)}
                placeholder="삭제"
                value={confirmation}
              />
            </label>
            <div className="records-delete-actions">
              <button
                className="btn-danger"
                disabled={confirmation !== "삭제"}
                onClick={() => void clearRecords()}
                type="button"
              >
                모든 기록 영구 삭제
              </button>
              <button className="btn-secondary" onClick={() => { setDeleteStep(false); setConfirmation(""); }} type="button">취소</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
