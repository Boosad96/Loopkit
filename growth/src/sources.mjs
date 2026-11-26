import { plain } from "./matching.mjs";

const providers = {
  hn: { label: "Hacker News", quota: 120 },
  stack: { label: "Stack Exchange", quota: 100 },
  github: { label: "GitHub Issues", quota: 60 },
  bluesky: { label: "Bluesky", quota: 60 },
  rss: { label: "Hacker News RSS", quota: 12 },
};

export function sources(env) {
  return Object.entries(providers).map(([id, config]) => ({
    id, ...config, enabled: id === "hn" || id === "stack" ||
      (id === "github" && env.ENABLE_GITHUB !== "false") ||
      (id === "bluesky" && env.ENABLE_BLUESKY === "true") ||
      (id === "rss" && env.ENABLE_RSS === "true"),
  }));
}

function urlFor(base, query) {
  const url = new URL(base);
  url.search = new URLSearchParams(query);
  return url;
}

export function sourceRequest(source, term, since, page, env) {
  const headers = { accept: "application/json", "user-agent": "LoopKitGrowth/1.0 (+https://loopkit.site/about)" };
  const seconds = Math.floor(since / 1000);
  switch (source) {
    case "hn":
      return [urlFor("https://hn.algolia.com/api/v1/search_by_date", {
        query: term, tags: "ask_hn", numericFilters: "created_at_i>" + seconds, page: page || "0", hitsPerPage: "10",
      }), headers];
    case "stack":
      return [urlFor("https://api.stackexchange.com/2.3/search/advanced", {
        q: term, site: "webapps", sort: "creation", order: "desc", fromdate: seconds,
        accepted: "False", closed: "False", pagesize: "10", page: page || "1",
        ...(env.STACK_EXCHANGE_KEY ? { key: env.STACK_EXCHANGE_KEY } : {}),
      }), headers];
    case "github":
      return [urlFor("https://api.github.com/search/issues", {
        q: `"${term}" is:issue is:open is:public created:>=${new Date(since).toISOString()} -repo:Boosad96/Loopkit`,
        sort: "created", order: "desc", per_page: "10", page: page || "1",
      }), { ...headers, ...(env.GITHUB_SEARCH_TOKEN ? { authorization: "Bearer " + env.GITHUB_SEARCH_TOKEN } : {}), accept: "application/vnd.github+json" }];
    case "bluesky":
      return [urlFor("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts", {
        q: '"' + term + '"', sort: "latest", since: new Date(since).toISOString(), limit: "10",
        ...(page ? { cursor: page } : {}),
      }), headers];
    case "rss":
      return [new URL("https://news.ycombinator.com/rss"), { ...headers, accept: "application/rss+xml" }];
    default:
      throw Error("unknown_source");
  }
}

const candidates = (input) => Array.isArray(input) ? input.slice(0, 15) : [];
const hnUrl = (id) => /^\d+$/.test(String(id)) ? "https://news.ycombinator.com/item?id=" + id : "";
function canonical(source, input) {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (source === "github" && url.hostname === "github.com" && /^\/[\w.-]+\/[\w.-]+\/issues\/\d+$/.test(url.pathname))
      return url.origin + url.pathname;
    if (source === "stack" && url.hostname === "webapps.stackexchange.com") {
      const question = url.pathname.match(/^\/questions\/(\d+)(?:\/|$)/)?.[1];
      if (question) return url.origin + "/questions/" + question;
    }
    if (source === "rss" && url.hostname === "news.ycombinator.com" && url.pathname === "/item")
      return hnUrl(url.searchParams.get("id"));
  } catch { /* Invalid URLs are discarded. */ }
  return "";
}
function parseRss(text) {
  if (!/<(?:rss|rdf:RDF)\b/i.test(text) || !/<channel\b/i.test(text)) throw Error("invalid_feed");
  return Array.from(text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)).slice(0, 15).map(([, item]) => {
    function field(name) {
      const match = item.match(new RegExp("<" + name + ">([\\s\\S]*?)<\\/" + name + ">", "i"));
      return (match?.[1] || "").trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
    }
    return { url: canonical("rss", field("comments") || field("link")), title: field("title"),
      publishedAt: Date.parse(field("pubDate")), body: field("description") };
  });
}

export function parseSource(source, text, page) {
  if (source === "rss") return { items: parseRss(text), next: null };
  const data = JSON.parse(text);
  const number = Number(page || 1);
  switch (source) {
    case "hn":
      if (!Array.isArray(data.hits)) throw Error("invalid_payload");
      return { items: candidates(data.hits).map((x) => ({
        url: hnUrl(x.objectID), title: x.title, body: x.story_text,
        publishedAt: x.created_at_i * 1000,
      })), next: !page && data.nbPages > 1 ? "1" : null };
    case "stack":
      if (!Array.isArray(data.items) && !data.backoff) throw Error("invalid_payload");
      return { items: candidates(data.items).filter((x) => !x.is_answered && !x.closed_date).map((x) => ({
        url: canonical(source, x.link), title: x.title, body: "", publishedAt: x.creation_date * 1000,
      })), next: data.has_more && number < 2 ? "2" : null, backoff: data.backoff, remaining: data.quota_remaining };
    case "github":
      if (!Array.isArray(data.items)) throw Error("invalid_payload");
      return { items: candidates(data.items).filter((x) => !x.pull_request && x.state === "open").map((x) => ({
        url: canonical(source, x.html_url), title: x.title, body: x.body, publishedAt: Date.parse(x.created_at),
      })), next: data.total_count > 10 && number < 2 ? "2" : null };
    case "bluesky":
      if (!Array.isArray(data.posts)) throw Error("invalid_payload");
      return { items: candidates(data.posts).filter((x) => !x.record?.reply && !x.record?.embed?.record).map((x) => {
        const post = /^at:\/\/(did:(?:plc|web):[a-zA-Z0-9.:%-]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)$/.exec(x.uri || "");
        return { url: post ? "https://bsky.app/profile/" + post[1] + "/post/" + post[2] : "",
          title: plain(x.record?.text, 230), body: x.record?.text, publishedAt: Date.parse(x.record?.createdAt) };
      }), next: !page && typeof data.cursor === "string" && data.cursor.length <= 512 ? data.cursor : null };
    default:
      throw Error("unknown_source");
  }
}
