"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { getKanaById, KANA_CATALOG } from "../features/kana/catalog";
import { getLearningRepository } from "../features/progress/learning-repository";
import type { LearningRepository, ProgressDashboard } from "../features/progress/types";

interface HomeDashboardProps {
  repository?: LearningRepository;
  today?: string;
}

const FIRST_VISIT_STORAGE_KEY = "kana-learning-first-visit-explained";
const firstVisitListeners = new Set<() => void>();

function subscribeToFirstVisit(listener: () => void) {
  firstVisitListeners.add(listener);
  return () => firstVisitListeners.delete(listener);
}

function firstVisitSnapshot(): boolean {
  try {
    return window.localStorage.getItem(FIRST_VISIT_STORAGE_KEY) !== "seen";
  } catch {
    return true;
  }
}

function FirstVisitExplanation() {
  const storedVisibility = useSyncExternalStore(subscribeToFirstVisit, firstVisitSnapshot, () => false);
  const [dismissedForVisit, setDismissedForVisit] = useState(false);
  const visible = storedVisibility && !dismissedForVisit;

  if (!visible) {
    return null;
  }

  function dismiss() {
    setDismissedForVisit(true);
    try {
      window.localStorage.setItem(FIRST_VISIT_STORAGE_KEY, "seen");
    } catch {
      // The explanation can still be dismissed for this visit without local storage.
    }
    firstVisitListeners.forEach((listener) => listener());
  }

  return (
    <section aria-labelledby="first-visit-heading" className="first-visit-guide">
      <div>
        <h2 id="first-visit-heading">처음 오셨나요?</h2>
        <p>글자표에서 모양과 획순을 익힌 뒤, 쓰기 연습에서 직접 따라 써 보세요.</p>
      </div>
      <button onClick={dismiss} type="button">설명 닫기</button>
    </section>
  );
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function HomeDashboard({
  repository,
  today = localDateKey(),
}: HomeDashboardProps) {
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [activeRepository, setActiveRepository] = useState<LearningRepository | null>(repository ?? null);

  useEffect(() => {
    let current = true;
    const nextRepository = repository ?? getLearningRepository();
    void Promise.all([
      nextRepository.getDashboard(),
      nextRepository.getPresentedOn(today),
    ]).then(
      ([value, presentedToday]) => {
        if (current) {
          setActiveRepository(nextRepository);
          setDashboard(value);
          setTodayCount(presentedToday);
          setLoadError(false);
        }
      },
      () => {
        if (current) {
          setActiveRepository(nextRepository);
          setLoadError(true);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [repository, today]);

  const practicedByScript = dashboard?.kana.reduce((counts, item) => {
    const script = getKanaById(item.kanaId)?.script;
    if (script) {
      counts[script] += 1;
    }
    return counts;
  }, { hiragana: 0, katakana: 0 }) ?? { hiragana: 0, katakana: 0 };
  const totalsByScript = {
    hiragana: KANA_CATALOG.filter((unit) => unit.script === "hiragana").length,
    katakana: KANA_CATALOG.filter((unit) => unit.script === "katakana").length,
  };
  const hiraganaPercent = percent(practicedByScript.hiragana, totalsByScript.hiragana);
  const katakanaPercent = percent(practicedByScript.katakana, totalsByScript.katakana);

  return (
    <section aria-labelledby="progress-heading" className="dashboard-section">
      <div className="section-title">
        <h2 id="progress-heading">학습 현황</h2>
        <p>기록은 이 브라우저에만 저장돼요</p>
      </div>
      {loadError ? <p role="alert">학습 기록을 불러오지 못했어요. 연습은 계속할 수 있어요.</p> : null}
      {activeRepository && !activeRepository.persistent ? (
        <p role="status">이 브라우저에서는 기록이 유지되지 않아요.</p>
      ) : null}
      <div className="progress-grid progress-grid--4">
        <article className="progress-card">
          <h3>오늘의 연습</h3>
          {dashboard ? (
            <p className="stat-large">{todayCount}회</p>
          ) : (
            <p className="stat-caption">오늘의 학습 기록은 연습을 마치면 표시돼요.</p>
          )}
        </article>
        <article className="progress-card">
          <h3>히라가나 진행</h3>
          <p className="stat-large">{hiraganaPercent}%</p>
          <div aria-hidden="true" className="progress-bar">
            <span style={{ width: `${hiraganaPercent}%` }} />
          </div>
          <p className="stat-caption">히라가나 {practicedByScript.hiragana} / {totalsByScript.hiragana}자 경험</p>
        </article>
        <article className="progress-card">
          <h3>가타카나 진행</h3>
          <p className="stat-large">{katakanaPercent}%</p>
          <div aria-hidden="true" className="progress-bar">
            <span style={{ width: `${katakanaPercent}%` }} />
          </div>
          <p className="stat-caption">가타카나 {practicedByScript.katakana} / {totalsByScript.katakana}자 경험</p>
        </article>
        <article className="progress-card">
          <h3>최근 연습 문자</h3>
          {dashboard?.recentKanaIds.length ? (
            <p className="stat-kana">
              {dashboard.recentKanaIds.map((id) => getKanaById(id)?.display ?? id).join(" ")}
            </p>
          ) : (
            <p className="stat-caption">가장 최근에 연습한 글자를 여기에서 다시 확인할 수 있어요.</p>
          )}
        </article>
      </div>
    </section>
  );
}

const HERO_TILES = [
  { glyph: "あ", tone: "accent" },
  { glyph: "い", tone: "" },
  { glyph: "う", tone: "tint" },
  { glyph: "カ", tone: "" },
  { glyph: "キ", tone: "tint" },
  { glyph: "ク", tone: "" },
] as const;

export default function HomePage() {
  return (
    <main className="page-container">
      <section aria-label="소개" className="hero">
        <div className="hero-copy">
          <span className="eyebrow">히라가나 · 가타카나</span>
          <h1>보고, 쓰고, 익히는<br />가장 쉬운 가나 학습</h1>
          <p>글자표에서 모양과 획순을 살펴보고, 직접 손으로 써 보며 일본어 가나를 자연스럽게 익혀보세요.</p>
        </div>
        <div aria-hidden="true" className="hero-visual">
          {HERO_TILES.map((tile) => (
            <span
              className={`hero-tile${tile.tone ? ` hero-tile--${tile.tone}` : ""}`}
              key={tile.glyph}
            >
              {tile.glyph}
            </span>
          ))}
        </div>
      </section>

      <FirstVisitExplanation />

      <section aria-labelledby="quick-start-heading" className="dashboard-section">
        <div className="section-title">
          <h2 id="quick-start-heading">바로 시작하기</h2>
        </div>
        <nav aria-label="학습 시작" className="primary-actions">
          <a className="action-card" href="/chart">
            <span aria-hidden="true" className="action-card-icon">表</span>
            <span className="action-card-body">
              <span className="action-card-title">글자표 보기</span>
              <span aria-hidden="true" className="action-card-desc">읽기와 획순을 한눈에</span>
            </span>
            <span aria-hidden="true" className="action-card-arrow">→</span>
          </a>
          <a className="action-card action-card--primary" href="/practice">
            <span aria-hidden="true" className="action-card-icon">書</span>
            <span className="action-card-body">
              <span className="action-card-title">쓰기 연습 시작</span>
              <span aria-hidden="true" className="action-card-desc">따라 쓰기 · 암기 테스트</span>
            </span>
            <span aria-hidden="true" className="action-card-arrow">→</span>
          </a>
        </nav>
      </section>

      <HomeDashboard />
    </main>
  );
}
