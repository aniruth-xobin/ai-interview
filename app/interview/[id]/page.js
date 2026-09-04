'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LiveKitPipeline from '@/components/LiveKitPipeline'
import CustomPipeline from '@/components/CustomPipeline'

export default function CandidateInterviewPage({ params }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pipelineType = searchParams.get('pipeline') || 'livekit' // 'livekit' or 'custom'
  
  const id = params.id
  
  const [linkData, setLinkData] = useState(null)
  const [session, setSession] = useState(null)
  
  // Registration flow state
  const [isRegistered, setIsRegistered] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  
  // LiveKit state
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState('')

  useEffect(() => {
    const fetchLink = async () => {
      const { data } = await supabase.from('InterviewLink').select('*').eq('id', id).single()
      if (data) setLinkData(data)
    }
    fetchLink()
  }, [id])

  const handleStartInterview = async (e) => {
    e.preventDefault()
    if (!candidateName || !candidateEmail || !linkData) return
    
    setIsStarting(true)
    
    // Create new session record
    const { data: newSession, error } = await supabase.from('InterviewSession').insert([{
      id: crypto.randomUUID(),
      interviewLinkId: linkData.id,
      candidateName: candidateEmail ? `${candidateName} (${candidateEmail})` : candidateName,
      status: 'in_progress',
      startedAt: new Date().toISOString()
    }]).select().single()

    if (error || !newSession) {
      console.error('Failed to create session', error)
      setIsStarting(false)
      return
    }

    setSession(newSession);
    window.currentSession = newSession;
    
    // If LiveKit, get token
    if (pipelineType === 'livekit') {
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: `interview-${newSession.id}`,
            participantName: candidateName,
            metadata: (() => {
              const plan = linkData.interviewPlan || {};
              const goals = (plan.general || []).map(g => ({
                title: g.title,
                evaluationCriteria: g.evaluationCriteria || (g.question ? [g.question] : []),
                requires_code: false
              }));
              return {
                mode: 'guided',
                interviewGoals: goals,
                interviewerName: plan.interviewerName || 'Xona',
                jobTitle: linkData.title || 'Candidate'
              };
            })()
          })
        })
        const data = await res.json()
        if (data.token) {
          setToken(data.token)
          setServerUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://system-design-v59y2tll.livekit.cloud')
        }
      } catch (err) {
        console.error('Failed to get token', err)
      }
    }
    
    setIsRegistered(true)
    setIsStarting(false)
  }

  const handleSessionEnd = async (metrics, transcript) => {
    if (!session) {
      console.error('No session found in handleSessionEnd! Using window.currentSession instead.');
    }
    const currentSession = session || window.currentSession;
    if (!currentSession) return;
    
    console.log('Ending session:', currentSession.id);
    // Save to DB
    try {
      await supabase.from('InterviewSession').update({
        status: 'completed',
        completedAt: new Date().toISOString(),
        score: null,
        transcriptJson: JSON.stringify(transcript),
        reportJson: JSON.stringify({ metrics })
      }).eq('id', currentSession.id);
      
      console.log('Session updated in DB. Metrics will be pushed by Python agent. Redirecting...');
      // Redirect to completed page
      router.push(`/interview/${id}/completed`);
    } catch(err) {
      console.error('Error updating session:', err);
    }
  }

  if (!linkData) {
    return <div style={{ padding: '40px' }}>Loading interview configuration...</div>
  }

  if (!isRegistered) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', position: 'absolute', top: 0, left: 0, zIndex: 100 }}>
        <div style={{ background: '#ffffff', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin Logo" style={{ height: '36px', marginBottom: '24px' }} />
          
          <p style={{ margin: '0 0 32px 0', color: '#1e3a8a', fontSize: '15px', textAlign: 'center', lineHeight: '1.5' }}>
            Hello! I'm glad to have you for the <strong style={{color: '#0369a1'}}>{linkData.title}</strong> interview today. Before we begin, could you please fill in the details below?
          </p>

          <form onSubmit={handleStartInterview} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0369a1' }}>Full Name</label>
              <input
                required
                type="text"
                placeholder="Ex: John Doe"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#f8f9fb', outline: 'none', fontSize: '14px', width: '100%', color: '#111827', transition: 'border-color 0.15s ease' }}
                onFocus={e => e.target.style.borderColor = '#0284c7'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0369a1' }}>Email Address</label>
              <input
                required
                type="email"
                placeholder="Ex: john@example.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', background: '#f8f9fb', outline: 'none', fontSize: '14px', width: '100%', color: '#111827', transition: 'border-color 0.15s ease' }}
                onFocus={e => e.target.style.borderColor = '#0284c7'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            
            <button
              type="submit"
              disabled={isStarting}
              style={{ width: '100%', padding: '14px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: isStarting ? 'not-allowed' : 'pointer', transition: 'background 0.2s ease', opacity: isStarting ? 0.7 : 1, marginTop: '12px' }}
              onMouseOver={e => { if(!isStarting) e.target.style.background = '#0369a1' }}
              onMouseOut={e => { if(!isStarting) e.target.style.background = '#0284c7' }}
            >
              {isStarting ? 'Starting...' : 'Start Interview'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Interview Interface
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#111827' }}>
      <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", flexDirection: "column" }}>
        {pipelineType === 'livekit' ? (
           <LiveKitPipeline 
              token={token} 
              serverUrl={serverUrl} 
              onSessionEnd={handleSessionEnd}
              onMetricsUpdate={() => {}} candidateName={candidateName}
           />
        ) : (
           <CustomPipeline 
              active={true}
              interviewPlan={linkData.interviewPlan}
              onSessionEnd={handleSessionEnd}
              onMetricsUpdate={() => {}} candidateName={candidateName}
           />
        )}
      </div></div>)
}






