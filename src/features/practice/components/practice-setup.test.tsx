import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KANA_CATALOG } from "../../kana/catalog";
import { PracticeSetup, practiceConfigFromSearchParams } from "./practice-setup";

it("offers every practice setting choice", () => {
  render(<PracticeSetup catalog={KANA_CATALOG} />);

  expect(screen.getByRole("button", { name: "따라 쓰기" })).toBeVisible();
  expect(screen.getByRole("button", { name: "암기 테스트" })).toBeVisible();
  expect(screen.getByRole("button", { name: "히라가나" })).toBeVisible();
  expect(screen.getByRole("button", { name: "가타카나" })).toBeVisible();
  expect(screen.getByRole("button", { name: "혼합" })).toBeVisible();
  expect(screen.getByRole("button", { name: "기본" })).toBeVisible();
  expect(screen.getByRole("button", { name: "탁음·반탁음" })).toBeVisible();
  expect(screen.getByRole("button", { name: "요음" })).toBeVisible();
  expect(screen.getByRole("button", { name: "작은 문자·기호" })).toBeVisible();
  expect(screen.getByRole("button", { name: "확장 가타카나" })).toBeVisible();
  expect(screen.getByRole("button", { name: "5문제" })).toBeVisible();
  expect(screen.getByRole("button", { name: "10문제" })).toBeVisible();
  expect(screen.getByRole("button", { name: "20문제" })).toBeVisible();
  expect(screen.getByRole("button", { name: "무제한" })).toBeVisible();
  expect(screen.getByRole("button", { name: "균등 랜덤" })).toBeVisible();
  expect(screen.getByRole("button", { name: "덜 연습한 문자 우선" })).toBeVisible();
  expect(screen.getByRole("button", { name: "어려운 문자 우선" })).toBeVisible();
});

it("serializes the selected setup into the exact practice-run query", async () => {
  const user = userEvent.setup();
  render(
    <PracticeSetup
      catalog={KANA_CATALOG}
      initialConfig={{
        mode: "copy",
        scripts: ["hiragana", "katakana"],
        groups: ["basic"],
        count: 10,
        strategy: "uniform",
      }}
    />,
  );

  await user.click(screen.getByRole("button", { name: "요음" }));

  expect(screen.getByRole("link", { name: "연습 시작" })).toHaveAttribute(
    "href",
    "/practice/run?mode=copy&scripts=hiragana,katakana&groups=basic,yoon&count=10&strategy=uniform",
  );
});

it("restores a shared setup from URL values without reading learning data", () => {
  const config = practiceConfigFromSearchParams({
    mode: "recall",
    scripts: "katakana",
    groups: "yoon,extended",
    count: "unlimited",
    strategy: "difficult",
  });

  render(<PracticeSetup catalog={KANA_CATALOG} initialConfig={config} />);

  expect(screen.getByRole("button", { name: "암기 테스트" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("link", { name: "연습 시작" })).toHaveAttribute(
    "href",
    "/practice/run?mode=recall&scripts=katakana&groups=yoon,extended&count=unlimited&strategy=difficult",
  );
});

it("disables starting when the active filters select no kana", () => {
  render(
    <PracticeSetup
      catalog={KANA_CATALOG}
      initialConfig={{
        mode: "copy",
        scripts: ["hiragana"],
        groups: ["extended"],
        count: 5,
        strategy: "uniform",
      }}
    />,
  );

  expect(screen.getByRole("button", { name: "연습 시작" })).toBeDisabled();
  expect(screen.getByText("선택한 범위에 연습할 문자가 없어요.")).toBeVisible();
});
