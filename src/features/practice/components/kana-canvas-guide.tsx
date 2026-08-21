import type { CSSProperties } from "react";

import { strokeAssetUrl } from "../../kana/stroke-asset-url";

interface KanaCanvasGuideProps {
  assetKeys: readonly string[];
  display: string;
  opacity?: number;
  variant: "trace" | "answer";
}

export function KanaCanvasGuide({
  assetKeys,
  display,
  opacity,
  variant,
}: KanaCanvasGuideProps) {
  return (
    <div
      aria-hidden={variant === "trace" ? "true" : undefined}
      aria-label={variant === "answer" ? "정답 모델" : undefined}
      className={`kana-canvas-guide kana-canvas-guide--${variant}`}
      data-testid={variant === "trace" ? "trace-kana-guide" : undefined}
      role={variant === "answer" ? "img" : undefined}
      style={opacity === undefined ? undefined : { opacity }}
    >
      {assetKeys.map((assetKey) => (
        <span
          aria-hidden="true"
          className="kana-canvas-guide-glyph"
          data-testid="kana-guide-glyph"
          key={assetKey}
          style={{
            "--kana-guide-mask": `url("${strokeAssetUrl(assetKey)}")`,
          } as CSSProperties}
        />
      ))}
      {variant === "answer" ? <span className="kana-canvas-guide-label">{display}</span> : null}
    </div>
  );
}
