import { redirect } from "next/navigation";

import { KANA_CATALOG } from "../../../features/kana/catalog";
import { PracticeSession } from "../../../features/practice/components/practice-session";
import { parsePracticeRunSearchParams } from "../../../features/practice/session-reducer";

interface PracticeRunPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const INVALID_SETTINGS_REDIRECT = "/practice?message=%EC%97%B0%EC%8A%B5%20%EC%84%A4%EC%A0%95%EC%9D%84%20%ED%99%95%EC%9D%B8%ED%95%B4%20%EC%A3%BC%EC%84%B8%EC%9A%94.";

export default async function PracticeRunPage({ searchParams }: PracticeRunPageProps) {
  const parsed = parsePracticeRunSearchParams(await searchParams);

  if (!parsed) {
    redirect(INVALID_SETTINGS_REDIRECT);
  }

  const selectedIds = parsed.kanaIds ? new Set(parsed.kanaIds) : undefined;
  const matchingCatalog = KANA_CATALOG.filter((unit) => (
    parsed.config.scripts.includes(unit.script)
    && parsed.config.groups.includes(unit.group)
    && (!selectedIds || selectedIds.has(unit.id))
  ));
  const everyRequestedKanaExists = !selectedIds || matchingCatalog.length === selectedIds.size;

  if (matchingCatalog.length === 0 || !everyRequestedKanaExists) {
    redirect(INVALID_SETTINGS_REDIRECT);
  }

  return (
    <PracticeSession
      catalog={matchingCatalog}
      config={parsed.config}
    />
  );
}
