import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("validate-kana-catalog", () => {
  it("reports the complete catalog and every declared group", () => {
    const output = execFileSync(process.execPath, ["scripts/validate-kana-catalog.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(output).toContain("Kana catalog validation passed: 277 units");
    expect(output).toContain("hiragana: basic=46, voiced=26, yoon=33, small=12, extended=0");
    expect(output).toContain("katakana: basic=46, voiced=26, yoon=33, small=13, extended=42");
    expect(output).toContain("groups: basic=92, voiced=52, yoon=66, small=25, extended=42");
  });
});
