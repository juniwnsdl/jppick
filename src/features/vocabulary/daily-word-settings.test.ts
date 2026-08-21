import { describe, expect, it } from "vitest";

import {
  DEFAULT_DAILY_WORD_SETTINGS,
  resolveDailyWordSettings,
  scheduleDailyWordLevels,
  type DailyWordLevelSettings,
} from "./daily-word-settings";

describe("daily word level settings", () => {
  it("keeps today's active levels and schedules a replacement for tomorrow", () => {
    const scheduled = scheduleDailyWordLevels(
      DEFAULT_DAILY_WORD_SETTINGS,
      ["N5", "N2", "N2"],
      new Date(2026, 7, 21, 23, 59),
    );

    expect(scheduled).toEqual({
      activeLevels: ["N1", "N2", "N3"],
      pendingLevels: ["N2", "N5"],
      effectiveDate: "2026-08-22",
    });
  });

  it("replaces a same-day pending selection without changing active levels", () => {
    const firstSave = scheduleDailyWordLevels(
      DEFAULT_DAILY_WORD_SETTINGS,
      ["N4"],
      new Date(2026, 7, 21, 9),
    );

    expect(scheduleDailyWordLevels(firstSave, ["N1", "N5"], new Date(2026, 7, 21, 18)))
      .toEqual({
        activeLevels: ["N1", "N2", "N3"],
        pendingLevels: ["N1", "N5"],
        effectiveDate: "2026-08-22",
      });
  });

  it("promotes an effective selection before scheduling a new next-day selection", () => {
    const dayOneSettings: DailyWordLevelSettings = {
      activeLevels: ["N1", "N2", "N3"],
      pendingLevels: ["N4"],
      effectiveDate: "2026-08-22",
    };

    expect(scheduleDailyWordLevels(dayOneSettings, ["N5"], new Date(2026, 7, 22, 9)))
      .toEqual({
        activeLevels: ["N4"],
        pendingLevels: ["N5"],
        effectiveDate: "2026-08-23",
      });
  });

  it("does not promote a pending selection before its effective local date", () => {
    expect(resolveDailyWordSettings({
      activeLevels: ["N1", "N3"],
      pendingLevels: ["N4"],
      effectiveDate: "2026-08-22",
    }, "2026-08-21")).toEqual({
      activeLevels: ["N1", "N3"],
      pendingLevels: ["N4"],
      effectiveDate: "2026-08-22",
    });
  });

  it("promotes a pending selection on or after its effective local date", () => {
    expect(resolveDailyWordSettings({
      activeLevels: ["N1", "N3"],
      pendingLevels: ["N4", "N5"],
      effectiveDate: "2026-08-22",
    }, "2026-08-22")).toEqual({
      activeLevels: ["N4", "N5"],
      pendingLevels: null,
      effectiveDate: null,
    });

    expect(resolveDailyWordSettings({
      activeLevels: ["N1", "N3"],
      pendingLevels: ["N4", "N5"],
      effectiveDate: "2026-08-22",
    }, "2026-08-23")).toEqual({
      activeLevels: ["N4", "N5"],
      pendingLevels: null,
      effectiveDate: null,
    });
  });

  it("rejects an empty next-day level selection", () => {
    expect(() => scheduleDailyWordLevels(
      DEFAULT_DAILY_WORD_SETTINGS,
      [],
      new Date(2026, 7, 21),
    )).toThrow("at least one level");
  });
});
