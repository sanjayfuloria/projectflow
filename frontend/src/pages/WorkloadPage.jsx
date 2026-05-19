// src/pages/WorkloadPage.jsx
import { useMemo } from 'react'

const PRIO_COLOR  = { LOW:'#43d9ad', MEDIUM:'#6c63ff', HIGH:'#ffc94d', CRITICAL:'#ff6584' }
const STATUS_COLOR = { todo:'#6c63ff', inprogress:'#ffc94d', review:'#ff9f43', done:'#43d9ad' }

function isOD(t) { return t.dueDate && new Date(t.dueDate) < new Date() }

export default function WorkloadPage({ tasks, members, columns }) {
  const workload = useMemo(() => {
    return members.map(member => {
      const mt = tasks.filter(t => t.assigneeId === member.id)
      const byStatus = {}
      columns.forEach(c => { byStatus[c.id] = mt.filter(t => t.columnId === c.id).length })
      const overdue = mt.filter(t => isOD(t)).length
      const critical = mt.filter(t => t.priority === 'CRITICAL').length
      const avgProgress = mt.length ? Math.round(mt.reduce((a, t) => a + t.progress, 0) / mt.length) : 0
      const capacity = mt.length > 10 ? 'overloaded' : mt.length > 6 ? 'busy' : mt.length > 3 ? 'normal' : 'light'
      return { member, tasks: mt, byStatus, overdue, critical, avgProgress, capacity }
    })
  }, [tasks, members, columns])

  const unassigned = tasks.filter(t => !t.assigneeId)
  const maxTasks = Math.max(...workload.map(w => w.tasks.length), 1)

  const capacityStyle = {
    overloaded: 'bg-accent2/10 border-accent2/30 text-accent2',
    busy:       'bg-accent4/10 border-accent4/30 text-accent4',
    normal:     'bg-accent/10 border-accent/30 text-accent',
    light:      'bg-accent3/10 border-accent3/30 text-accent3',
  }
  const capacityLabel = { overloaded:'🔴 Overloaded', busy:'🟡 Busy', normal:'🔵 Normal', light:'🟢 Light' }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div>
        <h2 className="font-display font-bold text-lg">👥 Workload</h2>
        <p className="text-xs text-text3 mt-0.5">Team capacity and task distribution</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'Total Tasks', val:tasks.length, color:'text-text' },
          { label:'Unassigned', val:unassigned.length, color:'text-accent4' },
          { label:'Overdue', val:tasks.filter(t=>isOD(t)).length, color:'text-accent2' },
          { label:'Critical', val:tasks.filter(t=>t.priority==='CRITICAL').length, color:'text-accent2' },
        ].map(s=>(
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className={`font-display font-black text-2xl ${s.color}`}>{s.val}</div>
            <div className="text-[10px] text-text3 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Member workload cards */}
      <div className="space-y-4">
        {workload.map(({ member, tasks: mt, byStatus, overdue, critical, avgProgress, capacity }) => (
          <div key={member.id} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-4 mb-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: member.avatarColor }}>{member.initials}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{member.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${capacityStyle[capacity]}`}>
                    {capacityLabel[capacity]}
                  </span>
                </div>
                <div className="text-xs text-text3">{member.role} · {mt.length} task{mt.length !== 1 ? 's' : ''}</div>
              </div>
              {/* Capacity bar */}
              <div className="w-32">
                <div className="flex justify-between text-[10px] text-text3 mb-1">
                  <span>Capacity</span>
                  <span>{mt.length}/{maxTasks}</span>
                </div>
                <div className="h-2 bg-surface3 rounded overflow-hidden">
                  <div className="h-full rounded transition-all"
                    style={{
                      width: `${(mt.length / maxTasks) * 100}%`,
                      background: capacity === 'overloaded' ? '#ff6584' : capacity === 'busy' ? '#ffc94d' : '#6c63ff'
                    }} />
                </div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {columns.map(col => (
                byStatus[col.id] > 0 && (
                  <div key={col.id} className="flex items-center gap-1.5 bg-surface2 border border-border rounded-lg px-2.5 py-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-[11px] font-medium">{col.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: col.color }}>{byStatus[col.id]}</span>
                  </div>
                )
              ))}
              {overdue > 0 && (
                <div className="flex items-center gap-1.5 bg-accent2/10 border border-accent2/30 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] font-medium text-accent2">⚠️ {overdue} overdue</span>
                </div>
              )}
              {critical > 0 && (
                <div className="flex items-center gap-1.5 bg-accent2/10 border border-accent2/30 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] font-medium text-accent2">🔴 {critical} critical</span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {mt.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-surface3 rounded overflow-hidden">
                  <div className="h-full bg-accent3 rounded transition-all" style={{ width: `${avgProgress}%` }} />
                </div>
                <span className="text-[10px] text-text3 flex-shrink-0">{avgProgress}% avg progress</span>
              </div>
            )}

            {/* Task list (collapsed, show top 3) */}
            {mt.length > 0 && (
              <div className="mt-3 space-y-1">
                {mt.slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-text2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIO_COLOR[t.priority] }} />
                    <span className="text-[10px] text-text3 flex-shrink-0">{t.taskKey}</span>
                    <span className="truncate">{t.title}</span>
                    {isOD(t) && <span className="text-accent2 flex-shrink-0">⚠️</span>}
                  </div>
                ))}
                {mt.length > 3 && <div className="text-[10px] text-text3 pl-3">+{mt.length - 3} more tasks</div>}
              </div>
            )}
            {mt.length === 0 && <div className="text-xs text-text3 mt-2">No tasks assigned</div>}
          </div>
        ))}
      </div>

      {/* Unassigned tasks */}
      {unassigned.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-surface3 border border-border flex items-center justify-center text-text3">?</div>
            <div>
              <div className="font-semibold text-sm">Unassigned</div>
              <div className="text-xs text-text3">{unassigned.length} task{unassigned.length !== 1 ? 's' : ''} need owners</div>
            </div>
          </div>
          <div className="space-y-1">
            {unassigned.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs text-text2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: PRIO_COLOR[t.priority] }} />
                <span className="text-[10px] text-text3">{t.taskKey}</span>
                <span className="truncate">{t.title}</span>
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold bg-surface2`} style={{ color: PRIO_COLOR[t.priority] }}>{t.priority}</span>
              </div>
            ))}
            {unassigned.length > 5 && <div className="text-[10px] text-text3">+{unassigned.length - 5} more</div>}
          </div>
        </div>
      )}
    </div>
  )
}
