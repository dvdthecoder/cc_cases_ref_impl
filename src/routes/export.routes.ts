import type { FastifyInstance } from 'fastify'
import { caseService } from '../services/case.service'
import { transform, transformAll } from '../transformers'
import { EXPORT_PLATFORMS } from '../domain/case.types'

export async function exportRoutes(app: FastifyInstance) {
  // Dry-run: returns transformed payload for a single platform
  app.post('/cases/:id/export/:platform', async (req, reply) => {
    const { id, platform } = req.params as { id: string; platform: string }
    if (!EXPORT_PLATFORMS.includes(platform as any)) {
      return reply.code(400).send({ error: `Unknown platform. Valid: ${EXPORT_PLATFORMS.join(', ')}` })
    }
    const c = caseService.get(id, req.orgId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })

    const result = transform(c, platform as any)
    return result
  })

  // Preview all 4 platforms at once
  app.post('/cases/:id/export', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.get(id, req.orgId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    return transformAll(c)
  })

  // Simulate push: transforms + records a case.exported event (no real HTTP call)
  app.post('/cases/:id/push/:platform', async (req, reply) => {
    const { id, platform } = req.params as { id: string; platform: string }
    if (!EXPORT_PLATFORMS.includes(platform as any)) {
      return reply.code(400).send({ error: `Unknown platform. Valid: ${EXPORT_PLATFORMS.join(', ')}` })
    }
    const c = caseService.get(id, req.orgId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })

    const result = transform(c, platform as any)
    caseService.recordExport(id, req.orgId, req.tenantId, platform)

    return {
      ...result,
      simulated: true,
      message: `Payload ready for ${platform}. In production, POST to ${result.endpoint} with the credentials shown in headers.`,
    }
  })
}
