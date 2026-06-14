import type { Case, CaseIssueType, CasePriority } from '../domain/case.types'
import type { TransformResult } from '../domain/event.types'

// canonical priority → AWS severityCode
const PRIORITY_MAP: Record<CasePriority, string> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
  critical: 'critical',
}

// canonical issueType → AWS issueType (only 2 values exist)
const ISSUE_TYPE_MAP: Record<CaseIssueType, string> = {
  technical: 'technical',
  post_sales: 'technical',
  pre_sales: 'customer-service',
  customer_service: 'customer-service',
}

export const awsTransformer = {
  transform(c: Case): TransformResult {
    const notes: string[] = []

    if (c.priority === 'critical' && !['urgent', 'critical'].includes(c.priority)) {
      notes.push('Critical severity requires Enterprise Support plan')
    }
    if (c.tags.length > 0) {
      notes.push('AWS Support does not support tags natively; tags dropped')
    }
    if (c.customFields && Object.keys(c.customFields).length > 0) {
      notes.push('Custom fields are not supported by AWS CreateCase; included in communicationBody as metadata')
    }

    const metadataBlock =
      Object.keys(c.customFields).length > 0
        ? `\n\n--- Metadata ---\n${JSON.stringify(c.customFields, null, 2)}`
        : ''

    const payload: Record<string, unknown> = {
      subject: c.subject,
      communicationBody: c.description + metadataBlock,
      severityCode: PRIORITY_MAP[c.priority],
      issueType: ISSUE_TYPE_MAP[c.issueType],
      categoryCode: c.subcategory ?? 'general',
      serviceCode: c.category ?? 'general-info',
      language: 'en',
    }

    if (c.ccEmailAddresses.length > 0) {
      payload.ccEmailAddresses = c.ccEmailAddresses
    }

    return {
      platform: 'aws',
      endpoint: 'https://support.us-east-1.amazonaws.com/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AmazonSupport.CreateCase',
        Authorization: 'AWS4-HMAC-SHA256 Credential=<ACCESS_KEY>/... (SigV4 required)',
      },
      payload,
      notes: [
        'Requires Business, Enterprise On-Ramp, or Enterprise Support plan',
        'SigV4 signing required — use AWS SDK in production',
        ...notes,
      ],
    }
  },
}
