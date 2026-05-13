# Agent Observability Lite

Local-first reliability debugger for AI agents.

This project records agent runs, stores their steps and alerts in SQLite, and gives you a simple dashboard to inspect failures, retries, latency, spend, trace history, and likely causes.

It is built as a practical MVP:

- database-backed, not hardcoded
- simple dashboard, not a design-heavy mockup
- API-first ingestion model
- easy to connect to any agent that can send HTTP requests

## What this project is

An "agent" here means any AI workflow that does work in steps. For example:

- a coding agent
- a research agent
- a support automation agent
- a sales enrichment workflow
- a custom OpenAI or LangGraph application

This app does not automatically discover those agents.

Instead, the agent sends events to this app:

1. create a run
2. append steps as work happens
3. append alerts if something looks wrong
4. update the run when it finishes

The dashboard then reads that stored data back from SQLite and shows the full run history.

## Current MVP

- SQLite-backed run storage with Prisma
- Simple dashboard with run explorer, metrics, diagnosis, alerts, and trace timeline
- Local CLI for setup checks, ingestion, import/export, reset, and smoke test runs
- Reset command for clearing local run data
- Read and write API routes for runs, steps, alerts, and metrics

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma
- SQLite
- Lucide React

## Features

- Run list with status filters
- Server-side search, workflow filtering, environment filtering, date filtering, and pagination
- Run detail view with trace timeline
- Per-run diagnosis with likely cause, risk signals, and next action guidance
- Alert panel for per-run issues
- Metrics summary for run count, reliability, spend, and average latency
- Workflow snapshot grouped by workflow name
- API routes for ingestion and inspection
- CLI commands for shell scripts, CI jobs, and manual integration testing

## Quick start

```bash
pnpm install
pnpm db:migrate
pnpm test
pnpm dev
```

Open `http://localhost:3000`.

In another terminal, verify the dashboard and create a real test run:

```bash
pnpm aol status
pnpm aol send-test-run
```

If you want to clear local run data:

```bash
pnpm aol reset --yes
```

## How it works

The dashboard does not discover agents automatically.

An agent connects by sending HTTP requests to this app:

1. `POST /api/runs` when a task starts
2. `POST /api/runs/:id/steps` as the agent performs tool calls or model calls
3. `POST /api/runs/:id/alerts` when something needs attention
4. `PATCH /api/runs/:id` when the run finishes or changes status

The app saves those events in SQLite, and the dashboard reads them back. It then derives simple reliability signals from the run, such as repeated tool instability, schema drift hints, long latency, or spend without outcome.

## CLI

The CLI is the easiest way to use the project from a terminal, shell script, or CI job.

Run it locally with:

```bash
pnpm aol <command>
```

Available commands:

```bash
pnpm aol dev
pnpm aol status
pnpm aol open
pnpm aol reset --yes
pnpm aol send-test-run
```

Configure a dashboard URL:

```bash
pnpm aol config set baseUrl http://127.0.0.1:3000
pnpm aol config get
```

Start and finish a run from the terminal:

```bash
pnpm aol run start \
  --name "Checkout fallback investigation" \
  --workflow "Payments ops" \
  --agent "checkout-watcher" \
  --environment staging \
  --customer Internal \
  --tag payments \
  --json
```

Append a step:

```bash
pnpm aol run step \
  --run-id <run-id> \
  --label "Inspect payment attempt" \
  --kind tool \
  --status completed \
  --duration-ms 620 \
  --tool-name payments.fetch_attempt \
  --message "Loaded the latest payment attempt payload."
```

Append an alert:

```bash
pnpm aol run alert \
  --run-id <run-id> \
  --severity warning \
  --title "Retry cluster detected" \
  --detail "Payment lookup retried twice."
```

Close a run:

```bash
pnpm aol run end \
  --run-id <run-id> \
  --status degraded \
  --retries 2 \
  --success-score 74 \
  --tool-failure-rate 0.25 \
  --summary "Recovered after retries but exceeded the latency target."
```

Import and export run data:

```bash
pnpm aol import trace.json
pnpm aol export runs --file runs.json
pnpm aol export run <run-id> --file run.json
```

Use `--json` on status and write commands when scripting.

## API routes

- `GET /api/metrics`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/:id`
- `PATCH /api/runs/:id`
- `POST /api/runs/:id/steps`
- `POST /api/runs/:id/alerts`
- `POST /api/admin/reset`

## Example payloads

Create a run:

```json
{
  "name": "Checkout fallback investigation",
  "workflow": "Payments ops",
  "agent": "checkout-watcher",
  "environment": "staging",
  "customer": "Internal",
  "status": "running",
  "startedAt": "2026-05-13T09:20:00Z",
  "tags": ["payments", "qa"],
  "steps": [
    {
      "label": "Inspect payment attempt",
      "kind": "tool",
      "status": "completed",
      "startedAt": "2026-05-13T09:20:01Z",
      "durationMs": 620,
      "toolName": "payments.fetch_attempt",
      "message": "Loaded the latest payment attempt payload."
    }
  ]
}
```

Append steps:

```json
{
  "steps": [
    {
      "label": "Draft remediation summary",
      "kind": "llm",
      "status": "completed",
      "startedAt": "2026-05-13T09:20:03Z",
      "durationMs": 1380,
      "costUsd": 0.013,
      "tokens": 1580,
      "model": "gpt-4.1-mini",
      "message": "Prepared the next action summary for the checkout team."
    }
  ]
}
```

Append alerts:

```json
{
  "alerts": [
    {
      "severity": "warning",
      "title": "Coverage gap detected",
      "detail": "The latest source revision has not been fully reflected in the published article."
    }
  ]
}
```

## Repository files

- `src/app` - app routes and API routes
- `src/components` - dashboard UI
- `src/lib` - data layer, Prisma client, validation
- `bin/aol.mjs` - local CLI
- `prisma` - schema, migrations, seed

## Verification status

Current repo verification:

- `pnpm test` passes
- `pnpm lint` passes
- `pnpm build` passes
- `pnpm cli:check` passes
- API read/write flow was manually exercised locally

Coverage is still focused on core helpers and dashboard aggregation. Full API integration coverage is still pending.

## Roadmap

- Support OpenAI Agents SDK and custom JSON trace adapters
- Add anomaly detection rules and saved alert policies
- Add API integration tests and background ingestion hardening
- Add auth and multi-user separation only if this moves beyond a local tool

## License

This project is released under the [MIT License](./LICENSE).
