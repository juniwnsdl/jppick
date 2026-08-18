import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "compact-chromium",
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
  },
});
