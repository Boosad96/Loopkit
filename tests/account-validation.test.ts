import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAttribution,
  sessionAttribution,
} from "../lib/account/attribution";
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

describe("consented traffic attribution", () => {
  afterEach(() => vi.unstubAllGlobals());

  function mockSessionStorage() {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  }

  it("preserves campaign attribution during tool navigation and resets on withdrawal", () => {
    mockSessionStorage();
    const campaign = sessionAttribution(
      new URL(
        "https://loopkit.site/tools/spin-wheel?utm_source=hn&utm_medium=referral&utm_campaign=loopkit_growth",
      ),
      "",
      1_000_000,
    );
    expect(campaign).toMatchObject({
      landing: "/tools/spin-wheel",
      channel: "campaign",
      campaign: "loopkit_growth",
      source: "hn",
      tool: "spin-wheel",
    });
    const next = sessionAttribution(
      new URL("https://loopkit.site/create"),
      "",
      1_001_000,
      "poll-maker",
    );
    expect(next).toMatchObject({
      session: campaign?.session,
      source: "hn",
      tool: "poll-maker",
    });
    clearAttribution();
    const newSession = sessionAttribution(
      new URL("https://loopkit.site/create"),
      "",
      1_002_000,
    );
    expect(newSession?.session).not.toBe(campaign?.session);
    expect(newSession?.channel).toBe("direct");
  });

  it("groups private-looking URL segments and ignores unsupported UTM values", () => {
    mockSessionStorage();
    const result = sessionAttribution(
      new URL(
        "https://loopkit.site/s/private-title?utm_campaign=email-address@example.com&utm_source=example",
      ),
      "https://www.google.co.uk/search?q=some-query",
      1_000_000,
    );
    expect(result).toMatchObject({
      channel: "organic",
      landing: "/s/:project",
    });
    expect(result).not.toHaveProperty("campaign");
    expect(result).not.toHaveProperty("source");
    const fresh = sessionAttribution(
      new URL("https://loopkit.site/tools"),
      "https://different.example/",
      2_800_001,
    );
    expect(fresh?.session).not.toBe(result?.session);
    expect(fresh?.channel).toBe("referral");
  });
});
