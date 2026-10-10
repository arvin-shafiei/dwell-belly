// Delivers cleared messages and states plainly what happened to each. "Recorded" means only that
// a transport accepted the message: whether it reached anyone, and whether they replied, is
// reported as still awaited. Notes are built from counts and channel names, never from the text a
// remote system sent back, so nothing instruction-like can travel from a reply into an answer.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { callTool, type Tool, type ToolCallOptions } from "./tools.ts";
import type { PlannedAction } from "./types.ts";

export interface SendResult { ok: boolean; ref?: string; error?: string }

export interface Transport {
  name: string;
  channels: string[] | "*";
  /** False when nothing real is behind it; the note then says the recipient has not been reached. */
  live: boolean;
  send(action: PlannedAction): Promise<SendResult>;
}

export interface Attempt {
  channel: string;
  transport: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export interface DeliveryResult {
  status: "recorded" | "failed";
  attempts: Attempt[];
  ref?: string;
  /** Where it was accepted. Absent when status is "failed". */
  via?: { channel: string; transport: string; live: boolean };
  note: string;
}

/** Deliveries already made in one run, keyed by recipient, channel and message. */
export type DeliveryLedger = Map<string, Promise<DeliveryResult>>;

export interface DeliverOptions {
  timeoutMs?: number;
  retries?: number;
  /** Other channels to try, in order, once the action's own channel has failed. */
  alternates?: string[];
  /** One per run. Left out, deliveries through the same transports array share a ledger. */
  ledger?: DeliveryLedger;
  now?: () => number;
}

export interface SandboxEntry {
  ref: string;
  at: string;
  recipient: string;
  channel: string;
  kind: string;
  purpose: string;
  message: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const label = (channel: string) => channel.replace(/\s+/g, " ").trim().slice(0, 40) || "an unnamed channel";
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Accepts every channel and keeps the message. It reaches nobody, and says so. */
export function sandboxTransport(options: { file?: string; now?: () => Date } = {}): Transport & { entries: SandboxEntry[] } {
  const { file, now = () => new Date() } = options;
  const entries: SandboxEntry[] = [];
  // Counted before the file write, so two sends in flight at once cannot share a ref.
  let issued = 0;
  return {
    name: "sandbox outbox",
    channels: "*",
    live: false,
    entries,
    async send(action) {
      const entry: SandboxEntry = {
        ref: `sandbox-${String(++issued).padStart(4, "0")}`, at: now().toISOString(), recipient: action.recipient,
        channel: action.channel, kind: action.kind, purpose: action.purpose, message: action.message,
      };
      if (file) {
        try {
          await mkdir(path.dirname(file), { recursive: true });
          await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
        } catch (err) {
          // The file is the record a person reads afterwards; without it the message is not recorded.
          return { ok: false, error: `could not write the sandbox outbox file: ${message(err)}` };
        }
      }
      entries.push(entry);
      return { ok: true, ref: entry.ref };
    },
  };
}

function toolRef(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const fields = body as Record<string, unknown>;
  for (const key of ["ref", "id", "message_id", "messageId", "reference"]) {
    const value = typeof fields[key] === "number" ? String(fields[key]) : fields[key];
    // Only an identifier-shaped value is echoed; free text from the remote system is not, and
    // neither is a sentence spelt with underscores, which is why a digit is required.
    if (typeof value === "string" && /^[\w.:-]{1,80}$/.test(value) && /\d/.test(value)) return value;
  }
  return undefined;
}

/** Sends the action's fields as the tool input. */
export function toolTransport(tool: Tool, options: ToolCallOptions & { channels?: string[] | "*" } = {}): Transport {
  const { channels = "*", ...call } = options;
  return {
    name: `tool ${tool.name}`,
    channels,
    live: true,
    async send(action) {
      const res = await callTool(tool, {
        recipient: action.recipient, channel: action.channel, kind: action.kind, purpose: action.purpose, message: action.message,
      }, call);
      return res.ok ? { ok: true, ref: toolRef(res.body) } : { ok: false, error: res.error ?? "tool call failed" };
    },
  };
}

/** Test double: fails every send whose channel matches the pattern and accepts the rest. */
export function failingTransport(pattern: RegExp | string, channels: string[] | "*" = "*"): Transport & { calls: PlannedAction[] } {
  // A global or sticky pattern remembers its position between tests; a fresh one does not.
  const re = typeof pattern === "string" ? null : new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""));
  const matches = (channel: string) => (re ? re.test(channel) : channel.toLowerCase().includes((pattern as string).toLowerCase()));
  const calls: PlannedAction[] = [];
  return {
    name: "failing test transport",
    channels,
    live: false,
    calls,
    async send(action) {
      calls.push(action);
      return matches(action.channel) ? { ok: false, error: `simulated failure on ${action.channel}` } : { ok: true, ref: `test-${calls.length}` };
    },
  };
}

function pick(transports: Transport[], channel: string): Transport | undefined {
  return transports.find((t) => t.channels !== "*" && t.channels.some((c) => same(c, channel)))
    ?? transports.find((t) => t.channels === "*");
}

interface Tried extends Attempt { ref?: string; unsure: boolean }

async function attempt(transport: Transport, action: PlannedAction, timeoutMs: number, now: () => number): Promise<Tried> {
  const started = now();
  const base = { channel: action.channel, transport: transport.name };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      // Wrapped so that a transport which throws before returning a promise is caught here too.
      Promise.resolve().then(() => transport.send(action)),
      new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), timeoutMs); }),
    ]);
    const latencyMs = now() - started;
    // The send is still in flight after a timeout, so it may yet land: that is "unsure", not "not sent".
    if (res === "timeout") return { ...base, ok: false, error: `timed out after ${timeoutMs} ms`, latencyMs, unsure: true };
    if (typeof res !== "object" || res === null || typeof res.ok !== "boolean") {
      return { ...base, ok: false, error: "transport gave an unusable reply", latencyMs, unsure: true };
    }
    if (!res.ok) return { ...base, ok: false, error: String(res.error ?? "transport refused the message").slice(0, 300), latencyMs, unsure: false };
    return { ...base, ok: true, latencyMs, unsure: false, ref: typeof res.ref === "string" && res.ref ? res.ref : undefined };
  } catch (err) {
    return { ...base, ok: false, error: `transport error: ${message(err).slice(0, 300)}`, latencyMs: now() - started, unsure: true };
  } finally {
    clearTimeout(timer);
  }
}

function failures(tried: Tried[]): string[] {
  const order: string[] = [];
  for (const t of tried) if (!t.ok && !order.some((c) => same(c, t.channel))) order.push(t.channel);
  return order.map((channel) => {
    const mine = tried.filter((t) => !t.ok && same(t.channel, channel));
    return mine.every((t) => t.transport === "none") ? `no transport is connected for ${label(channel)}` : `${label(channel)} failed ${times(mine.length)}`;
  });
}

function finish(tried: Tried[], won?: { attempt: Tried; transport: Transport }): DeliveryResult {
  const attempts: Attempt[] = tried.map(({ channel, transport, ok, error, latencyMs }) =>
    (error === undefined ? { channel, transport, ok, latencyMs } : { channel, transport, ok, error, latencyMs }));
  const failed = failures(tried);
  if (!won) {
    const unsure = tried.some((t) => t.unsure);
    const tail = unsure
      ? "an attempt broke off without an answer, so it is not confirmed whether anything was sent"
      : "nothing was sent";
    return { status: "failed", attempts, note: `Not delivered: ${failed.join(", ")}; ${tail}.` };
  }
  const { attempt: a, transport } = won;
  const unsure = tried.some((t) => t.unsure)
    ? "An attempt broke off without an answer, so it is not confirmed whether that one was also sent. "
    : "";
  const before = failed.length ? `${capital(failed.join(", "))}. ${unsure}` : "";
  const ref = a.ref ? ` (ref ${a.ref})` : "";
  const note = transport.live
    ? `${before}Accepted by ${transport.name} for ${label(a.channel)}${ref}. Receipt by the recipient is not confirmed and no reply has arrived yet.`
    : `${before}Recorded in the ${transport.name} for ${label(a.channel)}${ref}. No live system is connected, so the recipient has not received it and no reply has arrived.`;
  return { status: "recorded", attempts, ref: a.ref, via: { channel: a.channel, transport: transport.name, live: transport.live }, note };
}

async function send(action: PlannedAction, transports: Transport[], options: DeliverOptions): Promise<DeliveryResult> {
  const { alternates = [], now = Date.now } = options;
  // A retry count or timeout that is not a usable number falls back to the default: NaN would
  // send nothing, Infinity would never stop, and a timer cannot hold more than 2^31-1 ms.
  const asked = options.timeoutMs ?? 20_000;
  const timeoutMs = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 2 ** 31 - 1) : 20_000;
  const retries = Number.isFinite(options.retries) ? Math.floor(options.retries as number) : 1;
  const tried: Tried[] = [];
  const channels = [action.channel, ...alternates.filter((c) => !same(c, action.channel))];
  for (const [i, channel] of channels.entries()) {
    const routed: PlannedAction = { ...action, channel };
    const transport = pick(transports, channel);
    if (!transport) {
      tried.push({ channel, transport: "none", ok: false, error: `no transport is connected for ${label(channel)}`, latencyMs: 0, unsure: false });
      continue;
    }
    // Only the channel the plan chose is retried; an alternate gets one try.
    const tries = i === 0 ? 1 + Math.max(0, retries) : 1;
    for (let n = 0; n < tries; n++) {
      const a = await attempt(transport, routed, timeoutMs, now);
      tried.push(a);
      if (a.ok) return finish(tried, { attempt: a, transport });
    }
  }
  return finish(tried);
}

const ledgers = new WeakMap<Transport[], DeliveryLedger>();

/**
 * Sends one cleared message: the action's channel first (with retries), then each alternate
 * channel once. Never throws. The identical recipient, channel and message delivered again
 * through the same ledger gets the first result back and is not sent a second time.
 */
export async function deliver(action: PlannedAction, transports: Transport[], options: DeliverOptions = {}): Promise<DeliveryResult> {
  try {
    const empty = [!action?.recipient?.trim() && "recipient", !action?.message?.trim() && "message text"].filter(Boolean);
    if (empty.length) return { status: "failed", attempts: [], note: `Not delivered: the action has no ${empty.join(" and no ")}; nothing was sent.` };

    let ledger = options.ledger ?? ledgers.get(transports);
    if (!ledger) ledgers.set(transports, ledger = new Map());
    const key = JSON.stringify([action.recipient.trim().toLowerCase(), action.channel.trim().toLowerCase(), action.message.trim()]);
    const first = ledger.get(key);
    if (first) return await first;
    // The promise is stored before the send starts, so two identical deliveries racing each other send once.
    const pending = send(action, transports, options);
    ledger.set(key, pending);
    return await pending;
  } catch (err) {
    return { status: "failed", attempts: [], note: `Not delivered: the outbox broke (${message(err).slice(0, 200)}); it is not confirmed whether anything was sent.` };
  }
}

/** States what a delivery result proves and what is still awaited. It checks nothing new. */
export function verify(result: DeliveryResult): { ok: boolean; note: string } {
  if (!result || result.status !== "recorded" || !result.via) {
    return { ok: false, note: `Not confirmed: no transport accepted the message. ${result?.note ?? "No delivery result was given."}` };
  }
  const ref = result.ref ? ` (ref ${result.ref})` : "";
  const { transport, channel, live } = result.via;
  if (!live) {
    return { ok: true, note: `Confirmed: the ${transport} recorded the message for ${label(channel)}${ref}. Still awaited: sending through a live system, receipt by the recipient, and any reply.` };
  }
  return { ok: true, note: `Confirmed: ${transport} accepted the message for ${label(channel)}${ref}. Still awaited: receipt by the recipient and any reply.` };
}
