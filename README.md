# citycalls-api

CityCalls backend — Node.js, Express, TypeScript, MongoDB (modular monolith). See the [citycalls-docs](../docs) repo for full architecture, API contracts, and workflow documentation — this repo implements against that spec but does not duplicate it.

## Setup

```bash
npm install
cp .env.example .env   # fill in secrets, set SEED_SUPER_ADMIN_PASSWORD
npm run dev            # starts on http://localhost:4000, requires MongoDB running
```

Local MongoDB + Redis via Docker (if Docker is installed):

```bash
docker compose up mongo redis
```

## Seeding

Creates the first Super Admin user and a starter role-permission set:

```bash
npm run seed
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with hot-reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Run Jest test suite |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |
| `npm run seed` | Seed initial data |

## Structure

See `src/modules/` for one folder per domain module (`docs/manish/02-backend-folder-structure.md`). Cross-module calls go through a module's `.service.ts` exports only, never its `.model.ts` directly.

## Status

Phase 1 in progress: auth (login/refresh/logout), organization hierarchy (branches/sub-branches/teams), masters engine, numbering engine, policy resolver, and audit logging are scaffolded. Remaining Phase 1 work and all later phases per `docs/manish/16-manifest-and-task-checklist.md`.
