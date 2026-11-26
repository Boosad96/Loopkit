# Public homepage performance
Lighthouse 13.6.0 ran against the optimized Next.js server on loopback with mobile simulation and Chromium. The final run measured the signed-out homepage with advertising disabled.

| Measure | Result |
| --- | --- |
| Performance | 97/100 |
| Accessibility | 100/100 |
| Best practices | 100/100 |
| SEO | 100/100 |
| Largest Contentful Paint | 1.06 s |
| Cumulative Layout Shift | 0 |
| Total Blocking Time | 208 ms |

An earlier run on the intermediate build measured 84/100 and CLS 0.203. The footer moved while the page-level loading fallback was replaced. The final build reserves the main content height and streams the sponsorship lookup independently of the hero and directory. The final measurement is one lab sample. Real-user INP, p75 Core Web Vitals, remote network latency and Cloudflare production CPU consumption require traffic on the configured release hostname.

Wrangler’s final dry run reported 164 static assets, 10,471.98 KiB total Worker upload and 2,465.03 KiB gzip. It completed without an account upload. Track actual provider limits, request CPU, cache behavior and egress before upgrading infrastructure.
