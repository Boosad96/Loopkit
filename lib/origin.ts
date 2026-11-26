/** Next's standalone server can represent either loopback address as localhost. */
export function sameOrigin(origin: string | null, requestUrl: string) {
  if (!origin || origin === "null") return false;
  try {
    const source = new URL(origin),
      target = new URL(requestUrl);
    if (source.origin !== origin) return false;
    const canonical = process.env.NEXT_PUBLIC_SITE_URL;
    if (canonical && new URL(canonical).origin === source.origin) return true;
    if (source.origin === target.origin) return true;
    return (
      [source, target].every(
        (u) =>
          u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname),
      ) && source.port === target.port
    );
  } catch {
    return false;
  }
}
