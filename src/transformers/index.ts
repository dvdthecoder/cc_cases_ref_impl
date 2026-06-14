export { awsTransformer } from './aws.transformer'
export { salesforceTransformer } from './salesforce.transformer'
export { zendeskTransformer } from './zendesk.transformer'
export { hubspotTransformer } from './hubspot.transformer'

import { awsTransformer } from './aws.transformer'
import { salesforceTransformer } from './salesforce.transformer'
import { zendeskTransformer } from './zendesk.transformer'
import { hubspotTransformer } from './hubspot.transformer'
import type { ExportPlatform } from '../domain/case.types'
import type { TransformResult } from '../domain/event.types'
import type { Case } from '../domain/case.types'

const transformers: Record<ExportPlatform, { transform(c: Case): TransformResult }> = {
  aws: awsTransformer,
  salesforce: salesforceTransformer,
  zendesk: zendeskTransformer,
  hubspot: hubspotTransformer,
}

export function transform(c: Case, platform: ExportPlatform): TransformResult {
  return transformers[platform].transform(c)
}

export function transformAll(c: Case): Record<ExportPlatform, TransformResult> {
  return {
    aws: awsTransformer.transform(c),
    salesforce: salesforceTransformer.transform(c),
    zendesk: zendeskTransformer.transform(c),
    hubspot: hubspotTransformer.transform(c),
  }
}
