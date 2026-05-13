#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromPackage = createRequire(import.meta.url);
const DATA_DIR = resolve(homedir(), ".agent-observability-lite");
const CONFIG_PATH = resolve(DATA_DIR, "config.json");
const DEFAULT_DATABASE_PATH = resolve(DATA_DIR, "dev.db");

const COMMANDS = new Set([
  "help",
  "setup",
  "config",
  "dev",
  "status",
  "open",
  "reset",
  "send-test-run",
  "run",
  "import",
  "export",
]);

function printHelp() {
  console.log(`Agent Observability Lite CLI

Usage:
  aol <command> [options]

Core:
  aol setup
  aol dev
  aol status [--json] [--base-url <url>]
  aol open [--base-url <url>]
  aol reset [--yes] [--json]
  aol send-test-run [--json]

Config:
  aol config get
  aol config set baseUrl <url>

Ingestion:
  aol run start --name <name> --workflow <workflow> --agent <agent> [--customer <name>] [--environment <env>] [--tag <tag>]
  aol run step --run-id <id> --label <label> --kind <kind> --status <status> --message <message> [--duration-ms <ms>]
  aol run alert --run-id <id> --severity <severity> --title <title> --detail <detail>
  aol run end --run-id <id> --status <status> [--summary <summary>]

Import/export:
  aol import <file.json>
  aol export runs [--file <file.json>]
  aol export run <run-id> [--file <file.json>]

Common values:
  status: healthy | degraded | failed | running
  kind: llm | tool | retry | guardrail | handoff
  step status: completed | warning | failed | running
  severity: critical | warning | info
  environment: production | staging | development`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const flag = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      flags[flag] = true;
      continue;
    }

    if (flags[flag] === undefined) {
      flags[flag] = next;
    } else if (Array.isArray(flags[flag])) {
      flags[flag].push(next);
    } else {
      flags[flag] = [flags[flag], next];
    }

    index += 1;
  }

  return { positional, flags };
}

function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || `file:${DEFAULT_DATABASE_PATH}`;
}

function getBaseUrl(flags = {}) {
  return (
    flags["base-url"] ||
    process.env.AOL_BASE_URL ||
    process.env.OBSERVABILITY_BASE_URL ||
    readConfig().baseUrl ||
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
}

function printResult(value, flags = {}) {
  if (flags.json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (typeof value === "string") {
    console.log(value);
    return;
  }

  console.log(JSON.stringify(value, null, 2));
}

function fail(message, code = 1) {
  console.error(`Error: ${message}`);
  process.exit(code);
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? PACKAGE_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: getDatabaseUrl(),
      ...(options.env ?? {}),
    },
    stdio: options.stdio ?? "inherit",
    shell: process.platform === "win32",
  });

  return child;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawnProcess(command, args, options);

    child.on("error", rejectProcess);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveProcess();
        return;
      }

      rejectProcess(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function resolveDependency(entrypoint) {
  return requireFromPackage.resolve(entrypoint);
}

function requireFlag(flags, key) {
  const value = flags[key];

  if (value === undefined || value === true || value === "") {
    fail(`Missing required option --${key}.`);
  }

  return value;
}

function optionalNumber(flags, key) {
  const value = flags[key];

  if (value === undefined || value === true) {
    return undefined;
  }

  const parsed = key.includes("cost") || key.includes("rate") ? Number.parseFloat(value) : Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    fail(`--${key} must be numeric.`);
  }

  return parsed;
}

function toArray(value) {
  if (value === undefined || value === true) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function request(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const detail = body.error ? `${body.error}` : text;
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${detail}`);
  }

  return body;
}

async function commandConfig(positional, flags) {
  const action = positional[1] ?? "get";
  const config = readConfig();

  if (action === "get") {
    printResult(config, flags);
    return;
  }

  if (action === "set") {
    const key = positional[2];
    const value = positional[3];

    if (!key || value === undefined) {
      fail("Usage: aol config set <key> <value>");
    }

    const nextConfig = {
      ...config,
      [key]: value,
    };
    writeConfig(nextConfig);
    printResult({ ok: true, path: CONFIG_PATH, config: nextConfig }, flags);
    return;
  }

  fail(`Unknown config action: ${action}`);
}

async function ensureDashboardDatabase() {
  mkdirSync(DATA_DIR, { recursive: true });

  await runProcess(
    process.execPath,
    [
      resolveDependency("prisma/build/index.js"),
      "generate",
      "--schema",
      resolve(PACKAGE_ROOT, "prisma/schema.prisma"),
    ],
    {
      stdio: "pipe",
    },
  );

  await runProcess(
    process.execPath,
    [
      resolveDependency("prisma/build/index.js"),
      "migrate",
      "deploy",
      "--schema",
      resolve(PACKAGE_ROOT, "prisma/schema.prisma"),
    ],
    {
      stdio: "pipe",
    },
  );
}

async function commandSetup(flags) {
  await ensureDashboardDatabase();
  printResult(
    {
      ok: true,
      databaseUrl: getDatabaseUrl(),
      configPath: CONFIG_PATH,
    },
    flags,
  );
}

async function commandDev(flags) {
  await ensureDashboardDatabase();

  const port = flags.port && flags.port !== true ? flags.port : "3000";
  const hostname = flags.hostname && flags.hostname !== true ? flags.hostname : "127.0.0.1";
  const baseUrl = `http://${hostname}:${port}`;
  writeConfig({
    ...readConfig(),
    baseUrl,
  });

  const child = spawnProcess(process.execPath, [
    resolveDependency("next/dist/bin/next"),
    "dev",
    "--webpack",
    "--hostname",
    hostname,
    "--port",
    port,
  ]);

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

async function commandStatus(flags) {
  const baseUrl = getBaseUrl(flags);
  const [metrics, runs] = await Promise.all([
    request(baseUrl, "/api/metrics"),
    request(baseUrl, "/api/runs?page=1&pageSize=5"),
  ]);

  const result = {
    ok: true,
    baseUrl,
    metrics: metrics.metrics,
    workflows: metrics.workflows.length,
    runs: {
      total: runs.pagination.total,
      pageCount: runs.pagination.pageCount,
      preview: runs.data.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        workflow: run.workflow,
      })),
    },
  };

  if (flags.json) {
    printResult(result, flags);
    return;
  }

  console.log(`Dashboard: ${baseUrl}`);
  console.log(`Status: reachable`);
  console.log(`Runs: ${runs.pagination.total}`);
  console.log(`Workflows: ${metrics.workflows.length}`);
  console.log(`Healthy completion: ${metrics.metrics.find((metric) => metric.label === "Healthy completion")?.value ?? "n/a"}`);
}

async function commandOpen(flags) {
  const baseUrl = getBaseUrl(flags);
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", baseUrl] : [baseUrl];

  spawn(opener, args, {
    detached: true,
    stdio: "ignore",
  }).unref();

  printResult(`Opened ${baseUrl}`, flags);
}

async function commandReset(flags) {
  if (!flags.yes && !flags.json) {
    fail("Reset clears all run data. Re-run with --yes to confirm.");
  }

  const baseUrl = getBaseUrl(flags);
  const result = await request(baseUrl, "/api/admin/reset", {
    method: "POST",
  });

  printResult({ ...result, baseUrl }, flags);
}

function testRunPayload() {
  const startedAt = new Date();

  return {
    name: "CLI integration smoke test",
    workflow: "CLI verification",
    agent: "aol-cli",
    environment: "development",
    customer: "Local",
    status: "running",
    startedAt: startedAt.toISOString(),
    tags: ["cli", "smoke-test"],
    steps: [
      {
        label: "Create smoke test run",
        kind: "tool",
        status: "completed",
        startedAt: new Date(startedAt.getTime() + 250).toISOString(),
        durationMs: 420,
        toolName: "aol.cli",
        message: "The CLI created this run through the public API.",
      },
    ],
  };
}

async function commandSendTestRun(flags) {
  const baseUrl = getBaseUrl(flags);
  const run = await request(baseUrl, "/api/runs", {
    method: "POST",
    body: JSON.stringify(testRunPayload()),
  });

  await request(baseUrl, `/api/runs/${run.id}/steps`, {
    method: "POST",
    body: JSON.stringify({
      steps: [
        {
          label: "Record retry evidence",
          kind: "retry",
          status: "completed",
          startedAt: new Date().toISOString(),
          durationMs: 760,
          toolName: "aol.cli",
          attempt: 2,
          message: "Recorded a controlled retry step to exercise diagnosis signals.",
        },
        {
          label: "Finalize smoke test",
          kind: "llm",
          status: "completed",
          startedAt: new Date().toISOString(),
          durationMs: 980,
          costUsd: 0.002,
          tokens: 480,
          model: "test-model",
          message: "Finalized the smoke test run.",
        },
      ],
    }),
  });

  await request(baseUrl, `/api/runs/${run.id}/alerts`, {
    method: "POST",
    body: JSON.stringify({
      alerts: [
        {
          severity: "info",
          title: "CLI smoke test",
          detail: "This run was generated by aol send-test-run.",
        },
      ],
    }),
  });

  const completed = await request(baseUrl, `/api/runs/${run.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "degraded",
      endedAt: new Date().toISOString(),
      retries: 1,
      successScore: 82,
      toolFailureRate: 0,
      summary: "CLI smoke test completed with retry evidence for dashboard verification.",
    }),
  });

  printResult(flags.json ? completed : `Created test run ${completed.id}`, flags);
}

async function commandRun(positional, flags) {
  const action = positional[1];
  const baseUrl = getBaseUrl(flags);

  if (action === "start") {
    const payload = {
      name: requireFlag(flags, "name"),
      workflow: requireFlag(flags, "workflow"),
      agent: requireFlag(flags, "agent"),
      environment: flags.environment && flags.environment !== true ? flags.environment : "development",
      customer: flags.customer && flags.customer !== true ? flags.customer : "Internal",
      status: flags.status && flags.status !== true ? flags.status : "running",
      startedAt: flags["started-at"] && flags["started-at"] !== true ? flags["started-at"] : new Date().toISOString(),
      tags: toArray(flags.tag),
      steps: [],
      alerts: [],
    };
    const run = await request(baseUrl, "/api/runs", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    printResult(flags.json ? run : `Started run ${run.id}`, flags);
    return;
  }

  if (action === "step") {
    const runId = requireFlag(flags, "run-id");
    const step = {
      label: requireFlag(flags, "label"),
      kind: requireFlag(flags, "kind"),
      status: requireFlag(flags, "status"),
      startedAt: flags["started-at"] && flags["started-at"] !== true ? flags["started-at"] : new Date().toISOString(),
      durationMs: optionalNumber(flags, "duration-ms") ?? 0,
      costUsd: optionalNumber(flags, "cost-usd"),
      tokens: optionalNumber(flags, "tokens"),
      message: requireFlag(flags, "message"),
      toolName: flags["tool-name"] && flags["tool-name"] !== true ? flags["tool-name"] : undefined,
      model: flags.model && flags.model !== true ? flags.model : undefined,
      attempt: optionalNumber(flags, "attempt"),
    };
    const run = await request(baseUrl, `/api/runs/${runId}/steps`, {
      method: "POST",
      body: JSON.stringify({ steps: [step] }),
    });

    printResult(flags.json ? run : `Appended step to run ${run.id}`, flags);
    return;
  }

  if (action === "alert") {
    const runId = requireFlag(flags, "run-id");
    const alert = {
      severity: requireFlag(flags, "severity"),
      title: requireFlag(flags, "title"),
      detail: requireFlag(flags, "detail"),
    };
    const run = await request(baseUrl, `/api/runs/${runId}/alerts`, {
      method: "POST",
      body: JSON.stringify({ alerts: [alert] }),
    });

    printResult(flags.json ? run : `Appended alert to run ${run.id}`, flags);
    return;
  }

  if (action === "end") {
    const runId = requireFlag(flags, "run-id");
    const payload = {
      status: requireFlag(flags, "status"),
      endedAt: flags["ended-at"] && flags["ended-at"] !== true ? flags["ended-at"] : new Date().toISOString(),
      durationMs: optionalNumber(flags, "duration-ms"),
      costUsd: optionalNumber(flags, "cost-usd"),
      tokens: optionalNumber(flags, "tokens"),
      retries: optionalNumber(flags, "retries"),
      successScore: optionalNumber(flags, "success-score"),
      toolFailureRate: optionalNumber(flags, "tool-failure-rate"),
      summary: flags.summary && flags.summary !== true ? flags.summary : undefined,
      tags: flags.tag ? toArray(flags.tag) : undefined,
    };
    const run = await request(baseUrl, `/api/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    printResult(flags.json ? run : `Closed run ${run.id} as ${run.status}`, flags);
    return;
  }

  fail("Usage: aol run <start|step|alert|end> [options]");
}

async function commandImport(positional, flags) {
  const file = positional[1] ?? flags.file;

  if (!file || file === true) {
    fail("Usage: aol import <file.json>");
  }

  const baseUrl = getBaseUrl(flags);
  const parsed = JSON.parse(readFileSync(resolve(file), "utf8"));
  const sourceRuns = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.runs)
      ? parsed.runs
      : Array.isArray(parsed.data)
        ? parsed.data
        : [parsed];
  const payloads = sourceRuns.map(toCreateRunPayload);
  const imported = [];

  for (const payload of payloads) {
    imported.push(
      await request(baseUrl, "/api/runs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  }

  printResult(flags.json ? imported : `Imported ${imported.length} run${imported.length === 1 ? "" : "s"}`, flags);
}

function toCreateRunPayload(run) {
  const payload = { ...run };
  const endedAt = payload.endedAt;
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];

  delete payload.id;
  delete payload.diagnosis;
  delete payload.signals;
  delete payload.endedAt;
  delete payload.steps;
  delete payload.alerts;

  const nextPayload = {
    ...payload,
    steps: steps.map((step) => {
      const nextStep = { ...step };
      delete nextStep.id;
      return nextStep;
    }),
    alerts: alerts.map((alert) => {
      const nextAlert = { ...alert };
      delete nextAlert.id;
      return nextAlert;
    }),
  };

  if (endedAt !== null && endedAt !== undefined) {
    nextPayload.endedAt = endedAt;
  }

  return nextPayload;
}

async function commandExport(positional, flags) {
  const target = positional[1];
  const baseUrl = getBaseUrl(flags);
  let result;

  if (target === "runs") {
    result = await request(baseUrl, "/api/runs?page=1&pageSize=50");
  } else if (target === "run") {
    const runId = positional[2] ?? flags["run-id"];

    if (!runId || runId === true) {
      fail("Usage: aol export run <run-id>");
    }

    result = await request(baseUrl, `/api/runs/${runId}`);
  } else {
    fail("Usage: aol export runs|run [options]");
  }

  if (flags.file && flags.file !== true) {
    writeFileSync(resolve(flags.file), `${JSON.stringify(result, null, 2)}\n`);
    printResult(`Wrote ${flags.file}`, flags);
    return;
  }

  printResult(result, { ...flags, json: true });
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0] ?? "help";

  if (!COMMANDS.has(command)) {
    fail(`Unknown command: ${command}. Run aol help.`);
  }

  try {
    if (command === "help") {
      printHelp();
    } else if (command === "setup") {
      await commandSetup(flags);
    } else if (command === "config") {
      await commandConfig(positional, flags);
    } else if (command === "dev") {
      await commandDev(flags);
    } else if (command === "status") {
      await commandStatus(flags);
    } else if (command === "open") {
      await commandOpen(flags);
    } else if (command === "reset") {
      await commandReset(flags);
    } else if (command === "send-test-run") {
      await commandSendTestRun(flags);
    } else if (command === "run") {
      await commandRun(positional, flags);
    } else if (command === "import") {
      await commandImport(positional, flags);
    } else if (command === "export") {
      await commandExport(positional, flags);
    }
  } catch (error) {
    fail(error.message);
  }
}

main();
