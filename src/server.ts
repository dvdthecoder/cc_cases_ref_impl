import Fastify from 'fastify'
import cors from '@fastify/cors'
import './db/index' // initialise schema on startup
import { casesRoutes } from './routes/cases.routes'
import { commentsRoutes } from './routes/comments.routes'
import { eventsRoutes } from './routes/events.routes'
import { exportRoutes } from './routes/export.routes'
import { streamRoutes } from './routes/stream.routes'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })

await app.register(cors, { origin: '*' })

// Inject org/tenant context from headers — demo uses defaults
app.decorateRequest('orgId', '')
app.decorateRequest('tenantId', '')
app.addHook('preHandler', async (req) => {
  req.orgId = (req.headers['x-org-id'] as string) || 'demo-org'
  req.tenantId = (req.headers['x-tenant-id'] as string) || 'demo-tenant'
})

app.addHook('preValidation', async (req, reply) => {
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.headers['content-type']?.includes('application/json')) {
    reply.code(400).send({ error: 'Content-Type must be application/json' })
  }
})

// Zod validation errors → 400
app.setErrorHandler((err, _req, reply) => {
  if (err.name === 'ZodError') {
    return reply.code(400).send({ error: 'Validation error', details: JSON.parse(err.message) })
  }
  app.log.error(err)
  reply.code(500).send({ error: err.message })
})

await app.register(casesRoutes, { prefix: '/api/v1' })
await app.register(commentsRoutes, { prefix: '/api/v1' })
await app.register(eventsRoutes, { prefix: '/api/v1' })
await app.register(exportRoutes, { prefix: '/api/v1' })
await app.register(streamRoutes, { prefix: '/api/v1' })

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

const port = parseInt(process.env.PORT || '3000')
await app.listen({ port, host: '0.0.0.0' })
console.log(`Cases API running on http://localhost:${port}`)
