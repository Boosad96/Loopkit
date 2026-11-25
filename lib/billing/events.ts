import { z } from "zod";

const id = (prefix: string) =>
  z
    .string()
    .regex(new RegExp("^" + prefix + "_[A-Za-z0-9]+$"))
    .max(100);
const timestamp = z.number().int().nonnegative().max(9999999999);
const notes = z.preprocess(
  (value) =>
    value === null || (Array.isArray(value) && value.length === 0) ? {} : value,
  z
    .object({ loopkit_order: z.string().uuid().optional() })
    .passthrough()
    .optional(),
);
const envelope = z.object({
  event: z.string().max(100),
  created_at: timestamp,
  payload: z.record(z.string(), z.unknown()),
});
const payment = z.object({
  id: id("pay"),
  order_id: id("order").nullable().optional(),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.string(),
  notes,
});
const subscription = z.object({
  id: id("sub"),
  current_end: timestamp.nullable().optional(),
  notes,
});
const refund = z.object({
  id: id("rfnd"),
  payment_id: id("pay"),
  amount: z.number().int().positive(),
});
const lifecycle = [
  "activated",
  "authenticated",
  "pending",
  "halted",
  "paused",
  "resumed",
  "completed",
  "cancelled",
  "updated",
];
export function readEvent(raw: string) {
  const event = envelope.parse(JSON.parse(raw));
  const data: Record<string, string | number> = { at: event.created_at };
  if (
    event.event === "payment.captured" ||
    event.event === "payment.failed" ||
    event.event === "subscription.charged"
  ) {
    const p = z.object({ entity: payment }).parse(event.payload.payment).entity;
    if (p.status !== (event.event === "payment.failed" ? "failed" : "captured"))
      throw new Error("Unexpected payment state.");
    Object.assign(data, {
      payment: p.id,
      amount: p.amount,
      currency: p.currency,
      providerId: p.order_id ?? "",
      localId: p.notes?.loopkit_order ?? "",
    });
  }
  if (
    event.event === "subscription.charged" ||
    lifecycle.some((state) => event.event === "subscription." + state)
  ) {
    const sub = z
      .object({ entity: subscription })
      .parse(event.payload.subscription).entity;
    if (event.event === "subscription.charged" && !sub.current_end)
      throw new Error("Missing billing period.");
    Object.assign(data, {
      providerId: sub.id,
      localId: sub.notes?.loopkit_order ?? "",
      until: sub.current_end ?? 0,
    });
  } else if (/^refund[.](created|processed|failed)$/.test(event.event)) {
    const r = z.object({ entity: refund }).parse(event.payload.refund).entity;
    Object.assign(data, {
      refund: r.id,
      payment: r.payment_id,
      amount: r.amount,
    });
  } else if (!["payment.captured", "payment.failed"].includes(event.event)) {
    return null;
  }
  return { kind: event.event, data };
}
