'use client'

import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>Welcome to Workspace</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '15px' }}>Create a new interview project to get started, or select an existing one from the sidebar.</p>
      </div>

      <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        <div style={{ 
          width: '64px', height: '64px', borderRadius: '50%', 
          backgroundColor: '#f0f9ff', color: '#0369a1', 
          display: 'flex', alignItems: 'center', justifyContent: 'center' 
        }}>
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none"><path d="M12 5v14M5 12h14"></path></svg>
        </div>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>Create New Interview</h2>
        <p style={{ margin: 0, color: '#6b7280', textAlign: 'center', maxWidth: '400px' }}>
          Build a guided interview plan with AI-generated technical questions and system design scenarios.
        </p>
        <button 
          onClick={() => router.push('/admin/create')}
          style={{
            marginTop: '16px',
            padding: '10px 24px',
            backgroundColor: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          Start Wizard
        </button>
      </div>
    </div>
  )
}
