import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite({ extensions: { btree_gist } }),
  owner = randomUUID(),
  listing = randomUUID();
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema extensions; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon,service_role;`,
  );
  for (const name of [
    "001_projects.sql",
    "002_accounts.sql",
    "003_billing.sql",
  ])
    await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
  await db.query("insert into auth.users values ($1)", [owner]);
  await db.query(
    "insert into community_listings(id,owner_id,name,description,platform,category,official_link,language,status) values($1,$2,'Test listing','Development integration test listing.','discord','Gaming','https://discord.gg/demo','en','approved')",
    [listing, owner],
  );
}, 30000);
afterAll(() => db.close());
async function reserve(product: string, request = randomUUID()) {
  const { rows } = await db.query<{
    r: { new: boolean; order: { id: string; status: string } };
  }>("select billing_reserve($1,$2,$3,$4,current_date+1) r", [
    owner,
    request,
    product,
    listing,
  ]);
  return rows[0].r;
}
async function event(
  kind: string,
  data: Record<string, string | number>,
  id: string = randomUUID(),
) {
  const digest = createHash("sha256")
    .update(kind + JSON.stringify(data))
    .digest("hex");
  return (
    await db.query<{ r: string }>(
      "select billing_apply_event($1,$2,$3,$4::jsonb) r",
      [id, digest, kind, JSON.stringify(data)],
    )
  ).rows[0].r;
}
const now = () => Math.floor(Date.now() / 1000);
it("holds a single non-overlapping slot; idempotent retries reuse the recorded order", async () => {
  const key = randomUUID(),
    a = await reserve("homepage", key),
    b = await reserve("homepage", key);
  expect(a.new).toBe(true);
  expect(b.new).toBe(false);
  expect(a.order.id).toBe(b.order.id);
  await expect(reserve("homepage")).rejects.toThrow();
  await db.query(
    "update orders set provider_id='order_test',status='pending' where id=$1",
    [a.order.id],
  );
  const payload = {
    at: now(),
    providerId: "order_test",
    amount: 2999,
    currency: "USD",
    payment: "pay_one",
  };
  expect(await event("payment.captured", payload, "event1")).toBe("applied");
  expect(await event("payment.captured", payload, "event1")).toBe("duplicate");
  expect(await event("payment.captured", payload, "event2")).toBe("duplicate");
  expect(
    (
      await db.query("select status from sponsorships where order_id=$1", [
        a.order.id,
      ])
    ).rows[0],
  ).toEqual({ status: "confirmed" });
});
it("routes late capture to merchant review after expiry and permits a new reservation", async () => {
  const a = await reserve("featured");
  await db.query(
    "update sponsorships set hold_until=now()-interval '1 minute' where order_id=$1",
    [a.order.id],
  );
  await db.query("update orders set provider_id='order_exp' where id=$1", [
    a.order.id,
  ]);
  const b = await reserve("featured");
  expect(b.order.id).not.toBe(a.order.id);
  expect(
    await event("payment.captured", {
      at: now(),
      amount: 499,
      currency: "USD",
      payment: "pay_exp",
      providerId: "order_exp",
    }),
  ).toBe("manual_review");
});
it("activates a subscription only on capture, handles amount mismatch, refund and repeat events", async () => {
  const a = await reserve("pro");
  await db.query("update orders set provider_id='sub_test' where id=$1", [
    a.order.id,
  ]);
  const pro = async () =>
    (await db.query<{ ok: boolean }>("select billing_has_pro($1) ok", [owner]))
      .rows[0].ok;
  const payload = {
    at: now(),
    amount: 599,
    currency: "USD",
    payment: "pay_pro",
    providerId: "sub_test",
    until: now() + 86000,
  };
  await event("subscription.activated", { at: now(), providerId: "sub_test" });
  expect(await pro()).toBe(false);
  await expect(
    event("subscription.charged", { ...payload, amount: 1 }),
  ).rejects.toThrow("amount_mismatch");
  await event("subscription.charged", payload);
  expect(await pro()).toBe(true);
  await event("refund.processed", {
    at: now(),
    payment: "pay_pro",
    refund: "rfnd_demo",
    amount: 599,
  });
  expect(await pro()).toBe(false);
  expect(
    await event("subscription.charged", { ...payload, at: now() + 9 }),
  ).toBe("duplicate_payment");
  expect(await pro()).toBe(false);
});
it("keeps a remote mandate reserved until a terminal state is confirmed", async () => {
  // A missing webhook may outlive the checkout's browser window. Never create
  // another mandate just because 20 minutes passed.
  const member = randomUUID();
  await db.query("insert into auth.users values ($1)", [member]);
  const res = await db.query<{ r: { order: { id: string } } }>(
    "select billing_reserve($1,$2,'pro',null,null) r",
    [member, randomUUID()],
  );
  await db.query(
    "update orders set created_at=now()-interval '1 hour',provider_id='sub_awaiting' where id=$1",
    [res.rows[0].r.order.id],
  );
  await expect(
    db.query("select billing_reserve($1,$2,'pro',null,null)", [
      member,
      randomUUID(),
    ]),
  ).rejects.toThrow();
});
it("rejects stale prices before reserving a slot or creating a provider order", async () => {
  await expect(
    db.query(
      "select billing_reserve($1,$2,'category',$3,current_date+7,1,'USD')",
      [owner, randomUUID(), listing],
    ),
  ).rejects.toThrow("price_changed");
});
it("expires a campaign on the UTC boundary and limits impression and click totals to one per daily digest", async () => {
  const s = await db.query<{ id: string }>(
    "select s.id from sponsorships s join orders o on o.id=s.order_id where o.provider_id='order_test'",
  );
  const campaign = s.rows[0].id;
  await db.query(
    "update sponsorships set starts_at=now()-interval '1 day',ends_at=now()+interval '6 days' where id=$1",
    [campaign],
  );
  await db.exec("set role service_role");
  try {
    for (const kind of ["view", "view", "click"])
      await db.query(
        "select billing_record_metric($1,$2,'testing-daily-digest')",
        [campaign, kind],
      );
    expect(
      (
        await db.query(
          "select views,clicks from sponsorship_metrics where sponsorship_id=$1",
          [campaign],
        )
      ).rows,
    ).toEqual([{ views: 1, clicks: 1 }]);
    await db.query(
      "update sponsorships set starts_at=now()-interval '8 days',ends_at=now()-interval '1 day' where id=$1",
      [campaign],
    );
    await db.query("select billing_record_metric($1,'view','another-digest')", [
      campaign,
    ]);
    expect(
      (
        await db.query(
          "select views from sponsorship_metrics where sponsorship_id=$1",
          [campaign],
        )
      ).rows,
    ).toEqual([{ views: 1 }]);
  } finally {
    await db.exec("reset role");
  }
});
