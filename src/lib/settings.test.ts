import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_DAILY_WORD_SETTINGS } from "../features/vocabulary/daily-word-settings";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

const SETTINGS_STORAGE_KEY = "kana-learning-settings";

describe("settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the default learning guide settings when no saved settings exist", () => {
    expect(loadSettings()).toEqual({
      version: 3,
      guideLines: true,
      traceGuide: true,
      overlayOpacity: 0.55,
      dailyWords: DEFAULT_DAILY_WORD_SETTINGS,
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("recovers the default settings when saved data is malformed", () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, "{not valid JSON");

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates version 1 settings while preserving existing guide fields", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 1, guideLines: false, traceGuide: false, overlayOpacity: 0.1 }),
    );

    expect(loadSettings()).toEqual({
      version: 3,
      guideLines: false,
      traceGuide: false,
      overlayOpacity: 0.1,
      dailyWords: DEFAULT_DAILY_WORD_SETTINGS,
    });
  });

  it("migrates the previous N1, N2, and N3 default to the new default", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        guideLines: false,
        traceGuide: false,
        overlayOpacity: 0.1,
        dailyWords: {
          activeLevels: ["N1", "N2", "N3"],
          pendingLevels: null,
          effectiveDate: null,
        },
      }),
    );

    expect(loadSettings()).toEqual({
      version: 3,
      guideLines: false,
      traceGuide: false,
      overlayOpacity: 0.1,
      dailyWords: DEFAULT_DAILY_WORD_SETTINGS,
    });
  });

  it("preserves a custom selection while migrating version 2 settings", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        guideLines: true,
        traceGuide: false,
        overlayOpacity: 0.4,
        dailyWords: {
          activeLevels: ["N2", "N5"],
          pendingLevels: null,
          effectiveDate: null,
        },
      }),
    );

    expect(loadSettings()).toMatchObject({
      version: 3,
      dailyWords: {
        activeLevels: ["N2", "N5"],
        pendingLevels: null,
        effectiveDate: null,
      },
    });
  });

  it("recovers the default settings when saved data has an unsupported version", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 4, guideLines: false, traceGuide: false, overlayOpacity: 0.1 }),
    );

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps a saved overlay opacity outside the supported range", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        guideLines: false,
        traceGuide: false,
        overlayOpacity: 3,
        dailyWords: { activeLevels: ["N5"], pendingLevels: null, effectiveDate: null },
      }),
    );

    expect(loadSettings()).toEqual({
      version: 3,
      guideLines: false,
      traceGuide: false,
      overlayOpacity: 1,
      dailyWords: { activeLevels: ["N5"], pendingLevels: null, effectiveDate: null },
    });
  });

  it("persists normalized settings for the next load", () => {
    saveSettings({
      version: 3,
      guideLines: false,
      traceGuide: true,
      overlayOpacity: -0.2,
      dailyWords: {
        activeLevels: ["N5", "invalid", "N1", "N5"],
        pendingLevels: ["N3", "invalid", "N2", "N2"],
        effectiveDate: "2026-08-22",
      } as never,
    });

    expect(loadSettings()).toEqual({
      version: 3,
      guideLines: false,
      traceGuide: true,
      overlayOpacity: 0,
      dailyWords: {
        activeLevels: ["N1", "N5"],
        pendingLevels: ["N2", "N3"],
        effectiveDate: "2026-08-22",
      },
    });
  });

  it("falls back to default daily levels when saved level data is malformed", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        guideLines: false,
        traceGuide: true,
        overlayOpacity: 0.4,
        dailyWords: {
          activeLevels: ["N0", "N9"],
          pendingLevels: ["N2"],
          effectiveDate: "tomorrow",
        },
      }),
    );

    expect(loadSettings().dailyWords).toEqual(DEFAULT_DAILY_WORD_SETTINGS);
  });
});
