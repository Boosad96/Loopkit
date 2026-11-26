import { dashboardIdentity, machineIdentity } from "./auth.mjs";
import { dashboard, dashboardAsset, dashboardPath } from "./dashboard.mjs";
import { engineStatus, latestReport, maintain, opportunityPage, review, runScan, startScan } from "./engine.mjs";
import { growthOpenApi, publicOpenApi } from "./openapi.mjs";
import { cors, publicApi } from "./public-api.mjs";
import { day, error, json, privateHeaders, takeLimit, utcDay } from "./shared.mjs";

const states = { approve: "approved", dismiss: "dismissed", archive: "archived" };
const reviewPath = /^\/opportunities\/([a-f0-9]{24})\/(approve|dismiss|archive)$/;
const userInterface = (path) => path === dashboardPath || path.startsWith(dashboardPath + "/");
const apiPrefix = "/api/growth";
const publicRoutes = new Set(["/api/v1/discord-timestamp", "/api/v1/random-teams"]);

function redirect(notice) {
  return new Response(null, { status: 303, headers: { ...privateHeaders,
    location: dashboardPath + "?notice=" + notice } });
}
function background(task, ctx, event) {
  ctx.waitUntil(task.catch(() => console.error(event)));
}
async function scan(env, ctx, trigger, now) {
  const result = await startScan(env, trigger, now);
  if (result.status === "started") {
    background(runScan(env, result).finally(() => maintain(env, Date.now())), ctx, "growth_background_failed");
    return { status: result.status, scan_id: result.id };
  }
  return result;
}

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const now = Date.now();
  if (path === "/api/v1/openapi.json" && request.method === "GET")
    return json(publicOpenApi, 200, cors);
  if (publicRoutes.has(path))
    return publicApi(request, env, url, now);
  const browser = userInterface(path);
  if (!browser && path !== apiPrefix && !path.startsWith(apiPrefix + "/")) return error("not_found", 404);
  const client = request.headers.get("CF-Connecting-IP") ?? "local";
  if (!(await env.ADMIN_RATE.limit({ key: client })).success)
    return error("rate_limit", 429, { "retry-after": "60" });
  const localPath = path.slice(browser ? dashboardPath.length : apiPrefix.length);
  const method = request.method;
  if (!["GET", "POST"].includes(method)) return error("method_not_allowed", 405, { allow: "GET, POST" });

  const nextDay = (Math.floor(now / day) + 1) * day;
  const retryTomorrow = { "retry-after": String(Math.ceil((nextDay - now) / 1000)) };
  if (browser) {
    const actor = await dashboardIdentity(request, env, now);
    if (!actor) return error("access_required", 403);
    if (method === "GET") {
      if (!localPath || localPath === "/") {
        if (!(await takeLimit(env.DB, "dashboard_views", utcDay(now), 240, nextDay + day)))
          return error("daily_quota", 429, retryTomorrow);
        return dashboard(env, url, now);
      }
      if (localPath === "/openapi.json") return json(growthOpenApi);
      return dashboardAsset(path) ?? error("not_found", 404);
    }
    if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site")
      return error("invalid_origin", 403);
    if (localPath === "/scan") return redirect((await scan(env, ctx, actor, now)).status);
    const match = localPath.match(reviewPath);
    if (!match) return error("not_found", 404);
    const outcome = await review(env.DB, match[1], states[match[2]], actor, now);
    return redirect(outcome === "ok" ? "reviewed" : outcome);
  }

  const identity = await machineIdentity(request, env);
  if (!identity) return error("invalid_credentials", 401, { "www-authenticate": 'Bearer realm="loopkit-growth"' });
  const action = localPath.match(reviewPath);
  const scope = method === "GET" ? "read" : localPath === "/scan" ? "scan" : "review";
  if (!identity.scopes.includes(scope)) return error("insufficient_scope", 403);
  if (!(await takeLimit(env.DB, identity.actor, utcDay(now), 600, nextDay + day)) ||
    !(await takeLimit(env.DB, "growth_api", utcDay(now), 1200, nextDay + day)))
    return error("daily_quota", 429, retryTomorrow);
  if (method === "GET") {
    if (localPath === "/openapi.json") return json(growthOpenApi);
    if (localPath === "/status") return json(await engineStatus(env, now));
    if (localPath === "/report") return json({ report: await latestReport(env.DB) });
    if (localPath === "/opportunities" || localPath === "/opportunities/high-intent") {
      const page = await opportunityPage(env.DB, url, localPath.endsWith("/high-intent"), now);
      return page ? json(page) : error("invalid_filter", 400);
    }
  } else {
    if (localPath === "/scan") {
      const result = await scan(env, ctx, identity.actor, now);
      if (result.status === "quota") return error("manual_scan_quota", 429, retryTomorrow);
      return json(result, result.status === "started" ? 202 : 409);
    }
    if (action) {
      const state = states[action[2]];
      const outcome = await review(env.DB, action[1], state, identity.actor, now);
      return outcome === "ok" ? json({ id: action[1], status: state }) :
        error(outcome === "missing" ? "opportunity_not_found" : "review_conflict", outcome === "missing" ? 404 : 409);
    }
  }
  return error("not_found", 404);
}

const worker = {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch {
      console.error("growth_request_failed");
      return error("service_unavailable", 503, publicRoutes.has(new URL(request.url).pathname) ? cors : undefined);
    }
  },
  scheduled(controller, env, ctx) {
    const now = Date.now();
    background((async () => {
      try {
        const result = await startScan(env, "cron", now);
        if (result.status === "started") await runScan(env, result);
      } finally {
        await maintain(env, Date.now());
      }
    })(), ctx, "growth_scheduled_failed");
  },
};

export default worker;
