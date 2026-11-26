# Integrate a LoopKit tool

## Widgets

Open a browser-only tool from the [LoopKit catalog](https://loopkit.site/tools). Expand **Share or embed this tool**, choose whether to display **Made with LoopKit**, and select **Copy embed code**. Paste it into the host site's HTML. Serve the host over HTTPS. Adjust the iframe height for that tool's results, and keep a descriptive title. Project widgets for published countdowns, polls, leaderboards, goal trackers and event pages remain available from **Share this project** on the public project.

```html
<iframe
  src="https://loopkit.site/embed/tool/random-team-generator"
  title="LoopKit Random Team Generator"
  width="100%" height="680" loading="lazy"
  sandbox="allow-scripts allow-same-origin allow-downloads"
  allow="clipboard-write"
  referrerpolicy="no-referrer"
></iframe>
```

To display attribution, append `?attribution=1`. Add `allow-popups allow-popups-to-escape-sandbox` to the sandbox for the visible attribution link, which opens the canonical tool page in a separate tab only on click. A site with its own Content Security Policy must allow `https://loopkit.site` in `frame-src`. Clipboard permission can depend on the embedding browser. Tool pages also provide **Copy tool link** and, where supported, **Share via device**.

Widget inputs and outputs remain in the browser for local tools. Avoid placing private data in intentionally shared configuration links. Widget usage is excluded from website analytics. Clicking visible attribution can bring a genuine visitor to the first-party site and is measured only if the destination's opt-in conditions are met.

## Public API

[OpenAPI specification](openapi.public.json) · [Live specification after deployment](https://growth.loopkit.site/api/v1/openapi.json)

```http
GET /api/v1/discord-timestamp?unix=1735689600 HTTP/1.1
Host: growth.loopkit.site
```

Responses include `unix` and a `formats` map with the nine Discord rendering styles. Unix time is in seconds. Example output for the relative style is `<t:1735689600:R>`.

```http
GET /api/v1/random-teams?players=4&teams=2 HTTP/1.1
Host: growth.loopkit.site
```

```json
{"teams":[[4,1],[2,3]]}
```

The team result contains only numbered slots. Map numbers to names in your own application. Both endpoints accept numeric query parameters, return JSON, and use no credentials. They allow cross-origin browser reads and may return 400 for invalid input. Honor `Retry-After` on 429. Quotas are 20 calls per minute per IP and Cloudflare location, and 1,500 calls globally per UTC day by default. Retry transient 503s with backoff. API traffic is excluded from the site analytics.
