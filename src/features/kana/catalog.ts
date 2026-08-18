import type { KanaGroup, KanaScript, KanaUnit } from "./types";

export type { KanaGroup, KanaScript, KanaUnit } from "./types";

export interface KanaFilter {
  script?: KanaScript;
  group?: KanaGroup;
}

const BASIC = [
  ["あいうえお", "アイウエオ", ["a", "i", "u", "e", "o"]],
  ["かきくけこ", "カキクケコ", ["ka", "ki", "ku", "ke", "ko"]],
  ["さしすせそ", "サシスセソ", ["sa", "shi", "su", "se", "so"]],
  ["たちつてと", "タチツテト", ["ta", "chi", "tsu", "te", "to"]],
  ["なにぬねの", "ナニヌネノ", ["na", "ni", "nu", "ne", "no"]],
  ["はひふへほ", "ハヒフヘホ", ["ha", "hi", "fu", "he", "ho"]],
  ["まみむめも", "マミムメモ", ["ma", "mi", "mu", "me", "mo"]],
  ["やゆよ", "ヤユヨ", ["ya", "yu", "yo"]],
  ["らりるれろ", "ラリルレロ", ["ra", "ri", "ru", "re", "ro"]],
  ["わをん", "ワヲン", ["wa", "wo", "n"]],
] as const;

const VOICED = [
  ["がぎぐげご", "ガギグゲゴ", ["ga", "gi", "gu", "ge", "go"]],
  ["ざじずぜぞ", "ザジズゼゾ", ["za", "ji", "zu", "ze", "zo"]],
  ["だぢづでど", "ダヂヅデド", ["da", "ji", "zu", "de", "do"]],
  ["ばびぶべぼ", "バビブベボ", ["ba", "bi", "bu", "be", "bo"]],
  ["ぱぴぷぺぽ", "パピプペポ", ["pa", "pi", "pu", "pe", "po"]],
  ["ゔ", "ヴ", ["vu"]],
] as const;

const YOON = [
  ["き", "キ", ["kya", "kyu", "kyo"]],
  ["ぎ", "ギ", ["gya", "gyu", "gyo"]],
  ["し", "シ", ["sha", "shu", "sho"]],
  ["じ", "ジ", ["ja", "ju", "jo"]],
  ["ち", "チ", ["cha", "chu", "cho"]],
  ["に", "ニ", ["nya", "nyu", "nyo"]],
  ["ひ", "ヒ", ["hya", "hyu", "hyo"]],
  ["び", "ビ", ["bya", "byu", "byo"]],
  ["ぴ", "ピ", ["pya", "pyu", "pyo"]],
  ["み", "ミ", ["mya", "myu", "myo"]],
  ["り", "リ", ["rya", "ryu", "ryo"]],
] as const;

const SMALL = [
  ["ぁ", "ァ", "xa"],
  ["ぃ", "ィ", "xi"],
  ["ぅ", "ゥ", "xu"],
  ["ぇ", "ェ", "xe"],
  ["ぉ", "ォ", "xo"],
  ["ゕ", "ヵ", "xka"],
  ["ゖ", "ヶ", "xke"],
  ["っ", "ッ", "xtsu"],
  ["ゃ", "ャ", "xya"],
  ["ゅ", "ュ", "xyu"],
  ["ょ", "ョ", "xyo"],
  ["ゎ", "ヮ", "xwa"],
] as const;

const EXTENDED = [
  ["イェ", "ye"],
  ["ウィ", "wi"],
  ["ウェ", "we"],
  ["ウォ", "wo"],
  ["ヴァ", "va"],
  ["ヴィ", "vi"],
  ["ヴェ", "ve"],
  ["ヴォ", "vo"],
  ["ヴュ", "vyu"],
  ["キェ", "kye"],
  ["ギェ", "gye"],
  ["クァ", "kwa"],
  ["クィ", "kwi"],
  ["クェ", "kwe"],
  ["クォ", "kwo"],
  ["グァ", "gwa"],
  ["シェ", "she"],
  ["ジェ", "je"],
  ["スィ", "si"],
  ["ズィ", "zi"],
  ["チェ", "che"],
  ["ツァ", "tsa"],
  ["ツィ", "tsi"],
  ["ツェ", "tse"],
  ["ツォ", "tso"],
  ["ティ", "ti"],
  ["テュ", "tyu"],
  ["ディ", "di"],
  ["デュ", "dyu"],
  ["トゥ", "tu"],
  ["ドゥ", "du"],
  ["ニェ", "nye"],
  ["ヒェ", "hye"],
  ["ビェ", "bye"],
  ["ピェ", "pye"],
  ["ファ", "fa"],
  ["フィ", "fi"],
  ["フェ", "fe"],
  ["フォ", "fo"],
  ["フュ", "fyu"],
  ["ミェ", "mye"],
  ["リェ", "rye"],
] as const;

export const ROMAJI_TO_KOREAN: Record<string, string> = {
  a: "아", i: "이", u: "우", e: "에", o: "오",
  ka: "카", ki: "키", ku: "쿠", ke: "케", ko: "코",
  sa: "사", shi: "시", su: "스", se: "세", so: "소",
  ta: "타", chi: "치", tsu: "츠", te: "테", to: "토",
  na: "나", ni: "니", nu: "누", ne: "네", no: "노",
  ha: "하", hi: "히", fu: "후", he: "헤", ho: "호",
  ma: "마", mi: "미", mu: "무", me: "메", mo: "모",
  ya: "야", yu: "유", yo: "요", ra: "라", ri: "리", ru: "루", re: "레", ro: "로", wa: "와", wo: "오", n: "응",
  ga: "가", gi: "기", gu: "구", ge: "게", go: "고", za: "자", ji: "지", zu: "즈", ze: "제", zo: "조",
  da: "다", de: "데", do: "도", ba: "바", bi: "비", bu: "부", be: "베", bo: "보", pa: "파", pi: "피", pu: "푸", pe: "페", po: "포", vu: "부",
  kya: "캬", kyu: "큐", kyo: "쿄", gya: "갸", gyu: "규", gyo: "교", sha: "샤", shu: "슈", sho: "쇼", ja: "자", ju: "주", jo: "조", cha: "차", chu: "추", cho: "초", nya: "냐", nyu: "뉴", nyo: "뇨", hya: "햐", hyu: "휴", hyo: "효", bya: "뱌", byu: "뷰", byo: "뵤", pya: "퍄", pyu: "퓨", pyo: "표", mya: "먀", myu: "뮤", myo: "묘", rya: "랴", ryu: "류", ryo: "료",
  xa: "작은 아", xi: "작은 이", xu: "작은 우", xe: "작은 에", xo: "작은 오", xka: "작은 카", xke: "작은 케", xtsu: "작은 つ", xya: "작은 야", xyu: "작은 유", xyo: "작은 요", xwa: "작은 와", "long-vowel-mark": "장음 기호",
  ye: "예", wi: "위", we: "웨", va: "바", vi: "비", ve: "베", vo: "보", vyu: "뷰", kye: "케", gye: "계", kwa: "콰", kwi: "퀴", kwe: "퀘", kwo: "쿼", gwa: "과", she: "셰", je: "제", si: "스이", zi: "즈이", che: "체", tsa: "차", tsi: "치", tse: "체", tso: "초", ti: "티", tyu: "튜", di: "디", dyu: "듀", tu: "투", du: "두", nye: "녜", hye: "헤", bye: "베", pye: "페", fa: "파", fi: "피", fe: "페", fo: "포", fyu: "퓨", mye: "미에", rye: "리에",
};

function makeUnit(script: KanaScript, group: KanaGroup, display: string, romaji: string): KanaUnit {
  const glyphs = Array.from(display);
  const readingKo = ROMAJI_TO_KOREAN[romaji];

  if (!readingKo) {
    throw new Error(`Missing Korean reading for ${romaji}`);
  }

  return {
    id: `${script}-${romaji}`,
    display,
    glyphs,
    script,
    group,
    romaji,
    readingKo,
    strokeAssetKeys: glyphs.map((glyph) => `${script}/${glyph}`),
  };
}

function unitsFromRows(
  rows: readonly (readonly [string, string, readonly string[]])[],
  script: KanaScript,
  group: KanaGroup,
): KanaUnit[] {
  return rows.flatMap(([hiragana, katakana, romaji]) => {
    const glyphs = Array.from(script === "hiragana" ? hiragana : katakana);
    return glyphs.map((display, index) => makeUnit(script, group, display, romaji[index]));
  });
}

function yoonUnits(script: KanaScript): KanaUnit[] {
  const suffixes = script === "hiragana" ? ["ゃ", "ゅ", "ょ"] : ["ャ", "ュ", "ョ"];

  return YOON.flatMap(([hiragana, katakana, romaji]) => {
    const initial = script === "hiragana" ? hiragana : katakana;
    return suffixes.map((suffix, index) => makeUnit(script, "yoon", `${initial}${suffix}`, romaji[index]));
  });
}

function smallUnits(script: KanaScript): KanaUnit[] {
  return SMALL.map(([hiragana, katakana, romaji]) => makeUnit(script, "small", script === "hiragana" ? hiragana : katakana, romaji));
}

const HIRAGANA_UNITS = [
  ...unitsFromRows(BASIC, "hiragana", "basic"),
  ...unitsFromRows(VOICED, "hiragana", "voiced"),
  ...yoonUnits("hiragana"),
  ...smallUnits("hiragana"),
];

const KATAKANA_UNITS = [
  ...unitsFromRows(BASIC, "katakana", "basic"),
  ...unitsFromRows(VOICED, "katakana", "voiced"),
  ...yoonUnits("katakana"),
  ...smallUnits("katakana"),
  makeUnit("katakana", "small", "ー", "long-vowel-mark"),
  ...EXTENDED.map(([display, romaji]) => makeUnit("katakana", "extended", display, romaji)),
];

function assignUniqueIds(units: KanaUnit[]): KanaUnit[] {
  const ids = new Set<string>();

  return units.map((unit) => {
    if (!ids.has(unit.id)) {
      ids.add(unit.id);
      return unit;
    }

    const glyphSuffix = unit.glyphs.map((glyph) => glyph.codePointAt(0)?.toString(16)).join("-");
    const id = `${unit.id}-${glyphSuffix}`;
    ids.add(id);
    return { ...unit, id };
  });
}

export const KANA_CATALOG: KanaUnit[] = assignUniqueIds([...HIRAGANA_UNITS, ...KATAKANA_UNITS]);

export function getKanaById(id: string): KanaUnit | undefined {
  return KANA_CATALOG.find((unit) => unit.id === id);
}

export function filterKana(filter: KanaFilter = {}): KanaUnit[] {
  return KANA_CATALOG.filter((unit) => (
    (filter.script === undefined || unit.script === filter.script)
    && (filter.group === undefined || unit.group === filter.group)
  ));
}
