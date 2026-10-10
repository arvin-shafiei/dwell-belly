// Checks generated, adversarial and city case files against the schema and the structural rules.
// Usage: node scripts/eval/validate-cases.mjs [file ...]   (no args: every file in data/generated/delivery, data/adversarial/delivery and data/city/delivery)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ADVERSARIAL_DIR, CITY_DIR, GENERATED_DIR } from "./cases.mjs";
import { problems } from "./checks.mjs";
import { MUTATIONS } from "./mutations.mjs";
import { Event, FORMATS, GeneratedCaseDraft } from "./schema.mjs";

const CaseFile = GeneratedCaseDraft.extend({
  id: z.string().regex(/^(gen|adv|city)-\d{3,4}$/),
  track: z.literal("delivery"),
  generated: z.literal(true),
  mutation: z.enum(Object.keys(MUTATIONS)),
  seed_case: z.string().nullable(),
  grounding: z.string().nullable(),
  // Adversarial cases only. Attachments are written to the raw folder as real files by render-raw.mjs.
  trap: z.string().optional(),
  basis: z.string().optional(),
  format: z.enum(FORMATS).optional(),
  attachments: z.array(z.object({
    name: z.string().regex(/^[\w.-]+\.(pdf|png|csv|txt|md|eml|json)$/),
    text: z.string(),
    missing: z.boolean().optional(),
    corrupt: z.boolean().optional(),
  })).optional(),
  post_decision_events: z.array(Event).optional(),
});

const args = process.argv.slice(2);
const jsonIn = async (dir) => (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".json")).map((n) => path.join(dir, n));
const files = args.length ? args : [...await jsonIn(GENERATED_DIR), ...await jsonIn(ADVERSARIAL_DIR), ...await jsonIn(CITY_DIR)];

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
      if (parsed.data.format === "decision_point_mid" && !parsed.data.post_decision_events?.length) found.push("format decision_point_mid needs post_decision_events");
      for (const a of parsed.data.attachments ?? []) {
        if (!JSON.stringify(parsed.data.events).includes(a.name)) found.push(`attachment ${a.name} is never mentioned in the events`);
      }
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
