export const CASE_EVENT_TYPES = [
  'case.created',
  'case.updated',
  'case.status_changed',
  'case.priority_changed',
  'case.assigned',
  'case.comment_added',
  'case.escalated',
  'case.resolved',
  'case.closed',
  'case.reopened',
  'case.exported',
  'case.sla_breach',
] as const

export type CaseEventType = (typeof CASE_EVENT_TYPES)[number]

export interface CaseEvent {
  id: string
  caseId: string
  orgId: string
  tenantId: string
  type: CaseEventType
  payload: Record<string, unknown>
  actorId?: string
  createdAt: string
}

export interface TransformResult {
  platform: string
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  payload: Record<string, unknown>
  notes: string[]
}
