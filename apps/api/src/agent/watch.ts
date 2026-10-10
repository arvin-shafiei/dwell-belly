// The watch flow: every order update goes to the check that owns it, and a failed check opens a case
// for the incident flow. The practice data has no order stream and no fleet data, so nothing here
// reads from a feed: it runs on events a caller supplies (the demo uses a small made-up fleet).
// The checks are code rules over numbers the event carries. The one judgement call, whether a driver
// note reads like a completed delivery, goes to an injected judge and is skipped when there is none.
//
// Three outcomes are kept apart on purpose: a check that passed (ok), a check that failed (opensCase,
// with a summary), and a check that could not run because the event was malformed (error, no case).
// A broken feed is not a delivery incident, and reporting it as one would be a false statement.
//
// Free text from the event (driver notes, order notes, complaint wording) is never copied into reasons
// or summaries; they carry ids, numbers and times only.
import { z } from "zod";
import type { ModelUsage } from "./models.ts";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";
const JEV_USD_PER_INPUT_TOKEN = 42 / 1e9;
const EARTH_RADIUS_M = 6_371_000;
const MINUTE_MS = 60_000;

export const EVENT_KINDS = ["placed", "address_changed", "loaded", "departed", "gps", "eta_changed", "attempted", "delivered"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type CheckName = "order" | "load" | "on_route" | "proof" | "aftercare";

export interface OrderEvent {
  orderId: string;
  kind: EventKind;
  /** ISO timestamp of the update. */
  at: string;
  data: Record<string, unknown>;
}

/** Lives in the watch flow node's `config`; every field has a default. */
export interface WatchConfig {
  addressParts: string[];
  minSlotMinutes: number;
  /** A flag in this list must come with a non-empty note of the same name. */
  flagsNeedingNotes: string[];
  lateToleranceMinutes: number;
  serviceMinutes: number;
  maxProofDistanceM: number;
  photoOnAttempt: boolean;
  /** Judge probability that the note describes a completed delivery; below this a "delivered" note is inconsistent. */
  noteMatchAtLeast: number;
}

export const DEFAULT_WATCH: WatchConfig = {
  addressParts: ["line1", "city", "postcode"],
  minSlotMinutes: 30,
  flagsNeedingNotes: ["cold", "fragile", "access"],
  lateToleranceMinutes: 10,
  serviceMinutes: 5,
  maxProofDistanceM: 100,
  photoOnAttempt: true,
  noteMatchAtLeast: 0.5,
};

export type NoteVerdict = { ok: true; probability: number; usage: ModelUsage } | { ok: false; error: string };
/** Answers "does this driver note describe a completed delivery" with a probability. */
export type NoteJudge = (note: string) => Promise<NoteVerdict>;

export interface OpenItem {
  orderId: string;
  kind: "complaint" | "claim" | "promise";
  id: string;
  due?: string;
}

export interface WatchContext {
  /** ISO time to judge "in the future" against. Defaults to the event's own time, never the wall clock. */
  now?: string;
  config?: Partial<WatchConfig>;
  judge?: NoteJudge;
  /** Complaints, claims and promises still open, for any order; aftercare filters by order id. */
  openItems?: OpenItem[];
}

export interface CheckResult {
  check: CheckName;
  ok: boolean;
  reasons: string[];
  opensCase: boolean;
  /** One line for the incident flow. Present only when opensCase is true. */
  summary?: string;
  /** The check could not run. ok is false and no case opens. */
  error?: string;
  /** Parts of the check that were not carried out, so a pass is not read as covering them. */
  unchecked?: string[];
  /** ISO arrival time worked out by the on-route check. */
  eta?: string;
  usage?: ModelUsage;
}

export interface WatchResult {
  ok: boolean;
  opensCase: boolean;
  summary?: string;
  error?: string;
  /** One per check run. "delivered" runs two: proof and aftercare. */
  results: CheckResult[];
}

const ROUTES: Record<EventKind, CheckName[]> = {
  placed: ["order"],
  address_changed: ["order"],
  loaded: ["load"],
  departed: ["on_route"],
  gps: ["on_route"],
  eta_changed: ["on_route"],
  attempted: ["proof"],
  delivered: ["proof", "aftercare"],
};

/** Which checks handle this event. Empty for a kind the watch flow does not know. */
export function route(event: Pick<OrderEvent, "kind">): CheckName[] {
  const kind = event?.kind;
  return typeof kind === "string" && Object.hasOwn(ROUTES, kind) ? ROUTES[kind] : [];
}

const Slot = z.object({ start: z.string(), end: z.string() });
const Point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const OrderData = z.object({
  address: z.record(z.string(), z.unknown()).optional(),
  slot: Slot.optional(),
  flags: z.array(z.string()).optional(),
  notes: z.record(z.string(), z.unknown()).optional(),
});

const LoadData = z.object({
  vehicle: z.object({
    id: z.string(),
    type: z.string(),
    chilled: z.boolean(),
    capacityKg: z.number().nonnegative(),
    /** Total on the vehicle once this order is on board. */
    loadKg: z.number().nonnegative(),
    capacityM3: z.number().nonnegative().optional(),
    loadM3: z.number().nonnegative().optional(),
  }),
  requiredVehicleType: z.string().optional(),
  chilled: z.boolean().optional(),
});

const OnRouteData = z.object({
  distanceRemainingKm: z.number().nonnegative(),
  speedKph: z.number().nonnegative(),
  slot: Slot,
  /** Drops after this one, in route order. legKm is the distance from the previous drop. */
  laterDrops: z.array(z.object({ orderId: z.string(), legKm: z.number().nonnegative(), slotEnd: z.string() })).optional(),
});

const ProofData = z.object({
  address: Point,
  gps: Point.optional(),
  photo: z.string().optional(),
  note: z.string().optional(),
});

// A value of the wrong type keeps the default: a NaN threshold compares false and would switch its rule off.
function settings(context: WatchContext): WatchConfig {
  const given: Record<string, unknown> = { ...context?.config };
  const cfg: Record<string, unknown> = { ...DEFAULT_WATCH };
  for (const [key, fallback] of Object.entries(DEFAULT_WATCH)) {
    const value = given[key];
    const usable = Array.isArray(fallback) ? Array.isArray(value) && value.every((v) => typeof v === "string")
      : typeof fallback === "number" ? typeof value === "number" && Number.isFinite(value) && value >= 0
      : typeof value === "boolean";
    if (usable) cfg[key] = value;
  }
  return cfg as unknown as WatchConfig;
}

function ms(iso: string | undefined): number | null {
  // Date.parse alone reads "order 5" as a date.
  if (typeof iso !== "string" || !/^\s*\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function iso(t: number): string {
  return new Date(t).toISOString();
}

/** Ids come from the caller's feed; cut at the first space so an id cannot carry a sentence into a case. */
function label(id: unknown): string {
  return String(id ?? "").trim().match(/^[\w.:#-]{1,40}/)?.[0] ?? "unknown";
}

function problems(error: z.ZodError): string {
  return error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "data"}: ${i.message}`).join("; ");
}

function unable(check: CheckName, error: string): CheckResult {
  return { check, ok: false, reasons: [], opensCase: false, error };
}

function verdict(check: CheckName, event: OrderEvent, reasons: string[], extra: Partial<CheckResult> = {}): CheckResult {
  if (!reasons.length) return { check, ok: true, reasons, opensCase: false, ...extra };
  // An offset such as +01:00 does not survive label(), and a time cut short there is a different time.
  const at = ms(event.at);
  const when = label(event.at) === String(event.at).trim() ? label(event.at) : at === null ? "an unreadable time" : iso(at);
  const summary = `Order ${label(event.orderId)}: ${check.replace("_", "-")} check failed on "${label(event.kind)}" at ${when}: ${reasons.join("; ")}`;
  return { check, ok: false, reasons, opensCase: true, summary, ...extra };
}

function distanceM(a: z.infer<typeof Point>, b: z.infer<typeof Point>): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function orderCheck(event: OrderEvent, context: WatchContext = {}): CheckResult {
  const cfg = settings(context);
  const parsed = OrderData.safeParse(event.data);
  if (!parsed.success) return unable("order", `order data is malformed (${problems(parsed.error)})`);
  const now = ms(context?.now ?? event.at);
  if (now === null) return unable("order", "no valid time to check the slot against");
  const { address = {}, slot, flags = [], notes = {} } = parsed.data;
  const reasons: string[] = [];

  const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const missing = cfg.addressParts.filter((part) => !filled(address[part]));
  if (missing.length) reasons.push(`address is missing ${missing.join(", ")}`);

  const start = ms(slot?.start);
  const end = ms(slot?.end);
  if (start === null || end === null) {
    reasons.push("no readable delivery slot");
  } else {
    const width = (end - start) / MINUTE_MS;
    if (width < cfg.minSlotMinutes) reasons.push(`slot is ${Math.round(width)} minutes wide (minimum ${cfg.minSlotMinutes})`);
    // A new order needs a slot that has not opened; an address change mid-slot is still workable until the slot closes.
    if (event.kind === "placed" && start <= now) reasons.push(`slot starts at ${iso(start)}, which is not in the future`);
    if (event.kind !== "placed" && end <= now) reasons.push(`slot ended at ${iso(end)}`);
  }

  for (const flag of cfg.flagsNeedingNotes) {
    if (flags.includes(flag) && !filled(notes[flag])) reasons.push(`flagged ${flag} but has no ${flag} note`);
  }
  return verdict("order", event, reasons);
}

export function loadCheck(event: OrderEvent): CheckResult {
  const parsed = LoadData.safeParse(event.data);
  if (!parsed.success) return unable("load", `load data is malformed (${problems(parsed.error)})`);
  const { vehicle, requiredVehicleType, chilled = false } = parsed.data;
  const van = label(vehicle.id);
  const reasons: string[] = [];
  if (requiredVehicleType && requiredVehicleType !== vehicle.type) {
    reasons.push(`loaded on vehicle ${van} of type ${label(vehicle.type)}, order needs ${label(requiredVehicleType)}`);
  }
  if (vehicle.loadKg > vehicle.capacityKg) reasons.push(`vehicle ${van} carries ${vehicle.loadKg} kg against a capacity of ${vehicle.capacityKg} kg`);
  if (vehicle.capacityM3 !== undefined && vehicle.loadM3 !== undefined && vehicle.loadM3 > vehicle.capacityM3) {
    reasons.push(`vehicle ${van} carries ${vehicle.loadM3} m3 against a capacity of ${vehicle.capacityM3} m3`);
  }
  if (chilled && !vehicle.chilled) reasons.push(`chilled order loaded on vehicle ${van}, which is not chilled`);
  return verdict("load", event, reasons);
}

export function onRouteCheck(event: OrderEvent, context: WatchContext = {}): CheckResult {
  const cfg = settings(context);
  const parsed = OnRouteData.safeParse(event.data);
  if (!parsed.success) return unable("on_route", `on-route data is malformed (${problems(parsed.error)})`);
  const { distanceRemainingKm, speedKph, slot, laterDrops = [] } = parsed.data;
  const at = ms(event.at);
  const slotEnd = ms(slot.end);
  if (at === null || slotEnd === null) return unable("on_route", "event time or slot end is not a readable time");
  const needsTravel = distanceRemainingKm > 0 || laterDrops.some((d) => d.legKm > 0);
  const toleranceMs = cfg.lateToleranceMinutes * MINUTE_MS;
  // Rounded up to a tenth, so a reason never quotes a lateness equal to the tolerance it broke.
  const lateBy = (arrival: number, end: number) => Math.ceil((arrival - end) / (MINUTE_MS / 10)) / 10;
  if (needsTravel && speedKph <= 0) {
    // No speed means no ETA, but a drop not yet reached after its slot closed is late without one.
    if (distanceRemainingKm > 0 && at > slotEnd + toleranceMs) {
      return verdict("on_route", event, [`${distanceRemainingKm} km still to go with no speed reported, ${lateBy(at, slotEnd)} minutes past the slot end (tolerance ${cfg.lateToleranceMinutes})`]);
    }
    // A stationary ping gives no arrival time; guessing one would put a made-up ETA into a case.
    return unable("on_route", "cannot work out an ETA: speed is zero with distance remaining");
  }

  const travelMs = (km: number) => (km === 0 ? 0 : (km / speedKph) * 60 * MINUTE_MS);
  const reasons: string[] = [];
  const unchecked: string[] = [];
  const MAX_DATE_MS = 8.64e15;

  const eta = at + travelMs(distanceRemainingKm);
  if (!(eta <= MAX_DATE_MS)) return unable("on_route", "cannot work out an ETA: the arrival time is beyond any date at this speed");
  if (eta > slotEnd + toleranceMs) {
    reasons.push(`ETA ${iso(eta)} is ${lateBy(eta, slotEnd)} minutes past the slot end (tolerance ${cfg.lateToleranceMinutes})`);
  }

  let clock = eta;
  for (const drop of laterDrops) {
    clock += cfg.serviceMinutes * MINUTE_MS + travelMs(drop.legKm);
    if (!(clock <= MAX_DATE_MS)) return unable("on_route", `cannot work out an ETA for later drop ${label(drop.orderId)}: the arrival time is beyond any date at this speed`);
    const end = ms(drop.slotEnd);
    if (end === null) {
      unchecked.push(`later drop ${label(drop.orderId)} has no readable slot end`);
    } else if (clock > end + toleranceMs) {
      reasons.push(`later drop ${label(drop.orderId)} projected ${lateBy(clock, end)} minutes past its slot end`);
    }
  }
  return verdict("on_route", event, reasons, { eta: iso(eta), ...(unchecked.length ? { unchecked } : {}) });
}

export async function proofCheck(event: OrderEvent, context: WatchContext = {}): Promise<CheckResult> {
  const cfg = settings(context);
  const parsed = ProofData.safeParse(event.data);
  if (!parsed.success) return unable("proof", `proof data is malformed (${problems(parsed.error)})`);
  const { address, gps, photo, note } = parsed.data;
  const delivered = event.kind === "delivered";
  const reasons: string[] = [];
  const extra: Partial<CheckResult> = {};

  if (!gps) {
    reasons.push("no GPS fix recorded at proof");
  } else {
    const metres = Math.round(distanceM(gps, address));
    if (metres > cfg.maxProofDistanceM) reasons.push(`GPS at proof is ${metres} m from the address (limit ${cfg.maxProofDistanceM} m)`);
  }
  if (!photo?.trim() && (delivered || cfg.photoOnAttempt)) reasons.push("no photo recorded");

  const text = note?.trim() ?? "";
  if (!text && !delivered) reasons.push("no driver note explaining the failed attempt");
  const judge = context?.judge;
  if (text && judge) {
    let answer: NoteVerdict;
    try {
      answer = (await judge(text)) ?? { ok: false, error: "judge returned nothing" };
    } catch (err) {
      answer = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (answer.ok && answer.probability >= 0 && answer.probability <= 1) {
      extra.usage = answer.usage;
      const reads = answer.probability >= cfg.noteMatchAtLeast;
      const p = answer.probability.toFixed(2);
      if (delivered && !reads) reasons.push(`driver note does not read like a completed delivery (${p})`);
      if (!delivered && reads) reasons.push(`driver note reads like a completed delivery but the event is a failed attempt (${p})`);
    } else {
      extra.unchecked = [`driver note was not judged: ${answer.ok ? "judge returned no probability" : answer.error}`];
    }
  }
  return verdict("proof", event, reasons, extra);
}

export function aftercareCheck(event: OrderEvent, context: WatchContext = {}): CheckResult {
  const items = Array.isArray(context?.openItems) ? context.openItems : [];
  const open = items.filter((item) => item?.orderId === event.orderId);
  const reasons = open.map((item) => {
    const due = ms(item.due);
    return `open ${label(item.kind)} ${label(item.id)}${due === null ? "" : ` due ${iso(due)}`}`;
  });
  return verdict("aftercare", event, reasons);
}

const EventShape = z.object({
  orderId: z.string().min(1),
  kind: z.enum(EVENT_KINDS),
  at: z.string(),
  data: z.record(z.string(), z.unknown()),
});

async function runCheck(check: CheckName, event: OrderEvent, context: WatchContext): Promise<CheckResult> {
  try {
    if (check === "order") return orderCheck(event, context);
    if (check === "load") return loadCheck(event);
    if (check === "on_route") return onRouteCheck(event, context);
    if (check === "proof") return await proofCheck(event, context);
    return aftercareCheck(event, context);
  } catch (err) {
    return unable(check, `${check} check crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Routes one event to its checks and runs them. Never throws: a malformed event or a crashed check
 * comes back as ok=false with an error and no case, so a batch of events carries on.
 */
export async function watch(event: OrderEvent, context: WatchContext = {}): Promise<WatchResult> {
  const shape = EventShape.safeParse(event);
  if (!shape.success) return { ok: false, opensCase: false, error: `event is malformed (${problems(shape.error)})`, results: [] };
  if (ms(event.at) === null) return { ok: false, opensCase: false, error: "event time is not a readable time", results: [] };

  const results: CheckResult[] = [];
  for (const check of route(event)) results.push(await runCheck(check, event, context ?? {}));

  const failed = results.filter((r) => r.opensCase);
  const errors = results.filter((r) => r.error).map((r) => r.error);
  return {
    ok: results.every((r) => r.ok),
    opensCase: failed.length > 0,
    ...(failed.length ? { summary: failed.map((r) => r.summary).join(" | ") } : {}),
    ...(errors.length ? { error: errors.join("; ") } : {}),
    results,
  };
}

export interface JevJudgeOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Millisecond clock, for latency. */
  clock?: () => number;
}

/** A NoteJudge backed by one Jev yes/no question. Never throws; a failure is reported to the caller. */
export function jevNoteJudge(options: JevJudgeOptions = {}): NoteJudge {
  const { apiKey = process.env.TYPESAFE_API_KEY, fetchImpl = fetch, timeoutMs = 10_000, clock = Date.now } = options;
  return async (note) => {
    if (!apiKey) return { ok: false, error: "TYPESAFE_API_KEY is not set" };
    const started = clock();
    try {
      const res = await fetchImpl(JEV_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          state: { driver_note: note },
          model: JEV_MODEL,
          questions: {
            completed: {
              type: "noul",
              instructions: "Does the driver's note describe a delivery that was completed?",
              criteria: {
                true: "The goods were handed to a person or left at the delivery point as arranged",
                false: "The goods were not handed over or left: nobody answered, no access, refused, wrong address, or taken back",
              },
            },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return { ok: false, error: `Jev answered ${res.status}` };
      const body = await res.json() as { model?: unknown; answers?: Record<string, { noul?: unknown }>; usage?: { input_tokens?: unknown; output_tokens?: unknown } };
      const probability = body?.answers?.completed?.noul;
      if (typeof probability !== "number" || !(probability >= 0 && probability <= 1)) return { ok: false, error: "Jev reply had no usable answer" };
      const tokensIn = typeof body.usage?.input_tokens === "number" ? body.usage.input_tokens : 0;
      const tokensOut = typeof body.usage?.output_tokens === "number" ? body.usage.output_tokens : 0;
      const usage: ModelUsage = {
        model: typeof body.model === "string" ? body.model : JEV_MODEL,
        latencyMs: clock() - started,
        tokensIn,
        tokensOut,
        costUsd: tokensIn * JEV_USD_PER_INPUT_TOKEN,
      };
      return { ok: true, probability, usage };
    } catch (err) {
      return { ok: false, error: `Jev call failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  };
}
