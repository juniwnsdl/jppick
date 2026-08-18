import { PageHeader } from "../../components/page-header";
import { getKanaById, KANA_CATALOG } from "../../features/kana/catalog";
import { PracticeSetup } from "../../features/practice/components/practice-setup";
import { practiceConfigFromSearchParams } from "../../features/practice/practice-config";

interface PracticePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedKanaId = Array.isArray(resolvedSearchParams.kana)
    ? resolvedSearchParams.kana[0]
    : resolvedSearchParams.kana;
  const requestedKana = requestedKanaId ? getKanaById(requestedKanaId) : undefined;
  const parsedConfig = practiceConfigFromSearchParams(resolvedSearchParams);
  const config = requestedKana ? {
    ...parsedConfig,
    scripts: [requestedKana.script],
    groups: [requestedKana.group],
  } : parsedConfig;
  const rawMessage = resolvedSearchParams.message;
  const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;

  return (
    <main className="page-container">
      <PageHeader
        title="쓰기 연습 설정"
        description="연습할 문자와 문제 수를 고른 뒤 바로 시작하세요."
      />
      {message ? <p role="alert">{message}</p> : null}
      <PracticeSetup
        catalog={KANA_CATALOG}
        initialConfig={config}
        selectedKanaIds={requestedKana ? [requestedKana.id] : undefined}
      />
    </main>
  );
}
