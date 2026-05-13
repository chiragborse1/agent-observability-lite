import assert from "node:assert/strict";
import test from "node:test";
import { buildRunDiagnostics } from "./run-diagnosis";

test("buildRunDiagnostics flags schema mismatch failures", () => {
  const result = buildRunDiagnostics({
    status: "failed",
    durationMs: 14980,
    costUsd: 0.231,
    retries: 3,
    successScore: 18,
    toolFailureRate: 0.5,
    summary: "The ERP connector never stabilized.",
    alerts: [
      {
        severity: "critical",
        title: "ERP connector hard failure",
        detail: "Three retries failed with schema mismatch errors.",
      },
    ],
    steps: [
      {
        id: "step-1",
        label: "Load invoice batch",
        kind: "tool",
        status: "failed",
        durationMs: 4010,
        toolName: "erp.fetch_invoice_batch",
        message: "Connector returned an unexpected payload shape.",
      },
      {
        id: "step-2",
        label: "Retry connector",
        kind: "retry",
        status: "failed",
        durationMs: 2860,
        toolName: "erp.fetch_invoice_batch",
        attempt: 2,
        message: "Fallback parser failed on the same schema mismatch.",
      },
    ],
  });

  assert.equal(result.diagnosis.headline, "Connector contract broke the run");
  assert.equal(result.signals[0]?.severity, "critical");
  assert.ok(
    result.signals.some((signal) => signal.id === "signal:schema-mismatch"),
  );
  assert.ok(
    result.signals.some((signal) => signal.id === "signal:cost-without-outcome"),
  );
});

test("buildRunDiagnostics explains degraded runs that recovered", () => {
  const result = buildRunDiagnostics({
    status: "degraded",
    durationMs: 11840,
    costUsd: 0.148,
    retries: 2,
    successScore: 72,
    toolFailureRate: 0.22,
    summary: "Completed after two CRM lookup retries.",
    alerts: [],
    steps: [
      {
        id: "step-1",
        label: "Fetch CRM case record",
        kind: "tool",
        status: "warning",
        durationMs: 2910,
        toolName: "crm.fetch_case",
        message: "Initial request timed out and triggered the retry policy.",
      },
      {
        id: "step-2",
        label: "Retry CRM fetch",
        kind: "retry",
        status: "completed",
        durationMs: 1890,
        toolName: "crm.fetch_case",
        attempt: 2,
        message: "Fallback path completed with a cached response.",
      },
    ],
  });

  assert.equal(
    result.diagnosis.headline,
    "The run recovered, but a dependency dragged it down",
  );
  assert.ok(
    result.diagnosis.likelyCause.includes("crm.fetch_case"),
  );
  assert.ok(result.signals.some((signal) => signal.id === "tool:crm.fetch_case"));
});

test("buildRunDiagnostics treats quiet healthy runs as a baseline", () => {
  const result = buildRunDiagnostics({
    status: "healthy",
    durationMs: 8240,
    costUsd: 0.092,
    retries: 0,
    successScore: 94,
    toolFailureRate: 0,
    summary: "Completed on the first pass without retries.",
    alerts: [],
    steps: [
      {
        id: "step-1",
        label: "Summarize findings",
        kind: "llm",
        status: "completed",
        durationMs: 3150,
        message: "Prepared a final report with risk-ranked findings.",
      },
    ],
  });

  assert.equal(result.diagnosis.headline, "No active reliability issue detected");
  assert.equal(result.signals.length, 0);
});

test("buildRunDiagnostics derives retry signals from alerts and run-level counts", () => {
  const result = buildRunDiagnostics({
    status: "degraded",
    durationMs: 8000,
    costUsd: 0.013,
    retries: 2,
    successScore: 74,
    toolFailureRate: 0.25,
    summary: "Recovered after retries but exceeded the latency target.",
    alerts: [
      {
        severity: "warning",
        title: "Retry cluster detected",
        detail: "Payment lookup retried twice.",
      },
    ],
    steps: [
      {
        id: "step-1",
        label: "Inspect payment attempt",
        kind: "tool",
        status: "completed",
        durationMs: 620,
        toolName: "payments.fetch_attempt",
        message: "Loaded the latest payment attempt payload.",
      },
      {
        id: "step-2",
        label: "Draft remediation summary",
        kind: "llm",
        status: "completed",
        durationMs: 1380,
        message: "Prepared the next action summary.",
      },
    ],
  });

  assert.equal(result.diagnosis.headline, "The run recovered after retry debt");
  assert.ok(
    result.signals.some((signal) => signal.id === "signal:retries-observed"),
  );
  assert.ok(
    result.signals.some((signal) => signal.id === "signal:retry-trace-gap"),
  );
});
