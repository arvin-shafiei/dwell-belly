// Generates hard delivery cases the 50 public ones do not contain, each with its own answer key.
// Usage: npm run gen:cases -- --per 4 [--only needs_human] [--seed 1]
// Output: data/generated/delivery/gen-NNN.json. Re-running adds cases, it never overwrites.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { problems } from "./checks.mjs";
import { ask, pool, spend } from "./claude.mjs";
import { GENERATED_DIR, loadPublicRaw } from "./cases.mjs";
import { MUTATIONS } from "./mutations.mjs";
import { GeneratedCaseDraft } from "./schema.mjs";
import { SYSTEM, exemplar, rng } from "./gen-prompt.mjs";

const { values: args } = parseArgs({
  options: {
    per: { type: "string", default: "4" },
    only: { type: "string" },
    seed: { type: "string", default: "1" },
    concurrency: { type: "string", default: "6" },
  },
});

async function nextNumber() {
  const names = await readdir(GENERATED_DIR).catch(() => []);
  const used = names.map((n) => Number(n.match(/^gen-(\d+)\.json$/)?.[1])).filter(Number.isFinite);
  return Math.max(0, ...used) + 1;
}

async function main() {
  const names = args.only ? [args.only] : Object.keys(MUTATIONS);
  for (const n of names) if (!MUTATIONS[n]) throw new Error(`Unknown mutation "${n}". Known: ${Object.keys(MUTATIONS).join(", ")}`);

  const seeds = await loadPublicRaw();
  const random = rng(Number(args.seed));
  const pick = () => seeds[Math.floor(random() * seeds.length)];
  const jobs = names.flatMap((mutation) =>
    Array.from({ length: Number(args.per) }, () => ({ mutation, examples: [pick(), pick()], setting: pick() })));

  await mkdir(GENERATED_DIR, { recursive: true });
  const first = await nextNumber();
  console.log(`Generating ${jobs.length} cases from gen-${String(first).padStart(3, "0")}`);

  const results = await pool(jobs, Number(args.concurrency), async (job, i) => {
    const user = `Example cases from the practice set:\n\n${job.examples.map(exemplar).join("\n\n")}\n\n` +
      `Difficulty pattern to build around (${job.mutation}): ${MUTATIONS[job.mutation].brief}\n\n` +
      `Set the new case in the same area of delivery work as "${job.setting.title.replace(/^Case \d+: /, "")}", with a different item, different people and a different plot.`;
    const { output: draft } = await ask({ system: SYSTEM, user, schema: GeneratedCaseDraft });
    const found = problems(draft, job.mutation);
    if (found.length) throw new Error(`${job.mutation}: rejected draft: ${found.join("; ")}`);
    const id = `gen-${String(first + i).padStart(3, "0")}`;
    const file = { id, track: "delivery", generated: true, mutation: job.mutation, seed_case: job.setting.id, grounding: null, ...draft };
    await writeFile(path.join(GENERATED_DIR, `${id}.json`), JSON.stringify(file, null, 2) + "\n");
    console.log(`  ${id}  ${job.mutation}  ${draft.title}`);
    return { id };
  });

  const failed = results.filter((r) => r.error);
  for (const f of failed) console.error(`  FAILED  ${f.error}`);
  console.log(`Wrote ${results.length - failed.length}, failed ${failed.length}. Claude: ${spend.calls} calls, $${spend.usd.toFixed(2)}`);
  if (failed.length === results.length) process.exitCode = 1;
}

await main();
