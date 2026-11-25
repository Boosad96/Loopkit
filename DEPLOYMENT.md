# Browser-based deployment

The repository is private. A successful GitHub build is useful evidence for review. Deployment, payment-provider activation, paid infrastructure and a public launch are separate founder decisions. Use a second Supabase project and test merchant credentials for staging. Record each completed step against a commit in BUILD_STATUS.md.

## Connect and inspect

1. In GitHub, open the private repository, inspect the latest commit, then open **Actions** and the checks for that commit. Review TEST_REPORT.md for tests that still require connected services. Set branch protection or a ruleset requiring the available checks when your GitHub plan supports it.
2. In the Supabase dashboard, create an organization and a project in your chosen region. Record the project reference and database password in your password manager. Label staging and production distinctly.
3. On an empty project, open **SQL Editor → New query**. In GitHub open the first file under `supabase/migrations`, view the raw contents and paste the entire file into the SQL editor. Run it once. Continue in filename order only after success. Include 004_editorial.sql for approved article storage and editorial audit operations. Record filename, commit and time in the change log. On existing projects check which migrations have already run. Never replay a bootstrap file or mix an unrecorded SQL-editor migration history with CLI migration pushes.
4. Open **Database → Tables/Policies**. Inspect the schema and RLS policies, then exercise the signed-out and two-account permission tests before allowing registrations. Use a disposable database for destructive or reset tests.
5. In **Project Settings → API Keys** or **Connect**, collect the project URL, browser key and the server service-role key matching .env.example. Keep the service credential available only in a private secret field. [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments)

## Authentication, email and uploads

6. Under **Authentication → Providers**, enable email with confirmation. Configure custom SMTP and verify sender-domain records. The default Supabase mailer is restricted. Deliver one verification and recovery message to a test account outside the team. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
7. Under **Authentication → URL Configuration**, set the site URL to `https://<your-host>`. Add the app's exact callback URL `https://<your-host>/auth/callback` and the recovery redirect `https://<your-host>/auth/callback?next=%2Fauth%2Freset`. Use explicit production hosts. For Google OAuth, supply your own client ID and secret in the Supabase provider settings and set the app runtime variable `GOOGLE_OAUTH_ENABLED=true`. In Google Cloud, authorize the exact callback URL displayed by Supabase, typically `https://<project-ref>.supabase.co/auth/v1/callback`. Verify both the provider-to-Supabase step and the return to your app. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
8. Use **Cloudflare → Turnstile → Add widget** for the authorized hostname. Copy the site key and secret into their respective settings. Use separate credentials for staging.
9. Browser image tools process local files. Directory submission can store a small resized logo with the listing. Leave Storage buckets absent unless a release explicitly requires a bucket and has tested its independent size, content-type and access policies. Database backups do not contain the actual stored objects. [Supabase backup scope](https://supabase.com/docs/guides/platform/backups)

## Workers builds and routing

10. In Cloudflare, choose **Workers & Pages** and its GitHub repository connection. Authorize the one private repository. Use a **Worker** for this server-rendered app. Opening or connecting the build flow can trigger deployment. Do this after founder authorization for the intended audience and after configuring any access policy for staging. Preview hostnames may be accessible to others.
11. Set the Worker name to `loopkit`, matching both the name and self-reference in `wrangler.jsonc`. Use repository root, branch `main`, and the Node major used by CI. Configure these as dashboard fields:

| Field | Value |
| --- | --- |
| Build command | `npm run build:worker` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Repository root | `/` |
| Install | Use the committed npm lockfile |
| Production branch | `main` after launch authorization |

OpenNext is the repository's adapter. Its Worker entry point, asset binding, compatibility date and Node compatibility flag are in `wrangler.jsonc`. Use the committed lockfile and compare the adapter notes before upgrading Next. Workers Builds uses distinct build and deploy commands. [OpenNext setup](https://opennext.js.org/cloudflare/get-started) · [Cloudflare build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

12. In **Settings → Builds** add variables required during compilation, including all configured `NEXT_PUBLIC_*` values. In **Settings → Variables and Secrets** add runtime settings. Do not add secrets to `NEXT_PUBLIC_*`, GitHub issues, screenshots or commits. Use the complete current .env.example as your checklist.

| Value | Source |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your final HTTPS origin, without a path |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Monitored founder support/privacy address |
| `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project URL and browser-compatible key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` | Widget site key and server verification secret |
| `EDITORIAL_PUBLISHED_SLUGS` | Empty until individual guides pass review |
| `BILLING_TEST_ENABLED`, `ADSENSE_ENABLED`, `ADSENSE_APPROVED` | `false` during initial review |

13. Submit the build only when authorized. Inspect the build and deployment log for the expected commit. In **Worker → Settings → Domains & Routes**, choose **Add → Custom Domain** on a Cloudflare-managed zone. Follow registrar nameserver instructions if adding a new zone. Confirm Cloudflare has issued the certificate and both DNS and HTTPS serve the intended host. Rebuild when changing build-time public variables. Protect every preview/staging route as appropriate, including any workers.dev hostname. [Cloudflare custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## Payments, editorial and search

14. Review docs/BILLING.md. Obtain separate test key ID, secret, webhook secret and any plan IDs on the eligible merchant account. Configure the test endpoint `https://<your-host>/api/billing/webhook` using the verified event list in the billing guide. External provider webhooks cannot authenticate through an interactive staging login. Permit only the exact webhook route through staging access and leave signature verification in place. Confirm valid test delivery, failure and duplicate handling. Keep live credentials outside this application unless live processing has been separately reviewed and authorized.
15. After public launch authorization, add a **Domain** property in Google Search Console, paste its TXT value into authoritative DNS, and verify. Alternatively use a URL-prefix property with the provided site-verification token in `GOOGLE_SITE_VERIFICATION`. Submit `https://<your-host>/sitemap.xml`. Inspect one public tool and one excluded page. Search results can take time to change. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
16. Review every editorial guide and legal page. Record approvals and publish only named guides. Keep AdSense disabled until completing docs/ADVERTISING.md, including site approval, the certified CMP integration and a browser-level consent test.

## Operate and recover

17. Record baseline Worker exceptions/latency and Supabase database, auth, egress and storage usage in their dashboards. Review error rates, moderation backlog, payment delivery failures and approaching free-tier limits each week. Redact request bodies and tokens from logs.
18. Before a migration, establish a restorable backup and document its timestamp, retention, owner and recovery target. Supabase paid plans provide managed backups in **Database → Backups**. For a free project, use the manually dispatched GitHub workflow described in docs/BACKUPS.md. It exports the database to encrypted artifacts from the Actions interface. Test restoration on a separate project before relying on it. Export storage objects independently if introduced. Never commit a production dump to GitHub. [Supabase backup procedures](https://supabase.com/docs/guides/platform/backups)
19. For an application regression, open **Worker → Deployments**, inspect the last known-good version, check compatibility with the current schema and choose **Rollback** after authorization. A Worker rollback does not restore database state. For a database incident stop writes, retain evidence and restore to a separate project first. Reconcile verified provider payments made after the restore point before reopening checkout. [Cloudflare rollback limitations](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
20. For updates use a GitHub pull request, commit the lockfile, apply additive migrations before code that depends on them, and rerun the review on staging. Record the application SHA, migrations, test results and rollback version. Obtain explicit approval before destructive cleanup.

See docs/OWNER_CHECKLIST.md for launch sign-off, docs/COSTS.md for estimates and TEST_REPORT.md for actual executed results.
