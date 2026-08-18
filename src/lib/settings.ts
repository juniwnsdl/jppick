export interface AppSettings {
  version: 1;
  guideLines: boolean;
  traceGuide: boolean;
  overlayOpacity: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  guideLines: true,
  traceGuide: true,
  overlayOpacity: 0.55,
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

  const stored = value as Partial<AppSettings>;

  if (stored.version !== 1) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    version: 1,
    guideLines:
      typeof stored.guideLines === "boolean" ? stored.guideLines : DEFAULT_SETTINGS.guideLines,
    traceGuide:
      typeof stored.traceGuide === "boolean" ? stored.traceGuide : DEFAULT_SETTINGS.traceGuide,
    overlayOpacity: clampOpacity(stored.overlayOpacity),
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
