import { brand } from "@/lib/brand";
import { currentUser, serviceClient } from "@/lib/account/server";
import { prices } from "@/lib/billing/server";
import { formatAmount, products } from "@/lib/billing/contracts";
import { billingConfigured } from "@/lib/billing/razorpay";
import Checkout from "@/components/billing/Checkout";
import "@/components/billing/billing.css";
export const metadata = {
  title: "Promote your community",
  description:
    "Explore scheduled, labeled placements for approved community listings.",
};
const details = {
  featured: "A dedicated placement on the community discovery page.",
  category: "Reach visitors exploring your community category.",
  homepage: "Showcase your community on the homepage.",
};
export default async function Promote() {
  const [catalog, user] = await Promise.all([prices(), currentUser()]);
  const today = new Date();
  const utcDay = (days: number) =>
    new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const db =
    user && process.env.SUPABASE_SERVICE_ROLE_KEY ? serviceClient() : null;
  const listings = db
    ? ((
        await db
          .from("community_listings")
          .select("id,name")
          .eq("owner_id", user!.id)
          .eq("status", "approved")
          .order("name")
          .limit(100)
      ).data ?? [])
    : [];
  const { data: bookings } = db
    ? await db
        .from("sponsorships")
        .select("slot_id,starts_at,ends_at")
        .gt("ends_at", new Date().toISOString())
        .or(
          "status.eq.confirmed,and(status.eq.held,hold_until.gt." +
            new Date().toISOString() +
            ")",
        )
        .order("starts_at")
        .limit(100)
    : { data: [] };
  return (
    <main className="bill-page">
      <header className="bill-intro">
        <h1>Put your community in the spotlight.</h1>
        <p>
          Reserve one week at a time. Bookings start at midnight UTC. Choose an
          approved listing and a start date within the next 90 days.
        </p>
      </header>
      <div className="bill-grid">
        {catalog
          .filter((p) => p.product !== "pro")
          .map((p) => (
            <article className="bill-panel" key={p.product}>
              <h2>{products[p.product].title}</h2>
              <p>{details[p.product as keyof typeof details]}</p>
              <p className="bill-price">
                {formatAmount(p.amount, p.currency)} <small>/ week</small>
              </p>
              <Checkout
                dateWindow={{ first: utcDay(1), last: utcDay(90) }}
                configured={billingConfigured()}
                signedIn={!!user}
                listings={listings}
                product={p.product}
                amount={p.amount}
                currency={p.currency}
                brand={brand.name}
              />
            </article>
          ))}
      </div>
      <section>
        <h2>Placement availability</h2>
        <p>
          Each slot hosts one campaign at a time. Checkout holds a slot for 15
          minutes. An expired campaign automatically leaves the page.
        </p>
        {db ? (
          bookings?.length ? (
            <ul>
              {bookings.map((b) => (
                <li key={b.slot_id + b.starts_at}>
                  {b.slot_id} · {b.starts_at.slice(0, 10)} to{" "}
                  {b.ends_at.slice(0, 10)} UTC
                </li>
              ))}
            </ul>
          ) : (
            <p>No upcoming reservations are recorded.</p>
          )
        ) : (
          <p>Sign in with an approved listing to see upcoming reservations.</p>
        )}
      </section>
    </main>
  );
}
