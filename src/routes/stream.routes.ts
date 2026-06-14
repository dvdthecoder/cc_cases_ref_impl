import type { FastifyInstance } from 'fastify'
import { eventBus } from '../services/event.bus'
import type { CaseEvent } from '../domain/event.types'

export async function streamRoutes(app: FastifyInstance) {
  // SSE endpoint — streams all case events for the requesting org in real time
  app.get('/events/stream', async (req, reply) => {
    const orgId = (req.headers['x-org-id'] as string) || 'demo-org'

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    })

    // Handshake event confirms connection is live
    reply.raw.write(
      `data: ${JSON.stringify({ type: 'stream.connected', orgId, ts: new Date().toISOString() })}\n\n`
    )

    const listener = (event: CaseEvent) => {
      reply.raw.write(`id: ${event.id}\n`)
      reply.raw.write(`event: ${event.type}\n`)
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const unsubscribe = eventBus.subscribeOrg(orgId, listener)

    // Keep-alive ping every 25 s (nginx/proxies close idle SSE after 60 s)
    const keepAlive = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 25_000)

    await new Promise<void>((resolve) => {
      req.raw.on('close', () => {
        clearInterval(keepAlive)
        unsubscribe()
        resolve()
      })
    })
  })
}
