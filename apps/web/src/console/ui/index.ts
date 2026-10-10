/**
 * Rivet console UI kit. Import everything from "@/console/ui" (or "../ui" inside console/).
 * Dark n8n-like look: canvas #1f1f23 (bg-rv-canvas), cards #2a2a30 (bg-rv-card), panels
 * (bg-rv-panel), accent Rivet orange #ff6a1a (bg-rv-orange / text-rv-orange), plus rv-green,
 * rv-red, rv-amber, rv-blue, rv-violet. Utility classes: `rv-dotgrid` (dotted canvas
 * background), `tabular` (tabular numerals), `rv-skeleton`, `rv-pulse`.
 *
 * Layout / navigation (provided by console/Shell.tsx)
 *   useConsole()                 -> { tab, params, navigate(tab, params?), setParams(patch),
 *                                     workflowId, workflowName, headerSlot }
 *   <HeaderActions>              -> portal your tab's buttons into the header (the Execute slot)
 *   TAB_IDS, TAB_TITLES, isTabId, type TabId
 *
 * Buttons
 *   <Button variant="primary|secondary|ghost|danger" size="sm|md" icon={...} loading>
 *   <IconButton label="..." active>   square icon-only button with tooltip
 *   <ExecuteButton onExecuted?>       primary "Execute workflow" + case picker; POSTs
 *                                     /api/console/execute, then opens Executions?id=...
 *
 * Badges (data provenance rule, PRD J0: anything with `simulated: true` MUST show <SimulatedBadge/>)
 *   <SimulatedBadge/>  <RealBadge/>  <ProvenanceBadge simulated={rec.simulated}/>
 *   <Badge tone="neutral|orange|green|red|amber|blue|violet" dot>   generic chip
 *   <StatusDot tone pulse/>  <ExecStatusBadge status/>  <PassBadge pass score/>
 *   <GateBadge gate="allow|ask|block"/>  <DatasetBadge dataset/>  <Code>npm run answer</Code>
 *
 * Containers
 *   <Panel title subtitle actions flush>  card with header
 *   <PanelHeader/>  <KpiCard label value sub icon tone loading/>  <Meter ratio tone/>
 *
 * Tables
 *   <Table> + <Th align> + <Tr onClick selected> + <Td align mono muted>  (sticky header)
 *
 * Feedback
 *   <EmptyState icon title action compact>  <NoRunsYet action/> (standard "No runs yet" copy)
 *   <ErrorState error onRetry/>  <Spinner/>  <Skeleton className/>
 *
 * Icons (inline SVG, size + currentColor)
 *   IconOverview IconWorkflow IconExecutions IconEvidence IconCity IconPlay IconRefresh
 *   IconImport IconExternal IconChevronLeft/Right/Down IconCheck IconX IconAlert IconCoin
 *   IconClock IconCases IconTarget IconShield IconInbox IconSearch IconSidebar RivetMark
 *
 * Formatting + maths (pure, tested in format.test.ts)
 *   formatUsd formatDuration formatPct formatCount formatRelative formatTimestamp humanize DASH
 *   computeKpis(rows, recordedCriticalFailures?) -> Kpis (excludes simulated datasets)
 *   cx(...classes)
 *
 * Data hooks live in console/useApi.ts (useStatus, useEvidence, useExecutions, useExecution,
 * useWorkflows, useCases, consoleApi.execute/importRuns/saveWorkflow, useAction).
 */
export * from "./Badge";
export * from "./Button";
export * from "./context";
export * from "./cx";
export * from "./ExecuteButton";
export * from "./Feedback";
export * from "./format";
export * from "./icons";
export * from "./kpis";
export * from "./Panel";
export * from "./Table";
