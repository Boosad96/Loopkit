import { currentUser, userClient } from "@/lib/account/server";
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Sign in to export your data." },
      { status: 401 },
    );
  const db = (await userClient())!;
  const url = new URL(req.url),
    size = 100,
    page = Math.max(
      1,
      Math.min(
        10000,
        Number.parseInt(url.searchParams.get("page") || "1", 10) || 1,
      ),
    );
  const from = (page - 1) * size,
    to = from + size;
  const [profile, ...responses] = await Promise.all([
    db
      .from("profiles")
      .select("display_name,role,created_at")
      .eq("id", user.id)
      .single(),
    db
      .from("projects")
      .select("id,slug,kind,title,config,created_at,updated_at")
      .eq("owner_id", user.id)
      .order("id")
      .range(from, to),
    db
      .from("community_listings")
      .select(
        "id,name,description,platform,category,language,tags,official_link,logo_path,status,created_at,updated_at",
      )
      .eq("owner_id", user.id)
      .order("id")
      .range(from, to),
    db
      .from("listing_votes")
      .select("listing_id,created_at")
      .eq("user_id", user.id)
      .order("listing_id")
      .range(from, to),
    db
      .from("listing_reports")
      .select("id,listing_id,reason,status,created_at")
      .eq("reporter_id", user.id)
      .order("id")
      .range(from, to),
    db
      .from("orders")
      .select("id,amount,currency,status,product,created_at")
      .eq("user_id", user.id)
      .order("id")
      .range(from, to),
    db
      .from("subscriptions")
      .select("order_id,status,paid_until,updated_at")
      .eq("user_id", user.id)
      .order("order_id")
      .range(from, to),
    db
      .from("payments")
      .select("id,order_id,amount,currency,status,refunded_amount,created_at")
      .order("id")
      .range(from, to),
    db
      .from("billing_refunds")
      .select("id,payment_id,amount,status,updated_at")
      .order("id")
      .range(from, to),
  ]);
  if (profile.error || responses.some((r) => r.error))
    return Response.json(
      { error: "Export unavailable. Try again later." },
      { status: 503 },
    );
  const fields = [
    "projects",
    "listings",
    "votes",
    "reports",
    "orders",
    "subscriptions",
    "payments",
    "refunds",
  ];
  const data = Object.fromEntries(
    responses.map((r, i) => [fields[i], r.data!.slice(0, size)]),
  );
  return Response.json(
    {
      email: user.email,
      profile: profile.data,
      ...data,
      page,
      next: responses.some((r) => r.data!.length > size)
        ? "/api/account/export?page=" + (page + 1)
        : null,
    },
    {
      headers: {
        "Content-Disposition":
          'attachment; filename="loopkit-account-' + page + '.json"',
        "Cache-Control": "no-store",
      },
    },
  );
}
