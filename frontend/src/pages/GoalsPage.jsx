// src/pages/GoalsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useSocketEvent } from '../context/SocketContext'
import LoadingSpinner from '../components/LoadingSpinner'

function useGoals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/goals'); setGoals(data.goals) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  useSocketEvent('goal:created', useCallback(d => setGoals(g => [d.goal, ...g]), []))
  useSocketEvent('goal:updated', useCallback(d => setGoals(g => g.map(x => x.id === d.goal.id ? d.goal : x)), []))
  useSocketEvent('goal:deleted', useCallback(d => setGoals(g => g.filter(x => x.id !== d.goalId)), []))

  return { goals, loading, refetch: fetch }
}

const STATUS_STYLE = {
  ACTIVE:    'bg-accent3/10 text-accent3 border-accent3/30',
  COMPLETED: 'bg-accent/10 text-accent border-accent/30',
  CANCELLED: 'bg-text3/10 text-text3 border-text3/30',
}

function GoalModal({ goal, sprints, onClose, onSave }) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    targetDate: goal?.targetDate ? goal.targetDate.split('T')[0] : '',
    status: goal?.status || 'ACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-display font-bold text-sm">🎯 {goal ? 'Edit' : 'New'} Goal</span>
          <button onClick={onClose} className="text-text2">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="label">Goal Title *</label>
            <input className="input" value={form.title} onChange={f('title')} placeholder="e.g. Launch new LMS by Q3 2026" required />
          </div>
          <div><label className="label">Description</label>
            <textarea className="input min-h-[60px] resize-y" value={form.description} onChange={f('description')} placeholder="What does success look like?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Target Date</label>
              <input type="date" className="input" value={form.targetDate} onChange={f('targetDate')} />
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={f('status')}>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">{saving ? '…' : 'Save Goal'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GoalsPage({ toast }) {
  const { goals, loading, refetch } = useGoals()
  const [sprints, setSprints] = useState([])
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    api.get('/sprints').then(({ data }) => setSprints(data.sprints)).catch(() => {})
  }, [])

  const saveGoal = async form => {
    try {
      if (editing && editing !== 'new') {
        await api.put(`/goals/${editing.id}`, form)
        toast('Goal updated', 'success')
      } else {
        await api.post('/goals', form)
        toast('Goal created', 'success')
      }
      refetch(); setEditing(null)
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
  }

  const deleteGoal = async id => {
    if (!confirm('Delete this goal?')) return
    try { await api.delete(`/goals/${id}`); refetch(); toast('Deleted', 'error') }
    catch { toast('Failed', 'error') }
  }

  const linkSprint = async (goalId, sprintId) => {
    try { await api.post(`/goals/${goalId}/sprints`, { sprintId }); refetch(); toast('Sprint linked', 'success') }
    catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
  }

  const unlinkSprint = async (goalId, sprintId) => {
    try { await api.delete(`/goals/${goalId}/sprints/${sprintId}`); refetch() }
    catch { toast('Failed', 'error') }
  }

  function fmtD(s) { return s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

  if (loading) return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>

  // Get unlinked sprints for a goal
  const linkedSprintIds = (goal) => new Set(goal.sprints?.map(gs => gs.sprint.id) || [])

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">🎯 Goals & OKRs</h2>
          <p className="text-xs text-text3 mt-0.5">Link sprints to higher-level objectives</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary text-xs px-4 py-2">+ New Goal</button>
      </div>

      {goals.length === 0 && (
        <div className="text-center py-14 text-text3">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm">No goals yet.</div>
          <div className="text-xs mt-1">Create goals to link your sprints to higher-level objectives like NAAC accreditation or LMS launch.</div>
        </div>
      )}

      {goals.map(goal => {
        const isOpen = expanded[goal.id] !== false
        const linked = linkedSprintIds(goal)
        const availableSprints = sprints.filter(s => !linked.has(s.id))
        const totalTasks = goal.sprints?.reduce((a, gs) => a + (gs.sprint._count?.tasks || 0), 0) || 0

        return (
          <div key={goal.id} className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer hover:bg-surface2 transition-colors"
              onClick={() => setExpanded(e => ({ ...e, [goal.id]: !isOpen }))}>
              <span className="text-text3 text-xs">{isOpen ? '▾' : '▸'}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{goal.title}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[goal.status]}`}>{goal.status}</span>
                </div>
                {goal.description && <div className="text-xs text-text3 mt-0.5">{goal.description}</div>}
              </div>
              <div className="text-xs text-text3 hidden sm:block">Target: {fmtD(goal.targetDate)}</div>
              <div className="text-xs text-text3">{goal._count?.sprints || 0} sprints · {totalTasks} tasks</div>
              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-surface3 rounded overflow-hidden">
                  <div className="h-full bg-accent3 rounded" style={{ width: `${goal.progress}%` }} />
                </div>
                <span className="text-[10px] text-text3">{goal.progress}%</span>
              </div>
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => setEditing(goal)} className="text-xs px-2.5 py-1 bg-surface2 border border-border rounded-lg text-text2 hover:text-text">Edit</button>
                <button onClick={() => deleteGoal(goal.id)} className="text-xs px-2.5 py-1 bg-accent2/10 border border-accent2/30 rounded-lg text-accent2">Delete</button>
              </div>
            </div>

            {isOpen && (
              <div className="p-4 space-y-3">
                {/* Linked sprints */}
                {goal.sprints?.length === 0 && <div className="text-xs text-text3">No sprints linked yet</div>}
                {goal.sprints?.map(gs => (
                  <div key={gs.sprint.id} className="flex items-center gap-3 bg-surface2 border border-border rounded-lg px-3 py-2.5">
                    <div className="flex-1">
                      <div className="text-xs font-semibold">{gs.sprint.name}</div>
                      <div className="text-[10px] text-text3 mt-0.5">{gs.sprint._count?.tasks || 0} tasks · {gs.sprint.status}</div>
                    </div>
                    <button onClick={() => unlinkSprint(goal.id, gs.sprint.id)}
                      className="text-[10px] text-text3 hover:text-accent2 transition-colors">✕ Unlink</button>
                  </div>
                ))}

                {/* Link new sprint */}
                {availableSprints.length > 0 && (
                  <div className="flex gap-2">
                    <select className="input text-xs flex-1" id={`sprint-sel-${goal.id}`}>
                      <option value="">Link a sprint…</option>
                      {availableSprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button onClick={() => {
                      const sel = document.getElementById(`sprint-sel-${goal.id}`)
                      if (sel.value) linkSprint(goal.id, sel.value)
                    }} className="btn-primary text-xs px-3 py-1.5">Link</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {editing && (
        <GoalModal goal={editing === 'new' ? null : editing} sprints={sprints}
          onClose={() => setEditing(null)} onSave={saveGoal} />
      )}
    </div>
  )
}
