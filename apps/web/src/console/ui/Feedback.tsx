import type { ReactNode } from "react";
import { cx } from "./cx";
import { Code } from "./Badge";
import { IconAlert, IconInbox } from "./icons";

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cx("animate-spin", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Shimmer placeholder block. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx("rv-skeleton", className)} style={style} aria-hidden="true" />;
}

/** Centered empty state. Pass `action` for a button, `children` for extra copy. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  compact,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 ring-1 ring-white/[0.06]">
        {icon ?? <IconInbox size={20} />}
      </div>
      <div className="text-sm font-medium text-white/85">{title}</div>
      {children && <div className="max-w-sm text-[13px] leading-relaxed text-white/50">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** The standard "nothing has run yet" message, used across tabs so the wording is identical. */
export function NoRunsYet({ action, compact }: { action?: ReactNode; compact?: boolean }) {
  return (
    <EmptyState title="No runs yet" action={action} compact={compact}>
      No runs yet. Run <Code>npm run answer</Code> or press <span className="font-medium text-white/80">Execute</span>.
    </EmptyState>
  );
}

/** Inline error box with optional retry. */
export function ErrorState({
  title = "Couldn't load data",
  error,
  onRetry,
  compact,
}: {
  title?: string;
  error: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cx(
        "flex items-start gap-3 rounded-md border border-rv-red/25 bg-rv-red/[0.07] text-[13px]",
        compact ? "m-3 p-3" : "m-4 p-4",
      )}
    >
      <IconAlert size={16} className="mt-0.5 shrink-0 text-rv-red" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-white/90">{title}</div>
        <div className="mt-0.5 break-words text-white/55">{error}</div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 text-xs font-medium text-rv-orange hover:underline">
          Retry
        </button>
      )}
    </div>
  );
}
