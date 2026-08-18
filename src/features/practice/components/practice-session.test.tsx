import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { vi } from "vitest";

import type { KanaUnit } from "../../kana/types";
import type { AppSettings } from "../../../lib/settings";
import { PRACTICE_RESULT_STORAGE_KEY } from "../session-reducer";
import type { PracticeConfig, Question } from "../types";
import { PracticeResult } from "./practice-result";
import { isCompatibleInterrupted, PracticeSession } from "./practice-session";

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

class CapturingPracticePersistence {
  evaluations: Array<{ kanaId: string; value: "good" | "retry"; at: string }> = [];
  sessions: unknown[] = [];
  interrupted: {
    id: string;
    startedAt: string;
    config: PracticeConfig;
    selectedKanaIds: string[];
    queue: Question[];
    currentIndex: number;
    answers: Array<{ kanaId: string; evaluation: "good" | "retry"; answeredAt: string }>;
  } | null = null;
  failClear = false;
  private readonly checkpointKeys = new Set<string>();

  async recordEvaluation(kanaId: string, value: "good" | "retry", at: string) {
    this.evaluations.push({ kanaId, value, at });
  }

  async saveSession(summary: unknown) {
    this.sessions = [summary];
  }

  async saveInterrupted(session: NonNullable<CapturingPracticePersistence["interrupted"]>) {
    this.interrupted = structuredClone(session);
  }

  async saveAnswerCheckpoint(session: NonNullable<CapturingPracticePersistence["interrupted"]>) {
    const index = session.currentIndex - 1;
    const answer = session.answers[index];
    const questionAtIndex = session.queue[index];
    const key = `${session.id}:${questionAtIndex?.id}`;
    if (answer && questionAtIndex && !this.checkpointKeys.has(key)) {
      this.checkpointKeys.add(key);
      this.evaluations.push({ kanaId: answer.kanaId, value: answer.evaluation, at: answer.answeredAt });
    }
    this.interrupted = structuredClone(session);
  }

  async loadInterrupted() {
    return this.interrupted ? structuredClone(this.interrupted) : null;
  }

  async clearInterrupted() {
    if (this.failClear) {
      throw new DOMException("write failed", "UnknownError");
    }
    this.interrupted = null;
  }
}

function unlimitedConfig(): PracticeConfig {
  return { ...config("copy"), count: "unlimited", strategy: "least-practiced" };
}

function questions(count = 5, kanaId = "hiragana-a"): Question[] {
  return Array.from({ length: count }, (_value, index) => ({
    id: `question-${index + 1}-${kanaId}`,
    kanaId,
  }));
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
  routerPush.mockClear();
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
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
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

it("lets the learner toggle and persist writing guides", async () => {
  const user = userEvent.setup();
  render(
    <PracticeSession
      catalog={[kana]}
      config={config("copy")}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  const guideLayer = screen.getByTestId("writing-guide-layer");
  expect(guideLayer.querySelectorAll("line")).toHaveLength(2);
  expect(screen.getByTestId("trace-kana-guide")).toBeVisible();

  await user.click(screen.getByRole("checkbox", { name: "보조선 표시" }));
  await user.click(screen.getByRole("checkbox", { name: "따라 쓰기 가이드 표시" }));

  expect(guideLayer.querySelectorAll("line")).toHaveLength(0);
  expect(screen.queryByTestId("trace-kana-guide")).not.toBeInTheDocument();
  expect(window.localStorage.getItem("kana-learning-settings")).toContain('"guideLines":false');
  expect(window.localStorage.getItem("kana-learning-settings")).toContain('"traceGuide":false');
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

it("disambiguates a mixed-script recall prompt before the answer is revealed", () => {
  const katakana: KanaUnit = {
    ...kana,
    id: "katakana-a",
    display: "ア",
    glyphs: ["ア"],
    script: "katakana",
    strokeAssetKeys: ["katakana/basic/ア"],
  };

  render(
    <PracticeSession
      catalog={[kana, katakana]}
      config={{ ...config("recall"), scripts: ["hiragana", "katakana"] }}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  const hint = screen.getByLabelText("문자 힌트");
  expect(hint).toHaveTextContent("문자 종류히라가나");
  expect(hint).toHaveTextContent("분류기본");
  expect(screen.queryByText("あ")).not.toBeInTheDocument();
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

it("guards programmatic history navigation and restores history methods on cleanup", () => {
  window.history.replaceState({}, "", "/practice/run");
  vi.mocked(window.confirm).mockReturnValue(false);
  const { unmount } = render(
    <PracticeSession
      catalog={[kana]}
      config={config("copy")}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  window.history.pushState({ source: "programmatic" }, "", "/chart");

  expect(window.confirm).toHaveBeenCalledWith("연습을 끝내고 이동할까요?");
  expect(window.location.pathname).toBe("/practice/run");

  unmount();
  vi.mocked(window.confirm).mockClear();
  window.history.pushState({ source: "after-cleanup" }, "", "/chart");

  expect(window.location.pathname).toBe("/chart");
  expect(window.confirm).not.toHaveBeenCalled();
});

it("keeps the active route when browser back navigation is cancelled", async () => {
  window.history.replaceState({ source: "previous" }, "", "/chart");
  window.history.pushState({ source: "session" }, "", "/practice/run");
  vi.mocked(window.confirm).mockReturnValue(false);
  render(
    <PracticeSession
      catalog={[kana]}
      config={config("copy")}
      initialQuestions={[question]}
      initialSettings={settings}
    />,
  );

  window.history.back();

  await waitFor(() => {
    expect(window.confirm).toHaveBeenCalledWith("연습을 끝내고 이동할까요?");
  });
  expect(window.location.pathname).toBe("/practice/run");
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

it("persists each answer once, autosaves stroke-free progress, and finalizes the session", async () => {
  const user = userEvent.setup();
  const repository = new CapturingPracticePersistence();
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
      repository={repository}
    />,
  );

  await user.click(screen.getByRole("button", { name: "정답 확인" }));
  await user.click(screen.getByRole("button", { name: "잘 썼어요" }));

  await waitFor(() => expect(repository.evaluations).toHaveLength(1));
  const saved = repository.interrupted;
  expect(saved).toMatchObject({
    selectedKanaIds: ["hiragana-a"],
    currentIndex: 1,
    answers: [{ evaluation: "good" }],
  });
  expect(JSON.stringify(saved)).not.toContain("stroke");

  await user.click(screen.getByRole("button", { name: "결과 보기" }));

  await waitFor(() => expect(repository.sessions).toHaveLength(1));
  expect(repository.interrupted).toBeNull();
  expect(onComplete).toHaveBeenCalledOnce();
});

it("offers to resume a compatible interrupted queue at the next unanswered question", async () => {
  const user = userEvent.setup();
  const repository = new CapturingPracticePersistence();
  const secondKana: KanaUnit = {
    ...kana,
    id: "hiragana-i",
    display: "い",
    romaji: "i",
    readingKo: "이",
    glyphs: ["い"],
    strokeAssetKeys: ["hiragana/basic/い"],
  };
  await repository.saveInterrupted({
    id: "session-resume",
    startedAt: "2026-08-18T00:00:00.000Z",
    config: config("copy"),
    selectedKanaIds: ["hiragana-a", "hiragana-i"],
    queue: [
      question,
      { id: "question-2-hiragana-i", kanaId: "hiragana-i" },
      { id: "question-3-hiragana-a", kanaId: "hiragana-a" },
      { id: "question-4-hiragana-i", kanaId: "hiragana-i" },
      { id: "question-5-hiragana-a", kanaId: "hiragana-a" },
    ],
    currentIndex: 1,
    answers: [{
      kanaId: "hiragana-a",
      evaluation: "good",
      answeredAt: "2026-08-18T00:01:00.000Z",
    }],
  });

  render(
    <PracticeSession
      catalog={[kana, secondKana]}
      config={config("copy")}
      initialSettings={settings}
      random={() => 0}
      repository={repository}
    />,
  );

  await user.click(await screen.findByRole("button", { name: "이어하기" }));

  expect(screen.getByText("2 / 5")).toBeVisible();
  expect(screen.getByLabelText("따라 쓸 문자")).toHaveTextContent("い");
});

it("appends the next weighted cycle before resuming an unlimited boundary checkpoint", async () => {
  const user = userEvent.setup();
  const repository = new CapturingPracticePersistence();
  const secondKana: KanaUnit = {
    ...kana,
    id: "hiragana-i",
    display: "い",
    romaji: "i",
    readingKo: "이",
    glyphs: ["い"],
    strokeAssetKeys: ["hiragana/basic/い"],
  };
  await repository.saveInterrupted({
    id: "session-unlimited",
    startedAt: "2026-08-18T00:00:00.000Z",
    config: unlimitedConfig(),
    selectedKanaIds: ["hiragana-a", "hiragana-i"],
    queue: [
      { id: "question-1-hiragana-i", kanaId: "hiragana-i" },
      { id: "question-2-hiragana-a", kanaId: "hiragana-a" },
    ],
    currentIndex: 2,
    answers: [
      { kanaId: "hiragana-i", evaluation: "retry", answeredAt: "2026-08-18T00:01:00.000Z" },
      { kanaId: "hiragana-a", evaluation: "good", answeredAt: "2026-08-18T00:02:00.000Z" },
    ],
  });

  render(
    <PracticeSession
      catalog={[kana, secondKana]}
      config={unlimitedConfig()}
      initialSettings={settings}
      progress={{
        "hiragana-a": { presented: 8, retry: 0 },
        "hiragana-i": { presented: 1, retry: 1 },
      }}
      random={() => 1}
      repository={repository}
    />,
  );

  await user.click(await screen.findByRole("button", { name: "이어하기" }));

  expect(screen.getByText("2개 완료 · 무제한 연습")).toBeVisible();
  expect(screen.getByRole("button", { name: "정답 확인" })).toBeVisible();
  expect(screen.getByLabelText("따라 쓸 문자")).toHaveTextContent("い");
});

it.each([
  ["invalid start date", { startedAt: "not-a-date" }],
  ["impossible calendar date", { startedAt: "2026-02-31T00:00:00.000Z" }],
  ["invalid answer date", { answers: [{ kanaId: "hiragana-a", evaluation: "good", answeredAt: "bad" }] }],
  ["invalid evaluation", { answers: [{ kanaId: "hiragana-a", evaluation: "maybe", answeredAt: "2026-08-18T00:01:00.000Z" }] }],
  ["invalid question shape", { queue: [{ id: "", kanaId: "hiragana-a" }] }],
  ["kana outside catalog", { queue: [{ id: "question-1", kanaId: "katakana-a" }], answers: [{ kanaId: "katakana-a", evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" }] }],
  ["answer order mismatch", { answers: [{ kanaId: "hiragana-i", evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" }] }],
  ["finite queue length mismatch", { queue: [question, question] }],
])("rejects a malformed interrupted session with %s", (_name, change) => {
  const candidate = {
    id: "session-guard",
    startedAt: "2026-08-18T00:00:00.000Z",
    config: config("copy"),
    selectedKanaIds: ["hiragana-a"],
    queue: questions(),
    currentIndex: 1,
    answers: [{ kanaId: "hiragana-a", evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" }],
    ...change,
  };

  expect(isCompatibleInterrupted(candidate, config("copy"), [kana])).toBe(false);
});

it("rejects an interrupted queue outside the active script and group filters", () => {
  const katakana: KanaUnit = {
    ...kana,
    id: "katakana-a",
    display: "ア",
    glyphs: ["ア"],
    script: "katakana",
    strokeAssetKeys: ["katakana/basic/ア"],
  };
  const queue = questions(5, katakana.id);
  const candidate = {
    id: "session-filter-mismatch",
    startedAt: "2026-08-18T00:00:00.000Z",
    config: config("copy"),
    selectedKanaIds: ["katakana-a"],
    queue,
    currentIndex: 1,
    answers: [{ kanaId: katakana.id, evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" }],
  };

  expect(isCompatibleInterrupted(candidate, config("copy"), [kana, katakana])).toBe(false);
});

it("requires an exact selected-kana scope before offering resume", () => {
  const secondKana: KanaUnit = {
    ...kana,
    id: "hiragana-i",
    display: "い",
    glyphs: ["い"],
    romaji: "i",
    readingKo: "이",
    strokeAssetKeys: ["hiragana/basic/い"],
  };
  const matchingQueue = questions(5, kana.id);
  const candidate = {
    id: "session-selection-mismatch",
    startedAt: "2026-08-18T00:00:00.000Z",
    config: config("copy"),
    selectedKanaIds: ["hiragana-a"],
    queue: matchingQueue,
    currentIndex: 1,
    answers: [{ kanaId: kana.id, evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" }],
  };

  expect(isCompatibleInterrupted(candidate, config("copy"), [kana, secondKana])).toBe(false);
  expect(isCompatibleInterrupted({ ...candidate, selectedKanaIds: undefined }, config("copy"), [kana])).toBe(false);
});

it("keeps the resume choice visible and offers retry when clearing fails", async () => {
  const user = userEvent.setup();
  const repository = new CapturingPracticePersistence();
  repository.failClear = true;
  await repository.saveInterrupted({
    id: "session-clear-failure",
    startedAt: "2026-08-18T00:00:00.000Z",
    config: config("copy"),
    selectedKanaIds: ["hiragana-a"],
    queue: questions(),
    currentIndex: 1,
    answers: [{ kanaId: "hiragana-a", evaluation: "good", answeredAt: "2026-08-18T00:01:00.000Z" }],
  });

  render(
    <PracticeSession
      catalog={[kana]}
      config={config("copy")}
      initialSettings={settings}
      repository={repository}
    />,
  );

  await user.click(await screen.findByRole("button", { name: "새로 시작" }));

  expect(screen.getByRole("heading", { name: "중단한 연습이 있어요" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("중단 기록을 삭제하지 못했어요");
  expect(screen.getByRole("button", { name: "삭제 다시 시도" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "정답 확인" })).not.toBeInTheDocument();

  repository.failClear = false;
  await user.click(screen.getByRole("button", { name: "삭제 다시 시도" }));
  expect(await screen.findByRole("button", { name: "정답 확인" })).toBeVisible();
  expect(repository.interrupted).toBeNull();
});

it("invalidates a stale result when writing the new handoff fails", async () => {
  const user = userEvent.setup();
  window.sessionStorage.setItem(PRACTICE_RESULT_STORAGE_KEY, JSON.stringify({
    config: config("copy"),
    startedAt: "2026-08-17T00:00:00.000Z",
    endedAt: "2026-08-17T00:02:00.000Z",
    results: [{
      kanaId: "hiragana-i",
      evaluation: "retry",
      answeredAt: "2026-08-17T00:01:00.000Z",
    }],
  }));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("quota exceeded", "QuotaExceededError");
  });
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
    />,
  );

  await user.click(screen.getByRole("button", { name: "정답 확인" }));
  await user.click(screen.getByRole("button", { name: "잘 썼어요" }));
  await user.click(screen.getByRole("button", { name: "결과 보기" }));

  await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/practice/result"));
  expect(window.sessionStorage.getItem(PRACTICE_RESULT_STORAGE_KEY)).toBeNull();
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
  expect(screen.getByText("성공률 50% (1/2)")).toBeVisible();
  expect(screen.getByRole("list", { name: "다시 연습할 문자" })).toHaveTextContent("あ");
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

it.each([
  ["duplicate scripts", {
    config: { ...config("copy"), scripts: ["hiragana", "hiragana"] },
    startedAt: "2026-08-18T00:00:00.000Z",
    endedAt: "2026-08-18T00:02:00.000Z",
    results: [],
  }],
  ["duplicate groups", {
    config: { ...config("copy"), groups: ["basic", "basic"] },
    startedAt: "2026-08-18T00:00:00.000Z",
    endedAt: "2026-08-18T00:02:00.000Z",
    results: [],
  }],
  ["missing endedAt", {
    config: config("copy"),
    startedAt: "2026-08-18T00:00:00.000Z",
    results: [],
  }],
  ["invalid endedAt", {
    config: config("copy"),
    startedAt: "2026-08-18T00:00:00.000Z",
    endedAt: "not-a-date",
    results: [],
  }],
  ["invalid startedAt", {
    config: config("copy"),
    startedAt: "not-a-date",
    endedAt: "2026-08-18T00:02:00.000Z",
    results: [],
  }],
  ["invalid answeredAt", {
    config: config("copy"),
    startedAt: "2026-08-18T00:00:00.000Z",
    endedAt: "2026-08-18T00:02:00.000Z",
    results: [{ kanaId: "hiragana-a", evaluation: "good", answeredAt: "not-a-date" }],
  }],
])("rejects a result handoff with %s", (_name, summary) => {
  window.sessionStorage.setItem(PRACTICE_RESULT_STORAGE_KEY, JSON.stringify(summary));

  render(<PracticeResult />);

  expect(screen.getByText("표시할 연습 결과가 없어요. 새 연습을 시작해 주세요.")).toBeVisible();
});
