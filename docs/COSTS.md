# Infrastructure estimate

Budget assumptions are in USD, checked 25 November 2026. The founder should verify regional tax, currency and current allowances before purchase. No paid provisioning is implied by this budget.

| Item | Initial review | When to revisit |
| --- | --- | --- |
| Cloudflare Workers | Free plan, $0 within limits | Free provides 100,000 daily requests and 10 ms CPU per invocation. Measure SSR CPU, Worker bundle size and errors on an actual Worker. Paid starts at $5/month plus applicable overage. [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Supabase | Free project, $0 within limits | Free includes 500 MB database, 1 GB file storage, and 5 GB uncached egress per project allowance as described in the plan. Free projects may pause after one inactive week. Pro starts at $25/month and includes compute credits covering one Micro project under the listed assumptions. Additional projects or usage can add charges. [Pricing](https://supabase.com/pricing) |
| Auth email | Existing SMTP account or vendor free allowance | Check delivery quotas, sender verification, domain costs and commercial terms. Request an exact quote for the chosen sender. |
| Domain | $0 during private engineering | For planning, allow $10–30/year for an ordinary domain if available. Confirm the renewal price and tax before purchase. Premium domains can be much more expensive. |
| CI and backups | Existing private GitHub allowance and encrypted backup capacity | Check private-repo minutes, artifact retention and storage remaining. Add a spending cap before recurring jobs. |
| Razorpay | Test mode, no live transactions | Merchant agreement, taxes, payment method, refunds, cross-border settlement and FX affect live costs. |
| Consent management | $0 while ads are disabled | Obtain the current certified CMP's quote for the site count, regions and traffic before enabling ads. |
| AI services | $0 | Core tools have no paid AI dependency. |

Under the stated assumptions, private evaluation can have $0 incremental monthly infrastructure cost. A small paid configuration with Workers Paid and one Supabase Pro Micro project starts near $30/month before domain, email, backups, taxes, fees or overage. A free-tier fit for the actual Worker must be verified by upload and representative measurements. Organic growth does not guarantee revenue to cover this cost.
