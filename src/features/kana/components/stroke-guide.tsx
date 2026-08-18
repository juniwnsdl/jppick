interface StrokeGuideProps {
  assetKeys: readonly string[];
}

function assetUrl(assetKey: string): string {
  return `/strokes/${assetKey.split("/").map(encodeURIComponent).join("/")}.svg`;
}

export function StrokeGuide({ assetKeys }: StrokeGuideProps) {
  return (
    <div className="stroke-guide" aria-label="획순 안내">
      {assetKeys.map((assetKey) => {
        const assetKeyParts = assetKey.split("/");
        const glyph = assetKeyParts[assetKeyParts.length - 1] ?? assetKey;

        return (
          <object
            aria-label={`${glyph} 획순`}
            className="stroke-guide-image"
            data={assetUrl(assetKey)}
            key={assetKey}
            role="img"
            type="image/svg+xml"
          />
        );
      })}
    </div>
  );
}
