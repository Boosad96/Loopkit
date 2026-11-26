import { readFile, writeFile } from "node:fs/promises";
import { registry } from "../src/registry.mjs";

const target = new URL("../tool-registry.json", import.meta.url);
const content = JSON.stringify(registry, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== content) throw Error("Run npm run growth:registry to update the tool registry.");
} else {
  await writeFile(target, content);
}
