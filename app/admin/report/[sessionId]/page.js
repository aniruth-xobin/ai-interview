'use client'
export const runtime = 'edge';
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const SvgRenderer = dynamic(() => import('@/components/SvgRenderer'), { ssr: false })
import styles from '../../page.module.css'
import { supabase } from '@/lib/supabase'


client'
export const runtime = 'edge';
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
const SvgRenderer = dynamic(() => import('@/components/SvgRenderer'), { ssr: false })
import styles from '../../page.module.css'
import { supabase } from '@/lib/supabase'


if (typeof window !== 'undefined') {
  window.EXCALIDRAW_ASSET_PATH = "https://unpkg.com/@excalidraw/excalidraw/dist/"
  
  if (!window._workerPatched) {
    window._workerPatched = true;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        const urlStr = url instanceof URL ? url.href : String(url);
        if (urlStr.includes('excalidraw') && urlStr.includes('file://')) {
          super(URL.createObjectURL(new Blob([''], { type: 'application/javascript' })), options);
        } else {
          super(url, options);
        }
      }
    };

    // Suppress Excalidraw's expected timeout from the dummy worker
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => (a instanceof Error ? a.message : (typeof a === 'string' ? a : ''))).join(' ');
      if (msg.includes('Active worker did not respond')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
  }
}

export default function ReportDetails({ params }) {
  const unwrappedParams = use(params)
  const sessionId = unwrappedParams.sessionId
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [svgMarkup, setSvgMarkup] = useState(null)

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase
        .from('InterviewSession')
        .select(`*, InterviewLink (title, level, durationMin)`)
        .eq('id', sessionId)
        .single()
      
      setSessionData(data)
      setLoading(false)
    }
    fetchSession()
  }, [sessionId])

  useEffect(() => {
    if (sessionData?.canvasJson) {
      import('@excalidraw/excalidraw').then(mod => {
        const elements = typeof sessionData.canvasJson === 'string' ? JSON.parse(sessionData.canvasJson) : sessionData.canvasJson;
        const activeElements = elements.filter(el => !el.isDeleted);
        if (activeElements && activeElements.length > 0) {
          try {
            mod.exportToSvg({
              elements: activeElements,
              appState: {
                exportBackground: true,
                viewBackgroundColor: '#ffffff',
                exportWithDarkMode: false,
                exportScale: 1
              },
              files: null
            }).then(svg => {
              // Remove the hardcoded width/height so it scales naturally
              svg.removeAttribute('width')
              svg.removeAttribute('height')
              svg.style.width = '100%'
              svg.style.height = '100%'
              setSvgMarkup(svg.outerHTML)
            }).catch(err => {
              console.error("Error generating SVG:", err)
              setSvgMarkup('<svg></svg>')
            })
          } catch (err) {
            console.error("Synchronous error generating SVG:", err)
            setSvgMarkup('<svg></svg>')
          }
        } else {
          setSvgMarkup('<svg></svg>')
        }
      })
    }
  }, [sessionData?.canvasJson])

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

  const report = sessionData.reportJson ? (typeof sessionData.reportJson === 'string' ? JSON.parse(sessionData.reportJson) : sessionData.reportJson) : {}
  const transcript = sessionData.transcriptJson ? (typeof sessionData.transcriptJson === 'string' ? JSON.parse(sessionData.transcriptJson) : sessionData.transcriptJson) : []

  return (
    <div className={styles.container}>
      <Link href={`/admin/link/${sessionData.interviewLinkId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#f3f4f6', color: '#374151', textDecoration: 'none', borderRadius: '6px', fontWeight: '500', width: 'fit-content', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
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
          <div><strong>Score:</strong> {sessionData.score != null ? `${sessionData.score}/10` : 'N/A'}</div>
          <div><strong>Started:</strong> {sessionData.startedAt ? new Date(sessionData.startedAt).toLocaleString() : '-'}</div>
          <div><strong>Completed:</strong> {sessionData.completedAt ? new Date(sessionData.completedAt).toLocaleString() : '-'}</div>
        </div>

        {report.decision && (
          <div style={{ padding: '20px', background: report.decision.toLowerCase() === 'hire' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${report.decision.toLowerCase() === 'hire' ? '#bbf7d0' : '#fecaca'}`, borderRadius: '8px', marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: report.decision.toLowerCase() === 'hire' ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Decision: {report.decision}
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.5 }}>{report.feedback}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#111827', fontSize: '15px' }}>Strengths</h4>
            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: 1.6 }}>
              {report.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>No strengths recorded</li>}
            </ul>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#111827', fontSize: '15px' }}>Areas for Improvement</h4>
            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: 1.6 }}>
              {report.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>No weaknesses recorded</li>}
            </ul>
          </div>
        </div>

        {report.recommendation && (
          <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1e40af', fontSize: '15px' }}>Recommendation</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>{report.recommendation}</p>
          </div>
        )}
      </div>

      
      <div className={styles.card}>
        <h2 className={styles.title}>Submitted Code</h2>
        <div style={{ background: '#1e1e2e', padding: '24px', borderRadius: '8px', overflowX: 'auto', border: '1px solid #eaeaea' }}>
          {(() => {
            const codeMsg = [...transcript].reverse().find(m => m.role === 'user' && m.text.includes('[CODE_SUBMITTED]:'));
            if (codeMsg) {
               const code = codeMsg.text.split('[CODE_SUBMITTED]:')[1].trim();
               return <pre style={{ margin: 0, color: '#cdd6f4', fontFamily: 'monospace', fontSize: '14px' }}><code>{code}</code></pre>;
            }
            return <div className={styles.emptyState} style={{ color: '#a0a0a0' }}>No code submitted during this session.</div>;
          })()}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.title}>Final Architecture Diagram</h2>
        <div style={{ height: '500px', border: '1px solid #eaeaea', borderRadius: '8px', overflow: 'hidden', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {svgMarkup ? (
            svgMarkup === '<svg></svg>' ? (
              <div className={styles.emptyState}>No canvas data found</div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: svgMarkup }} style={{ width: '100%', height: '100%', padding: '20px', boxSizing: 'border-box' }} />
            )
          ) : sessionData?.canvasJson ? (
            <div className={styles.emptyState}>Rendering Diagram...</div>
          ) : (
            <div className={styles.emptyState}>
              No canvas data found
            </div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.title}>Interview Transcript</h2>
        <div style={{ background: '#f9fafb', padding: '24px', borderRadius: '8px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #eaeaea' }}>
          {transcript.length === 0 ? (
            <div className={styles.emptyState}>No transcript recorded</div>
          ) : (
            transcript.map((msg, i) => (
              <div key={i} style={{ marginBottom: '20px' }}>
                <strong style={{ color: msg.role === 'agent' ? '#2563eb' : '#059669', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {msg.role === 'agent' ? 'Interviewer' : sessionData.candidateName || 'Candidate'}
                </strong>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#374151', lineHeight: 1.5 }}>{msg.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
