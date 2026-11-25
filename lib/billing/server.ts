import "server-only";
import { currentUser, serviceClient } from "@/lib/account/server";
import { defaults, type Price } from "./contracts";
import { billingConfigured } from "./razorpay";
export async function prices(): Promise<Price[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return defaults;
  const { data, error } = await serviceClient()
    .from("billing_prices")
    .select("product,amount,currency");
  if (error || !data?.length) return defaults;
  return data as Price[];
}
export async function hasPro(userId: string) {
  if (!billingConfigured()) return false;
  const { data, error } = await serviceClient().rpc("billing_has_pro", {
    p_user: userId,
  });
  return !error && data === true;
}
export async function authenticatedWrite(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return null;
  return await currentUser();
}
export { readLimited, fail } from "./http";
/** Close recurring mandates before removing a billing owner. A provider outage leaves the account intact for retry. */
export async function prepareBillingDeletion(userId: string) {
  const db = serviceClient();
  const { data, error } = await db
    .from("subscriptions")
    .select(
      "order_id,cancel_scheduled,status,orders!inner(provider_id,created_at)",
    )
    .eq("user_id", userId)
    .not("status", "in", "(cancelled,expired,completed)")
    .limit(10);
  if (error) throw new Error("Cannot verify recurring billing.");
  for (const s of data ?? []) {
    if (s.cancel_scheduled) continue;
    const order = s.orders as unknown as {
      provider_id: string | null;
      created_at: string;
    };
    if (
      s.status === "created" &&
      Date.parse(order.created_at) + 20 * 60 * 1000 < Date.now() &&
      !order.provider_id
    )
      continue;
    if (!order.provider_id)
      throw new Error(
        "A checkout is still being created. Retry after its reservation expires.",
      );
    const { provider } = await import("./razorpay");
    await provider().cancelAtCycleEnd(order.provider_id);
    const saved = await db
      .from("subscriptions")
      .update({ cancel_scheduled: true })
      .eq("order_id", s.order_id);
    if (saved.error) throw new Error("Cannot confirm renewal cancellation.");
  }
}
