/**
 * Turns a strokesvg asset (https://github.com/zhengkyl/strokesvg) into an
 * enhanced inline SVG: numbered stroke badges plus `pathLength="1"` on every
 * stroke path so CSS can animate the drawing order via `--i`.
 */

export interface StrokeOrderSvg {
  markup: string;
  strokeCount: number;
}

interface StrokeStart {
  index: number;
  x: number;
  y: number;
}

const BADGE_RADIUS = 60;
const BADGE_FONT_SIZE = 72;

/** Push badges apart when two strokes start close together, so both numbers stay legible. */
function spreadBadges(starts: StrokeStart[]): StrokeStart[] {
  const minDistance = BADGE_RADIUS * 2.2;
  const placed: StrokeStart[] = [];
  for (const start of starts) {
    let { x, y } = start;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const collision = placed.find((other) => Math.hypot(other.x - x, other.y - y) < minDistance);
      if (!collision) {
        break;
      }
      const dx = x - collision.x;
      const dy = y - collision.y;
      const length = Math.hypot(dx, dy);
      const ux = length === 0 ? 1 : dx / length;
      const uy = length === 0 ? 0 : dy / length;
      x = collision.x + ux * minDistance;
      y = collision.y + uy * minDistance;
    }
    placed.push({ index: start.index, x: Math.round(x), y: Math.round(y) });
  }
  return placed;
}

function firstPoint(d: string): { x: number; y: number } | null {
  const match = /^\s*[Mm]\s*(-?\d*\.?\d+)[\s,]+(-?\d*\.?\d+)/.exec(d);
  if (!match) {
    return null;
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

function scopeIds(markup: string, scope: string): string {
  return markup
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${scope}-${id}"`)
    .replace(/\bhref="#([^"]+)"/g, (_, id: string) => `href="#${scope}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${scope}-${id})`);
}

export function enhanceStrokeSvg(source: string, scope: string, label: string): StrokeOrderSvg | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.nodeName !== "svg" || document.querySelector("parsererror")) {
    return null;
  }

  const strokesGroup = root.querySelector('[data-strokesvg="strokes"]');
  if (!strokesGroup) {
    return null;
  }

  const starts: StrokeStart[] = [];
  Array.from(strokesGroup.children).forEach((stroke, index) => {
    const paths = stroke.nodeName === "path" ? [stroke] : Array.from(stroke.querySelectorAll("path"));
    for (const path of paths) {
      path.setAttribute("pathLength", "1");
    }
    const first = paths[0]?.getAttribute("d");
    const point = first ? firstPoint(first) : null;
    if (point) {
      starts.push({ index, x: point.x, y: point.y });
    }
  });

  root.removeAttribute("width");
  root.removeAttribute("height");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", label);
  root.setAttribute("focusable", "false");

  const badges = spreadBadges(starts).map(({ index, x, y }) => (
    `<g class="stroke-order-number" style="--i:${index}">`
    + `<circle cx="${x}" cy="${y}" r="${BADGE_RADIUS}"/>`
    + `<text x="${x}" y="${y}" font-size="${BADGE_FONT_SIZE}" text-anchor="middle" dominant-baseline="central">${index + 1}</text>`
    + "</g>"
  )).join("");

  const serialized = new XMLSerializer().serializeToString(root);
  const withBadges = serialized.replace(/<\/svg>\s*$/, `<g class="stroke-order-numbers" aria-hidden="true">${badges}</g></svg>`);

  return {
    markup: scopeIds(withBadges, scope),
    strokeCount: strokesGroup.children.length,
  };
}
