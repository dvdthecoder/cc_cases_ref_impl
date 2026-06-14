/**
 * CLI: transform a case to a platform payload and print it.
 *
 * Usage:
 *   tsx scripts/export.ts --id CASE-000001 --to salesforce
 *   tsx scripts/export.ts --id CASE-000001 --to all
 */

import '../src/db/index'
import { caseRepo } from '../src/db/repositories/case.repo'
import { transform, transformAll } from '../src/transformers'
import { EXPORT_PLATFORMS } from '../src/domain/case.types'

const args = process.argv.slice(2)

function arg(flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

const caseNumberOrId = arg('--id')
const platform = arg('--to')

if (!caseNumberOrId || !platform) {
  console.error('Usage: tsx scripts/export.ts --id CASE-000001 --to salesforce|aws|zendesk|hubspot|all')
  process.exit(1)
}

// Accept both CASE-000001 and raw UUIDs
const cases = caseRepo.findAll('demo-org')
const c = cases.find(
  (x) => x.caseNumber === caseNumberOrId || x.id === caseNumberOrId
)

if (!c) {
  console.error(`Case "${caseNumberOrId}" not found in org demo-org`)
  process.exit(1)
}

console.log(`\nCase: ${c.caseNumber} — ${c.subject}`)
console.log(`Status: ${c.status} | Priority: ${c.priority} | Type: ${c.type}\n`)

if (platform === 'all') {
  const results = transformAll(c)
  for (const [p, result] of Object.entries(results)) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`Platform: ${p.toUpperCase()}`)
    console.log(`Endpoint: ${result.method} ${result.endpoint}`)
    if (result.notes.length > 0) {
      console.log(`Notes:`)
      result.notes.forEach((n) => console.log(`  • ${n}`))
    }
    console.log(`\nPayload:`)
    console.log(JSON.stringify(result.payload, null, 2))
  }
} else {
  if (!EXPORT_PLATFORMS.includes(platform as any)) {
    console.error(`Unknown platform "${platform}". Valid: ${EXPORT_PLATFORMS.join(', ')}, all`)
    process.exit(1)
  }
  const result = transform(c, platform as any)
  console.log(`Platform: ${result.platform.toUpperCase()}`)
  console.log(`Endpoint: ${result.method} ${result.endpoint}`)
  if (result.notes.length > 0) {
    console.log(`\nNotes:`)
    result.notes.forEach((n) => console.log(`  • ${n}`))
  }
  console.log(`\nHeaders:`)
  console.log(JSON.stringify(result.headers, null, 2))
  console.log(`\nPayload:`)
  console.log(JSON.stringify(result.payload, null, 2))
}
