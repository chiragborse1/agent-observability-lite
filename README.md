# Agent Observability Lite

Local-first observability and reliability console for AI agents. This MVP stores runs in SQLite, renders a simple dashboard for run debugging, and exposes API routes for ingesting runs, steps, and alerts.

## Current MVP

- SQLite-backed run storage with Prisma
- Simple dashboard with run explorer, metrics, alerts, and trace timeline
- Seed command for local demo data
- Read and write API routes for runs, steps, alerts, and metrics

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma
- SQLite
- Lucide React

## Run locally

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

## How it works

The dashboard does not discover agents automatically.

An agent connects by sending HTTP requests to this app:

1. `POST /api/runs` when a task starts
2. `POST /api/runs/:id/steps` as the agent performs tool calls or model calls
3. `POST /api/runs/:id/alerts` when something needs attention
4. `PATCH /api/runs/:id` when the run finishes or changes status

The app saves those events in SQLite, and the dashboard reads them back.

## Demo agent

You can generate a real run from a sample agent script:

```bash
pnpm agent:demo
```

The script sends a staged run into the local API so you can watch a new run appear in the dashboard. By default it posts to `http://127.0.0.1:3000`, but you can override that with `OBSERVABILITY_BASE_URL`.

## API routes

- `GET /api/metrics`
- `GET /api/runs`
- `POST /api/runs`
- `GET /api/runs/:id`
- `PATCH /api/runs/:id`
- `POST /api/runs/:id/steps`
- `POST /api/runs/:id/alerts`

## Example write payload

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

## Next useful steps

- Add pagination and time-window filters
- Support OpenAI Agents SDK and custom JSON trace adapters
- Add anomaly detection rules and saved alert policies
- Add auth and multi-user separation only if this moves beyond a local tool
