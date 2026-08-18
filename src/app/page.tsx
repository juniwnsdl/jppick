import { PageHeader } from "../components/page-header";

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

      <section aria-labelledby="progress-heading" className="dashboard-section">
        <h2 id="progress-heading">학습 현황</h2>
        <div className="progress-grid">
          <article className="progress-card">
            <h3>오늘의 연습</h3>
            <p>오늘의 학습 기록은 연습을 마치면 표시돼요.</p>
          </article>
          <article className="progress-card">
            <h3>최근 연습 문자</h3>
            <p>가장 최근에 연습한 글자를 여기에서 다시 확인할 수 있어요.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
