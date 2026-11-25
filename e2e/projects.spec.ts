import { test, expect } from "@playwright/test";

test("event hub orders enabled sections, exports a calendar and describes unavailable publishing", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByLabel("Title", { exact: true }).fill("Autumn Invitational");
  await page.getByLabel("Organizer", { exact: true }).fill("Indie Games Club");
  await page.getByLabel("Add a section").selectOption("Announcements");
  await page
    .getByLabel("Announcements · one per line")
    .fill("Doors open at 16:00.");
  await expect(page.locator(".project-preview")).toContainText(
    "Autumn Invitational",
  );
  await expect(page.locator(".project-preview")).toContainText(
    "Doors open at 16:00.",
  );
  await page
    .getByRole("button", { name: "Move Announcements up", exact: true })
    .click();
  const sections = page.locator(".project-preview .pj-section h3");
  await expect(sections.nth(2)).toHaveText("Announcements");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  expect((await downloaded).suggestedFilename()).toBe("event.ics");
  await page.getByRole("button", { name: "Create share link" }).click();
  await expect(page.locator(".pj-message")).toContainText(
    /Supabase|verification|abuse protection|temporarily unavailable/,
  );
});
test("scores advance bracket winners and rankings export CSV", async ({
  page,
}) => {
  await page.goto("/tools/tournament-bracket-maker");
  const match = page.locator(".pj-score").first();
  await match.locator("input").nth(0).fill("2");
  await match.locator("input").nth(1).fill("0");
  await match.getByRole("button", { name: "Record score" }).click();
  await expect(page.locator(".pj-bracket section").last()).toContainText(
    "Team 1",
  );
  await page.goto("/tools/leaderboard-maker");
  await page.getByLabel("Player 1", { exact: true }).fill("Atlas");
  await page.getByRole("button", { name: "Add player" }).click();
  await page.getByLabel("Score for Player 2").fill("5");
  await expect(page.locator(".pj-board li").first()).toContainText("Player 2");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect((await downloaded).suggestedFilename()).toBe("leaderboard.csv");
});
test("timezone editor rejects a DST gap and goal tracker reflects live progress", async ({
  page,
}) => {
  await page.goto("/tools/countdown-maker");
  await page
    .getByRole("combobox", { name: "Timezone", exact: true })
    .selectOption("America/New_York");
  await page.getByLabel("Date and time").fill("2026-03-08T02:30");
  await expect(page.locator(".project-controls [role=alert]")).toContainText(
    "ambiguous",
  );
  await page.getByLabel("Date and time").fill("2026-03-08T03:30");
  await expect(page.locator(".project-controls [role=alert]")).toHaveCount(0);
  await page.goto("/tools/goal-tracker");
  await page.getByLabel("Current progress").fill("32");
  await expect(page.locator(".project-preview progress")).toHaveAttribute(
    "value",
    "32",
  );
});
