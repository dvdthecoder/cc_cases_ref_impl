# Cases API — Reference Implementation

A canonical **Cases / Support Ticket API** modelled on the best-of-breed intersection of five major support platforms. Ships with a live SSE event bus, a transformer pipeline that produces the native API payload for each platform, and a React UI for interactive testing.

Built to be adapted — the storage backend, the transport layer, and the platform targets are all independently replaceable.

---

## What this demonstrates

| Capability | Implementation |
|---|---|
| Canonical case model | 5-tier priority, 6-state lifecycle, unified field set covering all 5 target platforms |
| Event-driven architecture | Every state change emits a typed `case.*` event — persisted to DB, broadcast via SSE |
| Live event stream | SSE endpoint — UI LiveFeed panel shows events as they happen |
| Platform transforms | Pure functions produce the exact API payload for AWS / Salesforce / Zendesk / HubSpot / Oracle |
| Lossy-mapping transparency | Each transformer returns `notes[]` flagging where canonical data was approximated |
| Full-text search | SQLite FTS5 with Porter stemming — prefix matching across subject, description, contact, tags |
| Multi-tenancy | All data scoped to `orgId` + `tenantId` from request headers |
| Security hardening | Helmet headers, rate limiting, field-size caps, parameterized SQL, 0 CVEs |

---

## Quick start

```bash
# 1. Install
npm install && npm install --prefix ui

# 2. Start API (port 3000, hot-reload)
npm run dev

# 3. Start UI (port 5173) — in a second terminal
npm run dev:ui

# 4. Load 5 demo cases with comments and lifecycle events
npm run seed

# 5. Open http://localhost:5173
```

The SQLite database (`cases.db`) is created automatically on first run. Delete it to reset.

---

## Testing via the UI

Open `http://localhost:5173` after seeding. The layout has three areas:

**Cases list (left/main)** — filterable by status, priority, type, issue type. Use the search box for full-text search across subjects, descriptions, and contact details. Click any row to open the case.

**Case detail** — four tabs:
- **Details** — all fields, resolution, contact info, custom fields
- **Comments** — add comments; each fires a `case.comment_added` event
- **Events** — full audit timeline for the case (auto-refreshes every 3 s)
- **Export** — click AWS / Salesforce / Zendesk / HubSpot / Oracle to see the exact API payload this case generates. "Simulate Push" records a `case.exported` event without making real HTTP calls.

**Live Feed (right sidebar)** — real-time SSE stream. Every action you take in the UI (create, escalate, resolve, export, comment) appears here within milliseconds.

---

## Testing via the CLI

```bash
# Export a single case to one platform
npm run export -- --id CASE-000001 --to salesforce

# Export to all 5 platforms at once
npm run export -- --id CASE-000001 --to all

# Also accepts raw UUIDs
npm run export -- --id <uuid> --to zendesk
```

Output includes the endpoint, headers, JSON payload, and mapping notes.

---

## Testing via the API directly

```bash
BASE=http://localhost:3000/api/v1
ORG="-H 'x-org-id: demo-org' -H 'x-tenant-id: demo-tenant'"

# Create a case
curl -s -X POST $BASE/cases \
  -H 'Content-Type: application/json' \
  -H 'x-org-id: demo-org' \
  -d '{
    "subject": "Payment gateway timeout in checkout",
    "description": "Customers are seeing 504 errors on the /checkout endpoint since 14:00 UTC.",
    "priority": "urgent",
    "type": "incident",
    "issueType": "post_sales",
    "channel": "api",
    "contactEmail": "ops@example.com",
    "tags": ["checkout", "payments", "production"]
  }' | jq .

# List cases with filters
curl -s "$BASE/cases?status=open&priority=urgent" -H 'x-org-id: demo-org' | jq .

# Full-text search
curl -s "$BASE/cases?search=billing+portal" -H 'x-org-id: demo-org' | jq .

# Escalate
curl -s -X POST $BASE/cases/CASE-000001/escalate \
  -H 'Content-Type: application/json' -H 'x-org-id: demo-org' -d '{}' | jq .

# Resolve
curl -s -X POST $BASE/cases/CASE-000001/resolve \
  -H 'Content-Type: application/json' -H 'x-org-id: demo-org' \
  -d '{"resolution": "Root cause identified and patched."}' | jq .

# See the event log for a case
curl -s $BASE/cases/CASE-000001/events -H 'x-org-id: demo-org' | jq .

# Preview platform payload (no side effects)
curl -s -X POST $BASE/cases/CASE-000001/export/salesforce \
  -H 'Content-Type: application/json' -H 'x-org-id: demo-org' -d '{}' | jq .

# All 5 platforms at once
curl -s -X POST $BASE/cases/CASE-000001/export \
  -H 'Content-Type: application/json' -H 'x-org-id: demo-org' -d '{}' | jq .

# Live event stream (SSE — stays open)
curl -s -N -H 'x-org-id: demo-org' $BASE/events/stream
```

---

## Canonical Case Model

### Status lifecycle

```
new → open → pending → on_hold → resolved → closed
               ↑                      ↓
               └──────── reopen ──────┘
```

Derived from Zendesk's lifecycle (the most complete). `on_hold` is agent-internal; `closed` is terminal.

### Priority (5 tiers) — platform mapping

| Canonical | AWS severity | Salesforce | Zendesk | HubSpot | Oracle severity |
|---|---|---|---|---|---|
| `low` | low | Low | low | LOW | Low |
| `normal` | normal | Low | normal | LOW | Normal |
| `high` | high | High | high | MEDIUM | High |
| `urgent` | urgent | High | urgent | HIGH | High ¹ |
| `critical` | critical | High | urgent | HIGH | Critical |

¹ Oracle has no Urgent tier — flagged in transformer notes.

### Type — platform mapping

| Canonical | AWS issueType | Salesforce | Zendesk | HubSpot | Oracle |
|---|---|---|---|---|---|
| `question` | customer-service | Question | question | GENERAL_INQUIRY | threads[entryType=1] |
| `problem` | technical | Problem | problem | PRODUCT_ISSUE | threads[entryType=1] |
| `incident` | technical | Problem | incident | PRODUCT_ISSUE | threads[entryType=1] |
| `feature_request` | customer-service | Feature Request | question | FEATURE_REQUEST | threads[entryType=1] |
| `task` | customer-service | User | task | GENERAL_INQUIRY | threads[entryType=1] |

### Event types

```
case.created           case.updated          case.status_changed
case.priority_changed  case.assigned         case.comment_added
case.escalated         case.resolved         case.closed
case.reopened          case.exported         case.sla_breach
```

---

## API Reference

### Cases

| Method | Path | Body / Query |
|---|---|---|
| `POST` | `/api/v1/cases` | See field limits below |
| `GET` | `/api/v1/cases` | `?status= &priority= &type= &issueType= &search=` |
| `GET` | `/api/v1/cases/:id` | — |
| `PATCH` | `/api/v1/cases/:id` | Any writable case field |
| `POST` | `/api/v1/cases/:id/escalate` | `{}` |
| `POST` | `/api/v1/cases/:id/resolve` | `{ "resolution": "..." }` |
| `POST` | `/api/v1/cases/:id/close` | `{}` |
| `POST` | `/api/v1/cases/:id/reopen` | `{}` |
| `POST` | `/api/v1/cases/:id/assign` | `{ "assigneeId": "..." }` |

### Comments & Events

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/cases/:id/comments` | `{ body, authorName?, isPublic? }` |
| `GET` | `/api/v1/cases/:id/comments` | |
| `GET` | `/api/v1/cases/:id/events` | Full audit trail for one case |
| `GET` | `/api/v1/events` | Org-wide recent events (`?limit=50`) |
| `GET` | `/api/v1/events/stream` | SSE — `text/event-stream`, stays open |

### Export / Transform

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/cases/:id/export/:platform` | Returns `TransformResult`, no DB side effects |
| `POST` | `/api/v1/cases/:id/export` | Returns all 5 platforms at once |
| `POST` | `/api/v1/cases/:id/push/:platform` | Returns `TransformResult` + fires `case.exported` event |

Platforms: `aws` `salesforce` `zendesk` `hubspot` `oracle`

### Field limits (Zod, enforced before DB write)

| Field | Limit |
|---|---|
| `subject` | 255 chars |
| `description` | 32,000 chars |
| `comment.body` | 50,000 chars |
| `resolution` | 5,000 chars |
| `customFields` | 16 KB serialized JSON |
| `tags` | 50 items × 64 chars each |
| `ccEmailAddresses` | 20 addresses |

Request body hard cap: **512 KB** (Fastify `bodyLimit`).

### Auth / Tenancy

Pass `x-org-id` and `x-tenant-id` headers. Both default to `demo-org` / `demo-tenant` when absent. In production, validate these against your existing auth layer before they reach the route handlers.

---

## Adapting to a different storage backend

SQLite is **not** hard-wired to the business logic. The entire database surface is:

```
src/db/
  index.ts              — connection, DDL, FTS5 setup
  repositories/
    case.repo.ts        — case queries
    comment.repo.ts     — comment queries
    event.repo.ts       — event queries
```

Everything outside `src/db/` — domain types, services, event bus, transformers, routes, UI — requires **zero changes** when swapping the backend.

### Steps to swap to PostgreSQL

1. Replace `better-sqlite3` with `pg` (or `postgres`, Prisma, Drizzle).
2. Rewrite `src/db/index.ts` — remove pragmas, write DDL in PG syntax:
   - `INTEGER` boolean columns → `BOOLEAN`
   - `TEXT` JSON columns → `JSONB`
   - FTS5 virtual table → GIN index: `CREATE INDEX ON cases USING GIN(to_tsvector('english', subject || ' ' || description))`
   - Remove trigger-based FTS sync; use `tsvector_update_trigger()` instead
3. Rewrite each repository method in PG SQL. The logic is identical; only the dialect differs.
4. Make every repository method `async` (PG drivers are async). Add `await` to each repo call in `case.service.ts` and mark those service methods `async` in turn.
5. Update `src/server.ts` imports — remove the `'./db/index'` import if your PG setup initialises differently.

### Steps to swap to a managed API (e.g. Supabase, PlanetScale, Turso)

Follow the same four steps above. Most managed services expose a `pg`-compatible or SQL client — the repository rewrite is the same, just pointing at a different connection string in `DB_PATH` / env vars.

---

## Adding a new platform transformer

1. Create `src/transformers/myplatform.transformer.ts` — implement `{ transform(c: Case): TransformResult }`
2. Export it from `src/transformers/index.ts` and add it to the `transformers` map
3. Add the platform name string to `EXPORT_PLATFORMS` in `src/domain/case.types.ts`
4. Add a tab entry in `ui/src/components/ExportPanel.tsx` (`PLATFORMS`, `PLATFORM_LABELS`, `PLATFORM_COLORS`)

### Adding a new event type

1. Add the literal to `CASE_EVENT_TYPES` in `src/domain/event.types.ts`
2. Call `emit({ type: 'case.your_event', ... })` in the relevant `caseService` method

### Wiring up real platform pushes

Replace the `simulated: true` response in `POST /cases/:id/push/:platform` (`src/routes/export.routes.ts`) with an actual `fetch()` call using the transformer's `endpoint`, `headers`, and `payload`. Credentials should come from a per-tenant secrets store wired in via your platform's config layer — not hardcoded.

---

## Storage estimates

| Cases | Estimated DB size | Notes |
|---|---|---|
| 1,000 | ~6 MB | Comfortable |
| 10,000 | ~60 MB | Comfortable |
| 100,000 | ~600 MB | SQLite still fine with WAL mode |
| 500,000+ | ~3 GB | Migrate to PostgreSQL |

Per-case lifetime total (row + ~10 events + ~5 comments + FTS tokens): **~6–8 KB**.
The dominant variable is `description` length — field caps prevent runaway growth.

---

## Security

See [SECURITY.md](SECURITY.md) for the full policy and known design limitations.

Summary of controls in place:

| Control | Detail |
|---|---|
| Security headers | `@fastify/helmet` — HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| Rate limiting | `@fastify/rate-limit` — 200 req/min/IP, RFC 7807 error |
| Body size cap | 512 KB hard limit in Fastify |
| SQL injection | All queries use parameterized statements |
| ID generation | `node:crypto.randomUUID()` — no external package |
| Dependency CVEs | 0 vulnerabilities (`npm audit`) |
| Branch protection | Force-push blocked, PR + CI required to merge to `main` |
| Dependabot | Weekly scans for both `/ ` and `/ui` workspaces |
| CodeQL | Weekly + on every push to `main` |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| API framework | Fastify | 5.x |
| Runtime | Node.js + TypeScript | 20+ / 5.x |
| Database | SQLite via `better-sqlite3` | 12.x |
| Search | SQLite FTS5 (built-in) | — |
| Validation | Zod | 3.x |
| UI | React + Vite + Tailwind CSS | 18 / 8 / 3 |
| UI data fetching | TanStack React Query | 5.x |
| Dev runner | `tsx watch` | 4.x |
