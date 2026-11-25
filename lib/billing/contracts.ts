export const products = {
  pro: { title: "Creator Pro", amount: 599, interval: "per month" },
  featured: {
    title: "Featured community",
    amount: 499,
    interval: "for 7 days",
  },
  category: {
    title: "Category sponsorship",
    amount: 1499,
    interval: "for 7 days",
  },
  homepage: {
    title: "Homepage Spotlight",
    amount: 2999,
    interval: "for 7 days",
  },
} as const;
export type Product = keyof typeof products;
export type Price = { product: Product; amount: number; currency: string };
export const defaults: Price[] = (Object.keys(products) as Product[]).map(
  (product) => ({ product, amount: products[product].amount, currency: "USD" }),
);
export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount / 100,
  );
}
export type ProviderCheckout = {
  kind: "order" | "subscription";
  id: string;
  key: string;
};
export type CheckoutInput = {
  id: string;
  amount: number;
  currency: string;
  product: Product;
};
export interface PaymentProvider {
  create(input: CheckoutInput): Promise<ProviderCheckout>;
  cancelAtCycleEnd(id: string): Promise<"ended" | "scheduled">;
  verifyCheckout(
    providerId: string,
    paymentId: string,
    signature: string,
    kind: ProviderCheckout["kind"],
  ): boolean;
  verifyWebhook(body: string, signature: string): boolean;
}
