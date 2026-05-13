import { ObservabilityClient } from "./observability-client";

const baseUrl = process.env.OBSERVABILITY_BASE_URL ?? "http://127.0.0.1:3000";
const client = new ObservabilityClient(baseUrl);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const runStartedAt = new Date();

  console.log(`Sending demo run to ${baseUrl}`);

  const run = await client.createRun({
    name: "Knowledge sync validation",
    workflow: "Docs ops",
    agent: "playbook-auditor",
    environment: "staging",
    customer: "Internal",
    status: "running",
    startedAt: runStartedAt.toISOString(),
    tags: ["docs", "sync", "demo"],
    steps: [
      {
        label: "Read source revisions",
        kind: "tool",
        status: "completed",
        startedAt: new Date(runStartedAt.getTime() + 250).toISOString(),
        durationMs: 540,
        toolName: "docs.read_revision_batch",
        message: "Loaded the latest playbook and changelog revisions.",
      },
    ],
  });

  console.log(`Run created: ${run.id}`);
  await wait(800);

  await client.appendSteps(run.id, {
    steps: [
      {
        label: "Compare article coverage",
        kind: "tool",
        status: "warning",
        startedAt: new Date(runStartedAt.getTime() + 1300).toISOString(),
        durationMs: 860,
        toolName: "docs.compare_sections",
        message: "Detected one missing troubleshooting section in the published article.",
      },
    ],
  });

  await client.appendAlerts(run.id, {
    alerts: [
      {
        severity: "warning",
        title: "Coverage gap detected",
        detail: "The published article is missing one troubleshooting section from the latest source revision.",
      },
    ],
  });

  await wait(800);

  await client.appendSteps(run.id, {
    steps: [
      {
        label: "Draft remediation summary",
        kind: "llm",
        status: "completed",
        startedAt: new Date(runStartedAt.getTime() + 2500).toISOString(),
        durationMs: 1280,
        costUsd: 0.016,
        tokens: 1980,
        model: "gpt-4.1-mini",
        message: "Prepared the update summary and a patch recommendation for the docs owner.",
      },
      {
        label: "Queue human review",
        kind: "handoff",
        status: "completed",
        startedAt: new Date(runStartedAt.getTime() + 3950).toISOString(),
        durationMs: 430,
        message: "Assigned the remediation note to the docs review queue.",
      },
    ],
  });

  await client.updateRun(run.id, {
    status: "degraded",
    durationMs: 4380,
    costUsd: 0.016,
    tokens: 1980,
    retries: 0,
    successScore: 76,
    toolFailureRate: 0.5,
    summary:
      "The agent completed its review but surfaced a missing section that still needs human action.",
    tags: ["docs", "sync", "demo", "handoff"],
  });

  console.log(`Run updated: ${run.id}`);
  console.log("Refresh the dashboard to inspect the new run.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
