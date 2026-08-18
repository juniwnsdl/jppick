import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { vi } from "vitest";

import type { Stroke } from "../strokes";
import { WritingCanvas } from "./writing-canvas";

interface PointerValues {
  pointerId: number;
  clientX: number;
  clientY: number;
  pressure: number;
  isPrimary?: boolean;
}

interface ResizeObserverEntryValues {
  width: number;
  height: number;
}

const context = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  lineCap: "butt" as CanvasLineCap,
  lineJoin: "miter" as CanvasLineJoin,
  lineWidth: 1,
  strokeStyle: "#000000" as string | CanvasGradient | CanvasPattern,
};

let resizeCallback: ResizeObserverCallback;

class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  disconnect() {}
  observe(target: Element) {
    notifyResize(target, { width: 200, height: 100 });
  }
  unobserve() {}
}

function notifyResize(target: Element, size: ResizeObserverEntryValues) {
  resizeCallback([
    {
      target,
      contentRect: {
        ...size,
        x: 0,
        y: 0,
        top: 0,
        right: size.width,
        bottom: size.height,
        left: 0,
        toJSON: () => ({}),
      },
    } as ResizeObserverEntry,
  ], {} as ResizeObserver);
}

function firePointer(target: Element, type: string, values: PointerValues) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: values.clientX,
    clientY: values.clientY,
  });

  Object.defineProperties(event, {
    pointerId: { value: values.pointerId },
    pressure: { value: values.pressure },
    isPrimary: { value: values.isPrimary ?? true },
  });
  fireEvent(target, event);
}

function CanvasHarness({
  initialStrokes = [],
  guide,
}: {
  initialStrokes?: Stroke[];
  guide?: ReactNode;
}) {
  const [strokes, setStrokes] = useState(initialStrokes);

  return (
    <>
      <WritingCanvas guide={guide} strokes={strokes} onChange={setStrokes} />
      <output aria-label="stroke state">{JSON.stringify(strokes)}</output>
    </>
  );
}

function strokeState(): Stroke[] {
  return JSON.parse(screen.getByLabelText("stroke state").textContent ?? "[]") as Stroke[];
}

function prepareCanvas() {
  const canvas = screen.getByRole("img", { name: "쓰기 영역" }) as HTMLCanvasElement;
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();

  Object.defineProperties(canvas, {
    getBoundingClientRect: {
      value: () => ({
        width: 200,
        height: 100,
        left: 10,
        top: 20,
        right: 210,
        bottom: 120,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    },
    setPointerCapture: { value: setPointerCapture },
    releasePointerCapture: { value: releasePointerCapture },
  });

  return { canvas, setPointerCapture, releasePointerCapture };
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D);
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("completes one normalized stroke from a primary pointer gesture", () => {
  render(<CanvasHarness />);
  const { canvas } = prepareCanvas();

  firePointer(canvas, "pointerdown", { pointerId: 7, clientX: 10, clientY: 20, pressure: 0.2 });
  firePointer(canvas, "pointermove", { pointerId: 7, clientX: 110, clientY: 70, pressure: 0.5 });
  firePointer(canvas, "pointermove", { pointerId: 7, clientX: 210, clientY: 120, pressure: 0.8 });
  firePointer(canvas, "pointerup", { pointerId: 7, clientX: 210, clientY: 120, pressure: 0 });

  expect(strokeState()).toEqual([[
    { x: 0, y: 0, pressure: 0.2 },
    { x: 0.5, y: 0.5, pressure: 0.5 },
    { x: 1, y: 1, pressure: 0.8 },
  ]]);
});

it("keeps the controlled strokes when the parent rejects emitted gestures", () => {
  const onChange = vi.fn();
  render(<WritingCanvas strokes={[]} onChange={onChange} />);
  const { canvas } = prepareCanvas();

  firePointer(canvas, "pointerdown", { pointerId: 7, clientX: 10, clientY: 20, pressure: 0.2 });
  context.stroke.mockClear();
  firePointer(canvas, "pointerup", { pointerId: 7, clientX: 110, clientY: 70, pressure: 0 });

  expect(context.stroke).not.toHaveBeenCalled();

  firePointer(canvas, "pointerdown", { pointerId: 8, clientX: 210, clientY: 120, pressure: 0.4 });
  firePointer(canvas, "pointerup", { pointerId: 8, clientX: 210, clientY: 120, pressure: 0 });

  expect(onChange).toHaveBeenNthCalledWith(2, [[{ x: 1, y: 1, pressure: 0.4 }]]);
});

it("captures the active pointer until its stroke ends", () => {
  render(<CanvasHarness />);
  const { canvas, setPointerCapture, releasePointerCapture } = prepareCanvas();

  firePointer(canvas, "pointerdown", { pointerId: 42, clientX: 10, clientY: 20, pressure: 0.3 });
  firePointer(canvas, "pointerup", { pointerId: 42, clientX: 20, clientY: 30, pressure: 0 });

  expect(setPointerCapture).toHaveBeenCalledWith(42);
  expect(releasePointerCapture).toHaveBeenCalledWith(42);
});

it("ignores a secondary pointer gesture", () => {
  render(<CanvasHarness />);
  const { canvas, setPointerCapture } = prepareCanvas();

  firePointer(canvas, "pointerdown", {
    pointerId: 2,
    clientX: 30,
    clientY: 40,
    pressure: 0.5,
    isPrimary: false,
  });
  firePointer(canvas, "pointermove", {
    pointerId: 2,
    clientX: 50,
    clientY: 60,
    pressure: 0.5,
    isPrimary: false,
  });
  firePointer(canvas, "pointerup", {
    pointerId: 2,
    clientX: 50,
    clientY: 60,
    pressure: 0,
    isPrimary: false,
  });

  expect(strokeState()).toEqual([]);
  expect(setPointerCapture).not.toHaveBeenCalled();
});

it("undoes the final stroke and clears all strokes through its controls", () => {
  const initialStrokes: Stroke[] = [
    [{ x: 0.1, y: 0.2, pressure: 0.3 }],
    [{ x: 0.6, y: 0.7, pressure: 0.8 }],
  ];
  render(<CanvasHarness initialStrokes={initialStrokes} />);

  fireEvent.click(screen.getByRole("button", { name: "마지막 획 실행 취소" }));
  expect(strokeState()).toEqual([[{ x: 0.1, y: 0.2, pressure: 0.3 }]]);

  fireEvent.click(screen.getByRole("button", { name: "모두 지우기" }));
  expect(strokeState()).toEqual([]);
});

it("disables browser touch gestures and renders guide content on the SVG layer", () => {
  render(<CanvasHarness guide={<path data-testid="trace-guide" d="M 0 0 L 1 1" />} />);
  const canvas = screen.getByRole("img", { name: "쓰기 영역" }) as HTMLCanvasElement;

  expect(canvas).toHaveAttribute("style", expect.stringContaining("touch-action: none"));
  expect(screen.getByTestId("writing-guide-layer")).toContainElement(screen.getByTestId("trace-guide"));
});

it("rescales backing pixels and redraws normalized ink after size or DPR changes", () => {
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  render(<CanvasHarness initialStrokes={[[
    { x: 0, y: 0, pressure: 0.5 },
    { x: 1, y: 1, pressure: 0.5 },
  ]]} />);
  const canvas = screen.getByRole("img", { name: "쓰기 영역" }) as HTMLCanvasElement;

  expect(canvas.width).toBe(400);
  expect(canvas.height).toBe(200);

  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
  notifyResize(canvas.parentElement as Element, { width: 100, height: 50 });

  expect(canvas.width).toBe(300);
  expect(canvas.height).toBe(150);
  expect(context.lineTo).toHaveBeenLastCalledWith(100, 50);
});

it("uses the observed content size when a window resize sees wrapper borders", () => {
  render(<CanvasHarness />);
  const canvas = screen.getByRole("img", { name: "쓰기 영역" }) as HTMLCanvasElement;
  const wrapper = canvas.parentElement as HTMLDivElement;

  Object.defineProperties(wrapper, {
    clientWidth: { configurable: true, value: 200 },
    clientHeight: { configurable: true, value: 100 },
    getBoundingClientRect: {
      configurable: true,
      value: () => ({
        width: 202,
        height: 102,
        left: 0,
        top: 0,
        right: 202,
        bottom: 102,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    },
  });

  fireEvent(window, new Event("resize"));

  expect(canvas.width).toBe(200);
  expect(canvas.height).toBe(100);
});
