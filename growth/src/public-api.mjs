import { discordTimestampMarkup, discordTimestampStyles, makeTeams } from "../../components/utilities/algorithms.ts";
import { day, error, integer, json, takeLimit, utcDay } from "./shared.mjs";

export const cors = { "access-control-allow-origin": "*" };
const unsigned = /^\d{1,10}$/;
export async function publicApi(request, env, url, now) {
  if (request.method !== "GET") return error("method_not_allowed", 405, { ...cors, allow: "GET" });
  const client = request.headers.get("CF-Connecting-IP") ?? "local";
  if (!(await env.PUBLIC_RATE.limit({ key: client })).success)
    return error("rate_limit", 429, { ...cors, "retry-after": "60" });
  const nextDay = (Math.floor(now / day) + 1) * day;
  if (!(await takeLimit(env.DB, "public_api", utcDay(now), integer(env.PUBLIC_API_DAILY_LIMIT, 1500, 0, 1500), nextDay + day)))
    return error("daily_quota", 429, { ...cors, "retry-after": String(Math.ceil((nextDay - now) / 1000)) });

  const reply = (result) => json(result, 200, cors);
  if (url.pathname === "/api/v1/discord-timestamp") {
    const seconds = url.searchParams.get("unix") || "";
    if (!unsigned.test(seconds) || Number(seconds) > 4102444800) return error("invalid_unix_seconds", 400, cors);
    const unix = Number(seconds);
    return reply({ unix, formats: Object.fromEntries(discordTimestampStyles.map((style) => [style, discordTimestampMarkup(unix, style)])) });
  }
  const players = url.searchParams.get("players") || "";
  const teams = url.searchParams.get("teams") || "";
  if (!unsigned.test(players) || !unsigned.test(teams) || Number(players) < 2 || Number(players) > 64 ||
    Number(teams) < 2 || Number(teams) > Math.min(32, Number(players))) return error("invalid_team_parameters", 400, cors);
  const slots = Array.from({ length: Number(players) }, (_, i) => String(i + 1)).join("\n");
  return reply({ teams: makeTeams(slots, Number(teams), false).map((team) => team.map(Number)) });
}
