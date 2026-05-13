import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardSnapshotFromRuns } from "@/lib/run-analytics";

const runs = [
  {
    workflow: "Support routing",
    status: "degraded" as const,
    durationMs: 12000,
    costUsd: 0.14,
    retries: 2,
    alerts: [
      {
        id: "a1",
        severity: "warning" as const,
        title: "Retry cluster",
        detail: "Tool retries exceeded the latency budget.",
      },
    ],
  },
  {
    workflow: "Support routing",
    status: "healthy" as const,
    durationMs: 8000,
    costUsd: 0.08,
    retries: 0,
    alerts: [],
  },
  {
    workflow: "Finance ops",
    status: "failed" as const,
    durationMs: 15000,
    costUsd: 0.23,
    retries: 3,
    alerts: [
      {
        id: "a2",
        severity: "critical" as const,
        title: "Connector hard failure",
        detail: "The ERP connector never stabilized.",
      },
    ],
  },
] satisfies Array<Parameters<typeof buildDashboardSnapshotFromRuns>[0][number]>;

test("buildDashboardSnapshotFromRuns aggregates metrics and workflows", () => {
  const snapshot = buildDashboardSnapshotFromRuns(runs);

  assert.equal(snapshot.metrics[0]?.value, "3");
  assert.equal(snapshot.metrics[0]?.detail, "1 failed, 0 active");
  assert.equal(snapshot.metrics[2]?.value, "$0.450");
  assert.equal(snapshot.metrics[3]?.label, "Healthy completion");
  assert.equal(snapshot.metrics[3]?.value, "33%");
  assert.equal(snapshot.metrics[3]?.detail, "1 of 3 closed runs ended healthy");
  assert.equal(snapshot.workflows.length, 2);
  assert.equal(snapshot.workflows[0]?.name, "Support routing");
  assert.equal(snapshot.workflows[0]?.runs, 2);
  assert.equal(snapshot.workflows[0]?.avgLatencyMs, 10000);
  assert.equal(snapshot.workflows[1]?.failedRuns, 1);
  assert.equal(snapshot.activeAlerts.length, 2);
});
