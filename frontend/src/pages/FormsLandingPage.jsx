// src/pages/FormsLandingPage.jsx
// Public landing page — no auth required
// Shows all active intake forms as cards
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE = import.meta.env.VITE_API_URL || ''

const FORM_ICONS = {
  'bug':     '🐛',
  'feature': '✨',
  'docs':    '📚',
  'design':  '🎨',
  'research':'🔬',
}

const FORM_COLORS = [
  'from-[#6c63ff] to-[#ff6584]',
  'from-[#43d9ad] to-[#6c63ff]',
  'from-[#ffc94d] to-[#ff6584]',
  'from-[#ff9f43] to-[#43d9ad]',
  'from-[#54a0ff] to-[#6c63ff]',
  'from-[#c44dff] to-[#43d9ad]',
]

export default function FormsLandingPage() {
  const [forms, setForms]     = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Fetch all active forms from backend
    fetch(`${BASE}/api/intake/public`)
      .then(r => r.json())
      .then(data => {
        setForms((data.forms || []).filter(f => f.enabled))
      })
      .catch(() => setForms([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#0d0f14', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0d0f14 0%, #1e1b4b 100%)', borderBottom: '1px solid #2a2f42', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6c63ff', boxShadow: '0 0 12px #6c63ff' }} />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#6c63ff' }}>ProjectFlow</span>
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: '#e8eaf0', margin: '8px 0 6px' }}>
            CDOE Support Centre
          </h1>
          <p style={{ color: '#8b90a7', fontSize: 15, margin: 0 }}>
            ICFAI Foundation for Higher Education (IFHE) · Hyderabad
          </p>
          <p style={{ color: '#555d7a', fontSize: 13, marginTop: 6 }}>
            Select the appropriate form below to submit your request. Our team will respond promptly.
          </p>
        </div>
      </div>

      {/* Forms grid */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #2a2f42', borderTopColor: '#6c63ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            <p style={{ color: '#555d7a', marginTop: 12, fontSize: 13 }}>Loading forms…</p>
          </div>
        )}

        {!loading && forms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555d7a' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p>No forms available at the moment.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {forms.map((form, i) => {
            const gradient = FORM_COLORS[i % FORM_COLORS.length]
            const icon = FORM_ICONS[form.defaultTag?.toLowerCase()] || '📋'

            return (
              <div key={form.id}
                onClick={() => navigate(`/form/${form.slug}`)}
                style={{
                  background: '#161921',
                  border: '1px solid #2a2f42',
                  borderRadius: 14,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.borderColor = '#6c63ff'
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(108,99,255,0.2)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = '#2a2f42'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Card gradient top */}
                <div style={{
                  height: 6,
                  background: `linear-gradient(135deg, ${FORM_COLORS[i % FORM_COLORS.length].replace('from-[','').replace('] to-[',', ').replace(']','')})`
                }} />

                <div style={{ padding: '20px 22px 22px' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
                  <h3 style={{ color: '#e8eaf0', fontSize: 16, fontWeight: 700, margin: '0 0 8px', fontFamily: 'Syne, sans-serif' }}>
                    {form.name}
                  </h3>
                  {form.description && (
                    <p style={{ color: '#8b90a7', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
                      {form.description}
                    </p>
                  )}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)',
                    borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#6c63ff', fontWeight: 600,
                  }}>
                    Open Form →
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick links */}
        {!loading && forms.length > 0 && (
          <div style={{ marginTop: 48, padding: '24px', background: '#161921', border: '1px solid #2a2f42', borderRadius: 14 }}>
            <h3 style={{ color: '#e8eaf0', fontSize: 14, fontWeight: 700, marginBottom: 12, fontFamily: 'Syne, sans-serif' }}>
              🔗 Direct Links
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {forms.map(form => (
                <div key={form.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#555d7a', fontSize: 12, fontFamily: 'monospace', flex: 1 }}>
                    {window.location.origin}/form/{form.slug}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/form/${form.slug}`)}
                    style={{ background: 'transparent', border: '1px solid #2a2f42', borderRadius: 6, padding: '3px 10px', color: '#6c63ff', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    Copy
                  </button>
                  <button
                    onClick={() => navigate(`/form/${form.slug}`)}
                    style={{ background: 'transparent', border: '1px solid #2a2f42', borderRadius: 6, padding: '3px 10px', color: '#8b90a7', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    Open ↗
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, color: '#555d7a', fontSize: 12 }}>
          <p>Powered by <span style={{ color: '#6c63ff', fontWeight: 600 }}>ProjectFlow</span> · CDOE · IFHE Hyderabad</p>
          <p style={{ marginTop: 4 }}>
            <a href="/" style={{ color: '#555d7a', textDecoration: 'none' }}>Team Login →</a>
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
