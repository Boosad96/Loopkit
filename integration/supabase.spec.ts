import { test, expect, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { initialConfig } from "../lib/projects/model";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
if (new URL(url).hostname !== "127.0.0.1")
  throw Error(
    "These tests require a disposable Supabase instance on loopback.",
  );
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const password = randomBytes(24).toString("hex");
const accounts: string[] = [];
async function login(context: BrowserContext, role: "member" | "admin") {
  const email = "loopkit-" + randomUUID() + "@example.test";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error || Error("Local identity creation failed.");
  accounts.push(data.user.id);
  if (role === "admin") {
    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (error) throw error;
  }
  const jar = new Map<string, string>();
  const client = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: (values) => {
          for (const { name, value } of values) jar.set(name, value);
        },
      },
    },
  );
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  await context.addCookies(
    Array.from(jar, ([name, value]) => ({ name, value, url: origin })),
  );
  return data.user.id;
}
test.afterAll(async () => {
  for (const id of accounts) await admin.auth.admin.deleteUser(id);
});
test("authenticated admin and organizer pages use real isolated database sessions", async ({
  browser,
}) => {
  const member = await browser.newContext(),
    staff = await browser.newContext();
  await login(member, "member");
  await login(staff, "admin");
  const page = await member.newPage();
  await page.goto(origin + "/dashboard");
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
  await page.screenshot({ path: "qa/authenticated-dashboard.png" });
  await page.goto(origin + "/admin");
  await expect(
    page.getByRole("heading", { name: "Administration", exact: true }),
  ).toHaveCount(0);
  const staffPage = await staff.newPage();
  await staffPage.goto(origin + "/admin");
  await expect(
    staffPage.getByRole("heading", { name: "Administration" }),
  ).toBeVisible();
  await staffPage.screenshot({ path: "qa/authenticated-admin.png" });
  await member.close();
  await staff.close();
});
test("anonymous project can be viewed, embedded, claimed and then edited by its owner", async ({
  browser,
  request,
}) => {
  const slug = randomBytes(12).toString("hex"),
    token = randomBytes(32).toString("hex");
  const config = initialConfig("goal-tracker");
  config.title = "Development-only integration goal";
  const { error } = await admin.rpc("project_save", {
    p_slug: slug,
    p_kind: "goal-tracker",
    p_cfg: config,
    p_user: null,
    p_hash: createHash("sha256").update(token).digest("hex"),
    p_rev: 0,
    p_days: 1,
    p_cap: 10,
  });
  if (error) throw error;
  try {
    const publicView = await request.get("/api/projects/" + slug);
    expect(publicView.ok()).toBeTruthy();
    expect(await publicView.text()).not.toContain(token);
    for (const prefix of ["/s/", "/embed/"]) {
      const res = await request.get(prefix + slug);
      expect(res.ok()).toBeTruthy();
      expect(await res.text()).toContain(config.title);
      expect(res.headers()["x-robots-tag"]).toContain("noindex");
    }
    const headers = { origin };
    const payload = {
      kind: "goal-tracker",
      config: { ...config, progress: 37 },
      revision: 1,
    };
    const denied = await request.put("/api/projects/" + slug, {
      headers,
      data: payload,
    });
    expect(denied.status()).toBe(403);
    const member = await browser.newContext();
    await login(member, "member");
    const claimed = await member.request.post(
      origin + "/api/projects/" + slug,
      {
        headers: { origin, authorization: "Bearer " + token },
        data: { action: "claim" },
      },
    );
    expect(claimed.ok(), await claimed.text()).toBeTruthy();
    const saved = await member.request.put(origin + "/api/projects/" + slug, {
      headers,
      data: { ...payload, revision: 2 },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    expect(
      (await (await request.get("/api/projects/" + slug)).json()).config
        .progress,
    ).toBe(37);
    await member.close();
  } finally {
    await admin.from("projects").delete().eq("slug", slug);
  }
});

test("real project API creates a poll, counts one vote, composes an Event Hub, records an RSVP and hides a private page", async ({
  request,
  browser,
}) => {
  const ids: string[] = [];
  async function create(
    kind: Parameters<typeof initialConfig>[0],
    config = initialConfig(kind),
  ) {
    const res = await request.post("/api/projects", {
      headers: { origin },
      data: { kind, config, revision: 0, challenge: "fixture-project_create" },
    });
    expect(res.status(), await res.text()).toBe(201);
    const reply = await res.json();
    ids.push(reply.slug);
    return reply;
  }
  try {
    const poll = initialConfig("poll-maker");
    const p = await create("poll-maker", poll);
    const vote = () =>
      request.post("/api/projects/" + p.slug, {
        headers: { origin },
        data: {
          action: "vote",
          choices: [poll.options[0].id],
          challenge: "fixture-project_participate",
        },
      });
    expect((await vote()).ok()).toBeTruthy();
    expect((await vote()).status()).toBe(409);
    const hub = initialConfig("community-event-page-maker");
    hub.attachments.Poll = p.slug;
    hub.order.push("Poll");
    const event = await create("community-event-page-maker", hub);
    const rsvp = await request.post("/api/projects/" + event.slug, {
      headers: { origin },
      data: { action: "join", challenge: "fixture-project_participate" },
    });
    expect(rsvp.ok(), await rsvp.text()).toBeTruthy();
    const view = await (
      await request.get("/api/projects/" + event.slug)
    ).json();
    expect(view.joined).toBe(1);
    const countdown = await create("countdown-maker");
    expect((await request.get("/embed/" + countdown.slug)).ok()).toBeTruthy();
    const member = await browser.newContext();
    await login(member, "member");
    const cfg = initialConfig("leaderboard-maker");
    cfg.visibility = "private";
    const res = await member.request.post(origin + "/api/projects", {
      headers: { origin },
      data: {
        kind: "leaderboard-maker",
        config: cfg,
        revision: 0,
        challenge: "fixture-project_create",
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const privateSlug = (await res.json()).slug;
    ids.push(privateSlug);
    expect((await request.get("/api/projects/" + privateSlug)).status()).toBe(
      404,
    );
    await member.close();
  } finally {
    if (ids.length) await admin.from("projects").delete().in("slug", ids);
  }
});

test("registration, sign-in, moderated submission, export and account deletion", async ({
  browser,
}) => {
  const member = await browser.newContext(),
    staff = await browser.newContext();
  // Widget fixture exercises local form submission with a named challenge.
  await member.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: "window.turnstile={render(el,{action}){const input=document.createElement('input');input.name='cf-turnstile-response';input.type='hidden';input.value='fixture-'+action;el.append(input);return 'local'},remove(){}}",
      }),
  );
  const page = await member.newPage(),
    email = "signup-" + randomUUID() + "@example.test";
  async function authenticate(path: string, button: string) {
    await page.goto(origin + path);
    await page.getByLabel("Email address").fill(email);
    await page.locator("input[name=password]").fill(password);
    await expect(page.locator("[name=cf-turnstile-response]")).toBeAttached();
    await page.getByRole("button", { name: button, exact: true }).click();
  }
  await authenticate("/register", "Create account");
  await expect(page).toHaveURL(/login\?notice=verify/);
  // The disposable CLI config uses automatic email confirmation for this scenario.
  await authenticate("/login", "Sign in");
  await expect(page).toHaveURL(/dashboard$/);
  const name = "QA community " + randomUUID().slice(0, 8);
  await page.goto(origin + "/submit");
  await page.locator("[name=name]").fill(name);
  await page
    .locator("textarea[name=description]")
    .fill(
      "Development-only community for testing the moderated submission workflow.",
    );
  await page.locator("[name=platform]").selectOption("discord");
  await page.locator("[name=link]").fill("https://discord.gg/fixture");
  await expect(page.locator("[name=cf-turnstile-response]")).toBeAttached();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/dashboard\/listings/);
  await expect(page.getByText(name)).toBeVisible();
  await login(staff, "admin");
  const review = await staff.newPage();
  await review.goto(origin + "/admin");
  const row = review.locator("article").filter({ hasText: name });
  await row.getByRole("button", { name: "Apply decision" }).click();
  await expect
    .poll(
      async () =>
        (
          await admin
            .from("community_listings")
            .select("status")
            .eq("name", name)
            .single()
        ).data?.status,
    )
    .toBe("approved");
  const { data: listed } = await admin
    .from("community_listings")
    .select("status,slug,owner_id")
    .eq("name", name)
    .single();
  expect(listed?.status).toBe("approved");
  const shared = await member.request.get(
    origin + "/community/" + listed!.slug,
  );
  expect(await shared.text()).toContain(name);
  const download = await member.request.get(origin + "/api/account/export");
  expect((await download.json()).email).toBe(email);
  await page.goto(origin + "/dashboard/settings");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Delete my account permanently" })
    .click();
  await expect(page).toHaveURL(/login\?notice=deleted/);
  expect(
    (await admin.auth.admin.getUserById(listed!.owner_id)).data.user,
  ).toBeNull();
  await member.close();
  await staff.close();
});

test("signed test webhook applies capture once and rejects a wrong signature", async ({
  browser,
  request,
}) => {
  const { createHmac } = await import("node:crypto");
  const member = await browser.newContext(),
    user = await login(member, "member");
  const paymentId = "pay_" + randomBytes(8).toString("hex"),
    remote = "order_" + randomBytes(8).toString("hex");
  const listing = await admin
    .from("community_listings")
    .insert({
      owner_id: user,
      name: "Test sponsorship",
      description: "Disposable development listing for checkout tests.",
      platform: "discord",
      category: "Gaming",
      official_link: "https://discord.gg/fixture",
      language: "en",
      status: "approved",
    })
    .select("id")
    .single();
  if (listing.error) throw listing.error;
  const reserved = await admin.rpc("billing_reserve", {
    p_user: user,
    p_request: randomUUID(),
    p_product: "featured",
    p_listing: listing.data.id,
    p_start: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  });
  if (reserved.error) throw reserved.error;
  const order = reserved.data.order;
  const update = await admin
    .from("orders")
    .update({ status: "pending", provider_id: remote })
    .eq("id", order.id);
  if (update.error) throw update.error;
  const raw = JSON.stringify({
    event: "payment.captured",
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: remote,
          amount: 499,
          currency: "USD",
          status: "captured",
        },
      },
    },
  });
  const event = randomUUID();
  const send = (signature: string) =>
    request.post("/api/billing/webhook", {
      headers: {
        "content-type": "application/json",
        "x-razorpay-event-id": event,
        "x-razorpay-signature": signature,
      },
      data: raw,
    });
  expect((await send("0".repeat(64))).status()).toBe(400);
  const signature = createHmac("sha256", "local-webhook-only")
    .update(raw)
    .digest("hex");
  expect((await send(signature)).ok()).toBeTruthy();
  expect((await send(signature)).ok()).toBeTruthy();
  const payments = await admin
    .from("payments")
    .select("id")
    .eq("order_id", order.id);
  expect(payments.data).toHaveLength(1);
  await admin
    .from("sponsorships")
    .update({ status: "cancelled" })
    .eq("order_id", order.id);
  await member.close();
});
