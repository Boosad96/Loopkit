import { requireAdmin, serviceClient } from "@/lib/account/server";
import { formatAmount, products, type Product } from "@/lib/billing/contracts";
import { prices } from "@/lib/billing/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import "@/components/billing/billing.css";
export const metadata = {
  title: "Billing administration",
  robots: { index: false, follow: false },
};
async function updatePrice(form: FormData) {
  "use server";
  const admin = await requireAdmin();
  const data = z
    .object({
      product: z.enum(["pro", "featured", "category", "homepage"]),
      amount: z.coerce.number().int().min(1).max(10000000),
      currency: z.enum(["USD", "INR"]),
    })
    .parse({
      product: form.get("product"),
      amount: form.get("amount"),
      currency: form.get("currency"),
    });
  const { error } = await serviceClient().rpc("billing_set_price", {
    p_actor: admin.id,
    p_product: data.product,
    p_amount: data.amount,
    p_currency: data.currency,
  });
  if (error) throw new Error("Could not update price.");
  revalidatePath("/pricing");
  revalidatePath("/promote");
  revalidatePath("/admin/billing");
}
async function withdraw(form: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = z.string().uuid().parse(form.get("sponsorship"));
  const { error } = await serviceClient().rpc("billing_withdraw_placement", {
    p_actor: admin.id,
    p_sponsor: id,
  });
  if (error) throw new Error("Could not withdraw placement.");
  revalidatePath("/admin/billing");
}
export default async function AdminBilling() {
  await requireAdmin();
  const db = serviceClient();
  const [catalog, orders, refunds, subscriptions] = await Promise.all([
    prices(),
    db
      .from("orders")
      .select(
        "id,product,amount,currency,status,created_at,provider_id,sponsorships(id,slot_id,starts_at,ends_at,status)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("billing_refunds")
      .select("id,payment_id,amount,status")
      .order("updated_at", { ascending: false })
      .limit(100),
    db
      .from("subscriptions")
      .select("order_id,status,paid_until")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  return (
    <main className="bill-page">
      <header className="bill-intro">
        <h1>Billing administration</h1>
        <p>
          Test transactions, slot reservations and confirmed provider refunds.
          Orders marked review require merchant reconciliation.
        </p>
      </header>
      <section>
        <h2>Server prices</h2>
        <div className="bill-grid">
          {catalog.map((p) => (
            <form
              key={p.product}
              action={updatePrice}
              className="bill-panel bill-form"
            >
              <h3>{products[p.product].title}</h3>
              <input type="hidden" name="product" value={p.product} />
              <label>
                Amount in minor units
                <input
                  type="number"
                  min="1"
                  max="10000000"
                  name="amount"
                  defaultValue={p.amount}
                  required
                />
              </label>
              <label>
                Currency
                <select name="currency" defaultValue={p.currency}>
                  <option>USD</option>
                  <option>INR</option>
                </select>
              </label>
              <button className="bill-button">Save price</button>
            </form>
          ))}
        </div>
      </section>
      <section>
        <h2>Latest orders and reservations</h2>
        {orders.error ? (
          <p>Orders unavailable.</p>
        ) : orders.data?.length ? (
          <div className="bill-table">
            <table>
              <tbody>
                {orders.data.map((o) => (
                  <tr key={o.id}>
                    <th>{products[o.product as Product]?.title}</th>
                    <td>{formatAmount(o.amount, o.currency)}</td>
                    <td>{o.status}</td>
                    <td>{o.provider_id}</td>
                    <td>
                      {o.sponsorships.map((s) => (
                        <div key={s.slot_id}>
                          {s.slot_id} · {s.starts_at.slice(0, 10)} to{" "}
                          {s.ends_at.slice(0, 10)} · {s.status}
                          {["confirmed", "held"].includes(s.status) && (
                            <details>
                              <summary>Withdraw placement</summary>
                              <form action={withdraw}>
                                <input
                                  type="hidden"
                                  name="sponsorship"
                                  value={s.id}
                                />
                                <button className="bill-button">
                                  Confirm withdrawal
                                </button>
                              </form>
                            </details>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No orders recorded.</p>
        )}
      </section>
      <section>
        <h2>Subscriptions</h2>
        {subscriptions.error ? (
          <p>Subscription history unavailable.</p>
        ) : subscriptions.data?.length ? (
          subscriptions.data.map((s) => (
            <p key={s.order_id}>
              {s.order_id} · {s.status} · {s.paid_until ?? "Awaiting capture"}
            </p>
          ))
        ) : (
          <p>No subscriptions recorded.</p>
        )}
      </section>
      <section>
        <h2>Refund records</h2>
        {refunds.error ? (
          <p>Refund history unavailable.</p>
        ) : refunds.data?.length ? (
          refunds.data.map((r) => (
            <p key={r.id}>
              {r.id} · {r.amount} minor units · {r.status}
            </p>
          ))
        ) : (
          <p>No refund records.</p>
        )}
      </section>
    </main>
  );
}
