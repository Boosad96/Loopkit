import { analyticsSummary } from "./analytics.mjs";
import { matchOpportunity } from "./matching.mjs";
import { registry, site } from "./registry.mjs";
import { day, highIntent, hour, integer, iso, readBounded, sha256, takeLimit, utcDay } from "./shared.mjs";
import { parseSource, sourceRequest, sources } from "./sources.mjs";

const retention = 30 * day;
const schedule = 15 * 60000;
const reportInterval = 12 * hour;
const leaseTime = 60000;
const recent = (now) => now - 48 * hour;
const discoveryEnabled = (env) => env.DISCOVERY_ENABLED === undefined || env.DISCOVERY_ENABLED === "true";

function countQuery(db, now) {
  return db.prepare(`SELECT total,pending,(SELECT count(*) FROM opportunities
    WHERE status='new' AND published_at>=? AND score>=?) AS high_intent
    FROM opportunity_totals WHERE id=1`).bind(recent(now), highIntent);
}

export async function opportunityPage(db, url, highOnly, now, defaultSize = 20) {
  const limit = integer(url.searchParams.get("limit"), defaultSize, 1, 50);
  const filter = url.searchParams.get("status") ?? (highOnly ? "new" : "all");
  if (!["all", "new", "approved", "dismissed", "archived"].includes(filter)) return null;
  const cursor = url.searchParams.get("cursor");
  const after = cursor?.match(/^(\d{13}):([a-f0-9]{24})$/);
  if (cursor !== null && !after) return null;
  const where = [], parameters = [];
  if (highOnly) {
    where.push("score>=? AND published_at>=?");
    parameters.push(highIntent, recent(now));
  }
  if (filter !== "all") {
    where.push("status=?");
    parameters.push(filter);
  }
  if (after) {
    where.push("(published_at,id)<(?,?)");
    parameters.push(Number(after[1]), after[2]);
  }
  const { results } = await db.prepare(`SELECT id,source,original_url,title,problem,tool_slug,score,draft,
    published_at,discovered_at,status,reviewed_at FROM opportunities
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY published_at DESC,id DESC LIMIT ?`).bind(...parameters, limit + 1).all();
  const next = results.length > limit;
  const items = results.slice(0, limit).map((item) => ({ ...item,
    published_at: iso(item.published_at), discovered_at: iso(item.discovered_at), reviewed_at: iso(item.reviewed_at),
    high_intent: item.score >= highIntent, tool: registry.find((tool) => tool.slug === item.tool_slug)?.name || item.tool_slug,
  }));
  return { items, next_cursor: next ? results[limit - 1].published_at + ":" + results[limit - 1].id : null };
}

export async function review(db, id, state, actor, now) {
  const transitions = { approved: ["new"], dismissed: ["new", "approved"], archived: ["new", "approved", "dismissed"] };
  const allowed = transitions[state];
  const result = await db.prepare(`UPDATE opportunities SET status=?,reviewed_by=?,reviewed_at=?
    WHERE id=? AND status IN (${allowed.map(() => "?").join(",")}) RETURNING status`)
    .bind(state, actor, now, id, ...allowed).first();
  if (result) return "ok";
  const previous = await db.prepare("SELECT status FROM opportunities WHERE id=?").bind(id).first();
  return previous?.status === state ? "ok" : previous ? "conflict" : "missing";
}

function sourceQuota(env, source) {
  return integer(env[source.id.toUpperCase() + "_DAILY_LIMIT"], source.quota, 0, source.quota);
}

export async function engineStatus(env, now) {
  const [state, last, ok, health, usage, total] = (await env.DB.batch([
    env.DB.prepare("SELECT launched_at,lease_until,manual_day,manual_count FROM engine WHERE id=1"),
    env.DB.prepare("SELECT * FROM scans ORDER BY started_at DESC LIMIT 1"),
    env.DB.prepare("SELECT finished_at FROM scans WHERE state IN ('success','partial') ORDER BY finished_at DESC LIMIT 1"),
    env.DB.prepare("SELECT * FROM source_health"),
    env.DB.prepare("SELECT bucket,count FROM limits WHERE window=? AND bucket LIKE 'source:%'").bind(utcDay(now)),
    countQuery(env.DB, now),
  ])).map((result) => result.results);
  const active = state[0];
  return {
    automation_enabled: discoveryEnabled(env),
    interval_minutes: 15,
    running: active.lease_until > now,
    launched_at: iso(active.launched_at),
    launch_mode: Boolean(active.launched_at && now - active.launched_at < 48 * hour),
    last_successful_scan: iso(ok[0]?.finished_at),
    last_scan: last[0] ? { ...last[0], started_at: iso(last[0].started_at), finished_at: iso(last[0].finished_at) } : null,
    counts: total[0],
    manual_scans: { used: active.manual_day === utcDay(now) ? active.manual_count : 0, limit: 8 },
    sources: sources(env).map((source) => {
      const row = health.find((entry) => entry.source === source.id);
      const limit = sourceQuota(env, source);
      const enabled = source.enabled && limit > 0;
      return { id: source.id, name: source.label, enabled,
        state: !enabled ? "disabled" : row?.state || "pending",
        checked_at: iso(row?.checked_at), error: row?.message ?? null, cooldown_until: iso(row?.cooldown_until),
        requests_today: usage.find((entry) => entry.bucket === "source:" + source.id)?.count ?? 0,
        daily_limit: limit, upstream_remaining: row?.remaining ?? null,
      };
    }),
  };
}

function jobs(env) {
  const available = sources(env).filter((source) => source.enabled && sourceQuota(env, source) > 0);
  const ordered = [...registry].sort((a, b) => Number(b.slug === "discord-timestamp-generator") - Number(a.slug === "discord-timestamp-generator"));
  return ordered.flatMap((tool, index) => available
    .filter((source) => source.id !== "rss" || index % 4 === 3)
    .map((source) => ({ source, tool })));
}

let catalogCache;
async function availableTools() {
  const now = Date.now();
  if (catalogCache?.until > now) return catalogCache.tools;
  let response;
  try {
    response = await fetch(site + "/sitemap.xml", {
      redirect: "error", signal: AbortSignal.timeout(3500),
      cf: { cacheTtl: 300, cacheEverything: true },
    });
  } catch {
    throw Error("catalog_unreachable");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw Error("catalog_http_" + response.status);
  }
  const sitemap = await readBounded(response, 26000);
  if (!sitemap.includes("<urlset")) throw Error("catalog_invalid");
  const tools = new Set(registry.filter((tool) => sitemap.includes("<loc>" + tool.url + "</loc>") ||
    sitemap.includes("<loc>https://www.loopkit.site/tools/" + tool.slug + "</loc>")).map((tool) => tool.slug));
  catalogCache = { until: now + 5 * 60000, tools };
  return tools;
}

export async function startScan(env, trigger, now) {
  if (!discoveryEnabled(env) || !jobs(env).length) return { status: "disabled" };
  const today = utcDay(now);
  const id = crypto.randomUUID();
  const manual = trigger !== "cron";
  const row = await env.DB.prepare(`UPDATE engine SET lease_owner=?, lease_until=?,
    launched_at=coalesce(launched_at,?), next_job=next_job+1,
    manual_count=CASE WHEN ? THEN CASE WHEN manual_day=? THEN manual_count+1 ELSE 1 END ELSE manual_count END,
    manual_day=CASE WHEN ? THEN ? ELSE manual_day END
    WHERE id=1 AND lease_until<=? AND (NOT ? OR coalesce(manual_day,'')<>? OR manual_count<8)
    RETURNING next_job,launched_at`)
    .bind(id, now + leaseTime, now, +manual, today, +manual, today, now, +manual, today).first();
  if (!row) {
    const current = await env.DB.prepare("SELECT lease_until FROM engine WHERE id=1").first();
    return { status: current.lease_until > now ? "busy" : "quota" };
  }
  return { status: "started", id, jobIndex: row.next_job - 1, launchedAt: row.launched_at, trigger, now };
}

async function fetchSource(env, source, term, since, cache, now) {
  const [url, headers] = sourceRequest(source.id, term, since, cache?.next_page, env);
  if (cache?.etag && !cache.next_page) headers["if-none-match"] = cache.etag;
  for (let attempt = 0; attempt < 2; attempt++) {
    const permitted = await takeLimit(env.DB, "source:" + source.id, utcDay(now), sourceQuota(env, source), now + 2 * day);
    if (!permitted) return { state: "quota", message: "Daily request quota reached" };
    let response;
    let failure = "request_failed";
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(3500), redirect: "error" });
      const retry = response.headers.get("retry-after");
      const reset = response.headers.get("x-ratelimit-reset");
      const left = response.headers.get("x-ratelimit-remaining");
      const remaining = left !== null && /^\d+$/.test(left) ? Number(left) : null;
      if (response.status === 304) return { state: "cached", items: [], next: null, etag: cache?.etag, remaining };
      if (response.ok) {
        const result = parseSource(source.id, await readBounded(response, 120000), cache?.next_page);
        const upstream = result.remaining ?? remaining;
        return { ...result, state: "healthy", etag: response.headers.get("etag")?.slice(0, 160),
          remaining: upstream,
          cooldown: Math.max(result.backoff ? now + Math.min(86400, result.backoff) * 1000 : 0,
            upstream === 0 ? (reset && Number(reset) * 1000 > now ? Number(reset) * 1000 : now + hour) : 0),
        };
      }
      await response.body?.cancel();
      if (response.status === 429 || (response.status === 403 && (remaining === 0 || retry))) {
        const until = retry && (/^\d+$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry));
        return { state: "backoff", message: "Upstream HTTP " + response.status, remaining,
          cooldown: Math.min(now + day, Math.max(now + 60000, until || Number(reset) * 1000 || now + schedule)) };
      }
      failure = "upstream_http_" + response.status;
      if (response.status < 500) {
        return { state: "error", message: failure,
          cooldown: [401, 403].includes(response.status) ? now + 12 * hour : 0 };
      }
    } catch (error) {
      if (response?.ok && error.name !== "TimeoutError") return { state: "error", message: "Invalid or oversized upstream response" };
    }
    if (attempt === 1) return { state: "error", message: failure, cooldown: now + 60000 };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export async function runScan(env, scan) {
  const { id, trigger, jobIndex, launchedAt, now } = scan;
  const { source, tool } = jobs(env)[jobIndex % jobs(env).length];
  const db = env.DB;
  let state = "error", message = null, found = 0, inserted = 0;
  try {
    await db.batch([
      db.prepare("UPDATE scans SET state='error',finished_at=?,message='Scan timed out' WHERE state='running' AND started_at<=?").bind(now, now - leaseTime),
      db.prepare("INSERT INTO scans(id,started_at,state,trigger,source) VALUES(?,?,'running',?,?)").bind(id, now, trigger, source.id),
    ]);
    const health = await db.prepare("SELECT cooldown_until FROM source_health WHERE source=?").bind(source.id).first();
    if (health?.cooldown_until > now) {
      state = "skipped";
      message = "Source cooldown active";
      return;
    }
    const allowed = await availableTools();
    if (!allowed.size || (source.id !== "rss" && !allowed.has(tool.slug))) {
      state = "skipped";
      message = "No eligible catalog entry for this search";
      return;
    }
    const hours = now - launchedAt < 48 * hour ? 48 : integer(env.LOOKBACK_HOURS, 48, 24, 72);
    const term = tool.keywords[Math.floor(jobIndex / jobs(env).length) % tool.keywords.length];
    const key = source.id === "rss" ? "rss" : source.id + ":" + term;
    const cache = await db.prepare("SELECT etag,checked_at,next_page FROM search_cache WHERE key=?").bind(key).first();
    if (cache?.checked_at > now - 5 * 60000) {
      state = "skipped";
      message = "Search cache is fresh";
      return;
    }
    const since = now - hours * hour;
    let result = await fetchSource(env, source, term, since, cache, now);
    let partial = false;
    if (result.items && result.next && !result.cooldown) {
      const page = await fetchSource(env, source, term, since, { next_page: result.next }, now);
      partial = !page.items;
      result = {
        ...result, ...page, items: [...result.items, ...(page.items || [])],
        etag: result.etag, next: partial ? result.next : null,
      };
    }
    message = result.message || null;
    const operations = [db.prepare(`INSERT INTO source_health(source,checked_at,state,message,cooldown_until,remaining)
      VALUES(?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET checked_at=excluded.checked_at,state=excluded.state,
      message=excluded.message,cooldown_until=excluded.cooldown_until,remaining=excluded.remaining`)
      .bind(source.id, now, result.state, message, result.cooldown || 0, result.remaining ?? null)];
    if (result.items) {
      operations.push(db.prepare(`INSERT INTO search_cache(key,etag,checked_at,next_page) VALUES(?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET etag=excluded.etag,checked_at=excluded.checked_at,next_page=excluded.next_page`)
        .bind(key, cache?.next_page ? null : result.etag ?? null, now, result.next ?? null));
      const seen = new Set();
      const matches = [];
      for (const candidate of result.items) {
        if (!candidate.url || seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        const match = matchOpportunity({ ...candidate, source: source.id }, now, hours, allowed);
        if (match) matches.push({ ...match, ...candidate, title: match.title });
      }
      found = matches.length;
      // Limit stored rows per scan even when an upstream query is unusually broad.
      for (const match of matches.sort((a, b) => b.score - a.score).slice(0, 8)) {
        const hash = await sha256(match.url);
        operations.push(db.prepare(`INSERT OR IGNORE INTO opportunities(id,source,original_url,fingerprint,title,problem,
          tool_slug,score,draft,published_at,discovered_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(hash.slice(0, 24), source.id, match.url, match.fingerprint, match.title, match.problem,
            match.toolSlug, match.score, match.draft, match.publishedAt, now));
      }
      const updates = await db.batch(operations);
      inserted = updates.slice(2).reduce((sum, update) => sum + update.meta.changes, 0);
      state = partial ? "partial" : "success";
    } else {
      await db.batch(operations);
      state = ["backoff", "quota"].includes(result.state) ? "skipped" : "error";
    }
  } catch (failure) {
    message = /^catalog_(?:invalid|unreachable|http_\d+)$/.test(failure.message) ? failure.message : "Scan failed while reading the catalog or writing D1";
    console.warn("growth_scan_failed", { id, source: source.id, message });
  } finally {
    await db.batch([
      db.prepare("UPDATE scans SET finished_at=?,state=?,found=?,inserted=?,message=? WHERE id=?")
        .bind(Date.now(), state, found, inserted, message, id),
      db.prepare("UPDATE engine SET lease_owner=NULL,lease_until=0 WHERE id=1 AND lease_owner=?").bind(id),
    ]);
  }
}

export async function maintain(env, now) {
  const period = Math.floor(now / reportInterval) * reportInterval;
  const db = env.DB;
  if (await db.prepare("SELECT period FROM reports WHERE period=?").bind(period).first()) return;
  const [summary, analytics] = await Promise.all([countQuery(db, now).first(), analyticsSummary(env)]);
  const cutoff = now - retention;
  const [newest, changes] = (await db.batch([
    db.prepare(`SELECT tool_slug, count(*) AS opportunities FROM opportunities
      WHERE status='new' AND score>=? AND published_at>=? GROUP BY tool_slug ORDER BY opportunities DESC LIMIT 5`).bind(highIntent, recent(now)),
    db.prepare(`SELECT count(*) AS discovered, count(CASE WHEN score>=? THEN 1 END) AS high_intent
      FROM opportunities WHERE discovered_at>=?`).bind(highIntent, now - reportInterval),
  ])).map((result) => result.results);
  const payload = {
    period_start: iso(period), generated_at: iso(now), counts: summary, previous_12_hours: changes[0],
    recent_high_intent_by_tool: newest,
    recommendations: newest.map((row) => `Review ${row.opportunities} recent high-intent matches for ${registry.find((tool) => tool.slug === row.tool_slug)?.name ?? row.tool_slug} and check each community’s rules before replying.`),
    analytics,
  };
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO reports(period,created_at,payload) VALUES(?,?,?)").bind(period, now, JSON.stringify(payload)),
    db.prepare("UPDATE scans SET state='error',finished_at=?,message='Scan timed out' WHERE state='running' AND started_at<?").bind(now, now - leaseTime),
    db.prepare("DELETE FROM opportunities WHERE discovered_at<?").bind(cutoff),
    db.prepare("DELETE FROM scans WHERE started_at<?").bind(cutoff),
    db.prepare("DELETE FROM reports WHERE period<?").bind(cutoff),
    db.prepare("DELETE FROM limits WHERE expires_at<?").bind(now),
    db.prepare("DELETE FROM search_cache WHERE checked_at<?").bind(now - 2 * day),
  ]);
}

export async function latestReport(db) {
  const row = await db.prepare("SELECT payload FROM reports ORDER BY period DESC LIMIT 1").first();
  return row ? JSON.parse(row.payload) : null;
}
