"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "../components/page-header";
import { getKanaById } from "../features/kana/catalog";
import { getLearningRepository } from "../features/progress/learning-repository";
import type { LearningRepository, ProgressDashboard } from "../features/progress/types";

interface HomeDashboardProps {
  repository?: LearningRepository;
  today?: string;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function HomeDashboard({
  repository,
  today = localDateKey(),
}: HomeDashboardProps) {
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [activeRepository, setActiveRepository] = useState<LearningRepository | null>(repository ?? null);

  useEffect(() => {
    let current = true;
    const nextRepository = repository ?? getLearningRepository();
    void Promise.all([
      nextRepository.getDashboard(),
      nextRepository.getPresentedOn(today),
    ]).then(([value, presentedToday]) => {
      if (current) {
        setActiveRepository(nextRepository);
        setDashboard(value);
        setTodayCount(presentedToday);
      }
    });
    return () => {
      current = false;
    };
  }, [repository, today]);

  return (
    <section aria-labelledby="progress-heading" className="dashboard-section">
      <h2 id="progress-heading">학습 현황</h2>
      {activeRepository && !activeRepository.persistent ? (
        <p role="status">이 브라우저에서는 기록이 유지되지 않아요.</p>
      ) : null}
      <div className="progress-grid">
        <article className="progress-card">
          <h3>오늘의 연습</h3>
          <p>{dashboard ? `${todayCount}회` : "오늘의 학습 기록은 연습을 마치면 표시돼요."}</p>
        </article>
        <article className="progress-card">
          <h3>최근 연습 문자</h3>
          <p>
            {dashboard?.recentKanaIds.length
              ? dashboard.recentKanaIds.map((id) => getKanaById(id)?.display ?? id).join(" ")
              : "가장 최근에 연습한 글자를 여기에서 다시 확인할 수 있어요."}
          </p>
        </article>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="page-container">
      <PageHeader
        title="가나 학습"
        description="글자표를 보고, 직접 써 보며 일본어 가나를 익혀보세요."
      />

      <section aria-labelledby="quick-start-heading" className="dashboard-section">
        <h2 id="quick-start-heading">바로 시작하기</h2>
        <nav aria-label="학습 시작" className="primary-actions">
          <a className="primary-action" href="/chart">
            글자표 보기
          </a>
          <a className="primary-action" href="/practice">
            쓰기 연습 시작
          </a>
        </nav>
      </section>

      <HomeDashboard />
    </main>
  );
}
