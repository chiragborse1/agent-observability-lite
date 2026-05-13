import { z } from "zod";

export const runStatusValues = ["healthy", "degraded", "failed", "running"] as const;
export const stepKindValues = ["llm", "tool", "retry", "guardrail", "handoff"] as const;
export const stepStatusValues = ["completed", "warning", "failed", "running"] as const;
export const alertSeverityValues = ["critical", "warning", "info"] as const;
export const environmentValues = ["production", "staging", "development"] as const;

export const runStatusSchema = z.enum(runStatusValues);
export const stepKindSchema = z.enum(stepKindValues);
export const stepStatusSchema = z.enum(stepStatusValues);
export const alertSeveritySchema = z.enum(alertSeverityValues);
export const environmentSchema = z.enum(environmentValues);

export const runStepInputSchema = z.object({
  label: z.string().min(1),
  kind: stepKindSchema,
  status: stepStatusSchema,
  startedAt: z.coerce.date(),
  durationMs: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative().optional(),
  tokens: z.number().int().nonnegative().optional(),
  message: z.string().min(1),
  toolName: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  attempt: z.number().int().positive().optional(),
});

export const runAlertInputSchema = z.object({
  severity: alertSeveritySchema,
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const createRunSchema = z.object({
  name: z.string().min(1),
  workflow: z.string().min(1),
  agent: z.string().min(1),
  environment: environmentSchema,
  customer: z.string().min(1),
  status: runStatusSchema.default("running"),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  tokens: z.number().int().nonnegative().optional(),
  retries: z.number().int().nonnegative().optional(),
  successScore: z.number().int().min(0).max(100).optional(),
  toolFailureRate: z.number().min(0).max(1).optional(),
  summary: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  steps: z.array(runStepInputSchema).default([]),
  alerts: z.array(runAlertInputSchema).default([]),
});

export const updateRunSchema = z
  .object({
    name: z.string().min(1).optional(),
    workflow: z.string().min(1).optional(),
    agent: z.string().min(1).optional(),
    environment: environmentSchema.optional(),
    customer: z.string().min(1).optional(),
    status: runStatusSchema.optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().nullable().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
    tokens: z.number().int().nonnegative().optional(),
    retries: z.number().int().nonnegative().optional(),
    successScore: z.number().int().min(0).max(100).optional(),
    toolFailureRate: z.number().min(0).max(1).optional(),
    summary: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const appendStepsSchema = z.object({
  steps: z.array(runStepInputSchema).min(1),
});

export const appendAlertsSchema = z.object({
  alerts: z.array(runAlertInputSchema).min(1),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;
export type UpdateRunInput = z.infer<typeof updateRunSchema>;
export type AppendStepsInput = z.infer<typeof appendStepsSchema>;
export type AppendAlertsInput = z.infer<typeof appendAlertsSchema>;
