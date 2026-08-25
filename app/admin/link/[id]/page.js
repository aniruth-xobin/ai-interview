'use client'
export const runtime = 'edge';
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LinkDetails({ params }) {
  const id = params.id
  const [linkData, setLinkData] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('candidates')
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' })

  const showAlert = (message) => setAlertConfig({ isOpen: true, message })
  const closeAlert = () => setAlertConfig({ isOpen: false, message: '' })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: linkRes } = await supabase.from('InterviewLink').select('*').eq('id', id).single()
      if (linkRes) {
        setLinkData(linkRes)
        const { data: sessionRes } = await supabase.from('InterviewSession').select('*').eq('interviewLinkId', id).order('startedAt', { ascending: false })
        setSessions(sessionRes || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <div style={{ padding: '40px', color: '#6b7280' }}>Loading project...</div>
  if (!linkData) return <div style={{ padding: '40px', color: '#6b7280' }}>Project not found</div>

  const inProgress = sessions.filter(s => s.status === 'in_progress')
  const completed = sessions.filter(s => s.status === 'completed')
  const selected = sessions.filter(s => s.status === 'selected')
  const rejected = sessions.filter(s => s.status === 'rejected')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Project Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>{linkData.title}</h1>
          </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                const url = `${window.location.origin}/interview/${linkData.id}?pipeline=livekit`
                navigator.clipboard.writeText(url)
                showAlert('Pipeline A Link Copied!')
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #eaeaea', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Pipeline A (LiveKit)
            </button>
            <button 
              onClick={() => {
                const url = `${window.location.origin}/interview/${linkData.id}?pipeline=custom`
                navigator.clipboard.writeText(url)
                showAlert('Pipeline B Link Copied!')
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #eaeaea', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: '#374151' }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Pipeline B (Custom)
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #eaeaea', paddingBottom: '0' }}>
          <div 
            onClick={() => setActiveTab('candidates')}
            style={{ paddingBottom: '12px', borderBottom: activeTab === 'candidates' ? '2px solid #111827' : '2px solid transparent', color: activeTab === 'candidates' ? '#111827' : '#6b7280', fontWeight: '500', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Candidates
          </div>
          <div 
            onClick={() => setActiveTab('selected')}
            style={{ paddingBottom: '12px', borderBottom: activeTab === 'selected' ? '2px solid #111827' : '2px solid transparent', color: activeTab === 'selected' ? '#111827' : '#6b7280', fontWeight: '500', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Selected Candidates
          </div>
        </div>
      </div>

      {activeTab === 'candidates' ? (
        <div style={{ display: 'flex', gap: '24px', flex: 1, overflowX: 'auto', paddingBottom: '20px' }}>
        
        {/* Column: In Progress */}
        <div style={{ width: '320px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>In Progress <span style={{ color: '#9ca3af', marginLeft: '8px' }}>{inProgress.length}</span></h3>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>+</button>
          </div>
          
          {inProgress.map(session => (
            <div key={session.id} style={{ background: '#ffffff', border: '1px solid #eaeaea', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <span style={{ padding: '4px 8px', background: '#fef3c7', color: '#b45309', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Interviewing</span>
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#111827' }}>{session.candidateName || 'Anonymous Candidate'}</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                Started: {new Date(session.startedAt).toLocaleDateString()}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e5e7eb', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>
                  {session.candidateName ? session.candidateName.charAt(0).toUpperCase() : '?'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Column: Completed */}
        <div style={{ width: '320px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>Review Needed <span style={{ color: '#9ca3af', marginLeft: '8px' }}>{completed.length}</span></h3>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>...</button>
          </div>
          
          {completed.map(session => (
            <div key={session.id} style={{ background: '#ffffff', border: '1px solid #eaeaea', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <span style={{ padding: '4px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Completed</span>
                {session.score != null && (
                  <span style={{ padding: '4px 8px', background: '#f3f4f6', color: '#374151', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>Score: {session.score}/10</span>
                )}
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#111827' }}>{session.candidateName || 'Anonymous Candidate'}</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                Completed: {new Date(session.completedAt || session.startedAt).toLocaleDateString()}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e5e7eb', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>
                  {session.candidateName ? session.candidateName.charAt(0).toUpperCase() : '?'}
                </div>
                <Link href={`/admin/report/${session.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b7280', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Report
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
      ) : (
        <div style={{ display: 'flex', gap: '24px', flex: 1, overflowX: 'auto', paddingBottom: '20px' }}>
          {/* Column: Selected */}
          <div style={{ width: '320px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>Selected <span style={{ color: '#9ca3af', marginLeft: '8px' }}>{selected.length}</span></h3>
            </div>
            
            {selected.map(session => (
              <div key={session.id} style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Selected</span>
                  {session.score != null && (
                    <span style={{ padding: '4px 8px', background: '#f3f4f6', color: '#374151', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>Score: {session.score}/10</span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#111827' }}>{session.candidateName || 'Anonymous Candidate'}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <Link href={`/admin/report/${session.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b7280', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Report
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Column: Rejected */}
          <div style={{ width: '320px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: 0 }}>Rejected <span style={{ color: '#9ca3af', marginLeft: '8px' }}>{rejected.length}</span></h3>
            </div>
            
            {rejected.map(session => (
              <div key={session.id} style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Rejected</span>
                  {session.score != null && (
                    <span style={{ padding: '4px 8px', background: '#f3f4f6', color: '#374151', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>Score: {session.score}/10</span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#111827' }}>{session.candidateName || 'Anonymous Candidate'}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <Link href={`/admin/report/${session.id}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6b7280', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertConfig.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
               <img src="/favicon.ico" width="40" height="40" alt="Xobin" style={{ borderRadius: '8px' }} />
            </div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#111827', textAlign: 'center' }}>Notification</h4>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#4b5563', textAlign: 'center' }}>{alertConfig.message}</p>
            <button 
              onClick={closeAlert} 
              style={{ width: '100%', padding: '10px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



