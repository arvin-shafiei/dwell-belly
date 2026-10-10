"use client";
import Link from "next/link";
import { useReviewQueue } from "./useReviewQueue";

/** Drop this into the new workflow view; no dependency on the 3D world. */
export default function ReviewEntry({ onOpen }: { onOpen?: () => void }) {
  const { tasks } = useReviewQueue();
  const count = tasks.filter((t) => !t.simulated && t.status === "pending").length;
  const label = <>Human review{count > 0 && <span className="ml-2 rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-amber-200">{count}</span>}</>;
  const style = "inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 transition hover:border-[#ff6a1a]/50 hover:bg-[#ff6a1a]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6a1a]";
  return onOpen ? <button type="button" className={style} onClick={onOpen}>{label}</button> : <Link className={style} href="/review">{label}</Link>;
}
