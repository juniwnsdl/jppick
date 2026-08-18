import type { KanaUnit } from "../kana/types";
import type { Stroke } from "./strokes";
import {
  appendUnlimitedCycle,
  createPracticeSessionState,
  parsePracticeRunSearchParams,
  practiceSessionReducer,
  toSessionSummary,
} from "./session-reducer";
import type { PracticeConfig, Question } from "./types";

const finiteConfig: PracticeConfig = {
  mode: "copy",
  scripts: ["hiragana"],
  groups: ["basic"],
  count: 5,
  strategy: "uniform",
};

const questions: Question[] = [
  { id: "question-1-hiragana-a", kanaId: "hiragana-a" },
  { id: "question-2-hiragana-i", kanaId: "hiragana-i" },
];

const stroke: Stroke = [
  { x: 0.1, y: 0.2, pressure: 0.4 },
  { x: 0.8, y: 0.9, pressure: 0.7 },
];

function startedState(config: PracticeConfig = finiteConfig) {
  return createPracticeSessionState({
    config,
    questions,
    overlayOpacity: 0.55,
    startedAt: "2026-08-18T00:00:00.000Z",
  });
}

describe("practiceSessionReducer", () => {
  it("appends completed strokes, undoes the last stroke, and clears the canvas", () => {
    let state = startedState();

    state = practiceSessionReducer(state, { type: "START_STROKE", stroke });
    state = practiceSessionReducer(state, {
      type: "START_STROKE",
      stroke: [{ x: 0.5, y: 0.5, pressure: 0.3 }],
    });
    expect(state.currentStrokes).toHaveLength(2);

    state = practiceSessionReducer(state, { type: "UNDO" });
    expect(state.currentStrokes).toEqual([stroke]);

    state = practiceSessionReducer(state, { type: "CLEAR" });
    expect(state.currentStrokes).toEqual([]);
  });

  it("reveals the model and clamps overlay opacity to the valid range", () => {
    let state = practiceSessionReducer(startedState(), { type: "REVEAL" });

    expect(state.phase).toBe("reviewing");

    state = practiceSessionReducer(state, { type: "SET_OVERLAY_OPACITY", opacity: 2 });
    expect(state.overlayOpacity).toBe(1);

    state = practiceSessionReducer(state, { type: "SET_OVERLAY_OPACITY", opacity: -1 });
    expect(state.overlayOpacity).toBe(0);
  });

  it("rejects evaluation before reveal and records one result after reveal", () => {
    const writing = practiceSessionReducer(startedState(), { type: "START_STROKE", stroke });
    const rejected = practiceSessionReducer(writing, {
      type: "EVALUATE",
      evaluation: "good",
      answeredAt: "2026-08-18T00:01:00.000Z",
    });

    expect(rejected).toBe(writing);

    const reviewing = practiceSessionReducer(writing, { type: "REVEAL" });
    const evaluated = practiceSessionReducer(reviewing, {
      type: "EVALUATE",
      evaluation: "retry",
      answeredAt: "2026-08-18T00:02:00.000Z",
    });

    expect(evaluated.results).toEqual([{
      kanaId: "hiragana-a",
      evaluation: "retry",
      answeredAt: "2026-08-18T00:02:00.000Z",
    }]);
    expect(evaluated.currentStrokes).toEqual([]);
  });

  it("advances only after evaluation and starts the next question with no raw strokes", () => {
    let state = practiceSessionReducer(startedState(), { type: "START_STROKE", stroke });
    expect(practiceSessionReducer(state, { type: "NEXT" })).toBe(state);

    state = practiceSessionReducer(state, { type: "REVEAL" });
    state = practiceSessionReducer(state, {
      type: "EVALUATE",
      evaluation: "good",
      answeredAt: "2026-08-18T00:03:00.000Z",
    });
    state = practiceSessionReducer(state, { type: "NEXT" });

    expect(state.currentIndex).toBe(1);
    expect(state.phase).toBe("writing");
    expect(state.currentStrokes).toEqual([]);
  });

  it("completes a finite session after the final evaluated question", () => {
    let state = createPracticeSessionState({
      config: { ...finiteConfig, count: 5 },
      questions: questions.slice(0, 1),
      overlayOpacity: 0.55,
      startedAt: "2026-08-18T00:00:00.000Z",
    });
    state = practiceSessionReducer(state, { type: "REVEAL" });
    state = practiceSessionReducer(state, {
      type: "EVALUATE",
      evaluation: "good",
      answeredAt: "2026-08-18T00:04:00.000Z",
    });
    state = practiceSessionReducer(state, {
      type: "NEXT",
      endedAt: "2026-08-18T00:05:00.000Z",
    });

    expect(state.phase).toBe("complete");
    expect(state.endedAt).toBe("2026-08-18T00:05:00.000Z");
  });

  it("never completes an unlimited session on NEXT and completes only on END", () => {
    const config: PracticeConfig = { ...finiteConfig, count: "unlimited" };
    let state = createPracticeSessionState({
      config,
      questions: questions.slice(0, 1),
      overlayOpacity: 0.55,
      startedAt: "2026-08-18T00:00:00.000Z",
    });
    state = practiceSessionReducer(state, { type: "REVEAL" });
    state = practiceSessionReducer(state, {
      type: "EVALUATE",
      evaluation: "good",
      answeredAt: "2026-08-18T00:04:00.000Z",
    });

    const waitingForCycle = practiceSessionReducer(state, { type: "NEXT" });
    expect(waitingForCycle.phase).toBe("reviewing");

    state = practiceSessionReducer(state, {
      type: "NEXT",
      nextQuestions: [{ id: "question-2-hiragana-i", kanaId: "hiragana-i" }],
    });
    expect(state.phase).toBe("writing");
    expect(state.currentIndex).toBe(1);

    state = practiceSessionReducer(state, {
      type: "END",
      endedAt: "2026-08-18T00:06:00.000Z",
    });
    expect(state.phase).toBe("complete");
  });

  it("serializes a stroke-free result summary", () => {
    let state = practiceSessionReducer(startedState(), { type: "START_STROKE", stroke });
    state = practiceSessionReducer(state, { type: "REVEAL" });
    state = practiceSessionReducer(state, {
      type: "EVALUATE",
      evaluation: "good",
      answeredAt: "2026-08-18T00:07:00.000Z",
    });

    const summary = toSessionSummary(state);

    expect(summary).toEqual({
      config: finiteConfig,
      startedAt: "2026-08-18T00:00:00.000Z",
      endedAt: undefined,
      results: [{
        kanaId: "hiragana-a",
        evaluation: "good",
        answeredAt: "2026-08-18T00:07:00.000Z",
      }],
    });
    expect(JSON.stringify(summary)).not.toContain("pressure");
  });
});

describe("appendUnlimitedCycle", () => {
  const catalog: KanaUnit[] = [
    unit("hiragana-a"),
    unit("hiragana-i"),
  ];

  it("appends one complete selected catalog cycle and prevents a boundary repeat", () => {
    const appended = appendUnlimitedCycle({
      config: { ...finiteConfig, count: "unlimited" },
      catalog,
      previousKanaId: "hiragana-a",
      questionOffset: 2,
      random: () => 0,
    });

    expect(appended.map((question) => question.kanaId)).toEqual([
      "hiragana-i",
      "hiragana-a",
    ]);
    expect(appended.map((question) => question.id)).toEqual([
      "question-3-hiragana-i",
      "question-4-hiragana-a",
    ]);
  });

  it("allows the same boundary kana when only one candidate exists", () => {
    const appended = appendUnlimitedCycle({
      config: { ...finiteConfig, count: "unlimited" },
      catalog: catalog.slice(0, 1),
      previousKanaId: "hiragana-a",
      questionOffset: 1,
      random: () => 0,
    });

    expect(appended.map((question) => question.kanaId)).toEqual(["hiragana-a"]);
  });
});

describe("parsePracticeRunSearchParams", () => {
  it("accepts an exact setup query and optional selected kana ids", () => {
    expect(parsePracticeRunSearchParams({
      mode: "recall",
      scripts: "katakana",
      groups: "basic,yoon",
      count: "unlimited",
      strategy: "difficult",
      kanaIds: "katakana-a,katakana-kya",
    })).toEqual({
      config: {
        mode: "recall",
        scripts: ["katakana"],
        groups: ["basic", "yoon"],
        count: "unlimited",
        strategy: "difficult",
      },
      kanaIds: ["katakana-a", "katakana-kya"],
    });
  });

  it.each([
    {},
    { mode: "unknown", scripts: "hiragana", groups: "basic", count: "5", strategy: "uniform" },
    { mode: "copy", scripts: "", groups: "basic", count: "5", strategy: "uniform" },
    { mode: "copy", scripts: "hiragana,bogus", groups: "basic", count: "5", strategy: "uniform" },
    { mode: "copy", scripts: "hiragana", groups: "basic", count: "7", strategy: "uniform" },
    { mode: ["copy", "recall"], scripts: "hiragana", groups: "basic", count: "5", strategy: "uniform" },
  ])("rejects malformed or incomplete run settings: %j", (searchParams) => {
    expect(parsePracticeRunSearchParams(searchParams)).toBeNull();
  });
});

function unit(id: string): KanaUnit {
  return {
    id,
    display: id,
    glyphs: [id],
    script: "hiragana",
    group: "basic",
    romaji: id,
    readingKo: id,
    strokeAssetKeys: [id],
  };
}
