import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { caseService } from '../services/case.service'
import {
  CASE_CHANNELS,
  CASE_ISSUE_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CASE_TYPES,
} from '../domain/case.types'

const MAX_CUSTOM_FIELDS_BYTES = 16_384 // 16 KB serialized

const createSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().min(1).max(32_000),       // ~32 KB — enough for any support case
  priority: z.enum(CASE_PRIORITIES).optional(),
  type: z.enum(CASE_TYPES).optional(),
  issueType: z.enum(CASE_ISSUE_TYPES).optional(),
  channel: z.enum(CASE_CHANNELS).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  contactId: z.string().max(255).optional(),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().max(254).optional(),
  contactPhone: z.string().max(50).optional(),
  accountId: z.string().max(255).optional(),
  assigneeId: z.string().max(255).optional(),
  ccEmailAddresses: z.array(z.string().email()).max(20).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  customFields: z
    .record(z.unknown())
    .refine(
      (v) => !v || JSON.stringify(v).length <= MAX_CUSTOM_FIELDS_BYTES,
      `customFields must not exceed ${MAX_CUSTOM_FIELDS_BYTES / 1024} KB serialized`
    )
    .optional(),
})

const updateSchema = createSchema.partial().extend({
  status: z.enum(CASE_STATUSES).optional(),
})

export async function casesRoutes(app: FastifyInstance) {
  app.post('/cases', async (req, reply) => {
    const body = createSchema.parse(req.body)
    const c = caseService.create({ ...body, orgId: req.orgId, tenantId: req.tenantId })
    reply.code(201).send(c)
  })

  app.get('/cases', async (req) => {
    const q = req.query as Record<string, string>
    const cases = caseService.list(req.orgId, {
      status: q.status as any,
      priority: q.priority as any,
      type: q.type as any,
      issueType: q.issueType as any,
      search: q.search,
    })
    return { cases, total: cases.length }
  })

  app.get('/cases/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.get(id, req.orgId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.patch('/cases/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateSchema.parse(req.body)
    const c = caseService.update(id, req.orgId, req.tenantId, body)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.post('/cases/:id/escalate', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.escalate(id, req.orgId, req.tenantId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.post('/cases/:id/resolve', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { resolution } = z.object({ resolution: z.string().min(1).max(5_000) }).parse(req.body)
    const c = caseService.resolve(id, req.orgId, req.tenantId, resolution)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.post('/cases/:id/close', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.close(id, req.orgId, req.tenantId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.post('/cases/:id/reopen', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.reopen(id, req.orgId, req.tenantId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.post('/cases/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { assigneeId } = z.object({ assigneeId: z.string().min(1) }).parse(req.body)
    const c = caseService.assign(id, req.orgId, req.tenantId, assigneeId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return c
  })

  app.get('/meta', async () => ({
    statuses: CASE_STATUSES,
    priorities: CASE_PRIORITIES,
    types: CASE_TYPES,
    issueTypes: CASE_ISSUE_TYPES,
    channels: CASE_CHANNELS,
  }))
}
