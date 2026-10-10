// Scores an agent on the public delivery cases and the generated hard cases.
// Usage: npm run eval -- (--agent baseline | --api http://localhost:4000/api/cases | --traces traces)
//        [--set all|public|generated] [--ids delivery-024,gen-003] [--limit 10] [--concurrency 6]
// Output: a table on stdout and runs/eval-<time>.json with every decision and verdict.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { baseline, fromApi, fromTraces } from "./agents.mjs";
import { loadCases } from "./cases.mjs";
import { pool, spend } from "./claude.mjs";
import { judge, scoreCase } from "./score.mjs";

const { values: args } = parseArgs({
  options: {
    agent: { type: "string" },
    api: { type: "string" },
    traces: { type: "string" },
    set: { type: "string", default: "all" },
    ids: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "6" },
  },
});

function pickAgent() {
  if (args.api) return { name: `api ${args.api}`, run: fromApi(args.api) };
  if (args.traces) return { name: `traces ${args.traces}`, run: fromTraces(path.resolve(args.traces)) };
  if (args.agent === "baseline") return { name: "baseline", run: baseline() };
  throw new Error("Pick an agent: --agent baseline, --api <url> or --traces <dir>");
}

function summarise(rows) {
  const n = rows.length;
  const mean = rows.reduce((s, r) => s + r.score, 0) / n;
  return {
    n,
    score: mean.toFixed(2),
    pass: rows.filter((r) => r.pass).length,
    critical: rows.filter((r) => r.critical).length,
    errors: rows.filter((r) => !r.completed).length,
  };
}

function groupBy(rows, key) {
  const out = {};
  for (const r of rows) (out[r[key]] ??= []).push(r);
  return out;
}

async function evalOne(agent, c) {
  let result;
  try {
    result = await agent.run(c.view);
  } catch (err) {
    result = { outcome: "error", nextAction: null, handoff: err instanceof Error ? err.message : String(err), wontDo: [] };
  }
  let judgement = null;
  let judgeError = null;
  if (result.outcome !== "error") {
    try {
      judgement = await judge(c.view, c.expected, result);
    } catch (err) {
      judgeError = err instanceof Error ? err.message : String(err);
    }
  }
  const verdict = scoreCase(c.expected, result, judgement);
  return { id: c.id, set: c.set, mutation: c.mutation, ...verdict, result, judgement, judgeError, expected: c.expected };
}

async function main() {
  const agent = pickAgent();
  let cases = await loadCases(args.set);
  if (args.ids) cases = cases.filter((c) => args.ids.split(",").includes(c.id));
  if (args.limit) cases = cases.slice(0, Number(args.limit));
  if (cases.length === 0) throw new Error("No cases matched. Generated cases come from `npm run gen:cases`.");

  console.log(`Agent: ${agent.name}. Cases: ${cases.length}`);
  const rows = await pool(cases, Number(args.concurrency), (c) => evalOne(agent, c));

  console.log("\nBy set");
  console.table(Object.fromEntries(Object.entries(groupBy(rows, "set")).map(([k, v]) => [k, summarise(v)])));
  console.log("By difficulty pattern");
  console.table(Object.fromEntries(Object.entries(groupBy(rows, "mutation")).map(([k, v]) => [k, summarise(v)])));

  const failed = rows.filter((r) => !r.pass).sort((a, b) => a.score - b.score);
  console.log(`Not passing (${failed.length}):`);
  for (const r of failed) {
    const why = r.critical
      ? `BROKE RULE: ${r.judgement.violations[0].rule}`
      : (r.judgement?.note ?? r.judgeError ?? r.result.handoff ?? "no detail");
    console.log(`  ${r.id}  ${r.score.toFixed(2)}  [${r.mutation}] ${r.result.outcome}: ${why}`);
  }

  await mkdir("runs", { recursive: true });
  const file = path.join("runs", `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify({ agent: agent.name, summary: summarise(rows), spend, rows }, null, 2));
  console.log(`\nOverall: ${JSON.stringify(summarise(rows))}`);
  console.log(`Eval model spend: ${spend.calls} calls, $${spend.usd.toFixed(2)}. Full results: ${file}`);
}

await main();
