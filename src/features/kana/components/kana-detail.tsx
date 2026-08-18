import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";

import type { KanaUnit } from "../types";
import { StrokeGuide } from "./stroke-guide";

interface KanaDetailProps {
  unit: KanaUnit;
  onClose: () => void;
}

export function KanaDetail({ unit, onClose }: KanaDetailProps) {
  const titleId = `kana-detail-${unit.id}`;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

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
        <p className="kana-detail-glyph" aria-hidden="true">{unit.display}</p>
        <dl className="kana-detail-reading">
          <div>
            <dt>로마자</dt>
            <dd>{unit.romaji}</dd>
          </div>
          <div>
            <dt>한국어 읽기</dt>
            <dd>{unit.readingKo}</dd>
          </div>
        </dl>
        <h3 className="stroke-guide-title">획순 안내</h3>
        <StrokeGuide assetKeys={unit.strokeAssetKeys} />
        <Link className="primary-action" href={`/practice?kana=${encodeURIComponent(unit.id)}`}>
          이 문자 연습
        </Link>
      </section>
    </div>
  );
}
