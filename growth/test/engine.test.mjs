import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import Worker from "../src/index.mjs";
import { registry } from "../src/registry.mjs";
import { matchOpportunity } from "../src/matching.mjs";
import { parseSource } from "../src/sources.mjs";
import { maintain } from "../src/engine.mjs";
import { day, sha256 } from "../src/shared.mjs";

const now = Date.now();
const homepage = "https://growth.loopkit.site";
const dbSql = readFileSync(new URL("../migrations/0001_growth.sql", import.meta.url), "utf8");

function testDatabase(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(dbSql);
  function prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    const d1 = {
      bind: (...args) => {
        values = args;
        return d1;
      },
      first: async () => statement.get(...values) ?? null,
      all: async () => ({ results: statement.all(...values) }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
      sql,
    };
    return d1;
  }
  return { prepare, batch: async (queries) => {
    sqlite.exec("BEGIN");
    try {
      const results = await Promise.all(queries.map(async (query) =>
        /^SELECT/i.test(query.sql.trim()) ? query.all() : query.run()));
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  } };
}

const secret = "x".repeat(43);
const auth = { authorization: "Bearer meta-test." + secret };
const accepted = { limit: async () => ({ success: true }) };
async function environment(t) {
  return {
    DB: testDatabase(t), ADMIN_RATE: accepted, PUBLIC_RATE: accepted,
    DISCOVERY_ENABLED: "true",
    GROWTH_API_KEYS: JSON.stringify({
      "meta-test": { sha256: await sha256(secret), scopes: ["read", "review", "scan"] },
      readonly: { sha256: await sha256(secret), scopes: ["read"] },
    }),
  };
}
function entry() {
  const pending = [];
  return {
    fetch: (env, path, init) => Worker.fetch(new Request(homepage + path, init), env, { waitUntil: (task) => pending.push(task) }),
    cron: (env) => Worker.scheduled({ cron: "*/15 * * * *" }, env, { waitUntil: (task) => pending.push(task) }),
    done: () => Promise.all(pending.splice(0)),
  };
}

test("registry covers all tool routes and matching filters unrelated and old content", () => {
  assert.equal(registry.length, 16);
  assert.equal(new Set(registry.map((tool) => tool.url)).size, registry.length);
  for (const tool of registry) {
    const result = matchOpportunity({ title: "I'm looking for a " + tool.keywords[0], source: "hn", publishedAt: now }, now);
    assert.equal(result?.toolSlug, tool.slug);
    assert.equal(result.highIntent, true);
    assert.match(result.draft, /Disclosure:.*utm_campaign=loopkit_growth/s);
  }
  for (const title of ["Show HN: I made an online poll tool", "A roundup of random team generator websites",
    "How do I fix a feature request for my Discord emoji size code?", "Looking for a double elimination tournament bracket tool",
    "Any recommendations for an online poll SDK?"]) {
    assert.equal(matchOpportunity({ title, publishedAt: now }, now), null);
  }
  assert.equal(matchOpportunity({ title: "Looking for an online poll", publishedAt: now - 3 * day }, now), null);
});

test("adapters isolate public URLs, parse pagination and honor provider backoff fields", () => {
  const search = parseSource("hn", JSON.stringify({
    hits: [{ objectID: "471", title: "A title", created_at_i: now / 1000 }],
    nbPages: 2,
  }));
  assert.equal(search.next, "1");
  assert.equal(search.items[0].url, "https://news.ycombinator.com/item?id=471");
  assert.equal(parseSource("stack", '{"items":[],"backoff":12,"quota_remaining":0}', null).backoff, 12);
  const github = parseSource("github", JSON.stringify({ total_count: 2, items: [
    { state: "open", html_url: "https://github.com/some/repo/issues/1" },
    { state: "open", html_url: "https://evil.test/some/repo/issues/2" },
  ] }));
  assert.deepEqual(github.items.map((item) => item.url), ["https://github.com/some/repo/issues/1", ""]);
  const xml = '<rss><channel><item><title><![CDATA[Ask HN: Looking for an online poll]]></title>'
    + '<comments>https://news.ycombinator.com/item?id=471</comments>'
    + '<pubDate>Wed, 25 Nov 2026 14:37:00 GMT</pubDate></item></channel></rss>';
  assert.equal(parseSource("rss", xml).items[0].url, search.items[0].url);
  const bluesky = parseSource("bluesky", JSON.stringify({ posts: [
    { uri: "at://did:plc:abc/app.bsky.feed.post/3xy", record: { text: "Looking for a tier list maker", createdAt: new Date(now).toISOString() } },
    { uri: "at://did:plc:abc/app.bsky.feed.post/4xy", record: { reply: {} } },
  ], cursor: "next" }));
  assert.equal(bluesky.next, "next");
  assert.deepEqual(bluesky.items.map((item) => item.url), ["https://bsky.app/profile/did:plc:abc/post/3xy"]);
});

test("real SQL scan lifecycle, public API quota, access isolation, scopes, review and retention", async (t) => {
  const env = await environment(t);
  env.PUBLIC_API_DAILY_LIMIT = "2";
  const handler = entry();
  const title = "Looking for a Discord timestamp tool that handles local time";
  const url = "https://news.ycombinator.com/item?id=112233";
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const target = new URL(input);
    requests.push(target);
    if (target.hostname === "loopkit.site") {
      return new Response("<urlset>\n" + registry.map((tool) => `<url><loc>${tool.url}</loc></url>`).join("\n") + "</urlset>");
    }
    if (target.hostname === "api.stackexchange.com") return Response.json({ items: [], has_more: false, quota_remaining: 299 });
    assert.equal(target.hostname, "hn.algolia.com");
    if (target.searchParams.get("page") === "1")
      return Response.json({ hits: [{ objectID: "112236", title, created_at_i: Math.floor(now / 1000) }], nbPages: 2 });
    return Response.json({ hits: [
      { objectID: "112233", title, created_at_i: Math.floor(now / 1000) },
      { objectID: "112234", title, created_at_i: Math.floor(now / 1000) },
      { objectID: "112235", title, created_at_i: Math.floor((now - 3 * day) / 1000) },
    ], nbPages: 2 }, { headers: { etag: '"test-etag"' } });
  });

  const run = (path, options) => handler.fetch(env, path, options);
  assert.equal((await run("/admin/growth")).status, 403);
  assert.equal((await run("/admin/growth/assets/dashboard.css")).status, 403);
  assert.equal((await run("/api/growth/status")).status, 401);
  assert.equal((await run("/api/growth/scan", { method: "POST", headers: { authorization: "Bearer readonly." + secret } })).status, 403);
  const scan = await run("/api/growth/scan", { method: "POST", headers: auth });
  assert.equal(scan.status, 202);
  assert.equal((await run("/api/growth/scan", { method: "POST", headers: auth })).status, 409);
  await handler.done();
  assert.equal(requests[0].pathname, "/sitemap.xml");
  assert.equal(requests[1].searchParams.get("query"), "discord timestamp");
  assert.equal(requests[2].searchParams.get("page"), "1");

  const status = await (await run("/api/growth/status", { headers: auth })).json();
  assert.equal(status.launch_mode, true);
  assert.equal(status.counts.total, 1);
  assert.equal(status.last_scan.state, "success");
  assert.equal(status.last_scan.inserted, 1);
  const { items } = await (await run("/api/growth/opportunities/high-intent", { headers: auth })).json();
  assert.equal(items[0].original_url, url);
  assert.equal(items[0].status, "new");
  assert.equal((await run("/api/growth/opportunities?cursor=bad", { headers: auth })).status, 400);
  const op = "/api/growth/opportunities/" + items[0].id;
  for (const [action, code] of [["approve", 200], ["approve", 200], ["dismiss", 200], ["approve", 409], ["archive", 200]]) {
    assert.equal((await run(op + "/" + action, { method: "POST", headers: auth })).status, code);
  }
  const report = await (await run("/api/growth/report", { headers: auth })).json();
  assert.equal(report.report.previous_12_hours.discovered, 1);
  assert.deepEqual(report.report.analytics, { state: "unconfigured", data: null });
  handler.cron(env);
  await handler.done();
  assert.equal(requests.at(-1).hostname, "api.stackexchange.com");

  const timestamp = await run("/api/v1/discord-timestamp?unix=1735689600");
  assert.equal((await timestamp.json()).formats.R, "<t:1735689600:R>");
  const team = await run("/api/v1/random-teams?players=8&teams=3");
  assert.deepEqual((await team.json()).teams.flat().sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((await run("/api/v1/random-teams?players=8&teams=3")).status, 429);
  await maintain(env, now + 32 * day);
  assert.equal((await env.DB.prepare("SELECT count(*) AS count FROM opportunities").first()).count, 0);
});

test("a signed Cloudflare Access identity can load the dashboard but cross-origin mutations fail", async (t) => {
  const env = await environment(t);
  const handler = entry();
  env.ACCESS_TEAM_URL = "https://example-team.cloudflareaccess.com";
  env.ACCESS_AUD = "private-application";
  const keys = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  t.mock.method(globalThis, "fetch", async (target) => {
    assert.equal(target, env.ACCESS_TEAM_URL + "/cdn-cgi/access/certs");
    return Response.json({ keys: [{ ...publicKey, kid: "test-kid", alg: "RS256" }] });
  });
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const clock = Math.floor(Date.now() / 1000);
  const encoded = base64({ alg: "RS256", kid: "test-kid" }) + "." + base64({
    sub: "browser-id", email: "owner@example.com", iss: env.ACCESS_TEAM_URL, aud: [env.ACCESS_AUD], iat: clock, exp: clock + 30,
  });
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(encoded))).toString("base64url");
  const jwt = { "cf-access-jwt-assertion": encoded + "." + sig };
  const valid = await handler.fetch(env, "/admin/growth", { headers: jwt });
  assert.equal(valid.status, 200);
  assert.match(await valid.text(), /Growth dashboard/);
  assert.match(valid.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal((await handler.fetch(env, "/admin/growth/scan", { method: "POST", headers: { ...jwt, origin: "https://example.org" } })).status, 403);
  env.ACCESS_AUD = "different-app";
  assert.equal((await handler.fetch(env, "/admin/growth", { headers: jwt })).status, 403);
});
