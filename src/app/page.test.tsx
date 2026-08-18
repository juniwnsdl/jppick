import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("offers chart and practice as the two primary actions", () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: "글자표 보기" })).toBeVisible();
  expect(screen.getByRole("link", { name: "쓰기 연습 시작" })).toBeVisible();
});
