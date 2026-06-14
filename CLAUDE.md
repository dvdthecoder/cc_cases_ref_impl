# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install root dependencies
npm install

# Install UI dependencies
npm install --prefix ui

# Start API server (port 3000, hot-reload)
npm run dev

# Start UI dev server (port 5173, proxies /api → 3000)
npm run dev:ui

# Run both concurrently
npm run dev:all

# Seed demo cases (5 cases + comments + lifecycle events)
npm run seed

# CLI: export a case as a platform payload
npm run export -- --id CASE-000001 --to salesforce
npm run export -- --id CASE-000001 --to all
```

Database (`cases.db`) is created automatically in the project root on first run. Delete it to reset.

## Architecture

### Backend (`src/`)

**Layer order**: routes → service → repositories → DB

- `src/domain/` — canonical TypeScript types (`Case`, `CaseEvent`, enums). No logic here.
- `src/db/index.ts` — creates the SQLite database and all tables on import (auto-migration via `CREATE TABLE IF NOT EXISTS`). Import this once in `server.ts`.
- `src/db/repositories/` — raw `better-sqlite3` prepared statements. Repositories are plain objects (`caseRepo`, `commentRepo`, `eventRepo`), no classes. JSON columns (`tags`, `customFields`, `ccEmailAddresses`) are serialized/deserialized in `deserialize()`.
- `src/services/case.service.ts` — all business logic lives here. Every mutating method persists an event via `eventRepo.create()` and then publishes it to `eventBus.publish()`. This is the only place events are emitted.
- `src/services/event.bus.ts` — thin `EventEmitter` wrapper. Events are emitted on `org:<orgId>` channels (for SSE fan-out) and `case:<caseId>` channels (for per-case listeners). SSE routes subscribe via `eventBus.subscribeOrg()`.
- `src/transformers/` — pure functions. Each transformer maps `Case → TransformResult` with no side effects. Add new platforms here without touching routes or services.
- `src/routes/stream.routes.ts` — SSE endpoint at `GET /api/v1/events/stream`. Keeps connection alive with 25 s pings. The UI LiveFeed component connects here.

### Multi-tenancy

`orgId` and `tenantId` are extracted from `x-org-id` / `x-tenant-id` request headers in a `preHandler` hook in `server.ts`. Both default to `demo-org` / `demo-tenant` when absent. All repository queries are scoped by `orgId`.

### Canonical Case Model

5-tier priority (`low → critical`), 6-state lifecycle (`new → open → pending → on_hold → resolved → closed`), and 5 case types covering the union of all four target platforms. Field mapping decisions are documented in the transformer files.

### Transformer Pattern

```
src/transformers/
  index.ts              — transform(case, platform) + transformAll(case)
  aws.transformer.ts    → AWS Support CreateCase (SigV4, 2-tier issueType)
  salesforce.transformer.ts → POST /sobjects/Case (3-tier priority, SF Status picklist)
  zendesk.transformer.ts    → POST /api/v2/tickets (hold status, 4-tier priority)
  hubspot.transformer.ts    → POST /crm/v3/objects/tickets (pipeline stages, associations)
```

Each transformer returns `{ platform, endpoint, method, headers, payload, notes[] }`. The `notes[]` array flags lossy mappings (e.g. "critical → urgent") so the caller knows what was dropped.

### UI (`ui/`)

React + Vite + Tailwind + React Query. Vite proxies `/api` to `localhost:3000`.

- `ui/src/api/client.ts` — typed fetch wrapper. All calls send `x-org-id: demo-org` / `x-tenant-id: demo-tenant`.
- `ui/src/components/LiveFeed.tsx` — SSE client. Subscribes to `/api/v1/events/stream` and displays events in real time in the right sidebar.
- `ui/src/pages/CaseDetail.tsx` — 4-tab view: Details | Comments | Events | Export. The Export tab renders `ExportPanel` with per-platform payload previews and a "Simulate Push" button.

### Event Flow

```
HTTP action (e.g. POST /cases/:id/resolve)
  → caseService.resolve()
  → caseRepo.patch()           (persists state)
  → eventRepo.create()         (persists event to SQLite)
  → eventBus.publish(event)    (in-process EventEmitter)
      → SSE stream → UI LiveFeed panel (real time)
      → EventTimeline (polls every 3 s as fallback)
```

### API Endpoints

```
POST   /api/v1/cases
GET    /api/v1/cases?status=&priority=&type=&issueType=&search=
GET    /api/v1/cases/:id
PATCH  /api/v1/cases/:id

POST   /api/v1/cases/:id/escalate
POST   /api/v1/cases/:id/resolve      body: { resolution }
POST   /api/v1/cases/:id/close
POST   /api/v1/cases/:id/reopen
POST   /api/v1/cases/:id/assign       body: { assigneeId }

POST   /api/v1/cases/:id/comments
GET    /api/v1/cases/:id/comments
GET    /api/v1/cases/:id/events
GET    /api/v1/events                 ?limit=50

POST   /api/v1/cases/:id/export/:platform    (dry-run, no side effects)
POST   /api/v1/cases/:id/export              (all 4 platforms at once)
POST   /api/v1/cases/:id/push/:platform      (dry-run + emits case.exported event)

GET    /api/v1/events/stream          SSE
GET    /api/v1/meta
GET    /health
```

## Key Decisions

- `better-sqlite3` is synchronous — no `await` in repository methods. This is intentional for simplicity; SQLite is single-writer anyway.
- Events are always persisted to DB before being published to the bus. The DB is the source of truth; the bus is delivery-only.
- Transformer `notes[]` document lossy mappings at the field level — read these when debugging why a Salesforce/HubSpot payload looks different from the canonical case.
- The `closedAt`/`resolvedAt` timestamps are nullable; the service sets them only on the relevant lifecycle transitions, not on arbitrary `PATCH /cases/:id`.
