import { readLimited } from "@/lib/billing/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { serviceClient } from "@/lib/account/server";
const input = z
  .object({
    event: z.enum([
      "page_view",
      "tool_view",
      "tool_start",
      "tool_complete",
      "share",
      "shared_visit",
      "remix",
    ]),
    slug: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
  })
  .strict();
export async function POST(req: Request) {
  const empty = () =>
    new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  if (
    process.env.ANALYTICS_ENABLED !== "true" ||
    req.headers.get("sec-gpc") === "1" ||
    req.headers.get("dnt") === "1"
  )
    return empty();
  if (
    req.headers.get("origin") !== new URL(req.url).origin &&
    req.headers.get("origin") !== process.env.NEXT_PUBLIC_SITE_URL
  )
    return new Response(null, { status: 403 });
  const cookie = (await cookies()).get("lk_visitor")?.value;
  if (!z.uuid().safeParse(cookie).success) return empty();
  if (Number(req.headers.get("content-length") || 0) > 512)
    return new Response(null, { status: 413 });
  let text;
  try {
    text = await readLimited(req, 512);
  } catch {
    return new Response(null, { status: 413 });
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = input.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  const db = serviceClient();
  const quota = await db.rpc("project_take_limit", {
    p_bucket: "analytics-ingestion",
    p_seconds: 60,
    p_max: Math.min(
      5000,
      Math.max(1, Number(process.env.ANALYTICS_EVENTS_PER_MINUTE) || 240),
    ),
  });
  if (quota.error || !quota.data)
    return new Response(null, { status: quota.error ? 503 : 429 });
  const { error } = await db.rpc("record_usage", {
    visitor: cookie,
    kind: parsed.data.event,
    project_slug: parsed.data.slug || null,
  });
  return error ? new Response(null, { status: 503 }) : empty();
}
