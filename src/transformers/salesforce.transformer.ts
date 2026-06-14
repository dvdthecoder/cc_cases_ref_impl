import type { Case, CaseChannel, CasePriority, CaseStatus, CaseType } from '../domain/case.types'
import type { TransformResult } from '../domain/event.types'

// canonical → Salesforce (3-tier only)
const PRIORITY_MAP: Record<CasePriority, string> = {
  low: 'Low',
  normal: 'Low',
  high: 'High',
  urgent: 'High',
  critical: 'High',
}

// canonical → Salesforce Status
const STATUS_MAP: Record<CaseStatus, string> = {
  new: 'New',
  open: 'Working',
  pending: 'Working',
  on_hold: 'Working',
  resolved: 'Closed',
  closed: 'Closed',
}

// canonical → Salesforce Type
const TYPE_MAP: Record<CaseType, string> = {
  question: 'Question',
  problem: 'Problem',
  incident: 'Problem',
  feature_request: 'Feature Request',
  task: 'User',
}

// canonical → Salesforce Origin
const CHANNEL_MAP: Record<CaseChannel, string> = {
  web: 'Web',
  email: 'Email',
  phone: 'Phone',
  api: 'Web',
  chat: 'Web',
  social: 'Web',
}

export const salesforceTransformer = {
  transform(c: Case): TransformResult {
    const notes: string[] = []

    if (['urgent', 'critical'].includes(c.priority)) {
      notes.push(`Priority "${c.priority}" mapped to "High" — Salesforce has no Urgent/Critical tier`)
    }
    if (c.type === 'incident') {
      notes.push('Type "incident" mapped to "Problem" — Salesforce has no Incident type')
    }
    if (['api', 'chat', 'social'].includes(c.channel)) {
      notes.push(`Channel "${c.channel}" mapped to "Web" — Salesforce Origin has Email/Phone/Web only`)
    }
    if (c.status === 'on_hold') {
      notes.push('Status "on_hold" mapped to "Working" — Salesforce has no On-Hold status')
    }

    const payload: Record<string, unknown> = {
      Subject: c.subject,
      Description: c.description,
      Status: STATUS_MAP[c.status],
      Priority: PRIORITY_MAP[c.priority],
      Type: TYPE_MAP[c.type],
      Origin: CHANNEL_MAP[c.channel],
      IsEscalated: c.isEscalated,
    }

    // Web-to-case fields for contact data when no SF Contact ID is available
    if (c.contactEmail) payload.SuppliedEmail = c.contactEmail
    if (c.contactName) payload.SuppliedName = c.contactName
    if (c.contactPhone) payload.SuppliedPhone = c.contactPhone

    // Direct references if IDs exist
    if (c.contactId) payload.ContactId = c.contactId
    if (c.accountId) payload.AccountId = c.accountId
    if (c.assigneeId) payload.OwnerId = c.assigneeId

    if (c.resolution) payload.Resolution__c = c.resolution

    if (c.tags.length > 0) {
      notes.push('Tags stored in custom field Tags__c — requires custom field in your SF org')
      payload.Tags__c = c.tags.join(';')
    }

    if (Object.keys(c.customFields).length > 0) {
      notes.push('customFields mapped as-is — ensure matching custom field API names exist in your SF org')
      Object.assign(payload, c.customFields)
    }

    return {
      platform: 'salesforce',
      endpoint: '/services/data/v60.0/sobjects/Case',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer <SALESFORCE_ACCESS_TOKEN>',
      },
      payload,
      notes: [
        'Base URL: https://<your-instance>.salesforce.com',
        'OAuth 2.0 bearer token required — use Connected App in production',
        ...notes,
      ],
    }
  },
}
