// src/pages/SprintsPage.jsx
import { useState, useCallback } from 'react'
import api from '../api/client'
import { useSocketEvent } from '../context/SocketContext'
import LoadingSpinner from '../components/LoadingSpinner'

function useSprintsData() {
  const [sprints, setSprints] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get('/sprints'); setSprints(data.sprints) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useState(() => { fetch() }, [])

  useSocketEvent('sprint:created', useCallback(d => setSprints(s => [d.sprint, ...s]), []))
  useSocketEvent('sprint:updated', useCallback(d => setSprints(s => s.map(x => x.id === d.sprint.id ? d.sprint : x)), []))
  useSocketEvent('sprint:deleted', useCallback(d => setSprints(s => s.filter(x => x.id !== d.sprintId)), []))
  useSocketEvent('sprint:status',  useCallback(d => setSprints(s => s.map(x => x.id === d.sprint.id ? d.sprint : x)), []))

  return { sprints, loading, refetch: fetch }
}

const STATUS_STYLE = {
  PLANNED:   'bg-text3/10 text-text3',
  ACTIVE:    'bg-accent3/10 text-accent3',
  COMPLETED: 'bg-accent/10 text-accent',
}

const STATUS_LABEL = { PLANNED: 'Planned', ACTIVE: '🟢 Active', COMPLETED: '✅ Completed' }

function fmtD(s) { return s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

function CreateSprintModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' })
  const [loading, setLoading] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault(); if (!form.name.trim()) return
    setLoading(true)
    try { await onCreate(form) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-display font-bold text-sm">🏃 New Sprint</span>
          <button onClick={onClose} className="text-text2">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="label">Sprint Name *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="e.g. Sprint 1 – May 2026" required /></div>
          <div><label className="label">Goal</label>
            <textarea className="input min-h-[60px] resize-y" value={form.goal} onChange={f('goal')} placeholder="What should this sprint achieve?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start Date</label><input type="date" className="input" value={form.startDate} onChange={f('startDate')} /></div>
            <div><label className="label">End Date</label><input type="date" className="input" value={form.endDate} onChange={f('endDate')} /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">{loading ? '…' : 'Create Sprint'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SprintsPage({ tasks, columns, canEdit, onTaskClick, toast }) {
  const { sprints, loading, refetch } = useSprintsData()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState({})

  const createSprint = async form => {
    try { await api.post('/sprints', form); refetch(); setShowCreate(false); toast('Sprint created', 'success') }
    catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
  }

  const changeStatus = async (id, status) => {
    try { await api.patch(`/sprints/${id}/status`, { status }); refetch(); toast(`Sprint ${status.toLowerCase()}`, 'success') }
    catch (e) { toast(e.response?.data?.error || 'Failed to update sprint', 'error') }
  }

  const removeTask = async (sprintId, taskId) => {
    try { await api.delete(`/sprints/${sprintId}/tasks/${taskId}`); refetch() }
    catch (e) { toast('Failed to remove task', 'error') }
  }

  const addTask = async (sprintId, taskId) => {
    try { await api.post(`/sprints/${sprintId}/tasks`, { taskId }); refetch(); toast('Task added to sprint', 'success') }
    catch (e) { toast(e.response?.data?.error || 'Failed', 'error') }
  }

  if (loading) return <div className="flex items-center justify-center flex-1"><LoadingSpinner /></div>

  const sprintTaskIds = new Set(sprints.flatMap(s => s.tasks?.map(st => st.task.id) || []))
  const backlogTasks  = tasks.filter(t => !sprintTaskIds.has(t.id))

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">Sprints</h2>
          <p className="text-xs text-text3 mt-0.5">{sprints.length} sprint{sprints.length !== 1 ? 's' : ''} · {backlogTasks.length} tasks in backlog</p>
        </div>
        {canEdit && <button onClick={() => setShowCreate(true)} className="btn-primary text-xs px-4 py-2">+ New Sprint</button>}
      </div>

      {/* Sprint cards */}
      {sprints.length === 0 && (
        <div className="text-center py-16 text-text3">
          <div className="text-4xl mb-3">🏃</div>
          <div className="text-sm">No sprints yet. Create your first sprint to get started.</div>
        </div>
      )}

      {sprints.map(sprint => {
        const isOpen = expanded[sprint.id] !== false // default open
        const done   = sprint.tasks?.filter(st => columns.find(c => c.label === 'Done')?.id === st.task.columnId).length || 0
        const total  = sprint.tasks?.length || 0

        return (
          <div key={sprint.id} className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Sprint header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer hover:bg-surface2 transition-colors"
              onClick={() => setExpanded(e => ({ ...e, [sprint.id]: !isOpen }))}>
              <span className="text-text3 text-xs">{isOpen ? '▾' : '▸'}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{sprint.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[sprint.status]}`}>{STATUS_LABEL[sprint.status]}</span>
                </div>
                {sprint.goal && <div className="text-xs text-text3 mt-0.5">{sprint.goal}</div>}
              </div>
              <div className="text-xs text-text3 hidden sm:block">{fmtD(sprint.startDate)} → {fmtD(sprint.endDate)}</div>
              <div className="text-xs text-text3">{total > 0 ? `${done}/${total} done` : 'No tasks'}</div>
              {total > 0 && (
                <div className="w-16 h-1.5 bg-surface3 rounded overflow-hidden">
                  <div className="h-full bg-accent3 rounded" style={{ width: `${total ? (done/total)*100 : 0}%` }} />
                </div>
              )}
              {/* Actions */}
              {canEdit && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {sprint.status === 'PLANNED' && (
                    <button onClick={() => changeStatus(sprint.id, 'ACTIVE')}
                      className="text-[10px] px-2 py-1 bg-accent3/10 text-accent3 border border-accent3/30 rounded-lg hover:bg-accent3/20 transition-all">
                      ▶ Start
                    </button>
                  )}
                  {sprint.status === 'ACTIVE' && (
                    <button onClick={() => changeStatus(sprint.id, 'COMPLETED')}
                      className="text-[10px] px-2 py-1 bg-accent/10 text-accent border border-accent/30 rounded-lg hover:bg-accent/20 transition-all">
                      ✓ Complete
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sprint tasks */}
            {isOpen && (
              <div>
                {sprint.tasks?.length === 0 && (
                  <div className="text-center py-6 text-text3 text-xs">No tasks in this sprint</div>
                )}
                {sprint.tasks?.map(st => (
                  <div key={st.task.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-surface2 transition-colors cursor-pointer"
                    onClick={() => onTaskClick(st.task)}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.task.column?.color || '#6c63ff' }} />
                    <span className="text-[10px] text-text3 font-semibold w-12 flex-shrink-0">{st.task.taskKey}</span>
                    <span className="flex-1 text-xs font-medium truncate">{st.task.title}</span>
                    <span className="text-[10px] text-text3 hidden sm:block">{st.task.column?.label}</span>
                    {st.task.assignee && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                        style={{ background: st.task.assignee.avatarColor }}>{st.task.assignee.initials}</div>
                    )}
                    {canEdit && (
                      <button onClick={e => { e.stopPropagation(); removeTask(sprint.id, st.task.id) }}
                        className="text-text3 hover:text-accent2 text-xs transition-colors flex-shrink-0">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Backlog */}
      {backlogTasks.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">📋 Backlog</span>
            <span className="text-xs text-text3 ml-2">({backlogTasks.length} tasks not in any sprint)</span>
          </div>
          {backlogTasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-surface2 cursor-pointer"
              onClick={() => onTaskClick(task)}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: task.column?.color || '#6c63ff' }} />
              <span className="text-[10px] text-text3 font-semibold w-12 flex-shrink-0">{task.taskKey}</span>
              <span className="flex-1 text-xs font-medium truncate">{task.title}</span>
              <span className="text-[10px] text-text3 hidden sm:block">{task.column?.label}</span>
              {task.assignee && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                  style={{ background: task.assignee.avatarColor }}>{task.assignee.initials}</div>
              )}
              {/* Add to sprint buttons */}
              {canEdit && sprints.filter(s => s.status !== 'COMPLETED').map(s => (
                <button key={s.id} onClick={e => { e.stopPropagation(); addTask(s.id, task.id) }}
                  className="text-[9px] px-1.5 py-0.5 bg-surface3 text-text3 hover:text-accent hover:bg-accent/10 rounded transition-all flex-shrink-0">
                  +{s.name.slice(0, 8)}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateSprintModal onClose={() => setShowCreate(false)} onCreate={createSprint} />}
    </div>
  )
}
