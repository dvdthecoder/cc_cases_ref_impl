import { v4 as uuid } from 'uuid'
import { db } from '../index'
import type {
  Case,
  CaseStatus,
  CreateCaseInput,
  ListCasesFilter,
  UpdateCaseInput,
} from '../../domain/case.types'

const now = () => new Date().toISOString()

function deserialize(row: Record<string, unknown>): Case {
  return {
    id: row.id as string,
    caseNumber: row.case_number as string,
    orgId: row.org_id as string,
    tenantId: row.tenant_id as string,
    subject: row.subject as string,
    description: row.description as string,
    status: row.status as Case['status'],
    priority: row.priority as Case['priority'],
    type: row.type as Case['type'],
    issueType: row.issue_type as Case['issueType'],
    channel: row.channel as Case['channel'],
    category: row.category as string | undefined,
    subcategory: row.subcategory as string | undefined,
    contactId: row.contact_id as string | undefined,
    contactName: row.contact_name as string | undefined,
    contactEmail: row.contact_email as string | undefined,
    contactPhone: row.contact_phone as string | undefined,
    accountId: row.account_id as string | undefined,
    assigneeId: row.assignee_id as string | undefined,
    ccEmailAddresses: JSON.parse((row.cc_email_addresses as string) || '[]'),
    isEscalated: Boolean(row.is_escalated),
    isClosed: Boolean(row.is_closed),
    resolution: row.resolution as string | undefined,
    slaBreachAt: row.sla_breach_at as string | undefined,
    firstResponseAt: row.first_response_at as string | undefined,
    resolvedAt: row.resolved_at as string | undefined,
    closedAt: row.closed_at as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    customFields: JSON.parse((row.custom_fields as string) || '{}'),
    commentCount: row.comment_count as number,
    attachmentCount: row.attachment_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function nextCaseNumber(): string {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(case_number, 6) AS INTEGER)), 0) + 1 AS next FROM cases`
    )
    .get() as { next: number }
  return `CASE-${String(row.next).padStart(6, '0')}`
}

export const caseRepo = {
  create(input: CreateCaseInput): Case {
    const id = uuid()
    const caseNumber = nextCaseNumber()
    const ts = now()

    db.prepare(`
      INSERT INTO cases (
        id, case_number, org_id, tenant_id, subject, description,
        status, priority, type, issue_type, channel,
        category, subcategory,
        contact_id, contact_name, contact_email, contact_phone,
        account_id, assignee_id, cc_email_addresses,
        is_escalated, is_closed,
        tags, custom_fields,
        comment_count, attachment_count,
        created_at, updated_at
      ) VALUES (
        @id, @caseNumber, @orgId, @tenantId, @subject, @description,
        'new', @priority, @type, @issueType, @channel,
        @category, @subcategory,
        @contactId, @contactName, @contactEmail, @contactPhone,
        @accountId, @assigneeId, @ccEmailAddresses,
        0, 0,
        @tags, @customFields,
        0, 0,
        @ts, @ts
      )
    `).run({
      id,
      caseNumber,
      orgId: input.orgId,
      tenantId: input.tenantId,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'normal',
      type: input.type ?? 'question',
      issueType: input.issueType ?? 'post_sales',
      channel: input.channel ?? 'web',
      category: input.category ?? null,
      subcategory: input.subcategory ?? null,
      contactId: input.contactId ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      accountId: input.accountId ?? null,
      assigneeId: input.assigneeId ?? null,
      ccEmailAddresses: JSON.stringify(input.ccEmailAddresses ?? []),
      tags: JSON.stringify(input.tags ?? []),
      customFields: JSON.stringify(input.customFields ?? {}),
      ts,
    })

    return this.findById(id, input.orgId)!
  },

  findById(id: string, orgId: string): Case | null {
    const row = db
      .prepare('SELECT * FROM cases WHERE id = ? AND org_id = ?')
      .get(id, orgId) as Record<string, unknown> | undefined
    return row ? deserialize(row) : null
  },

  findAll(orgId: string, filters: ListCasesFilter = {}): Case[] {
    const parts = ['SELECT * FROM cases WHERE org_id = @orgId']
    const params: Record<string, unknown> = { orgId }

    if (filters.status) { parts.push('AND status = @status'); params.status = filters.status }
    if (filters.priority) { parts.push('AND priority = @priority'); params.priority = filters.priority }
    if (filters.type) { parts.push('AND type = @type'); params.type = filters.type }
    if (filters.issueType) { parts.push('AND issue_type = @issueType'); params.issueType = filters.issueType }
    if (filters.search) {
      parts.push('AND (subject LIKE @search OR description LIKE @search)')
      params.search = `%${filters.search}%`
    }

    parts.push('ORDER BY created_at DESC')
    const rows = db.prepare(parts.join(' ')).all(params) as Record<string, unknown>[]
    return rows.map(deserialize)
  },

  patch(id: string, orgId: string, updates: UpdateCaseInput & { status?: CaseStatus; isEscalated?: boolean; isClosed?: boolean; firstResponseAt?: string; resolvedAt?: string; closedAt?: string; resolution?: string; assigneeId?: string }): Case | null {
    const ts = now()
    const colMap: Record<string, string> = {
      subject: 'subject',
      description: 'description',
      status: 'status',
      priority: 'priority',
      type: 'type',
      issueType: 'issue_type',
      channel: 'channel',
      category: 'category',
      subcategory: 'subcategory',
      contactId: 'contact_id',
      contactName: 'contact_name',
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      accountId: 'account_id',
      assigneeId: 'assignee_id',
      resolution: 'resolution',
      isEscalated: 'is_escalated',
      isClosed: 'is_closed',
      firstResponseAt: 'first_response_at',
      resolvedAt: 'resolved_at',
      closedAt: 'closed_at',
    }

    const sets: string[] = []
    const params: Record<string, unknown> = { id, orgId, ts }

    for (const [key, col] of Object.entries(colMap)) {
      const val = (updates as Record<string, unknown>)[key]
      if (val !== undefined) {
        sets.push(`${col} = @${key}`)
        params[key] = val
      }
    }

    if ((updates as Record<string, unknown>).ccEmailAddresses !== undefined) {
      sets.push('cc_email_addresses = @ccEmailAddresses')
      params.ccEmailAddresses = JSON.stringify((updates as Record<string, unknown>).ccEmailAddresses)
    }
    if ((updates as Record<string, unknown>).tags !== undefined) {
      sets.push('tags = @tags')
      params.tags = JSON.stringify((updates as Record<string, unknown>).tags)
    }
    if ((updates as Record<string, unknown>).customFields !== undefined) {
      sets.push('custom_fields = @customFields')
      params.customFields = JSON.stringify((updates as Record<string, unknown>).customFields)
    }

    if (sets.length === 0) return this.findById(id, orgId)

    db.prepare(`UPDATE cases SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id AND org_id = @orgId`).run(params)
    return this.findById(id, orgId)
  },

  incrementCommentCount(id: string): void {
    db.prepare('UPDATE cases SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?')
      .run(now(), id)
  },
}
