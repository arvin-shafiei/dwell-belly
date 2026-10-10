// Helpers that keep a large batch inside its time and rate limits: the deadline, the stand-in
// models used once time is up, a throttle on in-flight model calls, and the progress line.
// Pure and key-free, so they are unit tested; cli.ts and reality.ts wire them in.
import type { Models } from "./models.ts";

/** Cases waiting this close to the deadline are not started: they could not finish in time. */
export const SOFT_STOP_MS = 75_000;

/**
 * "16:54" (today, local time) or an ISO timestamp, as epoch ms. Unset or empty means no deadline
 * (Infinity). Anything else throws, so a typo cannot silently run without a deadline.
 */
export function parseDeadline(s: string | undefined, now: Date = new Date()): number {
  if (!s || !s.trim()) return Infinity;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (hm) {
    const h = Number(hm[1]), m = Number(hm[2]);
    if (h > 23 || m > 59) throw new Error(`--deadline must be HH:MM or an ISO time, not "${s}"`);
    const d = new Date(now); d.setHours(h, m, 0, 0); return d.getTime();
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`--deadline must be HH:MM or an ISO time, not "${s}"`);
  return t;
}

export const OUT_OF_TIME = "Time ran out before this case could be analysed. No action was taken.";
export const OUT_OF_BUDGET = "The run's spending limit was reached before this case could be analysed. No action was taken.";

/** Models whose every call fails at once with `reason`: the case is handed to a person and costs nothing. */
export function refusing(reason: string): Models {
  return { async structured() { throw new Error(reason); } };
}

/** Used once time is up. */
export const outOfTime: Models = refusing(OUT_OF_TIME);
export const outOfBudget: Models = refusing(OUT_OF_BUDGET);

/** "18", "18.5"; "none" or "off" means no cap. Unset uses the fallback. */
export function parseBudget(s: string | undefined, fallback: number): number {
  if (s === undefined || !s.trim()) return fallback;
  if (/^(none|off|unlimited)$/i.test(s.trim())) return Infinity;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--budget-usd must be a number of dollars or "none", not "${s}"`);
  return n;
}

/**
 * Spend guard shared by every worker. Real spend comes from each model response's usage (`add`).
 * A case may start only if what is spent so far plus every running case (this one included) at the
 * average cost of a finished case stays within the limit. Before any case has finished, `estimateUsd`
 * stands in for the average.
 */
export class Budget {
  spent = 0;
  running = 0;
  private finished = 0;
  private finishedCost = 0;
  /** Set the first time a case is refused for money, for the run log. */
  reachedAt: Date | null = null;
  readonly limitUsd: number;
  private readonly estimateUsd: number;
  constructor(limitUsd: number, estimateUsd = 0.08) { this.limitUsd = limitUsd; this.estimateUsd = estimateUsd; }
  get averageUsd(): number { return this.finished ? Math.max(this.finishedCost / this.finished, 0.001) : this.estimateUsd; }
  /** Called with each model call's cost as it lands. */
  add(usd: number) { if (Number.isFinite(usd) && usd > 0) this.spent += usd; }
  /** True and counts the case as running, or false (and notes the cap was reached). */
  tryStart(): boolean {
    if (this.spent + (this.running + 1) * this.averageUsd > this.limitUsd) { this.reachedAt ??= new Date(); return false; }
    this.running++;
    return true;
  }
  /** A started case ended; `caseCostUsd` is its run_end total. */
  finish(caseCostUsd: number) {
    this.running = Math.max(0, this.running - 1);
    if (Number.isFinite(caseCostUsd) && caseCostUsd > 0) { this.finished++; this.finishedCost += caseCostUsd; }
  }
}

/** Wraps models so every successful call's cost is added to the budget as it lands. */
export function metered(inner: Models, budget: Budget): Models {
  return {
    async structured(call) {
      const res = await inner.structured(call);
      budget.add(res.usage.costUsd);
      return res;
    },
  };
}

/** Whole-case limit for a case starting now: the usual limit, cut short so it ends at the deadline. */
export function caseTimeout(deadline: number, now: number = Date.now(), usual = 300_000): number {
  return Math.max(5_000, Math.min(usual, deadline - now));
}

/** 429 (rate limited) and 529 (overloaded) mean "slow down", not "this case is bad". */
export function isBusy(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 429 || status === 529;
}

export interface ThrottleOptions {
  /** In-flight calls allowed at the start; low, to stay clear of acceleration limits. Default 16. */
  start?: number;
  /** Ceiling the limit can grow to. */
  max: number;
  /** The limit never drops below this. Default 4. */
  floor?: number;
  /** Added to the limit after each successful call. Default 0.5. */
  step?: number;
  /** Multiplier on 429/529. Default 0.7 (a 30% cut). */
  cut?: number;
  onBusy?: (limit: number, status: unknown) => void;
}

export type Throttled = Models & { readonly limit: number; readonly active: number; readonly waiting: number };

/** Caps in-flight model calls: starts low, grows on success, cuts by 30% on 429/529 (AIMD). */
export function throttled(inner: Models, o: ThrottleOptions): Throttled {
  const max = Math.max(1, o.max);
  const floor = Math.min(o.floor ?? 4, max);
  const step = o.step ?? 0.5;
  const cut = o.cut ?? 0.7;
  let limit = Math.max(floor, Math.min(o.start ?? 16, max));
  let active = 0;
  const queue: { go: () => void }[] = [];
  const pump = () => {
    while (active < Math.floor(limit) && queue.length) { active++; queue.shift()!.go(); }
  };
  return {
    get limit() { return Math.floor(limit); },
    get active() { return active; },
    get waiting() { return queue.length; },
    async structured(call) {
      const signal = call.signal;
      if (signal?.aborted) throw signal.reason ?? new Error("aborted");
      // Wait for a slot. A case cut off while waiting leaves the queue without taking a slot.
      await new Promise<void>((resolve, reject) => {
        const entry = { go: () => { signal?.removeEventListener("abort", onAbort); resolve(); } };
        const onAbort = () => {
          const i = queue.indexOf(entry);
          if (i >= 0) queue.splice(i, 1);
          reject(signal?.reason ?? new Error("aborted"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        queue.push(entry);
        pump();
      });
      try {
        const res = await inner.structured(call);
        limit = Math.min(max, limit + step);
        return res;
      } catch (err) {
        if (isBusy(err)) {
          limit = Math.max(floor, limit * cut);
          o.onBusy?.(Math.floor(limit), (err as { status?: unknown }).status);
        }
        throw err;
      } finally {
        active--;
        pump();
      }
    },
  };
}

/** One line for the operator: how far along, how fast, and when it should finish. */
export function progressLine(done: number, total: number, startedMs: number, nowMs: number = Date.now(), extra = ""): string {
  const minutes = Math.max((nowMs - startedMs) / 60_000, 1 / 60);
  const rate = done / minutes;
  const left = total - done;
  const eta = rate > 0 ? Math.ceil(left / rate) : Infinity;
  const at = Number.isFinite(eta) ? new Date(nowMs + eta * 60_000).toTimeString().slice(0, 5) : "?";
  const pct = total ? Math.floor((100 * done) / total) : 100;
  return `-- ${done}/${total} done (${pct}%), ${rate.toFixed(0)}/min, ETA ${Number.isFinite(eta) ? `${eta} min (${at})` : "unknown"}${extra ? `, ${extra}` : ""}`;
}
