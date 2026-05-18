// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BoardPage    from './pages/BoardPage'
import LoadingSpinner from './components/LoadingSpinner'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>
  return user ? <Navigate to="/" replace /> : children
}

// Inner component so it can access useAuth for the token
function AppWithSocket() {
  const { user } = useAuth()
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  return (
    <SocketProvider accessToken={token}>
      <Routes>
        <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/*"        element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
      </Routes>
    </SocketProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithSocket />
    </AuthProvider>
  )
}
