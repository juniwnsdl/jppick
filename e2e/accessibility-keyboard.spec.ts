import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectFocusIndicator(locator: Locator) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
}

async function revealWithoutInk(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  const reveal = page.getByRole("button", { name: "정답 확인" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("정답 모델")).toBeVisible();
}

test("keyboard user completes the core flow from home through results", async ({ page }) => {
  await page.goto("/");
  const startPractice = page.getByRole("link", { name: "쓰기 연습 시작" });
  await expectFocusIndicator(startPractice);
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");

  const fiveQuestions = page.getByRole("button", { name: "5문제" });
  await fiveQuestions.focus();
  await page.keyboard.press("Space");
  await expect(fiveQuestions).toHaveAttribute("aria-pressed", "true");

  const start = page.getByRole("link", { name: "연습 시작" });
  await start.focus();
  await page.keyboard.press("Enter");

  for (let index = 0; index < 5; index += 1) {
    await revealWithoutInk(page);
    const good = page.getByRole("button", { name: "잘 썼어요" });
    await good.focus();
    await page.keyboard.press("Enter");

    const advance = page.getByRole("button", { name: index === 4 ? "결과 보기" : "다음 문제" });
    await advance.focus();
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
