import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";

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
}

export function KanaDetail({ unit, onClose }: KanaDetailProps) {
  const titleId = `kana-detail-${unit.id}`;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
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
          <p className="kana-detail-glyph" aria-hidden="true">{unit.display}</p>
          <p className="kana-detail-reading-main">
            {reading.ko}
            {reading.romaji ? <small>[{reading.romaji}]</small> : null}
          </p>
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
        <h3 className="stroke-guide-title">획순 안내</h3>
        <StrokeGuide animated assetKeys={unit.strokeAssetKeys} />
        <Link className="primary-action" href={`/practice?kana=${encodeURIComponent(unit.id)}`}>
          이 문자 연습
        </Link>
      </section>
    </div>
  );
}
