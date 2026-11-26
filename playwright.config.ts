import { defineConfig } from "@playwright/test";
const port = Number(process.env.LOOPKIT_TEST_PORT || 3000);
const origin = "http://127.0.0.1:" + port;
export default defineConfig({
  testDir: "e2e",
  workers: 2,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: origin,
    colorScheme: "dark",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port " + port,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
