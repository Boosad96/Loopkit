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
    .from("projects")
    .select("id,slug,kind,title,updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .order("id")
    .range((page - 1) * 24, page * 24);
  return (
    <Page title="Your projects">
      <AccountNav />
      {error ? (
        <Notice code="unavailable" />
      ) : data?.length ? (
        <div className={styles.grid}>
          {data.slice(0, 24).map((p) => (
            <article key={p.id} className={styles.card}>
              <small>{p.kind.replaceAll("-", " ")}</small>
              <h2>{p.title}</h2>
              <p>Updated {p.updated_at.slice(0, 10)}</p>
              <div className={styles.row}>
                <Link href={"/create?edit=" + p.slug}>Edit project</Link>
                <Link href={"/s/" + p.slug}>Public view</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.panel}>
          <h2>No projects on this page</h2>
          <Link href="/create">Create an Event Hub</Link>
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
