import { createHash } from "node:crypto";
import { serviceClient } from "@/lib/account/server";
import { billingConfigured, provider } from "@/lib/billing/razorpay";
import { readEvent } from "@/lib/billing/events";
import { fail, readLimited } from "@/lib/billing/http";
export async function POST(req: Request) {
  if (!billingConfigured()) return fail("Webhook disabled.", 503);
  const id = req.headers.get("x-razorpay-event-id") ?? "";
  if (!/^[\w-]{1,128}$/.test(id))
    return fail("Invalid delivery identifier.", 400);
  const raw = await readLimited(req, 131072).catch(() => null);
  if (
    !raw ||
    !provider().verifyWebhook(
      raw,
      req.headers.get("x-razorpay-signature") ?? "",
    )
  )
    return fail("Invalid delivery signature.", 400);
  let event;
  try {
    event = readEvent(raw);
  } catch {
    return fail("Invalid event payload.", 400);
  }
  if (event) {
    const result = await serviceClient().rpc("billing_apply_event", {
      p_event: id,
      p_digest: createHash("sha256").update(raw).digest("hex"),
      p_kind: event.kind,
      p_data: event.data,
    });
    if (result.error) return fail("Delivery pending reconciliation.", 503);
  }
  return Response.json({ received: true });
}
