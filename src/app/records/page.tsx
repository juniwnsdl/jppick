import { PageHeader } from "../../components/page-header";
import { ProgressDashboard } from "../../features/progress/components/progress-dashboard";

export default function RecordsPage() {
  return (
    <main className="page-container">
      <PageHeader
        title="학습 기록"
        description="연습 횟수와 어려운 문자를 확인하고 다음 학습을 계획해 보세요."
      />
      <ProgressDashboard />
    </main>
  );
}
