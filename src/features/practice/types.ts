import type { KanaGroup, KanaScript } from "../kana/types";

export type PracticeMode = "copy" | "recall";
export type PracticeCount = 5 | 10 | 20 | "all" | "unlimited";
export type PracticeStrategy = "uniform" | "least-practiced" | "difficult" | "ordered";
export type PracticeEvaluation = "good" | "retry" | "practice";

export interface PracticeConfig {
  mode: PracticeMode;
  scripts: KanaScript[];
  groups: KanaGroup[];
  count: PracticeCount;
  strategy: PracticeStrategy;
}

export interface Question {
  id: string;
  kanaId: string;
}

/**
 * The question generator deliberately depends only on the counters used to
 * prioritize questions. The richer persisted progress model can extend this
 * shape without coupling the practice domain to a storage implementation.
 */
export interface KanaProgressSnapshot {
  presented: number;
  evaluated?: number;
  retry: number;
}

export type KanaProgressById = Record<string, KanaProgressSnapshot>;

export type Random = (maxExclusive: number) => number;
