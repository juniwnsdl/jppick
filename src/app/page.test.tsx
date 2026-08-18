import { render, screen } from "@testing-library/react";
import { createLearningRepository } from "../features/progress/learning-repository";
import HomePage, { HomeDashboard } from "./page";

it("offers chart and practice as the two primary actions", () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: "글자표 보기" })).toBeVisible();
  expect(screen.getByRole("link", { name: "쓰기 연습 시작" })).toBeVisible();
});

it("shows a dashboard with progress placeholders until learning data is available", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "바로 시작하기" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "오늘의 연습" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "최근 연습 문자" })).toBeVisible();
});

it("shows today's evaluations and recent kana from the repository", async () => {
  const repository = createLearningRepository({ indexedDB: null });
  await repository.recordEvaluation("hiragana-a", "retry", "2026-08-17T01:00:00.000Z");
  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T01:00:00.000Z");
  await repository.recordEvaluation("hiragana-i", "retry", "2026-08-17T01:00:00.000Z");

  render(
    <HomeDashboard
      repository={repository}
      today="2026-08-18"
    />,
  );

  expect(await screen.findByText("1회")).toBeVisible();
  expect(screen.getByText("あ い")).toBeVisible();
});
