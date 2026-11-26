import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
const db = new PGlite({ extensions: { btree_gist } });
const owner = randomUUID(),
  moderator = randomUUID(),
  member = randomUUID(),
  admin = randomUUID();
const fixture = {
  name: "Development fixture",
  description: "A development fixture used only inside this database.",
  platform: "discord",
  category: "Gaming",
  language: "English",
  link: "https://discord.gg/testing",
  tags: ["test"],
};
let listing = "";
async function role(
  name: "authenticated" | "service_role" | "anon" | "postgres",
  id = "",
) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  if (name !== "postgres") await db.exec("set role " + name);
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema extensions;create schema auth;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;alter default privileges in schema public grant all on tables to service_role;alter default privileges in schema public grant all on sequences to service_role;`);
  for (const f of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
  await db.query("insert into auth.users values ($1),($2),($3),($4)", [
    owner,
    moderator,
    member,
    admin,
  ]);
  await db.query("update profiles set role='moderator' where id=$1", [
    moderator,
  ]);
  await db.query("update profiles set role='admin' where id=$1", [admin]);
  await role("service_role");
  listing = (
    await db.query<{ id: string }>(
      "select save_directory_listing($1,null,$2) as id",
      [owner, fixture],
    )
  ).rows[0].id;
}, 60000);
afterAll(() => db.close());
it("restricts listing updates to owners then forces renewed approval", async () => {
  await role("service_role");
  await expect(
    db.query("select save_directory_listing($1,$2,$3)", [
      member,
      listing,
      fixture,
    ]),
  ).rejects.toThrow();
  await role("authenticated", moderator);
  await db.query("select moderate_listing($1,'approved')", [listing]);
  await role("service_role");
  await db.query("select save_directory_listing($1,$2,$3)", [
    owner,
    listing,
    fixture,
  ]);
  await role("anon");
  expect((await db.query("select id from directory_entries")).rows).toEqual([]);
});
it("counts one genuine account vote and prevents owner self-votes", async () => {
  await role("authenticated", moderator);
  await db.query("select moderate_listing($1,'approved')", [listing]);
  await role("service_role");
  await expect(
    db.query("select vote_listing($1,$2)", [owner, listing]),
  ).rejects.toThrow();
  await db.query("select vote_listing($1,$2)", [member, listing]);
  await expect(
    db.query("select vote_listing($1,$2)", [member, listing]),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ vote_count: number }>(
        "select vote_count from directory_entries",
      )
    ).rows[0].vote_count,
  ).toBe(1);
});
it("limits tool configuration to administrators, and records decisions", async () => {
  await role("authenticated", moderator);
  await expect(
    db.query("select set_tool_policy('goal-tracker',false,false)"),
  ).rejects.toThrow();
  await expect(db.query("select growth_report()")).rejects.toThrow();
  await role("authenticated", admin);
  await db.query("select set_tool_policy('goal-tracker',false,false)");
  expect(
    (
      await db.query<{ value: { available: boolean } }>(
        "select value from site_settings where key='tool.goal-tracker'",
      )
    ).rows[0].value.available,
  ).toBe(false);
  expect(
    (
      await db.query(
        "select id from moderation_actions where action='tool.update'",
      )
    ).rows.length,
  ).toBe(1);
  const report = (
    await db.query<{ r: { visitors: number; activation: number | null } }>(
      "select growth_report() as r",
    )
  ).rows[0].r;
  expect(report.visitors).toBe(0);
  expect(report.activation).toBeNull();
});
it("hides suspended communities, then deletes owned content on account removal", async () => {
  await role("authenticated", admin);
  await db.query("select change_suspension($1,true)", [owner]);
  await role("anon");
  expect((await db.query("select id from directory_entries")).rows).toEqual([]);
  await role("postgres");
  await db.query("delete from auth.users where id=$1", [owner]);
  expect(
    (await db.query("select id from community_listings where id=$1", [listing]))
      .rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select listing_id from listing_votes where listing_id=$1",
        [listing],
      )
    ).rows,
  ).toEqual([]);
});
it('enforces the advanced daily report entitlement at the database boundary',async()=>{
 await role('authenticated',member)
 await expect(db.query('select * from activity_trend()')).rejects.toThrow('Access restricted')
 await role('authenticated',admin)
 expect((await db.query('select * from activity_trend()')).rows).toEqual([])
})
