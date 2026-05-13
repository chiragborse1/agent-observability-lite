"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Clock3,
  Database,
  DollarSign,
  Gauge,
  ListFilter,
  Radar,
  Search,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import {
  type AgentRun,
  type AlertSeverity,
  type DashboardSnapshot,
  type RunStatus,
  type RunsPage,
  type StepKind,
  type StepStatus,
} from "@/lib/observability-data";
import {
  buildRunQueryString,
  runPageSizeOptions,
  type RunListFilters,
} from "@/lib/run-filters";

type StatusFilter = RunStatus | "all";

type DashboardShellProps = {
  initialRuns: AgentRun[];
  pagination: RunsPage["pagination"];
  snapshot: DashboardSnapshot;
  filters: RunListFilters;
  filterOptions: {
    workflows: string[];
    environments: AgentRun["environment"][];
  };
};

const statusStyles: Record<RunStatus, string> = {
  healthy: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20",
  degraded: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20",
  failed: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20",
  running: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/20",
};

const stepStyles: Record<StepStatus, string> = {
  completed: "border-zinc-800 bg-zinc-950",
  warning: "border-amber-500/20 bg-amber-500/5",
  failed: "border-rose-500/20 bg-rose-500/5",
  running: "border-sky-500/20 bg-sky-500/5",
};

const alertStyles: Record<AlertSeverity, string> = {
  critical: "border-rose-500/20 bg-rose-500/5 text-rose-100",
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-100",
  info: "border-sky-500/20 bg-sky-500/5 text-sky-100",
};

const routeLabels = [
  "GET /api/metrics",
  "POST /api/runs",
  "POST /api/runs/:id/steps",
  "PATCH /api/runs/:id",
] as const;

const menuGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", icon: Gauge, active: true },
      { label: "Runs", icon: Workflow, active: false },
      { label: "Signals", icon: AlertTriangle, active: false },
      { label: "Workflows", icon: Radar, active: false },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Agents", icon: Bot, active: false },
      { label: "Ingestion", icon: Database, active: false },
      { label: "Guardrails", icon: ShieldAlert, active: false },
    ],
  },
] as const;

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 1 : 2)}s`;
}

function formatStartedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function stepIcon(kind: StepKind) {
  switch (kind) {
    case "llm":
      return Bot;
    case "tool":
      return Workflow;
    case "retry":
      return AlertTriangle;
    case "guardrail":
      return ShieldAlert;
    case "handoff":
      return Database;
  }
}

function buildActiveFilters(filters: RunListFilters) {
  const entries = [];

  if (filters.status !== "all") {
    entries.push(`Status: ${filters.status}`);
  }

  if (filters.workflow !== "all") {
    entries.push(`Workflow: ${filters.workflow}`);
  }

  if (filters.environment !== "all") {
    entries.push(`Environment: ${filters.environment}`);
  }

  if (filters.query) {
    entries.push(`Search: ${filters.query}`);
  }

  if (filters.from || filters.to) {
    entries.push(`Window: ${filters.from || "start"} to ${filters.to || "today"}`);
  }

  return entries;
}

export function DashboardShell({
  initialRuns,
  pagination,
  snapshot,
  filters,
  filterOptions,
}: DashboardShellProps) {
  const [selectedRunId, setSelectedRunId] = useState(initialRuns[0]?.id ?? null);
  const selectedRun =
    initialRuns.find((run) => run.id === selectedRunId) ?? initialRuns[0] ?? null;
  const hasFiltersApplied =
    filters.status !== "all" ||
    filters.query.length > 0 ||
    filters.workflow !== "all" ||
    filters.environment !== "all" ||
    filters.from.length > 0 ||
    filters.to.length > 0 ||
    filters.pageSize !== 10;
  const activeFilters = buildActiveFilters(filters);
  const runCounts = {
    healthy: initialRuns.filter((run) => run.status === "healthy").length,
    degraded: initialRuns.filter((run) => run.status === "degraded").length,
    failed: initialRuns.filter((run) => run.status === "failed").length,
    running: initialRuns.filter((run) => run.status === "running").length,
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="grid min-h-screen lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside className="border-b border-zinc-900 bg-black px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-5">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
                  <Radar className="size-5 text-zinc-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Agent Observability Lite
                  </p>
                  <p className="text-xs text-zinc-500">Reliability debugger</p>
                </div>
              </div>
              <p className="hidden text-sm leading-6 text-zinc-500 lg:block">
                Inspect where agent runs start degrading, retrying, or wasting budget.
              </p>
            </div>
          </div>

          <div className="mt-6 hidden space-y-5 lg:block">
            {menuGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="px-2 text-[11px] uppercase tracking-[0.16em] text-zinc-600">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                        item.active
                          ? "border border-zinc-800 bg-zinc-950 text-white"
                          : "text-zinc-500"
                      }`}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">
                Run state
              </p>
              <div className="mt-3 grid gap-2">
                <StatusMini label="Healthy" value={`${runCounts.healthy}`} tone={statusStyles.healthy} />
                <StatusMini label="Degraded" value={`${runCounts.degraded}`} tone={statusStyles.degraded} />
                <StatusMini label="Failed" value={`${runCounts.failed}`} tone={statusStyles.failed} />
                <StatusMini label="Running" value={`${runCounts.running}`} tone={statusStyles.running} />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">
                Endpoints
              </p>
              <div className="mt-3 grid gap-2">
                {routeLabels.map((route) => (
                  <span
                    key={route}
                    className="rounded-lg border border-zinc-800 px-2.5 py-2 font-mono text-[11px] text-zinc-400"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-zinc-900 bg-black px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                  Overview
                </p>
                <div>
                  <h1 className="text-2xl font-semibold text-white">
                    Debug why agents fail, loop, or burn budget.
                  </h1>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    Track runs, follow spans, and turn traces into likely causes and next actions.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                {routeLabels.map((route) => (
                  <span
                    key={route}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono"
                  >
                    {route}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="grid gap-5 px-4 py-5 sm:px-5">
            <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatusStat label="Healthy" value={`${runCounts.healthy}`} tone={statusStyles.healthy} />
                  <StatusStat label="Degraded" value={`${runCounts.degraded}`} tone={statusStyles.degraded} />
                  <StatusStat label="Failed" value={`${runCounts.failed}`} tone={statusStyles.failed} />
                  <StatusStat label="Running" value={`${runCounts.running}`} tone={statusStyles.running} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {snapshot.metrics.map((metric) => (
                    <article
                      key={metric.label}
                      className="rounded-xl border border-zinc-900 bg-zinc-900/70 px-4 py-4"
                    >
                      <p className="text-sm text-zinc-500">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{metric.detail}</p>
                    </article>
                  ))}
                </div>
              </div>

              <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">Workflow snapshot</p>
                  <Radar className="size-4 text-zinc-600" />
                </div>
                <div className="mt-4 grid gap-2.5">
                  {snapshot.workflows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                      No workflows yet. Runs will appear here after ingestion starts.
                    </div>
                  ) : (
                    snapshot.workflows.map((workflow) => (
                      <div
                        key={workflow.name}
                        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-900 bg-zinc-900/60 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{workflow.name}</p>
                          <p className="text-xs text-zinc-600">
                            {workflow.runs} run{workflow.runs === 1 ? "" : "s"} tracked
                          </p>
                        </div>
                        <div className="text-right text-xs text-zinc-500">
                          <p>{formatDuration(workflow.avgLatencyMs)} avg</p>
                          <p>{workflow.failedRuns} failed</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </section>

            <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Runs</h2>
                      <p className="text-sm text-zinc-500">{pagination.total} matched</p>
                    </div>
                    <span className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                      page {pagination.page} of {pagination.pageCount}
                    </span>
                  </div>

                  <form className="grid gap-3" action="/" method="GET">
                    <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-zinc-500">
                      <Search className="size-4" />
                      <input
                        name="query"
                        defaultValue={filters.query}
                        placeholder="Search runs"
                        className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        name="status"
                        defaultValue={filters.status}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none"
                      >
                        {(["all", "healthy", "degraded", "failed", "running"] as StatusFilter[]).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <select
                        name="workflow"
                        defaultValue={filters.workflow}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none"
                      >
                        <option value="all">all workflows</option>
                        {filterOptions.workflows.map((workflow) => (
                          <option key={workflow} value={workflow}>
                            {workflow}
                          </option>
                        ))}
                      </select>
                      <select
                        name="environment"
                        defaultValue={filters.environment}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none"
                      >
                        <option value="all">all environments</option>
                        {filterOptions.environments.map((environment) => (
                          <option key={environment} value={environment}>
                            {environment}
                          </option>
                        ))}
                      </select>
                      <select
                        name="pageSize"
                        defaultValue={`${filters.pageSize}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none"
                      >
                        {runPageSizeOptions.map((pageSize) => (
                          <option key={pageSize} value={pageSize}>
                            {pageSize} per page
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        name="from"
                        defaultValue={filters.from}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none"
                      />
                      <input
                        type="date"
                        name="to"
                        defaultValue={filters.to}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="rounded-xl border border-zinc-700 bg-zinc-100 px-3 py-2 text-sm font-medium text-black"
                      >
                        Apply filters
                      </button>
                      {hasFiltersApplied ? (
                        <Link
                          href="/"
                          className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-400"
                        >
                          Reset
                        </Link>
                      ) : null}
                    </div>
                  </form>

                  {activeFilters.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1">
                        <ListFilter className="size-3.5" />
                        Active filters
                      </span>
                      {activeFilters.map((filter) => (
                        <span
                          key={filter}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1"
                        >
                          {filter}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid max-h-[980px] gap-3 overflow-y-auto pr-1">
                    {initialRuns.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-8">
                        <p className="text-sm font-medium text-white">
                          {pagination.total === 0
                            ? "No runs ingested yet."
                            : "No runs match the current filters."}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          {pagination.total === 0
                            ? "Create a run with POST /api/runs, then stream steps and alerts as the workflow executes."
                            : "Reset or loosen the filters to bring matching runs back into view."}
                        </p>
                      </div>
                    ) : (
                      initialRuns.map((run) => {
                        const active = run.id === selectedRun?.id;

                        return (
                          <button
                            key={run.id}
                            type="button"
                            onClick={() => setSelectedRunId(run.id)}
                            className={`rounded-2xl border px-4 py-4 text-left ${
                              active
                                ? "border-zinc-700 bg-zinc-900 shadow-[0_0_0_1px_rgba(82,82,91,0.45)]"
                                : "border-zinc-900 bg-zinc-900/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs ${statusStyles[run.status]}`}
                                  >
                                    {run.status}
                                  </span>
                                  <span className="text-xs text-zinc-600">
                                    {formatStartedAt(run.startedAt)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white">{run.name}</p>
                                  <p className="mt-1 text-sm text-zinc-500">{run.workflow}</p>
                                </div>
                                <p className="line-clamp-2 text-sm leading-6 text-zinc-400">
                                  {run.diagnosis.headline}
                                </p>
                              </div>
                              <div className="text-right text-xs text-zinc-500">
                                <p>{formatDuration(run.durationMs)}</p>
                                <p>${run.costUsd.toFixed(3)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                              <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                {run.customer}
                              </span>
                              <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                {run.retries} retries
                              </span>
                              <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                {run.alerts.length} alerts
                              </span>
                              <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                {run.signals.length} signals
                              </span>
                              {run.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-lg border border-zinc-800 px-2 py-1"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-zinc-900 pt-2 text-sm text-zinc-500">
                    <Link
                      href={buildRunQueryString(filters, {
                        page: Math.max(1, pagination.page - 1),
                      })}
                      className={`rounded-xl border px-3 py-2 ${
                        pagination.hasPreviousPage
                          ? "border-zinc-800 bg-zinc-900 text-white"
                          : "pointer-events-none border-zinc-900 bg-zinc-950 text-zinc-700"
                      }`}
                    >
                      Previous
                    </Link>
                    <span>
                      showing {initialRuns.length} of {pagination.total}
                    </span>
                    <Link
                      href={buildRunQueryString(filters, {
                        page: pagination.page + 1,
                      })}
                      className={`rounded-xl border px-3 py-2 ${
                        pagination.hasNextPage
                          ? "border-zinc-800 bg-zinc-900 text-white"
                          : "pointer-events-none border-zinc-900 bg-zinc-950 text-zinc-700"
                      }`}
                    >
                      Next
                    </Link>
                  </div>
                </div>
              </aside>

              <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                {selectedRun ? (
                  <div className="grid gap-5">
                    <header className="rounded-2xl border border-zinc-900 bg-zinc-900/70 p-5">
                      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs ${statusStyles[selectedRun.status]}`}
                            >
                              {selectedRun.status}
                            </span>
                            <span className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                              {selectedRun.environment}
                            </span>
                            <span className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                              {selectedRun.agent}
                            </span>
                          </div>
                          <div>
                            <h2 className="text-2xl font-semibold text-white">
                              {selectedRun.name}
                            </h2>
                            <p className="mt-2 max-w-4xl text-sm leading-7 text-zinc-400">
                              {selectedRun.summary}
                            </p>
                            <p className="mt-3 text-sm font-medium text-zinc-200">
                              {selectedRun.diagnosis.headline}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                            <SummaryPill label="Customer" value={selectedRun.customer} />
                            <SummaryPill label="Signals" value={`${selectedRun.signals.length}`} />
                            <SummaryPill label="Alerts" value={`${selectedRun.alerts.length}`} />
                            <SummaryPill label="Steps" value={`${selectedRun.steps.length}`} />
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm text-zinc-400 2xl:min-w-[280px]">
                          <MetaRow label="Started" value={formatStartedAt(selectedRun.startedAt)} />
                          <MetaRow label="Duration" value={formatDuration(selectedRun.durationMs)} />
                          <MetaRow label="Spend" value={`$${selectedRun.costUsd.toFixed(3)}`} />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                        <StatCard icon={Gauge} label="Outcome score" value={`${selectedRun.successScore}/100`} />
                        <StatCard icon={Clock3} label="Retries" value={`${selectedRun.retries}`} />
                        <StatCard icon={DollarSign} label="Tokens" value={selectedRun.tokens.toLocaleString()} />
                        <StatCard
                          icon={AlertTriangle}
                          label="Tool failure rate"
                          value={formatPercent(selectedRun.toolFailureRate)}
                        />
                      </div>
                    </header>

                    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
                      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-white">Trace timeline</h3>
                            <p className="text-sm text-zinc-500">
                              {selectedRun.steps.length} span
                              {selectedRun.steps.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>

                        <div className="relative mt-4 grid gap-3">
                          <div className="pointer-events-none absolute bottom-4 left-[18px] top-4 hidden w-px bg-zinc-800 sm:block" />
                          {selectedRun.steps.map((step, index) => {
                            const StepIcon = stepIcon(step.kind);

                            return (
                              <article
                                key={step.id}
                                className={`relative rounded-2xl border p-4 sm:pl-5 ${stepStyles[step.status]}`}
                              >
                                <div className="flex gap-3">
                                  <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 sm:relative sm:z-10">
                                    <StepIcon className="size-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-lg border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500">
                                            {index + 1}
                                          </span>
                                          <p className="text-sm font-medium text-white">
                                            {step.label}
                                          </p>
                                          <span className="rounded-lg border border-zinc-800 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                                            {step.kind}
                                          </span>
                                          <span
                                            className={`rounded-lg px-2 py-0.5 text-[11px] ${
                                              statusStyles[
                                                step.status === "completed"
                                                  ? "healthy"
                                                  : step.status === "warning"
                                                    ? "degraded"
                                                    : step.status === "failed"
                                                      ? "failed"
                                                      : "running"
                                              ]
                                            }`}
                                          >
                                            {step.status}
                                          </span>
                                          {step.attempt ? (
                                            <span className="rounded-lg border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500">
                                              Attempt {step.attempt}
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="mt-2 text-sm leading-7 text-zinc-400">
                                          {step.message}
                                        </p>
                                      </div>
                                      <div className="text-sm text-zinc-500 sm:text-right">
                                        <p>{formatDuration(step.durationMs)}</p>
                                        <p className="text-xs">{formatStartedAt(step.startedAt)}</p>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                                      {step.toolName ? (
                                        <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                          {step.toolName}
                                        </span>
                                      ) : null}
                                      {step.model ? (
                                        <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                          {step.model}
                                        </span>
                                      ) : null}
                                      {step.tokens ? (
                                        <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                          {step.tokens.toLocaleString()} tokens
                                        </span>
                                      ) : null}
                                      {typeof step.costUsd === "number" ? (
                                        <span className="rounded-lg border border-zinc-800 px-2 py-1">
                                          ${step.costUsd.toFixed(3)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>

                      <aside className="space-y-4 2xl:sticky 2xl:top-5 2xl:self-start">
                        <section className="rounded-2xl border border-zinc-900 bg-zinc-900/70 p-4">
                          <h3 className="text-sm font-medium text-white">Likely cause</h3>
                          <div className="mt-3 rounded-xl border border-zinc-800 px-3 py-3">
                            <p className="text-sm font-medium text-white">
                              {selectedRun.diagnosis.headline}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-zinc-400">
                              {selectedRun.diagnosis.likelyCause}
                            </p>
                            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-zinc-600">
                              What to check next
                            </p>
                            <p className="mt-2 text-sm leading-6 text-zinc-300">
                              {selectedRun.diagnosis.nextAction}
                            </p>
                          </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-900 bg-zinc-900/70 p-4">
                          <h3 className="text-sm font-medium text-white">Signals</h3>
                          <div className="mt-3 grid gap-3">
                            {selectedRun.signals.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                                No derived risk signals on this run.
                              </div>
                            ) : (
                              selectedRun.signals.map((signal) => (
                                <div
                                  key={signal.id}
                                  className={`rounded-xl border px-3 py-3 ${alertStyles[signal.severity]}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-white">
                                      {signal.title}
                                    </p>
                                    <span className="text-[11px] uppercase tracking-[0.12em] text-current/80">
                                      {signal.severity}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-current/90">
                                    {signal.detail}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-900 bg-zinc-900/70 p-4">
                          <h3 className="text-sm font-medium text-white">Reported alerts</h3>
                          <div className="mt-3 grid gap-3">
                            {selectedRun.alerts.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                                No reported alerts on this run.
                              </div>
                            ) : (
                              selectedRun.alerts.map((alert) => (
                                <div
                                  key={alert.id}
                                  className={`rounded-xl border px-3 py-3 ${alertStyles[alert.severity]}`}
                                >
                                  <p className="text-sm font-medium text-white">
                                    {alert.title}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-current/90">
                                    {alert.detail}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-zinc-900 bg-zinc-900/70 p-4">
                          <h3 className="text-sm font-medium text-white">Tags</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedRun.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </section>
                      </aside>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-5 py-10">
                    <p className="text-base font-medium text-white">No run selected.</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                      Start by creating a run, then stream steps and alerts into it as the
                      workflow executes. The debugger will derive totals, surface likely
                      causes, and show where retries or failures started to accumulate.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                      {routeLabels.map((route) => (
                        <span
                          key={route}
                          className="rounded-lg border border-zinc-800 px-2 py-1 font-mono"
                        >
                          {route}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 px-3 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-medium text-white">{value}</p>
    </div>
  );
}

function StatusStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-900/70 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">
          {label}
        </span>
        <span className={`rounded-full px-2 py-1 text-[11px] ${tone}`}>
          {label.toLowerCase()}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-[11px] ${tone}`}>
          {label.toLowerCase()}
        </span>
      </div>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-400">
      <span className="text-zinc-600">{label}</span>
      <span className="ml-1 text-zinc-200">{value}</span>
    </span>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
