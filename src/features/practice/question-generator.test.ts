import { describe, expect, it } from "vitest";

import type { KanaUnit } from "../kana/types";
import { createQuestionQueue } from "./question-generator";
import type { PracticeConfig, Random } from "./types";

const catalog: KanaUnit[] = [
  unit("hiragana-a", "hiragana", "basic"),
  unit("hiragana-ga", "hiragana", "voiced"),
  unit("katakana-a", "katakana", "basic"),
  unit("katakana-kya", "katakana", "yoon"),
];

const allBasicConfig: PracticeConfig = {
  mode: "copy",
  scripts: ["hiragana", "katakana"],
  groups: ["basic"],
  count: 5,
  strategy: "uniform",
};

function unit(id: string, script: KanaUnit["script"], group: KanaUnit["group"]): KanaUnit {
  return {
    id,
    display: id,
    glyphs: [id],
    script,
    group,
    romaji: id,
    readingKo: id,
    strokeAssetKeys: [id],
  };
}

function sequenceRandom(values: number[]): Random {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("createQuestionQueue", () => {
  it("only queues kana matching every selected script and group filter", () => {
    const queue = createQuestionQueue(
      { ...allBasicConfig, scripts: ["katakana"], groups: ["yoon"], count: 5 },
      catalog,
      undefined,
      () => 0,
    );

    expect(queue.map((question) => question.kanaId)).toEqual([
      "katakana-kya",
      "katakana-kya",
      "katakana-kya",
      "katakana-kya",
      "katakana-kya",
    ]);
  });

  it("uses the injected random function to produce a repeatable uniform shuffle", () => {
    const queue = createQuestionQueue(
      { ...allBasicConfig, scripts: ["hiragana"], groups: ["basic", "voiced"], count: 5 },
      catalog,
      undefined,
      () => 0,
    );

    expect(queue.map((question) => question.kanaId)).toEqual([
      "hiragana-ga",
      "hiragana-a",
      "hiragana-ga",
      "hiragana-a",
      "hiragana-ga",
    ]);
  });

  it("does not repeat a kana inside one catalog cycle", () => {
    const queue = createQuestionQueue(
      { ...allBasicConfig, groups: ["basic", "voiced", "yoon"], count: 5 },
      catalog,
      undefined,
      () => 0,
    );

    expect(new Set(queue.slice(0, 4).map((question) => question.kanaId))).toHaveLength(4);
  });

  it("avoids a duplicate at the boundary between catalog cycles", () => {
    const twoKanaCatalog = [
      unit("hiragana-a", "hiragana", "basic"),
      unit("hiragana-i", "hiragana", "basic"),
    ];
    const queue = createQuestionQueue(
      { ...allBasicConfig, scripts: ["hiragana"], count: 5 },
      twoKanaCatalog,
      undefined,
      sequenceRandom([1, 0]),
    );

    expect(queue.map((question) => question.kanaId)).toEqual([
      "hiragana-a",
      "hiragana-i",
      "hiragana-a",
      "hiragana-i",
      "hiragana-a",
    ]);
  });

  it("falls back to the same uniform queue when a priority strategy has no progress", () => {
    const random: Random = () => 0;
    const uniform = createQuestionQueue(allBasicConfig, catalog, undefined, random);
    const leastPracticed = createQuestionQueue(
      { ...allBasicConfig, strategy: "least-practiced" },
      catalog,
      {},
      () => 0,
    );
    const difficult = createQuestionQueue(
      { ...allBasicConfig, strategy: "difficult" },
      catalog,
      {},
      () => 0,
    );

    expect(leastPracticed).toEqual(uniform);
    expect(difficult).toEqual(uniform);
  });

  it("prioritizes kana with fewer presentations for the least-practiced strategy", () => {
    const queue = createQuestionQueue(
      { ...allBasicConfig, scripts: ["hiragana"], groups: ["basic", "voiced"], count: 5, strategy: "least-practiced" },
      catalog,
      {
        "hiragana-a": { presented: 10, retry: 0 },
        "hiragana-ga": { presented: 0, retry: 0 },
      },
      (maxExclusive) => maxExclusive - 1,
    );

    expect(queue.slice(0, 2).map((question) => question.kanaId)).toEqual(["hiragana-ga", "hiragana-a"]);
  });

  it("prioritizes kana with a higher retry rate for the difficult strategy", () => {
    const queue = createQuestionQueue(
      { ...allBasicConfig, scripts: ["hiragana"], groups: ["basic", "voiced"], count: 5, strategy: "difficult" },
      catalog,
      {
        "hiragana-a": { presented: 10, retry: 0 },
        "hiragana-ga": { presented: 10, retry: 10 },
      },
      (maxExclusive) => maxExclusive - 1,
    );

    expect(queue.slice(0, 2).map((question) => question.kanaId)).toEqual(["hiragana-ga", "hiragana-a"]);
  });
});
