"use client";

import { useState } from "react";

interface StrokeGuideProps {
  assetKeys: readonly string[];
}

function StrokeGuideAsset({ assetKey }: { assetKey: string }) {
  const [failed, setFailed] = useState(false);
  const assetKeyParts = assetKey.split("/");
  const glyph = assetKeyParts[assetKeyParts.length - 1] ?? assetKey;

  if (failed) {
    return <p className="stroke-guide-fallback" role="status">{glyph} 획순 이미지를 불러오지 못했어요.</p>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG assets need a reliable runtime error event.
    <img
      alt={`${glyph} 획순`}
      aria-label={`${glyph} 획순`}
      className="stroke-guide-image"
      onError={() => setFailed(true)}
      role="img"
      src={assetUrl(assetKey)}
    />
  );
}

function assetUrl(assetKey: string): string {
  return `/strokes/${assetKey.split("/").map(encodeURIComponent).join("/")}.svg`;
}

export function StrokeGuide({ assetKeys }: StrokeGuideProps) {
  return (
    <div className="stroke-guide" aria-label="획순 안내">
      {assetKeys.map((assetKey) => {
        return <StrokeGuideAsset assetKey={assetKey} key={assetKey} />;
      })}
    </div>
  );
}
