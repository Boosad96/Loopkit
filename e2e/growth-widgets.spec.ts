import { createServer } from "node:http";
import { once } from "node:events";
import { expect, test } from "@playwright/test";

test("browser-only tool has copyable embed code and the widget runs without the main site shell", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/tools/random-team-generator");
  await page.getByText("Share or embed this tool").click();
  const code = page.getByRole("textbox", { name: "Embed code" });
  await expect(code).toHaveValue(/\/embed\/tool\/random-team-generator"/);
  await page
    .getByRole("checkbox", { name: /Include Made with LoopKit/ })
    .check();
  await expect(code).toHaveValue(
    /\/embed\/tool\/random-team-generator\?attribution=1"/,
  );
  const widget = await page.goto(
    "/embed/tool/random-team-generator?attribution=1",
  );
  expect(widget?.headers()["content-security-policy"]).toContain(
    "frame-ancestors https:",
  );
  expect(widget?.headers()["x-frame-options"]).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Random Team Generator", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Made with LoopKit" }),
  ).toHaveAttribute("href", /utm_campaign=loopkit_widget/);
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toHaveCount(0);
  const host = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end(
      `<!doctype html><iframe title="LoopKit tool" src="${baseURL}/embed/tool/random-team-generator" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe>`,
    );
  });
  host.listen(0, "127.0.0.1");
  try {
    await once(host, "listening");
    const endpoint = host.address();
    if (!endpoint || typeof endpoint === "string")
      throw Error("Could not start widget test host");
    await page.goto("http://localhost:" + endpoint.port);
    const frame = page.frameLocator('iframe[title="LoopKit tool"]');
    await frame
      .getByRole("textbox", { name: /players/i })
      .fill("Alex\nBlair\nCasey\nDevin");
    await frame.getByRole("button", { name: /generate/i }).click();
    await expect(frame.getByText("Team 1", { exact: true })).toBeVisible();
  } finally {
    host.close();
  }
  await page.goto("/embed/tool/random-team-generator");
  await expect(
    page.getByRole("link", { name: "Made with LoopKit" }),
  ).toHaveCount(0);
  await page.goto("/embed/tool/poll-maker");
  await expect(
    page.getByRole("heading", { name: "Page unavailable" }),
  ).toBeVisible();
  expect((await request.get("/api/internal/growth-analytics")).status()).toBe(
    404,
  );
});
