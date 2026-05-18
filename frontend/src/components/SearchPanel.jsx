// src/components/SearchPanel.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/client'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const TAGS       = ['FEATURE', 'BUG', 'DESIGN', 'RESEARCH', 'DOCS']
const PRIO_COLOR = { LOW: 'text-accent3', MEDIUM: 'text-accent', HIGH: 'text-accent4', CRITICAL: 'text-accent2' }
const TAG_COLOR  = { FEATURE: 'text-accent', BUG: 'text-accent2', DESIGN: 'text-accent4', RESEARCH: 'text-accent3', DOCS: 'text-text2' }

function fmtD(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SearchPanel({ columns, members, onClose, onTaskClick }) {
  const [filters, setFilters] = useState({
    q: '', priority: [], tag: [], columnId: '', assigneeId: '',
    dueAfter: '', dueBefore: '', overdue: false,
    hasAttachments: false, hasSubtasks: false,
  })
  const [results, setResults]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef(null)

  const search = useCallback(async (f = filters, p = 1) => {
    setLoading(true)
    setSearched(true)
    try {
      const params = { page: p, limit: 20 }
      if (f.q)            params.q          = f.q
      if (f.columnId)     params.columnId   = f.columnId
      if (f.assigneeId)   params.assigneeId = f.assigneeId
      if (f.dueAfter)     params.dueAfter   = f.dueAfter
      if (f.dueBefore)    params.dueBefore  = f.dueBefore
      if (f.overdue)      params.overdue    = 'true'
      if (f.hasAttachments) params.hasAttachments = 'true'
      if (f.hasSubtasks)  params.hasSubtasks = 'true'
      if (f.priority.length) params.priority = f.priority.join(',')
      if (f.tag.length)   params.tag = f.tag.join(',')

      const { data } = await api.get('/search', { params })
      setResults(p === 1 ? data.tasks : prev => [...prev, ...data.tasks])
      setTotal(data.pagination.total)
      setPage(p)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filters])

  // Debounce text search
  useEffect(() => {
    if (!filters.q) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(filters, 1), 400)
    return () => clearTimeout(debounceRef.current)
  }, [filters.q])

  const toggle = (field, val) => {
    setFilters(f => {
      const arr = f[field]
      return { ...f, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
    })
  }

  const set = k => e => setFilters(f => ({ ...f, [k]: e.target.value }))
  const setB = k => e => setFilters(f => ({ ...f, [k]: e.target.checked }))

  const reset = () => {
    setFilters({ q:'', priority:[], tag:[], columnId:'', assigneeId:'', dueAfter:'', dueBefore:'', overdue:false, hasAttachments:false, hasSubtasks:false })
    setResults([]); setTotal(0); setSearched(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border flex-shrink-0">
          <span className="text-text3 text-lg">🔍</span>
          <input className="flex-1 bg-transparent outline-none text-text text-sm placeholder-text3"
            placeholder="Search tasks by title, ID, description…"
            value={filters.q} onChange={set('q')} autoFocus
            onKeyDown={e => e.key === 'Enter' && search(filters, 1)} />
          <button onClick={onClose} className="text-text3 hover:text-text">✕</button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-border flex-shrink-0 space-y-3">
          {/* Priority chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-text3 uppercase tracking-wider w-16">Priority</span>
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => toggle('priority', p)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${filters.priority.includes(p) ? 'bg-accent/15 border-accent text-accent' : 'bg-surface2 border-border text-text2'} ${PRIO_COLOR[p]}`}>
                {p}
              </button>
            ))}
          </div>

          {/* Tag chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-text3 uppercase tracking-wider w-16">Tag</span>
            {TAGS.map(t => (
              <button key={t} onClick={() => toggle('tag', t)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${filters.tag.includes(t) ? 'bg-accent/15 border-accent text-accent' : 'bg-surface2 border-border text-text2'}`}>
                {t.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Row: Status, Assignee, Due range */}
          <div className="flex gap-3 flex-wrap">
            <select className="input text-xs flex-1 min-w-[120px]" value={filters.columnId} onChange={set('columnId')}>
              <option value="">Any status</option>
              {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select className="input text-xs flex-1 min-w-[120px]" value={filters.assigneeId} onChange={set('assigneeId')}>
              <option value="">Any assignee</option>
              <option value="unassigned">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="date" className="input text-xs" value={filters.dueAfter}  onChange={set('dueAfter')}  title="Due after" />
            <input type="date" className="input text-xs" value={filters.dueBefore} onChange={set('dueBefore')} title="Due before" />
          </div>

          {/* Checkboxes */}
          <div className="flex gap-4 flex-wrap">
            {[
              ['overdue',        '⚠️ Overdue only'],
              ['hasAttachments', '📎 Has attachments'],
              ['hasSubtasks',    '☑ Has subtasks'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer text-xs text-text2">
                <input type="checkbox" checked={filters[key]} onChange={setB(key)} className="accent-accent" />
                {label}
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => search(filters, 1)} className="btn-primary px-4 py-1.5 text-xs">Search</button>
            <button onClick={reset} className="btn-secondary px-4 py-1.5 text-xs">Reset</button>
            {searched && <span className="text-xs text-text3 self-center">{total} result{total !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && page === 1 && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          )}
          {!loading && searched && results.length === 0 && (
            <div className="text-center py-10 text-text3">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm">No tasks match your filters</div>
            </div>
          )}
          {results.map(task => (
            <div key={task.id} onClick={() => { onTaskClick(task); onClose() }}
              className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-surface2 cursor-pointer transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-text3 font-semibold">{task.taskKey}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface3 ${PRIO_COLOR[task.priority]}`}>{task.priority}</span>
                  <span className="text-[10px] text-text3">{task.column?.label}</span>
                </div>
                <div className="text-sm font-medium text-text truncate">{task.title}</div>
                {task.description && <div className="text-xs text-text3 truncate mt-0.5">{task.description}</div>}
                <div className="flex gap-3 mt-1">
                  {task.dueDate && <span className="text-[10px] text-text3">📅 {fmtD(task.dueDate)}</span>}
                  {task._count?.comments > 0 && <span className="text-[10px] text-text3">💬 {task._count.comments}</span>}
                  {task._count?.attachments > 0 && <span className="text-[10px] text-text3">📎 {task._count.attachments}</span>}
                  {task._count?.subtasks > 0 && <span className="text-[10px] text-text3">☑ {task._count.subtasks}</span>}
                </div>
              </div>
              {task.assignee && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: task.assignee.avatarColor }}>{task.assignee.initials}</div>
              )}
            </div>
          ))}
          {/* Load more */}
          {results.length < total && (
            <div className="flex justify-center py-4">
              <button onClick={() => search(filters, page + 1)} disabled={loading}
                className="btn-secondary text-xs px-4 py-2 disabled:opacity-50">
                {loading ? 'Loading…' : `Load more (${total - results.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
