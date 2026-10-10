// The case clock. Models get date arithmetic wrong often enough to matter (a deadline that is already
// past read as "tomorrow"), so every time comparison is done here and handed to the prompt as text.
// Nothing in this file invents a time: a deadline with no readable time stays "unknown".
import type { CaseBundle } from "./types.ts";

export interface Deadline {
  text: string;
  /** ISO 8601 in UTC, or null when no time could be read from the text. */
  at: string | null;
  /** Whole minutes from the case time to the deadline; negative when overdue. Null without both times. */
  minutesLeft: number | null;
  state: "overdue" | "due_soon" | "later" | "unknown";
}

const MINUTE = 60_000;
const DEFAULT_DUE_SOON_MINUTES = 240;
const MAX_QUOTED_CHARS = 120;

// Offsets in minutes east of UTC. Only abbreviations with one common meaning are listed.
const ZONES: Record<string, number> = {
  Z: 0, UTC: 0, GMT: 0, WET: 0, BST: 60, WEST: 60, CET: 60, CEST: 120, EET: 120, EEST: 180,
  EST: -300, EDT: -240, CDT: -300, MST: -420, MDT: -360, PST: -480, PDT: -420,
};
// These mean different offsets in different countries or seasons, or are zones this file does not
// convert, so a time carrying one is left unread instead of being taken as UTC.
const AMBIGUOUS_ZONES = new Set([
  "IST", "CST", "AST", "BT", "ET", "PT", "CT", "MT", "AEST", "AEDT", "ACST", "AWST", "NZST", "NZDT", "JST", "KST", "HKT",
  "SGT", "MSK", "HST", "AKST", "AKDT", "SAST",
]);
const MAX_INSTANT_MS = 8.64e15;
const MAX_RECORD_PREFIX_CHARS = 200;

const DATE_TIME = /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(T|,?[ \t]+(?:at[ \t]+)?)(\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?/gi;
const OFFSET = /^ ?([+-])(\d{2})(?::?(\d{2}))?(?![\d:])/;
const ZONE_SHIFT = /^([+-])(\d{1,2})(?::?(\d{2}))?(?![\d:])/;
const MERIDIEM = /^ ?([ap])(?:m|\.m\.)(?![A-Za-z])/i;
const WINDOW_END = /^\s?[–—-]\s?(\d{2}):(\d{2})(?![\d:])/;
const ZONE_WORD = /^\s{0,2}\(?([A-Za-z]{1,5})\b\)?/;

interface Found { ms: number; index: number; end: number }

function utcMs(y: number, mo: number, d: number, h: number, mi: number, s: number): number | null {
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // Date.UTC rolls 31 February into March; a round trip that changes the date means it never existed.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.getTime();
}

/** Zone that follows a time. offset is null when the zone is one we refuse to interpret. */
function readZone(tail: string, hyphenIsOffset: boolean): { offset: number | null; length: number } | undefined {
  const numeric = tail.match(OFFSET);
  if (numeric && (numeric[1] === "+" || hyphenIsOffset)) {
    const hours = Number(numeric[2]);
    const minutes = Number(numeric[3] ?? 0);
    if (hours > 14 || minutes > 59) return { offset: null, length: numeric[0].length };
    return { offset: (numeric[1] === "+" ? 1 : -1) * (hours * 60 + minutes), length: numeric[0].length };
  }
  const word = tail.match(ZONE_WORD);
  if (!word) return undefined;
  const name = /^(utc|gmt)$/i.test(word[1]) ? word[1].toUpperCase() : word[1];
  // "Z" only counts when it touches the time; a separate capital Z is just a letter.
  if (name === "Z" && word[0].length !== 1) return undefined;
  // "UTC+1" and "GMT-05:00" carry the offset after the word.
  const shift = name === "UTC" || name === "GMT" ? tail.slice(word[0].length).match(ZONE_SHIFT) : null;
  if (shift) {
    const hours = Number(shift[2]);
    const minutes = Number(shift[3] ?? 0);
    const length = word[0].length + shift[0].length;
    if (hours > 14 || minutes > 59) return { offset: null, length };
    return { offset: (shift[1] === "+" ? 1 : -1) * (hours * 60 + minutes), length };
  }
  if (name in ZONES) return { offset: ZONES[name], length: word[0].length };
  if (AMBIGUOUS_ZONES.has(name)) return { offset: null, length: word[0].length };
  return undefined;
}

/**
 * Every readable date-and-time in the text. A time with no zone is read as UTC, which is how the
 * case records are written. With useWindowEnd, "10:00–14:00" yields 14:00 (when the window closes).
 */
function findTimes(text: string, useWindowEnd: boolean): Found[] {
  const found: Found[] = [];
  for (const m of text.matchAll(DATE_TIME)) {
    const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[5], m[6], m[7] ?? "0"].map(Number);
    let end = m.index + m[0].length;
    let ms = utcMs(y, mo, d, h, mi, s);
    const meridiem = text.slice(end).match(MERIDIEM);
    if (meridiem) {
      end += meridiem[0].length;
      ms = h >= 1 && h <= 12 ? utcMs(y, mo, d, (h % 12) + (meridiem[1].toLowerCase() === "p" ? 12 : 0), mi, s) : null;
    }
    // "15:00-18:00" after a plain date is a slot, while "T15:00:00-08:00" is an offset.
    const hyphenIsOffset = m[4].toUpperCase() === "T" || m[7] !== undefined;
    let zone = readZone(text.slice(end), hyphenIsOffset);
    if (!zone) {
      const win = text.slice(end).match(WINDOW_END);
      if (win) {
        end += win[0].length;
        zone = readZone(text.slice(end), false);
        const close = utcMs(y, mo, d, Number(win[1]), Number(win[2]), 0);
        // A slot that closes before it opens runs past midnight.
        if (useWindowEnd && ms !== null) ms = close === null ? null : close < ms ? close + 24 * 60 * MINUTE : close;
      }
    }
    if (zone) end += zone.length;
    if (ms === null || (zone && zone.offset === null)) continue;
    found.push({ ms: ms - (zone?.offset ?? 0) * MINUTE, index: m.index, end });
  }
  return found;
}

const DECORATION = String.raw`[\s#>*|\[("'\`-]*`;
const RECORD_PREFIX = new RegExp(String.raw`^${DECORATION}(?:[A-Za-z][\w .]{0,24}?["']?\s*[:|]${DECORATION}){0,3}$`);
const FUTURE_LABEL = /deadline|due|until|before|\bby\b|expir|cut.?off|slot|window|eta\b|schedul|book|collect|deliver|appoint|return|plan|target|visit|resched|expect|estimat|promis/i;

/** True when the time heads a record (an event heading, a log line, a "timestamp" field), not a sentence. */
function isRecordStamp(text: string, index: number): boolean {
  // A record label is short; looking no further back keeps a huge single-line document linear.
  const from = Math.max(0, index - MAX_RECORD_PREFIX_CHARS);
  const before = text.slice(from, index);
  const lineStart = before.lastIndexOf("\n");
  if (lineStart === -1 && from > 0) return false;
  const prefix = before.slice(lineStart + 1);
  return RECORD_PREFIX.test(prefix) && !FUTURE_LABEL.test(prefix);
}

/**
 * The moment the desk must decide: the latest time found in the case documents, or null if none.
 * Cases also mention times that have not happened yet (booked slots, return dates), so times that
 * head a record win; times inside sentences are only used when the case has no record times at all.
 */
export function caseNow(bundle: CaseBundle): Date | null {
  let latestRecord: number | null = null;
  let latestAny: number | null = null;
  for (const doc of bundle?.documents ?? []) {
    if (typeof doc?.text !== "string") continue;
    for (const t of findTimes(doc.text, false)) {
      if (latestAny === null || t.ms > latestAny) latestAny = t.ms;
      if (isRecordStamp(doc.text, t.index) && (latestRecord === null || t.ms > latestRecord)) latestRecord = t.ms;
    }
  }
  const latest = latestRecord ?? latestAny;
  return latest === null ? null : new Date(latest);
}

const CUE = /\b(by|due|before|until|till|deadline|expir\w*|no later than|cut-?off|closes?)\b[^.;\n]{0,24}$/i;
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const RELATIVE = new RegExp(
  String.raw`\b(?:within|in)\s+(?:the\s+)?(?:next\s+)?(\d+(?:\.\d+)?|${Object.keys(NUMBER_WORDS).join("|")})\s*(working\s+|business\s+)?` +
  String.raw`(minutes?|mins?|hours?|hrs?|days?)\b`, "i");
const CLOCK = String.raw`(\d{1,2}):(\d{2})`;
const TIME_THEN_DAY = new RegExp(String.raw`(?<![\d:])${CLOCK}(?![\d:])([^.;\n]{0,12}?)\b(today|tomorrow)\b`, "i");
const DAY_THEN_TIME = new RegExp(String.raw`\b(today|tomorrow)\b(?:\s+(?:at|by|before))?\s+${CLOCK}(?![\d:])`, "i");

/** One absolute time from the text, or null when there is none or the text does not say which one applies. */
function absoluteTime(text: string): number | null {
  const times = findTimes(text, true);
  const distinct = new Set(times.map((t) => t.ms));
  if (distinct.size === 1) return times[0].ms;
  if (distinct.size === 0) return null;
  // Several times: only one introduced as a deadline can be trusted, and the earliest is the one that bites first.
  // The cue must sit between the previous time and this one, or it belongs to the previous time.
  const cued = times.filter((t, i) => CUE.test(text.slice(i ? times[i - 1].end : 0, t.index))).map((t) => t.ms);
  return cued.length ? Math.min(...cued) : null;
}

/** "16:00 UTC today" and "tomorrow by 09:30", resolved on the case date. */
function dayTime(text: string, now: Date): number | null {
  const a = text.match(TIME_THEN_DAY);
  const b = a ? null : text.match(DAY_THEN_TIME);
  if (!a && !b) return null;
  const [hour, minute, day] = a ? [a[1], a[2], a[4]] : [b![2], b![3], b![1]];
  const tail = a ? a[3] : text.slice(b!.index! + b![0].length);
  const zone = readZone(tail, false);
  if (zone && zone.offset === null) return null;
  const base = utcMs(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), Number(hour), Number(minute), 0);
  if (base === null) return null;
  return base - (zone?.offset ?? 0) * MINUTE + (day.toLowerCase() === "tomorrow" ? 24 * 60 * MINUTE : 0);
}

function relativeTime(text: string, now: Date): number | null {
  const m = text.match(RELATIVE);
  // Working days depend on a calendar the case does not give us.
  if (!m || m[2]) return null;
  const amount = NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1]);
  const unit = m[3].toLowerCase();
  const minutes = unit.startsWith("d") ? 1440 : unit.startsWith("h") ? 60 : 1;
  // "in 2 hours 30 minutes": the second part counts too.
  const more = text.slice(m.index! + m[0].length).match(/^,?\s*(?:and\s+)?(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/i);
  const extra = more ? Number(more[1]) * (more[2].toLowerCase().startsWith("h") ? 60 : 1) : 0;
  return now.getTime() + Math.round(amount * minutes + extra) * MINUTE;
}

/**
 * Reads each deadline string. An absolute time in the text wins; otherwise "today/tomorrow at HH:MM"
 * and "within/in N minutes, hours or days" are resolved against now. Without now, absolute times are
 * still returned but nothing is counted down.
 */
export function deadlines(texts: string[], now: Date | null, dueSoonMinutes: number = DEFAULT_DUE_SOON_MINUTES): Deadline[] {
  const nowOk = now instanceof Date && !Number.isNaN(now.getTime()) ? now : null;
  return (Array.isArray(texts) ? texts : []).map((raw) => {
    const text = typeof raw === "string" ? raw : "";
    const ms = absoluteTime(text) ?? (nowOk ? dayTime(text, nowOk) ?? relativeTime(text, nowOk) : null);
    if (ms === null || !Number.isFinite(ms) || Math.abs(ms) > MAX_INSTANT_MS) return { text, at: null, minutesLeft: null, state: "unknown" as const };
    const at = new Date(ms).toISOString();
    if (!nowOk) return { text, at, minutesLeft: null, state: "unknown" as const };
    const left = ms - nowOk.getTime();
    const minutesLeft = Math.floor(left / MINUTE);
    const state = left < 0 ? "overdue" as const : minutesLeft <= dueSoonMinutes ? "due_soon" as const : "later" as const;
    return { text, at, minutesLeft, state };
  });
}

function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function span(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, "0")} min`;
}

// The deadline text came from a model reading the case, so it is trimmed and flattened before it goes back into a prompt.
function quote(text: string): string {
  const flat = text.replace(/\s+/g, " ").replace(/"/g, "'").trim();
  return `"${flat.length > MAX_QUOTED_CHARS ? `${flat.slice(0, MAX_QUOTED_CHARS)}...` : flat}"`;
}

/** Plain-text block for a prompt: the case time and every deadline with the time left, worked out in code. */
export function clockBrief(now: Date | null, list: Deadline[]): string {
  const nowOk = now instanceof Date && !Number.isNaN(now.getTime()) ? now : null;
  const lines = [nowOk
    ? `Case time now: ${stamp(nowOk)} (the latest record in the case). The times below were calculated in code; use them as given.`
    : "Case time now: could not be read from the case. Do not state how much time is left on anything."];
  const items = Array.isArray(list) ? list : [];
  if (!items.length) lines.push("Deadlines: none listed.");
  else lines.push("Deadlines:");
  for (const item of items) {
    const d = { ...item, text: typeof item?.text === "string" ? item.text : "" };
    const at = typeof d.at === "string" ? new Date(d.at) : null;
    if (!at || Number.isNaN(at.getTime())) lines.push(`- ${quote(d.text)}: no deadline could be read`);
    else if (typeof d.minutesLeft !== "number" || !Number.isFinite(d.minutesLeft)) lines.push(`- ${quote(d.text)}: ${stamp(at)}, time remaining not calculated`);
    else if (d.state === "overdue") lines.push(`- ${quote(d.text)}: ${stamp(at)}, overdue by ${span(d.minutesLeft)}`);
    else lines.push(`- ${quote(d.text)}: ${stamp(at)}, ${span(d.minutesLeft)} left${d.state === "due_soon" ? " (due soon)" : ""}`);
  }
  return lines.join("\n");
}
