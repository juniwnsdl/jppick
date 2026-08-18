import { expect, test, type Page } from "@playwright/test";

async function expectMinimumTarget(page: Page, role: "button" | "textbox" | "slider", name: string) {
  const target = page.getByRole(role, { name });
  const box = await target.boundingBox();
  expect(box, `${name} should be visible`).not.toBeNull();
  expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(44);
  expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(44);
}

async function drawStroke(page: Page) {
  const canvas = page.getByRole("img", { name: "쓰기 영역" });
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("쓰기 영역이 화면에 표시되지 않았습니다.");
  }

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 4 });
  await page.mouse.up();
}

async function answerCurrentQuestion(
  page: Page,
  evaluation: "잘 썼어요" | "다시 연습" = "잘 썼어요",
) {
  await drawStroke(page);
  await page.getByRole("button", { name: "정답 확인" }).click();
  await expect(page.getByLabel("정답 모델")).toBeVisible();
  await page.getByRole("button", { name: evaluation }).click();
}

async function finishFiveQuestions(
  page: Page,
  evaluations: ReadonlyArray<"잘 썼어요" | "다시 연습"> = [],
) {
  for (let index = 0; index < 5; index += 1) {
    await answerCurrentQuestion(page, evaluations[index] ?? "잘 썼어요");
    await page.getByRole("button", { name: index === 4 ? "결과 보기" : "다음 문제" }).click();
  }

  await expect(page.getByRole("heading", { name: "연습 결과" })).toBeVisible();
}

test("mobile user completes five copy questions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/practice");
  await page.getByRole("button", { name: "따라 쓰기" }).click();
  await page.getByRole("button", { name: "5문제" }).click();
  await page.getByRole("link", { name: "연습 시작" }).click();

  await finishFiveQuestions(page);
  await expect(page.getByText("5문제 중 0문자를 다시 연습해 보세요.")).toBeVisible();
});

test("mixed recall gives hints and completes a five-question session", async ({ page }) => {
  await page.goto("/practice");
  await page.getByRole("button", { name: "암기 테스트" }).click();
  await page.getByRole("button", { name: "혼합" }).click();
  await page.getByRole("button", { name: "5문제" }).click();
  await page.getByRole("link", { name: "연습 시작" }).click();

  await expect(page.getByLabel("문자 힌트")).toContainText("한국어 읽기");
  await finishFiveQuestions(page);
});

test("chart practice keeps the selected kana as the only practice target", async ({ page }) => {
  await page.goto("/chart");
  await page.getByRole("button", { name: "あ, a, 아" }).click();
  await page.getByRole("link", { name: "이 문자 연습" }).click();

  const start = page.getByRole("link", { name: "연습 시작" });
  await expect(start).toHaveAttribute("href", /kanaIds=hiragana-a/);
  await start.click();
  await expect(page.getByLabel("따라 쓸 문자")).toHaveText("あ");
});

test("retry result starts a difficult-only session", async ({ page }) => {
  await page.goto("/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a");
  await finishFiveQuestions(page, ["다시 연습"]);

  await page.getByRole("link", { name: "어려웠던 문자만 다시 하기" }).click();
  await expect(page).toHaveURL(/kanaIds=hiragana-a/);
  await expect(page.getByLabel("따라 쓸 문자")).toHaveText("あ");
});

test("completed progress remains after a page reload", async ({ page }) => {
  await page.goto("/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a");
  await finishFiveQuestions(page, ["다시 연습"]);

  await page.goto("/records");
  await expect(page.getByText("총 5회")).toBeVisible();
  await expect(page.getByText("완료한 연습 1회")).toBeVisible();
  await expect(page.getByRole("row", { name: /あ.*5.*4.*1/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText("총 5회")).toBeVisible();
  await expect(page.getByText("완료한 연습 1회")).toBeVisible();
});

test("desktop mouse input draws a stroke and enables editing tools", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a");

  await drawStroke(page);
  await expect(page.getByRole("button", { name: "마지막 획 실행 취소" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "모두 지우기" })).toBeEnabled();
});

test("practice controls keep 44px touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a");

  for (const name of ["마지막 획 실행 취소", "모두 지우기", "정답 확인"]) {
    await expectMinimumTarget(page, "button", name);
  }

  await drawStroke(page);
  await page.getByRole("button", { name: "정답 확인" }).click();
  await expectMinimumTarget(page, "slider", "정답 투명도");
  await expectMinimumTarget(page, "button", "잘 썼어요");
  await expectMinimumTarget(page, "button", "다시 연습");
});

test("record controls keep 44px touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/records");
  await expectMinimumTarget(page, "button", "기록 삭제");
  await page.getByRole("button", { name: "기록 삭제" }).click();
  await expectMinimumTarget(page, "textbox", "삭제 확인");
  await expectMinimumTarget(page, "button", "모든 기록 영구 삭제");
  await expectMinimumTarget(page, "button", "취소");
});

test("320px pages do not overflow horizontally and expose 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });

  for (const path of ["/", "/chart", "/practice", "/records"]) {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.goto("/practice");
  for (const target of [
    page.getByRole("button", { name: "따라 쓰기" }),
    page.getByRole("button", { name: "5문제" }),
    page.getByRole("link", { name: "연습 시작" }),
    page.getByRole("link", { name: "가나 학습", exact: true }),
  ]) {
    const box = await target.boundingBox();
    expect(box, "interactive target should be visible").not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("iPhone drawing keeps the page position fixed over the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a");

  const canvas = page.getByRole("img", { name: "쓰기 영역" });
  await canvas.scrollIntoViewIfNeeded();
  const initialScrollY = await page.evaluate(() => window.scrollY);
  await expect(canvas).toHaveCSS("touch-action", "none");
  await drawStroke(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);
});
