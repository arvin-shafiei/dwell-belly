import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "orange" | "green" | "red" | "amber" | "blue" | "violet";

const TONE: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-white/70 ring-white/10",
  orange: "bg-rv-orange/12 text-rv-orange ring-rv-orange/30",
  green: "bg-rv-green/12 text-rv-green ring-rv-green/30",
  red: "bg-rv-red/12 text-rv-red ring-rv-red/30",
  amber: "bg-rv-amber/12 text-rv-amber ring-rv-amber/30",
  blue: "bg-rv-blue/12 text-rv-blue ring-rv-blue/30",
  violet: "bg-rv-violet/12 text-rv-violet ring-rv-violet/30",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-white/40",
  orange: "bg-rv-orange",
  green: "bg-rv-green",
  red: "bg-rv-red",
  amber: "bg-rv-amber",
  blue: "bg-rv-blue",
  violet: "bg-rv-violet",
};

export function Badge({
  tone = "neutral",
  dot,
  title,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded px-1.5 text-[11px] leading-none font-medium whitespace-nowrap ring-1 ring-inset",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", DOT[tone])} />}
      {children}
    </span>
  );
}

/** Small coloured dot (status lights). `pulse` for live/running. */
export function StatusDot({
  tone,
  pulse,
  size = 8,
  title,
}: {
  tone: Tone;
  pulse?: boolean;
  size?: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      role={title ? "img" : undefined}
      aria-label={title}
      className={cx("inline-block shrink-0 rounded-full", DOT[tone], pulse && "rv-pulse")}
      style={{ width: size, height: size, boxShadow: tone === "neutral" ? undefined : "0 0 0 3px rgba(255,255,255,0.04)" }}
    />
  );
}

/**
 * Mandatory label for anything with `simulated: true` (city/mock runs). PRD J0: simulated data
 * must never pass as real, so render this wherever such a record appears.
 */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      title="Simulated: not produced by the real agent. Not evidence."
      className={cx(
        "inline-flex h-5 shrink-0 items-center rounded border border-dashed border-rv-amber/70 bg-rv-amber/10 px-1.5 text-[10px] leading-none font-semibold tracking-[0.08em] text-rv-amber uppercase",
        className,
      )}
    >
      Simulated
    </span>
  );
}

/** Marks data read from real runner outputs (traces, ANSWER.md, eval results). */
export function RealBadge({ className, title }: { className?: string; title?: string }) {
  return (
    <span
      title={title ?? "Real data: read from runner outputs and eval results."}
      className={cx(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded bg-rv-green/10 px-1.5 text-[10px] leading-none font-semibold tracking-[0.08em] text-rv-green uppercase ring-1 ring-rv-green/30 ring-inset",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-rv-green" />
      Real
    </span>
  );
}

/** Real or simulated, chosen from a record's `simulated` flag. */
export function ProvenanceBadge({ simulated, className }: { simulated: boolean; className?: string }) {
  return simulated ? <SimulatedBadge className={className} /> : <RealBadge className={className} />;
}

/** Eval verdict: pass / fail / not evaluated. */
export function PassBadge({ pass, score }: { pass: boolean | null | undefined; score?: number | null }) {
  if (pass === null || pass === undefined)
    return <Badge tone="neutral" title="Not evaluated">n/a</Badge>;
  const s = typeof score === "number" ? ` ${score <= 1 ? Math.round(score * 100) : Math.round(score)}` : "";
  return (
    <Badge tone={pass ? "green" : "red"} dot>
      {pass ? "Pass" : "Fail"}
      {s && <span className="tabular opacity-70">{s}</span>}
    </Badge>
  );
}

export type ExecStatus = "running" | "success" | "error";

export const STATUS_TONE: Record<ExecStatus, Tone> = { running: "blue", success: "green", error: "red" };

/** Execution status pill (n8n-style: Running / Succeeded / Error). */
export function ExecStatusBadge({ status }: { status: ExecStatus }) {
  const label = status === "running" ? "Running" : status === "success" ? "Succeeded" : "Error";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-white/80">
      <StatusDot tone={STATUS_TONE[status]} pulse={status === "running"} />
      {label}
    </span>
  );
}

/** Safety gate verdict: allow / ask / block. */
export function GateBadge({ gate }: { gate: string | null | undefined }) {
  if (!gate) return <span className="text-white/30">—</span>;
  const tone: Tone = gate === "allow" ? "green" : gate === "ask" ? "amber" : gate === "block" ? "red" : "neutral";
  const label = gate === "allow" ? "Allowed" : gate === "ask" ? "Held" : gate === "block" ? "Blocked" : gate;
  return <Badge tone={tone}>{label}</Badge>;
}

/** Dataset chip with a stable colour per known dataset. */
export function DatasetBadge({ dataset }: { dataset: string }) {
  const tone: Tone =
    dataset === "public"
      ? "blue"
      : dataset === "generated"
        ? "violet"
        : dataset === "fixtures"
          ? "orange"
          : dataset === "grounded"
            ? "green"
            : dataset === "reality"
              ? "amber"
              : "neutral";
  return <Badge tone={tone}>{dataset}</Badge>;
}

/** Inline keyboard/code chip, e.g. <Kbd>npm run answer</Kbd>. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.92em] text-white/85 ring-1 ring-white/10 ring-inset">
      {children}
    </code>
  );
}
