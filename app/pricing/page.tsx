import Link from "next/link";
import { brand } from "@/lib/brand";
import { currentUser } from "@/lib/account/server";
import { prices } from "@/lib/billing/server";
import { formatAmount } from "@/lib/billing/contracts";
import { billingConfigured } from "@/lib/billing/razorpay";
import Checkout from "@/components/billing/Checkout";
import "@/components/billing/billing.css";
export const metadata = {
  title: "Pricing",
  description:
    "Explore free community tools, monthly Creator Pro pricing and scheduled promotional placements.",
};
export default async function Pricing() {
  const [catalog, user] = await Promise.all([prices(), currentUser()]);
  const pro = catalog.find((p) => p.product === "pro")!;
  return (
    <main className="bill-page">
      <header className="bill-intro">
        <h1>Community tools, clearly priced.</h1>
        <p>
          Start with free tools. Choose a monthly creator subscription or
          reserve a labeled placement for an approved community.
        </p>
      </header>
      <div className="bill-grid">
        <article className="bill-panel">
          <h2>Free</h2>
          <p className="bill-price">$0</p>
          <ul>
            <li>Browser-based community tools</li>
            <li>Public sharing and standard themes</li>
            <li>Community directory submissions</li>
          </ul>
          <Link className="bill-button" href="/tools">
            Explore free tools
          </Link>
        </article>
        <article className="bill-panel accent">
          <h2>Creator Pro</h2>
          <p className="bill-price">
            {formatAmount(pro.amount, pro.currency)} <small>/ month</small>
          </p>
          <ul>
            <li>Studio theme for shared projects</li>
            <li>Optional removal of public project attribution</li>
            <li>Higher hosted project limits</li>
          </ul>
          <p>
            Monthly test subscription. Test plans authorize up to 12 billing
            cycles. Cancel future renewal from your billing dashboard.
          </p>
          <Checkout
            amount={pro.amount}
            currency={pro.currency}
            brand={brand.name}
            product="pro"
            signedIn={!!user}
            configured={
              billingConfigured() && !!process.env.RAZORPAY_PRO_PLAN_ID
            }
          />
        </article>
      </div>
      <section>
        <h2>Promote a community</h2>
        <p>
          Book a seven-day sponsored placement. Each active placement is
          labeled. Organic discovery ranks independently.
        </p>
        <Link className="bill-link" href="/promote">
          Explore placements
        </Link>
      </section>
    </main>
  );
}
