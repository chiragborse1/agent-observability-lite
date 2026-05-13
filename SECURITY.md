# Security Policy

## Supported versions

This project is currently maintained on the `main` branch only.

## Reporting a vulnerability

Please do not open public issues for suspected security vulnerabilities.

Report them privately to the maintainer first. Include:

- a clear description of the issue
- affected files or routes
- reproduction steps
- impact assessment
- any suggested fix, if you have one

You should receive an acknowledgement within a reasonable time, and validated issues will be fixed privately before public disclosure when possible.

## Scope

The highest priority issues are:

- authentication and authorization flaws
- unsafe data exposure
- command execution risks
- secrets handling mistakes
- request validation bypasses
- dependency vulnerabilities with real exploitability in this app

At the moment this project is a local-first MVP, but security issues in API input handling, storage, and future integrations still matter.

## Local-first API note

The current API includes local development write paths, including `POST /api/admin/reset`, which clears run data. Do not expose this dashboard directly on a public network without adding authentication and access controls first.
