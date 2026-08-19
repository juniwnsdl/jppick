import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectFocusIndicator(locator: Locator) {
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
}

async function tabThrough(page: Page, locators: Locator[], key: "Tab" | "Shift+Tab" = "Tab") {
  for (const locator of locators) {
    await page.keyboard.press(key);
    await expect(locator).toBeFocused();
  }
}

async function settleClientNavigation(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function revealWithoutInk(page: Page) {
  const reveal = page.getByRole("button", { name: "정답 확인" });
  await expect(reveal).toBeFocused();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("alertdialog", { name: "아직 쓴 획이 없어요" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "그래도 확인하기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("정답 모델")).toBeVisible();
}

test("keyboard user completes the core flow from home through results", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "iphone-webkit", "Mobile WebKit does not expose desktop Tab focus navigation");
  await page.goto("/");
  const brand = page.getByRole("link", { name: "가나 학습", exact: true });
  const home = page.getByRole("link", { name: "홈", exact: true });
  const chart = page.getByRole("link", { name: "글자표", exact: true });
  const practice = page.getByRole("link", { name: "연습", exact: true });
  const records = page.getByRole("link", { name: "기록", exact: true });
  const navigationOrder = [brand, home, chart, practice, records];
  const explanationClose = page.getByRole("button", { name: "설명 닫기" });
  const chartStart = page.getByRole("link", { name: "글자표 보기" });
  const startPractice = page.getByRole("link", { name: "쓰기 연습 시작" });
  await tabThrough(page, [...navigationOrder, explanationClose, chartStart, startPractice]);
  await expectFocusIndicator(startPractice);
  await tabThrough(page, [chartStart], "Shift+Tab");
  await tabThrough(page, [startPractice]);
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");

  const fiveQuestions = page.getByRole("button", { name: "5문제" });
  await tabThrough(page, [
    ...navigationOrder,
    page.getByRole("button", { name: "따라 쓰기" }),
    page.getByRole("button", { name: "암기 테스트" }),
    page.getByRole("button", { name: "히라가나" }),
    page.getByRole("button", { name: "가타카나", exact: true }),
    page.getByRole("button", { name: "혼합" }),
    page.getByRole("button", { name: "기본" }),
    page.getByRole("button", { name: "탁음·반탁음" }),
    page.getByRole("button", { name: "요음" }),
    page.getByRole("button", { name: "작은 문자·기호" }),
    page.getByRole("button", { name: "확장 가타카나" }),
    fiveQuestions,
  ]);
  await page.keyboard.press("Space");
  await expect(fiveQuestions).toHaveAttribute("aria-pressed", "true");

  const start = page.getByRole("link", { name: "연습 시작" });
  await tabThrough(page, [
    page.getByRole("button", { name: "10문제" }),
    page.getByRole("button", { name: "20문제" }),
    page.getByRole("button", { name: "무제한" }),
    page.getByRole("button", { name: "균등 랜덤" }),
    page.getByRole("button", { name: "덜 연습한 문자 우선" }),
    page.getByRole("button", { name: "어려운 문자 우선" }),
    start,
  ]);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/practice\/run\?/);
  await page.waitForLoadState("networkidle");

  for (let index = 0; index < 5; index += 1) {
    const reveal = page.getByRole("button", { name: "정답 확인" });
    await expect(reveal).toBeVisible();
    if (index === 0) {
      await settleClientNavigation(page);
    }
    await tabThrough(page, index === 0
      ? [
          page.getByRole("checkbox", { name: "보조선 표시" }),
          page.getByRole("checkbox", { name: "따라 쓰기 가이드 표시" }),
          reveal,
        ]
      : [reveal]);
    await expectFocusIndicator(reveal);
    await revealWithoutInk(page);
    const good = page.getByRole("button", { name: "잘 썼어요" });
    await tabThrough(page, [
      page.getByRole("slider", { name: "정답 투명도" }),
      good,
    ]);
    await page.keyboard.press("Enter");

    const advance = page.getByRole("button", { name: index === 4 ? "결과 보기" : "다음 문제" });
    await tabThrough(page, [advance]);
    await page.keyboard.press("Enter");
  }

  await expect(page.getByRole("heading", { name: "연습 결과" })).toBeVisible();
});

test("chart detail traps focus, closes with Escape, and restores its trigger", async ({ page }) => {
  await page.goto("/chart");
  const trigger = page.getByRole("button", { name: "あ, a, 아" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "あ 상세" });
  const close = page.getByRole("button", { name: "상세 닫기" });
  const practice = page.getByRole("link", { name: "이 문자 연습" });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(practice).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("selected setup choices expose semantic and visible non-color status", async ({ page }) => {
  await page.goto("/practice");

  const selectedMode = page.getByRole("button", { name: "따라 쓰기" });
  await expect(selectedMode).toHaveAttribute("aria-pressed", "true");
  await expect(selectedMode.locator("[data-selected-indicator]")).toHaveText("✓");

  const selectedCount = page.getByRole("button", { name: "10문제" });
  await expect(selectedCount).toHaveAttribute("aria-pressed", "true");
  await expect(selectedCount.locator("[data-selected-indicator]")).toHaveText("✓");
});

test("active chart filters expose semantic and visible non-color status", async ({ page }) => {
  await page.goto("/chart");

  for (const name of ["히라가나", "기본"]) {
    const activeFilter = page.getByRole("button", { name });
    await expect(activeFilter).toHaveAttribute("aria-pressed", "true");
    await expect(activeFilter.locator("[data-selected-indicator]")).toHaveText("✓");
  }
});

test("records deletion requires explicit Korean confirmation", async ({ page }) => {
  await page.goto("/records");
  await page.getByRole("button", { name: "기록 삭제" }).click();

  const confirm = page.getByRole("button", { name: "모든 기록 영구 삭제" });
  await expect(page.getByText("삭제한 기록은 복구할 수 없어요.")).toBeVisible();
  await expect(confirm).toBeDisabled();
  await page.getByRole("textbox", { name: "삭제 확인" }).fill("삭제");
  await expect(confirm).toBeEnabled();
});

test("reduced-motion preference removes non-essential animation and scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const motion = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const movingElements = [...document.querySelectorAll("*")].flatMap((element) => {
      const style = getComputedStyle(element);
      const animationSeconds = style.animationDuration.split(",").map((value) => Number.parseFloat(value));
      const transitionSeconds = style.transitionDuration.split(",").map((value) => Number.parseFloat(value));
      return animationSeconds.some((value) => value > 0) || transitionSeconds.some((value) => value > 0)
        ? [element.tagName.toLowerCase()]
        : [];
    });

    return {
      movingElements,
      scrollBehavior: rootStyle.scrollBehavior,
    };
  });

  expect(motion.scrollBehavior).toBe("auto");
  expect(motion.movingElements).toEqual([]);
});
