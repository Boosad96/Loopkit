# Verification

## Latest verification — private review build

| Check | Result |
| --- | --- |
| Strict TypeScript and ESLint | Passed. |
| Unit and database integration | 65 passing tests in 12 Vitest files, including all migrations applied to PostgreSQL-compatible PGlite, role boundaries, vote handling, paid reservations, replay handling, reports and editorial approval. |
| Public browser acceptance | 29 Chromium tests passed. The tests cover 16 tool routes, all eight local utilities, event composition, date handling, bracket progression, exports, public SEO, private route redirects, mobile navigation, themes and reduced motion. |
| Authenticated and hosted integration | Five Playwright scenarios passed against disposable PostgreSQL 17, PostgREST and Supabase Auth. Covered admin/member isolation, claim and update permissions, public embeds, duplicate voting, Event Hub RSVP, private-project read denial, registration, sign-in, listing moderation, data export, account deletion and HMAC-verified webhook replay. |
| Release package | Next.js production build and OpenNext Worker bundling succeeded. Wrangler dry run and local workerd smoke test completed. Home, tools, team generator, pricing, robots and PNG social card returned 200. Signed-out dashboard returned 307. |
| Dependency advisory scan | 0 critical, 0 high, 3 moderate. The advisories concern OpenNext's glob/minimatch dependency graph. No release-time downgrade or breaking override was applied. |
| Screenshots | 20 screenshots in qa/, including real authenticated admin and member pages, public directories, tools, pricing, Event Hub editor and four homepage theme/device combinations. |

The authenticated service run used local auto-confirmation for test users. A test-only verification fixture supplies challenge decisions. The payment webhook test used a locally signed payload and a real reservation in the disposable database. No money moved. Merchant-issued test checkout, real email delivery, OAuth, production Turnstile, CMP consent and the deployed domain remain private-staging checks. No independent penetration test or formal WCAG certification has been performed. The marketing pages, analytics reports and pricing contain no test records from these runs.

## Earlier runs

Initial isolated Vitest run: two files, 11 passing tests. This included utility algorithms and applying the first three migrations in PGlite with Supabase-compatible test roles. Real provider credentials were not supplied. Later checks are recorded below as executed.

First optimized Next.js build completed using webpack and the TypeScript compiler API. Initial homepage suite: 14 browser checks passed. On the first route suite run, tool indexing, public pages and screenshot capture passed; the private route redirect assertion failed. The response was HTTP 200 during streamed rendering. An early redirect for signed-out private routes has been added; subsequent results supersede this first run.
## 2026-11-25 — resume checks (local checkout, Node 24.22.1, npm ci already done)

Checkout: 133 files downloaded via the GitHub connector (no .git directory). No real Supabase project was touched; database checks ran only against the local PGlite setup in Vitest. Billing was not exercised beyond the existing code (test mode only). Nothing was pushed or deployed.

### 1. `npm run lint` — initially FAILED (10 errors, 5 warnings), then PASSED (0 errors, 0 warnings)
Initial log: /tmp/loopkit-lint.log. Fixes, all in place:
- `react-hooks/set-state-in-effect` (5 errors): replaced synchronous setState in effects with the React-docs "adjusting state during render" pattern where the new value is pure (`DateEditor` wall time in `components/projects/ProjectEditor.tsx`; linked-project reset in `Attached` and `live` sync in `components/projects/ProjectView.tsx`), and with a `queueMicrotask`-deferred update where the value can only be read after mount (`location.origin` in `components/projects/Sharing.tsx`; fresh-config init with `crypto.randomUUID()`/`Date.now()` and the sessionStorage management key in `ProjectEditor.tsx`).
- `react-hooks/purity` (4 errors): `Date.now()` during render removed. The rule also flags `Date.now()` inside `useMemo`, so the clock is now read in an effect (same tick pattern as the existing countdown `Timer`): `components/billing/Checkout.tsx` (start-date window, min/max unset until the first tick), `components/projects/ProjectView.tsx` (`past` deadline check, 30 s tick matching the live refresh), and new `components/billing/Status.tsx` (`OrderStatus`/`SponsorshipStatus` client components, since the billing history page is a server component).
- `@next/next/no-html-link-for-pages` (1 error): `<a href="/tools">` in `app/pricing/page.tsx` replaced with `next/link`; the `/promote` link on the same page and the `/pricing` link in `app/dashboard/billing/page.tsx` converted the same way.
- Warnings (5): the four `<img>` usages converted to `next/image` with `unoptimized` (user-supplied logo URLs in `app/community/[slug]/page.tsx`, `components/account/Directory.tsx`, `components/projects/ProjectView.tsx`; generated QR data URL in `Sharing.tsx`); `postcss.config.mjs` now assigns the config to a variable before the default export.

### 2. `npm run typecheck` — initially FAILED (1 error), then PASSED
Error: `app/privacy/page.tsx` imported `AnalyticsPreferences` from `@/components/account/Analytics`, which did not exist anywhere in the repo. Created `components/account/Analytics.tsx`: a client component using `useSyncExternalStore` (the same pattern as the theme picker) that stores an opt-in preference and a first-party random identifier (`loopkit-analytics` localStorage key, 90-day lifetime, per the privacy policy), with opt-in/opt-out controls and stale-identifier cleanup after mount. Note: no analytics event collection exists in the repo yet — this component only manages the preference and identifier (milestone 8 work).

### 3. `npm test` (Vitest) — PASSED (11 tests, 2 files)
`tests/utilities.test.ts` (7) and `tests/database.test.ts` (4, PGlite migrations). Non-blocking warning only: Vite reports the ESM `vitest.config.ts` is loaded as CommonJS and suggests `.mjs` or `"type": "module"`; left as-is because the suite passes and changing module resolution is out of scope for this check run.

### 4. `npm run build` — PASSED (32 pages generated, TypeScript clean)

### 5. `npm run e2e` (Playwright) — initially FAILED (14 failed), then PASSED (14 passed)
First run failed before any test executed: Playwright expected `chromium_headless_shell-1255` but the cache held build 1254 (`Executable doesn't exist`). Fixed with `npx playwright install chromium` (no system packages installed). Rerun: 14 passed, including viewport-fit checks at 320–1920 px, dark/light screenshots, mobile navigation, Event Hub demo tabs, and theme persistence.

## Final performance and artifact verification
The optimized homepage recorded Lighthouse scores of 97 performance, 100 accessibility, 100 best practices and 100 SEO, with LCP 1.06 s and CLS 0. See docs/PERFORMANCE.md for measurement conditions and field-data limitations. The final package is 2,465.03 KiB compressed. A targeted private-key and provider-token signature scan found no matches in tracked and candidate files. This scope does not prove the absence of every possible secret.

## 2026-11-26 — LoopKit Growth Engine V1

| Check | Result |
| --- | --- |
| Install and static checks | Locked dependency install on Node 24.22.3, lint and type checking passed. |
| Unit and database tests | 68 Vitest tests passed. This includes privacy-safe attribution, PostgreSQL aggregates and service-role grants. |
| Growth tests | Four Node tests passed, covering catalog matching, adapters, pagination, D1-compatible SQL, quotas, review, retention, scoped credentials and signed Access assertions. |
| Production Chromium | All 30 checks passed. The new check loaded a real cross-origin localhost iframe, generated teams, verified optional attribution and checked that the analytics endpoint rejects an unsigned request. |
| Worker bundles | Next.js production and OpenNext builds passed. Wrangler dry-run packaged both Workers. The growth Worker was about 23 KiB compressed. |
| Native local Cloudflare runtime | Wrangler applied the migration to disposable D1. An unsigned dashboard request returned 403 and an unsigned API request returned 401. The public timestamp call, authenticated API, first report and scheduled dispatch responded. |
| Discovery with live sources | The scan handler ran against real Wrangler D1 bindings and the live LoopKit sitemap, Hacker News Algolia, Stack Exchange and GitHub public Issues through the development proxy. All three scans completed successfully with zero qualifying matches in the sampled queries. The official HN RSS feed also returned 200. Public Bluesky search returned 403 and remains disabled by default. |
| Hosted Supabase integration | GitHub Actions completed the integration workflow successfully on `1143d85` with disposable Supabase. The initial local attempt ran out of storage unpacking Docker image layers. [Workflow run](https://github.com/Boosad96/Loopkit/actions/runs/45844917916) |
| Dependency audit | 0 critical and 0 high. Three existing moderate advisories concern the OpenNext glob/minimatch dependency chain. |

The browser tests exposed a duplicate utility-editor selector and a test-side network restriction when the iframe parent was intercepted. The distribution controls now use their own selector, and the test serves the parent over an actual loopback connection. Unsupported widget kinds display the Next.js unavailable page, which can use HTTP 200 when streamed. Production Cloudflare Access, the remote D1 binding and the production analytics bridge still require owner configuration and smoke tests. No production data or hosted billing credentials were used.
