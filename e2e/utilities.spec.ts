import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";

async function visit(page: Page, slug: string) {
  await page.goto("/tools/" + slug);
  await expect(page.locator(".lk-utility")).toBeVisible();
}
async function imageFile(page: Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 20;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#a3e635";
    ctx.fillRect(0, 0, 20, 20);
    return c.toDataURL().split(",")[1];
  });
  return {
    name: "token.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  };
}
test("generate balanced teams, configuration link and text export", async ({
  page,
}) => {
  await visit(page, "random-team-generator");
  await page.getByLabel("Balance by skill").check();
  await page
    .getByLabel("Players, one per line")
    .fill("Alpha | 90\nBravo | 80\nCharlie | 20\nDelta | 10");
  await page.getByRole("button", { name: "Generate teams" }).click();
  await expect(page.locator(".lk-team-grid article")).toHaveCount(2);
  await expect(page.locator(".lk-team-grid article").first()).toContainText(
    "Delta",
  );
  const download = page.waitForEvent("download");
  await page.getByText("Export TXT", { exact: true }).click();
  expect((await download).suggestedFilename()).toBe("teams.txt");
  await page.getByText("Share configuration", { exact: true }).click();
  await page.getByText("Create configuration link", { exact: true }).click();
  const url = new URL(
    await page.getByLabel("Share link", { exact: true }).inputValue(),
  );
  expect(url.search).toBe("");
  expect(url.hash).toContain("Alpha");
  await expect(page.getByAltText("Configuration QR code")).toBeVisible();
  await page.goto(url.href);
  await page.reload();
  await expect(page.getByLabel("Players, one per line")).toHaveValue(/Alpha/);
});
test("wheel picks one entry, removes it and honors reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await visit(page, "spin-wheel");
  await page.getByLabel("Entries, one per line").fill("Ruby\nLime\nBlue");
  await page.getByLabel("Remove each winner").check();
  await page.getByRole("button", { name: "Spin wheel" }).click();
  await expect(page.getByText(/^Winner: /)).toBeVisible();
  expect(
    (await page.getByLabel("Entries, one per line").inputValue()).split("\n"),
  ).toHaveLength(2);
});
test("timestamps support DST ambiguity and all Discord formats", async ({
  page,
}) => {
  await visit(page, "discord-timestamp-generator");
  await page.getByLabel("Event time zone").selectOption("America/New_York");
  await page.getByLabel("Event date and time").fill("2026-11-01T01:30");
  await page.getByLabel("Repeated clock time").selectOption("later");
  const unix = Date.parse("2026-11-01T06:30:00Z") / 1000;
  await expect(page.locator(".lk-result-row")).toHaveCount(9);
  await expect(
    page
      .locator(".lk-result-row code")
      .filter({ hasText: new RegExp("^<t:" + unix + ":S>$") }),
  ).toHaveCount(1);
  await page.getByLabel("Event date and time").fill("2026-03-08T02:30");
  await expect(page.getByText(/select a valid local time/i)).toBeVisible();
});
test("rules templates can be edited, reordered and downloaded", async ({
  page,
}) => {
  await visit(page, "community-rules-generator");
  await page
    .getByRole("combobox", { name: "Template", exact: true })
    .selectOption("Telegram");
  await page
    .getByRole("textbox", { name: "Rule 2", exact: true })
    .fill("Welcome new members.");
  await page
    .getByRole("button", { name: "Move up", exact: true })
    .nth(1)
    .click();
  await expect(
    page.getByRole("textbox", { name: "Rule 1", exact: true }),
  ).toHaveValue("Welcome new members.");
  const download = page.waitForEvent("download");
  await page.getByText("Export TXT", { exact: true }).click();
  const contents = await fs.readFile(await (await download).path(), "utf8");
  expect(contents).toContain("1. Welcome new members.");
});
for (const [slug, platform, expected] of [
  ["discord-emoji-resizer", "emoji", "128 × 128"],
  ["telegram-sticker-resizer", "sticker", "512 × 256"],
]) {
  test(
    platform + " converts local images and exports valid files",
    async ({ page }) => {
      await visit(page, slug);
      await page
        .getByLabel("Source image")
        .setInputFiles(await imageFile(page));
      await expect(page.getByText(new RegExp(expected)).first()).toBeVisible();
      await page.getByLabel("Output format").selectOption("image/webp");
      await expect(page.getByLabel("Quality")).toBeVisible();
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download image" }).click();
      const file = await download;
      expect(file.suggestedFilename()).toBe(platform + ".webp");
      const bytes = await fs.readFile(await file.path());
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
    },
  );
}
test("create a gaming profile with a local avatar and export the preview", async ({
  page,
}) => {
  await visit(page, "gaming-profile-card-maker");
  await page.getByLabel("Username", { exact: true }).fill("Nimbus");
  await page.getByLabel("Avatar").setInputFiles(await imageFile(page));
  await page.getByLabel("Favorite game").fill("Arena");
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("Ice");
  await expect(page.getByLabel("Gaming profile for Nimbus")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download profile PNG" }).click();
  const bytes = await fs.readFile(await (await download).path());
  expect(bytes.readUInt32BE(16)).toBe(960);
  expect(bytes.readUInt32BE(20)).toBe(520);
});
test("tier list can be edited by keyboard, saved locally and exported", async ({
  page,
}) => {
  await visit(page, "tier-list-maker");
  await page
    .getByLabel("Add local images")
    .setInputFiles(await imageFile(page));
  await page.getByLabel("Tier for token.png").selectOption("0");
  await page.getByLabel("Tier 1 name").fill("Elite");
  await page.getByRole("button", { name: "Save on device" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open saved list" }).click();
  await expect(page.getByLabel("Tier 1 name")).toHaveValue("Elite");
  await expect(page.getByLabel("Tier for token.png")).toHaveValue("0");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export tier list PNG" }).click();
  expect((await download).suggestedFilename()).toBe("tier-list.png");
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== "passed") return;
  const slug = new URL(page.url()).pathname.split("/").pop();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "qa/tool-" + slug + ".png",
    fullPage: true,
    animations: "disabled",
  });
});
