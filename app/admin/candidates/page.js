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
      <div className={styles.card}>
        <h2 className={styles.title}>All Candidates</h2>
        {loading ? (
          <div className={styles.emptyState}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 20px',
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
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Interview Role</th>
                <th>Status</th>
                <th>Score</th>
                <th>Started At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id}>
                  <td>{session.candidateName || 'Anonymous'}</td>
                  <td>{session.InterviewLink?.title || 'Unknown'}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: 600,
                      background: session.status === 'completed' ? '#f0fdf4' : '#fffbeb',
                      color: session.status === 'completed' ? '#166534' : '#b45309',
                      border: `1px solid ${session.status === 'completed' ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      {session.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{session.score != null ? `${session.score}/10` : '-'}</td>
                  <td>{session.startedAt ? new Date(session.startedAt).toLocaleString() : '-'}</td>
                  <td>
                    {session.status === 'completed' && (
                      <Link href={`/admin/report/${session.id}`} className={styles.linkBtn}>View Report</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
