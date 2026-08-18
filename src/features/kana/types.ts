export type KanaScript = "hiragana" | "katakana";

export type KanaGroup = "basic" | "voiced" | "yoon" | "small" | "extended";

export interface KanaUnit {
  id: string;
  display: string;
  glyphs: string[];
  script: KanaScript;
  group: KanaGroup;
  romaji: string;
  readingKo: string;
  strokeAssetKeys: string[];
}
