# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (run both on first clone)
npm install
npm install --prefix ui

# Development (two terminals)
npm run dev          # API on http://localhost:3000 with hot-reload
npm run dev:ui       # UI on http://localhost:5173 (proxies /api → 3000)

# Or run both in one terminal
npm run dev:all

# Load 5 demo cases with comments, escalations, and lifecycle events
npm run seed

# CLI: transform a case to a platform payload and print it
npm run export -- --id CASE-000001 --to salesforce
npm run export -- --id CASE-000001 --to all   # all 5 platforms

# Type-check (no emit)
npx tsc --noEmit
npx tsc --noEmit -p ui/tsconfig.json
```

`cases.db` is created automatically on first run. Delete it to reset all data.

## Architecture

### Layer order

```
HTTP request
  → Fastify route (validation via Zod)
  → CaseService (business logic, event emission)
  → Repository (DB reads/writes)
  → src/db/index.ts (SQLite connection — the only DB-specific file outside repositories)
```

### `src/domain/`
Canonical TypeScript types only — `Case`, `CaseEvent`, all enums (`CaseStatus`, `CasePriority`, etc.), `TransformResult`. No logic, no imports from other src/ directories. This layer is fully backend-agnostic.

### `src/db/`
**The entire database coupling lives here.** Nothing outside `src/db/` touches `better-sqlite3` or raw SQL.

- `index.ts` — opens the SQLite connection, runs all DDL (`CREATE TABLE IF NOT EXISTS`), creates indexes, and sets up the FTS5 virtual table with its INSERT/UPDATE/DELETE triggers. Also runs `INSERT INTO cases_fts(cases_fts) VALUES('rebuild')` on startup to index any pre-existing rows.
- `repositories/` — plain objects (`caseRepo`, `commentRepo`, `eventRepo`). All methods are **synchronous** (better-sqlite3 is a sync driver). JSON columns (`tags`, `customFields`, `ccEmailAddresses`) are serialized to TEXT on write and deserialized in each `deserialize()` function on read.

### `src/services/case.service.ts`
All business logic. Every mutating method:
1. Calls the relevant repository method(s)
2. Calls `eventRepo.create()` to persist the event
3. Calls `eventBus.publish(event)` to broadcast it

This is the **only** place events are emitted. Service methods have no `async/await` because the repositories are synchronous.

### `src/services/event.bus.ts`
Thin `EventEmitter` wrapper. Emits on `org:<orgId>` (for SSE fan-out to connected UIs) and `case:<caseId>` (for per-case listeners). SSE routes subscribe via `eventBus.subscribeOrg()`.

### `src/transformers/`
Pure functions — `Case → TransformResult`. No imports from `src/db/` or `src/services/`. Safe to test in isolation.

```
index.ts                 — transform(c, platform) and transformAll(c)
aws.transformer.ts       → AWS Support CreateCase (SigV4, 2-tier issueType, 5-tier severity)
salesforce.transformer.ts → POST /sobjects/Case (3-tier priority, Status picklist)
zendesk.transformer.ts   → POST /api/v2/tickets (hold status, 4-tier priority, tags)
hubspot.transformer.ts   → POST /crm/v3/objects/tickets (pipeline stages, associations)
oracle.transformer.ts    → POST /services/rest/connect/v1.4/incidents (threads[], severity)
```

Each returns `{ platform, endpoint, method, headers, payload, notes[] }`. `notes[]` documents every lossy mapping — read it to understand why a payload field differs from the canonical case.

### `src/routes/`
Fastify plugin functions. Validation is Zod (not Fastify's JSON Schema). Body size limits are enforced at two levels: 512 KB hard cap in `server.ts` bodyLimit, and per-field limits in each Zod schema.

- `stream.routes.ts` — SSE endpoint `GET /api/v1/events/stream`. Keeps alive with 25 s comment pings. Registered before the rate-limit plugin so SSE connections aren't counted per-request.

### `ui/`
React 18 + Vite 8 + Tailwind 3 + React Query 5.

- `ui/src/api/client.ts` — typed fetch wrapper; hardcodes `x-org-id: demo-org` / `x-tenant-id: demo-tenant` for demo.
- `ui/src/components/LiveFeed.tsx` — SSE client via `EventSource`. Listens to both `onmessage` (generic) and named event listeners for each `case.*` type.
- `ui/src/pages/CaseDetail.tsx` — Details | Comments | Events | Export tabs. Export tab shows per-platform JSON payloads and "Simulate Push" button (fires `case.exported` event).

## Search

Full-text search uses SQLite **FTS5** with Porter stemming (`tokenize='porter ascii'`). The virtual table `cases_fts` indexes `subject`, `description`, `contact_name`, `contact_email`, `tags`, and `case_number` using external-content mode (no text duplication — tokens only). Three triggers keep it in sync. The repository converts user input to prefix queries (`billing port` → `billing* port*`) and uses a subquery to avoid duplicate rows when a term hits multiple columns.

## Field Size Limits

Enforced at the Zod layer before any DB write:

| Field | Limit |
|---|---|
| `subject` | 255 chars |
| `description` | 32,000 chars |
| `comment.body` | 50,000 chars |
| `resolution` | 5,000 chars |
| `customFields` | 16 KB serialized |
| `tags` | 50 items × 64 chars |
| `ccEmailAddresses` | 20 addresses |

## Security

- `@fastify/helmet` — security headers on every response
- `@fastify/rate-limit` — 200 req/min/IP; SSE stream excluded
- `bodyLimit: 512 KB` in Fastify options
- `x-request-id` attached to every request
- Error handler never returns stack traces to clients
- All SQL uses parameterized statements — no string interpolation
- `node:crypto.randomUUID()` for ID generation (no external uuid package)

## Event Flow

```
POST /api/v1/cases/:id/resolve
  → casesRoutes handler
  → caseService.resolve()
      → caseRepo.patch()        writes DB
      → eventRepo.create()      persists CaseEvent to DB
      → eventBus.publish(event)
            → org:<orgId> channel → SSE stream → UI LiveFeed (real time)
            → case:<caseId> channel → any per-case listeners
```

The DB is the source of truth. The bus is delivery-only — if the SSE connection drops, the client polls `/api/v1/cases/:id/events` every 3 s as a fallback.

## API Endpoints

```
POST   /api/v1/cases
GET    /api/v1/cases?status=&priority=&type=&issueType=&search=
GET    /api/v1/cases/:id
PATCH  /api/v1/cases/:id

POST   /api/v1/cases/:id/escalate
POST   /api/v1/cases/:id/resolve        body: { resolution }
POST   /api/v1/cases/:id/close
POST   /api/v1/cases/:id/reopen
POST   /api/v1/cases/:id/assign         body: { assigneeId }

POST   /api/v1/cases/:id/comments
GET    /api/v1/cases/:id/comments
GET    /api/v1/cases/:id/events
GET    /api/v1/events                   ?limit=50
GET    /api/v1/events/stream            SSE

POST   /api/v1/cases/:id/export/:platform    dry-run, no side effects
POST   /api/v1/cases/:id/export              all 5 platforms at once
POST   /api/v1/cases/:id/push/:platform      dry-run + emits case.exported

GET    /api/v1/meta
GET    /health
```

## Swapping the Storage Backend

SQLite is **not** hard-wired to the business logic. The coupling is limited to:

| File | What changes |
|---|---|
| `src/db/index.ts` | Replace `better-sqlite3` with your driver; rewrite DDL |
| `src/db/repositories/*.repo.ts` | Rewrite queries for new dialect |

Everything outside `src/db/` — domain types, services, event bus, transformers, routes — requires **zero changes**.

One thing to be aware of: `better-sqlite3` is synchronous, so repository methods have no `async/await`. When moving to an async driver (`pg`, `@libsql/client`, Prisma, Drizzle), make every repository method `async`, add `await` to each repository call in `case.service.ts`, and mark the service methods `async` in turn.

PostgreSQL-specific translation notes:
- `INTEGER` boolean columns → native `BOOLEAN`
- `TEXT` JSON columns → `JSONB` (more efficient, queryable)
- `CREATE VIRTUAL TABLE … USING fts5` → `CREATE INDEX … USING GIN(to_tsvector('english', …))`
- FTS5 `MATCH 'word*'` → `to_tsquery('english', 'word:*')`
- FTS5 triggers → PostgreSQL trigger functions + `tsvector_update_trigger()`
- `db.pragma(…)` → removed (PG handles WAL/FK natively)
