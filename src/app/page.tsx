export default function HomePage() {
  return (
    <main className="page-container">
      <h1>가나 학습</h1>
      <nav aria-label="학습 시작" className="primary-actions">
        <a className="primary-action" href="/chart">
          글자표 보기
        </a>
        <a className="primary-action" href="/practice">
          쓰기 연습 시작
        </a>
      </nav>
    </main>
  );
}
