import { z } from "zod";

export const categories = [
  "Gaming",
  "Esports",
  "Development",
  "Education",
  "Creative",
  "Social",
  "Business",
  "Other",
] as const;
export const platforms = [
  "discord",
  "telegram-channel",
  "telegram-bot",
] as const;
export const directoryPlatform = {
  "discord-servers": "discord",
  "telegram-channels": "telegram-channel",
  "telegram-bots": "telegram-bot",
} as const;
export const platformNames = {
  discord: "Discord server",
  "telegram-channel": "Telegram channel",
  "telegram-bot": "Telegram bot",
} as const;
export type Platform = (typeof platforms)[number];
export function validCommunityLink(platform: Platform, input: string) {
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return false;
    if (platform === "discord") {
      return (
        (url.hostname === "discord.gg" &&
          /^\/[a-z0-9-]{2,80}\/?$/i.test(url.pathname)) ||
        (url.hostname === "discord.com" &&
          /^\/invite\/[a-z0-9-]{2,80}\/?$/i.test(url.pathname))
      );
    }
    if (
      url.hostname !== "t.me" ||
      !/^\/[a-z][a-z0-9_]{3,31}\/?$/i.test(url.pathname)
    )
      return false;
    return platform !== "telegram-bot" || /bot\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}
export const listingInput = z
  .object({
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().min(30).max(1800),
    platform: z.enum(platforms),
    category: z.enum(categories),
    language: z.string().trim().min(2).max(40),
    link: z.string().trim().max(250),
    tags: z.array(z.string().trim().min(1).max(24)).max(6),
  })
  .refine(
    (x) => validCommunityLink(x.platform, x.link),
    "Use a public invitation or channel link for the selected platform.",
  );
export function safeNext(input: string | null) {
  return input === "/auth/reset" ? input : "/dashboard";
}
export function escapedSearch(s: string) {
  return s
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, "\\$&");
}
