import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { vi } from "vitest";

import type { KanaUnit } from "../../kana/types";
import type { AppSettings } from "../../../lib/settings";
import { PRACTICE_RESULT_STORAGE_KEY } from "../session-reducer";
import type { PracticeConfig, Question } from "../types";
import { PracticeResult } from "./practice-result";
import { PracticeSession } from "./practice-session";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const kana: KanaUnit = {
  id: "hiragana-a",
  display: "あ",
  glyphs: ["あ"],
  script: "hiragana",
  group: "basic",
  romaji: "a",
  readingKo: "아",
  strokeAssetKeys: ["hiragana/basic/あ"],
};

const question: Question = {
  id: "question-1-hiragana-a",
  kanaId: kana.id,
};

const settings: AppSettings = {
  version: 1,
  guideLines: true,
  traceGuide: true,
  overlayOpacity: 0.55,
};

function config(mode: PracticeConfig["mode"]): PracticeConfig {
  return {
    mode,
    scripts: ["hiragana"],
    groups: ["basic"],
    count: 5,
    strategy: "uniform",
  };
}

class TestResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  disconnect() {}
  observe(target: Element) {
    this.callback([{
      target,
      contentRect: {
        width: 240,
        height: 240,
        x: 0,
        y: 0,
        top: 0,
        right: 240,
        bottom: 240,
        left: 0,
        toJSON: () => ({}),
      },
    } as ResizeObserverEntry], this);
  }
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

it("shows the kana and enabled trace guide before reveal in copy mode", () => {
  render(
    <PracticeSession
      catalog={[kana]}
      config={config("copy")}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  expect(screen.getByLabelText("따라 쓸 문자")).toHaveTextContent("あ");
  expect(screen.getByTestId("trace-kana-guide")).toBeInTheDocument();
  expect(screen.queryByLabelText("정답 모델")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "잘 썼어요" })).not.toBeInTheDocument();
});

it("does not generate a random question queue during server rendering", () => {
  const random = vi.fn(() => 0);
  const secondKana: KanaUnit = {
    ...kana,
    id: "hiragana-i",
    display: "い",
    glyphs: ["い"],
    romaji: "i",
    readingKo: "이",
    strokeAssetKeys: ["hiragana/basic/い"],
  };

  renderToString(
    <PracticeSession
      catalog={[kana, secondKana]}
      config={config("copy")}
      initialSettings={settings}
      random={random}
    />,
  );

  expect(random).not.toHaveBeenCalled();
});

it("hides the kana while showing Korean reading and romaji before reveal in recall mode", () => {
  render(
    <PracticeSession
      catalog={[kana]}
      config={config("recall")}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  expect(screen.getByText("아")).toBeVisible();
  expect(screen.getByText("a")).toBeVisible();
  expect(screen.queryByText("あ")).not.toBeInTheDocument();
  expect(screen.queryByTestId("trace-kana-guide")).not.toBeInTheDocument();
});

it("confirms an empty attempt and reveals comparison and self-evaluation controls", async () => {
  const user = userEvent.setup();
  render(
    <PracticeSession
      catalog={[kana]}
      config={config("recall")}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  await user.click(screen.getByRole("button", { name: "정답 확인" }));

  expect(window.confirm).toHaveBeenCalledWith("아직 쓴 획이 없어요. 그래도 정답을 확인할까요?");
  expect(screen.getByLabelText("정답 모델")).toHaveTextContent("あ");
  expect(screen.getByRole("slider", { name: "정답 투명도" })).toHaveValue("0.55");
  expect(screen.getByRole("button", { name: "잘 썼어요" })).toBeVisible();
  expect(screen.getByRole("button", { name: "다시 연습" })).toBeVisible();

  fireEvent.change(screen.getByRole("slider", { name: "정답 투명도" }), {
    target: { value: "0.8" },
  });
  expect(screen.getByRole("slider", { name: "정답 투명도" })).toHaveValue("0.8");
});

it("warns and can cancel an internal link while the session is active", () => {
  vi.mocked(window.confirm).mockReturnValue(false);
  render(
    <>
      <a href="/chart">문자표</a>
      <PracticeSession
        catalog={[kana]}
        config={config("copy")}
        initialQuestions={[question]}
        initialSettings={settings}
      />
    </>,
  );

  const navigationContinues = fireEvent.click(screen.getByRole("link", { name: "문자표" }));

  expect(window.confirm).toHaveBeenCalledWith("연습을 끝내고 이동할까요?");
  expect(navigationContinues).toBe(false);
});

it("hands off only the evaluated result summary when a finite session completes", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  const timestamps = [
    "2026-08-18T00:00:00.000Z",
    "2026-08-18T00:01:00.000Z",
    "2026-08-18T00:02:00.000Z",
  ];
  render(
    <PracticeSession
      catalog={[kana]}
      config={config("copy")}
      initialQuestions={[question]}
      initialSettings={settings}
      now={() => timestamps.shift() ?? "2026-08-18T00:02:00.000Z"}
      onComplete={onComplete}
    />,
  );

  await user.click(screen.getByRole("button", { name: "정답 확인" }));
  await user.click(screen.getByRole("button", { name: "다시 연습" }));
  await user.click(screen.getByRole("button", { name: "결과 보기" }));

  await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  expect(onComplete).toHaveBeenCalledWith({
    config: config("copy"),
    startedAt: "2026-08-18T00:00:00.000Z",
    endedAt: "2026-08-18T00:02:00.000Z",
    results: [{
      kanaId: "hiragana-a",
      evaluation: "retry",
      answeredAt: "2026-08-18T00:01:00.000Z",
    }],
  });
  expect(JSON.stringify(onComplete.mock.calls[0][0])).not.toContain("pressure");
});

it("offers difficult-only, same-settings, and home actions from results", () => {
  render(
    <PracticeResult
      initialSummary={{
        config: config("copy"),
        startedAt: "2026-08-18T00:00:00.000Z",
        endedAt: "2026-08-18T00:02:00.000Z",
        results: [
          { kanaId: "hiragana-a", evaluation: "retry", answeredAt: "2026-08-18T00:01:00.000Z" },
          { kanaId: "hiragana-i", evaluation: "good", answeredAt: "2026-08-18T00:01:30.000Z" },
        ],
      }}
    />,
  );

  expect(screen.getByText("2문제 중 1문자를 다시 연습해 보세요.")).toBeVisible();
  expect(screen.getByRole("link", { name: "어려웠던 문자만 다시 하기" })).toHaveAttribute(
    "href",
    "/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a",
  );
  expect(screen.getByRole("link", { name: "같은 설정으로 다시 하기" })).toHaveAttribute(
    "href",
    "/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform",
  );
  expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
});

it("falls back safely when the result handoff contains a malformed config", () => {
  window.sessionStorage.setItem(PRACTICE_RESULT_STORAGE_KEY, JSON.stringify({
    config: {},
    startedAt: "2026-08-18T00:00:00.000Z",
    results: [],
  }));

  render(<PracticeResult />);

  expect(screen.getByText("표시할 연습 결과가 없어요. 새 연습을 시작해 주세요.")).toBeVisible();
});
