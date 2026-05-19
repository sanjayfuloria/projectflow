// src/pages/AutomationsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const TRIGGERS = [
  { value: 'task_created',      label: '✨ Task created' },
  { value: 'status_changed',    label: '🔀 Status changed to…' },
  { value: 'priority_changed',  label: '🎯 Priority changed to…' },
  { value: 'assignee_changed',  label: '👤 Assignee changed' },
  { value: 'due_date_passed',   label: '⚠️ Due date passed' },
]

const ACTIONS = [
  { value: 'assign_to',        label: '👤 Assign to member' },
  { value: 'set_priority',     label: '🎯 Set priority' },
  { value: 'set_tag',          label: '🏷 Set tag' },
  { value: 'move_to_column',   label: '🔀 Move to column' },
  { value: 'send_notification', label: '🔔 Send notification' },
  { value: 'post_slack',       label: '💬 Post to Slack' },
]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const TAGS       = ['FEATURE', 'BUG', 'DESIGN', 'RESEARCH', 'DOCS']

function RuleModal({ rule, columns, members, onClose, onSave }) {
  const [form, setForm] = useState({
    name: rule?.name || '',
    trigger: rule?.trigger || 'task_created',
    triggerValue: rule?.triggerValue || '',
    action: rule?.action || 'send_notification',
    actionValue: rule?.actionValue || '',
    enabled: rule?.enabled ?? true,
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const needsTriggerValue = ['status_changed', 'priority_changed'].includes(form.trigger)
  const needsActionValue  = ['assign_to', 'set_priority', 'set_tag', 'move_to_column', 'send_notification', 'post_slack'].includes(form.action)

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-display font-bold text-sm">⚡ {rule ? 'Edit' : 'New'} Automation Rule</span>
          <button onClick={onClose} className="text-text2">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="label">Rule Name</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="e.g. Auto-assign critical bugs" required />
          </div>

          {/* Trigger */}
          <div><label className="label">When (Trigger)</label>
            <select className="input" value={form.trigger} onChange={f('trigger')}>
              {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {needsTriggerValue && (
            <div><label className="label">{form.trigger === 'status_changed' ? 'To column' : 'To priority'}</label>
              {form.trigger === 'status_changed'
                ? <select className="input" value={form.triggerValue} onChange={f('triggerValue')}>
                    <option value="">Any column</option>
                    {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                : <select className="input" value={form.triggerValue} onChange={f('triggerValue')}>
                    <option value="">Any priority</option>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
              }
            </div>
          )}

          {/* Action */}
          <div><label className="label">Then (Action)</label>
            <select className="input" value={form.action} onChange={f('action')}>
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          {needsActionValue && (
            <div><label className="label">Action value</label>
              {form.action === 'assign_to' && (
                <select className="input" value={form.actionValue} onChange={f('actionValue')}>
                  <option value="">Select member…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              {form.action === 'set_priority' && (
                <select className="input" value={form.actionValue} onChange={f('actionValue')}>
                  <option value="">Select priority…</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {form.action === 'set_tag' && (
                <select className="input" value={form.actionValue} onChange={f('actionValue')}>
                  <option value="">Select tag…</option>
                  {TAGS.map(t => <option key={t} value={t}>{t.toLowerCase()}</option>)}
                </select>
              )}
              {form.action === 'move_to_column' && (
                <select className="input" value={form.actionValue} onChange={f('actionValue')}>
                  <option value="">Select column…</option>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              {(form.action === 'send_notification' || form.action === 'post_slack') && (
                <input className="input" value={form.actionValue} onChange={f('actionValue')} placeholder="Custom message (optional)" />
              )}
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer text-sm text-text2">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))} className="accent-accent" />
            Rule is enabled
          </label>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">{saving ? '…' : 'Save Rule'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AutomationsPage({ columns, members, toast }) {
  const [rules, setRules]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | rule object
  const [slackConfig, setSlackConfig] = useState({ webhookUrl: '', channel: '', enabled: true })
  const [slackSaving, setSlackSaving] = useState(false)
  const [slackTesting, setSlackTesting] = useState(false)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/automations'); setRules(data.rules) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchRules()
    api.get('/slack/config').then(({ data }) => {
      if (data.config) setSlackConfig({ webhookUrl: data.config.webhookUrl, channel: data.config.channel || '', enabled: data.config.enabled })
    }).catch(() => {})
  }, [fetchRules])

  const saveRule = async form => {
    try {
      if (editing && editing !== 'new') {
        await api.put(`/automations/${editing.id}`, form)
        toast('Rule updated', 'success')
      } else {
        await api.post('/automations', form)
        toast('Rule created', 'success')
      }
      fetchRules(); setEditing(null)
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
  }

  const toggleRule = async (rule) => {
    try { await api.put(`/automations/${rule.id}`, { enabled: !rule.enabled }); fetchRules() }
    catch { toast('Failed', 'error') }
  }

  const deleteRule = async id => {
    if (!confirm('Delete this rule?')) return
    try { await api.delete(`/automations/${id}`); fetchRules(); toast('Deleted', 'error') }
    catch { toast('Failed', 'error') }
  }

  const saveSlack = async () => {
    setSlackSaving(true)
    try { await api.post('/slack/config', slackConfig); toast('Slack config saved!', 'success') }
    catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
    finally { setSlackSaving(false) }
  }

  const testSlack = async () => {
    setSlackTesting(true)
    try { const { data } = await api.post('/slack/test', { webhookUrl: slackConfig.webhookUrl }); toast(data.message, 'success') }
    catch (e) { toast(e.response?.data?.error || 'Test failed', 'error') }
    finally { setSlackTesting(false) }
  }

  const getTriggerLabel  = v => TRIGGERS.find(t => t.value === v)?.label || v
  const getActionLabel   = v => ACTIONS.find(a => a.value === v)?.label || v
  const getColumnLabel   = id => columns.find(c => c.id === id)?.label || id
  const getMemberName    = id => members.find(m => m.id === id)?.name || id

  function actionValueLabel(rule) {
    switch (rule.action) {
      case 'assign_to':      return getMemberName(rule.actionValue)
      case 'move_to_column': return getColumnLabel(rule.actionValue)
      default:               return rule.actionValue || '—'
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">⚡ Automation Rules</h2>
          <p className="text-xs text-text3 mt-0.5">Automate repetitive actions — trigger → condition → action</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary text-xs px-4 py-2">+ New Rule</button>
      </div>

      {/* Rules list */}
      {loading && <div className="text-text3 text-sm text-center py-8">Loading…</div>}
      {!loading && rules.length === 0 && (
        <div className="text-center py-12 text-text3">
          <div className="text-4xl mb-3">⚡</div>
          <div className="text-sm">No automation rules yet.</div>
          <div className="text-xs mt-1">Create your first rule to automate repetitive tasks.</div>
        </div>
      )}

      <div className="space-y-3">
        {rules.map(rule => (
          <div key={rule.id} className={`bg-surface border rounded-xl p-4 transition-all ${rule.enabled ? 'border-border' : 'border-border/50 opacity-60'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{rule.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-accent3/10 text-accent3' : 'bg-text3/10 text-text3'}`}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text2 flex-wrap">
                  <span className="bg-surface2 border border-border rounded px-2 py-1">{getTriggerLabel(rule.trigger)}</span>
                  {rule.triggerValue && <span className="text-text3">→ <span className="text-text">{getColumnLabel(rule.triggerValue)}</span></span>}
                  <span className="text-text3">then</span>
                  <span className="bg-accent/10 border border-accent/20 text-accent rounded px-2 py-1">{getActionLabel(rule.action)}</span>
                  {rule.actionValue && <span className="text-text3">: <span className="text-text">{actionValueLabel(rule)}</span></span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleRule(rule)} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${rule.enabled ? 'bg-surface2 border-border text-text2 hover:text-text' : 'bg-accent3/10 border-accent3/30 text-accent3'}`}>
                  {rule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => setEditing(rule)} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-surface2 text-text2 hover:text-text transition-all">Edit</button>
                <button onClick={() => deleteRule(rule.id)} className="text-xs px-3 py-1.5 rounded-lg border border-accent2/30 bg-accent2/10 text-accent2 hover:bg-accent2/20 transition-all">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slack Configuration */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-display font-bold text-sm mb-1">💬 Slack Integration</h3>
        <p className="text-xs text-text3 mb-4">
          Get notified in Slack when tasks are created, moved, or sprints start.{' '}
          <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            How to get a webhook URL →
          </a>
        </p>
        <div className="space-y-3">
          <div><label className="label">Webhook URL</label>
            <input className="input font-mono text-xs" value={slackConfig.webhookUrl}
              onChange={e => setSlackConfig(s => ({ ...s, webhookUrl: e.target.value }))}
              placeholder="https://hooks.slack.com/services/T.../B.../..." />
          </div>
          <div><label className="label">Channel (optional)</label>
            <input className="input" value={slackConfig.channel}
              onChange={e => setSlackConfig(s => ({ ...s, channel: e.target.value }))}
              placeholder="#projectflow-alerts" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-text2">
            <input type="checkbox" checked={slackConfig.enabled}
              onChange={e => setSlackConfig(s => ({ ...s, enabled: e.target.checked }))} className="accent-accent" />
            Enable Slack notifications
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={saveSlack} disabled={slackSaving} className="btn-primary text-xs px-4 py-2 disabled:opacity-60">{slackSaving ? 'Saving…' : 'Save'}</button>
            <button onClick={testSlack} disabled={slackTesting || !slackConfig.webhookUrl} className="btn-secondary text-xs px-4 py-2 disabled:opacity-50">{slackTesting ? 'Sending…' : '🧪 Test'}</button>
          </div>
        </div>
      </div>

      {editing && (
        <RuleModal rule={editing === 'new' ? null : editing} columns={columns} members={members}
          onClose={() => setEditing(null)} onSave={saveRule} />
      )}
    </div>
  )
}
