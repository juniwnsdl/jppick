import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { KanaUnit } from "../../kana/types";
import { createLearningRepository } from "../learning-repository";
import { PersistentPracticeSession } from "./persistent-practice-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const catalog: KanaUnit[] = [
  { id: "hiragana-a", display: "あ", glyphs: ["あ"], script: "hiragana", group: "basic", chartRow: 0, romaji: "a", readingKo: "아", strokeAssetKeys: ["hiragana/あ"] },
  { id: "hiragana-i", display: "い", glyphs: ["い"], script: "hiragana", group: "basic", chartRow: 0, romaji: "i", readingKo: "이", strokeAssetKeys: ["hiragana/い"] },
];

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(), setTransform: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("loads persisted counters before generating a least-practiced queue", async () => {
  const repository = createLearningRepository({ indexedDB: null });
  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");
  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:02:00.000Z");

  render(
    <PersistentPracticeSession
      catalog={catalog}
      config={{ mode: "copy", scripts: ["hiragana"], groups: ["basic"], count: 5, strategy: "least-practiced" }}
      random={() => 1}
      repository={repository}
    />,
  );

  expect(await screen.findByLabelText("따라 쓸 문자")).toHaveTextContent("い");
});

it("starts safely with empty progress and reports a dashboard read failure", async () => {
  const repository = createLearningRepository({ indexedDB: null });
  vi.spyOn(repository, "getDashboard").mockRejectedValue(new DOMException("read failed"));

  render(
    <PersistentPracticeSession
      catalog={catalog}
      config={{ mode: "copy", scripts: ["hiragana"], groups: ["basic"], count: 5, strategy: "uniform" }}
      random={() => 0}
      repository={repository}
    />,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent("학습 기록을 불러오지 못했어요");
  expect(await screen.findByLabelText("따라 쓸 문자")).toHaveTextContent(/[あい]/);
});
