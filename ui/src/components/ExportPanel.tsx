import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

const PLATFORMS = ['aws', 'salesforce', 'zendesk', 'hubspot', 'oracle'] as const
type Platform = (typeof PLATFORMS)[number]

const PLATFORM_LABELS: Record<Platform, string> = {
  aws: 'AWS Support',
  salesforce: 'Salesforce',
  zendesk: 'Zendesk',
  hubspot: 'HubSpot',
  oracle: 'Oracle B2C',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  aws: 'bg-orange-500',
  salesforce: 'bg-blue-600',
  zendesk: 'bg-green-600',
  hubspot: 'bg-orange-600',
  oracle: 'bg-red-700',
}

function PlatformPayload({ caseId, platform }: { caseId: string; platform: Platform }) {
  const [copied, setCopied] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['export', caseId, platform],
    queryFn: () => api.export.preview(caseId, platform),
  })

  const push = useMutation({
    mutationFn: () => api.export.push(caseId, platform),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', caseId] })
      qc.invalidateQueries({ queryKey: ['case', caseId] })
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Building payload…</p>

  const result = push.data ?? data
  if (!result) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(result.payload, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="font-mono text-gray-600">
          <span className="font-semibold text-gray-800">{result.method}</span>{' '}
          {result.endpoint}
        </span>
      </div>

      {result.notes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Mapping notes</p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            {result.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Headers</p>
        </div>
        <pre className="text-xs bg-gray-800 text-green-300 rounded p-3 overflow-auto max-h-28">
          {JSON.stringify(result.headers, null, 2)}
        </pre>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payload</p>
          <button
            onClick={handleCopy}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {copied ? '✓ Copied' : 'Copy JSON'}
          </button>
        </div>
        <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-auto max-h-64">
          {JSON.stringify(result.payload, null, 2)}
        </pre>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => push.mutate()}
          disabled={push.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {push.isPending ? 'Simulating…' : '⚡ Simulate Push'}
        </button>
        {push.isSuccess && (
          <p className="text-xs text-green-600">{push.data.message}</p>
        )}
      </div>
    </div>
  )
}

export default function ExportPanel({ caseId }: { caseId: string }) {
  const [active, setActive] = useState<Platform>('salesforce')

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              active === p
                ? `${PLATFORM_COLORS[p]} text-white`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      <PlatformPayload key={active} caseId={caseId} platform={active} />
    </div>
  )
}
