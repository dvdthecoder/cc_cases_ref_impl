import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CaseEvent } from '../api/client'

const ICONS: Record<string, string> = {
  'case.created': '✦',
  'case.updated': '✎',
  'case.status_changed': '⇄',
  'case.priority_changed': '↑',
  'case.assigned': '→',
  'case.comment_added': '💬',
  'case.escalated': '⚠',
  'case.resolved': '✓',
  'case.closed': '✕',
  'case.reopened': '↺',
  'case.exported': '↗',
  'case.sla_breach': '🔴',
}

const COLORS: Record<string, string> = {
  'case.created': 'bg-green-500',
  'case.resolved': 'bg-purple-500',
  'case.closed': 'bg-gray-400',
  'case.escalated': 'bg-red-500',
  'case.exported': 'bg-indigo-500',
}

function EventItem({ event }: { event: CaseEvent }) {
  const fmt = (ts: string) =>
    new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

  const dotColor = COLORS[event.type] ?? 'bg-blue-400'

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full ${dotColor} flex items-center justify-center text-white text-xs flex-shrink-0`}>
          {ICONS[event.type] ?? '•'}
        </div>
        <div className="w-px flex-1 bg-gray-200 my-1" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-800">{event.type}</span>
          <span className="text-xs text-gray-400">{fmt(event.createdAt)}</span>
        </div>
        {Object.keys(event.payload).length > 0 && (
          <pre className="mt-1 text-xs bg-gray-50 rounded p-2 overflow-auto max-h-24 text-gray-600">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        )}
        {event.actorId && (
          <p className="text-xs text-gray-400 mt-1">by {event.actorId}</p>
        )}
      </div>
    </div>
  )
}

export default function EventTimeline({ caseId }: { caseId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['events', caseId],
    queryFn: () => api.events.list(caseId),
    refetchInterval: 3_000,
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading events…</p>
  if (error) return <p className="text-sm text-red-500">Failed to load events</p>

  const events = data?.events ?? []

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">{events.length} events · auto-refreshes every 3 s</p>
      {events.length === 0 && <p className="text-sm text-gray-400">No events yet.</p>}
      <div className="mt-2">
        {events.map((ev) => (
          <EventItem key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  )
}
