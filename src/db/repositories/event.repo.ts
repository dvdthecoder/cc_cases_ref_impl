import { v4 as uuid } from 'uuid'
import { db } from '../index'
import type { CaseEvent, CaseEventType } from '../../domain/event.types'

const now = () => new Date().toISOString()

function deserialize(row: Record<string, unknown>): CaseEvent {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    orgId: row.org_id as string,
    tenantId: row.tenant_id as string,
    type: row.type as CaseEventType,
    payload: JSON.parse((row.payload as string) || '{}'),
    actorId: row.actor_id as string | undefined,
    createdAt: row.created_at as string,
  }
}

export const eventRepo = {
  create(input: Omit<CaseEvent, 'id' | 'createdAt'>): CaseEvent {
    const id = uuid()
    const ts = now()

    db.prepare(`
      INSERT INTO events (id, case_id, org_id, tenant_id, type, payload, actor_id, created_at)
      VALUES (@id, @caseId, @orgId, @tenantId, @type, @payload, @actorId, @ts)
    `).run({
      id,
      caseId: input.caseId,
      orgId: input.orgId,
      tenantId: input.tenantId,
      type: input.type,
      payload: JSON.stringify(input.payload),
      actorId: input.actorId ?? null,
      ts,
    })

    return this.findById(id)!
  },

  findById(id: string): CaseEvent | null {
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? deserialize(row) : null
  },

  findByCaseId(caseId: string): CaseEvent[] {
    const rows = db
      .prepare('SELECT * FROM events WHERE case_id = ? ORDER BY created_at ASC')
      .all(caseId) as Record<string, unknown>[]
    return rows.map(deserialize)
  },

  findByOrgId(orgId: string, limit = 50): CaseEvent[] {
    const rows = db
      .prepare('SELECT * FROM events WHERE org_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(orgId, limit) as Record<string, unknown>[]
    return rows.map(deserialize)
  },
}
