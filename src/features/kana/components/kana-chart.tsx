"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { filterKana, type KanaGroup, type KanaScript, type KanaUnit } from "../catalog";
import { kanaReadingParts } from "../reading";
import { KanaDetail } from "./kana-detail";

const SCRIPT_OPTIONS: ReadonlyArray<{ value: KanaScript; label: string }> = [
  { value: "hiragana", label: "히라가나" },
  { value: "katakana", label: "가타카나" },
];

const GROUP_OPTIONS: ReadonlyArray<{ value: KanaGroup; label: string }> = [
  { value: "basic", label: "기본" },
  { value: "voiced", label: "탁음·반탁음" },
  { value: "yoon", label: "요음" },
  { value: "small", label: "작은 글자" },
  { value: "extended", label: "확장음" },
];

function selectedIndicator(selected: boolean) {
  return selected ? <span aria-hidden="true" data-selected-indicator>✓</span> : null;
}

export function KanaChart() {
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [group, setGroup] = useState<KanaGroup>("basic");
  const [selected, setSelected] = useState<KanaUnit | null>(null);
  const selectedCellRef = useRef<HTMLButtonElement>(null);
  const units = filterKana({ script, group });
  const orderedPracticeHref = `/practice/run?mode=copy&scripts=${script}&groups=${group}&count=all&strategy=ordered`;

  function chooseScript(nextScript: KanaScript) {
    setScript(nextScript);
    setSelected(null);
    if (nextScript === "hiragana" && group === "extended") {
      setGroup("basic");
    }
  }

  return (
    <section className="kana-chart" aria-label="가나 글자표">
      <div className="kana-toolbar">
        <div className="kana-tabs segmented" aria-label="문자 종류">
          {SCRIPT_OPTIONS.map((option) => (
            <button
              aria-pressed={script === option.value}
              key={option.value}
              onClick={() => chooseScript(option.value)}
              type="button"
            >
              {option.label} {selectedIndicator(script === option.value)}
            </button>
          ))}
        </div>

        <div className="kana-filters pill-group" aria-label="글자 모음">
          {GROUP_OPTIONS.filter((option) => script === "katakana" || option.value !== "extended").map((option) => (
            <button
              aria-pressed={group === option.value}
              key={option.value}
              onClick={() => {
                setGroup(option.value);
                setSelected(null);
              }}
              type="button"
            >
              {option.label} {selectedIndicator(group === option.value)}
            </button>
          ))}
        </div>

        <p className="kana-count">{units.length}자</p>
      </div>

      <aside className="kana-ordered-practice" aria-label="현재 글자표 순서 연습">
        <div>
          <strong>표 순서대로 써 보기</strong>
          <p>지금 보이는 글자를 처음부터 끝까지 한 번씩 연습해요.</p>
        </div>
        <Link className="primary-action" href={orderedPracticeHref}>
          현재 {units.length}자 순서대로 연습
        </Link>
      </aside>

      <ul className="kana-grid" aria-label={`${script === "hiragana" ? "히라가나" : "가타카나"} ${GROUP_OPTIONS.find((option) => option.value === group)?.label}`}>
        {units.map((unit, index) => {
          const reading = kanaReadingParts(unit);
          const startsRow = index === 0 || unit.chartRow !== units[index - 1].chartRow;
          return (
            <li className={startsRow ? "kana-grid-row-start" : undefined} key={unit.id}>
              <button
                aria-label={`${unit.display}, ${unit.romaji}, ${unit.readingKo}`}
                className="kana-cell"
                onClick={(event) => {
                  selectedCellRef.current = event.currentTarget;
                  setSelected(unit);
                }}
                type="button"
              >
                <span className="kana-cell-glyph" aria-hidden="true">{unit.display}</span>
                <span className="kana-cell-reading" aria-hidden="true">
                  {reading.ko}
                  {reading.romaji ? <> <span className="romaji">[{reading.romaji}]</span></> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <KanaDetail
          unit={selected}
          onClose={() => {
            setSelected(null);
            selectedCellRef.current?.focus();
          }}
        />
      ) : null}
    </section>
  );
}
