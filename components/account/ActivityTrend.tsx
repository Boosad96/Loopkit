import { userClient } from "@/lib/account/server";
import { styles } from "./ui";
type ActivityDay = { day: string; visits: number; shares: number };
export default async function ActivityTrend() {
  const db = await userClient();
  const response = await db?.rpc("activity_trend");
  const rows = (response?.data || []) as ActivityDay[];
  const max = Math.max(
    1,
    ...rows.map((row) => Math.max(row.visits, row.shares)),
  );
  return (
    <section className={styles.panel}>
      <h2>Daily project activity</h2>
      <p>
        Shared visits and share actions from consenting visitors over the past
        30 days, in UTC.
      </p>
      {response?.error ? (
        <p>Daily analytics are unavailable.</p>
      ) : !rows.length ? (
        <p>No measured project activity in this period.</p>
      ) : (
        <div className={styles.trends}>
          {rows.map((row) => (
            <div key={row.day}>
              <time dateTime={row.day}>{row.day}</time>
              <div>
                {(["visits", "shares"] as const).map((kind) => (
                  <div key={kind} className={styles.series}>
                    <span>
                      {row[kind]} {kind}
                    </span>
                    <i
                      aria-hidden="true"
                      style={{ width: (row[kind] / max) * 100 + "%" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
