export const highIntent = 78;
export const hour = 3600000;
export const day = 24 * hour;
export const privateHeaders = {
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};
export const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { ...privateHeaders, ...headers } });
export const error = (code, status, headers) => json({ error: code }, status, headers);
export const integer = (value, fallback, min, max) =>
  value != null && value !== "" && Number.isInteger(Number(value))
    ? Math.min(max, Math.max(min, Number(value))) : fallback;
export const utcDay = (now) => new Date(now).toISOString().slice(0, 10);
export const iso = (now) => now ? new Date(now).toISOString() : null;
export const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function takeLimit(db, bucket, window, max, expires) {
  if (max < 1) return false;
  const row = await db.prepare(`INSERT INTO limits(bucket,window,count,expires_at) VALUES(?,?,1,?)
    ON CONFLICT(bucket,window) DO UPDATE SET count=count+1 WHERE count<?
    RETURNING count`).bind(bucket, window, expires, max).first();
  return Boolean(row);
}
export async function readBounded(response, maxBytes) {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw Error("oversize_response");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "", count = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return result + decoder.decode();
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel();
        throw Error("oversize_response");
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
