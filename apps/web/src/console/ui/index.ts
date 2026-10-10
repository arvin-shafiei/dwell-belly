/**
 * Rivet console UI kit. Import everything from "@/console/ui" (or "../ui" inside console/).
 * Look (docs/plans/ui-simplify-brief.md): flat and calm, one dark theme, system font, no
 * gradients/glows/sparkles. Canvas #1f1f23 (bg-rv-canvas), cards #2a2a30 (bg-rv-card), panels
 * (bg-rv-panel). Rivet orange #ff6a1a (bg-rv-orange) used sparingly, mainly the ONE primary
 * button per page. Status colours: rv-green, rv-red, rv-amber, rv-blue, rv-violet.
 * Utility classes: `rv-dotgrid` (dotted canvas), `tabular` (tabular numerals), `rv-skeleton`, `rv-pulse`.
 *
 * Words people read come from the shared glossary "@/ui/plain" (plainNode, plainOutcome,
 * plainGate, riskWord, cents, plainCaseType, plainDataset, plainStatus). Never show raw node
 * types, model names, config keys or JSON on main screens.
 *
 * Layout / navigation (provided by console/Shell.tsx)
 *   useConsole()  -> { tab, params, navigate(tab, params?), setParams(patch), workflowId, workflowName, headerSlot }
 *   <HeaderActions>  portal your page's ONE primary button into the header
 *   TAB_IDS, TAB_TITLES (Home, Playbooks, Case runs, Results, City), isTabId, type TabId
 *
 * Buttons
 *   <Button variant="primary|secondary|ghost|danger" size="sm|md" icon loading>
 *   <IconButton label active>       square icon-only button with tooltip
 *   <ExecuteButton onExecuted?>     primary "Run a case" + case picker; POSTs /api/console/execute,
 *                                   then opens Case runs (?tab=executions&id=...). stripCaseNo(title)
 *
 * Badges (honesty rule: anything with `simulated: true` MUST show <SimulatedBadge/>)
 *   <SimulatedBadge/> "Practice case"   <RealBadge/> "Live"   <ProvenanceBadge simulated/>
 *   <Badge tone="neutral|orange|green|red|amber|blue|violet" dot>   generic chip
 *   <StatusDot tone pulse/>  <ExecStatusBadge status/> (Working on it / Finished / Didn't finish)
 *   <PassBadge pass score/>  <GateBadge gate/> (OK / Ask a person / Stop)  <DatasetBadge dataset/>
 *   <Code>  inline code chip (Advanced views only)
 *
 * Containers:  <Panel title subtitle actions flush>  <PanelHeader/>  <KpiCard/>  <Meter ratio tone/>
 * Tables:      <Table> + <Th align> + <Tr onClick selected> + <Td align mono muted>  (sticky header)
 * Feedback:    <EmptyState icon title action compact>  <NoRunsYet/> ("No cases yet")
 *              <ErrorState error onRetry/>  <Spinner/>  <Skeleton className/>
 *
 * Icons (inline SVG, size + currentColor)
 *   IconOverview IconWorkflow IconExecutions IconEvidence IconCity IconPlay IconRefresh
 *   IconImport IconExternal IconChevronLeft/Right/Down IconCheck IconX IconAlert IconCoin
 *   IconClock IconCases IconTarget IconShield IconInbox IconSearch IconSidebar RivetMark
 *
 * Formatting + maths (pure, tested in format.test.ts)
 *   formatUsd formatDuration formatPct formatCount formatRelative formatTimestamp humanize DASH
 *   computeKpis(rows, recordedCriticalFailures?) -> Kpis (excludes simulated datasets;
 *   outcomes = tested cases per outcome)   cx(...classes)
 *
 * Data hooks live in console/useApi.ts (useStatus, useEvidence, useExecutions, useExecution,
 * useWorkflows, useCases, consoleApi.execute/importRuns/saveWorkflow, useAction, getJson).
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
