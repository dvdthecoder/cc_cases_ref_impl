import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import './db/index' // initialise schema on startup
import { casesRoutes } from './routes/cases.routes'
import { commentsRoutes } from './routes/comments.routes'
import { eventsRoutes } from './routes/events.routes'
import { exportRoutes } from './routes/export.routes'
import { streamRoutes } from './routes/stream.routes'

const isDev = process.env.NODE_ENV !== 'production'

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || (isDev ? 'info' : 'warn') },
  // Cap inbound body at 512 KB — protects against large payload DoS
  bodyLimit: 512 * 1024,
  // Attach a unique request ID to every request for tracing
  genReqId: () => crypto.randomUUID(),
  requestIdHeader: 'x-request-id',
})

// Security headers — sets X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, Referrer-Policy, etc.
await app.register(helmet, {
  // CSP is intentionally permissive for an API — tighten if serving HTML
  contentSecurityPolicy: false,
})

// Rate limiting — 200 requests / minute / IP (excludes SSE stream)
await app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  // Return RFC 7807-style error on breach
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit reached. Retry after ${context.after}.`,
    retryAfter: context.after,
  }),
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
    req.ip,
})

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})

// Inject org/tenant context from headers — demo defaults; replace with real auth in production
app.decorateRequest('orgId', '')
app.decorateRequest('tenantId', '')
app.addHook('preHandler', async (req) => {
  req.orgId = (req.headers['x-org-id'] as string) || 'demo-org'
  req.tenantId = (req.headers['x-tenant-id'] as string) || 'demo-tenant'
})

app.addHook('preValidation', async (req, reply) => {
  if (
    ['POST', 'PATCH', 'PUT'].includes(req.method) &&
    !req.headers['content-type']?.includes('application/json')
  ) {
    reply.code(400).send({ error: 'Content-Type must be application/json' })
  }
})

// Zod validation errors → 400
app.setErrorHandler((err, _req, reply) => {
  if (err.name === 'ZodError') {
    return reply.code(400).send({ error: 'Validation error', details: JSON.parse(err.message) })
  }
  // FST-ERR-CTP-BODY-TOO-LARGE
  if (err.statusCode === 413) {
    return reply.code(413).send({ error: 'Request body too large (max 512 KB)' })
  }
  // Surface rate-limit errors as-is
  if (err.statusCode === 429) {
    return reply.send(err)
  }
  app.log.error(err)
  // Never leak internal stack traces to clients
  reply.code(500).send({ error: 'Internal server error' })
})

// SSE stream route gets a relaxed rate limit — long-lived connections don't count per-request
await app.register(streamRoutes, { prefix: '/api/v1' })

await app.register(casesRoutes, { prefix: '/api/v1' })
await app.register(commentsRoutes, { prefix: '/api/v1' })
await app.register(eventsRoutes, { prefix: '/api/v1' })
await app.register(exportRoutes, { prefix: '/api/v1' })

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

const port = parseInt(process.env.PORT || '3000')
await app.listen({ port, host: '0.0.0.0' })
console.log(`Cases API running on http://localhost:${port}`)
