import { serviceClient } from "@/lib/account/server";
import { billingConfigured, provider } from "@/lib/billing/razorpay";
import { authenticatedWrite, fail } from "@/lib/billing/server";
export async function POST(request: Request) {
  if (!billingConfigured()) return fail("Billing settings required.", 503);
  const user = await authenticatedWrite(request);
  if (!user) return fail("Sign in to continue.", 403);
  const db = serviceClient();
  const { data } = await db
    .from("subscriptions")
    .select("order_id,cancel_scheduled,orders!inner(provider_id)")
    .eq("user_id", user.id)
    .in("status", [
      "created",
      "active",
      "activated",
      "resumed",
      "updated",
      "authenticated",
      "pending",
      "paused",
      "halted",
    ])
    .limit(1)
    .maybeSingle();
  if (!data) return fail("No renewable subscription found.", 404);
  if (!data.cancel_scheduled) {
    const order = data.orders as unknown as { provider_id: string };
    let ended = false;
    try {
      ended =
        (await provider().cancelAtCycleEnd(order.provider_id)) === "ended";
    } catch {
      return fail(
        "Cancellation could not be confirmed. Review your billing history before retrying.",
        502,
      );
    }
    const r = await db
      .from("subscriptions")
      .update({
        cancel_scheduled: true,
        ...(ended ? { status: "cancelled" } : {}),
      })
      .eq("order_id", data.order_id);
    if (r.error) return fail("Cancellation needs reconciliation.", 503);
  }
  return Response.json({
    message: "Cancellation scheduled at the end of the billing cycle.",
  });
}
