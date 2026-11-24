import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { DailyWordSettingsButton } from "./daily-word-settings-button";

const SETTINGS_STORAGE_KEY = "kana-learning-settings";

function saveDailyWordSettings(dailyWords: unknown) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
    version: 3,
    guideLines: true,
    traceGuide: true,
    overlayOpacity: 0.55,
    dailyWords,
  }));
}

describe("DailyWordSettingsButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens the difficulty dialog with the default N3, N4, and N5 choices", async () => {
    const user = userEvent.setup();
    render(<DailyWordSettingsButton />);

    await user.click(screen.getByRole("button", { name: "오늘의 단어 설정" }));

    const dialog = screen.getByRole("dialog", { name: "오늘의 단어 난이도" });
    expect(within(dialog).getByRole("checkbox", { name: "N1" })).not.toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N2" })).not.toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N3" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N4" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N5" })).toBeChecked();
    expect(within(dialog).getByText("변경한 난이도는 내일부터 적용됩니다")).toBeVisible();
  });

  it("prefers a pending tomorrow selection over today's active selection", async () => {
    const user = userEvent.setup();
    saveDailyWordSettings({
      activeLevels: ["N1", "N2", "N3"],
      pendingLevels: ["N2", "N4"],
      effectiveDate: "2026-08-22",
    });
    render(<DailyWordSettingsButton />);

    await user.click(screen.getByRole("button", { name: "오늘의 단어 설정" }));

    const dialog = screen.getByRole("dialog", { name: "오늘의 단어 난이도" });
    expect(within(dialog).getByRole("checkbox", { name: "N1" })).not.toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N2" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N3" })).not.toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "N4" })).toBeChecked();
  });

  it("prevents saving when every level is unchecked", async () => {
    const user = userEvent.setup();
    render(<DailyWordSettingsButton />);
    await user.click(screen.getByRole("button", { name: "오늘의 단어 설정" }));

    const dialog = screen.getByRole("dialog", { name: "오늘의 단어 난이도" });
    await user.click(within(dialog).getByRole("checkbox", { name: "N3" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "N4" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "N5" }));

    expect(within(dialog).getByText("최소 한 개의 난이도를 선택해 주세요.")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("cancels without changing stored settings", async () => {
    const user = userEvent.setup();
    saveDailyWordSettings({ activeLevels: ["N5"], pendingLevels: null, effectiveDate: null });
    const before = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    render(<DailyWordSettingsButton />);
    await user.click(screen.getByRole("button", { name: "오늘의 단어 설정" }));

    const dialog = screen.getByRole("dialog", { name: "오늘의 단어 난이도" });
    await user.click(within(dialog).getByRole("checkbox", { name: "N5" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "N1" }));
    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBe(before);
  });

  it("schedules a saved selection for tomorrow and announces it in Korean", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expectedEffectiveDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    const user = userEvent.setup();
    render(<DailyWordSettingsButton />);
    await user.click(screen.getByRole("button", { name: "오늘의 단어 설정" }));

    const dialog = screen.getByRole("dialog", { name: "오늘의 단어 난이도" });
    await user.click(within(dialog).getByRole("checkbox", { name: "N2" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "N3" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "N5" }));
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(screen.getByRole("status")).toHaveTextContent("내일부터 N2, N4 단어가 표시됩니다.");
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}").dailyWords).toEqual({
      activeLevels: ["N3", "N4", "N5"],
      pendingLevels: ["N2", "N4"],
      effectiveDate: expectedEffectiveDate,
    });
  });

  it("closes on Escape and backdrop click, restoring focus to the gear button", async () => {
    const user = userEvent.setup();
    render(<DailyWordSettingsButton />);
    const trigger = screen.getByRole("button", { name: "오늘의 단어 설정" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByTestId("daily-word-settings-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves focus into the dialog and traps Tab navigation", async () => {
    const user = userEvent.setup();
    render(<DailyWordSettingsButton />);
    const trigger = screen.getByRole("button", { name: "오늘의 단어 설정" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "오늘의 단어 난이도" });
    const firstChoice = within(dialog).getByRole("checkbox", { name: "N1" });
    const save = within(dialog).getByRole("button", { name: "저장" });
    expect(firstChoice).toHaveFocus();
    save.focus();
    await user.tab();
    expect(firstChoice).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
  });
});
