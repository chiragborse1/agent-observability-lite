import { PrismaClient } from "@prisma/client";
import { createRunSchema } from "../src/lib/validators";

const prisma = new PrismaClient();

const seededRuns = [
  {
    name: "Refund escalation triage",
    workflow: "Support routing",
    agent: "concierge-router",
    environment: "production",
    customer: "Northstar Retail",
    status: "degraded",
    startedAt: new Date("2026-05-13T07:52:00Z"),
    durationMs: 11840,
    costUsd: 0.148,
    tokens: 18420,
    retries: 2,
    successScore: 72,
    toolFailureRate: 0.22,
    summary:
      "Completed after two CRM lookup retries. Latency spiked around the CRM tool.",
    tags: ["crm", "support", "handoff"],
    alerts: [
      {
        severity: "warning",
        title: "Retry cluster on crm.fetch_case",
        detail: "Two retries added 4.8s and pushed the run above the latency budget.",
      },
    ],
    steps: [
      {
        label: "Classify inbound request",
        kind: "llm",
        status: "completed",
        startedAt: new Date("2026-05-13T07:52:01Z"),
        durationMs: 1630,
        costUsd: 0.021,
        tokens: 3120,
        model: "gpt-4.1-mini",
        message: "Detected a refund escalation with account-specific context.",
      },
      {
        label: "Fetch CRM case record",
        kind: "tool",
        status: "warning",
        startedAt: new Date("2026-05-13T07:52:03Z"),
        durationMs: 2910,
        toolName: "crm.fetch_case",
        message: "Initial request timed out and triggered the retry policy.",
      },
      {
        label: "Retry CRM fetch",
        kind: "retry",
        status: "completed",
        startedAt: new Date("2026-05-13T07:52:06Z"),
        durationMs: 1890,
        toolName: "crm.fetch_case",
        attempt: 2,
        message: "Fallback path completed with a cached response.",
      },
      {
        label: "Generate escalation note",
        kind: "llm",
        status: "completed",
        startedAt: new Date("2026-05-13T07:52:08Z"),
        durationMs: 2050,
        costUsd: 0.034,
        tokens: 4970,
        model: "gpt-4.1",
        message: "Drafted the escalation note with refund policy context.",
      },
    ],
  },
  {
    name: "Repository health review",
    workflow: "Engineering copilot",
    agent: "repo-analyst",
    environment: "staging",
    customer: "Internal",
    status: "healthy",
    startedAt: new Date("2026-05-13T07:44:00Z"),
    durationMs: 8240,
    costUsd: 0.092,
    tokens: 14210,
    retries: 0,
    successScore: 94,
    toolFailureRate: 0,
    summary: "Completed on the first pass without retries or tool instability.",
    tags: ["analysis", "codebase"],
    alerts: [],
    steps: [
      {
        label: "Plan file search",
        kind: "llm",
        status: "completed",
        startedAt: new Date("2026-05-13T07:44:01Z"),
        durationMs: 920,
        costUsd: 0.01,
        tokens: 1860,
        model: "gpt-4.1-mini",
        message: "Selected the code search strategy and relevant modules.",
      },
      {
        label: "Scan repository graph",
        kind: "tool",
        status: "completed",
        startedAt: new Date("2026-05-13T07:44:02Z"),
        durationMs: 2140,
        toolName: "repo.scan",
        message: "Mapped entry points and hotspots.",
      },
      {
        label: "Summarize findings",
        kind: "llm",
        status: "completed",
        startedAt: new Date("2026-05-13T07:44:05Z"),
        durationMs: 3150,
        costUsd: 0.041,
        tokens: 6320,
        model: "gpt-4.1",
        message: "Prepared a final report with risk-ranked findings.",
      },
    ],
  },
  {
    name: "Invoice reconciliation audit",
    workflow: "Finance ops",
    agent: "ledger-auditor",
    environment: "production",
    customer: "Ternion Logistics",
    status: "failed",
    startedAt: new Date("2026-05-13T07:31:00Z"),
    durationMs: 14980,
    costUsd: 0.231,
    tokens: 26880,
    retries: 3,
    successScore: 18,
    toolFailureRate: 0.5,
    summary:
      "The ERP connector never stabilized, so the run ended without the export artifact.",
    tags: ["finance", "erp", "critical"],
    alerts: [
      {
        severity: "critical",
        title: "ERP connector hard failure",
        detail: "Three retries on erp.fetch_invoice_batch failed with schema mismatch errors.",
      },
      {
        severity: "warning",
        title: "Cost without outcome",
        detail: "The run consumed spend without producing the reconciliation export.",
      },
    ],
    steps: [
      {
        label: "Interpret audit request",
        kind: "llm",
        status: "completed",
        startedAt: new Date("2026-05-13T07:31:01Z"),
        durationMs: 1180,
        costUsd: 0.015,
        tokens: 2440,
        model: "gpt-4.1-mini",
        message: "Parsed the invoice date window and reconciliation fields.",
      },
      {
        label: "Load invoice batch",
        kind: "tool",
        status: "failed",
        startedAt: new Date("2026-05-13T07:31:03Z"),
        durationMs: 4010,
        toolName: "erp.fetch_invoice_batch",
        message: "Connector returned an unexpected line item payload shape.",
      },
      {
        label: "Retry connector",
        kind: "retry",
        status: "failed",
        startedAt: new Date("2026-05-13T07:31:07Z"),
        durationMs: 2860,
        toolName: "erp.fetch_invoice_batch",
        attempt: 2,
        message: "Fallback parser failed on the same schema mismatch.",
      },
      {
        label: "Retry connector again",
        kind: "retry",
        status: "failed",
        startedAt: new Date("2026-05-13T07:31:10Z"),
        durationMs: 2790,
        toolName: "erp.fetch_invoice_batch",
        attempt: 3,
        message: "Circuit breaker tripped after the third failed attempt.",
      },
    ],
  },
  {
    name: "Outbound lead enrichment",
    workflow: "Sales ops",
    agent: "lead-researcher",
    environment: "production",
    customer: "Mercury Peak",
    status: "running",
    startedAt: new Date("2026-05-13T08:03:00Z"),
    durationMs: 6720,
    costUsd: 0.087,
    tokens: 11730,
    retries: 1,
    successScore: 0,
    toolFailureRate: 0.14,
    summary: "Still active and waiting on the current LLM summarization step.",
    tags: ["sales", "research", "live"],
    alerts: [
      {
        severity: "info",
        title: "Approaching cost guardrail",
        detail: "The run has used most of the per-lead enrichment budget.",
      },
    ],
    steps: [
      {
        label: "Normalize account list",
        kind: "tool",
        status: "completed",
        startedAt: new Date("2026-05-13T08:03:01Z"),
        durationMs: 970,
        toolName: "sheet.parse_accounts",
        message: "Parsed 14 valid targets and two duplicates.",
      },
      {
        label: "Search public firmographics",
        kind: "tool",
        status: "warning",
        startedAt: new Date("2026-05-13T08:03:03Z"),
        durationMs: 1940,
        toolName: "web.firmographic_search",
        message: "Primary provider timed out and the backup source took over.",
      },
      {
        label: "Draft outbound summary",
        kind: "llm",
        status: "running",
        startedAt: new Date("2026-05-13T08:03:05Z"),
        durationMs: 3810,
        costUsd: 0.029,
        tokens: 4050,
        model: "gpt-4.1",
        message: "Compiling account summaries and recommended next actions.",
      },
    ],
  },
] as const;

async function main() {
  await prisma.runAlert.deleteMany();
  await prisma.runStep.deleteMany();
  await prisma.run.deleteMany();

  for (const seededRun of seededRuns) {
    const run = createRunSchema.parse(seededRun);

    await prisma.run.create({
      data: {
        name: run.name,
        workflow: run.workflow,
        agent: run.agent,
        environment: run.environment,
        customer: run.customer,
        status: run.status,
        startedAt: run.startedAt,
        durationMs: run.durationMs ?? 0,
        costUsd: run.costUsd ?? 0,
        tokens: run.tokens ?? 0,
        retries: run.retries ?? 0,
        successScore: run.successScore ?? 0,
        toolFailureRate: run.toolFailureRate ?? 0,
        summary: run.summary ?? "",
        tagsJson: JSON.stringify(run.tags),
        alerts: {
          create: run.alerts.map((alert) => ({
            severity: alert.severity,
            title: alert.title,
            detail: alert.detail,
          })),
        },
        steps: {
          create: run.steps.map((step) => ({
            label: step.label,
            kind: step.kind,
            status: step.status,
            startedAt: step.startedAt,
            durationMs: step.durationMs,
            costUsd: step.costUsd,
            tokens: step.tokens,
            message: step.message,
            toolName: step.toolName,
            model: step.model,
            attempt: step.attempt,
          })),
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
