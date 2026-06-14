# Cases API — Reference Implementation

A canonical **Cases/Support Ticket API** modelled on the best-of-breed intersection of AWS Support, Salesforce Cases, Zendesk Tickets, and HubSpot Tickets — with a live event bus and a transformer pipeline to export any case into the native payload format of each platform.

Designed for use in a multi-tenant support console that handles both **pre-sales** and **post-sales** cases.

---

## What this demonstrates

| Capability | How |
|---|---|
| Canonical case model | 5-tier priority, 6-state lifecycle, unified field set covering all 4 target platforms |
| Event-driven architecture | Every state change emits a typed `case.*` event, persisted to SQLite and broadcast via SSE |
| Live event stream | `GET /api/v1/events/stream` (SSE) — the UI LiveFeed panel shows events appearing in real time |
| Platform-agnostic transforms | Pure transformer functions produce the exact payload for AWS / Salesforce / Zendesk / HubSpot |
| Lossy mapping transparency | Each transformer returns `notes[]` flagging where canonical data had to be approximated |
| Multi-tenancy | All data is scoped to `orgId` + `tenantId` from request headers |

---

## Quick start

```bash
# 1. Install
npm install && npm install --prefix ui

# 2. Start API (port 3000)
npm run dev

# 3. In a second terminal, start UI (port 5173)
npm run dev:ui

# 4. Load demo data
npm run seed

# 5. Open http://localhost:5173
```

---

## Canonical Case Model

### Status lifecycle

```
new → open → pending → on_hold → resolved → closed
                ↑                     ↓
                └──────── reopen ─────┘
```

Derived from Zendesk's lifecycle (the most complete). `on_hold` is internal-only; `closed` is terminal.

### Priority (5 tiers)

| Canonical | AWS severityCode | Salesforce | Zendesk | HubSpot |
|---|---|---|---|---|
| `low` | low | Low | low | LOW |
| `normal` | normal | Low | normal | LOW |
| `high` | high | High | high | MEDIUM |
| `urgent` | urgent | High | urgent | HIGH |
| `critical` | critical | High | urgent | HIGH |

Salesforce's 3-tier and HubSpot's 3-tier lose the `urgent`/`critical` distinction — this is flagged in transformer notes.

### Type

| Canonical | AWS issueType | Salesforce Type | Zendesk type | HubSpot category |
|---|---|---|---|---|
| `question` | customer-service | Question | question | GENERAL_INQUIRY |
| `problem` | technical | Problem | problem | PRODUCT_ISSUE |
| `incident` | technical | Problem | incident | PRODUCT_ISSUE |
| `feature_request` | customer-service | Feature Request | question | FEATURE_REQUEST |
| `task` | customer-service | User | task | GENERAL_INQUIRY |

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

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/cases` | Create case |
| `GET` | `/api/v1/cases` | List (filter: `status`, `priority`, `type`, `issueType`, `search`) |
| `GET` | `/api/v1/cases/:id` | Get case |
| `PATCH` | `/api/v1/cases/:id` | Update fields |
| `POST` | `/api/v1/cases/:id/escalate` | Escalate |
| `POST` | `/api/v1/cases/:id/resolve` | Resolve — body: `{ "resolution": "..." }` |
| `POST` | `/api/v1/cases/:id/close` | Close |
| `POST` | `/api/v1/cases/:id/reopen` | Reopen |
| `POST` | `/api/v1/cases/:id/assign` | Assign — body: `{ "assigneeId": "..." }` |

### Comments & Events

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/cases/:id/comments` | Add comment |
| `GET` | `/api/v1/cases/:id/comments` | List comments |
| `GET` | `/api/v1/cases/:id/events` | Case event log |
| `GET` | `/api/v1/events` | Org-wide recent events |
| `GET` | `/api/v1/events/stream` | SSE live stream |

### Export / Transform

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/cases/:id/export/:platform` | Dry-run: returns transformed payload |
| `POST` | `/api/v1/cases/:id/export` | Dry-run: all 4 platforms at once |
| `POST` | `/api/v1/cases/:id/push/:platform` | Dry-run + emits `case.exported` event |

Platforms: `aws`, `salesforce`, `zendesk`, `hubspot`

### Auth / Tenancy

Pass `x-org-id` and `x-tenant-id` headers. Both default to `demo-org` / `demo-tenant` when absent — no auth required for the demo.

---

## CLI Export

```bash
# Export a case to a single platform
npm run export -- --id CASE-000001 --to zendesk

# Show all 4 platform payloads
npm run export -- --id CASE-000001 --to all
```

---

## Extending

### Add a new platform transformer

1. Create `src/transformers/myplatform.transformer.ts` implementing `{ transform(c: Case): TransformResult }`
2. Export it from `src/transformers/index.ts` and add it to the `transformers` map
3. Add the platform name to `EXPORT_PLATFORMS` in `src/domain/case.types.ts`

### Add a new event type

1. Add the string literal to `CASE_EVENT_TYPES` in `src/domain/event.types.ts`
2. Call `emit({ type: 'case.your_event', ... })` inside the relevant `caseService` method

### Wire up real platform pushes

Replace the `simulated: true` response in `POST /cases/:id/push/:platform` (`src/routes/export.routes.ts`) with an actual `fetch()` call using the transformer's `endpoint`, `headers`, and `payload`. Credentials should come from a per-tenant secrets store — not hardcoded.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Fastify 4 + TypeScript |
| Database | SQLite via `better-sqlite3` (synchronous, zero setup) |
| Validation | Zod |
| UI | React 18 + Vite + Tailwind CSS + React Query |
| Runtime | Node.js 20+, `tsx` for TypeScript execution |
