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

Phases 1-5 complete per `docs/manish/16-manifest-and-task-checklist.md`:

- **Phase 1** — Auth (login/refresh/logout/OTP/password-reset), sessions, Users, org hierarchy, masters/numbering/policy engines, full RBAC seed, audit logging.
- **Phase 2** — Customers (incl. addresses, duplicate detection, history), dynamic Service Catalog.
- **Phase 3** — Calls (6 types), Leads (full lifecycle), the generic status-transition engine.
- **Phase 4** — Service Requests (full 37-status lifecycle), Assignment Engine, working-hours-aware SLA, escalation job.
- **Phase 5** — ServiceVisit model, offline sync-batch endpoint (idempotent, per-action conflict handling), Files module (Cloudinary + local-fallback adapters), completion-OTP, location-ping.
- **Phase 6** — Estimate → Proforma Invoice → Invoice → Payment Receipt conversion chain, Credit/Debit notes, Vendor invoices/payouts. Server-side GST split (CGST/SGST vs IGST) computed from branch vs. customer state. Invoices are never edited post-payment (Credit/Debit Note only). PDF generation is a documented placeholder seam (no Puppeteer in this environment) — `pdfUrl` fields are populated with a deterministic stub path, not a real rendered file yet.

Not yet run against a live MongoDB in this environment (Docker unavailable) — verification so far is typecheck/lint/unit-test level. Next: Phase 7 (Follow-up and Happy Calls).

