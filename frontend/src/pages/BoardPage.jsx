// src/pages/BoardPage.jsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocketEvent } from '../context/SocketContext'
import { useTasks, useColumns, useMembers } from '../hooks/useData'
import api from '../api/client'
import Topbar from '../components/Topbar'
import LoadingSpinner from '../components/LoadingSpinner'
import SearchPanel from '../components/SearchPanel'
import SprintsPage from './SprintsPage'
import TimelinePage from './TimelinePage'
import AutomationsPage from './AutomationsPage'
import IntakeFormsPage from './IntakeFormsPage'
import WorkloadPage from './WorkloadPage'
import GoalsPage from './GoalsPage'

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const isOD     = t => t.dueDate && new Date(t.dueDate) < new Date(todayStr())
const fmtD     = s => s ? new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : ''
const fmtBytes = b => b>1024*1024?`${(b/1024/1024).toFixed(1)} MB`:`${Math.round(b/1024)} KB`
const PRIO_DOT = {LOW:'bg-accent3',MEDIUM:'bg-accent',HIGH:'bg-accent4',CRITICAL:'bg-accent2 shadow-[0_0_5px_rgba(255,101,132,.5)]'}
const TAG_CLS  = {FEATURE:'bg-accent/10 text-accent',BUG:'bg-accent2/10 text-accent2',DESIGN:'bg-accent4/10 text-accent4',RESEARCH:'bg-accent3/10 text-accent3',DOCS:'bg-text2/10 text-text2'}
const FILE_ICON = mime => mime?.startsWith('image/')?'🖼':mime==='application/pdf'?'📄':mime?.includes('word')?'📝':mime?.includes('sheet')||mime?.includes('excel')?'📊':'📎'

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts,setToasts] = useState([])
  const add = useCallback((msg,type='success') => {
    const id = Date.now()
    setToasts(t=>[...t.slice(-4),{id,msg,type}])
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),2800)
  },[])
  return {toasts,add}
}

// ── Mention-aware textarea ────────────────────────────────────────────────────
function MentionInput({ value, onChange, onSubmit, members, placeholder }) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [mentionStart, setMentionStart] = useState(-1)
  const ref = useRef(null)

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) { e.preventDefault(); onSubmit() }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  const handleChange = e => {
    const val = e.target.value
    onChange(val)
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const atIdx = textBefore.lastIndexOf('@')
    if (atIdx !== -1 && !textBefore.slice(atIdx+1).includes(' ')) {
      const query = textBefore.slice(atIdx+1).toLowerCase()
      const matches = members.filter(m =>
        m.name.toLowerCase().includes(query) || m.initials.toLowerCase().includes(query)
      )
      setSuggestions(matches.slice(0,5))
      setShowSuggestions(matches.length > 0)
      setMentionStart(atIdx)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectMention = member => {
    const before = value.slice(0, mentionStart)
    const after  = value.slice(ref.current?.selectionStart || value.length)
    onChange(`${before}@${member.initials} ${after}`)
    setShowSuggestions(false)
    ref.current?.focus()
  }

  return (
    <div className="relative">
      <textarea ref={ref} className="input text-xs resize-none" rows={2} value={value}
        onChange={handleChange} onKeyDown={handleKeyDown} placeholder={placeholder} />
      {showSuggestions && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-surface2 border border-border rounded-lg shadow-xl z-10 overflow-hidden">
          {suggestions.map(m => (
            <div key={m.id} onClick={() => selectMention(m)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-surface3 cursor-pointer">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                style={{background:m.avatarColor}}>{m.initials}</div>
              <span className="text-xs">{m.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Render comment with highlighted @mentions ─────────────────────────────────
function CommentText({ content }) {
  const parts = content.split(/(@\w+)/g)
  return (
    <p className="text-xs text-text2 leading-relaxed">
      {parts.map((part, i) =>
        /^@\w+$/.test(part)
          ? <span key={i} className="text-accent font-semibold bg-accent/10 px-0.5 rounded">{part}</span>
          : part
      )}
    </p>
  )
}

// ── Activity Log panel ────────────────────────────────────────────────────────
function ActivityPanel({ taskId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/activity', { params: { taskId } })
      .then(({ data }) => setLogs(data.logs))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  const ACTION_ICON = {
    CREATED:'✨',STATUS_CHANGED:'🔀',ASSIGNED:'👤',PRIORITY_CHANGED:'🎯',
    DUE_DATE_CHANGED:'📅',COMMENT_ADDED:'💬',ATTACHMENT_ADDED:'📎',
    SUBTASK_ADDED:'☑',DEPENDENCY_ADDED:'🔗',ADDED_TO_SPRINT:'🏃',
    REMOVED_FROM_SPRINT:'❌',PROGRESS_UPDATED:'📈',UPDATED:'✏️',
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff/60000)
    if (m<1) return 'just now'
    if (m<60) return `${m}m ago`
    const h = Math.floor(m/60)
    if (h<24) return `${h}h ago`
    return `${Math.floor(h/24)}d ago`
  }

  if (loading) return <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
  if (!logs.length) return <div className="text-xs text-text3 py-4 text-center">No activity yet</div>

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex gap-2.5 items-start">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
            style={{background:log.user?.avatarColor}}>{log.user?.initials}</div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] mr-1">{ACTION_ICON[log.action] || '•'}</span>
            <span className="text-xs text-text2">
              <span className="font-semibold text-text">{log.user?.name}</span>
              {' '}
              {log.action === 'CREATED' && 'created this task'}
              {log.action === 'STATUS_CHANGED' && `moved to ${log.newValue}`}
              {log.action === 'ASSIGNED' && `assigned to ${log.newValue || 'nobody'}`}
              {log.action === 'PRIORITY_CHANGED' && `changed priority to ${log.newValue}`}
              {log.action === 'DUE_DATE_CHANGED' && `set due date to ${log.newValue || 'none'}`}
              {log.action === 'COMMENT_ADDED' && 'added a comment'}
              {log.action === 'ATTACHMENT_ADDED' && `attached ${log.newValue}`}
              {log.action === 'SUBTASK_ADDED' && `added subtask "${log.newValue}"`}
              {log.action === 'DEPENDENCY_ADDED' && `added dependency: ${log.newValue}`}
              {log.action === 'ADDED_TO_SPRINT' && `added to sprint "${log.newValue}"`}
              {log.action === 'REMOVED_FROM_SPRINT' && 'removed from sprint'}
              {log.action === 'PROGRESS_UPDATED' && `updated progress to ${log.newValue}%`}
              {log.action === 'UPDATED' && `updated ${log.field || 'task'}`}
            </span>
            {log.oldValue && log.newValue && !['STATUS_CHANGED','ASSIGNED','PRIORITY_CHANGED'].includes(log.action) && (
              <div className="text-[10px] text-text3 mt-0.5">
                <span className="line-through opacity-60">{log.oldValue}</span> → {log.newValue}
              </div>
            )}
          </div>
          <span className="text-[10px] text-text3 flex-shrink-0">{timeAgo(log.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Dependencies panel ────────────────────────────────────────────────────────
function DependenciesPanel({ taskId, allTasks, canEdit }) {
  const [deps, setDeps] = useState({ blockedBy: [], blocks: [] })
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(null) // 'blocking' | 'blocked'
  const [selTask, setSelTask] = useState('')

  const fetchDeps = useCallback(async () => {
    try {
      const { data } = await api.get('/dependencies', { params: { taskId } })
      setDeps(data)
    } catch {}
    finally { setLoading(false) }
  }, [taskId])

  useEffect(() => { fetchDeps() }, [fetchDeps])

  const addDep = async () => {
    if (!selTask) return
    try {
      const body = adding === 'blocking'
        ? { blockingTaskId: selTask,  blockedTaskId: taskId }
        : { blockingTaskId: taskId,   blockedTaskId: selTask }
      await api.post('/dependencies', body)
      fetchDeps(); setAdding(null); setSelTask('')
    } catch (e) { alert(e.response?.data?.error || 'Failed') }
  }

  const removeDep = async id => {
    try { await api.delete(`/dependencies/${id}`); fetchDeps() } catch {}
  }

  const depRow = (task, depId, label) => (
    <div key={depId} className="flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3 py-2">
      <span className="text-[10px] text-text3 font-semibold">{task.taskKey}</span>
      <span className="flex-1 text-xs truncate">{task.title}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${label==='blocks'?'bg-accent2/10 text-accent2':'bg-accent4/10 text-accent4'}`}>{label}</span>
      {canEdit && <button onClick={() => removeDep(depId)} className="text-text3 hover:text-accent2 text-xs">✕</button>}
    </div>
  )

  if (loading) return <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>

  const availableTasks = allTasks.filter(t => t.id !== taskId && !deps.blockedBy.find(d=>d.id===t.id) && !deps.blocks.find(d=>d.id===t.id))

  return (
    <div className="space-y-3">
      {deps.blockedBy.length === 0 && deps.blocks.length === 0 && (
        <div className="text-xs text-text3 py-2">No dependencies yet</div>
      )}
      {deps.blockedBy.map(t => depRow(t, t.depId, 'blocked by'))}
      {deps.blocks.map(t => depRow(t, t.depId, 'blocks'))}

      {canEdit && !adding && (
        <div className="flex gap-2">
          <button onClick={() => setAdding('blocking')} className="text-[11px] text-accent hover:underline">+ Is blocked by</button>
          <span className="text-text3">·</span>
          <button onClick={() => setAdding('blocked')} className="text-[11px] text-accent hover:underline">+ Blocks</button>
        </div>
      )}

      {canEdit && adding && (
        <div className="flex gap-2">
          <select className="input text-xs flex-1" value={selTask} onChange={e => setSelTask(e.target.value)}>
            <option value="">Select task…</option>
            {availableTasks.map(t => <option key={t.id} value={t.id}>{t.taskKey} – {t.title}</option>)}
          </select>
          <button onClick={addDep} disabled={!selTask} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">Add</button>
          <button onClick={() => { setAdding(null); setSelTask('') }} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
        </div>
      )}
    </div>
  )
}

// ── Subtasks panel ─────────────────────────────────────────────────────────────
function SubtaskPanel({ taskId, initialSubtasks=[], onProgressChange, canEdit }) {
  const [subtasks, setSubtasks] = useState(initialSubtasks)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  useSocketEvent('subtask:created', useCallback(d => { if(d.taskId===taskId) setSubtasks(s=>[...s,d.subtask]) },[taskId]))
  useSocketEvent('subtask:updated', useCallback(d => { if(d.taskId===taskId){ setSubtasks(s=>s.map(x=>x.id===d.subtask.id?d.subtask:x)); onProgressChange?.(d.progress) }},[taskId]))
  useSocketEvent('subtask:deleted', useCallback(d => { if(d.taskId===taskId) setSubtasks(s=>s.filter(x=>x.id!==d.subtaskId)) },[taskId]))

  const add = async () => {
    if (!input.trim()) return; setAdding(true)
    try { const {data}=await api.post('/subtasks',{taskId,title:input.trim()}); setSubtasks(s=>[...s,data.subtask]); setInput('') }
    finally { setAdding(false) }
  }
  const toggle = async (id,completed) => {
    try { const{data}=await api.patch(`/subtasks/${id}`,{completed}); setSubtasks(s=>s.map(x=>x.id===id?{...x,completed:data.subtask.completed}:x)); onProgressChange?.(data.progress) } catch {}
  }
  const remove = async id => {
    try { await api.delete(`/subtasks/${id}`); setSubtasks(s=>s.filter(x=>x.id!==id)) } catch {}
  }

  const done=subtasks.filter(s=>s.completed).length, total=subtasks.length
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label mb-0">Subtasks{total>0&&<span className={`ml-1 ${done===total?'text-accent3':'text-text3'}`}>({done}/{total})</span>}</span>
        {total>0&&<div className="flex items-center gap-2"><div className="w-16 h-1 bg-surface3 rounded overflow-hidden"><div className="h-full bg-accent3 rounded transition-all" style={{width:`${total?(done/total)*100:0}%`}}/></div><span className="text-[10px] text-text3">{total?Math.round((done/total)*100):0}%</span></div>}
      </div>
      <div className="space-y-1 mb-2">
        {subtasks.length===0&&<div className="text-xs text-text3 py-1">No subtasks yet</div>}
        {subtasks.map(s=>(
          <div key={s.id} className="flex items-center gap-2 group">
            <input type="checkbox" checked={s.completed} onChange={e=>canEdit&&toggle(s.id,e.target.checked)} className="accent-accent3 flex-shrink-0 cursor-pointer" disabled={!canEdit}/>
            <span className={`flex-1 text-xs leading-relaxed ${s.completed?'line-through text-text3':'text-text2'}`}>{s.title}</span>
            {canEdit&&<button onClick={()=>remove(s.id)} className="opacity-0 group-hover:opacity-100 text-accent2 text-xs transition-opacity">✕</button>}
          </div>
        ))}
      </div>
      {canEdit&&<div className="flex gap-2"><input className="input flex-1 text-xs py-1.5" placeholder="Add subtask…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}/><button onClick={add} disabled={adding||!input.trim()} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">+</button></div>}
    </div>
  )
}

// ── Attachments panel ─────────────────────────────────────────────────────────
function AttachmentsPanel({ taskId, initialAttachments=[], canEdit }) {
  const [attachments,setAttachments]=useState(initialAttachments)
  const [uploading,setUploading]=useState(false)
  const fileRef=useRef(null)

  useSocketEvent('attachment:added',useCallback(d=>{if(d.taskId===taskId)setAttachments(a=>[d.attachment,...a])},[taskId]))
  useSocketEvent('attachment:deleted',useCallback(d=>{if(d.taskId===taskId)setAttachments(a=>a.filter(x=>x.id!==d.attachmentId))},[taskId]))

  const upload=async e=>{
    const file=e.target.files?.[0]; if(!file) return; setUploading(true)
    try { const form=new FormData(); form.append('file',file); form.append('taskId',taskId); const{data}=await api.post('/attachments',form,{headers:{'Content-Type':'multipart/form-data'}}); setAttachments(a=>[data.attachment,...a]) }
    catch(err){ alert(err.response?.data?.error||'Upload failed') }
    finally { setUploading(false); if(fileRef.current) fileRef.current.value='' }
  }
  const remove=async id=>{
    if(!confirm('Delete this attachment?')) return
    try { await api.delete(`/attachments/${id}`); setAttachments(a=>a.filter(x=>x.id!==id)) } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label mb-0">Attachments{attachments.length>0&&<span className="text-text3 ml-1">({attachments.length})</span>}</span>
        {canEdit&&<><input ref={fileRef} type="file" className="hidden" onChange={upload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"/><button onClick={()=>fileRef.current?.click()} disabled={uploading} className="text-[11px] text-accent hover:underline disabled:text-text3">{uploading?'Uploading…':'+ Upload'}</button></>}
      </div>
      {attachments.length===0&&<div className="text-xs text-text3 py-1">No attachments yet</div>}
      <div className="space-y-1.5">{attachments.map(a=>(
        <div key={a.id} className="flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3 py-2 group">
          <span className="text-base flex-shrink-0">{FILE_ICON(a.mimeType)}</span>
          <div className="flex-1 min-w-0">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-text2 hover:text-accent truncate block transition-colors">{a.originalName}</a>
            <div className="text-[10px] text-text3">{fmtBytes(a.size)}</div>
          </div>
          {canEdit&&<button onClick={()=>remove(a.id)} className="opacity-0 group-hover:opacity-100 text-accent2 text-xs transition-opacity">🗑</button>}
        </div>
      ))}</div>
    </div>
  )
}

// ── Task Detail Panel ─────────────────────────────────────────────────────────
function TaskDetail({ task, columns, members, allTasks, onClose, onSave, onDelete, canEdit }) {
  const [form,setForm] = useState({...task, dueDate:task.dueDate?task.dueDate.split('T')[0]:''})
  const [comments,setComments] = useState(task.comments||[])
  const [comment,setComment] = useState('')
  const [tab,setTab] = useState('details')
  const [saving,setSaving] = useState(false)
  const { user } = useAuth()

  useSocketEvent('comment:created',useCallback(d=>{if(d.taskId===task.id)setComments(c=>[...c,d.comment])},[task.id]))
  useSocketEvent('comment:deleted',useCallback(d=>{if(d.taskId===task.id)setComments(c=>c.filter(x=>x.id!==d.commentId))},[task.id]))

  const f = k => e => setForm(p=>({...p,[k]:e.target.value}))

  const save = async () => {
    setSaving(true)
    try { await onSave(task.id,form) } finally { setSaving(false) }
  }

  const postComment = async () => {
    if (!comment.trim()) return
    try { const{data}=await api.post('/comments',{taskId:task.id,content:comment.trim()}); setComments(c=>[...c,data.comment]); setComment('') } catch {}
  }

  const TABS = ['details','subtasks','dependencies','attachments','comments','activity']

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end" onClick={onClose}>
      <div className="bg-surface border-l border-border w-[520px] h-full flex flex-col" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-border flex-shrink-0">
          <div className="flex-1">
            <div className="text-[10px] text-text3 font-semibold mb-1">{task.taskKey}</div>
            {canEdit
              ? <textarea className="w-full bg-transparent font-display font-bold text-[16px] leading-snug outline-none resize-none" rows={2} value={form.title} onChange={f('title')}/>
              : <div className="font-display font-bold text-[16px] leading-snug">{task.title}</div>}
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-surface2 border border-border rounded-lg flex items-center justify-center text-text2 hover:text-text text-sm flex-shrink-0">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-3 py-2.5 text-[11px] font-semibold capitalize whitespace-nowrap transition-colors border-b-2 ${tab===t?'border-accent text-accent':'border-transparent text-text3 hover:text-text2'}`}>
              {t}{t==='subtasks'&&task.subtasks?.length>0&&` (${task.subtasks.length})`}
              {t==='comments'&&comments.length>0&&` (${comments.length})`}
              {t==='attachments'&&task.attachments?.length>0&&` (${task.attachments.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab==='details'&&(
            <>
              <div>
                <label className="label">Description</label>
                {canEdit ? <textarea className="input min-h-[70px] resize-y text-sm" value={form.description||''} onChange={f('description')} placeholder="Add description…"/>
                : <p className="text-sm text-text2 leading-relaxed">{task.description||'No description'}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Status</label>
                  {canEdit?<select className="input text-sm" value={form.columnId} onChange={f('columnId')}>{columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
                  :<span className="text-sm text-text2">{task.column?.label}</span>}
                </div>
                <div><label className="label">Priority</label>
                  {canEdit?<select className="input text-sm" value={form.priority} onChange={f('priority')}>{['LOW','MEDIUM','HIGH','CRITICAL'].map(p=><option key={p}>{p}</option>)}</select>
                  :<span className="text-sm text-text2">{task.priority}</span>}
                </div>
                <div><label className="label">Tag</label>
                  {canEdit?<select className="input text-sm" value={form.tag} onChange={f('tag')}>{['FEATURE','BUG','DESIGN','RESEARCH','DOCS'].map(t=><option key={t}>{t}</option>)}</select>
                  :<span className="text-sm text-text2">{task.tag}</span>}
                </div>
                <div><label className="label">Assignee</label>
                  {canEdit?<select className="input text-sm" value={form.assigneeId||''} onChange={f('assigneeId')}><option value="">Unassigned</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
                  :<span className="text-sm text-text2">{task.assignee?.name||'Unassigned'}</span>}
                </div>
                <div><label className="label">Due Date</label>
                  {canEdit?<input type="date" className="input text-sm" value={form.dueDate} onChange={f('dueDate')}/>
                  :<span className="text-sm text-text2">{fmtD(task.dueDate)}</span>}
                </div>
                <div><label className="label">Story Points</label>
                  {canEdit?<input type="number" className="input text-sm" min="0" max="100" value={form.storyPoints||''} onChange={f('storyPoints')} placeholder="0"/>
                  :<span className="text-sm text-text2">{task.storyPoints||'—'}</span>}
                </div>
              </div>
              {canEdit&&<div><label className="label">Progress: {form.progress}%</label>
                <input type="range" min="0" max="100" value={form.progress} onChange={f('progress')} className="w-full accent-accent3"/>
              </div>}
            </>
          )}
          {tab==='subtasks'&&<SubtaskPanel taskId={task.id} initialSubtasks={task.subtasks||[]} onProgressChange={p=>setForm(f=>({...f,progress:p}))} canEdit={canEdit}/>}
          {tab==='dependencies'&&<DependenciesPanel taskId={task.id} allTasks={allTasks} canEdit={canEdit}/>}
          {tab==='attachments'&&<AttachmentsPanel taskId={task.id} initialAttachments={task.attachments||[]} canEdit={canEdit}/>}
          {tab==='comments'&&(
            <div>
              <label className="label">Comments ({comments.length})</label>
              <div className="space-y-3 mb-3">
                {comments.length===0&&<div className="text-xs text-text3">No comments yet</div>}
                {comments.map(c=>(
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{background:c.author?.avatarColor}}>{c.author?.initials}</div>
                    <div className="flex-1 bg-surface2 border border-border rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{c.author?.name}</span>
                        <span className="text-[10px] text-text3">{fmtD(c.createdAt)}</span>
                      </div>
                      <CommentText content={c.content}/>
                    </div>
                  </div>
                ))}
              </div>
              <MentionInput value={comment} onChange={setComment} onSubmit={postComment} members={members} placeholder="Write a comment… use @name to mention"/>
              <button onClick={postComment} disabled={!comment.trim()} className="btn-primary px-3 py-1.5 text-xs mt-2 disabled:opacity-50">Send</button>
              <div className="text-[10px] text-text3 mt-1">Press Enter to send · Shift+Enter for new line · @name to mention</div>
            </div>
          )}
          {tab==='activity'&&<ActivityPanel taskId={task.id}/>}
        </div>

        {/* Footer */}
        {canEdit&&(
          <div className="flex gap-2 p-4 border-t border-border flex-shrink-0">
            <button onClick={()=>onDelete(task.id)} className="px-3 py-2 bg-accent2/10 border border-accent2/30 text-accent2 text-xs font-semibold rounded-lg hover:bg-accent2/20">🗑 Delete</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-2 text-sm disabled:opacity-60">{saving?'Saving…':'Save Changes'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onDragStart, onClick, onDelete, canEdit }) {
  const od=isOD(task)
  const stDone=task.subtasks?.filter(s=>s.completed).length||0
  const stTotal=task.subtasks?.length||0
  const hasBlocked = task.blockedBy?.length > 0
  return (
    <div className="bg-surface2 border border-border rounded-lg p-2.5 cursor-pointer hover:border-accent hover:-translate-y-px hover:shadow-lg transition-all group select-none"
      draggable onDragStart={()=>onDragStart(task.id)} onClick={()=>onClick(task)}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text3 font-semibold">{task.taskKey}</span>
          {hasBlocked && <span className="text-[10px] text-accent2" title="Blocked by other tasks">🔗</span>}
        </div>
        {canEdit&&<button onClick={e=>{e.stopPropagation();onDelete(task.id)}} className="opacity-0 group-hover:opacity-100 text-accent2 text-xs px-1 transition-opacity">🗑</button>}
      </div>
      <p className="text-[12.5px] font-medium leading-snug mb-2">{task.title}</p>
      <div className="mb-2 flex flex-wrap gap-1">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TAG_CLS[task.tag]||'bg-text2/10 text-text2'}`}>{task.tag?.toLowerCase()}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIO_DOT[task.priority]||'bg-text3'}`}/>
        <span className={`text-[10px] flex-1 ${od?'text-accent2 font-semibold':'text-text3'}`}>{od?'⚠️ ':task.dueDate?'📅 ':''}{fmtD(task.dueDate)}</span>
        {task._count?.attachments>0&&<span className="text-[10px] text-text3">📎{task._count.attachments}</span>}
        {stTotal>0&&<span className={`text-[10px] ${stDone===stTotal?'text-accent3':'text-text3'}`}>☑{stDone}/{stTotal}</span>}
        {task._count?.comments>0&&<span className="text-[10px] text-text3">💬{task._count.comments}</span>}
        {task.assignee&&<div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0" style={{background:task.assignee.avatarColor}} title={task.assignee.name}>{task.assignee.initials}</div>}
      </div>
      {task.progress>0&&<div className="mt-1.5 h-0.5 bg-surface3 rounded overflow-hidden"><div className="h-full bg-accent3 rounded transition-all" style={{width:`${task.progress}%`}}/></div>}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({ col, tasks, onDrop, onDragStart, onCardClick, onDeleteTask, onAddTask, onDeleteCol, onRenameCol, canEdit }) {
  const [over,setOver]=useState(false)
  const [rn,setRn]=useState(false)
  const [label,setLabel]=useState(col.label)
  return (
    <div className={`w-[268px] flex-shrink-0 bg-surface border rounded-xl flex flex-col max-h-full transition-shadow ${over?'border-accent shadow-[0_0_0_2px_#6c63ff]':'border-border'}`}
      onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={()=>{setOver(false);onDrop(col.id)}}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border" style={{color:col.color}}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:col.color}}/>
        {rn ? <input className="flex-1 bg-surface2 border border-border rounded px-2 py-0.5 text-xs font-bold text-text outline-none focus:border-accent" value={label} onChange={e=>setLabel(e.target.value)} onBlur={()=>{onRenameCol(col.id,label);setRn(false)}} onKeyDown={e=>e.key==='Enter'&&e.target.blur()} autoFocus/>
        : <span className="flex-1 text-xs font-bold truncate" onDoubleClick={()=>canEdit&&setRn(true)}>{col.label}</span>}
        <span className="text-[10px] text-text3 bg-surface2 border border-border rounded-full px-2 flex-shrink-0">{tasks.length}</span>
        {canEdit&&<button onClick={()=>onDeleteCol(col.id)} className="text-text3 hover:text-accent2 text-xs flex-shrink-0 transition-colors">✕</button>}
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5" style={{maxHeight:'calc(100vh - 260px)'}}>
        {tasks.length===0&&<div className="text-center py-6 text-text3 text-xs">Drop tasks here</div>}
        {tasks.map(t=><TaskCard key={t.id} task={t} onDragStart={onDragStart} onClick={onCardClick} onDelete={onDeleteTask} canEdit={canEdit}/>)}
      </div>
      {canEdit&&<button onClick={()=>onAddTask(col.id)} className="m-2 p-2 text-xs text-text3 border border-dashed border-border rounded-lg hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex-shrink-0">＋ Add task</button>}
    </div>
  )
}

// ── Create Task Modal ─────────────────────────────────────────────────────────
function CreateTaskModal({ columns, members, defaultColId, onClose, onCreate }) {
  const [form,setForm]=useState({title:'',description:'',columnId:defaultColId||columns[0]?.id||'',priority:'MEDIUM',tag:'FEATURE',assigneeId:'',dueDate:'',progress:0,storyPoints:'',recurrence:'none',recurrenceEnd:''})
  const [loading,setLoading]=useState(false)
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}))
  const submit = async e => { e.preventDefault(); if(!form.title.trim()) return; setLoading(true); try{await onCreate(form)}finally{setLoading(false)} }
  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface">
          <span className="font-display font-bold text-sm">✦ New Task</span>
          <button onClick={onClose} className="text-text2 hover:text-text">✕</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="label">Title *</label><input className="input" value={form.title} onChange={f('title')} placeholder="What needs to be done?" required/></div>
          <div><label className="label">Description</label><textarea className="input min-h-[55px] resize-y" value={form.description} onChange={f('description')} placeholder="Details…"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Status</label><select className="input" value={form.columnId} onChange={f('columnId')}>{columns.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label className="label">Priority</label><select className="input" value={form.priority} onChange={f('priority')}>{['LOW','MEDIUM','HIGH','CRITICAL'].map(p=><option key={p}>{p}</option>)}</select></div>
            <div><label className="label">Tag</label><select className="input" value={form.tag} onChange={f('tag')}>{['FEATURE','BUG','DESIGN','RESEARCH','DOCS'].map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="label">Assignee</label><select className="input" value={form.assigneeId} onChange={f('assigneeId')}><option value="">Unassigned</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div><label className="label">Due Date</label><input type="date" className="input" value={form.dueDate} onChange={f('dueDate')}/></div>
            <div><label className="label">Story Points</label><input type="number" className="input" min="0" value={form.storyPoints} onChange={f('storyPoints')} placeholder="0"/></div>
            <div><label className="label">Recurrence</label><select className="input" value={form.recurrence} onChange={f('recurrence')}><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
            {form.recurrence!=='none'&&<div><label className="label">Repeat Until</label><input type="date" className="input" value={form.recurrenceEnd} onChange={f('recurrenceEnd')}/></div>}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">{loading?'Creating…':'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Column Modal ──────────────────────────────────────────────────────────
const COL_COLORS=['#6c63ff','#ff6584','#43d9ad','#ffc94d','#ff9f43','#54a0ff','#c44dff','#ff6b6b']
function AddColumnModal({ onClose, onCreate }) {
  const [label,setLabel]=useState(''); const [color,setColor]=useState(COL_COLORS[0]); const [loading,setLoading]=useState(false)
  const submit=async e=>{e.preventDefault();if(!label.trim())return;setLoading(true);try{await onCreate(label,color)}finally{setLoading(false)}}
  return (
    <div className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-80" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border"><span className="font-display font-bold text-sm">＋ New Column</span><button onClick={onClose} className="text-text2">✕</button></div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div><label className="label">Name</label><input className="input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Blocked, QA" required/></div>
          <div><label className="label">Color</label><div className="flex gap-2 mt-1 flex-wrap">{COL_COLORS.map(c=><div key={c} onClick={()=>setColor(c)} className={`w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform ${color===c?'ring-2 ring-white ring-offset-1 ring-offset-surface':''}`} style={{background:c}}/>)}</div></div>
          <div className="flex gap-2 pt-1"><button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">{loading?'…':'Add'}</button></div>
        </form>
      </div>
    </div>
  )
}

// ── Main BoardPage ─────────────────────────────────────────────────────────────
export default function BoardPage() {
  const { user } = useAuth()
  const canEdit = user?.role !== 'VIEWER'

  const { tasks, loading:tLoad, refetch:refetchTasks, setTasks } = useTasks()
  const { columns, loading:cLoad, refetch:refetchCols } = useColumns()
  const { members } = useMembers()
  const { toasts, add:toast } = useToast()

  const [dragId,setDragId]           = useState(null)
  const [detail,setDetail]           = useState(null)
  const [createCol,setCreateCol]     = useState(null)
  const [showColModal,setShowColModal] = useState(false)
  const [showSearch,setShowSearch]   = useState(false)
  const [activeView,setActiveView]   = useState('board') // 'board' | 'sprints'
  const [search,setSearch]           = useState('')
  const [priFilter,setPriFilter]     = useState('all')
  const [overdueOnly,setOD]          = useState(false)

  // ── Real-time board events ──────────────────────────────────────────────────
  useSocketEvent('task:created', useCallback(d=>{setTasks(prev=>{if(prev.find(t=>t.id===d.task.id))return prev;return[d.task,...prev]});toast(`New: ${d.task.title}`,'success')},[]))
  useSocketEvent('task:updated', useCallback(d=>{setTasks(prev=>prev.map(t=>t.id===d.task.id?d.task:t))},[]))
  useSocketEvent('task:moved',   useCallback(d=>{setTasks(prev=>prev.map(t=>t.id===d.taskId?{...t,columnId:d.columnId}:t))},[]))
  useSocketEvent('task:deleted', useCallback(d=>{setTasks(prev=>prev.filter(t=>t.id!==d.taskId))},[]))

  // Keyboard shortcut: Cmd+K for search
  useEffect(() => {
    const handler = e => { if ((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setShowSearch(s=>!s) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filtered = tasks.filter(t=>{
    if (priFilter!=='all' && t.priority!==priFilter) return false
    if (overdueOnly && !isOD(t)) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleDrop = async colId => {
    if (!dragId||!canEdit) return
    const task=tasks.find(t=>t.id===dragId)
    if (!task||task.columnId===colId) { setDragId(null); return }
    setTasks(prev=>prev.map(t=>t.id===dragId?{...t,columnId:colId}:t))
    try { await api.patch(`/tasks/${dragId}/status`,{columnId:colId}); toast(`Moved to ${columns.find(c=>c.id===colId)?.label}`,'success') }
    catch { refetchTasks(); toast('Failed to move','error') }
    setDragId(null)
  }

  const handleCreate = async form => {
    try { await api.post('/tasks',form); await refetchTasks(); setCreateCol(null); toast('Task created','success') }
    catch (e) { toast(e.response?.data?.error||'Failed','error') }
  }

  const handleSave = async (id,form) => {
    try { await api.put(`/tasks/${id}`,{...form,progress:parseInt(form.progress)}); await refetchTasks(); setDetail(null); toast('Saved ✓','success') }
    catch { toast('Failed to save','error') }
  }

  const handleDelete = async id => {
    if (!confirm('Delete this task?')) return
    try { await api.delete(`/tasks/${id}`); setTasks(prev=>prev.filter(t=>t.id!==id)); setDetail(null); toast('Deleted','error') }
    catch { toast('Failed to delete','error') }
  }

  const handleAddCol = async (label,color) => {
    try { await api.post('/columns',{label,color}); await refetchCols(); setShowColModal(false); toast(`"${label}" added`,'success') }
    catch { toast('Failed','error') }
  }

  const handleRenameCol = async (id,label) => {
    if (!label.trim()) return
    try { await api.put(`/columns/${id}`,{label}); refetchCols() } catch {}
  }

  const handleDeleteCol = async id => {
    const n=tasks.filter(t=>t.columnId===id).length
    if (n>0) { toast(`Move ${n} task(s) out first`,'warning'); return }
    if (!confirm('Delete empty column?')) return
    try { await api.delete(`/columns/${id}`); refetchCols(); toast('Column deleted','error') }
    catch (e) { toast(e.response?.data?.error||'Failed','error') }
  }

  if (tLoad||cLoad) return <div className="h-screen bg-bg flex items-center justify-center"><LoadingSpinner size="lg"/></div>

  const overdueCnt=tasks.filter(t=>isOD(t)).length

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      <Topbar/>

      {/* Stats */}
      <div className="flex bg-surface border-b border-border flex-shrink-0 overflow-x-auto">
        {[
          {l:'Total',v:tasks.length,c:'text-text'},
          {l:'In Progress',v:tasks.filter(t=>columns.find(c=>c.label==='In Progress')?.id===t.columnId).length,c:'text-accent4'},
          {l:'Done',v:tasks.filter(t=>columns.find(c=>c.label==='Done')?.id===t.columnId).length,c:'text-accent3'},
          {l:'Critical',v:tasks.filter(t=>t.priority==='CRITICAL').length,c:'text-accent2'},
          {l:'Overdue',v:overdueCnt,c:'text-accent2'},
        ].map(s=>(
          <div key={s.l} className="flex items-center gap-2 px-5 py-2.5 border-r border-border flex-shrink-0 hover:bg-surface2 cursor-default transition-colors">
            <div><div className={`font-display font-black text-xl leading-none ${s.c}`}>{s.v}</div><div className="text-[10px] text-text3">{s.l}</div></div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="h-12 flex items-center px-4 gap-2 bg-surface border-b border-border flex-shrink-0 overflow-x-auto">
        {/* View tabs */}
        <div className="flex gap-1 bg-surface2 rounded-lg p-1 flex-shrink-0 overflow-x-auto">
          {[['board','Board'],['sprints','Sprints'],['timeline','Timeline'],['workload','Workload'],['goals','Goals'],['automations','Automations'],['intake','Forms']].map(([v,l])=>(
            <button key={v} onClick={()=>setActiveView(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeView===v?'bg-surface3 text-text':'text-text2 hover:text-text'}`}>{l}</button>
          ))}
        </div>

        <div className="w-px h-5 bg-border flex-shrink-0"/>

        {/* Search bar */}
        <div className="flex items-center gap-1.5 bg-surface2 border border-border rounded-lg px-2.5 py-1.5 flex-shrink-0">
          <span className="text-text3 text-xs">🔍</span>
          <input className="bg-transparent border-none outline-none text-xs text-text w-28 placeholder-text3" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        {/* Advanced search */}
        <button onClick={()=>setShowSearch(true)} className="filter-chip text-xs flex-shrink-0" title="Advanced search (⌘K)">
          ⚡ Advanced
        </button>

        {/* Priority filters */}
        <div className="flex gap-1">
          {[['all','🌐'],['CRITICAL','🔴'],['HIGH','🟡'],['MEDIUM','🔵'],['LOW','🟢']].map(([p,icon])=>(
            <button key={p} onClick={()=>setPriFilter(p)} className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-all flex-shrink-0 ${priFilter===p?'bg-accent/15 border-accent text-accent':'bg-surface2 border-border text-text2 hover:border-accent/50'}`}>
              {icon} {p==='all'?'All':p}
            </button>
          ))}
        </div>

        <button onClick={()=>setOD(o=>!o)} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all flex-shrink-0 ${overdueOnly?'bg-accent2/15 border-accent2 text-accent2':'bg-surface2 border-border text-text2'}`}>
          ⚠️ Overdue{overdueCnt>0&&` (${overdueCnt})`}
        </button>

        {canEdit&&<button onClick={()=>setCreateCol(columns[0]?.id||'')} className="btn-primary ml-auto py-1.5 px-3 text-xs flex-shrink-0">+ Add Task</button>}
      </div>

      {/* Main content */}
      {activeView==='board' ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-3 h-full items-start min-w-max">
            {columns.map(col=>(
              <Column key={col.id} col={col} tasks={filtered.filter(t=>t.columnId===col.id)}
                onDragStart={setDragId} onDrop={handleDrop}
                onCardClick={t=>setDetail(tasks.find(x=>x.id===t.id)||t)}
                onDeleteTask={handleDelete} onAddTask={id=>setCreateCol(id)}
                onDeleteCol={handleDeleteCol} onRenameCol={handleRenameCol} canEdit={canEdit}
              />
            ))}
            {canEdit&&<button onClick={()=>setShowColModal(true)} className="w-[240px] h-11 flex-shrink-0 bg-surface border border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-text3 text-xs hover:border-accent hover:text-accent hover:bg-accent/5 transition-all">＋ Add Column</button>}
          </div>
        </div>
      ) : activeView==='sprints' ? (
        <SprintsPage tasks={tasks} columns={columns} canEdit={canEdit} onTaskClick={t=>setDetail(tasks.find(x=>x.id===t.id)||t)} toast={toast}/>
      ) : activeView==='timeline' ? (
        <TimelinePage tasks={tasks} columns={columns} onTaskClick={t=>setDetail(tasks.find(x=>x.id===t.id)||t)}/>
      ) : activeView==='automations' ? (
        <AutomationsPage columns={columns} members={members} toast={toast}/>
      ) : activeView==='intake' ? (
        <IntakeFormsPage columns={columns} members={members} toast={toast}/>
      ) : activeView==='workload' ? (
        <WorkloadPage tasks={tasks} members={members} columns={columns}/>
      ) : activeView==='goals' ? (
        <GoalsPage toast={toast}/>
      ) : null}

      {/* Modals */}
      {detail&&<TaskDetail task={detail} columns={columns} members={members} allTasks={tasks} onClose={()=>setDetail(null)} onSave={handleSave} onDelete={handleDelete} canEdit={canEdit}/>}
      {createCol!==null&&<CreateTaskModal columns={columns} members={members} defaultColId={createCol} onClose={()=>setCreateCol(null)} onCreate={handleCreate}/>}
      {showColModal&&<AddColumnModal onClose={()=>setShowColModal(false)} onCreate={handleAddCol}/>}
      {showSearch&&<SearchPanel columns={columns} members={members} onClose={()=>setShowSearch(false)} onTaskClick={t=>{setDetail(tasks.find(x=>x.id===t.id)||t);setShowSearch(false)}}/>}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t=>(
          <div key={t.id} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium shadow-xl pointer-events-auto border bg-surface2 max-w-[260px] ${t.type==='success'?'border-l-2 border-accent3':t.type==='error'?'border-l-2 border-accent2':'border-l-2 border-accent4'}`}
            style={{animation:'slideIn 0.22s ease'}}>
            <span>{t.type==='success'?'✅':t.type==='error'?'🗑':'⚠️'}</span>{t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(36px);opacity:0}to{transform:translateX(0);opacity:1}}.filter-chip{display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #2a2f42;color:#8b90a7;background:#1e2230;transition:all 0.12s;}.filter-chip:hover{background:rgba(108,99,255,0.15);border-color:#6c63ff;color:#6c63ff;}`}</style>
    </div>
  )
}
