export const CASE_STATUSES = ['new', 'open', 'pending', 'on_hold', 'resolved', 'closed'] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'] as const
export type CasePriority = (typeof CASE_PRIORITIES)[number]

export const CASE_TYPES = ['question', 'problem', 'incident', 'feature_request', 'task'] as const
export type CaseType = (typeof CASE_TYPES)[number]

export const CASE_ISSUE_TYPES = ['pre_sales', 'post_sales', 'technical', 'customer_service'] as const
export type CaseIssueType = (typeof CASE_ISSUE_TYPES)[number]

export const CASE_CHANNELS = ['web', 'email', 'phone', 'api', 'chat', 'social'] as const
export type CaseChannel = (typeof CASE_CHANNELS)[number]

export const EXPORT_PLATFORMS = ['aws', 'salesforce', 'zendesk', 'hubspot', 'oracle'] as const
export type ExportPlatform = (typeof EXPORT_PLATFORMS)[number]

export interface Case {
  id: string
  caseNumber: string
  orgId: string
  tenantId: string
  subject: string
  description: string
  status: CaseStatus
  priority: CasePriority
  type: CaseType
  issueType: CaseIssueType
  channel: CaseChannel
  category?: string
  subcategory?: string
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  accountId?: string
  assigneeId?: string
  ccEmailAddresses: string[]
  isEscalated: boolean
  isClosed: boolean
  resolution?: string
  slaBreachAt?: string
  firstResponseAt?: string
  resolvedAt?: string
  closedAt?: string
  tags: string[]
  customFields: Record<string, unknown>
  commentCount: number
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

export interface CaseComment {
  id: string
  caseId: string
  orgId: string
  body: string
  authorId?: string
  authorName?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCaseInput {
  orgId: string
  tenantId: string
  subject: string
  description: string
  priority?: CasePriority
  type?: CaseType
  issueType?: CaseIssueType
  channel?: CaseChannel
  category?: string
  subcategory?: string
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  accountId?: string
  assigneeId?: string
  ccEmailAddresses?: string[]
  tags?: string[]
  customFields?: Record<string, unknown>
}

export interface UpdateCaseInput {
  subject?: string
  description?: string
  status?: CaseStatus
  priority?: CasePriority
  type?: CaseType
  issueType?: CaseIssueType
  channel?: CaseChannel
  category?: string
  subcategory?: string
  contactId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  accountId?: string
  ccEmailAddresses?: string[]
  tags?: string[]
  customFields?: Record<string, unknown>
}

export interface CreateCommentInput {
  body: string
  authorId?: string
  authorName?: string
  isPublic?: boolean
}

export interface ListCasesFilter {
  status?: CaseStatus
  priority?: CasePriority
  type?: CaseType
  issueType?: CaseIssueType
  search?: string
}
