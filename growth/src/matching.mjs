import { registry } from "./registry.mjs";
import { highIntent, hour } from "./shared.mjs";

const entities = { amp: "&", lt: "<", gt: ">", apos: "'", quot: '"', nbsp: " " };
export function plain(value, max = 420) {
  return String(value ?? "").slice(0, 3500)
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|apos|quot|nbsp);/gi, (match, entity) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? match;
      const hex = /^#x/i.test(entity);
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    })
    .replace(/https?:\/\/\S+|[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, max);
}
export function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const indexed = registry.map((tool) => [tool, tool.keywords.map(normalize)]);
const request = /\b(looking for|any recommendations|can anyone|does anyone know|know of|is there|recommend(?:ations?|ed)?|suggest(?:ions?)?|need (?:a|an|to)|what (?:tool|app|site|website|can i|do you use)|how (?:can|do|should|would|to)\b|where can i)\b/i;
const seeker = /\b(looking for|recommend(?:ations?)?|suggestions?|is there|any(?:one)? know|what (?:tool|app|site|website)|need (?:a|an))\b/i;
const noise = /^(?:show hn|release|introducing|launching|i built|we built|i made|we made|announcement)\b|\b(?:feature request|regression|stack trace|pull request|pull-request)\b/i;
const unsupported = /\b(?:self[ -]hosted|open[ -]source only|double[ -]elimination|animated (?:emoji|sticker)|ranked[ -]choice|one vote per person)\b/i;
const implementation = /\b(?:python|javascript|typescript|npm|sdk|library|source code|programmatically|api endpoint)\b/i;

const contextualAdvice = {
  "discord-timestamp-generator": [
    [/\b(relative|time left|time until)\b/i, "Discord’s relative format is <t:1735689600:R>. Replace the number with the event’s Unix time in seconds. It renders relative to when someone views the message."],
    [/\b(daylight saving|dst|repeated hour)\b/i, "Enter the event’s date in its own time zone. When clocks repeat an hour, choose the intended occurrence before copying the Discord timestamp."],
  ],
  "random-team-generator": [
    [/\b(balance|balanced|skill|ratings)\b/i, "Give each player a consistent 0–100 skill rating. Enter each player as Name | rating, enable skill balancing, and inspect the resulting team totals."],
  ],
  "countdown-maker": [
    [/\b(embed|widget|iframe)\b/i, "Name the event and choose its time zone, then publish the countdown. The public project’s share controls provide an iframe for embedding it."],
  ],
  "telegram-sticker-resizer": [
    [/\b(transparent|transparency|background)\b/i, "Start with a transparent PNG or WebP. Keep the aspect ratio, resize the longest side to 512 pixels, and check that the preview retains transparency."],
  ],
};

export function matchOpportunity(candidate, now, hours = 48, allowed = null) {
  const age = now - candidate.publishedAt;
  if (!Number.isFinite(age) || age < -300000 || age > hours * hour) return null;
  const title = plain(candidate.title, 230);
  const body = plain(candidate.body);
  if (!title || noise.test(title) || unsupported.test(title + " " + body)) return null;
  const sentences = [title, ...body.split(/(?<=[.!?])\s+/)];
  const asking = sentences.filter((line) => request.test(line));
  if (!asking.length) return null;
  let best = null;
  const titleWords = " " + normalize(title) + " ";
  const allWords = titleWords + normalize(body) + " ";
  for (const [tool, terms] of indexed) {
    if (allowed && !allowed.has(tool.slug)) continue;
    const hits = terms.filter((key) => allWords.includes(" " + key + " "));
    if (!hits.length) continue;
    const inTitle = hits.some((key) => titleWords.includes(" " + key + " "));
    const context = asking.find((line) => hits.some((key) => (" " + normalize(line) + " ").includes(" " + key + " "))) ??
      (inTitle ? asking[0] : null);
    if (!context || (implementation.test(context) && tool.slug !== "discord-timestamp-generator")) continue;
    const score = Math.min(100, 48 + (inTitle ? 15 : 4) + (seeker.test(context) ? 17 : 8)
      + (age <= 24 * hour ? 9 : age <= 48 * hour ? 5 : 0) + Math.min(8, (hits.length - 1) * 4));
    if (score < 70 || score <= (best?.score ?? 0)) continue;
    const link = new URL(tool.url);
    link.search = new URLSearchParams({ utm_source: candidate.source, utm_medium: "referral", utm_campaign: "loopkit_growth" });
    const advice = contextualAdvice[tool.slug]?.find(([pattern]) => pattern.test(context))?.[1] ?? tool.advice;
    best = {
      title, problem: context.slice(0, 250), fingerprint: normalize(title),
      toolSlug: tool.slug, score, highIntent: score >= highIntent,
      draft: `${advice}\n\nDisclosure: I run LoopKit. If a browser tool fits your workflow, ${tool.name} is available here: ${link.href}`,
    };
  }
  return best?.fingerprint.length >= 12 ? best : null;
}
