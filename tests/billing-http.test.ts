import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/account/server", () => ({ serviceClient: () => ({ rpc }) }));
import { POST } from "../app/api/billing/webhook/route";
const secret = "local-suite-only";
const url = "https://loopkit.example/api/billing/webhook";
const body = JSON.stringify({
  event: "payment.captured",
  created_at: 1760000000,
  payload: {
    payment: {
      entity: {
        id: "pay_sandbox",
        amount: 499,
        currency: "USD",
        status: "captured",
        order_id: "order_sandbox",
        notes: [],
      },
    },
  },
});
const signature = (raw: string) =>
  createHmac("sha256", secret).update(raw).digest("hex");
function request(raw = body, sig = signature(raw), id = "test-event-1") {
  return new Request(url, {
    method: "POST",
    body: raw,
    headers: { "x-razorpay-event-id": id, "x-razorpay-signature": sig },
  });
}
beforeEach(() => {
  vi.stubEnv("BILLING_TEST_ENABLED", "true");
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_local");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "unused-suite-secret");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", secret);
  rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("webhook HTTP boundary", () => {
  it("passes a signed and validated event to the atomic payment ledger and acknowledges replays", async () => {
    rpc
      .mockResolvedValueOnce({ data: "applied", error: null })
      .mockResolvedValueOnce({ data: "duplicate", error: null });
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "billing_apply_event",
      expect.objectContaining({
        p_event: "test-event-1",
        p_kind: "payment.captured",
        p_data: expect.objectContaining({
          providerId: "order_sandbox",
          payment: "pay_sandbox",
        }),
      }),
    );
  });
  it("rejects invalid signatures, altered original bytes and malformed signed payloads before database access", async () => {
    expect((await POST(request(body, "aa"))).status).toBe(400);
    expect((await POST(request(body + " ", signature(body)))).status).toBe(400);
    expect((await POST(request("{}"))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns retryable failure when transaction cannot be applied", async () => {
    rpc.mockResolvedValue({ error: { message: "amount_mismatch" } });
    expect((await POST(request())).status).toBe(503);
  });
  it("fails closed without a test key and rejects oversized requests", async () => {
    expect((await POST(request("a".repeat(140000)))).status).toBe(400);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_local");
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});
