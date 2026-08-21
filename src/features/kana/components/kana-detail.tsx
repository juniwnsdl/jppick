import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { KanaCanvasGuide } from "../../practice/components/kana-canvas-guide";
import { WritingCanvas } from "../../practice/components/writing-canvas";
import type { Stroke } from "../../practice/strokes";
import { kanaReadingParts } from "../reading";
import type { KanaUnit } from "../types";
import { StrokeGuide } from "./stroke-guide";

const SCRIPT_LABEL = { hiragana: "히라가나", katakana: "가타카나" } as const;
const GROUP_LABEL = {
  basic: "기본",
  voiced: "탁음·반탁음",
  yoon: "요음",
  small: "작은 문자·기호",
  extended: "확장 가타카나",
} as const;

interface KanaDetailProps {
  unit: KanaUnit;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export function KanaDetail({ unit, onClose, onNext, onPrevious }: KanaDetailProps) {
  const titleId = `kana-detail-${unit.id}`;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const reading = kanaReadingParts(unit);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [],
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function moveToAdjacent(move: (() => void) | undefined) {
    setIsPracticing(false);
    setStrokes([]);
    move?.();
  }

  return (
    <div className="kana-detail-backdrop">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="kana-detail"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <button aria-label="상세 닫기" className="kana-detail-close" onClick={onClose} ref={closeButtonRef} type="button">
          ×
        </button>
        <h2 id={titleId}>{unit.display} 상세</h2>
        <div className="kana-detail-hero">
          <button
            aria-label="이전 문자"
            className="kana-detail-nav"
            disabled={!onPrevious}
            onClick={() => moveToAdjacent(onPrevious)}
            type="button"
          >
            {"<"}
          </button>
          <div className="kana-detail-hero-content">
            <p className="kana-detail-glyph" aria-hidden="true">{unit.display}</p>
            <p className="kana-detail-reading-main">
              {reading.ko}
              {reading.romaji ? <small>[{reading.romaji}]</small> : null}
            </p>
          </div>
          <button
            aria-label="다음 문자"
            className="kana-detail-nav"
            disabled={!onNext}
            onClick={() => moveToAdjacent(onNext)}
            type="button"
          >
            {">"}
          </button>
        </div>
        <dl className="kana-detail-reading">
          <div>
            <dt>문자 종류</dt>
            <dd>{SCRIPT_LABEL[unit.script]}</dd>
          </div>
          <div>
            <dt>분류</dt>
            <dd>{GROUP_LABEL[unit.group]}</dd>
          </div>
        </dl>
        <h3 className="stroke-guide-title">{isPracticing ? "직접 써보기" : "획순 안내"}</h3>
        {isPracticing ? (
          <div className="kana-detail-writing">
            <WritingCanvas
              backgroundGuide={(
                <KanaCanvasGuide
                  assetKeys={unit.strokeAssetKeys}
                  display={unit.display}
                  variant="trace"
                />
              )}
              guide
              onChange={setStrokes}
              strokes={strokes}
            />
          </div>
        ) : (
          <StrokeGuide animated assetKeys={unit.strokeAssetKeys} />
        )}
        <button
          className="primary-action"
          onClick={() => setIsPracticing((current) => !current)}
          type="button"
        >
          {isPracticing ? "획순 안내 보기" : "이 문자 연습"}
        </button>
      </section>
    </div>
  );
}
