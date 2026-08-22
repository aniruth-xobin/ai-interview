'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from '../page.module.css'
import { supabase } from '@/lib/supabase'

export default function CandidatesPage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('InterviewSession')
        .select(`*, InterviewLink (title)`)
        .order('startedAt', { ascending: false })
      
      setSessions(data || [])
      setLoading(false)
    }

    fetchSessions()
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.card} style={{ maxWidth: '1200px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 className={styles.title} style={{ margin: 0 }}>All Candidates</h2>
          {sessions.length > 0 && (
            <div style={{ fontSize: '14px', color: '#64748b', background: '#f8fafc', padding: '6px 16px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              {sessions.length} {sessions.length === 1 ? 'Candidate' : 'Candidates'}
            </div>
          )}
        </div>

        {loading ? (
          <div className={styles.emptyState}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 20px',
            textAlign: 'center',
            background: 'transparent',
            marginTop: '16px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#f0f9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>No candidates yet</h3>
            <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 24px 0', maxWidth: '400px' }}>
              You haven't received any interview submissions yet. Once candidates start taking your generated interviews, their results will appear here.
            </p>
            <Link href="/admin/create" style={{
              padding: '10px 24px',
              background: '#0284c7',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}>
              Create New Interview
            </Link>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', 
            gap: '20px' 
          }}>
            {sessions.map(session => (
              <div key={session.id} style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '12px', 
                      background: 'linear-gradient(135deg, #1e40af 0%, #0284c7 50%, #0ea5e9 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: '600', fontSize: '18px', flexShrink: 0
                    }}>
                      {(session.candidateName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.candidateName || 'Anonymous'}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.InterviewLink?.title || 'Unknown Role'}
                      </p>
                    </div>
                  </div>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '12px', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    background: session.status === 'completed' ? '#f0fdf4' : '#fffbeb',
                    color: session.status === 'completed' ? '#166534' : '#b45309',
                    border: `1px solid ${session.status === 'completed' ? '#bbf7d0' : '#fde68a'}`,
                    flexShrink: 0,
                    marginLeft: '8px'
                  }}>
                    {session.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span style={{ fontSize: '13px', color: '#475569' }}>
                      {session.startedAt ? new Date(session.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}
                    </span>
                  </div>
                  {session.status === 'completed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                      <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                        Score: <span style={{ color: '#0f172a' }}>{session.score != null ? `${session.score} / 10` : 'Pending'}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {session.status === 'completed' ? (
                    <Link href={`/admin/report/${session.id}`} style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 0',
                      background: '#f8fafc',
                      color: '#0284c7',
                      textAlign: 'center',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid #e2e8f0',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                      View Full Report
                    </Link>
                  ) : (
                    <div style={{
                      width: '100%',
                      padding: '10px 0',
                      background: '#f8fafc',
                      color: '#94a3b8',
                      textAlign: 'center',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: '1px solid #e2e8f0',
                      cursor: 'not-allowed'
                    }}>
                      Interview in Progress
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
