// src/components/NotificationPanel.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { useSocketEvent } from '../context/SocketContext'

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications)
      setUnread(data.unreadCount)
    } catch {}
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // Real-time: new notification arrives
  useSocketEvent('notification:new', useCallback((payload) => {
    setUnread(u => u + 1)
    setNotifications(prev => [{
      id: Date.now().toString(),
      title: 'New notification',
      message: payload.message,
      read: false,
      createdAt: new Date().toISOString(),
    }, ...prev.slice(0, 49)])
  }, []))

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(n => n.map(x => ({ ...x, read: true })))
      setUnread(0)
    } catch {}
  }

  const clearRead = async () => {
    try {
      await api.delete('/notifications/clear')
      setNotifications(n => n.filter(x => !x.read))
    } catch {}
  }

  return { notifications, unread, markAllRead, clearRead, refetch: fetch }
}

const TYPE_ICON = {
  TASK_ASSIGNED:     '📋',
  TASK_DUE_SOON:     '⏰',
  TASK_OVERDUE:      '🔴',
  COMMENT_ADDED:     '💬',
  TASK_MOVED:        '🔀',
  SUBTASK_COMPLETED: '✅',
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationPanel({ onClose }) {
  const { notifications, unread, markAllRead, clearRead } = useNotifications()

  return (
    <div className="absolute top-full right-0 mt-1 w-[320px] bg-surface border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ maxHeight: '420px' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Notifications</span>
          {unread > 0 && <span className="text-[10px] font-bold bg-accent2 text-white rounded-full px-1.5 py-0.5">{unread}</span>}
        </div>
        <div className="flex gap-3">
          {unread > 0 && <button onClick={markAllRead} className="text-[11px] text-accent hover:underline">Mark all read</button>}
          <button onClick={clearRead} className="text-[11px] text-text3 hover:text-text2">Clear</button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-text3">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-xs">You're all caught up!</div>
          </div>
        )}
        {notifications.map(n => (
          <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border hover:bg-surface2 transition-colors ${!n.read ? 'bg-accent/5' : ''}`}>
            <div className="text-base flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] || '🔔'}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-text">{n.title}</div>
              <div className="text-[11px] text-text2 leading-snug mt-0.5 truncate">{n.message}</div>
              <div className="text-[10px] text-text3 mt-1">{timeAgo(n.createdAt)}</div>
            </div>
            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}
