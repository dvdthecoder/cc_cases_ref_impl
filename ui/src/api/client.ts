const BASE = '/api/v1'
const HEADERS = {
  'Content-Type': 'application/json',
  'x-org-id': 'demo-org',
  'x-tenant-id': 'demo-tenant',
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, ...opts })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json() as Promise<T>
}

export interface Case {
  id: string
  caseNumber: string
  orgId: string
  tenantId: string
  subject: string
  description: string
  status: string
  priority: string
  type: string
  issueType: string
  channel: string
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
  tags: string[]
  customFields: Record<string, unknown>
  commentCount: number
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  caseId: string
  body: string
  authorName?: string
  isPublic: boolean
  createdAt: string
}

export interface CaseEvent {
  id: string
  caseId: string
  type: string
  payload: Record<string, unknown>
  actorId?: string
  createdAt: string
}

export interface TransformResult {
  platform: string
  endpoint: string
  method: string
  headers: Record<string, string>
  payload: Record<string, unknown>
  notes: string[]
  simulated?: boolean
  message?: string
}

export const api = {
  cases: {
    list: (params?: Record<string, string>) =>
      req<{ cases: Case[]; total: number }>(`/cases?${new URLSearchParams(params)}`),
    get: (id: string) => req<Case>(`/cases/${id}`),
    create: (body: Partial<Case>) =>
      req<Case>('/cases', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Case>) =>
      req<Case>(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    escalate: (id: string) => req<Case>(`/cases/${id}/escalate`, { method: 'POST', body: '{}' }),
    resolve: (id: string, resolution: string) =>
      req<Case>(`/cases/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution }) }),
    close: (id: string) => req<Case>(`/cases/${id}/close`, { method: 'POST', body: '{}' }),
    reopen: (id: string) => req<Case>(`/cases/${id}/reopen`, { method: 'POST', body: '{}' }),
  },
  comments: {
    list: (caseId: string) => req<{ comments: Comment[] }>(`/cases/${caseId}/comments`),
    create: (caseId: string, body: { body: string; authorName?: string }) =>
      req<Comment>(`/cases/${caseId}/comments`, { method: 'POST', body: JSON.stringify(body) }),
  },
  events: {
    list: (caseId: string) => req<{ events: CaseEvent[] }>(`/cases/${caseId}/events`),
  },
  export: {
    preview: (caseId: string, platform: string) =>
      req<TransformResult>(`/cases/${caseId}/export/${platform}`, { method: 'POST', body: '{}' }),
    previewAll: (caseId: string) =>
      req<Record<string, TransformResult>>(`/cases/${caseId}/export`, { method: 'POST', body: '{}' }),
    push: (caseId: string, platform: string) =>
      req<TransformResult>(`/cases/${caseId}/push/${platform}`, { method: 'POST', body: '{}' }),
  },
  meta: () => req<{ statuses: string[]; priorities: string[]; types: string[]; issueTypes: string[]; channels: string[] }>('/meta'),
}
