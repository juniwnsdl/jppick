"use client";

import { useEffect, useId, useState } from "react";

import { enhanceStrokeSvg, type StrokeOrderSvg } from "../stroke-order";
import { strokeAssetUrl } from "../stroke-asset-url";

interface StrokeGuideProps {
  assetKeys: readonly string[];
  /** Draw strokes in order on mount. Defaults to a static, numbered guide. */
  animated?: boolean;
  /** Offer a "획순 다시 보기" button. Defaults to `animated`. */
  replayable?: boolean;
}

function glyphOf(assetKey: string): string {
  const parts = assetKey.split("/");
  return parts[parts.length - 1] ?? assetKey;
}

const enhancedCache = new Map<string, Promise<string | null>>();

function loadStrokeSource(assetKey: string): Promise<string | null> {
  let pending = enhancedCache.get(assetKey);
  if (!pending) {
    pending = (async () => {
      try {
        if (typeof fetch !== "function" || typeof window === "undefined") {
          return null;
        }
        const response = await fetch(new URL(strokeAssetUrl(assetKey), window.location.href));
        if (!response.ok) {
          return null;
        }
        return await response.text();
      } catch {
        return null;
      }
    })();
    enhancedCache.set(assetKey, pending);
  }
  return pending;
}

interface StrokeGuideAssetProps {
  assetKey: string;
  animated: boolean;
  replayToken: number;
}

function StrokeGuideAsset({ assetKey, animated, replayToken }: StrokeGuideAssetProps) {
  const [failed, setFailed] = useState(false);
  const [enhanced, setEnhanced] = useState<StrokeOrderSvg | null>(null);
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const glyph = glyphOf(assetKey);
  const label = `${glyph} 획순`;

  useEffect(() => {
    let current = true;
    void loadStrokeSource(assetKey).then((source) => {
      if (!current || !source) {
        return;
      }
      const result = enhanceStrokeSvg(source, `s${scope}`, label);
      if (current && result) {
        setEnhanced(result);
      }
    });
    return () => {
      current = false;
    };
  }, [assetKey, label, scope]);

  if (failed) {
    return <p className="stroke-guide-fallback" role="status">{glyph} 획순 이미지를 불러오지 못했어요.</p>;
  }

  if (enhanced) {
    return (
      <div
        className={`stroke-guide-image stroke-order${animated ? " stroke-order--animated" : ""}`}
        dangerouslySetInnerHTML={{ __html: enhanced.markup }}
        data-stroke-count={enhanced.strokeCount}
        key={`${assetKey}-${replayToken}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local SVG assets need a reliable runtime error event.
    <img
      alt={label}
      aria-label={label}
      className="stroke-guide-image"
      onError={() => setFailed(true)}
      role="img"
      src={strokeAssetUrl(assetKey)}
    />
  );
}

export function StrokeGuide({ assetKeys, animated = false, replayable = animated }: StrokeGuideProps) {
  const [replayToken, setReplayToken] = useState(0);

  return (
    <div className="stroke-guide-block">
      <div className="stroke-guide" aria-label="획순 안내">
        {assetKeys.map((assetKey) => (
          <StrokeGuideAsset animated={animated} assetKey={assetKey} key={assetKey} replayToken={replayToken} />
        ))}
      </div>
      {replayable ? (
        <button
          className="btn-ghost stroke-guide-replay"
          onClick={() => setReplayToken((token) => token + 1)}
          type="button"
        >
          <span aria-hidden="true">↻</span> 획순 다시 보기
        </button>
      ) : null}
    </div>
  );
}
