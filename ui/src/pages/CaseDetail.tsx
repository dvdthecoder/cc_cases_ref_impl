import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { StatusBadge, PriorityBadge } from '../components/StatusBadge'
import EventTimeline from '../components/EventTimeline'
import ExportPanel from '../components/ExportPanel'

type Tab = 'details' | 'comments' | 'events' | 'export'

function ActionBar({ caseId, status, isEscalated }: { caseId: string; status: string; isEscalated: boolean }) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['case', caseId] })

  const escalate = useMutation({ mutationFn: () => api.cases.escalate(caseId), onSuccess: inv })
  const close = useMutation({ mutationFn: () => api.cases.close(caseId), onSuccess: inv })
  const reopen = useMutation({ mutationFn: () => api.cases.reopen(caseId), onSuccess: inv })
  const [resolveText, setResolveText] = useState('')
  const [showResolve, setShowResolve] = useState(false)
  const resolve = useMutation({
    mutationFn: () => api.cases.resolve(caseId, resolveText),
    onSuccess: () => { inv(); setShowResolve(false); setResolveText('') },
  })

  const btn = 'px-3 py-1.5 text-xs rounded border font-medium disabled:opacity-40 hover:bg-gray-50'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!isEscalated && !['closed', 'resolved'].includes(status) && (
          <button className={`${btn} border-red-300 text-red-600 hover:bg-red-50`} onClick={() => escalate.mutate()} disabled={escalate.isPending}>
            ⚠ Escalate
          </button>
        )}
        {!['closed', 'resolved'].includes(status) && (
          <button className={`${btn} border-purple-300 text-purple-600 hover:bg-purple-50`} onClick={() => setShowResolve(true)}>
            ✓ Resolve
          </button>
        )}
        {status !== 'closed' && (
          <button className={`${btn} border-gray-300 text-gray-600`} onClick={() => close.mutate()} disabled={close.isPending}>
            ✕ Close
          </button>
        )}
        {['closed', 'resolved'].includes(status) && (
          <button className={`${btn} border-green-300 text-green-600 hover:bg-green-50`} onClick={() => reopen.mutate()} disabled={reopen.isPending}>
            ↺ Reopen
          </button>
        )}
      </div>
      {showResolve && (
        <div className="flex gap-2 mt-2">
          <input
            autoFocus
            className="border rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="Resolution summary…"
            value={resolveText}
            onChange={(e) => setResolveText(e.target.value)}
          />
          <button
            onClick={() => resolve.mutate()}
            disabled={!resolveText || resolve.isPending}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded disabled:opacity-40"
          >
            Submit
          </button>
          <button onClick={() => setShowResolve(false)} className="px-3 py-1.5 border text-sm rounded">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function CommentSection({ caseId }: { caseId: string }) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')

  const { data } = useQuery({
    queryKey: ['comments', caseId],
    queryFn: () => api.comments.list(caseId),
    refetchInterval: 5_000,
  })

  const add = useMutation({
    mutationFn: () => api.comments.create(caseId, { body, authorName: authorName || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', caseId] })
      qc.invalidateQueries({ queryKey: ['case', caseId] })
      setBody('')
    },
  })

  const comments = data?.comments ?? []
  const fmt = (ts: string) => new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="space-y-4">
      {comments.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">{c.authorName ?? 'Anonymous'}</span>
            <span className="text-xs text-gray-400">{fmt(c.createdAt)}</span>
            {!c.isPublic && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 rounded">internal</span>}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
        </div>
      ))}

      <div className="border-t pt-4 space-y-2">
        <input
          className="block w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
        <textarea
          className="block w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="Add a comment…"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          onClick={() => add.mutate()}
          disabled={!body.trim() || add.isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40"
        >
          {add.isPending ? 'Posting…' : 'Post Comment'}
        </button>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | boolean | string[] | null }) {
  if (value === undefined || value === null || value === '') return null
  const display = Array.isArray(value) ? value.join(', ') : String(value)
  return (
    <div className="flex gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{display || '—'}</span>
    </div>
  )
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('details')

  const { data: c, isLoading, error } = useQuery({
    queryKey: ['case', id],
    queryFn: () => api.cases.get(id!),
    refetchInterval: 5_000,
    enabled: !!id,
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (error || !c) return <p className="text-sm text-red-500">Case not found</p>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'comments', label: `Comments (${c.commentCount})` },
    { key: 'events', label: 'Events' },
    { key: 'export', label: 'Export' },
  ]

  return (
    <div className="max-w-3xl">
      <div className="mb-2">
        <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">← All cases</Link>
      </div>

      <div className="bg-white border rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-400">{c.caseNumber}</span>
              {c.isEscalated && <span className="text-xs bg-red-100 text-red-700 px-1.5 rounded">escalated</span>}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{c.subject}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <StatusBadge status={c.status} />
              <PriorityBadge priority={c.priority} />
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.type.replace('_', ' ')}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.issueType.replace('_', ' ')}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.channel}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ActionBar
            caseId={c.id}
            status={c.status}
            isEscalated={c.isEscalated}
          />
        </div>
      </div>

      <div className="flex border-b mb-6 gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="bg-white border rounded-lg p-6 space-y-0">
          <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">{c.description}</p>
          {c.resolution && (
            <div className="bg-purple-50 border border-purple-200 rounded p-3 mb-4">
              <p className="text-xs font-semibold text-purple-700 mb-1">Resolution</p>
              <p className="text-sm text-purple-800">{c.resolution}</p>
            </div>
          )}
          <div className="border-t pt-4">
            <DetailRow label="Contact" value={c.contactName} />
            <DetailRow label="Email" value={c.contactEmail} />
            <DetailRow label="Phone" value={c.contactPhone} />
            <DetailRow label="Account ID" value={c.accountId} />
            <DetailRow label="Assignee" value={c.assigneeId} />
            <DetailRow label="Category" value={c.category} />
            <DetailRow label="Subcategory" value={c.subcategory} />
            <DetailRow label="Tags" value={c.tags.length > 0 ? c.tags : null} />
            <DetailRow label="CC Emails" value={c.ccEmailAddresses.length > 0 ? c.ccEmailAddresses : null} />
            <DetailRow label="Created" value={new Date(c.createdAt).toLocaleString()} />
            <DetailRow label="Updated" value={new Date(c.updatedAt).toLocaleString()} />
          </div>
          {Object.keys(c.customFields).length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Custom Fields</p>
              <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto">{JSON.stringify(c.customFields, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {tab === 'comments' && (
        <div className="bg-white border rounded-lg p-6">
          <CommentSection caseId={c.id} />
        </div>
      )}

      {tab === 'events' && (
        <div className="bg-white border rounded-lg p-6">
          <EventTimeline caseId={c.id} />
        </div>
      )}

      {tab === 'export' && (
        <div className="bg-white border rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-6">
            Preview the exact API payload this case generates for each platform. "Simulate Push" records a <code className="bg-gray-100 px-1 rounded text-xs">case.exported</code> event — no real HTTP calls are made.
          </p>
          <ExportPanel caseId={c.id} />
        </div>
      )}
    </div>
  )
}
