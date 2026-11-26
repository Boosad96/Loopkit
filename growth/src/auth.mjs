import { readBounded, sha256 } from "./shared.mjs";

let signingKeys;
function base64url(segment) {
  return Uint8Array.from(atob(segment.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

async function accessKey(issuer, kid, now) {
  if (signingKeys?.issuer === issuer && signingKeys.until > now) {
    return signingKeys.keys.find((key) => key.kid === kid);
  }
  const response = await fetch(issuer + "/cdn-cgi/access/certs", {
    redirect: "error", signal: AbortSignal.timeout(4000), cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const data = JSON.parse(await readBounded(response, 30000));
  if (!Array.isArray(data.keys)) return null;
  const keys = data.keys.filter((key) => key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  signingKeys = { issuer, keys, until: now + 5 * 60000 };
  return keys.find((key) => key.kid === kid);
}

export async function dashboardIdentity(request, env, now) {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  const issuer = env.ACCESS_TEAM_URL;
  if (!jwt || jwt.length > 6000 || !env.ACCESS_AUD || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || ""))
    return null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3 || parts.some((part) => !/^[\w-]+$/.test(part))) return null;
    const [head, data, signature] = parts;
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(base64url(head)));
    const claims = JSON.parse(decoder.decode(base64url(data)));
    const seconds = Math.floor(now / 1000);
    if (header.alg !== "RS256" || typeof header.kid !== "string" ||
      claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_AUD) ||
      !Number.isInteger(claims.exp) || claims.exp <= seconds || (claims.nbf != null && (!Number.isInteger(claims.nbf) || claims.nbf > seconds)) ||
      !Number.isInteger(claims.iat) || claims.iat > seconds + 60 ||
      typeof claims.sub !== "string" || !claims.email) return null;
    const jwk = await accessKey(issuer, header.kid, now);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64url(signature), new TextEncoder().encode(head + "." + data));
    return valid ? "admin:" + (await sha256(claims.sub)).slice(0, 16) : null;
  } catch {
    return null;
  }
}

export async function machineIdentity(request, env) {
  const auth = request.headers.get("authorization")?.match(/^Bearer ([a-z0-9_-]{2,24})\.([A-Za-z0-9_-]{43,128})$/i);
  if (!auth || !env.GROWTH_API_KEYS) return null;
  let keys;
  try {
    keys = JSON.parse(env.GROWTH_API_KEYS);
  } catch {
    return null;
  }
  const entry = Object.hasOwn(keys ?? {}, auth[1]) ? keys[auth[1]] : null;
  if (!/^[a-f0-9]{64}$/.test(entry?.sha256 || "") || !Array.isArray(entry.scopes)) return null;
  const hash = await sha256(auth[2]);
  let difference = 0;
  for (let index = 0; index < 64; index++) difference |= hash.charCodeAt(index) ^ entry.sha256.charCodeAt(index);
  return difference === 0 ? { actor: "api:" + auth[1], scopes: entry.scopes } : null;
}
