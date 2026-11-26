# Usage measurement and retention

Set ANALYTICS_ENABLED=true to accept measurements after configuring Supabase. The default is disabled. Visitors opt in from Privacy or Account settings. Global Privacy Control and Do Not Track suppress tracking. The browser stores a random visitor ID in a first-party cookie for 90 days. Withdrawing consent clears the cookie. No raw URL, email, IP address, or user agent is stored in usage events. Approved account and payment operations have independent database records.

The browser submits interaction events. Treat them as directional measurements. Clients can forge events. The API enforces a 512-byte body limit, rejects cross-origin requests, and uses a shared database quota (ANALYTICS_EVENTS_PER_MINUTE, default 240) plus a per-visitor limit of 80 events in ten minutes. For public traffic, configure a Cloudflare rate-limiting rule on /api/account/events to constrain repeat requests before invoking the Worker or database. Product sharing statistics reflect consenting browsers.

## Automatic deletion

Analytics retention defaults to 30 days. An admin can change it in Administration → Settings or trigger a purge immediately. For unattended cleanup, open the Supabase dashboard, enable the Cron integration (pg_cron) and create a SQL job named loopkit-purge-usage with the schedule `17 3 * * *` (daily, 03:17 UTC) and SQL command:

```sql
select public.purge_usage();
```

Use the database owner to create the job. Run the job once from the dashboard, inspect its run history and confirm it succeeds. If cron is unavailable, keep analytics disabled until equivalent scheduled cleanup is in place. Event statistics for a 30-day reporting window reflect only retained records.

## Growth dashboard definitions

The administration analytics tab uses a rolling 30-day window. Activation measures consenting browsers that started and completed a tool. Creator share rate divides browsers that created and shared by browsers that created. Shared visits per share compares measured visits to sharing actions and can exceed one. Visitor-to-creator conversion divides browsers with both a page view and a successful creation by measured visiting browsers. The referral coefficient estimates creator conversions occurring after a shared visit per measured creator, with no claim that the visit caused creation. Returning creators are distinct signed-in owners with saved creations on two or more UTC dates. Account registration, project and listing counts use database creation records. Paid conversion measures new registered accounts with at least one captured, unrefunded or partly refunded test payment. Monthly recurring revenue is displayed separately by currency and sums paid, renewing test subscriptions, excluding scheduled cancellations. Missing denominators display “Insufficient data”.

The daily project activity chart displays UTC-day totals for shares and visits from the retained data. Server-side billing entitlements unlock the creator chart. The SQL function independently checks the caller's current entitlement and restricts the rows to that creator's projects. Administrators can review the aggregate across projects. Only days with measured activity appear.
