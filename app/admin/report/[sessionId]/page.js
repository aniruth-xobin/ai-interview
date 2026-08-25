'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import styles from '../../page.module.css'

export default function SessionReport({ params }) {
  const sessionId = params.sessionId
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase
        .from('InterviewSession')
        .select('*, InterviewLink (title, level, durationMin)')
        .eq('id', sessionId)
        .single()
      
      setSessionData(data)
      setLoading(false)
    }
    fetchSession()
  }, [sessionId])

  const handleStatusUpdate = async (newStatus) => {
    try {
      const { error } = await supabase
        .from('InterviewSession')
        .update({ status: newStatus })
        .eq('id', sessionId)
      
      if (error) throw error
      
      setSessionData(prev => ({ ...prev, status: newStatus }))
    } catch (err) {
      console.error(err)
      alert('Failed to update status')
    }
  }

  if (loading) return <div className={styles.container}><div className={styles.emptyState}>Loading...</div></div>
  if (!sessionData) return <div className={styles.container}><div className={styles.emptyState}>Session not found</div></div>

  const safeRender = (val) => typeof val === 'object' && val !== null ? JSON.stringify(val) : val;
  const reportData = sessionData.reportJson ? (typeof sessionData.reportJson === 'string' ? JSON.parse(sessionData.reportJson) : sessionData.reportJson) : {};
  const transcriptData = sessionData.transcriptJson ? (typeof sessionData.transcriptJson === 'string' ? JSON.parse(sessionData.transcriptJson) : sessionData.transcriptJson) : [];
  
  const metrics = reportData.metrics || { latencies: [], turns: 0 };
  const transcript = transcriptData || [];
  
  const avgLatency = metrics.latencies?.length > 0 
    ? Math.round(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length) 
    : 0

  return (
    <div className={styles.container}>
      <Link href={`/admin/link/${sessionData?.interviewLinkId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#f3f4f6', color: '#374151', textDecoration: 'none', borderRadius: '6px', fontWeight: '500', width: 'fit-content', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
        &larr; Back to Link Details
      </Link>
      
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <h2 className={styles.title} style={{ marginBottom: 0 }}>Candidate Report: {sessionData.candidateName || 'Anonymous'}</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => handleStatusUpdate('selected')}
              style={{ background: sessionData.status === 'selected' ? '#059669' : '#10b981', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', opacity: sessionData.status === 'selected' ? 0.8 : 1 }}>
              {sessionData.status === 'selected' ? 'Selected' : 'Select Candidate'}
            </button>
            <button 
              onClick={() => handleStatusUpdate('rejected')}
              style={{ background: sessionData.status === 'rejected' ? '#b91c1c' : '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', opacity: sessionData.status === 'rejected' ? 0.8 : 1 }}>
              {sessionData.status === 'rejected' ? 'Rejected' : 'Reject Candidate'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', color: '#a0a0a0', fontSize: '14px' }}>
          <div><strong>Status:</strong> {sessionData.status}</div>
          <div><strong>Started:</strong> {sessionData.startedAt ? new Date(sessionData.startedAt).toLocaleString() : '-'}</div>
          <div><strong>Completed:</strong> {sessionData.completedAt ? new Date(sessionData.completedAt).toLocaleString() : '-'}</div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.title}>Performance Metrics</h2>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '200px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Average Latency</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a' }}>{avgLatency} <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '500' }}>ms</span></div>
          </div>
          <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '200px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Total Turns</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a' }}>{metrics.turns}</div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.title}>Interview Transcript</h2>
        <div style={{ background: '#f9fafb', padding: '24px', borderRadius: '8px', maxHeight: '500px', overflowY: 'auto', border: '1px solid #eaeaea' }}>
          {transcript.length === 0 ? (
            <div className={styles.emptyState}>No transcript recorded</div>
          ) : (
            transcript.map((msg, i) => (
              <div key={i} style={{ marginBottom: '20px' }}>
                <strong style={{ color: msg.role === 'agent' ? '#2563eb' : '#059669', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {msg.role === 'agent' ? 'Interviewer' : sessionData.candidateName || 'Candidate'}
                </strong>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#374151', lineHeight: 1.5 }}>{safeRender(msg.text)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
