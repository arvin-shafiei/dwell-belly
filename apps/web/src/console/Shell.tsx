"use client";
// The console app shell: n8n-style slim left sidebar, header bar with the Execute slot, and
// `?tab=` routing. Must render inside <Suspense> (uses useSearchParams; Next 16 rule).
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore, type ComponentType } from "react";
import { useStatus, useWorkflows } from "./useApi";
import {
  ConsoleContext,
  IconChevronLeft,
  IconChevronRight,
  IconCity,
  IconEvidence,
  IconExecutions,
  IconExternal,
  IconOverview,
  IconWorkflow,
  RivetMark,
  StatusDot,
  TAB_IDS,
  TAB_TITLES,
  cx,
  isTabId,
  type ConsoleContextValue,
  type IconProps,
  type ParamPatch,
  type TabId,
} from "./ui";
import OverviewTab from "./tabs/Overview";
import WorkflowsTab from "./tabs/Workflows";
import ExecutionsTab from "./tabs/Executions";
import EvidenceTab from "./tabs/Evidence";
import CityTab from "./tabs/City";

const TAB_COMPONENT: Record<TabId, ComponentType> = {
  overview: OverviewTab,
  workflows: WorkflowsTab,
  executions: ExecutionsTab,
  evidence: EvidenceTab,
  city: CityTab,
};

const TAB_ICON: Record<TabId, ComponentType<IconProps>> = {
  overview: IconOverview,
  workflows: IconWorkflow,
  executions: IconExecutions,
  evidence: IconEvidence,
  city: IconCity,
};

/** Params that survive a tab switch. */
const STICKY_PARAMS = ["workflow"];

// Sidebar collapsed state, persisted per browser (convenience only).
const COLLAPSE_KEY = "rivet.console.sidebarCollapsed";
const collapseListeners = new Set<() => void>();
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable: state still flips for this session via listeners */
  }
  memCollapsed = v;
  collapseListeners.forEach((l) => l());
}
let memCollapsed: boolean | null = null;
function useCollapsed(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(
    (cb) => {
      collapseListeners.add(cb);
      return () => collapseListeners.delete(cb);
    },
    () => memCollapsed ?? readCollapsed(),
    () => false,
  );
  return [v, writeCollapsed];
}

export default function Shell() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const rawTab = search.get("tab");
  const tab: TabId = isTabId(rawTab) ? rawTab : "overview";
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useCollapsed();

  const workflows = useWorkflows({ pollMs: 30_000 });
  const wfParam = search.get("workflow");
  const wf = useMemo(() => {
    const list = workflows.data?.workflows ?? [];
    return list.find((w) => w.id === wfParam) ?? list.find((w) => w.active) ?? list[0] ?? null;
  }, [workflows.data, wfParam]);

  const hrefFor = useCallback(
    (next: TabId, params?: ParamPatch, keepCurrent = false) => {
      const sp = new URLSearchParams();
      if (keepCurrent) search.forEach((v, k) => sp.set(k, v));
      else for (const k of STICKY_PARAMS) {
        const v = search.get(k);
        if (v) sp.set(k, v);
      }
      if (next === "overview") sp.delete("tab");
      else sp.set("tab", next);
      for (const [k, v] of Object.entries(params ?? {})) {
        if (v === null || v === undefined || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, search],
  );

  const ctx = useMemo<ConsoleContextValue>(
    () => ({
      tab,
      params: new URLSearchParams(search.toString()),
      navigate: (next, params) => router.push(hrefFor(next, params), { scroll: false }),
      setParams: (patch) => router.replace(hrefFor(tab, patch, true), { scroll: false }),
      workflowId: wf?.id ?? null,
      workflowName: wf?.name ?? null,
      headerSlot,
    }),
    [tab, search, router, hrefFor, wf, headerSlot],
  );

  const Active = TAB_COMPONENT[tab];

  return (
    <ConsoleContext.Provider value={ctx}>
      <div className="console-root flex h-dvh min-h-0 w-full overflow-hidden">
        <Sidebar tab={tab} hrefFor={hrefFor} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-rv-canvas px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
              <h1 className="shrink-0 text-[15px] font-semibold text-white">{TAB_TITLES[tab]}</h1>
              <span className="shrink-0 text-white/20" aria-hidden="true">
                /
              </span>
              <WorkflowLabel
                name={wf?.name ?? null}
                active={wf?.active ?? false}
                loading={workflows.loading}
                unavailable={!!workflows.error && !workflows.data}
                href={hrefFor("workflows")}
              />
            </div>
            {/* Execute slot: tabs portal their primary actions here via <HeaderActions>. */}
            <div ref={setHeaderSlot} className="flex shrink-0 items-center gap-2" />
          </header>
          <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-rv-canvas">
            <Active key={tab} />
          </main>
        </div>
      </div>
    </ConsoleContext.Provider>
  );
}

function WorkflowLabel({
  name,
  active,
  loading,
  unavailable,
  href,
}: {
  name: string | null;
  active: boolean;
  loading: boolean;
  unavailable: boolean;
  href: string;
}) {
  if (loading) return <span className="text-white/35">Loading workflow…</span>;
  if (!name)
    return <span className="truncate text-white/40">{unavailable ? "Workflows unavailable" : "No workflow"}</span>;
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 rounded px-1.5 py-0.5 text-white/75 hover:bg-white/[0.05] hover:text-white"
      title="Open in Workflows"
    >
      <IconWorkflow size={14} className="shrink-0 text-rv-orange" />
      <span className="truncate">{name}</span>
      {active && (
        <span className="shrink-0 rounded bg-rv-green/12 px-1.5 py-px text-[10px] font-semibold tracking-wide text-rv-green uppercase">
          Active
        </span>
      )}
    </Link>
  );
}

function Sidebar({
  tab,
  hrefFor,
  collapsed,
  onToggle,
}: {
  tab: TabId;
  hrefFor: (t: TabId) => string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const status = useStatus({ pollMs: 5000 });
  const up = status.data?.agentApi === true;
  const known = status.data !== undefined;
  const consoleDown = !!status.error && !known;
  const tone = status.loading ? "neutral" : consoleDown ? "red" : up ? "green" : "red";
  const statusText = status.loading
    ? "Checking agent API…"
    : consoleDown
      ? "Console API unavailable"
      : up
        ? "Agent API online"
        : "Agent API offline";
  const statusTitle = [
    statusText,
    status.data?.agentUrl,
    status.error && known ? `Last check failed: ${status.error}` : status.error,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <nav
      aria-label="Console"
      className={cx(
        "flex shrink-0 flex-col border-r border-white/[0.07] bg-rv-sidebar transition-[width] duration-150",
        collapsed ? "w-[60px]" : "w-[196px]",
      )}
    >
      <div className={cx("flex h-[52px] shrink-0 items-center gap-2.5", collapsed ? "justify-center" : "px-3.5")}>
        <RivetMark size={26} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-[14px] font-semibold tracking-tight text-white">Rivet</div>
            <div className="text-[10.5px] text-white/40">Desk console</div>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-0.5 px-2 pt-2">
        {TAB_IDS.map((id) => {
          const Icon = TAB_ICON[id];
          const on = id === tab;
          return (
            <li key={id}>
              <Link
                href={hrefFor(id)}
                scroll={false}
                aria-current={on ? "page" : undefined}
                title={collapsed ? TAB_TITLES[id] : undefined}
                className={cx(
                  "relative flex h-9 items-center gap-3 rounded-md text-[13px] transition-colors",
                  collapsed ? "justify-center" : "px-2.5",
                  on ? "bg-rv-orange/[0.12] font-medium text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {on && <span className="absolute top-2 bottom-2 -left-2 w-[3px] rounded-r bg-rv-orange" />}
                <Icon size={18} className={on ? "text-rv-orange" : undefined} />
                {!collapsed && <span className="truncate">{TAB_TITLES[id]}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-1 border-t border-white/[0.06] px-2 py-2">
        <a
          href="/city"
          target="_blank"
          rel="noopener"
          title="Open 3D city ↗"
          aria-label="Open 3D city ↗"
          className={cx(
            "flex h-9 items-center gap-3 rounded-md text-[13px] text-white/60 hover:bg-white/[0.05] hover:text-white",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          {collapsed ? <IconExternal size={17} /> : <IconCity size={18} />}
          {!collapsed && <span className="truncate">Open 3D city ↗</span>}
        </a>
        <div
          title={statusTitle}
          role="status"
          aria-label={statusText}
          className={cx(
            "flex h-9 items-center gap-3 rounded-md text-[12px] text-white/55",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          <span className="flex w-[18px] justify-center">
            <StatusDot tone={tone} pulse={status.loading} />
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate">{statusText}</span>
              {status.data?.agentUrl && (
                <span className="block truncate font-mono text-[10.5px] text-white/30">
                  {status.data.agentUrl.replace(/^https?:\/\//, "")}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cx(
            "flex h-8 items-center gap-3 rounded-md text-[12px] text-white/40 hover:bg-white/[0.05] hover:text-white/80",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
