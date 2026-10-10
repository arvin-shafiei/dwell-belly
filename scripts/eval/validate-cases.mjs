// Checks generated case files against the schema and the structural rules.
// Usage: node scripts/eval/validate-cases.mjs [file ...]   (no args: every file in data/generated/delivery)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { GENERATED_DIR } from "./cases.mjs";
import { problems } from "./checks.mjs";
import { MUTATIONS } from "./mutations.mjs";
import { GeneratedCaseDraft } from "./schema.mjs";

const CaseFile = GeneratedCaseDraft.extend({
  id: z.string().regex(/^gen-\d{3,4}$/),
  track: z.literal("delivery"),
  generated: z.literal(true),
  mutation: z.enum(Object.keys(MUTATIONS)),
  seed_case: z.string().nullable(),
  grounding: z.string().nullable(),
});

const args = process.argv.slice(2);
const files = args.length
  ? args
  : (await readdir(GENERATED_DIR)).filter((n) => n.endsWith(".json")).map((n) => path.join(GENERATED_DIR, n));

let bad = 0;
for (const file of files) {
  let found;
  try {
    const parsed = CaseFile.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (!parsed.success) {
      found = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    } else {
      found = problems(parsed.data, parsed.data.mutation);
      if (path.basename(file, ".json") !== parsed.data.id) found.push("file name does not match id");
      if (/delivery-\d{3}|DL-0\d\d\b/.test(JSON.stringify(parsed.data.events))) found.push("reuses a public case's shipment reference");
    }
  } catch (err) {
    found = [err instanceof Error ? err.message : String(err)];
  }
  if (found.length) {
    bad += 1;
    console.log(`FAIL ${file}\n  ${found.join("\n  ")}`);
  }
}
console.log(`${files.length - bad} ok, ${bad} failed`);
process.exitCode = bad ? 1 : 0;
