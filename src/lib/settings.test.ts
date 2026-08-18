import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

const SETTINGS_STORAGE_KEY = "kana-learning-settings";

describe("settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the default learning guide settings when no saved settings exist", () => {
    expect(loadSettings()).toEqual({
      version: 1,
      guideLines: true,
      traceGuide: true,
      overlayOpacity: 0.55,
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("recovers the default settings when saved data is malformed", () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, "{not valid JSON");

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("recovers the default settings when saved data has an unsupported version", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 2, guideLines: false, traceGuide: false, overlayOpacity: 0.1 }),
    );

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps a saved overlay opacity outside the supported range", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        guideLines: false,
        traceGuide: false,
        overlayOpacity: 3,
      }),
    );

    expect(loadSettings()).toEqual({
      version: 1,
      guideLines: false,
      traceGuide: false,
      overlayOpacity: 1,
    });
  });

  it("persists normalized settings for the next load", () => {
    saveSettings({
      version: 1,
      guideLines: false,
      traceGuide: true,
      overlayOpacity: -0.2,
    });

    expect(loadSettings()).toEqual({
      version: 1,
      guideLines: false,
      traceGuide: true,
      overlayOpacity: 0,
    });
  });
});
