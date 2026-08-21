export const JLPT_LEVELS = ["N1", "N2", "N3", "N4", "N5"] as const;

export type JlptLevel = (typeof JLPT_LEVELS)[number];

export interface VocabularyWord {
  word: string;
  reading: string;
  pronunciationKo: string;
  meaningKo: string;
  level: JlptLevel;
}
