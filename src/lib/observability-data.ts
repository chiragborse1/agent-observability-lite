import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { buildDashboardSnapshotFromRuns } from "./run-analytics";
import {
  buildRunDiagnostics,
  type RunDiagnosis,
  type RunDiagnosisSignal,
} from "./run-diagnosis";
import {
  createPagination,
  type RunListFilters,
  type RunPagination,
} from "./run-filters";
import type {
  AppendAlertsInput,
  AppendStepsInput,
  CreateRunInput,
  UpdateRunInput,
} from "./validators";

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
  diagnosis: RunDiagnosis;
  signals: RunDiagnosisSignal[];
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

export type RunsPage = {
  data: AgentRun[];
  pagination: RunPagination;
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
  const mappedRun = {
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

  return {
    ...mappedRun,
    ...buildRunDiagnostics(mappedRun),
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

function buildRunWhere(filters?: Partial<RunListFilters>): Prisma.RunWhereInput | undefined {
  if (!filters) {
    return undefined;
  }

  const and: Prisma.RunWhereInput[] = [];

  if (filters.status && filters.status !== "all") {
    and.push({
      status: filters.status,
    });
  }

  if (filters.workflow && filters.workflow !== "all") {
    and.push({
      workflow: filters.workflow,
    });
  }

  if (filters.environment && filters.environment !== "all") {
    and.push({
      environment: filters.environment,
    });
  }

  if (filters.from || filters.to) {
    and.push({
      startedAt: {
        gte: filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined,
        lte: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined,
      },
    });
  }

  if (filters.query?.trim()) {
    const query = filters.query.trim();

    and.push({
      OR: [
        { name: { contains: query } },
        { workflow: { contains: query } },
        { agent: { contains: query } },
        { customer: { contains: query } },
        { summary: { contains: query } },
        { tagsJson: { contains: query } },
      ],
    });
  }

  if (and.length === 0) {
    return undefined;
  }

  return {
    AND: and,
  };
}

async function fetchRuns(where?: Prisma.RunWhereInput, pagination?: Pick<RunPagination, "page" | "pageSize">) {
  const runs = await prisma.run.findMany({
    where,
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
    skip:
      pagination && pagination.page > 1
        ? (pagination.page - 1) * pagination.pageSize
        : undefined,
    take: pagination?.pageSize,
  });

  return runs.map(mapRun);
}

export async function listRuns(filters?: Partial<RunListFilters>) {
  return fetchRuns(buildRunWhere(filters));
}

export async function listRunsPage(filters: RunListFilters): Promise<RunsPage> {
  const where = buildRunWhere(filters);
  const total = await prisma.run.count({ where });
  const pagination = createPagination(total, filters.page, filters.pageSize);
  const data = await fetchRuns(where, pagination);

  return {
    data,
    pagination,
  };
}

export async function listRunFilterOptions() {
  const runs = await prisma.run.findMany({
    select: {
      workflow: true,
      environment: true,
    },
    orderBy: {
      workflow: "asc",
    },
  });

  return {
    workflows: Array.from(new Set(runs.map((run) => run.workflow))).sort(),
    environments: Array.from(new Set(runs.map((run) => run.environment as RunEnvironment))).sort(),
  };
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
  return buildDashboardSnapshotFromRuns(runs);
}

export async function clearRuns() {
  await prisma.$transaction([
    prisma.runAlert.deleteMany(),
    prisma.runStep.deleteMany(),
    prisma.run.deleteMany(),
  ]);
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
