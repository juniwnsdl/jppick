import { PageHeader } from "../../components/page-header";
import { KanaChart } from "../../features/kana/components/kana-chart";

export default function ChartPage() {
  return (
    <main className="page-container">
      <PageHeader
        description="문자 종류와 모음을 골라 읽기와 획순을 확인하세요."
        title="가나 글자표"
      />
      <KanaChart />
    </main>
  );
}
