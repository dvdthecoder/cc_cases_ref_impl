# Security Policy

## Scope

This repository is a **reference implementation** demonstrating a canonical Cases API design pattern. It is not intended to be deployed to production as-is without additional hardening appropriate to your environment.

## Supported Versions

| Branch | Supported |
|--------|-----------|
| `main` | ✅ Active |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately via [GitHub's private vulnerability reporting](https://github.com/dvdthecoder/cc_cases_ref_impl/security/advisories/new).

Include:
- Description of the vulnerability and potential impact
- Steps to reproduce
- Any suggested fix or mitigation

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Security Design Notes

### What this implementation does

- All SQL queries use parameterized statements via `better-sqlite3` — no string interpolation in queries
- Multi-tenancy context (`orgId`, `tenantId`) is enforced at the repository layer on every query
- Zod validates all inbound request bodies before they reach business logic
- Security headers are applied globally via `@fastify/helmet`
- Rate limiting (200 req/min/IP) is enforced via `@fastify/rate-limit`
- Request body size is capped at 512 KB

### What this implementation does NOT do (intentional demo scope)

- **No authentication** — `x-org-id` / `x-tenant-id` headers are trusted without verification. Production deployments must verify these against your existing auth layer (JWT, session, API key)
- **No HTTPS enforcement** — run behind a TLS-terminating reverse proxy (nginx, Caddy, ALB) in production
- **No secrets management** — platform credentials (Salesforce token, Zendesk API key, etc.) are not stored; the `/push/:platform` endpoint is a dry-run simulator
- **No file storage** — attachment metadata is tracked but no actual file bytes are stored or served
- **SQLite** — single-writer; replace with PostgreSQL for concurrent production load

## Dependency Security

Dependabot is configured to monitor npm dependencies weekly and open PRs for CVEs automatically.
