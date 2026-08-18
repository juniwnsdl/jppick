import { PageHeader } from "../../components/page-header";
import { KANA_CATALOG } from "../../features/kana/catalog";
import {
  PracticeSetup,
  practiceConfigFromSearchParams,
} from "../../features/practice/components/practice-setup";

interface PracticePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const config = practiceConfigFromSearchParams(await searchParams);

  return (
    <main className="page-container">
      <PageHeader
        title="쓰기 연습 설정"
        description="연습할 문자와 문제 수를 고른 뒤 바로 시작하세요."
      />
      <PracticeSetup catalog={KANA_CATALOG} initialConfig={config} />
    </main>
  );
}
