// src/pages/IntakeFormsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const DEFAULT_FIELDS = [
  { id: 'title',       label: 'Task Title',   type: 'text',     required: true },
  { id: 'description', label: 'Description',  type: 'textarea', required: false },
  { id: 'email',       label: 'Your Email',   type: 'email',    required: false },
]

function FormModal({ form, columns, members, onClose, onSave }) {
  const [data, setData] = useState({
    name:              form?.name || '',
    description:       form?.description || '',
    columnId:          form?.columnId || columns[0]?.id || '',
    defaultPriority:   form?.defaultPriority || 'MEDIUM',
    defaultTag:        form?.defaultTag || 'FEATURE',
    defaultAssigneeId: form?.defaultAssigneeId || '',
    slug:              form?.slug || '',
    enabled:           form?.enabled ?? true,
    fields:            form?.fields || DEFAULT_FIELDS,
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setData(p => ({ ...p, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(data) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
          <span className="font-display font-bold text-sm">📋 {form ? 'Edit' : 'New'} Intake Form</span>
          <button onClick={onClose} className="text-text2">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="label">Form Name *</label>
            <input className="input" value={data.name} onChange={f('name')} placeholder="e.g. Bug Report Form" required />
          </div>
          <div><label className="label">Description</label>
            <textarea className="input min-h-[55px] resize-y" value={data.description} onChange={f('description')} placeholder="Shown at the top of the form" />
          </div>
          <div><label className="label">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text3 flex-shrink-0">/form/</span>
              <input className="input flex-1" value={data.slug} onChange={f('slug')} placeholder="bug-report (auto-generated if empty)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Assign to column</label>
              <select className="input" value={data.columnId} onChange={f('columnId')}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div><label className="label">Default priority</label>
              <select className="input" value={data.defaultPriority} onChange={f('defaultPriority')}>
                {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Default tag</label>
              <select className="input" value={data.defaultTag} onChange={f('defaultTag')}>
                {['FEATURE','BUG','DESIGN','RESEARCH','DOCS'].map(t => <option key={t}>{t.toLowerCase()}</option>)}
              </select>
            </div>
            <div><label className="label">Auto-assign to</label>
              <select className="input" value={data.defaultAssigneeId} onChange={f('defaultAssigneeId')}>
                <option value="">Nobody (unassigned)</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-text2">
            <input type="checkbox" checked={data.enabled} onChange={e => setData(p => ({ ...p, enabled: e.target.checked }))} className="accent-accent" />
            Form is publicly accessible
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">{saving ? '…' : 'Save Form'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function IntakeFormsPage({ columns, members, toast }) {
  const [forms, setForms]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/intake'); setForms(data.forms) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchForms() }, [fetchForms])

  const saveForm = async formData => {
    try {
      if (editing && editing !== 'new') {
        await api.put(`/intake/${editing.id}`, formData)
        toast('Form updated', 'success')
      } else {
        await api.post('/intake', formData)
        toast('Form created', 'success')
      }
      fetchForms(); setEditing(null)
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
  }

  const deleteForm = async id => {
    if (!confirm('Delete this form?')) return
    try { await api.delete(`/intake/${id}`); fetchForms(); toast('Deleted', 'error') }
    catch { toast('Failed', 'error') }
  }

  const toggleForm = async form => {
    try { await api.put(`/intake/${form.id}`, { enabled: !form.enabled }); fetchForms() }
    catch { toast('Failed', 'error') }
  }

  const copyLink = slug => {
    const url = `${window.location.origin}/form/${slug}`
    navigator.clipboard.writeText(url)
    toast('Link copied!', 'success')
  }

  const APP_URL = window.location.origin

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">📋 Intake Forms</h2>
          <p className="text-xs text-text3 mt-0.5">Public forms that create tasks — share with students, faculty, or anyone</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary text-xs px-4 py-2">+ New Form</button>
      </div>

      {loading && <div className="text-text3 text-sm text-center py-8">Loading…</div>}
      {!loading && forms.length === 0 && (
        <div className="text-center py-12 text-text3">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm">No intake forms yet.</div>
          <div className="text-xs mt-1">Create a form to let people submit tasks without logging in.</div>
          <div className="text-xs mt-2 text-accent">Perfect for bug reports, feature requests, or student submissions!</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {forms.map(form => (
          <div key={form.id} className={`bg-surface border rounded-xl p-4 ${form.enabled ? 'border-border' : 'border-border/50 opacity-70'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{form.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${form.enabled ? 'bg-accent3/10 text-accent3' : 'bg-text3/10 text-text3'}`}>
                    {form.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                {form.description && <p className="text-xs text-text3 mb-2">{form.description}</p>}
                <div className="flex items-center gap-2 text-xs text-text3 bg-surface2 border border-border rounded-lg px-3 py-2 mb-2">
                  <span className="truncate font-mono">{APP_URL}/form/{form.slug}</span>
                  <button onClick={() => copyLink(form.slug)} className="text-accent hover:underline flex-shrink-0 ml-auto">Copy</button>
                  <a href={`/form/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex-shrink-0">Open ↗</a>
                </div>
                <div className="flex gap-4 text-[10px] text-text3">
                  <span>📥 {form._count?.submissions || 0} submissions</span>
                  <span>📋 → {columns.find(c => c.id === form.columnId)?.label || 'Unknown'}</span>
                  <span>🎯 {form.defaultPriority}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleForm(form)} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface2 text-text2 hover:text-text">
                  {form.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => setEditing(form)} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface2 text-text2 hover:text-text">Edit</button>
                <button onClick={() => deleteForm(form.id)} className="text-xs px-3 py-1.5 rounded-lg border border-accent2/30 bg-accent2/10 text-accent2">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <FormModal form={editing === 'new' ? null : editing} columns={columns} members={members}
          onClose={() => setEditing(null)} onSave={saveForm} />
      )}
    </div>
  )
}
