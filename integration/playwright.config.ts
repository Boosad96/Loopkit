import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
const origin = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000",
);
if (origin.hostname !== "127.0.0.1")
  throw Error("A disposable loopback server is required.");
export default defineConfig({
  timeout: 90000,
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  use: {
    baseURL: origin.href,
    colorScheme: "dark",
    reducedMotion: "reduce",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  webServer: {
    env: {
      ...(process.env as Record<string, string>),
      ANONYMOUS_PROJECTS_PER_HOUR: "120",
      LOOPKIT_TEST_PROVIDER: "loopback",
      NODE_OPTIONS: "--require=" + resolve("integration/challenge-fixture.cjs"),
      TURNSTILE_SECRET_KEY: "loopback-test-only",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      BILLING_TEST_ENABLED: "true",
      RAZORPAY_KEY_ID: "rzp_test_local",
      RAZORPAY_KEY_SECRET: "local-test-only",
      RAZORPAY_WEBHOOK_SECRET: "local-webhook-only",
    },
    command:
      (process.env.INTEGRATION_DEV === "1"
        ? "npm run dev -- --webpack"
        : "npm run start --") +
      " --hostname 127.0.0.1 --port " +
      origin.port,
    cwd: process.cwd(),
    url: origin.href,
    timeout: 120000,
  },
});
