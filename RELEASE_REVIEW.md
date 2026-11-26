# LoopKit private release review

## Application
Sixteen catalog tools cover countdowns, single-elimination brackets, polls, team generation, leaderboards, wheels, events, Discord timestamps, rules templates, tier lists, emoji resizing, Telegram stickers, gaming profile cards, goals, challenges and community links. Eight utilities process input locally. Hosted tools add persistent organizer controls and shared participant views.

The Event Hub combines enabled components in organizer-defined order. Public links, remix, QR codes and supported iframe views are part of the project flow. Shared-link visitors can participate without registering. Anonymous voting uses imperfect browser-level deduplication, disclosed to participants.

The same application includes Supabase authentication, account export and deletion, directory review, a creator dashboard, moderation and financial administration. Six migrations cover projects, accounts, payments, editorial review, growth reporting and per-owner daily activity. Sponsored inventory uses separate reservations and payment records from organic directory voting. Source and assets are in this repository.

## Routes
| Area | Entry points |
| --- | --- |
| Public tools | /, /tools, /tools/[slug], /create, /s/[slug], /embed/[slug] |
| Community | /discover, /discover/telegram-bots, /discover/telegram-channels, /discover/discord-servers, /community/[slug], /submit, /report |
| Accounts | /login, /register, /auth/forgot, /auth/reset, /auth/callback |
| Owner workspace | /dashboard, /dashboard/projects, /dashboard/listings, /dashboard/analytics, /dashboard/billing, /dashboard/settings |
| Commercial and administrative | /pricing, /promote, /admin, /admin/billing, /admin/editorial |
| Content | /blog, /blog/[slug], /about, /contact, /privacy, /terms, /acceptable-use, /refund-policy |
| Crawlers and integration | /sitemap.xml, /robots.txt, /ads.txt, /api/account/*, /api/billing/*, /api/projects/* |

## External configuration and launch gates
1. Clear the provisional brand and domain. Complete the business identity, contact information, refund terms and legal review.
2. Use the browser-based deployment guide to configure a private staging Worker, Supabase project, migrations, session redirects, SMTP and Turnstile. Verify real email verification and recovery. If desired, configure Google OAuth and verify its callbacks on the final hostname.
3. Run the implemented test checkout with the merchant's own eligible Razorpay account. Observe order creation, signature verification, webhook delivery, renewal, expiration and refund in the provider dashboard. The shipped payment adapter accepts test-mode credentials. A live adapter and a separate release review are required before charging customers.
4. Configure retention, verify backups by restoring to a separate project, inspect cross-origin embeds on the target sites and check preview unfurling in the actual chat clients.
5. Review and approve the starter guide drafts. Set the canonical site origin and approved guide allowlist. Review production moderation and abuse limits. Inspect Search Console and actual Core Web Vitals after user-authorized release.
6. Keep AdSense off until the publisher is approved and a certified consent manager has been configured and tested for the relevant traffic. No domain registration, paid infrastructure or public deployment was performed during this work.

The initial estimate is $0/month within free allowances and approximately $30/month for the example paid Workers and single Supabase configuration. Domain renewal, email, backups, taxes, fees and overage depend on provider and volume. See docs/COSTS.md.

## Evidence
TEST_REPORT.md records measured checks and limitations. qa/ contains the visual evidence. BUILD_STATUS.md identifies the next release gates. DEPLOYMENT.md, LAUNCH_PLAN.md, SECURITY.md and docs/OWNER_CHECKLIST.md contain the browser-based rollout, business and operational instructions.

The local verification totals were 65 Vitest checks, 29 public Chromium tests and five authenticated/provider-fixture scenarios. The final mobile homepage performance score was 97. See docs/PERFORMANCE.md for the measurements.
