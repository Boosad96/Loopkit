import { createHash, timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/account/server";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const digest = (value: string) => createHash("sha256").update(value).digest();
export async function GET(request: Request) {
  const secret = process.env.GROWTH_ANALYTICS_KEY;
  const authorization = request.headers.get("authorization");
  if (
    !secret ||
    secret.length < 43 ||
    !authorization ||
    authorization.length > 160 ||
    !timingSafeEqual(digest(authorization), digest("Bearer " + secret))
  ) {
    return Response.json({ error: "not_found" }, { status: 404, headers });
  }
  if (
    process.env.ANALYTICS_ENABLED !== "true" ||
    process.env.GROWTH_ATTRIBUTION_ENABLED !== "true"
  )
    return Response.json({ state: "disabled", data: null }, { headers });
  try {
    const { data, error } = await serviceClient().rpc(
      "growth_attribution_summary",
    );
    if (!error && data)
      return Response.json({ state: "available", data }, { headers });
  } catch {
    /* Omit database internals from the response. */
  }
  return Response.json(
    { error: "analytics_unavailable" },
    { status: 503, headers },
  );
}
