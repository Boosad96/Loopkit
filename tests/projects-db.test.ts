import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { initialConfig, type Kind, type Config } from "../lib/projects/model";
const db = new PGlite();
const account = "cacf22e0-a276-47a3-af3a-acb6c6f1977e",
  stranger = "da006e5d-9634-4d13-9eb2-5bbd969690b3";
const key = "d".repeat(64);
const gen = () => crypto.randomUUID().replaceAll("-", "").slice(0, 24);
async function val(sql: string, args: unknown[] = []) {
  return (await db.query<{ r: unknown }>(sql, args)).rows[0]?.r;
}
async function save(
  slug: string,
  kind: Kind,
  c: Config,
  rev = 0,
  user: string | null = null,
  hash: string | null = key,
) {
  return val("select public.project_save($1,$2,$3,$4,$5,$6,90,20) r", [
    slug,
    kind,
    JSON.stringify(c),
    user,
    hash,
    rev,
  ]);
}
const view = (slug: string, actor = "visitor") =>
  val("select public.project_view($1,$2) r", [slug, actor]);
const respond = (
  slug: string,
  activity: string,
  options: string[] = [],
  actor = "visitor",
) =>
  val("select public.project_participate($1,$2,$3,$4) r", [
    slug,
    actor,
    activity,
    options,
  ]);
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;",
  );
  await db.query("insert into auth.users values($1),($2)", [account, stranger]);
  await db.exec(readFileSync("supabase/migrations/001_projects.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("project transactions and authorization", () => {
  it("deduplicates anonymous votes, locks options and hides results before voting", async () => {
    const slug = gen(),
      c = initialConfig("poll-maker");
    c.hideResults = true;
    await save(slug, "poll-maker", c);
    await expect(respond(slug, "vote", [crypto.randomUUID()])).rejects.toThrow(
      "Invalid choices",
    );
    expect(await respond(slug, "vote", [c.options[1].id])).toBe(true);
    await expect(respond(slug, "vote", [c.options[0].id])).rejects.toThrow(
      "Already voted",
    );
    expect(await view(slug)).toMatchObject({
      votes: 1,
      voted: true,
      counts: { [c.options[1].id]: 1 },
    });
    expect(await view(slug, "other")).toMatchObject({
      votes: 0,
      voted: false,
      counts: {},
    });
    c.options[0].name = "Altered";
    await expect(save(slug, "poll-maker", c, 1)).rejects.toThrow("locked");
  });
  it("rejects unauthorized changes and stale revisions, then supports claiming", async () => {
    const slug = gen(),
      k = "leaderboard-maker",
      c = initialConfig(k);
    await save(slug, k, c);
    await expect(save(slug, k, c, 1, stranger, null)).rejects.toThrow(
      "Permission denied",
    );
    c.entries[0].score = 15;
    expect(await save(slug, k, c, 1)).toBe(2);
    await expect(save(slug, k, c, 1)).rejects.toThrow("Revision conflict");
    expect(
      await val("select public.project_claim($1,$2,$3,20) r", [
        slug,
        account,
        "bad",
      ]),
    ).toBe(false);
    expect(
      await val("select public.project_claim($1,$2,$3,20) r", [
        slug,
        account,
        key,
      ]),
    ).toBe(true);
    await expect(save(slug, k, c, 3, null, key)).rejects.toThrow(
      "Permission denied",
    );
    expect(await save(slug, k, c, 3, account, null)).toBe(4);
    await db.exec(
      "set role authenticated;select set_config('request.jwt.claim.sub','" +
        stranger +
        "',false)",
    );
    try {
      expect(
        await val(
          "select count(id)::int r from public.projects where slug=$1",
          [slug],
        ),
      ).toBe(0);
      await expect(
        db.query("select management_hash from public.projects"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.project_view($1,$2)", [slug, "fake"]),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("reset role");
    }
  });
  it("protects private project configuration and rejects public participation", async () => {
    const slug = gen(),
      c = initialConfig("poll-maker");
    c.visibility = "private";
    await save(slug, "poll-maker", c, 0, account, null);
    expect(await view(slug)).toBe(null);
    await expect(respond(slug, "vote", [c.options[0].id])).rejects.toThrow(
      "Unavailable",
    );
  });
  it("records RSVP and challenge progress and prevents participation on hidden projects", async () => {
    const event = gen(),
      challenge = gen();
    await save(
      event,
      "community-event-page-maker",
      initialConfig("community-event-page-maker"),
    );
    await respond(event, "join");
    await respond(event, "join");
    expect(await view(event)).toMatchObject({ joined: 1, participating: true });
    await respond(event, "leave");
    expect(await view(event)).toMatchObject({ joined: 0 });
    await save(
      challenge,
      "community-challenge-maker",
      initialConfig("community-challenge-maker"),
    );
    await expect(respond(challenge, "finish")).rejects.toThrow("Join first");
    await respond(challenge, "join");
    await respond(challenge, "finish");
    expect(await view(challenge)).toMatchObject({
      finished: 1,
      completed: true,
    });
    await db.query(
      "update public.public_pages set visible=false where project_id=(select id from public.projects where slug=$1)",
      [event],
    );
    expect(await view(event)).toBe(null);
    await expect(respond(event, "join")).rejects.toThrow("Unavailable");
  });
  it("creates durable bracket, goal, link and countdown projects and rate limits mutations", async () => {
    for (const k of [
      "tournament-bracket-maker",
      "goal-tracker",
      "community-link-page-maker",
      "countdown-maker",
    ] as const) {
      const slug = gen(),
        c = initialConfig(k);
      await save(slug, k, c);
      expect(await view(slug)).toMatchObject({
        kind: k,
        config: { title: c.title },
      });
    }
    for (const allowed of [true, true, false])
      expect(
        await val("select public.project_take_limit('bucket',60,2) r"),
      ).toBe(allowed);
  });
});
