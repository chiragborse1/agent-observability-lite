export type RunDiagnosisSeverity = "critical" | "warning" | "info";

export type RunDiagnosisSignal = {
  id: string;
  severity: RunDiagnosisSeverity;
  title: string;
  detail: string;
};

export type RunDiagnosis = {
  headline: string;
  likelyCause: string;
  nextAction: string;
};

type DiagnosisStep = {
  id: string;
  kind: "llm" | "tool" | "retry" | "guardrail" | "handoff";
  status: "completed" | "warning" | "failed" | "running";
  durationMs: number;
  message: string;
  toolName?: string;
  attempt?: number;
};

type DiagnosisAlert = {
  severity: RunDiagnosisSeverity;
  title: string;
  detail: string;
};

type DiagnosisRun = {
  status: "healthy" | "degraded" | "failed" | "running";
  durationMs: number;
  costUsd: number;
  retries: number;
  successScore: number;
  toolFailureRate: number;
  summary: string;
  steps: DiagnosisStep[];
  alerts: DiagnosisAlert[];
};

type ToolIssue = {
  toolName: string;
  unstableSteps: number;
  failedSteps: number;
  warningSteps: number;
  highestAttempt: number;
  messages: string[];
};

const schemaMismatchPattern = /\b(schema|payload|shape|parser|parse|field mismatch)\b/i;
const budgetPattern = /\b(cost|budget|guardrail|spend)\b/i;
const retryPattern = /\b(retr(?:y|ies|ied)|backoff|fallback|timeout)\b/i;

function summarizeToolIssues(steps: DiagnosisStep[]) {
  const issues = new Map<string, ToolIssue>();

  for (const step of steps) {
    if (
      !(step.kind === "tool" || step.kind === "retry") ||
      !(step.status === "warning" || step.status === "failed")
    ) {
      continue;
    }

    const toolName = step.toolName ?? "unknown tool";
    const current = issues.get(toolName) ?? {
      toolName,
      unstableSteps: 0,
      failedSteps: 0,
      warningSteps: 0,
      highestAttempt: 1,
      messages: [],
    };

    current.unstableSteps += 1;
    current.failedSteps += step.status === "failed" ? 1 : 0;
    current.warningSteps += step.status === "warning" ? 1 : 0;
    current.highestAttempt = Math.max(current.highestAttempt, step.attempt ?? 1);
    current.messages.push(step.message);
    issues.set(toolName, current);
  }

  return Array.from(issues.values()).sort(
    (left, right) =>
      right.failedSteps - left.failedSteps ||
      right.unstableSteps - left.unstableSteps ||
      right.highestAttempt - left.highestAttempt,
  );
}

function buildSignals(run: DiagnosisRun, toolIssue?: ToolIssue) {
  const signals: RunDiagnosisSignal[] = [];
  const combinedAlertText = run.alerts
    .map((alert) => `${alert.title} ${alert.detail}`)
    .join(" ");
  const combinedToolText = toolIssue?.messages.join(" ") ?? "";
  const schemaMismatch = schemaMismatchPattern.test(
    `${combinedAlertText} ${combinedToolText}`,
  );
  const budgetRisk = budgetPattern.test(combinedAlertText);
  const retryMentions = retryPattern.test(combinedAlertText);
  const retrySteps = run.steps.filter((step) => step.kind === "retry");
  const hasRetrySteps = retrySteps.length > 0;
  const retryAttemptCount = retrySteps.reduce(
    (maxAttempt, step) => Math.max(maxAttempt, step.attempt ?? 1),
    0,
  );

  if (toolIssue) {
    signals.push({
      id: `tool:${toolIssue.toolName}`,
      severity:
        run.status === "failed" || toolIssue.failedSteps > 0 ? "critical" : "warning",
      title: `Repeated instability on ${toolIssue.toolName}`,
      detail: `${toolIssue.unstableSteps} unstable step${toolIssue.unstableSteps === 1 ? "" : "s"} across up to attempt ${toolIssue.highestAttempt}.`,
    });
  }

  if (schemaMismatch) {
    signals.push({
      id: "signal:schema-mismatch",
      severity: "critical",
      title: "Tool response contract drift",
      detail: "At least one failed step or alert points to a schema or payload mismatch.",
    });
  }

  if (run.toolFailureRate >= 0.3) {
    signals.push({
      id: "signal:tool-failure-rate",
      severity: run.toolFailureRate >= 0.5 ? "critical" : "warning",
      title: "Tool failure rate is elevated",
      detail: `${Math.round(run.toolFailureRate * 100)}% of tool-facing steps ended in warning or failure.`,
    });
  }

  if (run.durationMs >= 10000) {
    signals.push({
      id: "signal:latency",
      severity: run.status === "failed" ? "warning" : "info",
      title: "Run crossed the 10s latency mark",
      detail: "This run is already slow enough to affect user-facing workflows.",
    });
  }

  if (run.status === "failed" && run.costUsd > 0) {
    signals.push({
      id: "signal:cost-without-outcome",
      severity: "warning",
      title: "Spend accumulated without a useful outcome",
      detail: `The run consumed $${run.costUsd.toFixed(3)} before ending in failure.`,
    });
  }

  if (run.status === "running" && run.retries > 0) {
    signals.push({
      id: "signal:running-after-retries",
      severity: "warning",
      title: "Run is still active after retries",
      detail: "Recovery logic fired, but the run has not closed yet.",
    });
  }

  if (run.retries > 0 || retryMentions || hasRetrySteps) {
    const traceRetryCount = Math.max(retryAttemptCount > 0 ? retryAttemptCount - 1 : 0, retrySteps.length);

    signals.push({
      id: "signal:retries-observed",
      severity: run.status === "failed" ? "critical" : "warning",
      title: "Retry activity affected this run",
      detail:
        run.retries > 0
          ? `${run.retries} retry event${run.retries === 1 ? " was" : "s were"} reported at the run level.`
          : `${traceRetryCount} retry step${traceRetryCount === 1 ? "" : "s"} appeared in the trace.`,
    });
  }

  if (run.retries > 0 && !hasRetrySteps) {
    signals.push({
      id: "signal:retry-trace-gap",
      severity: "info",
      title: "Retry count was reported without retry spans",
      detail: "The summary says retries happened, but the trace does not show retry steps yet.",
    });
  }

  if (budgetRisk) {
    signals.push({
      id: "signal:budget-risk",
      severity: "warning",
      title: "Budget or cost guardrail mentioned",
      detail: "An alert indicates the run is close to or beyond its expected spend envelope.",
    });
  }

  const deduped = new Map<string, RunDiagnosisSignal>();

  for (const signal of signals) {
    deduped.set(signal.id, signal);
  }

  return Array.from(deduped.values());
}

function buildFailedDiagnosis(run: DiagnosisRun, toolIssue: ToolIssue | undefined, schemaMismatch: boolean): RunDiagnosis {
  if (toolIssue && schemaMismatch) {
    return {
      headline: "Connector contract broke the run",
      likelyCause: `The ${toolIssue.toolName} path kept returning data the agent could not parse, so retries repeated the same failure.`,
      nextAction: "Inspect the upstream payload shape, update the parser or schema validation, and stop retrying identical bad responses.",
    };
  }

  if (toolIssue) {
    return {
      headline: "A tool dependency never recovered",
      likelyCause: `${toolIssue.toolName} stayed unstable across ${toolIssue.unstableSteps} step${toolIssue.unstableSteps === 1 ? "" : "s"}, so the run never reached a usable outcome.`,
      nextAction: "Check the failing tool response, tighten the fallback path, and add a circuit breaker before another retry cluster forms.",
    };
  }

  return {
    headline: "The run failed before it could close cleanly",
    likelyCause: run.summary,
    nextAction: "Inspect the final failing step and confirm the run can produce an output artifact before it spends more budget.",
  };
}

function buildDegradedDiagnosis(run: DiagnosisRun, toolIssue: ToolIssue | undefined): RunDiagnosis {
  if (toolIssue) {
    return {
      headline: "The run recovered, but a dependency dragged it down",
      likelyCause: `${toolIssue.toolName} introduced retries or warnings that increased latency and pushed the run into a degraded state.`,
      nextAction: "Review the unstable dependency, reduce retry depth, and decide whether this workflow should fail fast instead of limping through.",
    };
  }

  if (run.retries > 0) {
    return {
      headline: "The run recovered after retry debt",
      likelyCause: `The workflow eventually completed, but ${run.retries} reported retr${run.retries === 1 ? "y" : "ies"} pushed it out of a clean healthy state.`,
      nextAction: "Emit retry spans for each recovery attempt and decide whether repeated retries should downgrade or fail the workflow sooner.",
    };
  }

  return {
    headline: "The run completed with reliability debt",
    likelyCause: run.summary,
    nextAction: "Review the warnings on this run and decide whether the workflow needs stronger guardrails or a manual checkpoint.",
  };
}

function buildRunningDiagnosis(run: DiagnosisRun, toolIssue: ToolIssue | undefined): RunDiagnosis {
  const activeStep = [...run.steps].reverse().find((step) => step.status === "running");
  const latestStep = run.steps[run.steps.length - 1];
  const stepForMessage = activeStep ?? latestStep;

  if (toolIssue) {
    return {
      headline: "The run is still open after instability",
      likelyCause: `${toolIssue.toolName} already triggered retries or warnings, and the workflow has not stabilized yet.`,
      nextAction: "Set a timeout or budget guardrail for the active workflow and inspect whether the tool fallback is actually reducing failure risk.",
    };
  }

  if (stepForMessage?.kind === "llm") {
    return {
      headline: "The run is waiting on a model step",
      likelyCause: "The latest recorded activity is an LLM step, so the workflow is currently blocked on model completion or the next orchestration action.",
      nextAction: "Confirm the run has a per-step timeout and emit a new span when the model response or follow-up tool call lands.",
    };
  }

  return {
    headline: "The run is still in flight",
    likelyCause: run.summary,
    nextAction: "Keep streaming spans into the run and close it explicitly once the workflow reaches a real terminal state.",
  };
}

function buildHealthyDiagnosis(run: DiagnosisRun, toolIssue: ToolIssue | undefined): RunDiagnosis {
  if (toolIssue || run.retries > 0) {
    return {
      headline: "The run recovered cleanly",
      likelyCause: "A transient tool issue appeared during execution, but the workflow still completed successfully.",
      nextAction: "Track whether this pattern repeats. If it does, fix the underlying dependency before it starts pushing runs into degraded territory, and keep retry attempts visible in the trace.",
    };
  }

  return {
    headline: "No active reliability issue detected",
    likelyCause: "This run completed without warnings, retries, or failed tool spans.",
    nextAction: "Use this trace as the baseline when you compare slower or degraded runs from the same workflow.",
  };
}

export function buildRunDiagnostics(run: DiagnosisRun) {
  const toolIssue = summarizeToolIssues(run.steps)[0];
  const combinedAlertText = run.alerts
    .map((alert) => `${alert.title} ${alert.detail}`)
    .join(" ");
  const combinedToolText = toolIssue?.messages.join(" ") ?? "";
  const schemaMismatch = schemaMismatchPattern.test(
    `${combinedAlertText} ${combinedToolText}`,
  );

  const diagnosis =
    run.status === "failed"
      ? buildFailedDiagnosis(run, toolIssue, schemaMismatch)
      : run.status === "degraded"
        ? buildDegradedDiagnosis(run, toolIssue)
        : run.status === "running"
          ? buildRunningDiagnosis(run, toolIssue)
          : buildHealthyDiagnosis(run, toolIssue);

  return {
    diagnosis,
    signals: buildSignals(run, toolIssue),
  };
}
