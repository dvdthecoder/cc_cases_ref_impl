import { useEffect, useRef, useState } from 'react'
import type { CaseEvent } from '../api/client'

const EVENT_COLORS: Record<string, string> = {
  'case.created': 'text-green-600',
  'case.updated': 'text-blue-600',
  'case.status_changed': 'text-purple-600',
  'case.priority_changed': 'text-orange-600',
  'case.assigned': 'text-blue-500',
  'case.comment_added': 'text-gray-600',
  'case.escalated': 'text-red-600',
  'case.resolved': 'text-purple-700',
  'case.closed': 'text-gray-500',
  'case.reopened': 'text-green-700',
  'case.exported': 'text-indigo-600',
}

export default function LiveFeed() {
  const [events, setEvents] = useState<(CaseEvent & { _live?: boolean })[]>([])
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/v1/events/stream', {})
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'stream.connected') return
      setEvents((prev) => [{ ...data, _live: true }, ...prev].slice(0, 50))
    }

    // Listen to typed events too
    const types = [
      'case.created', 'case.updated', 'case.status_changed', 'case.priority_changed',
      'case.assigned', 'case.comment_added', 'case.escalated', 'case.resolved',
      'case.closed', 'case.reopened', 'case.exported',
    ]
    types.forEach((t) => {
      es.addEventListener(t, (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setEvents((prev) => [{ ...data, _live: true }, ...prev].slice(0, 50))
      })
    })

    return () => es.close()
  }, [])

  const fmt = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Events</span>
        <span className={`flex items-center gap-1 text-xs ${connected ? 'text-green-600' : 'text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {connected ? 'SSE connected' : 'connecting…'}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {events.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8 px-4">
            Events appear here in real time as you create and update cases.
          </p>
        )}
        {events.map((ev, i) => (
          <div key={ev.id ?? i} className="px-4 py-2 border-b hover:bg-gray-50 text-xs">
            <div className="flex justify-between items-start gap-2">
              <span className={`font-medium ${EVENT_COLORS[ev.type] ?? 'text-gray-700'}`}>
                {ev.type}
              </span>
              <span className="text-gray-400 whitespace-nowrap">{fmt(ev.createdAt)}</span>
            </div>
            <div className="text-gray-500 mt-0.5 font-mono truncate">
              {ev.caseId}
            </div>
            {Object.keys(ev.payload).length > 0 && (
              <div className="mt-1 text-gray-400 text-xs truncate">
                {JSON.stringify(ev.payload).slice(0, 80)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
