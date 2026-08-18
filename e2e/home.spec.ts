import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 640 } });

test("keeps each primary home action at least 44px tall and wide", async ({ page }) => {
  await page.goto("/");

  for (const name of ["글자표 보기", "쓰기 연습 시작"]) {
    const action = page.getByRole("link", { name });
    const box = await action.boundingBox();

    if (!box) {
      throw new Error(`${name} is not visible`);
    }

    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});
