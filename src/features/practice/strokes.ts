export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export type Stroke = Point[];

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeCoordinate(value: number, size: number): number {
  return size > 0 ? clamp(value / size) : 0;
}

export function normalizePoint(point: Point, width: number, height: number): Point {
  return {
    x: normalizeCoordinate(point.x, width),
    y: normalizeCoordinate(point.y, height),
    pressure: clamp(point.pressure),
  };
}

export function denormalizePoint(point: Point, width: number, height: number): Point {
  return {
    x: clamp(point.x) * Math.max(0, width),
    y: clamp(point.y) * Math.max(0, height),
    pressure: clamp(point.pressure),
  };
}

export function undoStroke(strokes: readonly Stroke[]): Stroke[] {
  return strokes.slice(0, -1);
}

export function clearStrokes(_strokes: readonly Stroke[] = []): Stroke[] {
  return [];
}
