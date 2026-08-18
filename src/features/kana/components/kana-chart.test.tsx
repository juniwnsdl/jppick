import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KanaChart } from "./kana-chart";
import { StrokeGuide } from "./stroke-guide";

it("opens the selected katakana yoon unit with its practice target", async () => {
  const user = userEvent.setup();
  render(<KanaChart />);

  await user.click(screen.getByRole("button", { name: "가타카나" }));
  await user.click(screen.getByRole("button", { name: "요음" }));
  await user.click(screen.getByRole("button", { name: "キャ, kya, 캬" }));

  const detail = screen.getByRole("dialog", { name: "キャ 상세" });
  expect(detail).toHaveTextContent("kya");
  expect(detail).toHaveTextContent("캬");
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
