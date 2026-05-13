"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Clock3,
  Database,
  DollarSign,
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
  completed: "border-slate-800 bg-slate-950",
  warning: "border-amber-500/20 bg-amber-500/5",
  failed: "border-rose-500/20 bg-rose-500/5",
  running: "border-sky-500/20 bg-sky-500/5",
};

const alertStyles: Record<AlertSeverity, string> = {
  critical: "border-rose-500/20 bg-rose-500/5 text-rose-100",
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-100",
  info: "border-sky-500/20 bg-sky-500/5 text-sky-100",
};

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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span className="rounded-full border border-slate-700 px-3 py-1">
                  Agent Observability Lite
                </span>
                <span className="rounded-full border border-slate-700 px-3 py-1">
                  SQLite-backed MVP
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Track runs, inspect traces, and catch retry-driven failures early.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-400">
                  This MVP stores runs in SQLite, exposes ingestion endpoints, and
                  keeps the UI focused on what matters most: status, latency, spend,
                  retries, and run-level debugging.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                {["GET /api/metrics", "GET /api/runs", "POST /api/runs", "POST /api/runs/:id/steps"].map(
                  (route) => (
                    <span
                      key={route}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono"
                    >
                      {route}
                    </span>
                  ),
                )}
              </div>
              <p className="text-sm text-slate-500">
                To send a real sample run into the app, start the dashboard and run
                <code className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
                  pnpm agent:demo
                </code>
                .
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm font-medium text-white">Workflow snapshot</p>
              <div className="mt-4 grid gap-3">
                {snapshot.workflows.map((workflow) => (
                  <div
                    key={workflow.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{workflow.name}</p>
                      <p className="text-xs text-slate-500">
                        {workflow.runs} run{workflow.runs === 1 ? "" : "s"} tracked
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>{formatDuration(workflow.avgLatencyMs)} avg</p>
                      <p>{workflow.failedRuns} failed</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {snapshot.metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-4"
            >
              <p className="text-sm text-slate-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              <p className="mt-1 text-sm text-slate-500">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Runs</h2>
                  <p className="text-sm text-slate-500">
                    {pagination.total} matched
                  </p>
                </div>
                <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400">
                  page {pagination.page} of {pagination.pageCount}
                </span>
              </div>

              <form className="grid gap-3" action="/" method="GET">
                <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-400">
                  <Search className="size-4" />
                  <input
                    name="query"
                    defaultValue={filters.query}
                    placeholder="Search runs"
                    className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    name="status"
                    defaultValue={filters.status}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
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
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
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
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
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
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
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
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
                  />
                  <input
                    type="date"
                    name="to"
                    defaultValue={filters.to}
                    className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    Apply filters
                  </button>
                  {hasFiltersApplied ? (
                    <Link
                      href="/"
                      className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400"
                    >
                      Reset
                    </Link>
                  ) : null}
                </div>
              </form>

              <div className="grid max-h-[980px] gap-3 overflow-y-auto pr-1">
                {initialRuns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 px-4 py-8 text-sm text-slate-500">
                    No runs match the current filters.
                  </div>
                ) : (
                  initialRuns.map((run) => {
                    const active = run.id === selectedRun?.id;

                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                        className={`rounded-xl border px-4 py-4 text-left ${
                          active
                            ? "border-slate-600 bg-slate-800"
                            : "border-slate-800 bg-slate-950"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs ${statusStyles[run.status]}`}
                            >
                              {run.status}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">{run.name}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {run.workflow}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>{formatDuration(run.durationMs)}</p>
                            <p>${run.costUsd.toFixed(3)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-md border border-slate-800 px-2 py-1">
                            {run.customer}
                          </span>
                          {run.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md border border-slate-800 px-2 py-1"
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

              <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-2 text-sm text-slate-400">
                <Link
                  href={buildRunQueryString(filters, {
                    page: Math.max(1, pagination.page - 1),
                  })}
                  className={`rounded-md border px-3 py-2 ${
                    pagination.hasPreviousPage
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "pointer-events-none border-slate-800 bg-slate-950 text-slate-600"
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
                  className={`rounded-md border px-3 py-2 ${
                    pagination.hasNextPage
                      ? "border-slate-700 bg-slate-800 text-white"
                      : "pointer-events-none border-slate-800 bg-slate-950 text-slate-600"
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            {selectedRun ? (
              <div className="grid gap-6">
                <header className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs ${statusStyles[selectedRun.status]}`}
                        >
                          {selectedRun.status}
                        </span>
                        <span className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-500">
                          {selectedRun.environment}
                        </span>
                        <span className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-500">
                          {selectedRun.agent}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-white">
                          {selectedRun.name}
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                          {selectedRun.summary}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-400 xl:min-w-[240px]">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2">
                        <span>Started</span>
                        <span className="text-white">
                          {formatStartedAt(selectedRun.startedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2">
                        <span>Duration</span>
                        <span className="text-white">
                          {formatDuration(selectedRun.durationMs)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2">
                        <span>Spend</span>
                        <span className="text-white">
                          ${selectedRun.costUsd.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={Bot} label="Outcome score" value={`${selectedRun.successScore}/100`} />
                    <StatCard icon={Clock3} label="Retries" value={`${selectedRun.retries}`} />
                    <StatCard icon={DollarSign} label="Tokens" value={selectedRun.tokens.toLocaleString()} />
                    <StatCard
                      icon={AlertTriangle}
                      label="Tool failure rate"
                      value={formatPercent(selectedRun.toolFailureRate)}
                    />
                  </div>
                </header>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Trace timeline
                        </h3>
                        <p className="text-sm text-slate-500">
                          {selectedRun.steps.length} span
                          {selectedRun.steps.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {selectedRun.steps.map((step) => {
                        const StepIcon = stepIcon(step.kind);

                        return (
                          <article
                            key={step.id}
                            className={`rounded-xl border p-4 ${stepStyles[step.status]}`}
                          >
                            <div className="flex gap-3">
                              <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300">
                                <StepIcon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-white">
                                        {step.label}
                                      </p>
                                      <span className="rounded-md border border-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                        {step.kind}
                                      </span>
                                      {step.attempt ? (
                                        <span className="rounded-md border border-slate-800 px-2 py-0.5 text-[11px] text-slate-500">
                                          Attempt {step.attempt}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-sm leading-7 text-slate-400">
                                      {step.message}
                                    </p>
                                  </div>
                                  <div className="text-sm text-slate-500 sm:text-right">
                                    <p>{formatDuration(step.durationMs)}</p>
                                    <p className="text-xs">
                                      {formatStartedAt(step.startedAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                  {step.toolName ? (
                                    <span className="rounded-md border border-slate-800 px-2 py-1">
                                      {step.toolName}
                                    </span>
                                  ) : null}
                                  {step.model ? (
                                    <span className="rounded-md border border-slate-800 px-2 py-1">
                                      {step.model}
                                    </span>
                                  ) : null}
                                  {step.tokens ? (
                                    <span className="rounded-md border border-slate-800 px-2 py-1">
                                      {step.tokens.toLocaleString()} tokens
                                    </span>
                                  ) : null}
                                  {typeof step.costUsd === "number" ? (
                                    <span className="rounded-md border border-slate-800 px-2 py-1">
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

                  <aside className="space-y-4">
                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <h3 className="text-sm font-medium text-white">Current alerts</h3>
                      <div className="mt-3 grid gap-3">
                        {selectedRun.alerts.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-sm text-slate-500">
                            No alerts on this run.
                          </div>
                        ) : (
                          selectedRun.alerts.map((alert) => (
                            <div
                              key={alert.id}
                              className={`rounded-lg border px-3 py-3 ${alertStyles[alert.severity]}`}
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

                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <h3 className="text-sm font-medium text-white">Tags</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedRun.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <h3 className="text-sm font-medium text-white">Write paths</h3>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400">
                        {[
                          "PATCH /api/runs/:id",
                          "POST /api/runs/:id/steps",
                          "POST /api/runs/:id/alerts",
                        ].map((route) => (
                          <span
                            key={route}
                            className="rounded-md border border-slate-800 px-2 py-2 font-mono"
                          >
                            {route}
                          </span>
                        ))}
                      </div>
                    </section>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 px-4 py-10 text-sm text-slate-500">
                Add data through the API routes to populate the dashboard.
              </div>
            )}
          </section>
        </section>
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
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-500">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-medium text-white">{value}</p>
    </div>
  );
}
