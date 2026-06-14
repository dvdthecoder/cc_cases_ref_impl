import { caseRepo } from '../db/repositories/case.repo'
import { commentRepo } from '../db/repositories/comment.repo'
import { eventRepo } from '../db/repositories/event.repo'
import { eventBus } from './event.bus'
import type { Case, CaseComment, CreateCaseInput, CreateCommentInput, ListCasesFilter, UpdateCaseInput } from '../domain/case.types'
import type { CaseEvent, CaseEventType } from '../domain/event.types'

function emit(partial: Omit<CaseEvent, 'id' | 'createdAt'>): void {
  const event = eventRepo.create(partial)
  eventBus.publish(event)
}

export const caseService = {
  create(input: CreateCaseInput, actorId?: string): Case {
    const c = caseRepo.create(input)
    emit({
      caseId: c.id,
      orgId: c.orgId,
      tenantId: c.tenantId,
      type: 'case.created',
      payload: { caseNumber: c.caseNumber, subject: c.subject, status: c.status, priority: c.priority },
      actorId,
    })
    return c
  },

  get(id: string, orgId: string): Case | null {
    return caseRepo.findById(id, orgId)
  },

  list(orgId: string, filters: ListCasesFilter = {}): Case[] {
    return caseRepo.findAll(orgId, filters)
  },

  update(id: string, orgId: string, tenantId: string, input: UpdateCaseInput, actorId?: string): Case | null {
    const before = caseRepo.findById(id, orgId)
    if (!before) return null

    const updated = caseRepo.patch(id, orgId, input)
    if (!updated) return null

    const changed: Record<string, unknown> = {}
    for (const key of Object.keys(input) as (keyof UpdateCaseInput)[]) {
      if (JSON.stringify(before[key as keyof Case]) !== JSON.stringify(updated[key as keyof Case])) {
        changed[key] = { from: before[key as keyof Case], to: updated[key as keyof Case] }
      }
    }

    const eventType: CaseEventType =
      input.priority && input.priority !== before.priority
        ? 'case.priority_changed'
        : 'case.updated'

    emit({
      caseId: id,
      orgId,
      tenantId,
      type: eventType,
      payload: { changes: changed },
      actorId,
    })

    return updated
  },

  escalate(id: string, orgId: string, tenantId: string, actorId?: string): Case | null {
    const c = caseRepo.findById(id, orgId)
    if (!c) return null

    const updated = caseRepo.patch(id, orgId, { isEscalated: true, status: 'open' })
    emit({
      caseId: id,
      orgId,
      tenantId,
      type: 'case.escalated',
      payload: { previousStatus: c.status },
      actorId,
    })
    return updated
  },

  resolve(id: string, orgId: string, tenantId: string, resolution: string, actorId?: string): Case | null {
    const c = caseRepo.findById(id, orgId)
    if (!c) return null

    const updated = caseRepo.patch(id, orgId, {
      status: 'resolved',
      resolution,
      resolvedAt: new Date().toISOString(),
    })
    emit({
      caseId: id,
      orgId,
      tenantId,
      type: 'case.resolved',
      payload: { resolution, previousStatus: c.status },
      actorId,
    })
    return updated
  },

  close(id: string, orgId: string, tenantId: string, actorId?: string): Case | null {
    const c = caseRepo.findById(id, orgId)
    if (!c) return null

    const updated = caseRepo.patch(id, orgId, {
      status: 'closed',
      isClosed: true,
      closedAt: new Date().toISOString(),
    })
    emit({
      caseId: id,
      orgId,
      tenantId,
      type: 'case.closed',
      payload: { previousStatus: c.status },
      actorId,
    })
    return updated
  },

  reopen(id: string, orgId: string, tenantId: string, actorId?: string): Case | null {
    const c = caseRepo.findById(id, orgId)
    if (!c) return null

    const updated = caseRepo.patch(id, orgId, {
      status: 'open',
      isClosed: false,
      closedAt: undefined,
      resolvedAt: undefined,
    })
    emit({
      caseId: id,
      orgId,
      tenantId,
      type: 'case.reopened',
      payload: { previousStatus: c.status },
      actorId,
    })
    return updated
  },

  assign(id: string, orgId: string, tenantId: string, assigneeId: string, actorId?: string): Case | null {
    const c = caseRepo.findById(id, orgId)
    if (!c) return null

    const updated = caseRepo.patch(id, orgId, { assigneeId, status: c.status === 'new' ? 'open' : c.status })
    emit({
      caseId: id,
      orgId,
      tenantId,
      type: 'case.assigned',
      payload: { assigneeId, previousAssigneeId: c.assigneeId },
      actorId,
    })
    return updated
  },

  addComment(caseId: string, orgId: string, tenantId: string, input: CreateCommentInput, actorId?: string): CaseComment | null {
    const c = caseRepo.findById(caseId, orgId)
    if (!c) return null

    if (!c.firstResponseAt) {
      caseRepo.patch(caseId, orgId, { firstResponseAt: new Date().toISOString() })
    }

    const comment = commentRepo.create(caseId, orgId, input)
    caseRepo.incrementCommentCount(caseId)

    emit({
      caseId,
      orgId,
      tenantId,
      type: 'case.comment_added',
      payload: {
        commentId: comment.id,
        authorName: comment.authorName,
        isPublic: comment.isPublic,
        preview: comment.body.slice(0, 120),
      },
      actorId,
    })

    return comment
  },

  listComments(caseId: string, orgId: string): CaseComment[] {
    return commentRepo.findByCaseId(caseId, orgId)
  },

  listEvents(caseId: string): CaseEvent[] {
    return eventRepo.findByCaseId(caseId)
  },

  listOrgEvents(orgId: string, limit?: number): CaseEvent[] {
    return eventRepo.findByOrgId(orgId, limit)
  },

  recordExport(caseId: string, orgId: string, tenantId: string, platform: string, actorId?: string): void {
    emit({
      caseId,
      orgId,
      tenantId,
      type: 'case.exported',
      payload: { platform },
      actorId,
    })
  },
}
