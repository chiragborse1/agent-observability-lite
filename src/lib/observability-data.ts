import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AppendAlertsInput,
  AppendStepsInput,
  CreateRunInput,
  UpdateRunInput,
} from "@/lib/validators";

export type RunStatus = "healthy" | "degraded" | "failed" | "running";
export type StepKind = "llm" | "tool" | "retry" | "guardrail" | "handoff";
export type StepStatus = "completed" | "warning" | "failed" | "running";
export type AlertSeverity = "critical" | "warning" | "info";
export type RunEnvironment = "production" | "staging" | "development";

export type RunStep = {
  id: string;
  label: string;
  kind: StepKind;
  status: StepStatus;
  startedAt: string;
  durationMs: number;
  costUsd?: number;
  tokens?: number;
  message: string;
  toolName?: string;
  model?: string;
  attempt?: number;
};

export type RunAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
};

export type AgentRun = {
  id: string;
  name: string;
  workflow: string;
  agent: string;
  environment: RunEnvironment;
  customer: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string | null;
  durationMs: number;
  costUsd: number;
  tokens: number;
  retries: number;
  successScore: number;
  toolFailureRate: number;
  summary: string;
  tags: string[];
  alerts: RunAlert[];
  steps: RunStep[];
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type WorkflowSlice = {
  name: string;
  runs: number;
  avgLatencyMs: number;
  failedRuns: number;
  costUsd: number;
};

export type DashboardSnapshot = {
  metrics: DashboardMetric[];
  workflows: WorkflowSlice[];
  activeAlerts: RunAlert[];
};

type RunWithRelations = Prisma.RunGetPayload<{
  include: {
    alerts: true;
    steps: {
      orderBy: {
        startedAt: "asc";
      };
    };
  };
}>;

type RunFilters = {
  status?: RunStatus | "all";
  query?: string;
};

function parseTags(value: string) {
  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapRun(run: RunWithRelations): AgentRun {
  return {
    id: run.id,
    name: run.name,
    workflow: run.workflow,
    agent: run.agent,
    environment: run.environment as RunEnvironment,
    customer: run.customer,
    status: run.status as RunStatus,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    costUsd: run.costUsd,
    tokens: run.tokens,
    retries: run.retries,
    successScore: run.successScore,
    toolFailureRate: run.toolFailureRate,
    summary: run.summary,
    tags: parseTags(run.tagsJson),
    alerts: run.alerts.map((alert) => ({
      id: alert.id,
      severity: alert.severity as AlertSeverity,
      title: alert.title,
      detail: alert.detail,
    })),
    steps: run.steps.map((step) => ({
      id: step.id,
      label: step.label,
      kind: step.kind as StepKind,
      status: step.status as StepStatus,
      startedAt: step.startedAt.toISOString(),
      durationMs: step.durationMs,
      costUsd: step.costUsd ?? undefined,
      tokens: step.tokens ?? undefined,
      message: step.message,
      toolName: step.toolName ?? undefined,
      model: step.model ?? undefined,
      attempt: step.attempt ?? undefined,
    })),
  };
}

function defaultSuccessScore(status: RunStatus) {
  switch (status) {
    case "healthy":
      return 94;
    case "degraded":
      return 68;
    case "failed":
      return 18;
    case "running":
      return 0;
  }
}

function defaultSummary(status: RunStatus, retries: number) {
  switch (status) {
    case "healthy":
      return retries > 0
        ? "Completed successfully after recovery logic stabilized the run."
        : "Completed successfully without intervention.";
    case "degraded":
      return "Completed, but performance or tool stability signals need investigation.";
    case "failed":
      return "Run failed before it produced the expected outcome.";
    case "running":
      return "Run is still active and emitting new spans.";
  }
}

function deriveRunValues(input: {
  status: RunStatus;
  startedAt: Date;
  endedAt?: Date | null;
  durationMs?: number;
  costUsd?: number;
  tokens?: number;
  retries?: number;
  successScore?: number;
  toolFailureRate?: number;
  summary?: string;
  steps: CreateRunInput["steps"] | AppendStepsInput["steps"];
}) {
  const stepCost = Number(
    input.steps.reduce((sum, step) => sum + (step.costUsd ?? 0), 0).toFixed(3),
  );
  const stepTokens = input.steps.reduce((sum, step) => sum + (step.tokens ?? 0), 0);
  const retries = input.steps.filter((step) => step.kind === "retry").length;
  const toolSteps = input.steps.filter(
    (step) => step.kind === "tool" || step.kind === "retry",
  );
  const unstableToolSteps = toolSteps.filter(
    (step) => step.status === "failed" || step.status === "warning",
  );
  const derivedDuration =
    input.durationMs ??
    (input.endedAt ? Math.max(0, input.endedAt.getTime() - input.startedAt.getTime()) : 0) ??
    input.steps.reduce((sum, step) => sum + step.durationMs, 0);

  return {
    durationMs:
      derivedDuration > 0
        ? derivedDuration
        : input.steps.reduce((sum, step) => sum + step.durationMs, 0),
    costUsd: input.costUsd ?? stepCost,
    tokens: input.tokens ?? stepTokens,
    retries: input.retries ?? retries,
    successScore: input.successScore ?? defaultSuccessScore(input.status),
    toolFailureRate:
      input.toolFailureRate ??
      (toolSteps.length === 0 ? 0 : unstableToolSteps.length / toolSteps.length),
    summary:
      input.summary ??
      defaultSummary(input.status, input.retries ?? retries),
  };
}

function applyFilters(runs: AgentRun[], filters?: RunFilters) {
  const status = filters?.status ?? "all";
  const query = filters?.query?.trim().toLowerCase();

  return runs.filter((run) => {
    const matchesStatus = status === "all" ? true : run.status === status;
    const matchesQuery =
      !query ||
      [run.name, run.workflow, run.agent, run.customer, ...run.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return matchesStatus && matchesQuery;
  });
}

export async function listRuns(filters?: RunFilters) {
  const runs = await prisma.run.findMany({
    include: {
      alerts: true,
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  return applyFilters(runs.map(mapRun), filters);
}

export async function getRunById(id: string) {
  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      alerts: true,
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });

  return run ? mapRun(run) : null;
}

export async function getDashboardSnapshot(runsInput?: AgentRun[]) {
  const runs = runsInput ?? (await listRuns());
  const totalRuns = runs.length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;
  const runningRuns = runs.filter((run) => run.status === "running").length;
  const totalLatency = runs.reduce((sum, run) => sum + run.durationMs, 0);
  const totalCost = runs.reduce((sum, run) => sum + run.costUsd, 0);
  const averageRetries =
    totalRuns === 0 ? 0 : runs.reduce((sum, run) => sum + run.retries, 0) / totalRuns;
  const workflowMap = new Map<string, WorkflowSlice>();

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

  const workflows = Array.from(workflowMap.values())
    .map((workflow) => ({
      ...workflow,
      avgLatencyMs: Math.round(workflow.avgLatencyMs / workflow.runs),
      costUsd: Number(workflow.costUsd.toFixed(3)),
    }))
    .sort((left, right) => right.runs - left.runs || right.avgLatencyMs - left.avgLatencyMs);

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
        label: "Reliability",
        value: `${totalRuns === 0 ? 0 : Math.round(((totalRuns - failedRuns) / totalRuns) * 100)}%`,
        detail: "Runs not ending in failure",
      },
    ],
    workflows,
    activeAlerts: runs.flatMap((run) => run.alerts).slice(0, 8),
  } satisfies DashboardSnapshot;
}

export async function createRun(input: CreateRunInput) {
  const derived = deriveRunValues(input);

  const run = await prisma.run.create({
    data: {
      name: input.name,
      workflow: input.workflow,
      agent: input.agent,
      environment: input.environment,
      customer: input.customer,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      durationMs: derived.durationMs,
      costUsd: derived.costUsd,
      tokens: derived.tokens,
      retries: derived.retries,
      successScore: derived.successScore,
      toolFailureRate: derived.toolFailureRate,
      summary: derived.summary,
      tagsJson: JSON.stringify(input.tags),
      steps: {
        create: input.steps.map((step) => ({
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
      alerts: {
        create: input.alerts.map((alert) => ({
          severity: alert.severity,
          title: alert.title,
          detail: alert.detail,
        })),
      },
    },
    include: {
      alerts: true,
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });

  return mapRun(run);
}

export async function updateRun(id: string, input: UpdateRunInput) {
  const existing = await prisma.run.findUnique({
    where: { id },
    include: {
      alerts: true,
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });

  if (!existing) {
    return null;
  }

  const mapped = mapRun(existing);
  const nextStatus = input.status ?? mapped.status;
  const nextStartedAt = input.startedAt ?? existing.startedAt;
  const nextEndedAt =
    input.endedAt === undefined ? existing.endedAt : input.endedAt;
  const derived = deriveRunValues({
    status: nextStatus,
    startedAt: nextStartedAt,
    endedAt: nextEndedAt,
    durationMs: input.durationMs,
    costUsd: input.costUsd,
    tokens: input.tokens,
    retries: input.retries,
    successScore: input.successScore,
    toolFailureRate: input.toolFailureRate,
    summary: input.summary,
    steps: mapped.steps.map((step) => ({
      ...step,
      startedAt: new Date(step.startedAt),
    })),
  });

  const updated = await prisma.run.update({
    where: { id },
    data: {
      name: input.name,
      workflow: input.workflow,
      agent: input.agent,
      environment: input.environment,
      customer: input.customer,
      status: nextStatus,
      startedAt: nextStartedAt,
      endedAt: nextEndedAt,
      durationMs: derived.durationMs,
      costUsd: derived.costUsd,
      tokens: derived.tokens,
      retries: derived.retries,
      successScore: derived.successScore,
      toolFailureRate: derived.toolFailureRate,
      summary: derived.summary,
      tagsJson: input.tags ? JSON.stringify(input.tags) : undefined,
    },
    include: {
      alerts: true,
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });

  return mapRun(updated);
}

export async function appendSteps(id: string, input: AppendStepsInput) {
  const existing = await getRunById(id);

  if (!existing) {
    return null;
  }

  await prisma.run.update({
    where: { id },
    data: {
      steps: {
        create: input.steps.map((step) => ({
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

  return updateRun(id, {});
}

export async function appendAlerts(id: string, input: AppendAlertsInput) {
  const existing = await prisma.run.findUnique({ where: { id } });

  if (!existing) {
    return null;
  }

  const updated = await prisma.run.update({
    where: { id },
    data: {
      alerts: {
        create: input.alerts.map((alert) => ({
          severity: alert.severity,
          title: alert.title,
          detail: alert.detail,
        })),
      },
    },
    include: {
      alerts: true,
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });

  return mapRun(updated);
}
