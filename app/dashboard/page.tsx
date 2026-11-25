import Link from "next/link";
import { requireUser, userClient } from "@/lib/account/server";
import { Page, styles, AccountNav } from "@/components/account/ui";
export default async function Screen() {
  const user = await requireUser();
  const db = (await userClient())!;
  const [profile, projects, listings] = await Promise.all([
    db.from("profiles").select("display_name,role").eq("id", user.id).single(),
    db
      .from("projects")
      .select("id", { head: true, count: "exact" })
      .eq("owner_id", user.id),
    db
      .from("community_listings")
      .select("id", { head: true, count: "exact" })
      .eq("owner_id", user.id),
  ]);
  return (
    <Page
      title={
        profile.data?.display_name
          ? "Welcome, " + profile.data.display_name
          : "Your workspace"
      }
      intro="Manage the experiences you create and the communities you share."
    >
      <AccountNav />
      <div className={styles.grid}>
        {[
          ["Projects", projects, "/dashboard/projects"],
          ["Community listings", listings, "/dashboard/listings"],
        ].map(([label, r, href]) => {
          const result = r as typeof projects;
          return (
            <div className={styles.card} key={String(href)}>
              <h2>{String(label)}</h2>
              <p className={styles.count}>
                {result.error ? "Unavailable" : result.count}
              </p>
              <Link href={String(href)}>
                View {String(label).toLowerCase()}
              </Link>
            </div>
          );
        })}
      </div>
      <div className={styles.authlinks}>
        <Link className={styles.button} href="/create">
          Create a project
        </Link>
        <Link href="/submit">Submit a listing</Link>
        {["moderator", "admin"].includes(profile.data?.role) && (
          <Link href="/admin">Moderation console</Link>
        )}
      </div>
    </Page>
  );
}
