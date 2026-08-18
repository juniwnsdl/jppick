import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

class NoopResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = NoopResizeObserver;
