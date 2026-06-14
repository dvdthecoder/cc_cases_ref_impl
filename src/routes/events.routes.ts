import type { FastifyInstance } from 'fastify'
import { caseService } from '../services/case.service'

export async function eventsRoutes(app: FastifyInstance) {
  app.get('/cases/:id/events', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.get(id, req.orgId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    const events = caseService.listEvents(id)
    return { events, total: events.length }
  })

  app.get('/events', async (req) => {
    const { limit } = req.query as { limit?: string }
    const events = caseService.listOrgEvents(req.orgId, limit ? parseInt(limit) : 50)
    return { events, total: events.length }
  })
}
