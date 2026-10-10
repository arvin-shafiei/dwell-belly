// Writes data/generated/index.json: one line per generated case, without the answer key text.
// Usage: npm run index:cases
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, GENERATED_DIR } from "./cases.mjs";

const names = (await readdir(GENERATED_DIR)).filter((n) => n.endsWith(".json")).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const index = [];
for (const name of names) {
  const c = JSON.parse(await readFile(path.join(GENERATED_DIR, name), "utf8"));
  index.push({
    id: c.id,
    mutation: c.mutation,
    title: c.title,
    events: c.events.length,
    dispositions: c.expected.acceptable_dispositions,
    seed_case: c.seed_case,
    grounding: c.grounding,
    file: `generated/delivery/${name}`,
  });
}
await writeFile(path.join(DATA, "generated", "index.json"), JSON.stringify(index, null, 2) + "\n");

const count = (key) => index.reduce((acc, c) => {
  for (const v of [c[key]].flat()) acc[v] = (acc[v] ?? 0) + 1;
  return acc;
}, {});
console.log(`${index.length} cases indexed`);
console.table(count("mutation"));
console.table(count("dispositions"));
