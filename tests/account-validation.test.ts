import { describe, expect, it } from "vitest";
import {
  validCommunityLink,
  safeNext,
  escapedSearch,
  listingInput,
} from "../lib/account/validation";
describe("directory validation", () => {
  it.each([
    "https://evil.invalid/discord.gg/x",
    "https://discord.gg@evil.invalid/good",
    "https://discord.gg:8443/good",
    "javascript:alert(1)",
    "http://discord.gg/good",
    "https://discord.gg/good?next=x",
    "https://discord.gg/good/extra",
  ])("rejects unsafe link %s", (link) =>
    expect(validCommunityLink("discord", link)).toBe(false),
  );
  it("restricts telegram bots to bot handles", () => {
    expect(validCommunityLink("telegram-bot", "https://t.me/example_bot")).toBe(
      true,
    );
    expect(validCommunityLink("telegram-bot", "https://t.me/newsroom")).toBe(
      false,
    );
  });
  it("rejects missing descriptions and oversize tags", () =>
    expect(
      listingInput.safeParse({
        name: "News",
        description: "short",
        link: "https://t.me/validname",
        platform: "telegram-channel",
        category: "Social",
        language: "en",
        tags: ["a".repeat(55)],
      }).success,
    ).toBe(false));
  it("disallows external OAuth redirect targets", () => {
    expect(safeNext("//outside.example")).toBe("/dashboard");
    expect(safeNext("/auth/reset")).toBe("/auth/reset");
  });
  it("escapes wildcard characters in directory search", () =>
    expect(escapedSearch("  10%_ ")).toBe("10\\%\\_"));
});
