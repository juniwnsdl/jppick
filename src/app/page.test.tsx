import { render, screen } from "@testing-library/react";
import HomePage from "./page";

it("offers chart and practice as the two primary actions", () => {
  render(<HomePage />);
  expect(screen.getByRole("link", { name: "글자표 보기" })).toBeVisible();
  expect(screen.getByRole("link", { name: "쓰기 연습 시작" })).toBeVisible();
});

it("shows a dashboard with progress placeholders until learning data is available", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "바로 시작하기" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "오늘의 연습" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "최근 연습 문자" })).toBeVisible();
});
