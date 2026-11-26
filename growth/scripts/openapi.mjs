import { readFile, writeFile } from "node:fs/promises";
import { growthOpenApi, publicOpenApi } from "../src/openapi.mjs";

for (const [filename, specification] of [["openapi.growth.json", growthOpenApi], ["openapi.public.json", publicOpenApi]]) {
  const target = new URL("../" + filename, import.meta.url);
  const content = JSON.stringify(specification, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if ((await readFile(target, "utf8")) !== content) throw Error("Run npm run growth:openapi to update " + filename);
  } else {
    await writeFile(target, content);
  }
}
