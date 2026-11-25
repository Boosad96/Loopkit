import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CheckoutInput, PaymentProvider, ProviderCheckout } from './contracts';

export function hmacMatches(body: string, signature: string, secret: string) {
  if (!secret || !/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export function billingConfigured() {
  return process.env.BILLING_TEST_ENABLED === 'true' && /^rzp_test_\w+$/.test(process.env.RAZORPAY_KEY_ID ?? '') && Boolean(process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
}
export class RazorpayTest implements PaymentProvider {
  private readonly key: string;
  constructor() {
    if (!billingConfigured()) throw new Error('Test checkout needs Razorpay configuration.');
    this.key = process.env.RAZORPAY_KEY_ID!;
  }
  private async request(path: string, payload?: Record<string, unknown>) {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: payload ? 'POST' : 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { authorization: `Basic ${Buffer.from(`${this.key}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`, 'content-type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!response.ok) throw new Error('Test payment provider could not complete the request.');
    return await response.json();
  }
  async create(input: CheckoutInput): Promise<ProviderCheckout> {
    if (input.product === 'pro') {
      const plan = process.env.RAZORPAY_PRO_PLAN_ID;
      if (!plan || !/^plan_\w+$/.test(plan)) throw new Error('Configure a matching monthly test plan.');
      const selected = await this.request(`plans/${plan}`);
      if (selected.period !== 'monthly' || selected.interval !== 1 || selected.item?.currency !== input.currency || selected.item?.amount !== input.amount) throw new Error('Test plan and server price differ.');
      const subscription = await this.request('subscriptions', { plan_id: plan, total_count: 12, quantity: 1, customer_notify: 0, expire_by: Math.floor(Date.now() / 1000) + 900, notes: { loopkit_order: input.id } });
      if (!/^sub_\w+$/.test(subscription.id)) throw new Error('Unexpected provider identifier.');
      return { kind: 'subscription', id: subscription.id, key: this.key };
    }
    const order = await this.request('orders', { amount: input.amount, currency: input.currency, receipt: input.id, notes: { loopkit_order: input.id } });
    if (!/^order_\w+$/.test(order.id)) throw new Error('Unexpected provider identifier.');
    return { kind: 'order', id: order.id, key: this.key };
  }
  async cancelAtCycleEnd(id: string) {
    if (!/^sub_\w+$/.test(id)) throw new Error('Invalid subscription.');
    await this.request(`subscriptions/${id}/cancel`, { cancel_at_cycle_end: 1 });
  }
  verifyCheckout(providerId: string, paymentId: string, signature: string, kind: ProviderCheckout['kind']) {
    const body = kind === 'order' ? `${providerId}|${paymentId}` : `${paymentId}|${providerId}`;
    return hmacMatches(body, signature, process.env.RAZORPAY_KEY_SECRET ?? '');
  }
  verifyWebhook(body: string, signature: string) {
    return hmacMatches(body, signature, process.env.RAZORPAY_WEBHOOK_SECRET ?? '');
  }
}
export function provider(): PaymentProvider { return new RazorpayTest(); }
