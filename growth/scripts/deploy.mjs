import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const databaseId = process.env.LOOPKIT_GROWTH_D1_ID;
if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(databaseId || "") ||
  databaseId === "00000000-0000-4000-8000-000000000000")
  throw Error("Set LOOPKIT_GROWTH_D1_ID to the growth D1 UUID.");
const config = new URL("../wrangler.toml", import.meta.url);
const folder = mkdtempSync(fileURLToPath(new URL("../.deploy-", import.meta.url)));
const temporary = folder + ".toml";
try {
  writeFileSync(temporary, readFileSync(config, "utf8").replace("00000000-0000-4000-8000-000000000000", databaseId));
  const wrangler = fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  for (const args of [
    ["d1", "migrations", "apply", "DB", "--remote"],
    ["deploy", "--keep-vars"],
  ]) {
    const result = spawnSync(process.execPath, [wrangler, ...args, "--config", temporary], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  rmSync(temporary, { force: true });
  rmSync(folder, { recursive: true, force: true });
}
