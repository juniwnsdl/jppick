"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import {
  clearStrokes,
  denormalizePoint,
  normalizePoint,
  undoStroke,
  type Point,
  type Stroke,
} from "../strokes";

interface WritingCanvasProps {
  strokes: readonly Stroke[];
  onChange: (strokes: Stroke[]) => void;
  guide?: ReactNode;
  backgroundGuide?: ReactNode;
  foregroundGuide?: ReactNode;
}

interface DrawingSize {
  width: number;
  height: number;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: readonly Point[],
  size: DrawingSize,
) {
  const [firstPoint, ...remainingPoints] = stroke;

  if (!firstPoint) {
    return;
  }

  const first = denormalizePoint(firstPoint, size.width, size.height);
  context.beginPath();
  context.moveTo(first.x, first.y);

  if (remainingPoints.length === 0) {
    context.lineTo(first.x, first.y);
  } else {
    for (const point of remainingPoints) {
      const denormalized = denormalizePoint(point, size.width, size.height);
      context.lineTo(denormalized.x, denormalized.y);
    }
  }

  context.stroke();
}

function samePosition(left: Point | undefined, right: Point): boolean {
  return left?.x === right.x && left.y === right.y;
}

function defaultGuide() {
  return (
    <>
      <line x1="0.5" y1="0" x2="0.5" y2="1" />
      <line x1="0" y1="0.5" x2="1" y2="0.5" />
    </>
  );
}

export function WritingCanvas({
  strokes,
  onChange,
  guide,
  backgroundGuide,
  foregroundGuide,
}: WritingCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const activePointerRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<Stroke>([]);
  const sizeRef = useRef<DrawingSize>({ width: 0, height: 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const size = sizeRef.current;

    if (!canvas || size.width <= 0 || size.height <= 0) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.max(3, Math.min(size.width, size.height) * 0.025);
    context.strokeStyle = "#191f28";

    for (const stroke of strokesRef.current) {
      drawStroke(context, stroke, size);
    }
    drawStroke(context, activeStrokeRef.current, size);
  }, []);

  const resizeCanvas = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;

    if (!canvas || width <= 0 || height <= 0) {
      return;
    }

    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    sizeRef.current = { width, height };
    canvas.width = Math.max(1, Math.round(width * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(height * devicePixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.setAttribute("style", `${canvas.getAttribute("style") ?? ""} touch-action: none;`);
    redraw();
  }, [redraw]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;

    if (!wrapper || !canvas) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        resizeCanvas(entry.contentRect.width, entry.contentRect.height);
      }
    });
    const handleWindowResize = () => {
      resizeCanvas(wrapper.clientWidth, wrapper.clientHeight);
    };

    observer.observe(wrapper);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [redraw, strokes]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = bounds.width || sizeRef.current.width;
    const height = bounds.height || sizeRef.current.height;

    return normalizePoint({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      pressure: event.pressure,
    }, width, height);
  }

  function releasePointer(canvas: HTMLCanvasElement, pointerId: number) {
    if (typeof canvas.releasePointerCapture === "function") {
      canvas.releasePointerCapture(pointerId);
    }
  }

  function cancelActiveStroke(canvas: HTMLCanvasElement, pointerId: number) {
    activePointerRef.current = null;
    activeStrokeRef.current = [];
    releasePointer(canvas, pointerId);
    redraw();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.isPrimary === false || activePointerRef.current !== null) {
      return;
    }

    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = [pointFromEvent(event)];

    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    redraw();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) {
      return;
    }

    const point = pointFromEvent(event);
    const lastPoint = activeStrokeRef.current[activeStrokeRef.current.length - 1];

    if (!samePosition(lastPoint, point)) {
      activeStrokeRef.current = [...activeStrokeRef.current, point];
      redraw();
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) {
      return;
    }

    const point = pointFromEvent(event);
    const lastPoint = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    const completedStroke = samePosition(lastPoint, point)
      ? activeStrokeRef.current
      : [...activeStrokeRef.current, point];
    const nextStrokes = [...strokesRef.current, completedStroke];

    activePointerRef.current = null;
    activeStrokeRef.current = [];
    releasePointer(event.currentTarget, event.pointerId);
    onChange(nextStrokes);
    redraw();
  }

  function handleUndo() {
    const nextStrokes = undoStroke(strokesRef.current);
    onChange(nextStrokes);
    redraw();
  }

  function handleClear() {
    const nextStrokes = clearStrokes(strokesRef.current);
    onChange(nextStrokes);
    redraw();
  }

  return (
    <div className="writing-canvas">
      <div className="writing-canvas-frame" ref={wrapperRef}>
        <svg
          aria-hidden="true"
          data-testid="writing-guide-layer"
          preserveAspectRatio="none"
          style={{ inset: 0, pointerEvents: "none", position: "absolute" }}
          viewBox="0 0 1 1"
          width="100%"
          height="100%"
        >
          <g
            fill="none"
            stroke="#d1d6db"
            strokeDasharray="0.025 0.025"
            strokeWidth="0.006"
            vectorEffect="non-scaling-stroke"
          >
            {guide === true ? defaultGuide() : guide}
          </g>
        </svg>
        {backgroundGuide}
        <canvas
          aria-label="쓰기 영역"
          onLostPointerCapture={(event) => {
            if (activePointerRef.current === event.pointerId) {
              activePointerRef.current = null;
              activeStrokeRef.current = [];
              redraw();
            }
          }}
          onPointerCancel={(event) => {
            if (activePointerRef.current === event.pointerId) {
              cancelActiveStroke(event.currentTarget, event.pointerId);
            }
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
          role="img"
          style={{ inset: 0, position: "absolute", touchAction: "none" }}
        />
        {foregroundGuide}
      </div>
      <div aria-label="쓰기 도구" className="writing-tools">
        <button
          aria-label="마지막 획 실행 취소"
          disabled={strokes.length === 0}
          onClick={handleUndo}
          type="button"
        >
          실행 취소
        </button>
        <button disabled={strokes.length === 0} onClick={handleClear} type="button">
          모두 지우기
        </button>
      </div>
    </div>
  );
}
