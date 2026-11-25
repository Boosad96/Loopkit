import Growth from "@/components/account/Growth";
import Link from "next/link";
import { tools } from "@/lib/tools";
import { toolPolicies } from "@/lib/account/tools";
import { Page, Notice, styles, one, type Query } from "@/components/account/ui";
import { requireRole, userClient, serviceClient } from "@/lib/account/server";
import {
  moderate,
  settingsChange,
  cleanupAnalytics,
  setSuspension,
  projectVisibility,
  updateTool,
} from "@/lib/account/listing-actions";
const sections = [
  "listings",
  "reports",
  "accounts",
  "projects",
  "analytics",
  "settings",
  "audit",
] as const;
export default async function Screen({
  searchParams,
}: {
  searchParams: Query;
}) {
  const user = await requireRole(["moderator", "admin"]),
    db = (await userClient())!,
    q = await searchParams;
  const admin =
    (await db.from("profiles").select("role").eq("id", user.id).single()).data
      ?.role === "admin";
  const tabs = sections.filter(
    (t) => admin || ["listings", "reports", "audit"].includes(t),
  );
  const tab = tabs.find((t) => t === one(q.section)) || "listings";
  const page = Math.max(1, Math.min(1000, parseInt(one(q.page), 10) || 1)),
    start = (page - 1) * 20,
    end = start + 20;
  const filter = ["pending", "approved", "rejected", "removed"].includes(
    one(q.status),
  )
    ? one(q.status)
    : "pending";
  const [listings, reports, accounts, projects, usage, settings, audit] =
    await Promise.all([
      tab === "listings"
        ? db
            .from("community_listings")
            .select("id,name,description,platform,category,official_link")
            .eq("status", filter)
            .order("created_at")
            .order("id")
            .range(start, end)
        : null,
      tab === "reports"
        ? db
            .from("listing_reports")
            .select(
              "id,listing_id,reason,status,created_at,community_listings(name,official_link)",
            )
            .eq("status", "open")
            .order("created_at")
            .order("id")
            .range(start, end)
        : null,
      tab === "accounts"
        ? db
            .from("profiles")
            .select("id,display_name,role,suspended_at,created_at")
            .order("created_at", { ascending: false })
            .order("id")
            .range(start, end)
        : null,
      tab === "projects"
        ? serviceClient()
            .from("projects")
            .select("id,slug,kind,title,public_pages(visible)")
            .order("created_at", { ascending: false })
            .order("id")
            .range(start, end)
        : null,
      tab === "analytics" ? db.rpc("usage_summary") : null,
      tab === "settings" ? db.from("site_settings").select("key,value") : null,
      tab === "audit"
        ? db
            .from("moderation_actions")
            .select("id,action,target_id,created_at")
            .order("id", { ascending: false })
            .range(start, end)
        : null,
    ]);
  const policies = tab === "settings" ? await toolPolicies() : {};
  const pageRows = listings || reports || accounts || projects || audit;
  const visible = (pageRows?.data || []).slice(0, 20);
  function decision(id: string) {
    return (
      <form action={moderate} className={styles.row}>
        <input name="id" type="hidden" value={id} />
        <label>
          Decision{" "}
          <select name="decision">
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
            <option value="removed">Remove</option>
          </select>
        </label>
        <button>Apply decision</button>
      </form>
    );
  }
  return (
    <Page
      title="Administration"
      intro="Moderation, account controls and operational settings."
    >
      <Notice code={one(q.notice)} />
      <nav className={styles.nav} aria-label="Administration">
        {tabs.map((t) => (
          <Link href={"/admin?section=" + t} key={t}>
            {t[0].toUpperCase() + t.slice(1)}
          </Link>
        ))}
        {admin && (
          <>
            <Link href="/admin/billing">Billing</Link>
            <Link href="/admin/editorial">Editorial</Link>
          </>
        )}
      </nav>
      {tab === "listings" && (
        <nav className={styles.nav} aria-label="Listing status">
          {["pending", "approved", "rejected", "removed"].map((t) => (
            <Link key={t} href={"?section=listings&status=" + t}>
              {t}
            </Link>
          ))}
        </nav>
      )}
      <div className={styles.stack}>
        {[listings, reports, accounts, projects, usage, settings, audit].some(
          (r) => r?.error,
        ) ? (
          <Notice code="unavailable" />
        ) : (
          <>
            {pageRows && visible.length === 0 && (
              <p>No records on this page.</p>
            )}
            {listings?.data?.slice(0, 20).map((r) => (
              <article key={r.id} className={styles.panel}>
                <h2>{r.name}</h2>
                <p>{r.description}</p>
                <p>
                  {r.platform} · {r.category} ·{" "}
                  <a
                    href={r.official_link}
                    rel="ugc nofollow noopener noreferrer"
                    target="_blank"
                  >
                    Inspect official link
                  </a>
                </p>
                {decision(r.id)}
              </article>
            ))}
            {reports?.data?.slice(0, 20).map((r) => (
              <article key={r.id} className={styles.panel}>
                <h2>Listing report</h2>
                <p>{r.reason}</p>
                <p>
                  Listing {r.listing_id} · {r.created_at.slice(0, 10)}
                </p>
                {decision(r.listing_id)}
              </article>
            ))}
            {accounts?.data?.slice(0, 20).map((r) => (
              <article key={r.id} className={styles.panel}>
                <h2>{r.display_name || "Member"}</h2>
                <p>
                  {r.role} · {r.id} · {r.suspended_at ? "Suspended" : "Active"}
                </p>
                {r.role === "member" && (
                  <form action={setSuspension}>
                    <input name="id" type="hidden" value={r.id} />
                    <button
                      name="decision"
                      value={r.suspended_at ? "restore" : "suspend"}
                    >
                      {r.suspended_at ? "Restore access" : "Suspend account"}
                    </button>
                  </form>
                )}
              </article>
            ))}
            {projects?.data?.slice(0, 20).map((r) => (
              <article key={r.id} className={styles.panel}>
                <h2>{r.title}</h2>
                <p>
                  {r.kind} ·{" "}
                  <Link href={"/s/" + r.slug}>Review public page</Link>
                </p>
                <form action={projectVisibility}>
                  <input type="hidden" name="id" value={r.id} />
                  <label>
                    Public visibility{" "}
                    <select name="decision">
                      <option value="hide">Hide</option>
                      <option value="restore">Restore</option>
                    </select>
                  </label>
                  <button>Update visibility</button>
                </form>
              </article>
            ))}
            {tab === "analytics" && <Growth />}
            {tab === "analytics" && (
              <div className={styles.panel}>
                <h2>Last 30 days</h2>
                {!usage?.data?.length ? (
                  <p>No consenting visitor events recorded.</p>
                ) : (
                  (
                    usage.data as {
                      event: string;
                      total: number;
                      visitors: number;
                    }[]
                  ).map((t) => (
                    <p key={t.event}>
                      {t.event.replaceAll("_", " ")} · {t.total} events ·{" "}
                      {t.visitors} browsers
                    </p>
                  ))
                )}
                <Link href="/admin/billing">
                  Review verified financial activity
                </Link>
              </div>
            )}
            {tab === "settings" && (
              <section className={styles.panel}>
                <h2>Site settings</h2>
                <form action={settingsChange}>
                  <input type="hidden" name="setting" value="adsense_enabled" />
                  <label>
                    AdSense permission{" "}
                    <select
                      name="value"
                      defaultValue={String(
                        settings?.data?.find((v) => v.key === "adsense_enabled")
                          ?.value || false,
                      )}
                    >
                      <option value="false">Disabled</option>
                      <option value="true">Allowed on eligible pages</option>
                    </select>
                  </label>
                  <button>Save advertising preference</button>
                </form>
                <form action={settingsChange}>
                  <input
                    type="hidden"
                    name="setting"
                    value="analytics_retention_days"
                  />
                  <label>
                    Analytics retention in days{" "}
                    <input
                      name="value"
                      type="number"
                      min="1"
                      max="365"
                      required
                      defaultValue={Number(
                        settings?.data?.find(
                          (v) => v.key === "analytics_retention_days",
                        )?.value || 30,
                      )}
                    />
                  </label>
                  <button>Save retention</button>
                </form>
                <form action={cleanupAnalytics}>
                  <button>Delete expired usage records</button>
                </form>
              </section>
            )}
            {tab === "settings" && (
              <section className={styles.panel}>
                <h2>Tool availability and search indexing</h2>
                <p>
                  Control the directory and tool pages. Existing shared projects
                  retain their own visibility settings.
                </p>
                {tools.map((tool) => (
                  <form
                    action={updateTool}
                    key={tool.slug}
                    className={styles.row}
                  >
                    <strong>{tool.name}</strong>
                    <input type="hidden" name="slug" value={tool.slug} />
                    <label>
                      <input
                        type="checkbox"
                        name="available"
                        defaultChecked={
                          policies[tool.slug]?.available !== false
                        }
                      />{" "}
                      Available
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="indexable"
                        defaultChecked={
                          policies[tool.slug]?.indexable !== false
                        }
                      />{" "}
                      Indexable
                    </label>
                    <button>Save</button>
                  </form>
                ))}
              </section>
            )}
            {audit?.data?.slice(0, 20).map((r) => (
              <article className={styles.panel} key={r.id}>
                <h2>{r.action}</h2>
                <p>
                  {r.created_at} · {r.target_id || "Site"}
                </p>
              </article>
            ))}
          </>
        )}
      </div>
      {pageRows && (
        <nav className={styles.pager}>
          {page > 1 && (
            <Link
              href={
                "?section=" + tab + "&status=" + filter + "&page=" + (page - 1)
              }
            >
              Previous
            </Link>
          )}
          {(pageRows.data?.length || 0) > 20 && (
            <Link
              href={
                "?section=" + tab + "&status=" + filter + "&page=" + (page + 1)
              }
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </Page>
  );
}
