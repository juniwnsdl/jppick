import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KanaChart } from "./kana-chart";
import { StrokeGuide } from "./stroke-guide";

it("starts the entire visible chart in catalog order", async () => {
  const user = userEvent.setup();
  render(<KanaChart />);

  expect(screen.getByRole("link", { name: "현재 46자 순서대로 연습" })).toHaveAttribute(
    "href",
    "/practice/run?mode=copy&scripts=hiragana&groups=basic&count=all&strategy=ordered",
  );

  await user.click(screen.getByRole("button", { name: "요음" }));

  expect(screen.getByRole("link", { name: "현재 33자 순서대로 연습" })).toHaveAttribute(
    "href",
    "/practice/run?mode=copy&scripts=hiragana&groups=yoon&count=all&strategy=ordered",
  );
});

it("opens the selected katakana yoon unit with its practice target", async () => {
  const user = userEvent.setup();
  render(<KanaChart />);

  await user.click(screen.getByRole("button", { name: "가타카나" }));
  await user.click(screen.getByRole("button", { name: "요음" }));
  await user.click(screen.getByRole("button", { name: "キャ, kya, 캬" }));

  const detail = screen.getByRole("dialog", { name: "キャ 상세" });
  expect(detail).toHaveTextContent("kya");
  expect(detail).toHaveTextContent("캬");
  expect(detail).toHaveTextContent("문자 종류가타카나");
  expect(detail).toHaveTextContent("분류요음");
  expect(screen.getByRole("link", { name: "이 문자 연습" })).toHaveAttribute(
    "href",
    "/practice?kana=katakana-kya",
  );
});

it("moves focus into the detail dialog when it opens", async () => {
  const user = userEvent.setup();
  render(<KanaChart />);

  await user.click(screen.getByRole("button", { name: "あ, a, 아" }));

  expect(screen.getByRole("button", { name: "상세 닫기" })).toHaveFocus();
});

it("keeps tab focus inside the detail dialog", async () => {
  const user = userEvent.setup();
  render(<KanaChart />);

  await user.click(screen.getByRole("button", { name: "あ, a, 아" }));
  const closeButton = screen.getByRole("button", { name: "상세 닫기" });
  const practiceLink = screen.getByRole("link", { name: "이 문자 연습" });

  await user.tab({ shift: true });
  expect(practiceLink).toHaveFocus();
  await user.tab();
  expect(closeButton).toHaveFocus();
});

it("closes on Escape and restores focus to the selected cell", async () => {
  const user = userEvent.setup();
  render(<KanaChart />);
  const selectedCell = screen.getByRole("button", { name: "あ, a, 아" });

  await user.click(selectedCell);
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(selectedCell).toHaveFocus();
});

it("renders every component of a compound stroke guide statically by default", () => {
  render(<StrokeGuide assetKeys={["katakana/キ", "katakana/ャ"]} />);

  expect(screen.getByRole("img", { name: "キ 획순" })).toBeVisible();
  expect(screen.getByRole("img", { name: "ャ 획순" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "획순 다시 보기" })).not.toBeInTheDocument();
});

it("shows a visible fallback when a stroke asset fails at runtime", () => {
  render(<StrokeGuide assetKeys={["hiragana/あ"]} />);

  fireEvent.error(screen.getByRole("img", { name: "あ 획순" }));

  expect(screen.getByRole("status")).toHaveTextContent("あ 획순 이미지를 불러오지 못했어요");
});
