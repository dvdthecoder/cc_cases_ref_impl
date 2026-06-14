import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge, PriorityBadge } from '../components/StatusBadge'

const STATUSES = ['', 'new', 'open', 'pending', 'on_hold', 'resolved', 'closed']
const PRIORITIES = ['', 'low', 'normal', 'high', 'urgent', 'critical']
const TYPES = ['', 'question', 'problem', 'incident', 'feature_request', 'task']

export default function CaseList() {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')

  const params = Object.fromEntries(
    Object.entries({ status, priority, type, search }).filter(([, v]) => v !== '')
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['cases', params],
    queryFn: () => api.cases.list(params),
    refetchInterval: 5_000,
  })

  const cases = data?.cases ?? []

  const fmt = (ts: string) => new Date(ts).toLocaleDateString()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cases</h1>
          {data && <p className="text-sm text-gray-500">{data.total} total</p>}
        </div>
        <Link
          to="/cases/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          + New Case
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search subject / description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm focus:outline-none"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm focus:outline-none"
        >
          {PRIORITIES.map((p) => <option key={p} value={p}>{p || 'All priorities'}</option>)}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm focus:outline-none"
        >
          {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-500">Failed to load cases</p>}

      {cases.length === 0 && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No cases found</p>
          <p className="text-sm mt-1">
            <Link to="/cases/new" className="text-blue-600 hover:underline">Create your first case</Link>
            {' '}or run <code className="bg-gray-100 px-1 rounded">npm run seed</code> to load demo data.
          </p>
        </div>
      )}

      {cases.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Case #</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    <Link to={`/cases/${c.id}`} className="hover:text-blue-600">
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/cases/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1">
                      {c.isEscalated && <span className="text-red-500 mr-1" title="Escalated">⚠</span>}
                      {c.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3 text-gray-500">{c.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.contactEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmt(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
