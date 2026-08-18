import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { createLearningRepository } from "../features/progress/learning-repository";
import HomePage, { HomeDashboard } from "./page";

beforeEach(() => {
  window.localStorage.clear();
});

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
  expect(screen.getByText(/히라가나 2 \/ 117자/)).toBeVisible();
  expect(screen.getByText(/가타카나 0 \/ 160자/)).toBeVisible();
});

it("keeps the home usable and reports a repository read failure", async () => {
  const repository = createLearningRepository({ indexedDB: null });
  vi.spyOn(repository, "getDashboard").mockRejectedValue(new DOMException("read failed"));

  render(<HomeDashboard repository={repository} today="2026-08-18" />);

  expect(await screen.findByRole("alert")).toHaveTextContent("학습 기록을 불러오지 못했어요");
  expect(screen.getByRole("heading", { name: "오늘의 연습" })).toBeVisible();
});

it("shows the first-visit explanation once after it is dismissed", async () => {
  const user = userEvent.setup();
  render(<HomePage />);

  expect(await screen.findByRole("heading", { name: "처음 오셨나요?" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "설명 닫기" }));
  expect(screen.queryByRole("heading", { name: "처음 오셨나요?" })).not.toBeInTheDocument();

  cleanup();
  render(<HomePage />);
  expect(screen.queryByRole("heading", { name: "처음 오셨나요?" })).not.toBeInTheDocument();
});

it("still dismisses the first-visit explanation when local storage rejects the write", async () => {
  const user = userEvent.setup();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("write denied");
  });
  render(<HomePage />);

  await user.click(screen.getByRole("button", { name: "설명 닫기" }));

  expect(screen.queryByRole("heading", { name: "처음 오셨나요?" })).not.toBeInTheDocument();
});
