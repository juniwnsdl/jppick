import {
  DEFAULT_DAILY_WORD_SETTINGS,
  normalizeDailyWordSettings,
  type DailyWordLevelSettings,
} from "../features/vocabulary/daily-word-settings";

export interface AppSettings {
  version: 2;
  guideLines: boolean;
  traceGuide: boolean;
  overlayOpacity: number;
  dailyWords: DailyWordLevelSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 2,
  guideLines: true,
  traceGuide: true,
  overlayOpacity: 0.55,
  dailyWords: DEFAULT_DAILY_WORD_SETTINGS,
};

const SETTINGS_STORAGE_KEY = "kana-learning-settings";

function clampOpacity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.overlayOpacity;
  }

  return Math.min(1, Math.max(0, value));
}

function parseSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SETTINGS };
  }

  const stored = value as {
    version?: unknown;
    guideLines?: unknown;
    traceGuide?: unknown;
    overlayOpacity?: unknown;
    dailyWords?: unknown;
  };

  if (stored.version !== 1 && stored.version !== 2) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    version: 2,
    guideLines:
      typeof stored.guideLines === "boolean" ? stored.guideLines : DEFAULT_SETTINGS.guideLines,
    traceGuide:
      typeof stored.traceGuide === "boolean" ? stored.traceGuide : DEFAULT_SETTINGS.traceGuide,
    overlayOpacity: clampOpacity(stored.overlayOpacity),
    dailyWords: stored.version === 2
      ? normalizeDailyWordSettings(stored.dailyWords)
      : normalizeDailyWordSettings(DEFAULT_DAILY_WORD_SETTINGS),
  };
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    return rawSettings ? parseSettings(JSON.parse(rawSettings)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parseSettings(settings)));
  } catch {
    // Settings are optional: the learning app remains usable if browser storage is unavailable.
  }
}
