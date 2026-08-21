import { describe, expect, it } from "vitest";

import { getDailyWords } from "./daily-word-selector";
import type { JlptLevel, VocabularyWord } from "./types";

const wordsByLevel = Object.fromEntries(
  (["N1", "N2", "N3", "N4", "N5"] as const).map((level) => [
    level,
    Array.from({ length: 7 }, (_, index) => word(level, index + 1)),
  ]),
) as Record<JlptLevel, VocabularyWord[]>;

function word(level: JlptLevel, number: number): VocabularyWord {
  return {
    word: `${level}-word-${number}`,
    reading: `${level}-reading-${number}`,
    pronunciationKo: `${level}-pronunciation-${number}`,
    meaningKo: `${level}-meaning-${number}`,
    level,
  };
}

function countByLevel(words: VocabularyWord[]): Record<JlptLevel, number> {
  return words.reduce(
    (counts, word) => {
      counts[word.level] += 1;
      return counts;
    },
    { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 },
  );
}

describe("getDailyWords", () => {
  it("returns the same ordered words for identical inputs", () => {
    const first = getDailyWords(wordsByLevel, "2026-08-21", ["N1", "N2", "N3"], 5);
    const second = getDailyWords(wordsByLevel, "2026-08-21", ["N1", "N2", "N3"], 5);

    expect(second).toEqual(first);
  });

  it("does not mutate the source arrays", () => {
    const before = structuredClone(wordsByLevel);

    getDailyWords(wordsByLevel, "2026-08-21", ["N1", "N2", "N3"], 5);

    expect(wordsByLevel).toEqual(before);
  });

  it("returns no duplicate words in a daily selection", () => {
    const dailyWords = getDailyWords(wordsByLevel, "2026-08-21", ["N1", "N2", "N3"], 5);

    expect(new Set(dailyWords.map((word) => word.word))).toHaveLength(5);
  });

  it("fills all five slots from one selected level", () => {
    const dailyWords = getDailyWords(wordsByLevel, "2026-08-21", ["N2"], 5);

    expect(dailyWords).toHaveLength(5);
    expect(dailyWords.every((word) => word.level === "N2")).toBe(true);
  });

  it("allocates five slots as 2/2/1 across three selected levels", () => {
    const dailyWords = getDailyWords(wordsByLevel, "2026-08-21", ["N1", "N2", "N3"], 5);
    const counts = countByLevel(dailyWords);

    expect([counts.N1, counts.N2, counts.N3].sort()).toEqual([1, 2, 2]);
  });

  it("allocates six slots evenly across the default N3, N4, and N5 levels", () => {
    const dailyWords = getDailyWords(wordsByLevel, "2026-08-21", ["N3", "N4", "N5"], 6);

    expect(countByLevel(dailyWords)).toEqual({ N1: 0, N2: 0, N3: 2, N4: 2, N5: 2 });
  });

  it("allocates one slot to each of five selected levels", () => {
    const dailyWords = getDailyWords(wordsByLevel, "2026-08-21", ["N1", "N2", "N3", "N4", "N5"], 5);

    expect(countByLevel(dailyWords)).toEqual({ N1: 1, N2: 1, N3: 1, N4: 1, N5: 1 });
  });

  it("chooses different selections for known different date keys", () => {
    const firstDay = getDailyWords(wordsByLevel, "2026-08-21", ["N1"], 5);
    const nextDay = getDailyWords(wordsByLevel, "2026-08-22", ["N1"], 5);

    expect(nextDay).not.toEqual(firstDay);
  });

  it("rejects an empty level selection", () => {
    expect(() => getDailyWords(wordsByLevel, "2026-08-21", [], 5)).toThrow("at least one active level");
  });

  it("rejects a pool that cannot fill its allocated slots", () => {
    expect(() => getDailyWords({ ...wordsByLevel, N1: [word("N1", 1)] }, "2026-08-21", ["N1"], 5)).toThrow(
      "N1 pool has 1 word, but needs 5",
    );
  });
});
