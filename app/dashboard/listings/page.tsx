import Link from "next/link";
import { requireUser, userClient } from "@/lib/account/server";
import {
  Page,
  styles,
  AccountNav,
  Notice,
  one,
  type Query,
} from "@/components/account/ui";
export default async function Screen({
  searchParams,
}: {
  searchParams: Query;
}) {
  const user = await requireUser(),
    db = (await userClient())!,
    q = await searchParams;
  const page = Math.max(1, Math.min(1000, parseInt(one(q.page), 10) || 1));
  const { data, error } = await db
    .from("community_listings")
    .select("id,name,slug,status,vote_count")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 24, page * 24);
  return (
    <Page title="Your listings">
      <AccountNav />
      <Notice code={one(q.notice)} />
      <p>
        <Link className={styles.button} href="/submit">
          Submit a community
        </Link>
      </p>
      {error ? (
        <Notice code="unavailable" />
      ) : !data?.length ? (
        <p>No listings on this page.</p>
      ) : (
        <div className={styles.grid}>
          {data.slice(0, 24).map((p) => (
            <article className={styles.card} key={p.id}>
              <small>{p.status}</small>
              <h2>{p.name}</h2>
              <p>{p.vote_count} votes</p>
              <div className={styles.row}>
                {p.status !== "removed" && (
                  <Link href={"/submit?edit=" + p.id}>Edit listing</Link>
                )}
                {p.status === "approved" && (
                  <Link href={"/community/" + p.slug}>Public view</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <nav className={styles.pager}>
        {page > 1 && <Link href={"?page=" + (page - 1)}>Previous</Link>}
        {(data?.length || 0) > 24 && (
          <Link href={"?page=" + (page + 1)}>Next</Link>
        )}
      </nav>
    </Page>
  );
}
