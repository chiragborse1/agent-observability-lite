# Contributing

Thanks for contributing.

## Before you start

- Open an issue or start a discussion for non-trivial changes.
- Keep changes scoped to the problem you are solving.
- Avoid unrelated refactors in the same pull request.

## Local setup

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`.

## Useful commands

```bash
pnpm lint
pnpm build
pnpm db:seed
pnpm agent:demo
```

## Contribution guidelines

- Prefer small, reviewable pull requests.
- Preserve the current product direction: simple UI, practical debugging value, minimal noise.
- Keep API changes documented in `README.md`.
- If you change the Prisma schema, include the migration files.
- If you add a new agent integration path, include a runnable example or fixture.

## Pull request checklist

- The app starts locally.
- `pnpm lint` passes.
- `pnpm build` passes.
- Documentation is updated when behavior or setup changes.
- New environment variables are added to `.env.example`.

## Style notes

- Use the existing TypeScript and Next.js patterns in the repo.
- Keep UI changes utilitarian. This project is a developer tool, not a marketing site.
- Prefer explicit names over clever abstractions.
