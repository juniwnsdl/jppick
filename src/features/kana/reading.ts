import type { KanaUnit } from "./types";

/**
 * Human-facing reading label: Korean pronunciation first, romaji in brackets.
 * e.g. あ → "아 [a]". Symbol-like units (long vowel mark) fall back to the Korean label only.
 */
export function kanaReadingParts(unit: Pick<KanaUnit, "romaji" | "readingKo">): { ko: string; romaji: string | null } {
  const symbolic = unit.romaji.includes("-");
  return { ko: unit.readingKo, romaji: symbolic ? null : unit.romaji };
}

export function formatKanaReading(unit: Pick<KanaUnit, "romaji" | "readingKo">): string {
  const { ko, romaji } = kanaReadingParts(unit);
  return romaji ? `${ko} [${romaji}]` : ko;
}
