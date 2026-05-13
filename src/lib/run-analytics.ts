import type { AlertSeverity, DashboardSnapshot } from "./observability-data";

type AlertLike = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
};

type RunLike = {
  workflow: string;
  status: "healthy" | "degraded" | "failed" | "running";
  durationMs: number;
  costUsd: number;
  retries: number;
  alerts: AlertLike[];
};

export function buildDashboardSnapshotFromRuns<T extends RunLike>(
  runs: T[],
): DashboardSnapshot {
  const totalRuns = runs.length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;
  const runningRuns = runs.filter((run) => run.status === "running").length;
  const healthyRuns = runs.filter((run) => run.status === "healthy").length;
  const closedRuns = runs.filter((run) => run.status !== "running").length;
  const totalLatency = runs.reduce((sum, run) => sum + run.durationMs, 0);
  const totalCost = runs.reduce((sum, run) => sum + run.costUsd, 0);
  const averageRetries =
    totalRuns === 0 ? 0 : runs.reduce((sum, run) => sum + run.retries, 0) / totalRuns;
  const workflowMap = new Map<
    string,
    { name: string; runs: number; avgLatencyMs: number; failedRuns: number; costUsd: number }
  >();

  for (const run of runs) {
    const current = workflowMap.get(run.workflow);

    if (!current) {
      workflowMap.set(run.workflow, {
        name: run.workflow,
        runs: 1,
        avgLatencyMs: run.durationMs,
        failedRuns: run.status === "failed" ? 1 : 0,
        costUsd: run.costUsd,
      });
      continue;
    }

    current.runs += 1;
    current.avgLatencyMs += run.durationMs;
    current.failedRuns += run.status === "failed" ? 1 : 0;
    current.costUsd += run.costUsd;
  }

  return {
    metrics: [
      {
        label: "Runs",
        value: `${totalRuns}`,
        detail: `${failedRuns} failed, ${runningRuns} active`,
      },
      {
        label: "Average latency",
        value: `${totalRuns === 0 ? 0 : (totalLatency / totalRuns / 1000).toFixed(1)}s`,
        detail: "Across visible runs",
      },
      {
        label: "Observed spend",
        value: `$${totalCost.toFixed(3)}`,
        detail: `${averageRetries.toFixed(1)} retries per run`,
      },
      {
        label: "Healthy completion",
        value: `${closedRuns === 0 ? 0 : Math.round((healthyRuns / closedRuns) * 100)}%`,
        detail: `${healthyRuns} of ${closedRuns} closed runs ended healthy`,
      },
    ],
    workflows: Array.from(workflowMap.values())
      .map((workflow) => ({
        ...workflow,
        avgLatencyMs: Math.round(workflow.avgLatencyMs / workflow.runs),
        costUsd: Number(workflow.costUsd.toFixed(3)),
      }))
      .sort((left, right) => right.runs - left.runs || right.avgLatencyMs - left.avgLatencyMs),
    activeAlerts: runs.flatMap((run) => run.alerts).slice(0, 8),
  };
}
