import { describe, expect, it } from "vitest";

import { filterKana, getKanaById, KANA_CATALOG } from "./catalog";

describe("KANA_CATALOG", () => {
  it("contains a unique, fully described entry for every modern kana unit", () => {
    const ids = KANA_CATALOG.map((unit) => unit.id);

    expect(new Set(ids).size).toBe(KANA_CATALOG.length);
    expect(KANA_CATALOG).toHaveLength(277);

    for (const unit of KANA_CATALOG) {
      expect(unit.display).not.toBe("");
      expect(unit.romaji).not.toBe("");
      expect(unit.readingKo).not.toBe("");
      expect(unit.strokeAssetKeys).toHaveLength(unit.glyphs.length);
      expect(unit.strokeAssetKeys.every((key) => key.length > 0)).toBe(true);
    }
  });

  it("has the 46 basic kana for each script", () => {
    expect(filterKana({ script: "hiragana", group: "basic" })).toHaveLength(46);
    expect(filterKana({ script: "katakana", group: "basic" })).toHaveLength(46);
  });

  it("includes required small, yoon, long-vowel, and extended units", () => {
    for (const display of ["っ", "ッ", "ー", "きゃ", "キャ", "ティ", "ファ"]) {
      expect(KANA_CATALOG.some((unit) => unit.display === display)).toBe(true);
    }
  });

  it("excludes historical kana", () => {
    for (const display of ["ゐ", "ゑ", "ヰ", "ヱ"]) {
      expect(KANA_CATALOG.some((unit) => unit.display === display)).toBe(false);
    }
  });

  it("finds a unit by its stable identifier", () => {
    expect(getKanaById("katakana-kya")).toMatchObject({
      display: "キャ",
      romaji: "kya",
      readingKo: "캬",
    });
    expect(getKanaById("unknown")).toBeUndefined();
  });

  it("filters units by the requested script and group", () => {
    const units = filterKana({ script: "katakana", group: "extended" });

    expect(units).toHaveLength(42);
    expect(units.every((unit) => unit.script === "katakana" && unit.group === "extended")).toBe(true);
  });

  it("keeps standard romaji even when two units share a reading", () => {
    expect(KANA_CATALOG.find((unit) => unit.display === "ぢ")?.romaji).toBe("ji");
    expect(KANA_CATALOG.find((unit) => unit.display === "づ")?.romaji).toBe("zu");
    expect(KANA_CATALOG.find((unit) => unit.display === "ウォ")?.romaji).toBe("wo");
  });

  it("uses a functional Korean prompt for the standalone sokuon", () => {
    expect(KANA_CATALOG.find((unit) => unit.display === "っ")?.readingKo).toBe("작은 つ");
    expect(KANA_CATALOG.find((unit) => unit.display === "ッ")?.readingKo).toBe("작은 つ");
  });

  it("matches the PRD's exact small-kana scope for each script", () => {
    expect(filterKana({ script: "hiragana", group: "small" }).map((unit) => unit.display).sort()).toEqual([
      "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゕ", "ゖ", "っ", "ゃ", "ゅ", "ょ", "ゎ",
    ].sort());
    expect(filterKana({ script: "katakana", group: "small" }).map((unit) => unit.display).sort()).toEqual([
      "ァ", "ィ", "ゥ", "ェ", "ォ", "ヵ", "ヶ", "ッ", "ャ", "ュ", "ョ", "ヮ", "ー",
    ].sort());
  });

  it("matches the PRD's exact foreign-loan combination scope", () => {
    expect(filterKana({ script: "katakana", group: "extended" }).map((unit) => unit.display).sort()).toEqual([
      "イェ", "ウィ", "ウェ", "ウォ", "ヴァ", "ヴィ", "ヴェ", "ヴォ", "ヴュ", "キェ", "ギェ", "クァ", "クィ", "クェ", "クォ", "グァ", "シェ", "ジェ", "スィ", "ズィ", "チェ", "ツァ", "ツィ", "ツェ", "ツォ", "ティ", "テュ", "ディ", "デュ", "トゥ", "ドゥ", "ニェ", "ヒェ", "ビェ", "ピェ", "ファ", "フィ", "フェ", "フォ", "フュ", "ミェ", "リェ",
    ].sort());
  });
});
