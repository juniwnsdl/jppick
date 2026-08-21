import { describe, expect, it } from "vitest";

import { localDateKey, nextLocalDateKey } from "./local-date";

describe("localDateKey", () => {
  it("formats a local calendar date with zero-padded month and day", () => {
    const localMorning = new Date(2026, 0, 5, 9, 30);

    expect(localDateKey(localMorning)).toBe("2026-01-05");
  });

  it("uses local calendar fields instead of the UTC date", () => {
    const localMidnight = new Date(2026, 0, 1, 0, 30);

    expect(localDateKey(localMidnight)).toBe("2026-01-01");
  });
});

describe("nextLocalDateKey", () => {
  it("moves to the next local date across month and year boundaries", () => {
    expect(nextLocalDateKey(new Date(2026, 0, 31, 23, 59))).toBe("2026-02-01");
    expect(nextLocalDateKey(new Date(2026, 11, 31, 23, 59))).toBe("2027-01-01");
  });
});
