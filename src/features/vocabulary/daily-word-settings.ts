import { nextLocalDateKey } from "./local-date";
import { JLPT_LEVELS, type JlptLevel } from "./types";

export interface DailyWordLevelSettings {
  activeLevels: JlptLevel[];
  pendingLevels: JlptLevel[] | null;
  effectiveDate: string | null;
}

export const DEFAULT_DAILY_WORD_SETTINGS: DailyWordLevelSettings = {
  activeLevels: ["N1", "N2", "N3"],
  pendingLevels: null,
  effectiveDate: null,
};

function copySettings(settings: DailyWordLevelSettings): DailyWordLevelSettings {
  return {
    activeLevels: [...settings.activeLevels],
    pendingLevels: settings.pendingLevels ? [...settings.pendingLevels] : null,
    effectiveDate: settings.effectiveDate,
  };
}

function normalizeLevels(value: unknown): JlptLevel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const selected = new Set(value.filter((level): level is JlptLevel => (
    typeof level === "string" && JLPT_LEVELS.includes(level as JlptLevel)
  )));

  return JLPT_LEVELS.filter((level) => selected.has(level));
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeDailyWordSettings(value: unknown): DailyWordLevelSettings {
  if (!value || typeof value !== "object") {
    return copySettings(DEFAULT_DAILY_WORD_SETTINGS);
  }

  const stored = value as Partial<DailyWordLevelSettings>;
  const activeLevels = normalizeLevels(stored.activeLevels);
  const pendingLevels = normalizeLevels(stored.pendingLevels);

  if (pendingLevels.length === 0 || !isDateKey(stored.effectiveDate)) {
    return {
      activeLevels: activeLevels.length > 0
        ? activeLevels
        : [...DEFAULT_DAILY_WORD_SETTINGS.activeLevels],
      pendingLevels: null,
      effectiveDate: null,
    };
  }

  return {
    activeLevels: activeLevels.length > 0
      ? activeLevels
      : [...DEFAULT_DAILY_WORD_SETTINGS.activeLevels],
    pendingLevels,
    effectiveDate: stored.effectiveDate,
  };
}

export function resolveDailyWordSettings(
  settings: DailyWordLevelSettings,
  today: string,
): DailyWordLevelSettings {
  const normalized = normalizeDailyWordSettings(settings);

  if (
    normalized.pendingLevels
    && normalized.effectiveDate
    && isDateKey(today)
    && today >= normalized.effectiveDate
  ) {
    return {
      activeLevels: normalized.pendingLevels,
      pendingLevels: null,
      effectiveDate: null,
    };
  }

  return normalized;
}

export function scheduleDailyWordLevels(
  settings: DailyWordLevelSettings,
  selected: readonly JlptLevel[],
  now: Date,
): DailyWordLevelSettings {
  const pendingLevels = normalizeLevels(selected);
  if (pendingLevels.length === 0) {
    throw new Error("Daily word settings require at least one level.");
  }

  const normalized = normalizeDailyWordSettings(settings);
  return {
    activeLevels: normalized.activeLevels,
    pendingLevels,
    effectiveDate: nextLocalDateKey(now),
  };
}
