import {
  clearStrokes,
  denormalizePoint,
  normalizePoint,
  undoStroke,
  type Stroke,
} from "./strokes";

describe("normalized stroke coordinates", () => {
  it("maps the top-left and bottom-right drawing bounds to zero and one", () => {
    expect(normalizePoint({ x: 0, y: 0, pressure: 0.25 }, 200, 100)).toEqual({
      x: 0,
      y: 0,
      pressure: 0.25,
    });
    expect(normalizePoint({ x: 200, y: 100, pressure: 0.75 }, 200, 100)).toEqual({
      x: 1,
      y: 1,
      pressure: 0.75,
    });
  });

  it("clamps coordinates and pressure outside their serializable range", () => {
    expect(normalizePoint({ x: -20, y: 120, pressure: 2 }, 200, 100)).toEqual({
      x: 0,
      y: 1,
      pressure: 1,
    });
  });

  it("preserves a point position proportionally when the drawing surface resizes", () => {
    const normalized = normalizePoint({ x: 50, y: 75, pressure: 0.4 }, 100, 150);

    expect(denormalizePoint(normalized, 320, 480)).toEqual({
      x: 160,
      y: 240,
      pressure: 0.4,
    });
  });
});

describe("stroke collection updates", () => {
  const strokes: Stroke[] = [
    [{ x: 0.1, y: 0.2, pressure: 0.3 }],
    [{ x: 0.4, y: 0.5, pressure: 0.6 }],
  ];

  it("undoes only the final stroke without mutating the source collection", () => {
    const undone = undoStroke(strokes);

    expect(undone).toEqual([[{ x: 0.1, y: 0.2, pressure: 0.3 }]]);
    expect(undone).not.toBe(strokes);
    expect(strokes).toHaveLength(2);
  });

  it("clears all strokes without mutating the source collection", () => {
    const cleared = clearStrokes(strokes);

    expect(cleared).toEqual([]);
    expect(cleared).not.toBe(strokes);
    expect(strokes).toHaveLength(2);
  });
});
