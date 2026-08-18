"use client";

import type { KanaUnit } from "../../kana/types";
import { PracticeSession } from "../../practice/components/practice-session";
import type { PracticeConfig } from "../../practice/types";
import { getLearningRepository } from "../learning-repository";

interface PersistentPracticeSessionProps {
  catalog: KanaUnit[];
  config: PracticeConfig;
}

export function PersistentPracticeSession({ catalog, config }: PersistentPracticeSessionProps) {
  return (
    <PracticeSession
      catalog={catalog}
      config={config}
      repository={getLearningRepository()}
    />
  );
}
