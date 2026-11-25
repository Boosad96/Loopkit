import { z } from "zod";
import { serviceClient } from "@/lib/account/server";
import { authenticatedWrite, fail, readLimited } from "@/lib/billing/server";
import { billingConfigured, provider } from "@/lib/billing/razorpay";
const input = z
  .object({
    product: z.enum(["pro", "featured", "category", "homepage"]),
    requestId: z.string().uuid(),
    amount: z.number().int().positive().max(10000000),
    currency: z.enum(["USD", "INR"]),
    listing: z.string().uuid().optional(),
    start: z.string().date().optional(),
  })
  .strict();
export async function POST(request: Request) {
  if (!billingConfigured())
    return fail("Test checkout is awaiting merchant configuration.", 503);
  const user = await authenticatedWrite(request);
  if (!user) return fail("Sign in to continue.", 403);
  const parsed = input.safeParse(
    await readLimited(request, 2048)
      .then(JSON.parse)
      .catch(() => null),
  );
  if (!parsed.success) return fail("Check your purchase details.", 400);
  const { product, requestId, listing, start } = parsed.data;
  if (product === "pro" && !process.env.RAZORPAY_PRO_PLAN_ID)
    return fail("Configure a matching monthly test plan.", 503);
  const db = serviceClient();
  const result = await db.rpc("billing_reserve", {
    p_user: user.id,
    p_request: requestId,
    p_product: product,
    p_listing: listing ?? null,
    p_start: start ?? null,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
  });
  if (result.error?.message?.includes("price_changed"))
    return fail(
      "The price has changed. Refresh this page to review the current price.",
      409,
    );
  if (result.error)
    return fail(
      "This reservation is unavailable. Check active orders, dates and listing approval.",
      409,
    );
  const order = result.data.order;
  let remote = order.provider_id as string | null;
  if (
    !result.data.new &&
    (!remote ||
      order.status !== "pending" ||
      Date.now() - Date.parse(order.created_at) >= 900000)
  )
    return fail(
      "This checkout is no longer open. Review your billing history.",
      409,
    );
  if (!remote) {
    try {
      const checkout = await provider().create({
        id: order.id,
        product: order.product,
        amount: order.amount,
        currency: order.currency,
      });
      remote = checkout.id;
      const saved = await db
        .from("orders")
        .update({ provider_id: remote, status: "pending" })
        .eq("id", order.id)
        .eq("status", "creating")
        .select("id")
        .single();
      if (saved.error) throw new Error("Could not record checkout.");
    } catch {
      return fail(
        "Test checkout could not open. Check merchant settings. The temporary reservation expires in 15 minutes.",
        503,
      );
    }
  }
  return Response.json({
    order: order.id,
    providerId: remote,
    key: process.env.RAZORPAY_KEY_ID,
    product: order.product,
    amount: order.amount,
    currency: order.currency,
  });
}
