import type { Case, CaseChannel, CasePriority, CaseStatus, CaseType, CaseIssueType } from '../domain/case.types'
import type { TransformResult } from '../domain/event.types'

// canonical → Oracle severity lookupName
// Oracle's default severity levels are instance-configurable — these match the factory defaults
const SEVERITY_MAP: Record<CasePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'High',       // Oracle has no Urgent tier
  critical: 'Critical', // Critical exists in most Oracle instances but is non-standard
}

// canonical → Oracle statusWithType.status.lookupName
// Standard Oracle B2C Service statuses (Unresolved, Updated, Waiting, Solved)
const STATUS_MAP: Record<CaseStatus, string> = {
  new: 'Unresolved',
  open: 'Unresolved',
  pending: 'Waiting',
  on_hold: 'Waiting',
  resolved: 'Solved',
  closed: 'Solved',
}

// canonical type → Oracle product/category hint (used in notes, not a direct field)
const TYPE_LABELS: Record<CaseType, string> = {
  question: 'General Inquiry',
  problem: 'Product Issue',
  incident: 'Incident',
  feature_request: 'Feature Request',
  task: 'Service Request',
}

// canonical issueType → Oracle queue hint
const ISSUE_QUEUE_MAP: Record<CaseIssueType, string> = {
  pre_sales: 'Sales Support',
  post_sales: 'Customer Support',
  technical: 'Technical Support',
  customer_service: 'Customer Service',
}

// canonical channel → Oracle channel lookupName
// Oracle channel IDs are instance-specific; lookupName matching is safer
const CHANNEL_MAP: Record<CaseChannel, string> = {
  phone: 'Phone',
  email: 'Email',
  web: 'CSS Web',
  api: 'CSS Web',
  chat: 'Chat',
  social: 'Social Monitor',
}

export const oracleTransformer = {
  transform(c: Case): TransformResult {
    const notes: string[] = []

    if (c.priority === 'urgent') {
      notes.push('Priority "urgent" mapped to severity "High" — Oracle B2C Service has no Urgent tier')
    }
    if (['new', 'open'].includes(c.status)) {
      notes.push('Status "new"/"open" both map to "Unresolved" — Oracle uses Unresolved/Updated/Waiting/Solved')
    }
    if (c.status === 'closed') {
      notes.push('Status "closed" mapped to "Solved" — Oracle\'s Solved status is equivalent to resolved/closed')
    }
    if (c.tags.length > 0) {
      notes.push('Tags have no native Oracle B2C field — added as a banner note on the incident')
    }
    if (Object.keys(c.customFields).length > 0) {
      notes.push('customFields mapped to Oracle custom_fields array — field IDs must match your Oracle instance configuration')
    }
    if (['api', 'social'].includes(c.channel)) {
      notes.push(`Channel "${c.channel}" mapped to "${CHANNEL_MAP[c.channel]}" — verify channel lookupName in your Oracle instance`)
    }

    // Oracle uses threads[] for the body content — thread entryType 1 = Customer Entry
    const thread: Record<string, unknown> = {
      entryType: { id: 1 }, // Customer Entry
      contentType: { id: 1 }, // Plain text (id: 2 = HTML)
      text: c.description,
      channel: { lookupName: CHANNEL_MAP[c.channel] },
    }

    const payload: Record<string, unknown> = {
      subject: c.subject,
      statusWithType: {
        status: { lookupName: STATUS_MAP[c.status] },
      },
      severity: { lookupName: SEVERITY_MAP[c.priority] },
      threads: [thread],
    }

    // Contact — Oracle requires a primaryContact ref (id or lookupName)
    if (c.contactId) {
      payload.primaryContact = { id: c.contactId }
    } else if (c.contactEmail) {
      // Without a contact ID, pass email as lookupName for resolution
      payload.primaryContact = { lookupName: c.contactEmail }
      notes.push('primaryContact resolved by email lookupName — contact must already exist in Oracle; create it first if not')
    } else {
      notes.push('primaryContact is required by Oracle — no contactId or contactEmail provided; request will fail without it')
    }

    // Organization (Account)
    if (c.accountId) {
      payload.organization = { id: c.accountId }
    }

    // Agent assignment
    if (c.assigneeId) {
      payload.assignedTo = {
        account: { id: c.assigneeId },
      }
    }

    // Queue derived from issueType when no explicit assignee
    if (!c.assigneeId) {
      payload.queue = { lookupName: ISSUE_QUEUE_MAP[c.issueType] }
      notes.push(`Queue set to "${ISSUE_QUEUE_MAP[c.issueType]}" from issueType — verify queue name in your Oracle instance`)
    }

    // Product/Category from case taxonomy
    if (c.subcategory) {
      payload.product = { lookupName: c.subcategory }
      notes.push('product resolved by lookupName from subcategory — must match a serviceProduct in your Oracle instance')
    }
    if (c.category) {
      payload.category = { lookupName: c.category }
      notes.push('category resolved by lookupName — must match a serviceCategory in your Oracle instance')
    }

    // CC emails → otherContacts (requires contact IDs; email alone not supported)
    if (c.ccEmailAddresses.length > 0) {
      notes.push(`ccEmailAddresses (${c.ccEmailAddresses.join(', ')}) cannot be mapped to otherContacts without Oracle contact IDs`)
    }

    // Tags → banner text (no native tag support)
    if (c.tags.length > 0) {
      payload.banner = {
        text: `Tags: ${c.tags.join(', ')}`,
        importanceFlag: { lookupName: 'Normal' },
      }
    }

    // Resolution note
    if (c.resolution) {
      const resThread: Record<string, unknown> = {
        entryType: { id: 2 }, // Response
        contentType: { id: 1 },
        text: `Resolution: ${c.resolution}`,
      }
      ;(payload.threads as unknown[]).push(resThread)
    }

    // Custom fields → Oracle customFields array
    const cfEntries = Object.entries(c.customFields)
    if (cfEntries.length > 0) {
      payload.customFields = cfEntries.map(([name, value]) => ({ name, value }))
    }

    return {
      platform: 'oracle',
      endpoint: '/services/rest/connect/v1.4/incidents',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic <BASE64(username:password)>',
        'OSvC-CREST-Application-Context': 'Cases API Reference Implementation',
      },
      payload,
      notes: [
        'Base URL: https://<your-site>.custhelp.com',
        'Auth: Basic Auth (username:password as Base64) — OAuth2 also supported via OSvC token endpoint',
        'Oracle B2C Service uses "Incident" terminology; this maps from the canonical Case model',
        'All lookupName references are resolved server-side — verify exact names in your Oracle instance',
        ...notes,
      ],
    }
  },
}
