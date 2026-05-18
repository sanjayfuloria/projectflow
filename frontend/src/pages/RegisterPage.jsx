// src/pages/RegisterPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GRAD_COLORS = [
  'linear-gradient(135deg,#6c63ff,#ff6584)',
  'linear-gradient(135deg,#43d9ad,#6c63ff)',
  'linear-gradient(135deg,#ffc94d,#ff6584)',
  'linear-gradient(135deg,#ff9f43,#43d9ad)',
  'linear-gradient(135deg,#54a0ff,#6c63ff)',
  'linear-gradient(135deg,#c44dff,#43d9ad)',
]

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', initials: '', avatarColor: GRAD_COLORS[0] })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/.test(form.password)) {
      setError('Password needs uppercase, lowercase, and a number'); return
    }
    setLoading(true)
    try {
      await register(form)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed')
    } finally { setLoading(false) }
  }

  const f = (k) => (e) => {
    let v = e.target.value
    if (k === 'initials') v = v.toUpperCase().slice(0, 3)
    setForm(prev => ({ ...prev, [k]: v }))
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_12px_#6c63ff]" />
            <span className="font-display text-2xl font-bold text-accent">ProjectFlow</span>
          </div>
          <p className="text-text3 text-sm">Create your account</p>
        </div>

        <div className="card-base p-8">
          <h1 className="font-display text-xl font-bold mb-1">Join your workspace</h1>
          <p className="text-text3 text-sm mb-6">CDOE · IFHE Hyderabad</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-accent2 text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" type="text" placeholder="Dr. Rajesh Kumar" value={form.name} onChange={f('name')} required />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="you@ifhe.ac.in" value={form.email} onChange={f('email')} required />
              </div>
              <div className="w-24">
                <label className="label">Initials</label>
                <input className="input" placeholder="RK" value={form.initials} onChange={f('initials')} maxLength={3} required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Min 8 chars, A-Z, a-z, 0-9" value={form.password} onChange={f('password')} required />
            </div>
            <div>
              <label className="label">Avatar Color</label>
              <div className="flex gap-2 mt-1">
                {GRAD_COLORS.map(c => (
                  <div key={c} onClick={() => setForm(p => ({ ...p, avatarColor: c }))}
                    className={`w-7 h-7 rounded-full cursor-pointer transition-transform hover:scale-110 ${form.avatarColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : ''}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 bg-surface2 rounded-lg p-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: form.avatarColor }}>
                {form.initials || '??'}
              </div>
              <div>
                <div className="text-sm font-medium">{form.name || 'Your Name'}</div>
                <div className="text-xs text-text3">{form.email || 'your@email.com'}</div>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-text3 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
