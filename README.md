# citycalls-api

CityCalls backend — Node.js, Express, TypeScript, MongoDB (modular monolith). See the [citycalls-docs](../docs) repo for full architecture, API contracts, and workflow documentation — this repo implements against that spec but does not duplicate it.

## Setup

```bash
npm install
cp .env.example .env   # fill in secrets, set SEED_SUPER_ADMIN_PASSWORD
npm run build          # required once before `npm start` (compiles to dist/) — npm run dev doesn't need this
npm run dev            # starts on http://localhost:4000, requires MongoDB running
```

Requires a MongoDB instance reachable at `MONGODB_URI` (defaults to `mongodb://localhost:27017/citycalls` if unset). Local MongoDB + Redis via Docker (if Docker is installed):

```bash
docker compose up mongo redis
```

If port 4000 reports `EADDRINUSE`, an earlier `npm run dev`/`npm start` is likely still running in the background — find and stop it (`netstat -ano | grep :4000` on Windows) rather than starting a second instance, since the new instance won't be the one actually serving requests.

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

## Testing

`npm test` runs both mocked unit tests (`src/lib/*.test.ts`) and real (in-memory MongoDB, via `mongodb-memory-server`) integration tests (`test/integration/real-db-*.test.ts`). The real-DB tests exist because a class of bug (an Express 5 breaking change — `req.query` became getter-only) passed 57 mocked/401-path-only tests across 6 phases before being caught by manually running the server. New phases should add at least one real-DB test for their most complex flow, not just mocked/unauthenticated-path tests.

## Status

Phases 1-7 complete per `docs/manish/16-manifest-and-task-checklist.md`:

- **Phase 1** — Auth (login/refresh/logout/OTP/password-reset), sessions, Users, org hierarchy, masters/numbering/policy engines, full RBAC seed, audit logging.
- **Phase 2** — Customers (incl. addresses, duplicate detection, history), dynamic Service Catalog.
- **Phase 3** — Calls (6 types), Leads (full lifecycle), the generic status-transition engine.
- **Phase 4** — Service Requests (full 37-status lifecycle), Assignment Engine, working-hours-aware SLA, escalation job.
- **Phase 5** — ServiceVisit model, offline sync-batch endpoint (idempotent, per-action conflict handling), Files module (Cloudinary + local-fallback adapters), completion-OTP, location-ping.
- **Phase 6** — Estimate → Proforma Invoice → Invoice → Payment Receipt conversion chain, Credit/Debit notes, Vendor invoices/payouts. Server-side GST split (CGST/SGST vs IGST) computed from branch vs. customer state. Invoices are never edited post-payment (Credit/Debit Note only). PDF generation is a documented placeholder seam (no Puppeteer in this environment) — `pdfUrl` fields are populated with a deterministic stub path, not a real rendered file yet.
- **Phase 7** — Happy Calls (outcome recording closes the linked Service Request, retry-then-close-anyway after 2 unreachable attempts), the full ReopenRecord ledger (root-traced reopen count across multiple reopens of the same case, warranty applicability, auto-escalation at 3+ reopens), scheduled happy-call task generator.
- **Phase 8** — Notification trigger engine (`trigger(triggerKey, context)`, the single entry point every module calls — resolves recipient contact info, renders `{{variable}}` templates per channel, never throws), NotificationTemplate/Notification models, in-app notification center (list/unread-count/mark-read), Email (SMTP) and WhatsApp (AiSensy) adapters with enabled/disabled handling (`SKIPPED_INTEGRATION_DISABLED` status when a channel isn't configured, never a blocked workflow), Campaigns module (WhatsApp/Email marketing, consent-gated audience filtering, per-send stats). All 9 prior `sendPlaceholderNotification` call sites (service requests, estimates/invoices/proforma/payments, auth OTP/password-reset, happy calls, escalation job) now go through `trigger()`.
- **Phase 9** — AI Features: Gemini/OpenAI provider adapter (`lib/aiProvider.ts`), global `AiSettings` (provider/model, global + per-feature enable flags, daily request/token caps with per-role overrides), `ai_requests` audit log (every attempt is logged, including ones that never reached the provider), Call Summarization (`POST /ai/summarize-call`) and Complaint Classification (`POST /ai/classify-complaint`, falls back to active `SERVICE_CATEGORY` masters when no categories are supplied). Every AI feature returns a normal `{ aiAvailable, reason }` result rather than an error when AI is disabled, over its usage cap, or unconfigured — per docs/01 Business Rule #7, no workflow ever depends on AI succeeding.
- **Phase 10** — Reports and Export: `GET /reports/:reportKey` (service-request-summary, branch-performance, lead-funnel, revenue-summary, technician-performance, campaign-performance), each a real aggregation pipeline against live data rather than a pre-aggregated summary collection (deferred — no Redis/BullMQ in this environment, same documented-simplification pattern as the escalation job). Generic `GET /export/:entity?format=csv|xlsx` and `POST /import/:entity` (multipart) for customers/leads/serviceRequests/calls/invoices, driven by a registry (`src/modules/import-export/`) rather than per-entity endpoints. Import validates every row with the same Zod schema as that entity's create endpoint and returns `{successCount, failureCount, failures[]}`; supports `?dryRun=true` and `?mode=partial|strict`. **Security note**: the `xlsx` (SheetJS) package has two unpatched high-severity advisories (prototype pollution, ReDoS) in its file-*parsing* path, with no fix on npm — so export still supports `.xlsx` (we only ever *write* files from trusted internal data with it), but import is CSV-only, hand-parsed with no third-party dependency, since import is exactly "parse a file an arbitrary authenticated user uploaded." Revisit before a real deployment (Phase 11 security review) or if SheetJS ships a patched release.

Verified against a real local MongoDB instance (not just typecheck/lint/mocked-unit-tests) — see Testing section above. A real Express 5 bug (`req.query` getter-only, broke every query-validated list endpoint) was found and fixed this way; a real resilience gap (real-time emit throwing instead of degrading gracefully when Socket.IO isn't initialized) was also found and fixed. Next: Phase 11 (Testing and Deployment).

