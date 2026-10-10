// The safety gate's thresholds for spoken words: the same ones the gate uses for written messages,
// read from the flow config, with the defaults when the file cannot be read.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GateConfig } from "../agent/gate.ts";
import type { Flow } from "../lib/flow.ts";

const DEFAULT_GATE: GateConfig = { allow_below: 0.3, block_above: 0.8 };

export async function gateConfig(): Promise<GateConfig> {
  try {
    const flow: Flow = JSON.parse(await readFile(path.join(process.cwd(), "flows", "default-incident.json"), "utf8"));
    return { ...DEFAULT_GATE, ...(flow.nodes.find((n) => n.type === "safety_gate")?.config as Partial<GateConfig> | undefined) };
  } catch {
    return DEFAULT_GATE;
  }
}
