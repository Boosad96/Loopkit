import { readBounded } from "./shared.mjs";
import { site } from "./registry.mjs";

export async function analyticsSummary(env) {
  if (!env.GROWTH_ANALYTICS_KEY) return { state: "unconfigured", data: null };
  try {
    const response = await fetch(site + "/api/internal/growth-analytics", {
      headers: { authorization: "Bearer " + env.GROWTH_ANALYTICS_KEY },
      signal: AbortSignal.timeout(4500), redirect: "manual",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { state: "unavailable", data: null };
    }
    const result = JSON.parse(await readBounded(response, 32000));
    if (result.state === "disabled") return { state: "disabled", data: null };
    if (result.state !== "available" || !Number.isFinite(result.data?.visits))
      return { state: "unavailable", data: null };
    return result;
  } catch {
    return { state: "unavailable", data: null };
  }
}
