// Finds tools that arrive with a case and calls them over HTTP. A manifest is case content, so it
// is untrusted: names are reduced to a safe character set, only http(s) URLs are accepted, and a
// tool's reply is handed back as data and never copied into an error string.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface Tool {
  name: string;
  description: string;
  method: string;
  url: string;
  inputSchema?: unknown;
}

export interface FoundTools {
  tools: Tool[];
  /** Manifest files that gave no usable tool, or only some, each with a short reason. */
  unparsed: string[];
}

export interface ToolCallOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface ToolCallResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
  latencyMs: number;
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const NO_BODY = new Set(["GET", "DELETE"]);
const MAX_DEPTH = 3;
const MAX_DESCRIPTION_CHARS = 300;
const MAX_BODY_CHARS = 100_000;
const MD_LINE = /^\s*(?:[-*]\s*)?[*_`]*([A-Za-z0-9][\w.-]*?)[*_`]*\s*:[\s*_`]*(GET|POST|PUT|PATCH|DELETE)\s+(https?:\/\/[^\s`)]+)`?\s*(?:[-–—:]\s*)?(.*)$/i;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

function isHttpUrl(url: string): boolean {
  try {
    // Path placeholders such as {id} are filled at call time, so they are neutralised for the check.
    const { protocol } = new URL(url.replace(/\{[^{}/]+\}/g, "x"));
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function normalise(name: unknown, method: unknown, url: unknown, description: unknown, inputSchema: unknown): Tool | null {
  const safeName = text(name).replace(/[^\w.-]+/g, "_").slice(0, 64);
  const verb = (text(method) || "POST").toUpperCase();
  const target = text(url);
  if (!safeName || !METHODS.has(verb) || !isHttpUrl(target)) return null;
  const tool: Tool = { name: safeName, description: text(description).replace(/\s+/g, " ").slice(0, MAX_DESCRIPTION_CHARS), method: verb, url: target };
  if (inputSchema !== undefined && inputSchema !== null) tool.inputSchema = inputSchema;
  return tool;
}

interface Parsed { tools: Tool[]; skipped: number }

function fromList(entries: unknown[]): Parsed {
  const out: Parsed = { tools: [], skipped: 0 };
  for (const e of entries) {
    const tool = isObject(e)
      ? normalise(e.name, e.method, e.url ?? e.endpoint ?? e.href, e.description, e.inputSchema ?? e.input_schema ?? e.parameters)
      : null;
    if (tool) out.tools.push(tool);
    else out.skipped += 1;
  }
  return out;
}

function fromOpenApi(doc: Json): Parsed {
  const out: Parsed = { tools: [], skipped: 0 };
  const servers = Array.isArray(doc.servers) ? doc.servers : [];
  const base = text(isObject(servers[0]) ? servers[0].url : "").replace(/\/+$/, "");
  for (const [route, item] of Object.entries(isObject(doc.paths) ? doc.paths : {})) {
    if (!isObject(item)) continue;
    for (const [verb, op] of Object.entries(item)) {
      if (!METHODS.has(verb.toUpperCase()) || !isObject(op)) continue;
      const content = isObject(op.requestBody) && isObject(op.requestBody.content) ? op.requestBody.content["application/json"] : undefined;
      const schema = isObject(content) ? content.schema : op.parameters;
      const tool = normalise(text(op.operationId) || `${verb}_${route}`, verb, `${base}${route}`, op.summary ?? op.description, schema);
      if (tool) out.tools.push(tool);
      else out.skipped += 1;
    }
  }
  return out;
}

function fromMarkdown(source: string): Parsed {
  const out: Parsed = { tools: [], skipped: 0 };
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(MD_LINE);
    if (!m) continue;
    const tool = normalise(m[1], m[2], m[3], m[4], undefined);
    if (tool) out.tools.push(tool);
    else out.skipped += 1;
  }
  return out;
}

function parseManifest(fileName: string, source: string): Parsed {
  if (fileName.endsWith(".md")) return fromMarkdown(source);
  const doc: unknown = JSON.parse(source);
  if (Array.isArray(doc)) return fromList(doc);
  if (!isObject(doc)) return { tools: [], skipped: 0 };
  // A file named tools.json may still be an OpenAPI document; the content decides.
  if (isObject(doc.paths)) return fromOpenApi(doc);
  return fromList(Array.isArray(doc.tools) ? doc.tools : []);
}

function isManifest(fileName: string): boolean {
  const n = fileName.toLowerCase();
  return n === "tools.json" || n === "tool-manifest.json" || n === "tools.md" || n === "openapi.json" || n.endsWith(".openapi.json");
}

async function manifests(dir: string, depth = 0): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) {
        // One subfolder that cannot be opened must not hide the manifests found elsewhere.
        try { out.push(...await manifests(full, depth + 1)); } catch { /* skipped */ }
      }
    } else if (isManifest(entry.name)) {
      out.push(full);
    }
  }
  return out.sort();
}

/** Never throws: a folder that cannot be read, or holds no manifest, gives an empty list. */
export async function findTools(caseDir: string): Promise<FoundTools> {
  const found: FoundTools = { tools: [], unparsed: [] };
  let files: string[];
  try {
    files = await manifests(caseDir);
  } catch {
    return found;
  }
  const taken = new Set<string>();
  for (const file of files) {
    const name = path.relative(caseDir, file);
    try {
      const parsed = parseManifest(path.basename(file).toLowerCase(), await readFile(file, "utf8"));
      if (parsed.tools.length === 0) found.unparsed.push(`${name} (no usable tool found)`);
      else if (parsed.skipped > 0) found.unparsed.push(`${name} (${parsed.skipped} of ${parsed.tools.length + parsed.skipped} entries skipped)`);
      for (const tool of parsed.tools) {
        // Two manifests naming the same tool: the first one read wins, so a call is never ambiguous.
        if (taken.has(tool.name)) continue;
        taken.add(tool.name);
        found.tools.push(tool);
      }
    } catch (err) {
      found.unparsed.push(`${name} (${err instanceof SyntaxError ? "not valid JSON" : "could not be read"})`);
    }
  }
  return found;
}

/**
 * Calls one tool. Input keys that match a {placeholder} in the URL fill the path; the rest go in
 * the query string for GET and DELETE and in a JSON body otherwise. Never throws.
 */
export async function callTool(tool: Tool, input: Record<string, unknown> = {}, options: ToolCallOptions = {}): Promise<ToolCallResult> {
  const { fetchImpl = fetch, now = Date.now } = options;
  // AbortSignal.timeout throws on anything but a whole number of milliseconds it can hold in a timer.
  const asked = options.timeoutMs ?? 20_000;
  const timeoutMs = Number.isFinite(asked) && asked > 0 ? Math.min(Math.ceil(asked), 2 ** 31 - 1) : 20_000;
  const started = now();
  const failed = (error: string, status?: number, body?: unknown): ToolCallResult =>
    ({ ok: false, status, body, error, latencyMs: now() - started });

  const method = String(tool.method ?? "").toUpperCase();
  if (!METHODS.has(method)) return failed(`unsupported method for tool ${tool.name}`);

  const rest: Record<string, unknown> = { ...input };
  const missing: string[] = [];
  const climbing: string[] = [];
  const filled = String(tool.url ?? "").replace(/\{([^{}/]+)\}/g, (_, key: string) => {
    if (rest[key] === undefined || rest[key] === null || rest[key] === "") { missing.push(key); return ""; }
    const value = encodeURIComponent(String(rest[key]));
    // A dot segment survives encoding and would make the call land on a different path.
    if (value === "." || value === "..") climbing.push(key);
    delete rest[key];
    return value;
  });
  if (missing.length) return failed(`missing input for the URL of tool ${tool.name}: ${missing.join(", ")}`);
  if (climbing.length) return failed(`refused: input would change the path of tool ${tool.name}: ${climbing.join(", ")}`);

  let url: URL;
  try {
    url = new URL(filled);
  } catch {
    return failed(`tool ${tool.name} has no valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return failed(`refused: tool ${tool.name} does not use an http(s) URL`);

  try {
    const init: RequestInit = { method, headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) };
    if (NO_BODY.has(method)) {
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
      }
    } else {
      init.headers = { accept: "application/json", "content-type": "application/json" };
      init.body = JSON.stringify(rest);
    }
    const res = await fetchImpl(url, init);
    const raw = (await res.text()).slice(0, MAX_BODY_CHARS);
    let body: unknown = raw;
    try { body = JSON.parse(raw); } catch { /* not JSON: the text is the body */ }
    if (!res.ok) return failed(`tool ${tool.name} answered HTTP ${res.status}`, res.status, body);
    return { ok: true, status: res.status, body, latencyMs: now() - started };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") return failed(`tool ${tool.name} timed out after ${timeoutMs} ms`);
    return failed(`call to tool ${tool.name} failed: ${message(err).slice(0, 200)}`);
  }
}
