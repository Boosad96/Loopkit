import ActivityTrend from "@/components/account/ActivityTrend";
import { hasPro } from "@/lib/billing/server";
import { AccountNav, Page, Notice, styles } from "@/components/account/ui";
import { userClient, requireUser } from "@/lib/account/server";
export default async function Screen() {
  const user = await requireUser();
  const pro = await hasPro(user.id);
  const { data, error } = await (await userClient())!.rpc("usage_summary");
  return (
    <Page
      title="Project analytics"
      intro="Consenting visitor activity on your shared projects during the last 30 days."
    >
      <AccountNav />
      {pro && <ActivityTrend />}
      {error ? (
        <Notice code="unavailable" />
      ) : !data?.length ? (
        <div className={styles.panel}>
          <h2>No measured activity yet</h2>
          <p>
            Share a project to begin collecting visits from participants who
            allow usage measurement.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {(data as { event: string; total: number; visitors: number }[]).map(
            (t) => (
              <article className={styles.card} key={t.event}>
                <h2>{t.event.replaceAll("_", " ")}</h2>
                <p className={styles.count}>{t.total}</p>
                <small>{t.visitors} unique browsers</small>
              </article>
            ),
          )}
        </div>
      )}
    </Page>
  );
}
