// src/pages/LoginPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_12px_#6c63ff]" />
            <span className="font-display text-2xl font-bold text-accent">ProjectFlow</span>
          </div>
          <p className="text-text3 text-sm">CDOE · IFHE Hyderabad</p>
        </div>

        <div className="card-base p-8">
          <h1 className="font-display text-xl font-bold mb-1">Welcome back</h1>
          <p className="text-text3 text-sm mb-6">Sign in to your workspace</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-accent2 text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input className="input" type="email" placeholder="you@ifhe.ac.in" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-text3 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent hover:underline">Register</Link>
          </p>
        </div>

        <p className="text-center text-text3 text-xs mt-6">
          Default admin: <span className="text-text2">admin@ifhe.ac.in</span> / <span className="text-text2">Admin@1234</span>
        </p>
      </div>
    </div>
  )
}
