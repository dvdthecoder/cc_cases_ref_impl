import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    orgId: string
    tenantId: string
  }
}
