import "server-only";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { serviceClient } from "./server";
export async function recordConversion(
  kind: "project_create" | "registration" | "listing_submit",
  projectSlug?: string,
) {
  if (process.env.ANALYTICS_ENABLED !== "true") return;
  try {
    const [jar, h] = await Promise.all([cookies(), headers()]);
    const visitor = jar.get("lk_visitor")?.value;
    if (
      !z.uuid().safeParse(visitor).success ||
      h.get("sec-gpc") === "1" ||
      h.get("dnt") === "1"
    )
      return;
    await serviceClient().rpc("record_usage", {
      visitor,
      kind,
      project_slug: projectSlug || null,
    });
  } catch {
    /* Measurement failures must not interrupt a successful action. */
  }
}
