// src/pages/PublicFormPage.jsx
// This page is public — no authentication required
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const BASE = import.meta.env.VITE_API_URL || ''

export default function PublicFormPage() {
  const { slug } = useParams()
  const [form, setForm]       = useState(null)
  const [values, setValues]   = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [taskKey, setTaskKey]       = useState('')
  const [error, setError]           = useState('')
  const [formError, setFormError]   = useState('')

  useEffect(() => {
    fetch(`${BASE}/api/intake/public/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setForm(data.form)
      })
      .catch(() => setError('Failed to load form'))
      .finally(() => setLoading(false))
  }, [slug])

  const handleChange = (id, val) => setValues(v => ({ ...v, [id]: val }))

  const handleSubmit = async e => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${BASE}/api/intake/public/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Submission failed'); return }
      setTaskKey(data.taskKey)
      setSubmitted(true)
    } catch { setFormError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#6c63ff]/30 border-t-[#6c63ff] rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-white text-xl font-bold mb-2">Form not found</h1>
        <p className="text-[#8b90a7] text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6c63ff] shadow-[0_0_10px_#6c63ff]" />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#6c63ff' }}>ProjectFlow</span>
          </div>
          <p style={{ color: '#555d7a', fontSize: 12 }}>CDOE · IFHE Hyderabad</p>
        </div>

        <div style={{ background: '#161921', border: '1px solid #2a2f42', borderRadius: 14, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#6c63ff,#ff6584)', padding: '20px 24px' }}>
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, fontFamily: 'Syne, sans-serif', margin: 0 }}>{form.name}</h1>
            {form.description && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, margin: '6px 0 0' }}>{form.description}</p>}
          </div>

          {submitted ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ color: '#e8eaf0', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Submitted successfully!</h2>
              <p style={{ color: '#8b90a7', fontSize: 13, marginBottom: 12 }}>Your request has been received and will be reviewed by the team.</p>
              {taskKey && <div style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 8, padding: '8px 16px', display: 'inline-block' }}>
                <span style={{ color: '#555d7a', fontSize: 11 }}>Task ID: </span>
                <span style={{ color: '#6c63ff', fontWeight: 700, fontSize: 13 }}>{taskKey}</span>
              </div>}
              <div style={{ marginTop: 20 }}>
                <button onClick={() => { setSubmitted(false); setValues({}) }}
                  style={{ background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Submit Another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{ background: 'rgba(255,101,132,0.1)', border: '1px solid rgba(255,101,132,0.3)', color: '#ff6584', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  {formError}
                </div>
              )}

              {form.fields?.map(field => (
                <div key={field.id}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8b90a7', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5 }}>
                    {field.label}{field.required && <span style={{ color: '#ff6584' }}> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea value={values[field.id] || ''} onChange={e => handleChange(field.id, e.target.value)} required={field.required}
                      style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 8, padding: '9px 11px', color: '#e8eaf0', fontSize: 13, width: '100%', minHeight: 80, resize: 'vertical', outline: 'none', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, boxSizing: 'border-box' }}
                      placeholder={`Enter ${field.label.toLowerCase()}…`} />
                  ) : (
                    <input type={field.type || 'text'} value={values[field.id] || ''} onChange={e => handleChange(field.id, e.target.value)} required={field.required}
                      style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 8, padding: '9px 11px', color: '#e8eaf0', fontSize: 13, width: '100%', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                      placeholder={`Enter ${field.label.toLowerCase()}…`} />
                  )}
                </div>
              ))}

              <button type="submit" disabled={submitting}
                style={{ background: submitting ? '#555' : '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, marginTop: 4, transition: 'background 0.15s', fontFamily: 'DM Sans, sans-serif' }}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#555d7a', fontSize: 11, marginTop: 16 }}>
          Powered by ProjectFlow · CDOE · IFHE Hyderabad
        </p>
      </div>
    </div>
  )
}
