import { requireAdmin, userClient } from "@/lib/account/server";
import { Notice, styles } from "./ui";
import { GrowthBars } from "./GrowthBars";
export default async function Growth() {
  await requireAdmin();
  const { data, error } = await (await userClient())!.rpc("growth_report");
  if (error || !data) return <Notice code="unavailable" />;
  const label = (n: number | null, suffix = "") =>
    n == null ? "Insufficient data" : n.toLocaleString("en") + suffix;
  const metrics = [
    ["Measured browsers", label(data.visitors)],
    ["Activation", label(data.activation, "%")],
    ["Creator share rate", label(data.share_rate, "%")],
    ["Shared visits per share", label(data.shared_visits_per_share)],
    ["Visitor to creator", label(data.visitor_creator, "%")],
    ["Referred creators per creator", label(data.viral_coefficient)],
    ["Returning account creators", label(data.returning_creators)],
    ["New registrations", label(data.registered)],
    ["Paid conversion (test)", label(data.paid_conversion, "%")],
    ["Created projects", label(data.projects)],
    ["Listing submissions", label(data.submissions)],
    ["Verified purchases (test)", label(data.purchases)],
  ];
  return (
    <section className={styles.stack}>
      <div className={styles.grid}>
        {metrics.map(([name, value]) => (
          <article className={styles.card} key={name}>
            <h2>{name}</h2>
            <p className={styles.count}>{value}</p>
          </article>
        ))}
      </div>
      <div className={styles.panel}>
        <h2>Conversion rates</h2>
        <GrowthBars
          rows={[
            ["Activation", data.activation],
            ["Sharing", data.share_rate],
            ["Visitor to creator", data.visitor_creator],
            ["Paid conversion (test)", data.paid_conversion],
          ]}
        />
      </div>
      <div className={styles.panel}>
        <h2>Monthly recurring revenue · test mode</h2>
        {Object.keys(data.mrr).length ? (
          Object.entries(data.mrr).map(([code, n]) => (
            <p key={code}>
              {new Intl.NumberFormat("en", {
                style: "currency",
                currency: code,
              }).format(Number(n) / 100)}
            </p>
          ))
        ) : (
          <p>No paid, renewing test subscriptions.</p>
        )}
      </div>
    </section>
  );
}
