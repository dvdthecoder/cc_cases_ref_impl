import type { Case, CaseChannel, CasePriority, CaseStatus, CaseType } from '../domain/case.types'
import type { TransformResult } from '../domain/event.types'

// canonical → HubSpot priority (3-tier)
const PRIORITY_MAP: Record<CasePriority, string> = {
  low: 'LOW',
  normal: 'LOW',
  high: 'MEDIUM',
  urgent: 'HIGH',
  critical: 'HIGH',
}

// canonical → HubSpot default pipeline stage IDs (pipeline "0")
// Stage IDs vary per account — these are the HubSpot defaults
const STAGE_MAP: Record<CaseStatus, string> = {
  new: '1',
  open: '2',
  pending: '3',
  on_hold: '3',
  resolved: '4',
  closed: '4',
}

// canonical → HubSpot hs_ticket_category
const TYPE_MAP: Record<CaseType, string> = {
  question: 'GENERAL_INQUIRY',
  problem: 'PRODUCT_ISSUE',
  incident: 'PRODUCT_ISSUE',
  feature_request: 'FEATURE_REQUEST',
  task: 'GENERAL_INQUIRY',
}

// canonical → HubSpot source_type
const CHANNEL_MAP: Record<CaseChannel, string> = {
  web: 'WEB',
  email: 'EMAIL',
  phone: 'PHONE',
  api: 'API',
  chat: 'CHAT',
  social: 'SOCIAL_MEDIA',
}

export const hubspotTransformer = {
  transform(c: Case): TransformResult {
    const notes: string[] = []

    if (['low', 'normal'].includes(c.priority)) {
      notes.push(`Priority "${c.priority}" mapped to "LOW" — HubSpot has LOW/MEDIUM/HIGH only`)
    }
    if (c.status === 'on_hold') {
      notes.push('Status "on_hold" mapped to pipeline stage "3" (Waiting on customer) — adjust stage ID for your pipeline')
    }
    notes.push('Pipeline stage IDs ("1","2","3","4") are HubSpot defaults — retrieve yours via GET /crm/v3/pipelines/tickets')

    const properties: Record<string, unknown> = {
      subject: c.subject,
      content: c.description,
      hs_ticket_priority: PRIORITY_MAP[c.priority],
      hs_pipeline: '0',
      hs_pipeline_stage: STAGE_MAP[c.status],
      hs_ticket_category: TYPE_MAP[c.type],
      source_type: CHANNEL_MAP[c.channel],
    }

    if (c.contactEmail) properties.hs_contact_email = c.contactEmail
    if (c.resolution) properties.hs_resolution = c.resolution

    // HubSpot custom properties are flat key-value pairs
    if (Object.keys(c.customFields).length > 0) {
      Object.assign(properties, c.customFields)
      notes.push('customFields merged as HubSpot properties — ensure property names exist in your portal')
    }

    const associations: Record<string, unknown>[] = []

    if (c.contactId) {
      associations.push({
        to: { id: c.contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 16 }],
      })
    }

    if (c.accountId) {
      associations.push({
        to: { id: c.accountId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 26 }],
      })
    }

    const payload: Record<string, unknown> = { properties }
    if (associations.length > 0) payload.associations = associations

    return {
      platform: 'hubspot',
      endpoint: '/crm/v3/objects/tickets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer <HUBSPOT_PRIVATE_APP_TOKEN>',
      },
      payload,
      notes: [
        'Base URL: https://api.hubapi.com',
        'Auth: Private App token (preferred) or OAuth bearer token',
        ...notes,
      ],
    }
  },
}
