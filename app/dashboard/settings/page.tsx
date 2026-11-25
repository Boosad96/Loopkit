import Link from "next/link";
import {
  Page,
  styles,
  AccountNav,
  Notice,
  one,
  type Query,
} from "@/components/account/ui";
import { requireUser, userClient } from "@/lib/account/server";
import {
  saveProfile,
  deleteAccount,
  signOut,
} from "@/lib/account/auth-actions";
import { AnalyticsPreferences } from "@/components/account/Analytics";
export default async function Screen({
  searchParams,
}: {
  searchParams: Query;
}) {
  const user = await requireUser(),
    db = (await userClient())!;
  const { data } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  return (
    <Page title="Account settings" intro={user.email}>
      <AccountNav />
      <Notice code={one((await searchParams).notice)} />
      <div className={styles.stack}>
        <form className={styles.form} action={saveProfile}>
          <label>
            Display name
            <input
              name="name"
              defaultValue={data?.display_name || ""}
              maxLength={80}
              required
            />
          </label>
          <button>Save display name</button>
        </form>
        <section className={styles.panel}>
          <h2>Account access</h2>
          <div className={styles.row}>
            <Link href="/auth/forgot">Reset password</Link>
            <a href="/api/account/export" download>
              Download my data
            </a>
          </div>
          <form action={signOut}>
            <button>Sign out</button>
          </form>
        </section>
        <div className={styles.panel}>
          <AnalyticsPreferences />
        </div>
        <form className={styles.form} action={deleteAccount}>
          <h2>Delete account</h2>
          <p>
            Deletion permanently removes your profile, projects, listings and
            votes. Billing records may be retained. Sign in again within ten
            minutes of deletion.
          </p>
          <label>
            Type DELETE to confirm
            <input
              name="confirm"
              required
              pattern="DELETE"
              autoComplete="off"
            />
          </label>
          <button className={styles.danger}>
            Delete my account permanently
          </button>
        </form>
      </div>
    </Page>
  );
}
