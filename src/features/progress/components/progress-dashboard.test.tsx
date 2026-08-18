import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { createLearningRepository } from "../learning-repository";
import { ProgressDashboard } from "./progress-dashboard";

async function populatedRepository() {
  const repository = createLearningRepository({ indexedDB: null });
  await repository.recordEvaluation("hiragana-a", "good", "2026-08-18T00:01:00.000Z");
  await repository.recordEvaluation("hiragana-i", "retry", "2026-08-18T00:02:00.000Z");
  await repository.recordEvaluation("hiragana-i", "good", "2026-08-18T00:03:00.000Z");
  await repository.saveSession({
    id: "session-1",
    startedAt: "2026-08-18T00:00:00.000Z",
    endedAt: "2026-08-18T00:04:00.000Z",
    config: {
      mode: "copy",
      scripts: ["hiragana"],
      groups: ["basic"],
      count: 5,
      strategy: "uniform",
    },
    completed: 3,
    good: 2,
    retry: 1,
    answers: [],
  });
  return repository;
}

it("shows totals and ranks least-practiced and difficult kana from real records", async () => {
  const repository = await populatedRepository();
  render(<ProgressDashboard repository={repository} />);

  expect(await screen.findByText("총 3회")).toBeVisible();
  expect(screen.getByText("완료한 연습 1회")).toBeVisible();
  expect(screen.getByRole("list", { name: "가장 적게 연습한 문자" })).toHaveTextContent("あ");
  expect(screen.getByRole("list", { name: "어려운 문자 순위" })).toHaveTextContent("い");
  expect(screen.getByRole("row", { name: /い.*2.*1.*1/ })).toBeVisible();
  expect(screen.getByText("이 브라우저에서는 기록이 유지되지 않아요.")).toBeVisible();
});

it("requires the deletion word after entering the destructive confirmation step", async () => {
  const user = userEvent.setup();
  const repository = await populatedRepository();
  render(<ProgressDashboard repository={repository} />);

  await screen.findByText("총 3회");
  await user.click(screen.getByRole("button", { name: "기록 삭제" }));

  expect(screen.getByText("삭제한 기록은 복구할 수 없어요.")).toBeVisible();
  const confirmButton = screen.getByRole("button", { name: "모든 기록 영구 삭제" });
  expect(confirmButton).toBeDisabled();

  await user.type(screen.getByRole("textbox", { name: "삭제 확인" }), "삭제");
  expect(confirmButton).toBeEnabled();
  await user.click(confirmButton);

  await waitFor(() => expect(screen.getByText("총 0회")).toBeVisible());
  await expect(repository.getDashboard()).resolves.toMatchObject({ totalPresented: 0 });
});

it("reports read and delete failures without crashing or erasing the visible dashboard", async () => {
  const readFailure = createLearningRepository({ indexedDB: null });
  vi.spyOn(readFailure, "getDashboard").mockRejectedValue(new DOMException("read failed"));
  const first = render(<ProgressDashboard repository={readFailure} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("학습 기록을 불러오지 못했어요");
  first.unmount();

  const repository = await populatedRepository();
  vi.spyOn(repository, "clearAll").mockRejectedValue(new DOMException("write failed"));
  const user = userEvent.setup();
  render(<ProgressDashboard repository={repository} />);
  await screen.findByText("총 3회");
  await user.click(screen.getByRole("button", { name: "기록 삭제" }));
  await user.type(screen.getByRole("textbox", { name: "삭제 확인" }), "삭제");
  await user.click(screen.getByRole("button", { name: "모든 기록 영구 삭제" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("기록을 삭제하지 못했어요");
  expect(screen.getByText("총 3회")).toBeVisible();
});
