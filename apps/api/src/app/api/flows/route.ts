import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { json } from "@/lib/cors";
import type { Flow } from "@/lib/flow";

const FLOWS_DIR = path.join(process.cwd(), "flows");

export async function GET() {
  const files = (await readdir(FLOWS_DIR)).filter((f) => f.endsWith(".json"));
  const flows: Flow[] = await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(FLOWS_DIR, f), "utf8"))),
  );
  return json({ flows });
}
