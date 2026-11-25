import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readEvent } from "../lib/billing/events";
import {
  billingConfigured,
  hmacMatches,
  RazorpayTest,
} from "../lib/billing/razorpay";
const sign = (s: string, secret: string) =>
  createHmac("sha256", secret).update(s).digest("hex");
function configure() {
  vi.stubEnv("BILLING_TEST_ENABLED", "true");
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "development-checkout");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "development-webhook");
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Razorpay test adapter", () => {
  it("requires test-only credentials and explicit opt-in", () => {
    configure();
    expect(billingConfigured()).toBe(true);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_example");
    expect(() => new RazorpayTest()).toThrow();
  });
  it("checks order and subscription signatures using the stored provider ID in the documented order", () => {
    configure();
    const p = new RazorpayTest();
    expect(
      p.verifyCheckout(
        "order_demo",
        "pay_demo",
        sign("order_demo|pay_demo", "development-checkout"),
        "order",
      ),
    ).toBe(true);
    expect(
      p.verifyCheckout(
        "sub_demo",
        "pay_demo",
        sign("pay_demo|sub_demo", "development-checkout"),
        "subscription",
      ),
    ).toBe(true);
    expect(
      p.verifyCheckout(
        "sub_other",
        "pay_demo",
        sign("pay_demo|sub_demo", "development-checkout"),
        "subscription",
      ),
    ).toBe(false);
  });
  it("verifies exact raw webhook bytes and rejects malformed signatures", () => {
    configure();
    const p = new RazorpayTest();
    const body = ' {"event":"payment.captured"}';
    const signature = sign(body, "development-webhook");
    expect(p.verifyWebhook(body, signature)).toBe(true);
    expect(p.verifyWebhook(body.trim(), signature)).toBe(false);
    expect(hmacMatches(body, "abc", "development-webhook")).toBe(false);
  });
  it("creates a server-priced order and includes its stable receipt", async () => {
    configure();
    const mock = vi.fn(async () => Response.json({ id: "order_demo" }));
    vi.stubGlobal("fetch", mock);
    expect(
      await new RazorpayTest().create({
        id: "local",
        amount: 499,
        currency: "USD",
        product: "featured",
      }),
    ).toMatchObject({ id: "order_demo", kind: "order" });
    expect(mock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/orders",
      expect.objectContaining({
        body: JSON.stringify({
          amount: 499,
          currency: "USD",
          receipt: "local",
          notes: { loopkit_order: "local" },
        }),
      }),
    );
  });
  it("refuses monthly subscriptions priced differently on the provider plan", async () => {
    configure();
    vi.stubEnv("RAZORPAY_PRO_PLAN_ID", "plan_demo");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          period: "monthly",
          interval: 1,
          item: { amount: 999, currency: "USD" },
        }),
      ),
    );
    await expect(
      new RazorpayTest().create({
        id: "local",
        amount: 599,
        currency: "USD",
        product: "pro",
      }),
    ).rejects.toThrow("differ");
  });
});
describe("provider webhook normalization", () => {
  const event = {
    event: "subscription.charged",
    created_at: 1711000000,
    payload: {
      subscription: { entity: { id: "sub_123", current_end: 1711000001 } },
      payment: {
        entity: {
          id: "pay_123",
          amount: 599,
          currency: "USD",
          status: "captured",
          order_id: "order_123",
        },
      },
    },
  };
  it("matches renewal to the stored subscription and trusts the paid period only after a captured charge", () => {
    expect(readEvent(JSON.stringify(event))).toMatchObject({
      kind: "subscription.charged",
      data: { providerId: "sub_123", payment: "pay_123", until: 1711000001 },
    });
    expect(() =>
      readEvent(
        JSON.stringify({
          ...event,
          payload: {
            ...event.payload,
            subscription: { entity: { id: "sub_123" } },
          },
        }),
      ),
    ).toThrow();
  });
  it("rejects invalid capture state and unsupported events do nothing", () => {
    expect(() =>
      readEvent(
        JSON.stringify({
          ...event,
          payload: {
            ...event.payload,
            payment: {
              entity: { ...event.payload.payment.entity, status: "authorized" },
            },
          },
        }),
      ),
    ).toThrow();
    expect(
      readEvent(
        JSON.stringify({ event: "invoice.issued", created_at: 1, payload: {} }),
      ),
    ).toBeNull();
  });
});
