import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export default function CreateCase() {
  const nav = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'normal',
    type: 'question',
    issueType: 'post_sales',
    channel: 'web',
    category: '',
    subcategory: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    tags: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () =>
      api.cases.create({
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        category: form.category || undefined,
        subcategory: form.subcategory || undefined,
        contactName: form.contactName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
      } as any),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['cases'] })
      nav(`/cases/${c.id}`)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  const field = 'block w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300'
  const label = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">New Case</h1>
        <p className="text-sm text-gray-500 mt-1">All fields except Subject and Description are optional.</p>
      </div>

      <form onSubmit={submit} className="space-y-5 bg-white border rounded-lg p-6">
        <div>
          <label className={label}>Subject *</label>
          <input className={field} value={form.subject} onChange={set('subject')} required placeholder="Brief summary of the issue" />
        </div>

        <div>
          <label className={label}>Description *</label>
          <textarea className={field} value={form.description} onChange={set('description')} required rows={4} placeholder="Full details of the issue" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Priority</label>
            <select className={field} value={form.priority} onChange={set('priority')}>
              {['low', 'normal', 'high', 'urgent', 'critical'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Type</label>
            <select className={field} value={form.type} onChange={set('type')}>
              {['question', 'problem', 'incident', 'feature_request', 'task'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Issue Type</label>
            <select className={field} value={form.issueType} onChange={set('issueType')}>
              {['pre_sales', 'post_sales', 'technical', 'customer_service'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Channel</label>
            <select className={field} value={form.channel} onChange={set('channel')}>
              {['web', 'email', 'phone', 'api', 'chat', 'social'].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Category</label>
            <input className={field} value={form.category} onChange={set('category')} placeholder="e.g. billing, general-info" />
          </div>
          <div>
            <label className={label}>Subcategory</label>
            <input className={field} value={form.subcategory} onChange={set('subcategory')} placeholder="e.g. invoice, using-aws" />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Name</label>
              <input className={field} value={form.contactName} onChange={set('contactName')} placeholder="Jane Smith" />
            </div>
            <div>
              <label className={label}>Email</label>
              <input className={field} type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="jane@example.com" />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input className={field} value={form.contactPhone} onChange={set('contactPhone')} placeholder="+1 555 000 0000" />
            </div>
          </div>
        </div>

        <div>
          <label className={label}>Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input className={field} value={form.tags} onChange={set('tags')} placeholder="enterprise, urgent, onboarding" />
        </div>

        {mutation.error && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Case'}
          </button>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-5 py-2 border text-sm rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
