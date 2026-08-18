import { render, screen } from "@testing-library/react";

import { AppNav } from "./app-nav";

it("exposes the four core learning destinations", () => {
  render(<AppNav />);

  expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "글자표" })).toHaveAttribute("href", "/chart");
  expect(screen.getByRole("link", { name: "연습" })).toHaveAttribute("href", "/practice");
  expect(screen.getByRole("link", { name: "기록" })).toHaveAttribute("href", "/records");
});
