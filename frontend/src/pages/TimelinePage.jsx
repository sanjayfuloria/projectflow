// src/pages/TimelinePage.jsx
import { useState, useMemo, useRef } from 'react'

const PRIO_COLOR = {
  LOW: '#43d9ad', MEDIUM: '#6c63ff', HIGH: '#ffc94d', CRITICAL: '#ff6584'
}

function getDaysInRange(start, end) {
  const days = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const DAY_W = 36 // px per day
const ROW_H = 44 // px per task row

export default function TimelinePage({ tasks, columns, onTaskClick }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [monthOffset, setMonthOffset] = useState(0)
  const [filterCol, setFilterCol] = useState('')
  const scrollRef = useRef(null)

  // Build date range: current month ± offset, 3 months wide
  const rangeStart = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset - 1, 1)
    return d
  }, [monthOffset])

  const rangeEnd = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset + 2, 0)
    return d
  }, [monthOffset])

  const days = useMemo(() => getDaysInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd])

  // Tasks that have a due date
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.dueDate) return false
      if (filterCol && t.columnId !== filterCol) return false
      return true
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  }, [tasks, filterCol])

  // Group days by month for header
  const months = useMemo(() => {
    const groups = []
    let cur = null
    days.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!cur || cur.key !== key) {
        cur = { key, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), start: i, count: 1 }
        groups.push(cur)
      } else {
        cur.count++
      }
    })
    return groups
  }, [days])

  // Today's column offset
  const todayOffset = useMemo(() => {
    const idx = days.findIndex(d => isSameDay(d, today))
    return idx >= 0 ? idx * DAY_W : -1
  }, [days, today])

  function getBarStyle(task) {
    const due = new Date(task.dueDate)
    due.setHours(0, 0, 0, 0)

    // Use createdAt as start if available, else 3 days before due
    let start = task.createdAt ? new Date(task.createdAt) : new Date(due)
    start.setHours(0, 0, 0, 0)
    if (!task.createdAt) start.setDate(due.getDate() - 3)

    // Clamp to range
    const clampedStart = start < rangeStart ? rangeStart : start
    const clampedEnd   = due   > rangeEnd   ? rangeEnd   : due

    const startIdx = days.findIndex(d => isSameDay(d, clampedStart))
    const endIdx   = days.findIndex(d => isSameDay(d, clampedEnd))

    if (startIdx < 0 && endIdx < 0) return null

    const s = startIdx >= 0 ? startIdx : 0
    const e = endIdx   >= 0 ? endIdx   : days.length - 1
    const width = Math.max((e - s + 1) * DAY_W, DAY_W)

    const isOverdue = due < today && task.status !== 'done'

    return {
      left:  s * DAY_W,
      width,
      bg:    isOverdue ? '#ff6584' : PRIO_COLOR[task.priority] || '#6c63ff',
      overdue: isOverdue,
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface border-b border-border flex-shrink-0">
        <div className="flex gap-1">
          <button onClick={() => setMonthOffset(o => o - 1)} className="w-7 h-7 bg-surface2 border border-border rounded-lg flex items-center justify-center text-text2 hover:text-text text-sm">‹</button>
          <button onClick={() => setMonthOffset(0)} className="px-3 h-7 bg-surface2 border border-border rounded-lg text-xs text-text2 hover:text-text">Today</button>
          <button onClick={() => setMonthOffset(o => o + 1)} className="w-7 h-7 bg-surface2 border border-border rounded-lg flex items-center justify-center text-text2 hover:text-text text-sm">›</button>
        </div>
        <select className="input text-xs w-40" value={filterCol} onChange={e => setFilterCol(e.target.value)}>
          <option value="">All columns</option>
          {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="flex items-center gap-3 ml-auto text-xs text-text3">
          {[['LOW','#43d9ad'],['MEDIUM','#6c63ff'],['HIGH','#ffc94d'],['CRITICAL','#ff6584'],['Overdue','#ff6584']].map(([l,c]) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{background:c}}/>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {filteredTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-text3">
          <div className="text-4xl">📅</div>
          <div className="text-sm">No tasks with due dates found.</div>
          <div className="text-xs">Add due dates to tasks to see them on the timeline.</div>
        </div>
      )}

      {filteredTasks.length > 0 && (
        <div className="flex-1 overflow-hidden flex">
          {/* Left: task names */}
          <div className="w-52 flex-shrink-0 bg-surface border-r border-border flex flex-col">
            {/* Header spacer */}
            <div className="h-[52px] border-b border-border flex items-end pb-1 px-3">
              <span className="text-[10px] font-bold text-text3 uppercase tracking-wider">Task</span>
            </div>
            {filteredTasks.map(task => (
              <div key={task.id}
                className="flex items-center gap-2 px-3 border-b border-border cursor-pointer hover:bg-surface2 transition-colors"
                style={{ height: ROW_H }}
                onClick={() => onTaskClick(task)}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIO_COLOR[task.priority] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-text3 font-semibold">{task.taskKey}</div>
                  <div className="text-xs font-medium truncate">{task.title}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Gantt chart */}
          <div className="flex-1 overflow-auto" ref={scrollRef}>
            <div style={{ width: days.length * DAY_W, minWidth: '100%' }}>
              {/* Month header */}
              <div className="flex border-b border-border sticky top-0 bg-surface z-10" style={{ height: 26 }}>
                {months.map(m => (
                  <div key={m.key} className="border-r border-border flex items-center px-2 text-[10px] font-bold text-text2"
                    style={{ width: m.count * DAY_W, flex: 'none' }}>
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div className="flex border-b border-border sticky top-[26px] bg-surface z-10" style={{ height: 26 }}>
                {days.map((d, i) => {
                  const isToday = isSameDay(d, today)
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div key={i} className={`flex items-center justify-center border-r border-border text-[9px] font-semibold flex-none ${isToday ? 'bg-accent text-white' : isWeekend ? 'text-text3 bg-surface2' : 'text-text3'}`}
                      style={{ width: DAY_W }}>
                      {d.getDate()}
                    </div>
                  )
                })}
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Today line */}
                {todayOffset >= 0 && (
                  <div className="absolute top-0 bottom-0 w-px bg-accent z-20 pointer-events-none" style={{ left: todayOffset + DAY_W / 2 }} />
                )}

                {filteredTasks.map(task => {
                  const bar = getBarStyle(task)
                  return (
                    <div key={task.id} className="relative border-b border-border flex items-center" style={{ height: ROW_H }}>
                      {/* Weekend shading */}
                      {days.map((d, i) => (
                        (d.getDay() === 0 || d.getDay() === 6)
                          ? <div key={i} className="absolute top-0 bottom-0 bg-surface2/50" style={{ left: i * DAY_W, width: DAY_W }} />
                          : null
                      ))}
                      {/* Task bar */}
                      {bar && (
                        <div className="absolute rounded flex items-center px-2 cursor-pointer hover:opacity-90 transition-opacity z-10"
                          style={{ left: bar.left, width: bar.width, height: 26, background: bar.bg + '33', border: `1.5px solid ${bar.bg}` }}
                          onClick={() => onTaskClick(task)}
                          title={`${task.taskKey}: ${task.title}`}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-1" style={{ background: bar.bg }} />
                          <span className="text-[10px] font-semibold truncate text-text">{task.title}</span>
                          {bar.overdue && <span className="ml-1 text-[10px]">⚠️</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
