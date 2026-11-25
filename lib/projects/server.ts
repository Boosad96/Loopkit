import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { currentUser, serviceClient, userClient } from "@/lib/account/server";
import { recordConversion } from "@/lib/account/conversions";
import { toolPolicies } from "@/lib/account/tools";
import { sameOrigin } from "@/lib/origin";
import { hasPro } from "@/lib/billing/server";
import { verifyChallenge } from "@/lib/account/challenge";
import { configSchema, kinds, slugPattern, type View } from "./model";

const envelope = z
  .object({
    kind: z.enum(kinds),
    config: configSchema,
    revision: z.number().int().nonnegative().max(2147483646),
    challenge: z.string().max(2048).optional(),
  })
  .strict();
const action = z
  .object({
    action: z.enum(["vote", "join", "leave", "finish", "claim"]),
    choices: z.array(z.string().uuid()).max(10).default([]),
    challenge: z.string().max(2048).optional(),
  })
  .strict();
class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const secrets = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new RequestError(
      503,
      "Hosted projects require the site owner to connect Supabase.",
    );
  return key;
};
const stamp = (group: string, value: string) =>
  createHmac("sha256", secrets())
    .update(group + "|" + value)
    .digest("hex");
function limitValue(name: string, fallback: number, max: number) {
  const n = Number(process.env[name]);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
function management(req: Request) {
  const token = req.headers
    .get("authorization")
    ?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  return token ? createHash("sha256").update(token).digest("hex") : null;
}
async function identity(write = false) {
  const user = await currentUser();
  if (!user && write) {
    const auth = await userClient();
    if (auth && (await auth.auth.getUser()).data.user)
      throw new RequestError(403, "Account access is restricted.");
  }
  if (user) return { user: user.id, visitor: "u:" + user.id };
  const jar = await cookies();
  const value = jar.get("lk_participant")?.value ?? "";
  const [raw, sig] = value.split(".");
  if (/^[0-9a-f]{48}$/.test(raw) && sig === stamp("cookie", raw))
    return { user: null, visitor: raw };
  if (!write) return { user: null, visitor: null };
  const rawNew = randomBytes(24).toString("hex");
  jar.set("lk_participant", rawNew + "." + stamp("cookie", rawNew), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return { user: null, visitor: rawNew };
}
async function throttle(
  req: Request,
  group: string,
  max: number,
  seconds: number,
) {
  const key = req.headers.get("cf-connecting-ip") || "unknown-network";
  const { data, error } = await serviceClient().rpc("project_take_limit", {
    p_bucket: stamp("network:" + group, key),
    p_seconds: seconds,
    p_max: max,
  });
  if (error) throw new RequestError(503, "Project storage is unavailable.");
  if (!data)
    throw new RequestError(429, "Too many requests. Please try again later.");
}
async function body(req: Request) {
  secrets();
  if (!sameOrigin(req.headers.get("origin"), req.url))
    throw new RequestError(403, "Request origin was rejected.");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new RequestError(415, "Send JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError(400, "Missing request.");
  const bytes: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    n += part.value.length;
    if (n > 90000) {
      await reader.cancel();
      throw new RequestError(413, "Project exceeds the size limit.");
    }
    bytes.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(bytes).toString("utf8"));
  } catch {
    throw new RequestError(400, "Invalid request.");
  }
}
function errorResponse(e: unknown) {
  if (e instanceof z.ZodError)
    return NextResponse.json(
      { error: e.issues[0].path.join(".") + " " + e.issues[0].message },
      { status: 400 },
    );
  if (e instanceof RequestError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json(
    { error: "Project storage is temporarily unavailable." },
    { status: 503 },
  );
}
function dbFailure(message: string): never {
  const mapped: Record<string, number> = {
    "Revision conflict": 409,
    "Project limit reached": 429,
    "Permission denied": 403,
    "Poll choices are locked after the first vote": 409,
    "Voting has closed": 409,
    "Invalid choices": 400,
    "Already voted": 409,
    "Event has started": 409,
    "Challenge has ended": 409,
    "Join first": 409,
    "Unsupported action": 400,
    Unavailable: 404,
  };
  const status = mapped[message];
  if (status) throw new RequestError(status, message);
  throw new RequestError(503, "Project storage is temporarily unavailable.");
}
async function guard(token: string | undefined, kind: string) {
  if (
    !process.env.TURNSTILE_SECRET_KEY ||
    !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  )
    throw new RequestError(
      503,
      "Publishing and participation require configured abuse protection.",
    );
  if (!(await verifyChallenge(token ?? null, kind)))
    throw new RequestError(403, "Please complete a fresh verification.");
}
export async function getView(slug: string): Promise<View | null> {
  if (!slugPattern.test(slug)) return null;
  secrets();
  const { visitor } = await identity();
  const { data, error } = await serviceClient().rpc("project_view", {
    p_slug: slug,
    p_actor: visitor ? stamp("participant:" + slug, visitor) : null,
  });
  if (error) dbFailure(error.message);
  const view = data as View | null;
  if (view && (view.config.removeBranding || view.config.theme === "studio")) {
    const { data: record } = await serviceClient()
      .from("projects")
      .select("owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!record?.owner_id || !(await hasPro(record.owner_id))) {
      view.config.removeBranding = false;
      if (view.config.theme === "studio") view.config.theme = "midnight";
    }
  }
  return view;
}
export async function readProject(req: Request, slug: string) {
  try {
    await throttle(req, "read", 240, 60);
    if (new URL(req.url).searchParams.get("manage") === "1") {
      if (!slugPattern.test(slug))
        throw new RequestError(404, "Project unavailable.");
      const { user } = await identity(true),
        hash = management(req);
      const db = serviceClient();
      const { data: record, error } = await db
        .from("projects")
        .select(
          "id,slug,kind,config,revision,updated_at,owner_id,management_hash",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new RequestError(503, "Project storage is unavailable.");
      const member =
        record && user && user !== record.owner_id
          ? await db
              .from("project_memberships")
              .select("project_id")
              .eq("project_id", record.id)
              .eq("user_id", user)
              .maybeSingle()
          : null;
      if (
        !record ||
        !(
          (user && user === record.owner_id) ||
          (hash && hash === record.management_hash) ||
          member?.data
        )
      )
        throw new RequestError(
          403,
          "Sign in as an organizer or enter the private management key.",
        );
      const view: View = {
        slug: record.slug,
        kind: record.kind,
        config: record.config,
        revision: record.revision,
        updatedAt: record.updated_at,
        counts: {},
        votes: 0,
        joined: 0,
        finished: 0,
        voted: false,
        participating: false,
        completed: false,
      };
      return NextResponse.json(view, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const view = await getView(slug);
    return NextResponse.json(view ?? { error: "Project unavailable." }, {
      status: view ? 200 : 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function saveProject(req: Request, slug?: string) {
  try {
    const payload = envelope.parse(await body(req));
    if (
      slug
        ? !slugPattern.test(slug) || payload.revision < 1
        : payload.revision !== 0
    )
      throw new RequestError(400, "Invalid project revision.");
    const { user } = await identity(true);
    await throttle(
      req,
      slug ? "edit" : "create",
      slug ? 60 : limitValue("ANONYMOUS_PROJECTS_PER_HOUR", 8, 120),
      slug ? 60 : 3600,
    );
    if (!slug) {
      if ((await toolPolicies())[payload.kind]?.available === false)
        throw new RequestError(503, "This tool is currently unavailable.");
      await guard(payload.challenge, "project_create");
    }
    const premium = user ? await hasPro(user) : false;
    if (
      (payload.config.removeBranding || payload.config.theme === "studio") &&
      !premium
    )
      throw new RequestError(
        403,
        "This setting requires an active Creator Pro subscription.",
      );
    if (!slug && payload.config.visibility === "private" && !user)
      throw new RequestError(401, "Sign in to create a private project.");
    if (
      payload.kind === "community-event-page-maker" ||
      payload.kind === "community-challenge-maker"
    ) {
      const types = {
        Poll: "poll-maker",
        Tournament: "tournament-bracket-maker",
        Leaderboard: "leaderboard-maker",
      };
      for (const [name, id] of Object.entries(payload.config.attachments)) {
        if (!id) {
          if (
            payload.kind === "community-event-page-maker" &&
            payload.config.order.includes(name as "Poll")
          )
            throw new RequestError(
              400,
              "Attach a shared " +
                name.toLowerCase() +
                " or remove that section.",
            );
          continue;
        }
        const referenced = await getView(id);
        if (
          !referenced ||
          referenced.kind !== types[name as keyof typeof types]
        )
          throw new RequestError(
            400,
            "Choose an available " + name.toLowerCase() + " project.",
          );
      }
    }
    const token = !slug && !user ? randomBytes(32).toString("hex") : null;
    const publicSlug = slug ?? randomBytes(12).toString("hex");
    const { data, error } = await serviceClient().rpc("project_save", {
      p_slug: publicSlug,
      p_kind: payload.kind,
      p_cfg: payload.config,
      p_user: user,
      p_hash: token
        ? createHash("sha256").update(token).digest("hex")
        : management(req),
      p_rev: payload.revision,
      p_days: limitValue("ANONYMOUS_PROJECT_DAYS", 90, 730),
      p_cap: premium
        ? limitValue("PRO_HOSTED_PROJECT_LIMIT", 250, 10000)
        : limitValue("HOSTED_PROJECT_LIMIT", 50, 10000),
    });
    if (error) dbFailure(error.message);
    if (!slug)
      await recordConversion(
        "project_create",
        payload.config.visibility === "shared" ? publicSlug : undefined,
      );
    return NextResponse.json(
      { slug: publicSlug, revision: data, managementToken: token },
      { status: slug ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function act(req: Request, slug: string) {
  try {
    if (!slugPattern.test(slug))
      throw new RequestError(404, "Project unavailable.");
    const payload = action.parse(await body(req));
    const { user, visitor } = await identity(true);
    await throttle(req, "participation", 40, 60);
    if (payload.action === "claim") {
      if (!user)
        throw new RequestError(401, "Sign in before claiming this project.");
      const { data, error } = await serviceClient().rpc("project_claim", {
        p_slug: slug,
        p_user: user,
        p_hash: management(req),
        p_cap: limitValue("HOSTED_PROJECT_LIMIT", 50, 10000),
      });
      if (error) dbFailure(error.message);
      if (!data)
        throw new RequestError(
          403,
          "The management key is invalid or this project already has an owner.",
        );
    } else {
      await guard(payload.challenge, "project_participate");
      const { error } = await serviceClient().rpc("project_participate", {
        p_slug: slug,
        p_actor: stamp("participant:" + slug, visitor!),
        p_action: payload.action,
        p_options: payload.choices,
      });
      if (error) dbFailure(error.message);
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
