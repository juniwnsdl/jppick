import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JlptLevel, VocabularyWord } from "../types";
import { DailyWords } from "./daily-words";

const date = new Date(2026, 7, 21, 9, 30);

function wordsFor(level: JlptLevel): VocabularyWord[] {
  return Array.from({ length: 5 }, (_, index) => ({
    word: `단어${index + 1}-${level.slice(1)}`,
    reading: `읽기${index + 1}-${level.slice(1)}`,
    pronunciationKo: `발음 ${index + 1}-${level.slice(1)}`,
    meaningKo: `뜻 ${index + 1}-${level.slice(1)}`,
    level,
  }));
}

function successfulLoader() {
  return vi.fn(async (level: JlptLevel) => wordsFor(level));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("DailyWords", () => {
  it("shows a loading status before today's five word cards are ready", () => {
    const loader = vi.fn(() => new Promise<VocabularyWord[]>(() => {}));

    render(<DailyWords date={date} loader={loader} />);

    expect(screen.getByRole("status")).toHaveTextContent("오늘의 단어를 불러오는 중이에요");
  });

  it("shows five semantic cards with reading, Korean pronunciation, meaning, and level", async () => {
    const loader = successfulLoader();

    render(<DailyWords date={date} loader={loader} />);

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(5);
    expect(screen.getByText("2026년 8월 21일")).toBeVisible();

    const firstCard = within(cards[0]);
    expect(firstCard.getByRole("heading")).toBeVisible();
    expect(firstCard.getByText(/ · /)).toBeVisible();
    expect(firstCard.getByText(/^뜻 /)).toBeVisible();
    expect(firstCard.getByText(/N[1-3]/)).toBeVisible();
  });

  it("loads only the currently active default levels", async () => {
    const loader = successfulLoader();

    render(<DailyWords date={date} loader={loader} />);

    await screen.findAllByRole("article");
    expect(loader.mock.calls.map(([level]) => level).sort()).toEqual(["N1", "N2", "N3"]);
  });

  it("promotes an effective setting before loading and persists the promoted levels", async () => {
    window.localStorage.setItem("kana-learning-settings", JSON.stringify({
      version: 2,
      guideLines: true,
      traceGuide: true,
      overlayOpacity: 0.55,
      dailyWords: {
        activeLevels: ["N1"],
        pendingLevels: ["N4"],
        effectiveDate: "2026-08-21",
      },
    }));
    const loader = successfulLoader();

    render(<DailyWords date={date} loader={loader} />);

    await screen.findAllByRole("article");
    expect(loader.mock.calls.map(([level]) => level)).toEqual(["N4"]);
    expect(JSON.parse(window.localStorage.getItem("kana-learning-settings") ?? "{}"))
      .toMatchObject({ dailyWords: { activeLevels: ["N4"], pendingLevels: null, effectiveDate: null } });
  });

  it("keeps a failed load isolated and retries it on request", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("N1 단어 데이터를 불러오지 못했어요."))
      .mockImplementation(async (level: JlptLevel) => wordsFor(level));
    const user = userEvent.setup();

    render(<DailyWords date={date} loader={loader} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("오늘의 단어를 불러오지 못했어요");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findAllByRole("article")).toHaveLength(5);
  });

  it("reports a selection failure instead of leaving the loading status visible", async () => {
    const loader = vi.fn(async (level: JlptLevel) => [wordsFor(level)[0]]);

    render(<DailyWords date={date} loader={loader} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("오늘의 단어를 불러오지 못했어요");
  });
});
