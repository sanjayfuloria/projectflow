// src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext(null)

const BASE = import.meta.env.VITE_API_URL || ''

export function SocketProvider({ accessToken, children }) {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!accessToken) return

    const socket = io(BASE, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socket.on('connect',    () => { setConnected(true);  console.log('🔌 Socket connected') })
    socket.on('disconnect', () => { setConnected(false); console.log('🔌 Socket disconnected') })
    socket.on('connect_error', (e) => console.warn('Socket error:', e.message))

    socketRef.current = socket
    return () => { socket.disconnect(); socketRef.current = null }
  }, [accessToken])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}

// Helper hook: subscribe to a socket event with auto-cleanup
export function useSocketEvent(event, handler) {
  const { socket } = useSocket() || {}
  useEffect(() => {
    if (!socket || !event) return
    socket.on(event, handler)
    return () => socket.off(event, handler)
  }, [socket, event, handler])
}
