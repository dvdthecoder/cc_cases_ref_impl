import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { caseService } from '../services/case.service'

const commentSchema = z.object({
  body: z.string().min(1),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  isPublic: z.boolean().optional(),
})

export async function commentsRoutes(app: FastifyInstance) {
  app.post('/cases/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = commentSchema.parse(req.body)
    const comment = caseService.addComment(id, req.orgId, req.tenantId, body)
    if (!comment) return reply.code(404).send({ error: 'Case not found' })
    reply.code(201).send(comment)
  })

  app.get('/cases/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string }
    const c = caseService.get(id, req.orgId)
    if (!c) return reply.code(404).send({ error: 'Case not found' })
    const comments = caseService.listComments(id, req.orgId)
    return { comments, total: comments.length }
  })
}
