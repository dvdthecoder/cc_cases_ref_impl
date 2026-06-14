import type { Case, CasePriority, CaseStatus, CaseType } from '../domain/case.types'
import type { TransformResult } from '../domain/event.types'

// canonical → Zendesk priority (Zendesk max is urgent, no critical)
const PRIORITY_MAP: Record<CasePriority, string> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
  critical: 'urgent',
}

// canonical → Zendesk status
const STATUS_MAP: Record<CaseStatus, string> = {
  new: 'new',
  open: 'open',
  pending: 'pending',
  on_hold: 'hold',
  resolved: 'solved',
  closed: 'closed',
}

// canonical → Zendesk type (feature_request has no ZD equivalent)
const TYPE_MAP: Record<CaseType, string> = {
  question: 'question',
  problem: 'problem',
  incident: 'incident',
  feature_request: 'question',
  task: 'task',
}

export const zendeskTransformer = {
  transform(c: Case): TransformResult {
    const notes: string[] = []

    if (c.priority === 'critical') {
      notes.push('Priority "critical" mapped to "urgent" — Zendesk maximum priority is urgent')
    }
    if (c.type === 'feature_request') {
      notes.push('Type "feature_request" mapped to "question" — Zendesk has no feature_request type')
    }
    if (c.status === 'closed') {
      notes.push('Zendesk "closed" is terminal/read-only — set via automation, not API directly')
    }

    const ticket: Record<string, unknown> = {
      subject: c.subject,
      comment: { body: c.description, public: true },
      status: STATUS_MAP[c.status],
      priority: PRIORITY_MAP[c.priority],
      type: TYPE_MAP[c.type],
      tags: [
        ...c.tags,
        c.issueType,
        c.channel,
      ],
    }

    if (c.contactEmail) {
      ticket.requester = {
        name: c.contactName ?? c.contactEmail,
        email: c.contactEmail,
      }
    }

    if (c.assigneeId) {
      ticket.assignee_email = c.assigneeId
    }

    if (c.ccEmailAddresses.length > 0) {
      ticket.email_ccs = c.ccEmailAddresses.map((email) => ({ user_email: email, action: 'put' }))
    }

    // Map custom fields to Zendesk custom_fields array format
    const customFieldEntries = Object.entries(c.customFields)
    if (customFieldEntries.length > 0) {
      ticket.custom_fields = customFieldEntries.map(([id, value]) => ({ id, value }))
      notes.push('Custom field IDs must match numeric IDs from your Zendesk account')
    }

    if (c.isEscalated) {
      const existingTags = ticket.tags as string[]
      existingTags.push('escalated')
    }

    return {
      platform: 'zendesk',
      endpoint: '/api/v2/tickets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic <BASE64(email/token:api_token)>',
      },
      payload: { ticket },
      notes: [
        'Base URL: https://<your-subdomain>.zendesk.com',
        'Auth: email/token:api_token encoded as Base64, or OAuth bearer token',
        'channel (via.channel) is set automatically to "api" for API-created tickets',
        ...notes,
      ],
    }
  },
}
