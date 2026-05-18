// src/components/Topbar.jsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import NotificationPanel, { useNotifications } from './NotificationPanel'

export default function Topbar() {
  const { user, logout } = useAuth()
  const { connected }    = useSocket() || {}
  const [userMenu, setUserMenu]   = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { unread } = useNotifications()
  const notifRef = useRef(null)

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-[52px] bg-surface border-b border-border flex items-center px-5 gap-4 flex-shrink-0 z-40 relative">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_#6c63ff]" />
        <span className="font-display text-[17px] font-bold text-accent">ProjectFlow</span>
      </div>
      <span className="text-text3 text-xs border-l border-border pl-3 hidden sm:block">🎓 CDOE · IFHE Hyderabad</span>

      {/* Live indicator */}
      <div className={`hidden sm:flex items-center gap-1.5 text-[10px] font-semibold ${connected ? 'text-accent3' : 'text-text3'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent3 animate-pulse' : 'bg-text3'}`} />
        {connected ? 'Live' : 'Connecting…'}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(o => !o)}
            className="w-8 h-8 bg-surface2 border border-border rounded-lg flex items-center justify-center text-text2 hover:text-text hover:bg-surface3 transition-all text-sm relative">
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent2 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-surface">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
        </div>

        {/* User avatar + menu */}
        <div className="relative">
          <button onClick={() => setUserMenu(m => !m)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white cursor-pointer ring-2 ring-transparent hover:ring-accent transition-all"
            style={{ background: user?.avatarColor || 'linear-gradient(135deg,#6c63ff,#ff6584)' }}>
            {user?.initials || '?'}
          </button>
          {userMenu && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-surface2 border border-border rounded-xl p-1.5 shadow-2xl z-50">
              <div className="px-3 py-2 border-b border-border mb-1">
                <div className="text-sm font-semibold">{user?.name}</div>
                <div className="text-xs text-text3 truncate">{user?.email}</div>
                <div className="text-xs text-accent mt-0.5 capitalize">{user?.role?.toLowerCase()}</div>
              </div>
              <button onClick={() => { logout(); setUserMenu(false) }}
                className="w-full text-left px-3 py-2 text-sm text-accent2 hover:bg-surface3 rounded-lg transition-colors">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
