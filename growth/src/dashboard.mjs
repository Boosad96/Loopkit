import { engineStatus, latestReport, opportunityPage } from "./engine.mjs";
import { html as h, privateHeaders } from "./shared.mjs";

export const dashboardPath = "/admin/growth";
const assetPath = dashboardPath + "/assets/";
const security = {
  ...privateHeaders,
  "content-security-policy": "default-src 'none'; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function card(label, value) {
  return `<div class="metric"><span>${h(label)}</span><strong>${h(value ?? "—")}</strong></div>`;
}

function opportunity(item) {
  const buttons = [
    ["approve", "Approve", ["new"]],
    ["dismiss", "Dismiss", ["new", "approved"]],
    ["archive", "Archive", ["new", "approved", "dismissed"]],
  ].filter(([, , states]) => states.includes(item.status)).map(([action, label]) =>
    `<button formmethod="post" formaction="${dashboardPath}/opportunities/${h(item.id)}/${action}">${label}</button>`).join("");
  return `<article>
    <div class="context"><span>${h(item.source)}</span><span>${h(item.published_at.slice(0, 16).replace("T", " "))} UTC</span><span>${h(item.status)}</span></div>
    <h3>${h(item.title)}</h3>
    <p>${h(item.problem === item.title ? "" : item.problem)}</p>
    <p class="match"><strong>${h(item.tool)}</strong> · ${h(item.score)}/100${item.high_intent ? " · High intent" : ""}</p>
    <details><summary>Response draft</summary><textarea rows="5" aria-label="Response draft" readonly>${h(item.draft)}</textarea>
    <button type="button" data-copy>Copy response</button><span role="status"></span></details>
    <form class="actions"><a href="${h(item.original_url)}" target="_blank" rel="noopener noreferrer">Open original discussion</a>${buttons}</form>
  </article>`;
}

export async function dashboard(env, url, now) {
  const [status, page, report] = await Promise.all([
    engineStatus(env, now), opportunityPage(env.DB, url, url.searchParams.get("intent") === "high", now, 12), latestReport(env.DB),
  ]);
  if (!page) return new Response("Invalid filters", { status: 400, headers: security });
  const analytics = report?.analytics;
  const data = analytics?.data;
  const current = url.searchParams.get("status") || (url.searchParams.get("intent") === "high" ? "new" : "all");
  const next = new URL(url);
  if (page.next_cursor) next.searchParams.set("cursor", page.next_cursor);
  const notice = { started: "Scan queued. Refresh shortly to see the result.", busy: "A scan is already running.", quota: "Manual scan quota reached for today.", disabled: "Discovery is disabled.", reviewed: "Opportunity updated.", conflict: "This opportunity was already reviewed.", missing: "Opportunity unavailable." }[url.searchParams.get("notice")];
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LoopKit Growth</title><link rel="stylesheet" href="${assetPath}dashboard.css"><script defer src="${assetPath}dashboard.js"></script></head>
  <body><main><header><div><div class="brand">LoopKit</div><h1>Growth dashboard</h1></div>
  <form action="${dashboardPath}/scan" method="post"><button class="primary">Run scan</button></form></header>
  ${typeof notice === "string" ? `<p class="notice" role="status">${h(notice)}</p>` : ""}
  <section class="metrics" aria-label="Discovery totals">
    ${card("Retained opportunities", status.counts.total)}${card("High intent · last 48 hours", status.counts.high_intent)}
    ${card("Awaiting review", status.counts.pending)}${card("Manual scans today", `${status.manual_scans.used} / ${status.manual_scans.limit}`)}
  </section>
  <section class="panel"><h2>Opportunities</h2>
    <form class="filters" method="get" action="${dashboardPath}">
      <label>Status <select name="status">${["all", "new", "approved", "dismissed", "archived"].map((value) =>
        `<option${value === current ? " selected" : ""}>${value}</option>`).join("")}</select></label>
      <label><input type="checkbox" name="intent" value="high"${url.searchParams.get("intent") === "high" ? " checked" : ""}> High intent only</label>
      <button>Apply</button>
    </form>
    ${page.items.length ? page.items.map(opportunity).join("") : "<p>No opportunities match this view.</p>"}
    ${page.next_cursor ? `<a class="pagination" href="${h(next.pathname + next.search)}">Older opportunities</a>` : ""}
  </section>
  <section class="panel"><h2>Automation</h2>
    <p>${status.automation_enabled ? "Enabled · every 15 minutes" : "Disabled"}${status.running ? " · scan running" : ""}${status.launch_mode ? " · 48-hour launch mode" : ""}</p>
    <p>Last successful scan · ${h(status.last_successful_scan ?? "Awaiting first successful scan")}</p>
    ${status.last_scan ? `<p>Latest scan · ${h(status.last_scan.state)} · ${h(status.last_scan.inserted)} added ${status.last_scan.message ? "· " + h(status.last_scan.message) : ""}</p>` : ""}
    <div class="table"><table><caption>Source health and UTC daily request limits</caption><thead><tr><th>Platform</th><th>State</th><th>Requests</th><th>Upstream remaining</th><th>Details</th></tr></thead>
    <tbody>${status.sources.map((source) => `<tr><th scope="row">${h(source.name)}</th><td>${h(source.state)}</td><td>${h(source.requests_today)} / ${h(source.daily_limit)}</td><td>${h(source.upstream_remaining ?? "—")}</td><td>${h(source.error)} ${source.cooldown_until ? "Until " + h(source.cooldown_until) : ""}</td></tr>`).join("")}</tbody></table></div>
  </section>
  <section class="panel"><h2>Website analytics</h2>
    ${data ? `<p>Consenting website browsers over the last 48 hours · updated ${h(report.generated_at)}.</p>
      <div class="metrics">${card("Referral visits", data.referral_visits)}${card("Organic visits", data.organic_visits)}
      ${card("Tool starts", data.tool_starts)}${card("Successful tool completions", data.tool_completions)}
      ${card("Returning browsers", data.returning_browsers)}${card("Campaign visits", data.campaign_visits)}
      ${card("Campaign completions", data.campaign_completions)}</div>
      ${breakdown("Landing pages", data.landing_pages)}${breakdown("Campaign sources", data.campaign_sources)}
      ${breakdown("Tool activity", data.tools)}` :
      `<p>${h({ disabled: "Website analytics are disabled.", unavailable: "Website analytics could not be fetched.", unconfigured: "Connect the website analytics credential to see referral traffic and conversions." }[analytics?.state] ?? "Awaiting the first report.")}</p>`}
    ${report?.recommendations.length ? `<h3>Review recommendations</h3><ul>${report.recommendations.map((item) => "<li>" + h(item) + "</li>").join("")}</ul>` : ""}
    <p><a href="/admin/growth/openapi.json">Meta Muse API specification</a></p>
  </section></main></body></html>`, { headers: { ...security, "content-type": "text/html; charset=utf-8" } });
}

function breakdown(title, entries = []) {
  if (!entries.length) return "";
  return `<details><summary>${h(title)}</summary><ul>${entries.map((entry) =>
    `<li>${h(entry.name)} · ${entry.visits == null ? h(entry.starts) + " starts, " + h(entry.completions) + " completions" :
      h(entry.visits) + " visits" + (entry.completions == null ? "" : ", " + h(entry.completions) + " completions")}</li>`).join("")}</ul></details>`;
}

export function dashboardAsset(path) {
  if (path === assetPath + "dashboard.js") return new Response(`
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-copy]");
      if (!button) return;
      const area = button.parentElement.querySelector("textarea");
      const status = button.nextElementSibling;
      try {
        await navigator.clipboard.writeText(area.value);
        status.textContent = "Copied.";
      } catch {
        area.select();
        status.textContent = "Draft selected. Use your device’s copy command.";
      }
    });
  `, { headers: { ...security, "content-type": "text/javascript; charset=utf-8" } });
  if (path === assetPath + "dashboard.css") return new Response(`
    :root{color-scheme:dark;font:16px system-ui;background:#0d1420;color:#e8eef8}
    *{box-sizing:border-box}main{max-width:1060px;margin:auto;padding:36px 20px 68px}
    header,.context,.actions,.filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    header{justify-content:space-between;margin-bottom:24px}
    .brand,a{color:#79edd2}.brand{font-weight:700}a:hover{text-decoration:none}
    h1{margin:6px 0 0;font-size:clamp(1.9rem,6vw,3rem);letter-spacing:-.045em}
    h2{margin:0 0 16px;font-size:1.25rem}h3{margin:10px 0}
    .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}
    .metric,.panel{background:#141f2e;border:1px solid #2b3b51;border-radius:12px;padding:17px}
    .metric span,.context,caption{color:#adc0d4;font-size:.9rem}.metric strong{display:block;font-size:1.65rem;margin-top:6px}
    .panel{margin-top:16px}article{border-top:1px solid #2b3b51;margin-top:16px;padding-top:16px;overflow-wrap:anywhere}
    article p:empty{display:none}.match{color:#acdcef}.actions{margin-top:12px}
    button,select{font:inherit;color:inherit;background:#22334a;border:1px solid #557087;border-radius:8px;padding:8px 12px}
    button,select,summary{cursor:pointer}button:hover{background:#344d68}.primary{background:#79edd2;color:#102521;font-weight:700}
    .primary:hover{background:#9df5e1}textarea{display:block;margin:9px 0;width:100%;padding:10px;color:inherit;background:#0d1420;border:1px solid #557087;border-radius:6px}
    [role=status]{margin-left:8px}.notice{color:#79edd2}.table{overflow:auto}
    table{width:100%;border-collapse:collapse}caption{text-align:left;margin-bottom:8px}
    th,td{text-align:left;border-top:1px solid #2b3b51;padding:8px}
    .pagination{display:inline-block;margin-top:18px}details{margin-top:10px}
    :focus-visible{outline:3px solid #79edd2;outline-offset:2px}
  `, { headers: { ...security, "content-type": "text/css; charset=utf-8" } });
  return null;
}
