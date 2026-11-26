// Playwright loads this adapter only inside the disposable local test server.
// A widget response stands in for Cloudflare. The application still checks the action.
const site = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (
  site.hostname !== "127.0.0.1" ||
  process.env.LOOPKIT_TEST_PROVIDER !== "loopback"
) {
  throw new Error(
    "The challenge fixture requires an isolated loopback database.",
  );
}
const upstream = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input.url || input.href;
  if (url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    return upstream(input, init);
  }
  const form = new URLSearchParams(String(init?.body || ""));
  const token = /^fixture-([a-z_]+)$/.exec(form.get("response") || "");
  return Response.json({
    success: Boolean(token && form.get("secret") === "loopback-test-only"),
    action: token?.[1],
    hostname: "127.0.0.1",
  });
};
