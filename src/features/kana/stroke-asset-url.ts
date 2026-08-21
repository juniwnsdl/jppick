export function strokeAssetUrl(assetKey: string): string {
  return `/strokes/${assetKey.split("/").map(encodeURIComponent).join("/")}.svg`;
}
