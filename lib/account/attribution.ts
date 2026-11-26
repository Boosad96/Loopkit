import { tools } from "@/lib/tools";

export const toolSlugs = tools.map((tool) => tool.slug);
const publicPages = [
  "/",
  "/about",
  "/tools",
  "/create",
  "/pricing",
  "/promote",
  "/contact",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/refund-policy",
  "/cookie-policy",
  "/discover",
  "/discover/discord-servers",
  "/discover/telegram-bots",
  "/discover/telegram-channels",
  "/resources",
  "/blog",
  "/s/:project",
  "/community/:listing",
  "/blog/:guide",
  "/resources/:guide",
  "/other",
];
export const campaignSources = [
  "hn",
  "stack",
  "github",
  "bluesky",
  "rss",
  "widget",
] as const;
export const trafficChannels = [
  "direct",
  "organic",
  "referral",
  "campaign",
] as const;
export const campaigns = ["loopkit_growth", "loopkit_widget"] as const;
export type Attribution = {
  session: string;
  landing: string;
  channel: (typeof trafficChannels)[number];
  campaign?: (typeof campaigns)[number];
  source?: (typeof campaignSources)[number];
  tool?: string;
};

export function validCampaign({
  channel,
  campaign,
  source,
}: Pick<Attribution, "channel" | "campaign" | "source">) {
  if (channel !== "campaign") return !campaign && !source;
  return campaign === "loopkit_widget"
    ? source === "widget"
    : campaign === "loopkit_growth" && Boolean(source && source !== "widget");
}

export function validLanding(path: string) {
  return (
    publicPages.includes(path) ||
    (path.startsWith("/tools/") && toolSlugs.includes(path.slice(7)))
  );
}
type Session = Omit<Attribution, "tool"> & { lastSeen: number };

function safeLanding(path: string) {
  if (validLanding(path)) return path;
  for (const [prefix, label] of [
    ["/s/", "project"],
    ["/community/", "listing"],
    ["/blog/", "guide"],
    ["/resources/", "guide"],
  ]) {
    if (path.startsWith(prefix)) return prefix + ":" + label;
  }
  return "/other";
}
function sourceOf(
  url: URL,
  referrer: string,
): Pick<Attribution, "channel" | "campaign" | "source"> {
  const campaign = url.searchParams.get("utm_campaign");
  const source = campaignSources.find(
    (name) => name === url.searchParams.get("utm_source"),
  );
  const supported = campaigns.find((name) => name === campaign);
  const tagged = { channel: "campaign", campaign: supported, source } as const;
  if (
    url.searchParams.get("utm_medium") === "referral" &&
    validCampaign(tagged)
  )
    return tagged;
  try {
    const previous = new URL(referrer);
    if (
      previous.origin === url.origin ||
      !["https:", "http:"].includes(previous.protocol)
    )
      return { channel: "direct" };
    if (
      /(^|\.)(?:google\.(?:com|co\.[a-z]{2}|[a-z]{2}|com\.[a-z]{2})|bing\.com|duckduckgo\.com|search\.yahoo\.com|search\.brave\.com|ecosia\.org|baidu\.com|yandex\.(?:com|ru))$/.test(
        previous.hostname,
      )
    )
      return { channel: "organic" };
    return { channel: "referral" };
  } catch {
    return { channel: "direct" };
  }
}

const storageKey = "loopkit.analytics.session";
export function clearAttribution() {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* Optional storage. */
  }
}

export function sessionAttribution(
  url: URL,
  referrer: string,
  now = Date.now(),
  toolHint?: string,
): Attribution | undefined {
  try {
    const entry: Session | null = JSON.parse(
      sessionStorage.getItem(storageKey) || "null",
    );
    const { lastSeen, ...previous } = entry ?? { lastSeen: 0 };
    const incoming = sourceOf(url, referrer);
    const changedCampaign =
      incoming.campaign &&
      (incoming.campaign !== entry?.campaign ||
        incoming.source !== entry?.source);
    const valid =
      entry &&
      !changedCampaign &&
      lastSeen > now - 1800000 &&
      typeof entry.session === "string" &&
      typeof entry.landing === "string" &&
      validLanding(entry.landing) &&
      trafficChannels.includes(entry.channel) &&
      (!entry.source || campaignSources.includes(entry.source)) &&
      validCampaign(entry);
    const session = valid
      ? (previous as Omit<Attribution, "tool">)
      : {
          session: crypto.randomUUID(),
          landing: safeLanding(url.pathname),
          ...incoming,
        };
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ ...session, lastSeen: now }),
    );
    const tool =
      toolHint ||
      (url.pathname.startsWith("/tools/") ? url.pathname.slice(7) : "");
    return { ...session, ...(toolSlugs.includes(tool) ? { tool } : {}) };
  } catch {
    return undefined;
  }
}
