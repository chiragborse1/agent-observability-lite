type RunStatus = "healthy" | "degraded" | "failed" | "running";
type RunEnvironment = "production" | "staging" | "development";
type StepKind = "llm" | "tool" | "retry" | "guardrail" | "handoff";
type StepStatus = "completed" | "warning" | "failed" | "running";
type AlertSeverity = "critical" | "warning" | "info";

export type CreateRunPayload = {
  name: string;
  workflow: string;
  agent: string;
  environment: RunEnvironment;
  customer: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  costUsd?: number;
  tokens?: number;
  retries?: number;
  successScore?: number;
  toolFailureRate?: number;
  summary?: string;
  tags?: string[];
  steps?: Array<{
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
  }>;
  alerts?: Array<{
    severity: AlertSeverity;
    title: string;
    detail: string;
  }>;
};

export type UpdateRunPayload = Partial<
  Pick<
    CreateRunPayload,
    | "name"
    | "workflow"
    | "agent"
    | "environment"
    | "customer"
    | "status"
    | "startedAt"
    | "endedAt"
    | "durationMs"
    | "costUsd"
    | "tokens"
    | "retries"
    | "successScore"
    | "toolFailureRate"
    | "summary"
    | "tags"
  >
>;

type CreateRunResponse = {
  id: string;
};

export class ObservabilityClient {
  constructor(private readonly baseUrl: string) {}

  async createRun(payload: CreateRunPayload) {
    return this.request<CreateRunResponse>("/api/runs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async appendSteps(
    runId: string,
    payload: {
      steps: CreateRunPayload["steps"];
    },
  ) {
    return this.request(`/api/runs/${runId}/steps`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async appendAlerts(
    runId: string,
    payload: {
      alerts: CreateRunPayload["alerts"];
    },
  ) {
    return this.request(`/api/runs/${runId}/alerts`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateRun(runId: string, payload: UpdateRunPayload) {
    return this.request(`/api/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Request failed (${response.status}): ${body}`);
    }

    return (await response.json()) as T;
  }
}
