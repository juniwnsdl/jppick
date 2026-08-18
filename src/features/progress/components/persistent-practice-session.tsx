"use client";

import { useEffect, useState } from "react";

import type { KanaUnit } from "../../kana/types";
import { PracticeSession } from "../../practice/components/practice-session";
import type { KanaProgressById, PracticeConfig, Random } from "../../practice/types";
import { getLearningRepository } from "../learning-repository";
import type { LearningRepository } from "../types";

interface PersistentPracticeSessionProps {
  catalog: KanaUnit[];
  config: PracticeConfig;
  random?: Random;
  repository?: LearningRepository;
}

export function PersistentPracticeSession({
  catalog,
  config,
  random,
  repository = getLearningRepository(),
}: PersistentPracticeSessionProps) {
  const [progress, setProgress] = useState<KanaProgressById | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let current = true;
    void repository.getDashboard().then(
      (dashboard) => {
        if (current) {
          setLoadError(false);
          setProgress(Object.fromEntries(dashboard.kana.map((item) => [item.kanaId, {
            presented: item.presented,
            retry: item.retry,
          }])));
        }
      },
      () => {
        if (current) {
          setLoadError(true);
          setProgress({});
        }
      },
    );
    return () => {
      current = false;
    };
  }, [repository]);

  if (progress === null) {
    return <main className="page-container"><p aria-live="polite">학습 기록을 불러오고 있어요.</p></main>;
  }

  return (
    <>
      {loadError ? <p role="alert">학습 기록을 불러오지 못했어요. 이번 연습은 새 기록으로 시작해요.</p> : null}
      <PracticeSession
        catalog={catalog}
        config={config}
        progress={progress}
        random={random}
        repository={repository}
      />
    </>
  );
}
