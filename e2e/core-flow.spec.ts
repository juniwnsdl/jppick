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
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("쓰기 영역이 화면에 표시되지 않았습니다.");
  }

  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 4 });
  await page.mouse.up();
}

interface WebKitProtocolPage extends Page {
  _connection: {
    toImpl(page: Page): {
      delegate: {
        rawTouchscreen: {
          _pageProxySession: {
            send(method: string, params: unknown): Promise<unknown>;
          };
        };
      };
    };
  };
}

async function drawTrustedWebKitTouchStroke(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const implementation = (page as WebKitProtocolPage)._connection.toImpl(page);
  const session = implementation.delegate.rawTouchscreen._pageProxySession;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [start],
  });
  for (let step = 1; step <= 4; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: start.x + (end.x - start.x) * step / 4,
        y: start.y + (end.y - start.y) * step / 4,
      }],
    });
  }
  // WebKit's inspector gesture stream is terminated by its trusted tap command.
  await page.touchscreen.tap(end.x, end.y);
}

async function answerCurrentQuestion(
  page: Page,
  evaluation: "잘 썼어요" | "다시 연습" = "잘 썼어요",
): Promise<string> {
  await drawStroke(page);
  await page.getByRole("button", { name: "정답 확인" }).click();
  const answer = page.getByLabel("정답 모델");
  await expect(answer).toBeVisible();
  const glyph = (await answer.textContent())?.trim() ?? "";
  await page.getByRole("button", { name: evaluation }).click();
  return glyph;
}

async function finishFiveQuestions(
  page: Page,
  evaluations: ReadonlyArray<"잘 썼어요" | "다시 연습"> = [],
): Promise<string[]> {
  const answers: string[] = [];

  for (let index = 0; index < 5; index += 1) {
    answers.push(await answerCurrentQuestion(page, evaluations[index] ?? "잘 썼어요"));
    await page.getByRole("button", { name: index === 4 ? "결과 보기" : "다음 문제" }).click();
  }

  await expect(page.getByRole("heading", { name: "연습 결과" })).toBeVisible();
  return answers;
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

test("mixed recall setup selects both scripts", async ({ page }) => {
  await page.goto("/practice");
  await page.getByRole("button", { name: "암기 테스트" }).click();
  await page.getByRole("button", { name: "혼합" }).click();
  await page.getByRole("button", { name: "5문제" }).click();
  const start = page.getByRole("link", { name: "연습 시작" });
  await expect(start).toHaveAttribute("href", /scripts=hiragana,katakana/);
});

test("mixed recall exercises both selected scripts in one session", async ({ page }) => {
  await page.goto("/practice/run?mode=recall&scripts=hiragana,katakana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a,katakana-a");

  await expect(page.getByLabel("문자 힌트")).toContainText("한국어 읽기");
  await expect(page.getByLabel("문자 힌트")).toContainText(/문자 종류(히라가나|가타카나)/);
  await expect(page.getByLabel("문자 힌트")).toContainText("분류기본");
  const answers = await finishFiveQuestions(page);
  expect(answers.some((glyph) => /^[\u3040-\u309f]+$/u.test(glyph)), "session should exercise hiragana").toBe(true);
  expect(answers.some((glyph) => /^[\u30a0-\u30ff]+$/u.test(glyph)), "session should exercise katakana").toBe(true);
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
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/practice/run?mode=copy&scripts=hiragana,katakana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a,katakana-a");
  const answers = await finishFiveQuestions(page, ["다시 연습"]);
  expect(new Set(answers)).toEqual(new Set(["あ", "ア"]));

  const retry = page.getByRole("link", { name: "어려웠던 문자만 다시 하기" });
  await expect(retry).toHaveAttribute("href", /kanaIds=katakana-a(?:&|$)/);
  await expect(retry).not.toHaveAttribute("href", /hiragana-a/);
  await retry.click();
  await expect(page).toHaveURL(/kanaIds=katakana-a(?:&|$)/);
  await expect(page.getByLabel("따라 쓸 문자")).toHaveText("ア");
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

test("touch drawing reaches the app while keeping the page position fixed", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/practice/run?mode=copy&scripts=hiragana&groups=basic&count=5&strategy=uniform&kanaIds=hiragana-a");

  const canvas = page.getByRole("img", { name: "쓰기 영역" });
  await canvas.scrollIntoViewIfNeeded();
  const initialScrollY = await page.evaluate(() => window.scrollY);
  await expect(canvas).toHaveCSS("touch-action", "none");
  if (testInfo.project.name === "desktop-chromium") {
    await drawStroke(page);
  } else if (testInfo.project.name === "iphone-webkit") {
    await canvas.evaluate((element) => {
      let startedAt: { x: number; y: number } | null = null;
      element.addEventListener("pointerdown", (event) => {
        const pointer = event as PointerEvent;
        if (!startedAt) {
          startedAt = { x: pointer.clientX, y: pointer.clientY };
        }
        element.setAttribute("data-received-pointer-type", pointer.pointerType);
        element.setAttribute("data-received-trusted-pointer", String(pointer.isTrusted));
      });
      element.addEventListener("pointermove", (event) => {
        const pointer = event as PointerEvent;
        if (startedAt && (pointer.clientX !== startedAt.x || pointer.clientY !== startedAt.y)) {
          element.setAttribute("data-received-moving-touch", String(
            pointer.pointerType === "touch" && pointer.isTrusted,
          ));
        }
      });
    });
    const box = await canvas.boundingBox();
    expect(box, "writing canvas should be visible for touch input").not.toBeNull();
    await drawTrustedWebKitTouchStroke(
      page,
      { x: box!.x + box!.width * 0.25, y: box!.y + box!.height * 0.25 },
      { x: box!.x + box!.width * 0.75, y: box!.y + box!.height * 0.75 },
    );
    await expect(canvas).toHaveAttribute("data-received-pointer-type", "touch");
    await expect(canvas).toHaveAttribute("data-received-trusted-pointer", "true");
    await expect(canvas).toHaveAttribute("data-received-moving-touch", "true");
  } else {
    await canvas.evaluate((element) => {
      element.addEventListener("pointerdown", (event) => {
        element.setAttribute("data-received-pointer-type", (event as PointerEvent).pointerType);
      }, { once: true });
    });
    const box = await canvas.boundingBox();
    expect(box, "writing canvas should be visible for touch input").not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(canvas).toHaveAttribute("data-received-pointer-type", "touch");
  }
  await expect(page.getByRole("button", { name: "마지막 획 실행 취소" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);
});
