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
