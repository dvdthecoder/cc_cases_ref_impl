import '../src/db/index' // ensure schema is created
import { caseService } from '../src/services/case.service'

const ORG = 'demo-org'
const TENANT = 'demo-tenant'

const cases = [
  {
    subject: 'Unable to access billing portal after account migration',
    description: 'Since the migration last Thursday, our finance team can no longer access the billing portal. They receive a 403 Forbidden error. This is blocking our end-of-month invoicing.',
    priority: 'urgent' as const,
    type: 'problem' as const,
    issueType: 'post_sales' as const,
    channel: 'email' as const,
    contactName: 'Sarah Chen',
    contactEmail: 'sarah.chen@acme-corp.com',
    contactPhone: '+1 415 555 0100',
    accountId: 'acct_001',
    tags: ['billing', 'post-migration', 'enterprise'],
    customFields: { accountTier: 'enterprise', mrr: 12500 },
  },
  {
    subject: 'Evaluation: SSO configuration for 500-seat deployment',
    description: 'We are evaluating your platform for a 500-seat enterprise deployment. I need help configuring SSO with our Okta tenant before we can proceed with the POC.',
    priority: 'high' as const,
    type: 'question' as const,
    issueType: 'pre_sales' as const,
    channel: 'web' as const,
    contactName: 'Marcus Webb',
    contactEmail: 'marcus.webb@globex.io',
    tags: ['pre-sales', 'sso', 'enterprise-eval'],
    customFields: { dealSize: 75000, closeDate: '2026-07-31' },
  },
  {
    subject: 'API rate limiting causing intermittent 429 errors in production',
    description: 'Our integration is receiving 429 Too Many Requests starting approximately 48 hours ago. We have not changed our request patterns. Current rate is ~500 req/min against a stated limit of 1000 req/min.',
    priority: 'critical' as const,
    type: 'incident' as const,
    issueType: 'technical' as const,
    channel: 'api' as const,
    contactEmail: 'devops@startup.dev',
    contactName: 'Priya Nair',
    category: 'api',
    subcategory: 'rate-limiting',
    tags: ['production', 'api', 'incident'],
    ccEmailAddresses: ['cto@startup.dev', 'oncall@startup.dev'],
  },
  {
    subject: 'Feature request: bulk case import via CSV',
    description: 'Our support team needs to migrate 3,000+ historical cases from our old Zendesk instance. A CSV import endpoint would save significant time compared to creating cases one by one via the API.',
    priority: 'normal' as const,
    type: 'feature_request' as const,
    issueType: 'post_sales' as const,
    channel: 'chat' as const,
    contactName: 'Lee Jordan',
    contactEmail: 'lee@midmarket.com',
    tags: ['feature-request', 'migration', 'bulk'],
  },
  {
    subject: 'Password reset emails not being delivered',
    description: 'Multiple users report they are not receiving password reset emails. Spam folders checked, domain not on blocklist. Issue started about 2 hours ago.',
    priority: 'high' as const,
    type: 'problem' as const,
    issueType: 'customer_service' as const,
    channel: 'phone' as const,
    contactName: 'David Park',
    contactEmail: 'david.park@retailco.com',
    tags: ['email', 'auth', 'urgent'],
  },
]

console.log('Seeding demo cases…')

for (const input of cases) {
  const c = caseService.create({ orgId: ORG, tenantId: TENANT, ...input })
  console.log(`  Created ${c.caseNumber}: ${c.subject.slice(0, 60)}`)
}

// Add some comments and lifecycle events to the first case
const allCases = caseService.list(ORG)
const first = allCases.find((c) => c.caseNumber === 'CASE-000001')

if (first) {
  caseService.addComment(first.id, ORG, TENANT, {
    body: 'I can reproduce this. Investigating the 403 on the billing portal route.',
    authorName: 'Support Agent',
  })
  caseService.escalate(first.id, ORG, TENANT, 'agent_001')
  caseService.addComment(first.id, ORG, TENANT, {
    body: 'Root cause identified: IAM role policy was not updated during migration. Fix deploying now.',
    authorName: 'Support Agent',
  })
}

// Resolve the third case (rate limiting)
const third = allCases.find((c) => c.caseNumber === 'CASE-000003')
if (third) {
  caseService.addComment(third.id, ORG, TENANT, {
    body: 'Confirmed: a downstream cache service was miscounting requests. Fix deployed at 14:32 UTC.',
    authorName: 'Platform Engineering',
  })
  caseService.resolve(third.id, ORG, TENANT, 'Cache service rate counter corrected. Monitoring for 24h.', 'eng_002')
}

console.log('\nSeed complete. Run `npm run dev` and open http://localhost:5173')
